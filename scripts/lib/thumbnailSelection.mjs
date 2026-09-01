export function requestedCatalogIds(args) {
  const ids = [];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--catalog-id') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--catalog-id requires a catalog ID.');
      ids.push(value);
      index += 1;
      continue;
    }
    if (argument.startsWith('--catalog-id=')) {
      const value = argument.slice('--catalog-id='.length);
      if (!value) throw new Error('--catalog-id requires a catalog ID.');
      ids.push(value);
      continue;
    }
    throw new Error(`Unsupported thumbnail generator argument: ${argument}`);
  }
  return new Set(ids);
}

export function selectThumbnailItems(items, args) {
  const requested = requestedCatalogIds(args);
  if (requested.size === 0) return items;
  const available = new Set(items.map((item) => item.catalog_id));
  const missing = [...requested].filter((id) => !available.has(id)).sort();
  if (missing.length > 0) throw new Error(`Unknown catalog IDs: ${missing.join(', ')}`);
  return items.filter((item) => requested.has(item.catalog_id));
}
