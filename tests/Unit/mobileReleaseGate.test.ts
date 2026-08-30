import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('fails closed for missing, stale, nonhuman or incomplete physical-device evidence', () => {
  const directory = mkdtempSync(join(tmpdir(), 'g7pb-review-contract-'));
  const path = join(directory, 'review.json');
  const fingerprint = 'a'.repeat(64);
  const review = {
    status: 'passed', fingerprint, reviewer: { kind: 'human', name: 'Isolated test fixture, not a real approval' },
    results: ['ios-safari-voiceover', 'android-chrome-talkback'].map((platform) => ({
      platform, status: 'passed', device: 'test fixture', os: 'test OS', browserVersion: 'test version', evidence: 'isolated fixture only', checkedAt: '2026-01-01T00:00:00Z',
      checks: Object.fromEntries(['navigation', 'account', 'focus-and-reading-order', 'safe-area-and-keyboard', 'scroll-and-back'].map((key) => [key, 'passed'])),
    })),
  };
  const run = (value: unknown): string => {
    writeFileSync(path, JSON.stringify(value));
    return execFileSync(process.execPath, ['scripts/check-site-shell-product-quality.mjs', '--validate-mobile-review', path, fingerprint], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  };
  try {
    expect(run(review)).toContain('contract: PASS');
    expect(() => run({})).toThrow();
    expect(() => run({ ...review, fingerprint: 'b'.repeat(64) })).toThrow();
    expect(() => run({ ...review, reviewer: { kind: 'codex-assisted', name: 'test' } })).toThrow();
    expect(() => run({ ...review, results: review.results.slice(0, 1) })).toThrow();
    expect(() => run({ ...review, results: review.results.map((item) => ({ ...item, checks: {} })) })).toThrow();
    expect(() => run({ ...review, results: review.results.map((item) => ({ ...item, checkedAt: '2999-01-01T00:00:00Z' })) })).toThrow();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
