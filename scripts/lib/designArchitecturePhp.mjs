import { execFileSync } from 'node:child_process';
import { finding } from './designArchitecturePolicy.mjs';

// PHP's lexer excludes comments and strings, includes grouped use prefixes and fully qualified names.
const TOKENIZE = String.raw`
$files = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
$result = [];
foreach ($files as $path => $source) {
    $names = [];
    $inUse = false;
    $prefix = '';
    $group = '';
    $alias = false;
    foreach (token_get_all($source) as $token) {
        if (!is_array($token)) {
            if ($inUse && $token === '{') $group = trim($prefix, '\\');
            if ($token === ';') { $inUse = false; $group = ''; }
            if ($token === ',') $alias = false;
            continue;
        }
        if ($token[0] === T_USE) { $inUse = true; $prefix = ''; $group = ''; $alias = false; }
        if ($inUse && $token[0] === T_AS) { $alias = true; continue; }
        if (in_array($token[0], [T_NAME_QUALIFIED, T_NAME_FULLY_QUALIFIED, T_NAME_RELATIVE], true)
            || ($inUse && $token[0] === T_STRING)) {
            if ($inUse && $alias) continue;
            $name = $inUse && $group !== '' ? $group.'\\'.ltrim($token[1], '\\') : $token[1];
            if ($inUse && $group === '') $prefix = $token[1];
            $names[] = ['name' => $name, 'line' => $token[2]];
        }
    }
    $result[$path] = $names;
}
echo json_encode($result, JSON_THROW_ON_ERROR);
`;

export function inspectPhp(files, policy) {
  if (!Object.keys(files).length) return [];
  const tokens = JSON.parse(execFileSync('php', ['-r', TOKENIZE], {
    input: JSON.stringify(files), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  }));
  const results = [];
  for (const [path, names] of Object.entries(tokens)) {
    const layer = path.match(/^src\/(Domain|Contracts|Application)\//)?.[1];
    if (!layer) continue;
    for (const token of names) {
      const name = token.name.replace(/^\\/, '');
      const external = policy.phpForbiddenNamespaces.some((prefix) => name === prefix || name.startsWith(`${prefix}\\`));
      const target = name.startsWith(policy.phpNamespace) ? name.slice(policy.phpNamespace.length).split('\\')[0] : null;
      if (external || target && !policy.phpLayers[layer].includes(target)) {
        results.push(finding('PHP-BOUNDARY', path, token.line, `${layer} may not depend on ${name}`, name));
      }
    }
  }
  return results;
}
