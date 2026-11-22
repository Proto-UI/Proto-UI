import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(process.argv[2]);
const output = resolve(process.argv[3]);
const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(here, 'original-manifest.json'), 'utf8'));
const git = (...args) => execFileSync('git', args, { cwd: root });
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
assert.equal(git('rev-parse', 'HEAD').toString().trim(), manifest.head);
assert.equal(git('status', '--porcelain').toString(), '');
const file = 'apps/www/src/content/docs/zh-cn/sprint2-site.browser.test.ts';
const baseline = readFileSync(join(root, file));
const prior = readFileSync(join(here, 'original-repaired-source.ts'));
const observed = readFileSync(join(here, 'original-wheel-observer.ts'));
assert.equal(sha(prior), manifest.originalRepairedSha256);
assert.equal(sha(observed), manifest.observerSha256);
assert(observed.toString().includes('expect(wheel.trusted && wheel.includesLeaf && wheel.includesScroller, JSON.stringify(wheel)).toBe(true);'));
mkdirSync(output, { recursive: true });
writeFileSync(join(output, 'original-site-test.ts'), baseline, { flag: 'wx' });
writeFileSync(join(output, 'prior-repaired-site-test.ts'), prior, { flag: 'wx' });
writeFileSync(join(output, 'observed-site-test.ts'), observed, { flag: 'wx' });
writeFileSync(join(root, file), observed);
const patch = git('diff', '--binary', 'HEAD');
writeFileSync(join(output, 'instrumentation.patch'), patch, { flag: 'wx' });
writeFileSync(join(output, 'manifest.json'), JSON.stringify({ ...manifest,
  kind: 'original-helper-one-fresh-context-observation-not-clean-acceptance',
  baselineSha256: sha(baseline), trackedPatchSha256: sha(patch),
  preserved: ['original R1 leaf.hover input', 'original three-way wheel assertion', 'original group/leaf hit, height and radius assertions'],
  changes: ['passive event path/coordinates/owner observations', 'capture before unchanged wheel assertion', 'assertion message includes actual observed wheel data'],
}, null, 2) + '\n', { flag: 'wx' });
