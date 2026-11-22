import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2]);
const output = resolve(process.argv[3]);
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
assert.equal(head, '4541dfbca5001d4ff9b1cc6afd34d4fe1cf32d5d');
assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }), '');
const file = 'apps/www/src/content/docs/zh-cn/sprint2-site.browser.test.ts';
const original = readFileSync(join(root, file), 'utf8');
const start = original.indexOf('async function fullNativeHitTarget(owner: Locator) {');
const end = original.indexOf('\nfor (const locale of locales)', start);
assert(start > 0 && end > start);
const before = original.slice(start, end);
assert(before.includes("document.elementFromPoint(x!, y!)?.closest('a, summary') === node"));
assert(before.includes(').toBe(true);'));
const diagnostic = `let hitObservation = 0;
async function fullNativeHitTarget(owner: Locator) {
  await owner.scrollIntoViewIfNeeded();
  const observation = await owner.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const describe = (part: Element | null) => part ? {
      tag: part.localName, id: part.id, className: part.getAttribute('class'),
      text: part.textContent?.trim().slice(0, 160),
      html: part.outerHTML.slice(0, 1200),
      bounds: part.getBoundingClientRect().toJSON(),
    } : null;
    const points = [
      [rect.left + 3, rect.top + rect.height / 2],
      [rect.right - 3, rect.top + rect.height / 2],
      [rect.left + rect.width / 2, rect.top + 3],
      [rect.left + rect.width / 2, rect.bottom - 3],
    ].map(([x, y]) => {
      const hit = document.elementFromPoint(x!, y!);
      const closest = hit?.closest('a, summary') ?? null;
      return { x, y, matchesOwner: closest === node, hit: describe(hit), closest: describe(closest) };
    });
    const ancestors = [];
    let ancestor: Element | null = node.parentElement;
    for (let i = 0; ancestor && i < 8; i++, ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      ancestors.push({ ...describe(ancestor), scrollTop: ancestor.scrollTop,
        scrollHeight: ancestor.scrollHeight, clientHeight: ancestor.clientHeight,
        overflow: style.overflow, position: style.position, zIndex: style.zIndex });
    }
    return { at: new Date().toISOString(), performanceTime: performance.now(),
      route: location.pathname, viewport: { width: innerWidth, height: innerHeight },
      scrollX, scrollY, owner: describe(node), points, ancestors,
      allHit: points.every((point) => point.matchesOwner),
      animations: document.getAnimations().map((animation) => ({
        playState: animation.playState, currentTime: animation.currentTime,
        target: describe((animation.effect as KeyframeEffect | null)?.target ?? null),
      })),
    };
  });
  if (out) {
    await mkdir(out, { recursive: true });
    const id = String(++hitObservation).padStart(4, '0');
    await writeFile(path.join(out, 'hit-' + id + '.json'), JSON.stringify({
      source, observation,
      note: 'Coordinates and elementFromPoint were read together before this diagnostic write. The original four-point assertion remains exact; any failure screenshot is captured only after this observation.'
    }, null, 2));
    if (!observation.allHit) await owner.page().screenshot({ path: path.join(out, 'hit-' + id + '-after-failure.png') });
  }
  expect(observation.allHit).toBe(true);
}
`;
let instrumented = original.slice(0, start) + diagnostic + original.slice(end);
const captureStart = 'async function capture(page: Page, id: string, observations: unknown) {\n  if (!out) return;';
assert(instrumented.includes(captureStart));
instrumented = instrumented.replace(captureStart, "let captureObservation = 0;\n" + captureStart + "\n  id += '-diagnostic-' + String(++captureObservation).padStart(4, '0');");
const mobileStart = instrumented.indexOf("for (const locale of locales)\n  for (const family of ['shadcn', 'brutalist'])");
const mobileEnd = instrumented.indexOf('\nfor (const locale of locales)', mobileStart + 1);
assert(mobileStart > 0 && mobileEnd > mobileStart);
let mobile = instrumented.slice(mobileStart, mobileEnd);
const testPrefix = "      it(`C: ${locale}/${family}/${mode} keeps full mobile navigation targets`, async () => {";
assert(mobile.includes(testPrefix));
mobile = mobile.replace(testPrefix, "      if (repetition > 0 && (locale !== 'zh-cn' || family !== 'brutalist' || mode !== 'enhanced')) continue;\n      it(`C: ${locale}/${family}/${mode} keeps full mobile navigation targets [diagnostic ${repetition}]`, async () => {");
instrumented = instrumented.slice(0, mobileStart) + 'for (let repetition = 0; repetition < 20; repetition++) {\n' + mobile + '\n}\n' + instrumented.slice(mobileEnd);
mkdirSync(output, { recursive: true });
writeFileSync(join(output, 'original-site-test.ts'), original, { flag: 'wx' });
writeFileSync(join(root, file), instrumented);
writeFileSync(join(output, 'instrumentation.patch'), execFileSync('git', ['diff', '--binary', 'HEAD'], { cwd: root }), { flag: 'wx' });
writeFileSync(join(output, 'instrumented-site-test.ts'), instrumented, { flag: 'wx' });
writeFileSync(join(output, 'instrumentation.json'), JSON.stringify({
  head, file, kind: 'diagnostic-only-not-clean-acceptance',
  originalSha256: createHash('sha256').update(original).digest('hex'),
  instrumentedSha256: createHash('sha256').update(instrumented).digest('hex'),
  expectedCases: 61, originalCases: 42, addedTargetRepetitions: 19,
  preserved: ['all four original point coordinates', 'exact closest anchor/summary owner equality', 'all original assertions', 'all original 42 cases'],
  changes: ['passive same-evaluation point details', 'post-observation diagnostic files and failure screenshot', 'unique capture suffixes preserve every repeated observation', 'nineteen additional fresh-context repetitions of the original failed mobile case'],
}, null, 2) + '\n', { flag: 'wx' });
