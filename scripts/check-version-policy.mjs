import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const releaseMode = process.argv.includes('--release');
const failures = [];
const allowedCategories = new Set(['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security']);
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

function fail(message) {
  failures.push(message);
}

function parseSemver(version) {
  const match = version.match(semverPattern);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4]?.split('.') ?? [],
  };
}

function compareIdentifiers(left, right) {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);
  if (leftNumeric && rightNumeric) return Number(left) - Number(right);
  if (leftNumeric) return -1;
  if (rightNumeric) return 1;
  return left.localeCompare(right, 'en');
}

function compareSemver(leftVersion, rightVersion) {
  const left = parseSemver(leftVersion);
  const right = parseSemver(rightVersion);
  if (!left || !right) return 0;
  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) return left[key] - right[key];
  }
  if (left.prerelease.length === 0 && right.prerelease.length > 0) return 1;
  if (right.prerelease.length === 0 && left.prerelease.length > 0) return -1;
  for (let index = 0; index < Math.max(left.prerelease.length, right.prerelease.length); index += 1) {
    if (left.prerelease[index] === undefined) return -1;
    if (right.prerelease[index] === undefined) return 1;
    const comparison = compareIdentifiers(left.prerelease[index], right.prerelease[index]);
    if (comparison !== 0) return comparison;
  }
  return 0;
}

function validIsoDate(value) {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

const moduleManifest = readJson('module.json');
const packageManifest = readJson('package.json');
const packageLock = readJson('package-lock.json');
const versionSources = new Map([
  ['module.json', moduleManifest.version],
  ['package.json', packageManifest.version],
  ['package-lock.json', packageLock.version],
  ['package-lock.json packages[""]', packageLock.packages?.['']?.version],
]);

for (const [source, version] of versionSources) {
  if (typeof version !== 'string' || !parseSemver(version)) {
    fail(`${source} version is not valid SemVer 2.0.0: ${String(version)}`);
  } else if (version !== moduleManifest.version) {
    fail(`${source} version ${version} does not match module.json ${moduleManifest.version}.`);
  }
}

if (typeof moduleManifest.g7_version !== 'string' || !/^>=/.test(moduleManifest.g7_version)
  || !parseSemver(moduleManifest.g7_version.slice(2))) {
  fail(`module.json g7_version must use the G7 >=X.Y.Z form: ${String(moduleManifest.g7_version)}`);
}

const changelog = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8');
if (!changelog.includes('https://keepachangelog.com/ko/1.1.0/')) {
  fail('CHANGELOG.md must declare Keep a Changelog 1.1.0.');
}
if (!changelog.includes('https://semver.org/lang/ko/')) {
  fail('CHANGELOG.md must declare Semantic Versioning.');
}

const headingPattern = /^## \[([^\]]+)\](?: - (\d{4}-\d{2}-\d{2})( \[YANKED\])?)?$/gm;
const headings = [...changelog.matchAll(headingPattern)].map((match) => ({
  label: match[1],
  date: match[2],
  yanked: Boolean(match[3]),
  index: match.index,
  bodyStart: match.index + match[0].length,
}));

if (headings.length === 0 || headings[0].label !== 'Unreleased' || headings[0].date) {
  fail('CHANGELOG.md must begin with an undated ## [Unreleased] section.');
}

const releases = headings.filter((heading) => heading.label !== 'Unreleased');
const seenVersions = new Set();
for (let index = 0; index < releases.length; index += 1) {
  const release = releases[index];
  if (!parseSemver(release.label)) fail(`Invalid changelog SemVer: ${release.label}`);
  if (!release.date || !validIsoDate(release.date)) fail(`Invalid ISO 8601 date for ${release.label}: ${String(release.date)}`);
  if (seenVersions.has(release.label)) fail(`Duplicate changelog version: ${release.label}`);
  seenVersions.add(release.label);
  if (index > 0 && compareSemver(releases[index - 1].label, release.label) <= 0) {
    fail(`Changelog releases must be newest first: ${releases[index - 1].label} before ${release.label}.`);
  }
}

if (releases[0]?.label !== moduleManifest.version) {
  fail(`The first released changelog version must match module.json ${moduleManifest.version}.`);
}

for (let index = 0; index < headings.length; index += 1) {
  const heading = headings[index];
  const bodyEnd = headings[index + 1]?.index ?? changelog.length;
  const body = changelog.slice(heading.bodyStart, bodyEnd);
  const categoryMatches = [...body.matchAll(/^### ([^\n]+)$/gm)];
  for (const category of categoryMatches) {
    if (!allowedCategories.has(category[1])) {
      fail(`Unsupported changelog category in ${heading.label}: ${category[1]}`);
    }
    const categoryStart = category.index + category[0].length;
    const nextCategory = body.slice(categoryStart).search(/^### /m);
    const categoryBody = nextCategory === -1
      ? body.slice(categoryStart)
      : body.slice(categoryStart, categoryStart + nextCategory);
    if (!/^- .+/m.test(categoryBody)) {
      fail(`Changelog category ${heading.label}/${category[1]} has no list item.`);
    }
  }
  if (heading.label !== 'Unreleased' && categoryMatches.length === 0) {
    fail(`Released changelog version ${heading.label} has no allowed category.`);
  }
  if (releaseMode && heading.label === 'Unreleased' && (/^### /m.test(body) || /^- .+/m.test(body))) {
    fail('Release packaging requires an empty Unreleased section. Move its items to the new version first.');
  }
}

if (failures.length > 0) {
  for (const message of failures) console.error(`Version policy error: ${message}`);
  process.exit(1);
}

console.log(`Version policy: ${moduleManifest.version} / SemVer / Keep a Changelog OK${releaseMode ? ' (release)' : ''}`);
