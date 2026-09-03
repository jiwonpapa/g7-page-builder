export function readCssGraph(root: string, entries: readonly string[]): Promise<{
  css: string;
  files: string[];
}>;

export function cssPropertyValues(css: string, selector: string, property: string): string[];
