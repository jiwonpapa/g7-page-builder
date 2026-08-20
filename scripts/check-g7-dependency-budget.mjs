import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const manifest = JSON.parse(readFileSync(join(root, 'module.json'), 'utf8'));

if (manifest.hidden !== false) {
  failures.push('module.json hidden must be false so the separate Page Builder menu remains discoverable');
}

if (manifest.loading?.strategy !== 'global') {
  failures.push('module.json loading.strategy must be global so active User Templates receive public page assets');
}

if (
  manifest.assets?.js?.output !== 'dist/js/page-effects.iife.js' ||
  manifest.assets?.css?.output !== 'dist/css/page-builder-public.css'
) {
  failures.push('module.json may inject only the scoped public effects and public page CSS globally');
}

for (const dependencyType of ['modules', 'plugins']) {
  const dependencies = manifest.dependencies?.[dependencyType];

  if (
    dependencies === null ||
    typeof dependencies !== 'object' ||
    Array.isArray(dependencies) ||
    Object.keys(dependencies).length !== 0
  ) {
    failures.push(`module.json dependencies.${dependencyType} must be an empty object`);
  }
}

const containsFile = (path) => {
  if (!existsSync(path)) return false;
  if (statSync(path).isFile()) return true;

  return readdirSync(path).some((entry) => containsFile(join(path, entry)));
};

for (const relativePath of ['resources/extensions']) {
  if (containsFile(join(root, relativePath))) {
    failures.push(`${relativePath} is forbidden in the core-only MVP module`);
  }
}

const adminRoutesPath = join(root, 'resources/routes/admin.json');
const allowedLayouts = new Set([
  'admin_page_builder_index.json',
  'admin_page_builder_create.json',
]);

if (!existsSync(adminRoutesPath)) {
  failures.push('resources/routes/admin.json is required for the G7-native manager');
} else {
  const routes = JSON.parse(readFileSync(adminRoutesPath, 'utf8')).routes ?? [];
  const routePaths = routes.map((route) => route.path).sort();
  const expectedPaths = ['*/admin/page-builder', '*/admin/page-builder/create'].sort();
  if (JSON.stringify(routePaths) !== JSON.stringify(expectedPaths)) {
    failures.push('admin routes must contain only the two Page Builder-owned paths');
  }
}

const adminLayoutsPath = join(root, 'resources/layouts/admin');
const layoutFiles = existsSync(adminLayoutsPath)
  ? readdirSync(adminLayoutsPath).filter((name) => name.endsWith('.json'))
  : [];
if (
  layoutFiles.length !== allowedLayouts.size ||
  layoutFiles.some((name) => !allowedLayouts.has(name))
) {
  failures.push('admin layouts must contain only the Page Builder list and create layouts');
}

const userRoutesPath = join(root, 'resources/routes/user.json');
const expectedUserRoutes = [
  ['*/modules/jiwonpapa-page_builder/preview/:token', 'page_builder_preview'],
  ['*/pages/:slug', 'page_builder_public'],
].sort(([left], [right]) => left.localeCompare(right));
if (!existsSync(userRoutesPath)) {
  failures.push('resources/routes/user.json is required for module-owned public and preview routes');
} else {
  const routes = JSON.parse(readFileSync(userRoutesPath, 'utf8')).routes ?? [];
  const actual = routes.map((route) => [route.path, route.layout])
    .sort(([left], [right]) => left.localeCompare(right));
  if (JSON.stringify(actual) !== JSON.stringify(expectedUserRoutes)) {
    failures.push('user routes must contain only the two module-owned page and preview routes');
  }
}

const userLayoutsPath = join(root, 'resources/layouts/user');
const allowedUserLayouts = new Set([
  'page_builder_home.json',
  'page_builder_preview.json',
  'page_builder_public.json',
]);
const userLayoutFiles = existsSync(userLayoutsPath)
  ? readdirSync(userLayoutsPath).filter((name) => name.endsWith('.json'))
  : [];
if (
  userLayoutFiles.length !== allowedUserLayouts.size ||
  userLayoutFiles.some((name) => !allowedUserLayouts.has(name))
) {
  failures.push('user layouts must contain only the Page Builder home, page, and preview layouts');
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`G7 dependency budget: ${failure}`);
  process.exit(1);
}

console.log('G7 dependency budget: template-owned shell, module routes, and scoped public assets OK');
