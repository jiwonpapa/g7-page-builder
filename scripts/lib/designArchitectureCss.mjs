import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import selectorParser from 'postcss-selector-parser';
import namedColors from 'color-name';
import { finding } from './designArchitecturePolicy.mjs';

// Literal colors are legal in the token definitions, not copied into new component declarations.
const COLOR_FUNCTIONS = new Set(['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color']);
const COLOR_NAMES = new Set(Object.keys(namedColors));
const COLOR_PROPERTIES = /^(?:color|background(?:-.+)?|border(?:-.+)?|outline(?:-.+)?|box-shadow|text-shadow|fill|stroke(?:-.+)?|text-decoration(?:-.+)?|caret-color|accent-color|filter)$/;

function hasLiteralColor(value) {
  let found = false;
  valueParser(value).walk((node) => {
    if (node.type === 'function' && node.value.toLowerCase() === 'url') return false;
    if (node.type === 'function' && COLOR_FUNCTIONS.has(node.value.toLowerCase())) found = true;
    if (node.type === 'word' && (/^#[\da-f]{3,8}$/i.test(node.value) || COLOR_NAMES.has(node.value.toLowerCase()))) found = true;
    return undefined;
  });
  return found;
}

function context(node) {
  const ancestors = [];
  for (let parent = node.parent; parent && parent.type !== 'root'; parent = parent.parent) {
    ancestors.unshift(parent.type === 'rule' ? parent.selector : `@${parent.name} ${parent.params}`);
  }
  return ancestors.join(' / ').replace(/\s+/g, ' ').trim();
}

export function inspectCss(path, source, policy) {
  let root;
  try { root = postcss.parse(source, { from: path }); }
  catch (error) { return [finding('CSS-COLOR', path, error.line ?? 1, `Cannot analyze invalid CSS: ${error.reason}`)]; }
  const results = [];
  root.walkDecls((declaration) => {
    const token = declaration.prop.startsWith('--');
    const identity = `${context(declaration)} | ${declaration.prop}:${declaration.value}`;
    const line = declaration.source.start.line;
    if ((token || COLOR_PROPERTIES.test(declaration.prop)) && hasLiteralColor(declaration.value)
      && !(token && policy.cssTokenSources.includes(path))) {
      results.push(finding('CSS-COLOR', path, line, `Use a shared semantic token for ${declaration.prop}`, identity));
    }
    if (declaration.important) results.push(finding('CSS-IMPORTANT', path, line,
      `Explain and isolate the override for ${declaration.prop}`, identity));
  });
  root.walkRules((rule) => {
    selectorParser((selectors) => selectors.walk((selector) => {
      if (selector.type !== 'selector') return;
      const classes = new Set();
      let duplicate = false;
      selector.each((node) => {
        if (node.type === 'combinator') classes.clear();
        if (node.type === 'class') {
          if (classes.has(node.value)) duplicate = true;
          classes.add(node.value);
        }
      });
      if (duplicate) results.push(finding('CSS-SPECIFICITY', path, rule.source.start.line,
        'Repeating a class to increase specificity is not a styling layer', `${context(rule)} | ${selector.toString()}`));
    })).processSync(rule.selector);
  });
  return results;
}
