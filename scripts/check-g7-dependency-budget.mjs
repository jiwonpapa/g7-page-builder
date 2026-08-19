import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const manifest = JSON.parse(readFileSync(join(root, 'module.json'), 'utf8'));

if (manifest.hidden !== false) {
  failures.push('module.json hidden must be false so the separate Page Builder menu remains discoverable');
}

if (manifest.loading?.strategy !== 'lazy') {
  failures.push('module.json loading.strategy must be lazy to prevent global editor asset injection');
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

for (const forbiddenPath of ['resources/routes/user.json', 'resources/layouts/user']) {
  if (containsFile(join(root, forbiddenPath))) {
    failures.push(`${forbiddenPath} is forbidden in the core-only MVP module`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`G7 dependency budget: ${failure}`);
  process.exit(1);
}

console.log('G7 dependency budget: minimal admin shell and core-only manifest OK');
