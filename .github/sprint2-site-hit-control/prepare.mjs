import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(process.argv[2]);
const output = resolve(process.argv[3]);
const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(here, 'manifest.json'), 'utf8'));
const git = (...args) => execFileSync('git', args, { cwd: root });
const sha = (data) => createHash('sha256').update(data).digest('hex');
const head = git('rev-parse', 'HEAD').toString().trim();
assert.equal(head, manifest.head);
assert.equal(git('status', '--porcelain').toString(), '');
const file = 'apps/www/src/content/docs/zh-cn/sprint2-site.browser.test.ts';
const original = readFileSync(join(root, file), 'utf8');
const repaired = readFileSync(join(here, 'repaired-site-test.ts'), 'utf8');
assert.equal(sha(repaired), manifest.fixtureSha256);
assert(repaired.includes("matchesOwner: hit?.closest('a, summary') === node"));
assert(repaired.includes('expect(allHit, JSON.stringify(observation)).toBe(true);'));
let instrumented = repaired;
const captureStart = 'async function capture(page: Page, id: string, observations: unknown) {\n  if (!out) return;';
assert(instrumented.includes(captureStart));
instrumented = instrumented.replace(captureStart, "let captureObservation = 0;\n" + captureStart + "\n  id += '-control-' + String(++captureObservation).padStart(4, '0');");
const mobileStart = instrumented.indexOf("for (const locale of locales)\n  for (const family of ['shadcn', 'brutalist'])");
const mobileEnd = instrumented.indexOf('\nfor (const locale of locales)', mobileStart + 1);
assert(mobileStart > 0 && mobileEnd > mobileStart);
let mobile = instrumented.slice(mobileStart, mobileEnd);
const testPrefix = "      it(`C: ${locale}/${family}/${mode} keeps full mobile navigation targets`, async () => {";
assert(mobile.includes(testPrefix));
mobile = mobile.replace(testPrefix, "      if (repetition > 0 && (locale !== 'zh-cn' || family !== 'brutalist' || mode !== 'enhanced')) continue;\n      it(`C: ${locale}/${family}/${mode} keeps full mobile navigation targets [control ${repetition}]`, async () => {");
instrumented = instrumented.slice(0, mobileStart) + 'for (let repetition = 0; repetition < 20; repetition++) {\n' + mobile + '\n}\n' + instrumented.slice(mobileEnd);
mkdirSync(output, { recursive: true });
writeFileSync(join(output, 'original-site-test.ts'), original, { flag: 'wx' });
writeFileSync(join(output, 'repaired-site-test.ts'), repaired, { flag: 'wx' });
writeFileSync(join(root, file), repaired);
writeFileSync(join(output, 'fixture-repair.patch'), git('diff', '--binary', 'HEAD'), { flag: 'wx' });
writeFileSync(join(root, file), instrumented);
const patch = git('diff', '--binary', 'HEAD');
writeFileSync(join(output, 'instrumentation.patch'), patch, { flag: 'wx' });
writeFileSync(join(output, 'instrumented-site-test.ts'), instrumented, { flag: 'wx' });
writeFileSync(join(output, 'instrumentation.json'), JSON.stringify({
  ...manifest, file, kind: 'same-product-source-repaired-fixture-control-not-clean-acceptance',
  originalSha256: sha(original), instrumentedSha256: sha(instrumented),
  trackedPatchSha256: sha(patch),
  fixtureRepair: ['wait for actual group and leaf enhancement', 'genuine native wheel takes over route-entry reveal', 'verify trusted wheel, composed path, actual scroll and retention', 'preserve point details on any failure'],
  repetitionsOnly: ['unique capture suffixes preserve each observation', 'nineteen fresh-context repetitions of the original failed case'],
  preserved: ['same product source head', 'all original 42 cases', 'all four point coordinates and exact native owner equality', '44 px and radius assertions', 'independent no-JS fallback'],
}, null, 2) + '\n', { flag: 'wx' });
