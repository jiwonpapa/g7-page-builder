/** Bounded interpreter for our checked-in schema subset, not a general JSON Schema API. */
export interface Rule {
  $schema?: string; $id?: string; $defs?: Record<string, Rule>; $ref?: string;
  type?: string; const?: unknown; enum?: unknown[]; anyOf?: Rule[];
  properties?: Record<string, Rule | undefined>; required?: string[]; additionalProperties?: boolean;
  items?: Rule; minItems?: number; maxItems?: number; minLength?: number; maxLength?: number; pattern?: string;
  minimum?: number; maximum?: number; multipleOf?: number;
}
export class V3Error extends Error {
  constructor(public readonly code: string, public readonly path: string) { super(`${code}: ${path}`); }
}
export function reject(code: string, path: string): never { throw new V3Error(code, path); }
export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
export function jsonBytes(value: unknown, maxDepth: number): number {
  const seen = new Set<object>();
  const visit = (current: unknown, depth: number): void => {
    if (depth > maxDepth) reject('json_depth', '$');
    if (current === null || typeof current === 'boolean') return;
    if (typeof current === 'string') {
      if (/[\uD800-\uDFFF]/u.test(current)) reject('json', '$');
      return;
    }
    if (typeof current === 'number') { if (!Number.isFinite(current)) reject('json', '$'); return; }
    if (!Array.isArray(current) && !record(current)) reject('json', '$');
    if (seen.has(current) || Object.getOwnPropertySymbols(current).length || 'toJSON' in current) reject('json', '$');
    seen.add(current);
    if (Array.isArray(current) && (Object.keys(current).length !== current.length || Object.keys(current).some((key, index) => key !== String(index)))) reject('json', '$');
    for (const key of Object.keys(current)) {
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (!descriptor || !('value' in descriptor)) reject('json', '$');
      visit(descriptor.value, depth + 1);
    }
    seen.delete(current);
  };
  visit(value, 0);
  return new TextEncoder().encode(JSON.stringify(value)).length;
}
export function validateRule(value: unknown, rule: Rule, definitions: Record<string, Rule>, path = '$'): void {
  if (rule.$ref) {
    const name = rule.$ref.replace('#/$defs/', '');
    if (!rule.$ref.startsWith('#/$defs/') || !Object.hasOwn(definitions, name)) reject('schema', path);
    return validateRule(value, definitions[name], definitions, path);
  }
  if (rule.anyOf) {
    for (const choice of rule.anyOf) {
      try { validateRule(value, choice, definitions, path); return; } catch (error) { if (!(error instanceof V3Error) || error.code === 'schema') throw error; }
    }
    reject('value', path + ':anyOf');
  }
  const equal = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
  if (Object.hasOwn(rule, 'const') && !equal(value, rule.const)) reject('value', path);
  if (rule.enum && !rule.enum.some(item => equal(value, item))) reject('value', path);
  switch (rule.type) {
    case 'object':
      if (!record(value)) reject('shape', path);
      for (const key of rule.required ?? []) if (!Object.hasOwn(value, key)) reject('required', path + '.' + key);
      for (const [key, child] of Object.entries(value)) {
        const childRule = rule.properties?.[key];
        if (!Object.hasOwn(rule.properties ?? {}, key) || !childRule) reject('unknown_field', path + '.' + key);
        validateRule(child, childRule, definitions, path + '.' + key);
      }
      break;
    case 'array':
      if (!Array.isArray(value)) reject('shape', path);
      if (value.length < (rule.minItems ?? 0) || value.length > (rule.maxItems ?? Infinity)) reject('range', path);
      value.forEach((child, index) => validateRule(child, rule.items!, definitions, path + '.' + index));
      break;
    case 'string':
      if (typeof value !== 'string') reject('shape', path);
      if (Array.from(value).length < (rule.minLength ?? 0) || Array.from(value).length > (rule.maxLength ?? Infinity) || (rule.pattern && !new RegExp(rule.pattern, 'u').test(value))) reject('value', path);
      break;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) reject('shape', path);
      if (value < (rule.minimum ?? -Infinity) || value > (rule.maximum ?? Infinity)) reject('range', path);
      if (rule.multipleOf && Math.abs(value / rule.multipleOf - Math.round(value / rule.multipleOf)) > 1e-7) reject('precision', path);
      break;
    case 'boolean': if (typeof value !== 'boolean') reject('shape', path); break;
    case undefined: break;
    default: reject('schema', path);
  }
}
