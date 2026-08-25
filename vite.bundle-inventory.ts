import { normalizePath, type Plugin } from 'vite';

export function bundleInventory(name: string): Plugin {
  return {
    name: `g7pb-bundle-inventory-${name}`,
    generateBundle(_options, bundle) {
      const root = `${normalizePath(process.cwd())}/`;
      const modules = Array.from(new Set(Object.values(bundle).flatMap((output) =>
        output.type === 'chunk' ? Object.keys(output.modules) : [],
      ))).map((id) => normalizePath(id).replace(root, '')).sort();

      this.emitFile({
        type: 'asset',
        fileName: `meta/${name}-modules.json`,
        source: `${JSON.stringify({ bundle: name, modules }, null, 2)}\n`,
      });
    },
  };
}
