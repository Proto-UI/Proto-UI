/** K1 complete public Dialog + generated CLI. Build packages and generate www styles first.
 * D-FEEDBACK-STYLE-ROLE-RESOLUTION S/T; S4 approved physical portal environment boundary.
 * This is bounded geometry/admission evidence, not the full S4 settings journey.
 */
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const app = new URL('../../apps/www/', import.meta.url);
const bundle = await build({
  entryPoints: ['scripts/analysis/fixtures/shadow-s4/dialog.ts'],
  nodePaths: [new URL('node_modules', app).pathname],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
  globalName: 'S4Audit',
  metafile: true,
  tsconfigRaw: { compilerOptions: {} },
});
const inputs = Object.keys(bundle.metafile.inputs);
assert.ok(inputs.some((p) => p.includes('adapters/web-component/dist/')));
assert.ok(inputs.some((p) => p.includes('prototypes/shadcn/dist/dialog/')));
assert.ok(inputs.some((p) => p.endsWith('proto-ui-shadow-style.generated.js')));
assert.ok(!inputs.some((p) => /packages\/.+\/src\//.test(p)));
const css = (
  await Promise.all(
    ['shadcn-theme.css', 'proto-ui-tokens.generated.css'].map((n) =>
      readFile(new URL(`src/styles/${n}`, app), 'utf8')
    )
  )
).join('\n');
const { chromium } = createRequire(new URL('package.json', app))('playwright-core');
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PUI_CHROME_EXECUTABLE ??
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
try {
  for (const mode of ['light', 'split', 'mixed']) {
    const page = await browser.newPage({
      viewport: { width: 1000, height: 800 },
      colorScheme: 'light',
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.addStyleTag({ content: css });
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      await page.evaluate((mode) => (window.audit = S4Audit.mount(mode)), mode);
      const before = await page.evaluate(() => audit.sample());
      assert.equal(before.content.variable.trim(), 'rgb(210, 20, 30)');
      await page.locator('[data-part=trigger]').click();
      const entering = await page.evaluate(() => audit.frames(5));
      await page.evaluate(() => audit.setOpen(false));
      const leaving = await page.evaluate(() => audit.frames(4));
      await page.evaluate(() => audit.setOpen(true));
      const reversing = await page.evaluate(() => audit.frames(5));
      await page.waitForTimeout(350);
      assert.deepEqual(errors, [], `${mode} activation`);
      const open = await page.evaluate(() => audit.sample());
      assert.equal(open.open, true);
      assert.equal(open.content.physicalParent, 'BODY');
      assert.equal(open.content.logicalParent, 'S4-AUDIT-ROOT');
      // Chrome retains the identity interpolation under fill:both, including
      // the existing Light path. Mask must not inherit Content's translation.
      assert.equal(
        open.mask.transform,
        'matrix(1, 0, 0, 1, 0, 0)',
        `${mode}/mask resting transform`
      );
      assert.ok(Math.abs(open.content.x + open.content.w / 2 - 500) < 0.1, `${mode}/center x`);
      assert.ok(Math.abs(open.content.y + open.content.h / 2 - 400) < 0.1, `${mode}/center y`);
      assert.notEqual(open.content.variable.trim(), before.content.variable.trim());
      const frames = [...entering, ...leaving, ...reversing];
      assert.ok(
        frames.some((f) => f.content.scale > 0.95 && f.content.scale < 0.999),
        `${mode}/actual intermediate scale`
      );
      for (const frame of frames) {
        const c = frame.content;
        assert.ok(Math.abs(c.x + c.w / 2 - 500) < 0.1, `${mode}/animated center x`);
        assert.ok(Math.abs(c.y + c.h / 2 - 400) < 0.1, `${mode}/animated center y`);
        assert.ok(
          Math.abs(c.scale - (0.95 + 0.05 * c.opacity)) < 0.001,
          `${mode}/synchronized scale and paint ${JSON.stringify(c)}`
        );
        assert.equal(c.centerHit, true, `${mode}/native animated hit`);
        if (mode !== 'light') {
          assert.equal(c.surfaceTransform, 'none');
          for (const [a, b] of [
            ['x', 'sx'],
            ['y', 'sy'],
            ['w', 'sw'],
            ['h', 'sh'],
          ])
            assert.ok(Math.abs(c[a] - c[b]) < 0.1, `${mode}/animated surface ${a}`);
          assert.ok(
            Math.abs(Number(c.animations[0]?.time) - Number(c.animations[1]?.time)) < 0.1,
            `${mode}/shared animation clock`
          );
        }
      }
      if (mode !== 'light') {
        assert.equal(open.content.surfaceTransform, 'none');
        for (const [a, b] of [
          ['x', 'sx'],
          ['y', 'sy'],
          ['w', 'sw'],
          ['h', 'sh'],
        ])
          assert.ok(Math.abs(open.content[a] - open.content[b]) < 0.1, `${mode}/surface ${a}`);
      }
      // Current owner input must win over the pre-request Content snapshot.
      await page.evaluate(() =>
        audit.parts.root.addEventListener('openChange', (e) => audit.setOpen(e.detail.open))
      );
      await page.evaluate(
        () =>
          (audit.parts.description.textContent =
            'A longer description to exercise wrapping and dynamic content sizing. '.repeat(3))
      );
      await page.setViewportSize({ width: 480, height: 700 });
      await page.waitForTimeout(50);
      const resized = await page.evaluate(() => audit.sample());
      assert.ok(Math.abs(resized.content.x + resized.content.w / 2 - 240) < 0.1);
      assert.ok(Math.abs(resized.content.y + resized.content.h / 2 - 350) < 0.1);
      await page.evaluate(() => document.documentElement.classList.add('dark'));
      await page.waitForTimeout(50);
      const dark = await page.evaluate(() => audit.sample());
      assert.notEqual(
        dark.content.background,
        open.content.background,
        `${mode}/live portal theme`
      );
      await page.keyboard.press('Escape');
      await page.waitForTimeout(350);
      const closed = await page.evaluate(() => audit.sample());
      assert.equal(closed.open, false);
      assert.equal(closed.overflow, '');
      assert.equal(closed.content.physicalParent, 'S4-AUDIT-ROOT');
      assert.equal(closed.content.variable.trim(), before.content.variable.trim());
      assert.deepEqual(errors, []);
      console.log(
        JSON.stringify({
          mode,
          frames: frames.length,
          open: open.content.w,
          resized: [resized.content.w, resized.content.h],
          closed: closed.open,
        })
      );
    } catch (e) {
      console.error({ mode, errors, sample: await page.evaluate(() => audit.sample()) });
      throw e;
    } finally {
      await page.close();
    }
  }
  console.log(`S4 bounded admission passed in Chrome ${browser.version()}`);
} finally {
  await browser.close();
}
