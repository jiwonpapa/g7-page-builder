import { execFileSync } from 'node:child_process';
import { finding } from './designArchitecturePolicy.mjs';

// Resolve lexical names without executing the source or mistaking comments/string contents for dependencies.
const TOKENIZE = String.raw`
$files = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
$result = [];
$nameTokens = [T_NAMESPACE, T_USE, T_AS, T_FUNCTION, T_CONST, T_STRING, T_NS_SEPARATOR,
    T_NAME_QUALIFIED, T_NAME_FULLY_QUALIFIED, T_NAME_RELATIVE];
foreach ($files as $path => $source) {
    $tokens = [];
    foreach (token_get_all($source) as $token) {
        if (!is_array($token)) {
            if (str_contains('{};(),', $token)) $tokens[] = [$token, $token, 0];
        } elseif ($token[0] === T_CURLY_OPEN || $token[0] === T_DOLLAR_OPEN_CURLY_BRACES) {
            $tokens[] = ['{', '{', $token[2]];
        } elseif (in_array($token[0], $nameTokens, true)) {
            $tokens[] = [token_name($token[0]), $token[1], $token[2]];
        }
    }
    $result[$path] = $tokens;
}
echo json_encode($result, JSON_THROW_ON_ERROR);
`;

const QUALIFIED_NAMES = new Set(['T_NAME_QUALIFIED', 'T_NAME_FULLY_QUALIFIED', 'T_NAME_RELATIVE']);
const trimName = (name) => name.replace(/^\\+|\\+$/g, '');

function readImports(tokens, start, scope, names) {
  let group = ''; let name = ''; let alias = ''; let inAlias = false; let line = 1;
  let defaultKind = 'class'; let kind = defaultKind;
  const finish = () => {
    if (name) {
      const full = trimName(group ? `${group}\\${name}` : name);
      names.push({ name: full, line, absolute: true });
      if (kind === 'class') scope.aliases.set((alias || full.split('\\').at(-1)).toLowerCase(), full);
    }
    name = ''; alias = ''; inAlias = false; kind = defaultKind;
  };
  for (let index = start; index < tokens.length; index++) {
    const [token, value, tokenLine] = tokens[index];
    if (token === ';') { finish(); return index; }
    if (token === '{') { group = trimName(name); name = ''; continue; }
    if (token === '}') { finish(); group = ''; continue; }
    if (token === ',') { finish(); continue; }
    if (token === 'T_AS') { inAlias = true; continue; }
    if (token === 'T_FUNCTION' || token === 'T_CONST') {
      kind = token;
      if (!group && !name) defaultKind = kind;
      continue;
    }
    if (token === 'T_STRING' || token === 'T_NS_SEPARATOR' || QUALIFIED_NAMES.has(token)) {
      if (inAlias) alias += value;
      else { if (!name) line = tokenLine; name += value; }
    }
  }
  return tokens.length;
}

function dependencyNames(tokens) {
  const names = [];
  let depth = 0; let namespaceDepth = 0;
  let scope = { namespace: '', aliases: new Map() };
  for (let index = 0; index < tokens.length; index++) {
    const [token, value, line] = tokens[index];
    if (token === 'T_NAMESPACE') {
      let namespace = '';
      while (++index < tokens.length && ![';', '{'].includes(tokens[index][0])) namespace += tokens[index][1];
      if (tokens[index]?.[0] === '{') depth++;
      namespaceDepth = depth;
      scope = { namespace: trimName(namespace), aliases: new Map() };
      continue;
    }
    if (token === '{') { depth++; continue; }
    if (token === '}') {
      if (--depth < namespaceDepth) {
        namespaceDepth = depth;
        scope = { namespace: '', aliases: new Map() };
      }
      continue;
    }
    if (token === 'T_USE' && depth === namespaceDepth && tokens[index + 1]?.[0] !== '(') {
      index = readImports(tokens, index + 1, scope, names);
      continue;
    }
    if (QUALIFIED_NAMES.has(token)) names.push({ name: value, line, scope,
      absolute: token === 'T_NAME_FULLY_QUALIFIED', relative: token === 'T_NAME_RELATIVE' });
  }
  return names.map(({ name, line, scope: referenceScope, absolute, relative }) => {
    if (absolute) return { name: trimName(name), line };
    const parts = name.split('\\');
    const prefix = relative ? null : referenceScope.aliases.get(parts[0].toLowerCase());
    const resolved = prefix ? [prefix, ...parts.slice(1)]
      : [referenceScope.namespace, ...(relative ? parts.slice(1) : parts)];
    return { name: resolved.filter(Boolean).join('\\'), line };
  });
}

export function inspectPhp(files, policy) {
  const protectedFiles = Object.fromEntries(Object.entries(files).filter(([path]) => /^src\/(Domain|Contracts|Application)\//.test(path)));
  if (!Object.keys(protectedFiles).length) return [];
  const tokens = JSON.parse(execFileSync('php', ['-r', TOKENIZE], {
    input: JSON.stringify(protectedFiles), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  }));
  const results = [];
  const productNamespace = policy.phpNamespace.toLowerCase();
  for (const [path, fileTokens] of Object.entries(tokens)) {
    const layer = path.match(/^src\/(Domain|Contracts|Application)\//)?.[1];
    for (const token of dependencyNames(fileTokens)) {
      const name = token.name.replace(/^\\/, '');
      const normalized = name.toLowerCase();
      const external = policy.phpForbiddenNamespaces.some((prefix) => normalized === prefix.toLowerCase() || normalized.startsWith(`${prefix.toLowerCase()}\\`));
      const target = normalized.startsWith(productNamespace) ? normalized.slice(productNamespace.length).split('\\')[0] : null;
      if (external || target && !policy.phpLayers[layer].some((allowed) => allowed.toLowerCase() === target)) {
        results.push(finding('PHP-BOUNDARY', path, token.line, `${layer} may not depend on ${name}`, name));
      }
    }
  }
  return results;
}
