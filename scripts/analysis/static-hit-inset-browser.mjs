import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const repo = fileURLToPath(new URL('../../', import.meta.url));
const bundle = await build({
  entryPoints: [path.join(repo, 'scripts/analysis/fixtures/static-hit-inset.ts')],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'StaticHitProbe',
  platform: 'browser',
  tsconfigRaw: { compilerOptions: {} },
  plugins: [
    {
      name: 'same-head-proto-source',
      setup(build) {
        build.onResolve({ filter: /^@proto\.ui\// }, ({ path: id }) => {
          const [pkg, ...parts] = id.slice('@proto.ui/'.length).split('/');
          const folder = pkg.startsWith('module-')
            ? `modules/${pkg.slice(7)}`
            : pkg.startsWith('adapter-')
              ? `adapters/${pkg.slice(8)}`
              : pkg.startsWith('prototypes-')
                ? `prototypes/${pkg.slice(11)}`
                : pkg;
          const base = path.join(repo, 'packages', folder, 'src', ...parts);
          for (const candidate of [`${base}/index.ts`, `${base}.ts`, `${base}.tsx`])
            if (existsSync(candidate)) return { path: candidate };
          const manifest = JSON.parse(
            readFileSync(path.join(repo, 'packages', folder, 'package.json'), 'utf8')
          );
          const entry = manifest.exports?.[`./${parts.join('/')}`];
          const route = typeof entry === 'string' ? entry : entry?.import;
          if (route) {
            const candidate = path.join(
              repo,
              'packages',
              folder,
              route.replace('./dist/', './src/').replace(/\.js$/, '.ts')
            );
            if (existsSync(candidate)) return { path: candidate };
          }
          throw new Error(`Source entry not found: ${id}`);
        });
      },
    },
  ],
});
if (process.argv.includes('--bundle-only')) {
  console.log('Static inset native source fixture bundled; no browser executed.');
  process.exit(0);
}
assert.equal(
  process.env.GITHUB_ACTIONS,
  'true',
  'Native execution is restricted to the official Actions runner.'
);
const out = process.env.STATIC_HIT_EVIDENCE_DIR;
assert.ok(out, 'STATIC_HIT_EVIDENCE_DIR required');
await fs.mkdir(out, { recursive: true });
const { chromium } = createRequire(path.join(repo, 'apps/www/package.json'))('playwright-core');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const results = [];
const attempts = [];
let activeScope = 'unmounted';
let lastPoint = null;
let page;
try {
  for (const scope of ['document', 'shadow']) {
    activeScope = scope;
    page = await browser.newPage({
      viewport: { width: 700, height: 1000 },
      deviceScaleFactor: 1,
      hasTouch: true,
    });
    await page.route('**/*', (route) => route.abort());
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.evaluate((shadow) => StaticHitProbe.mount(shadow), scope === 'shadow');
    const initial = await page.evaluate(() => StaticHitProbe.sample());
    assert.equal(initial.width, 32);
    assert.ok(Math.abs(initial.height - 18.4) < 0.03);
    assert.equal(initial.checked, false);
    assert.equal(initial.children, 0);
    const point = (s, dx, dy) => [s.x + dx, s.y + dy];
    const click = async (x, y) => {
      lastPoint = { x, y };
      await page.mouse.click(x, y);
      await page.evaluate(() => StaticHitProbe.flush());
    };
    // Padding-box reference excludes the 1px border: left reach is 11px, top 7px.
    for (const [edge, dx, dy] of [
      ['left', -10, 9],
      ['right', 42, 9],
      ['top', 16, -6],
      ['bottom', 16, 24],
    ]) {
      const before = await page.evaluate(() => StaticHitProbe.sample());
      await page.evaluate(() => StaticHitProbe.clearEvents());
      await click(...point(initial, dx, dy));
      const after = await page.evaluate(() => StaticHitProbe.sample());
      const diagnostic = await page.evaluate(
        ({ x, y }) => StaticHitProbe.inspectPoint(x, y),
        lastPoint
      );
      attempts.push({ scope, edge, before, after, diagnostic });
      // Persist the failing sample before its assertion, not only completed cases.
      await fs.writeFile(
        path.join(out, 'native-attempts.json'),
        JSON.stringify({ candidate: process.env.CANDIDATE_SHA, attempts }, null, 2)
      );
      assert.notEqual(after.checked, before.checked, `${edge} expansion activates once`);
      assert.equal(after.events.filter((e) => e.type === 'click').length, 1);
      assert.deepEqual(after.checkedChanges, [{ root: 'normal-root', checked: after.checked }]);
      assert.ok(after.events.every((e) => e.target === 'normal-root' && e.trusted));
      assert.equal(after.width, initial.width);
      assert.equal(after.height, initial.height);
      assert.equal(after.active, 'normal-root');
      results.push({ scope, case: edge, after });
    }
    let before = await page.evaluate(() => StaticHitProbe.sample());
    await click(...point(initial, -12, 9));
    assert.equal(
      (await page.evaluate(() => StaticHitProbe.sample())).checked,
      before.checked,
      'outside expanded padding-box does not activate'
    );
    for (const id of ['clipped-root', 'covered-root', 'disabled-root', 'hidden-root']) {
      const sample = await page.evaluate((id) => StaticHitProbe.sample(id), id);
      await click(...point(sample, -8, 9));
      const after = await page.evaluate((id) => StaticHitProbe.sample(id), id);
      assert.equal(after.checked, false, `${id} remains unactivated`);
      results.push({ scope, case: id, after });
    }
    await page.locator('#probe-label').click();
    const labelled = await page.evaluate(() => StaticHitProbe.sample());
    assert.notEqual(labelled.checked, before.checked);
    assert.equal(labelled.active, 'normal-root');
    await page.keyboard.press('Space');
    const keyboard = await page.evaluate(() => StaticHitProbe.sample());
    assert.notEqual(keyboard.checked, labelled.checked);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: initial.x - 8, y: initial.y + 9, id: 1 }],
    });
    assert.equal((await page.evaluate(() => StaticHitProbe.sample())).pressed, true);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await page.evaluate(() => StaticHitProbe.flush());
    assert.equal((await page.evaluate(() => StaticHitProbe.sample())).pressed, false);
    assert.ok(
      (await page.evaluate(() => StaticHitProbe.sample())).events.some(
        (e) => e.type === 'pointercancel' && e.trusted
      )
    );
    await cdp.detach();
    assert.equal(
      (await page.evaluate(() => StaticHitProbe.sample())).checked,
      keyboard.checked,
      'cancelled press does not activate'
    );
    await page.evaluate(() => StaticHitProbe.setDisabled(true));
    before = await page.evaluate(() => StaticHitProbe.sample());
    await click(...point(initial, -8, 9));
    assert.equal(
      (await page.evaluate(() => StaticHitProbe.sample())).checked,
      before.checked,
      'disabled rejects expanded input'
    );
    await page.evaluate(() => StaticHitProbe.setDisabled(false));
    await page.evaluate(() => StaticHitProbe.remount());
    await click(...point(initial, -8, 9));
    assert.notEqual(
      (await page.evaluate(() => StaticHitProbe.sample())).checked,
      before.checked,
      'remount restores hit projection'
    );
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '20px';
    });
    const remBefore = await page.evaluate(() => StaticHitProbe.sample());
    await click(...point(initial, -13, 9));
    const remAfter = await page.evaluate(() => StaticHitProbe.sample());
    assert.notEqual(remAfter.checked, remBefore.checked, 'rem extension follows root text size');
    assert.equal(remAfter.width, initial.width);
    await page.locator('#nested-button').click();
    await page.locator('#nested-link').click();
    const nested = await page.evaluate(() => StaticHitProbe.sample());
    assert.ok(
      nested.events.some(
        (e) => e.type === 'nested-click' && e.target === 'nested-button' && e.trusted
      )
    );
    assert.ok(
      nested.events.some(
        (e) => e.type === 'nested-click' && e.target === 'nested-link' && e.trusted
      )
    );
    assert.equal(await page.evaluate(() => location.hash), '#link-target');
    assert.deepEqual(errors, []);
    await page.screenshot({
      path: path.join(out, `static-hit-inset-${scope}.png`),
      fullPage: true,
    });
    const cssom = await page.evaluate(() => StaticHitProbe.cssomNegativeControls());
    assert.ok(
      cssom.every((row) => row.rejected && row.preserved),
      `${scope}: CSSOM mutation must reject and preserve external edits`
    );
    results.push({
      scope,
      case: 'label-keyboard-cancel-remount-root-text',
      labelled,
      keyboard,
      remAfter,
      cssom,
    });
    await page.close();
    page = undefined;
  }
} finally {
  if (page) {
    const state = await page
      .evaluate(
        (point) => ({
          sample: StaticHitProbe.sample(),
          diagnostic: point ? StaticHitProbe.inspectPoint(point.x, point.y) : null,
        }),
        lastPoint
      )
      .catch((error) => ({ diagnosticError: String(error) }));
    await fs.writeFile(
      path.join(out, 'native-final-state.json'),
      JSON.stringify(
        { candidate: process.env.CANDIDATE_SHA, scope: activeScope, ...state },
        null,
        2
      )
    );
  }
  if (page)
    await page
      .screenshot({ path: path.join(out, 'static-hit-inset-final.png'), fullPage: true })
      .catch(() => {});
  await fs.writeFile(
    path.join(out, 'native-results.json'),
    JSON.stringify(
      { candidate: process.env.CANDIDATE_SHA, browser: browser.version(), results },
      null,
      2
    )
  );
  await browser.close();
}
