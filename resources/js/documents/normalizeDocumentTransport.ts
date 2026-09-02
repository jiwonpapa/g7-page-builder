function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// PHP associative decoding represents both {} and [] as an empty array. Restore
// only canonical object fields; never coerce nonempty lists or block prop values.
function objectField(value: unknown): unknown {
  return Array.isArray(value) && value.length === 0 ? {} : value;
}

function block(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const result = { ...value };
  if (Object.hasOwn(result, 'props')) result.props = objectField(result.props);
  if (Object.hasOwn(result, 'slots')) {
    const slots = objectField(result.slots);
    result.slots = isRecord(slots)
      ? Object.fromEntries(Object.entries(slots).map(([name, children]) => [
        name, Array.isArray(children) ? children.map(block) : children,
      ]))
      : slots;
  }
  return result;
}

/** Decode canonical documents/patterns inside API envelopes without changing lists. */
export function normalizeDocumentTransport<T>(value: T): T {
  function visit(input: unknown): unknown {
    if (Array.isArray(input)) return input.map(visit);
    if (!isRecord(input)) return input;
    if (input.schema_version === 'g7-page-builder/v1'
      || input.schema_version === 'g7-page-builder/v2'
      || input.schema_version === 'g7-page-builder/site-part/v1') {
      const document = {
        ...input,
        ...(Object.hasOwn(input, 'tokens') ? { tokens: objectField(input.tokens) } : {}),
        blocks: Array.isArray(input.blocks) ? input.blocks.map(block) : input.blocks,
      };
      return document;
    }
    if (input.schema_version === 'g7-page-builder/section-pattern/v1') {
      return { ...input, section: block(input.section) };
    }
    return Object.fromEntries(Object.entries(input).map(([key, child]) => [key, visit(child)]));
  }
  return visit(value) as T;
}
