/** S1 actual demo-matrix acceptance. Start apps-www dev first, then run this script.
 * D-WEB-COMPONENT-SHADOW-PROFILE-0001 G-J; D-WEB-COMPONENT-SHADOW-STYLE-0001 N;
 * P-BRUTALIST-BADGE and P-SHADCN-CHECKBOX/INDICATOR (family-scoped comparisons).
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../../apps/www/package.json', import.meta.url))(
  'playwright-core'
);
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PUI_CHROME_EXECUTABLE ??
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const url = process.env.PUI_S1_URL ?? 'http://127.0.0.1:4321/zh-cn/internal/demo-matrix/';
const samples = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = new Set();
  page.on('pageerror', (error) => errors.add(error.message));
  await page.goto(url);
  const section = page.locator('[data-shadow-s1]');
  await page.waitForFunction(
    () => document.querySelector('[data-shadow-s1]')?.getAttribute('data-ready') === 'true'
  );
  const frame = JSON.parse(await section.getAttribute('data-first-frame'));
  assert.deepEqual(
    frame.map((row) => row.host),
    [
      [16, 16],
      [16, 16],
    ],
    'first-frame boundary sizes'
  );
  assert.deepEqual(
    frame.map((row) => row.surface),
    [
      [16, 16],
      [16, 16],
    ],
    'first-frame surfaces'
  );
  const settle = async () => {
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    );
  };
  const click = async (action) => {
    await section.locator(`[data-action="${action}"]`).click();
    await settle();
  };
  const measure = async () =>
    section.evaluate((el) =>
      Array.from(el.querySelectorAll('[data-profile]')).map((column) => {
        const read = (kind) => {
          const host = column.querySelector(`[data-s1-component="${kind}"]`);
          const surface = host.shadowRoot?.querySelector('[part="surface"]') ?? host;
          const h = host.getBoundingClientRect(),
            s = surface.getBoundingClientRect(),
            css = getComputedStyle(surface);
          const row = column.querySelector('.s1-badge-row').getBoundingClientRect();
          const reference = column.querySelector('[data-baseline]').getBoundingClientRect();
          return {
            width: h.width,
            height: h.height,
            innerWidth: s.width,
            innerHeight: s.height,
            baseline: h.top - reference.top,
            rowHeight: row.height,
            background: css.backgroundColor,
            color: css.color,
            border: css.borderLeftWidth,
            opacity: css.opacity,
            shadow: css.boxShadow,
            checked: host.getAttribute('aria-checked'),
            disabled: host.getAttribute('aria-disabled'),
          };
        };
        return { badge: read('badge'), checkbox: read('checkbox'), indicator: read('indicator') };
      })
    );
  const parity = async (phase) => {
    const [light, split] = await measure();
    samples.push({ phase, light, split });
    assert.deepEqual(split, light, phase);
    return split;
  };
  const initial = await parity('initial');
  // P-BRUTALIST-BADGE-TONES + the S1 fixture's explicit palette. Equality
  // between profiles alone also passes when both retain the wrong tone.
  const toneBackgrounds = ['rgb(255, 216, 61)', 'rgb(133, 215, 255)', 'rgb(255, 147, 127)'];
  let tone = 0;
  assert.equal(initial.badge.background, toneBackgrounds[tone], 'initial accent');
  for (const action of [
    'tone',
    'tone',
    'tone',
    'theme',
    'theme',
    'constraint',
    'slot',
    'slot',
    'constraint',
  ]) {
    await click(action);
    const current = await parity(action);
    if (action === 'tone') tone = (tone + 1) % toneBackgrounds.length;
    assert.equal(current.badge.background, toneBackgrounds[tone], `${action}: actual Badge tone`);
  }
  const roots = ['light', 'split'].map((p) =>
    section.locator(`[data-profile="${p}"] [data-s1-component="checkbox"]`)
  );
  for (const root of roots) await root.click();
  await settle();
  await parity('pointer-checked');
  for (const profile of ['light', 'split']) {
    const indicator = section.locator(
      `[data-profile="${profile}"] [data-s1-component="indicator"]`
    );
    assert.equal(await indicator.locator('path').getAttribute('d'), 'm20 6-11 11-5-5');
    assert.equal(
      await section.locator(`[data-profile="${profile}"]`).getAttribute('data-changes'),
      '1'
    );
  }
  // Tab from an adjacent real button, then native Space; no synthetic key dispatch.
  for (const root of roots) {
    await root.evaluate((el) => {
      const button = document.createElement('button');
      button.id = 's1-tab-start';
      el.before(button);
      button.focus();
    });
    await page.keyboard.press('Tab');
    assert.equal(
      await root.evaluate((el) => document.activeElement === el),
      true,
      'focus remains on boundary'
    );
    assert.notEqual(
      await root.evaluate(
        (el) => getComputedStyle(el.shadowRoot?.querySelector('[part="surface"]') ?? el).boxShadow
      ),
      'none',
      'focus-visible surface paint'
    );
    await page.keyboard.press('Space');
    await settle();
    assert.equal(await root.getAttribute('aria-checked'), 'false');
    await page.keyboard.press('Enter');
    await settle();
    assert.equal(await root.getAttribute('aria-checked'), 'false');
    await page.locator('#s1-tab-start').evaluate((el) => el.remove());
    await root.evaluate((el) => el.blur());
  }
  await parity('keyboard-unchecked');
  await click('mixed');
  await parity('mixed');
  for (const profile of ['light', 'split'])
    assert.equal(
      await section
        .locator(`[data-profile="${profile}"] [data-s1-component="indicator"] path`)
        .getAttribute('d'),
      'M5 12h14'
    );
  await click('mixed');
  await click('disabled');
  for (const root of roots) {
    await root.click({ force: true });
    await root.focus();
    await page.keyboard.press('Space');
  }
  await settle();
  for (const profile of ['light', 'split'])
    assert.equal(
      await section.locator(`[data-profile="${profile}"]`).getAttribute('data-changes'),
      '2'
    );
  await parity('disabled');
  await click('disabled');
  await click('scheme-checkbox');
  const different = await measure();
  assert.notEqual(
    different[1].checkbox.background,
    different[0].checkbox.background,
    'host-local dark stylesheet'
  );
  assert.equal(await roots[1].getAttribute('data-pui-color-scheme'), 'dark');
  assert.equal(
    await section
      .locator('[data-profile="split"] [data-s1-component="badge"]')
      .getAttribute('data-pui-color-scheme'),
    'light'
  );
  await click('scheme-checkbox');
  await parity('scheme-reset');
  await click('disturb');
  const disturbed = await measure();
  assert.equal(disturbed[0].checkbox.background, 'rgb(255, 0, 180)');
  assert.equal(disturbed[1].checkbox.background, initial.checkbox.background);
  assert.equal(
    await section
      .locator('[data-profile="split"] .s1-slot-text')
      .evaluate((el) => getComputedStyle(el).color),
    'rgb(220, 20, 40)',
    'slotted consumer content remains document-styled'
  );
  await click('disturb');
  await click('part');
  const part = await measure();
  assert.equal(part[1].checkbox.background, 'rgb(0, 180, 140)');
  assert.notEqual(part[0].checkbox.background, part[1].checkbox.background);
  await click('part');
  await click('inline');
  await parity('raw-paint');
  assert.equal((await measure())[1].checkbox.background, 'rgb(100, 80, 210)');
  await click('inline');
  await parity('raw-paint-reset');
  await click('class');
  const classes = await measure();
  assert.equal(classes[0].checkbox.background, 'rgb(255, 0, 180)');
  assert.equal(classes[1].checkbox.background, initial.checkbox.background);
  assert.equal(
    await roots[1].evaluate((el) =>
      el.shadowRoot.querySelector('[part="surface"]').classList.contains('s1-consumer-paint')
    ),
    true
  );
  await click('class');
  await parity('class-reset');
  await click('reset');
  const reset = (await measure())[1];
  assert.notEqual(
    reset.badge.width,
    reset.badge.innerWidth,
    'document reset diagnostic is an explicit escape, not parity'
  );
  assert.notEqual(reset.checkbox.width, reset.checkbox.innerWidth);
  await click('reset');
  await parity('host-reset-exemption-restored');
  const generations = await section
    .locator('[data-profile]')
    .evaluateAll((els) => els.map((el) => el.dataset.generation));
  await click('move');
  await parity('synchronous-move');
  assert.deepEqual(
    await section
      .locator('[data-profile]')
      .evaluateAll((els) => els.map((el) => el.dataset.generation)),
    generations
  );
  await click('move');
  const handles = await Promise.all(roots.map((root) => root.elementHandle()));
  await click('disconnect');
  for (const h of handles) {
    assert.equal(await h.evaluate((el) => el.shadowRoot?.childNodes.length ?? 0), 0);
    assert.equal(await h.evaluate((el) => el.hasAttribute('data-pui-color-scheme')), false);
  }
  await click('disconnect');
  await parity('fresh-reconnect');
  assert.deepEqual(
    await section
      .locator('[data-profile]')
      .evaluateAll((els) => els.map((el) => Number(el.dataset.generation))),
    generations.map((n) => Number(n) + 1)
  );
  for (const root of roots) await root.click();
  await settle();
  await parity('reconnected-input');
  for (const profile of ['light', 'split'])
    assert.equal(
      await section
        .locator(`[data-profile="${profile}"] [data-s1-component="indicator"] path`)
        .getAttribute('d'),
      'm20 6-11 11-5-5'
    );
  assert.match(await roots[1].ariaSnapshot(), /checkbox "Accept terms" \[checked\]/);
  await page.setViewportSize({ width: 320, height: 900 });
  await settle();
  assert.equal(
    await section.evaluate((el) => el.scrollWidth > el.clientWidth),
    false,
    'S1 narrow layout overflow'
  );
  assert.deepEqual([...errors], [], 'page errors');
  console.log(
    JSON.stringify(
      {
        kind: 'public-shadow-s1',
        url,
        browser: browser.version(),
        firstFrame: frame,
        phases: samples.map((s) => s.phase),
        journey:
          'pointer/tab/space/enter/disabled/indicator/theme/isolation/customization/slot/move/reconnect passed',
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}
