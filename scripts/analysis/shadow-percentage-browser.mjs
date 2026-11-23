/** Native observer for the immutable output of shadow-percentage-build.mjs.
 * No source aliases, replacement utility CSS, synthetic click dispatch or
 * CSS-derived expected equations are used by this observer.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const input = resolve(process.argv[2]);
const output = resolve(process.argv[3] ?? join(input, 'native'));
const hash = (data) => createHash('sha256').update(data).digest('hex');
const producerBytes = await readFile(join(input, 'manifest.json'));
const producer = JSON.parse(producerBytes);
for (const [name, expected] of Object.entries(producer.outputs)) {
  const data = await readFile(join(input, name));
  assert.equal(data.length, expected.bytes, name);
  assert.equal(hash(data), expected.sha256, name);
}
const playwright = process.env.PUI_PLAYWRIGHT_MODULE
  ? await import(pathToFileURL(process.env.PUI_PLAYWRIGHT_MODULE).href)
  : createRequire(new URL('../../apps/www/package.json', import.meta.url))('playwright-core');
const executablePath = process.env.PUI_CHROME_EXECUTABLE;
assert.ok(executablePath, 'Set PUI_CHROME_EXECUTABLE to the actual native browser');
const launchArgs =
  process.env.PUI_CHROME_NO_SANDBOX === '1' ? ['--no-sandbox', '--disable-dev-shm-usage'] : [];
await mkdir(output, { recursive: true });
const report = {
  kind: 'shadow-percentage-native-candidate',
  startedAt: new Date().toISOString(),
  producerManifestSha256: hash(producerBytes),
  producerSourceHead: producer.sourceHead,
  browserObserverSha256: hash(await readFile(fileURLToPath(import.meta.url))),
  browserExecutableSha256: hash(await readFile(executablePath)),
  executablePath,
  launchArgs,
  originalSprintGatesChanged: false,
  matrix: [],
  animations: [],
  lifecycle: [],
  controls: [],
  errors: [],
  pageErrors: [],
};
const errors = report.errors;
const near = (actual, expected, label, tolerance = 0.06) => {
  assert.ok(Number.isFinite(actual), `${label}: finite actual`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected}`);
};
// Equations fixed by the candidate definition, never parsed from the output CSS.
function displacement(expression, width, percentage) {
  const p = percentage / 100;
  switch (expression) {
    case 0:
      return width - 4;
    case 1:
      return (width - 2) * p;
    case 2:
      return (width - 4) * p;
    case 3:
      return (width - 8) * p;
    case 4:
      return (2 - width) * p;
    case 5:
      return (4 - width) * p;
    case 6:
      return (8 - width) * p;
    case 7:
      return 1 + (width + 1) * p;
    case 8:
      return -1 - (width + 1) * p;
    default:
      throw new Error(`Unknown equation ${expression}`);
  }
}
function verifyRows(rows, config, percentage) {
  assert.equal(rows.length, 2);
  for (const row of rows) {
    const label = `${config.expression}/${config.width}/${config.direction}/${percentage}/${row.profile}`;
    const expected = displacement(config.expression, config.width, percentage);
    near(row.host.width, config.width, `${label}: width`);
    near(row.host.height, 16, `${label}: height`);
    near(row.host.x - row.anchor.x, expected, `${label}: boundary displacement`);
    near(row.surface.x, row.host.x, `${label}: surface shares boundary displacement`);
    near(row.surface.y, row.host.y, `${label}: surface y`);
    near(row.surface.width, config.width, `${label}: surface width`);
    near(row.caller.x, row.host.x, `${label}: real slot displacement`);
    near(row.caller.width, config.width, `${label}: real slot width`);
    assert.equal(row.slotIdentity, true, `${label}: actual slot assignment`);
    assert.equal(row.callerIdentity, true, `${label}: actual caller node`);
    assert.equal(row.hit, true, `${label}: actual host hit region`);
    assert.equal(row.state, config.expression === 0 ? null : percentage, `${label}: owned state`);
    assert.equal(
      row.inlinePercentage,
      config.expression === 0 ? '' : String(percentage),
      `${label}: own CSS projection`
    );
    if (row.profile === 'split') {
      assert.equal(row.surfaceTransform, 'none', `${label}: no duplicate surface transform`);
      assert.ok(row.rootTokens.includes('translate-x-['), `${label}: complete boundary role`);
      assert.ok(!row.surfaceTokens.includes('translate-x-['), `${label}: surface role separation`);
    }
  }
}
const browser = await playwright.chromium.launch({
  executablePath,
  headless: true,
  args: launchArgs,
});
report.browserVersion = browser.version();
try {
  const page = await browser.newPage({
    viewport: { width: 1000, height: 700 },
    reducedMotion: 'no-preference',
  });
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => report.pageErrors.push(String(error)));
  await page.setContent(
    '<!doctype html><html><head><meta charset="utf-8"><style>html{font-size:16px}body{margin:0}</style></head><body></body></html>'
  );
  await page.addStyleTag({ content: await readFile(join(input, 'tokens.css'), 'utf8') });
  await page.addScriptTag({ content: await readFile(join(input, 'consumer.js'), 'utf8') });
  const settle = () =>
    page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    );
  const mount = async (config) => {
    await page.evaluate((value) => PuiPercentage.lab.mount(value), config);
    await settle();
    await settle();
  };
  for (let expression = 0; expression < 9; expression++) {
    for (const width of [16, 32, 48]) {
      for (const direction of ['ltr', 'rtl']) {
        const config = { expression, width, direction };
        const item = { config, samples: [], passed: false };
        report.matrix.push(item);
        try {
          await mount(config);
          for (const percentage of [0, 25, 50, 75, 100]) {
            await page.evaluate((value) => PuiPercentage.lab.move(value), percentage);
            await settle();
            const rows = await page.evaluate(() => PuiPercentage.lab.sample());
            item.samples.push({ percentage, rows });
            verifyRows(rows, config, percentage);
          }
          // Native input at the displaced boundary, outside the 4px slot marker.
          const before = await page.evaluate(() => PuiPercentage.lab.sample());
          for (const row of before) {
            await page.mouse.click(
              row.host.x + row.host.width / 2,
              row.host.y + row.host.height / 2
            );
          }
          const after = await page.evaluate(() => PuiPercentage.lab.sample());
          for (let i = 0; i < after.length; i++) {
            assert.equal(after[i].clicks, before[i].clicks + 1);
            assert.deepEqual(after[i].trustedClicks, [true]);
          }
          item.clicks = after.map(({ profile, clicks, trustedClicks }) => ({
            profile,
            clicks,
            trustedClicks,
          }));
          item.passed = true;
        } catch (error) {
          item.error = String(error.stack ?? error);
          errors.push({ phase: 'matrix', config, error: item.error });
        }
      }
    }
  }
  // Every dynamic equation has native intermediate geometry and a reversal
  // before the first 200ms destination is reached, in both directions.
  for (let expression = 1; expression < 9; expression++) {
    for (const direction of ['ltr', 'rtl']) {
      const config = { expression, width: 32, direction };
      const item = { config, passed: false, frames: [] };
      report.animations.push(item);
      try {
        await mount(config);
        await page.evaluate(() => PuiPercentage.lab.animate(true));
        await settle();
        const initial = await page.evaluate(() => PuiPercentage.lab.sample());
        for (const row of initial) {
          assert.ok(row.transition.includes('transform'));
          assert.equal(row.transitionDuration, '0.2s');
        }
        item.frames = await page.evaluate(async () => {
          const frames = [];
          const start = performance.now();
          let reversedAt = null;
          PuiPercentage.lab.move(100);
          await new Promise((resolve) => {
            const tick = () => {
              const elapsed = performance.now() - start;
              frames.push({ elapsed, reversedAt, rows: PuiPercentage.lab.sample() });
              if (reversedAt === null && elapsed >= 70) {
                reversedAt = elapsed;
                PuiPercentage.lab.move(0);
              }
              if (elapsed >= 400) resolve();
              else requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          });
          return frames;
        });
        for (const profile of ['light', 'split']) {
          const start = displacement(expression, 32, 0);
          const end = displacement(expression, 32, 100);
          const samples = item.frames.map((frame) => ({
            ...frame,
            row: frame.rows.find((row) => row.profile === profile),
          }));
          const fractions = samples.map(
            ({ row }) => (row.host.x - row.anchor.x - start) / (end - start)
          );
          assert.ok(
            fractions.some((value) => value > 0.05 && value < 0.95),
            `${profile}: real intermediate movement`
          );
          assert.ok(
            fractions.slice(1).some((value, i) => value < fractions[i] - 0.02),
            `${profile}: actual reversal`
          );
          for (const { row } of samples) {
            near(row.surface.x, row.host.x, `${profile}: animated surface`);
            near(row.caller.x, row.host.x, `${profile}: animated slot`);
            assert.equal(row.hit, true, `${profile}: animated hit region`);
          }
        }
        verifyRows(item.frames.at(-1).rows, config, 0);
        await page.evaluate(() => PuiPercentage.lab.animate(false));
        await settle();
        item.restored = await page.evaluate(() => PuiPercentage.lab.sample());
        for (const row of item.restored) {
          assert.equal(row.transition, 'none');
          assert.equal(row.surfaceTransition, 'none');
          assert.equal(row.surfaceInlineTransition, '');
        }
        item.passed = true;
      } catch (error) {
        item.error = String(error.stack ?? error);
        errors.push({ phase: 'animation', config, error: item.error });
      }
    }
  }
  for (const expression of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
    const config = { expression, width: 32, direction: 'rtl' };
    const item = { config, passed: false };
    report.lifecycle.push(item);
    try {
      await mount(config);
      await page.evaluate(() => PuiPercentage.lab.move(75));
      await settle();
      verifyRows(await page.evaluate(() => PuiPercentage.lab.sample()), config, 75);
      await page.evaluate(() => PuiPercentage.lab.present(false));
      await settle();
      item.absent = await page.evaluate(() => PuiPercentage.lab.absence());
      assert.equal(item.absent.find((row) => row.profile === 'split').rootTokens, null);
      for (const row of item.absent) assert.equal(row.callerIdentity, true);
      await page.evaluate(() => PuiPercentage.lab.move(50));
      await page.evaluate(() => PuiPercentage.lab.present(true));
      await settle();
      await settle();
      item.retained = await page.evaluate(() => PuiPercentage.lab.sample());
      verifyRows(item.retained, config, 50);
      for (const row of item.retained) assert.equal(row.setups, 1);
      await page.evaluate(() => PuiPercentage.lab.disconnect());
      await settle();
      item.detached = await page.evaluate(() => PuiPercentage.lab.disconnected());
      assert.equal(item.detached.find((row) => row.profile === 'split').shadowChildren, 0);
      assert.ok(item.detached.every((row) => row.connected === false));
      await page.evaluate(() => PuiPercentage.lab.reconnect());
      await settle();
      await settle();
      item.stale = await page.evaluate(() => PuiPercentage.lab.invokeStale());
      await settle();
      item.reconnected = await page.evaluate(() => PuiPercentage.lab.sample());
      verifyRows(item.reconnected, config, 0);
      for (const row of item.reconnected) assert.equal(row.setups, 2);
      item.passed = true;
    } catch (error) {
      item.error = String(error.stack ?? error);
      errors.push({ phase: 'lifecycle', config, error: item.error });
    }
  }
  try {
    // In an RTL block container, a 16px child starts at the right edge of a
    // 48px containing block before its own transform. Check that independent
    // browser layout fact with plain elements; do not infer an expected offset
    // from the candidate's generated CSS or measured transformed child.
    report.nestedFlowControl = await page.evaluate(() => {
      const parent = document.createElement('div');
      parent.style.cssText =
        'position:absolute;left:0;top:0;display:block;direction:rtl;width:48px;height:16px;padding:0;border:0;';
      const child = document.createElement('div');
      child.style.cssText = 'display:block;width:16px;height:16px;margin:0;padding:0;border:0;';
      parent.append(child);
      document.body.append(parent);
      const p = parent.getBoundingClientRect();
      const c = child.getBoundingClientRect();
      const result = { parentWidth: p.width, childWidth: c.width, offset: c.x - p.x };
      parent.remove();
      return result;
    });
    assert.deepEqual(report.nestedFlowControl, { parentWidth: 48, childWidth: 16, offset: 32 });
    await page.evaluate(() => PuiPercentage.lab.nested());
    await settle();
    await settle();
    report.nested = await page.evaluate(() => PuiPercentage.lab.nestedSample());
    const [outer, inner] = report.nested;
    near(outer.host.width, 48, 'outer fixed width');
    near(inner.host.width, 16, 'inner fixed width');
    near(outer.host.x - outer.anchor.x, (48 - 4) * 0.75, 'outer own progress');
    near(
      inner.host.x - outer.host.x,
      48 - 16 - 1 - (16 + 1) * 0.25,
      'inner own progress after ordinary RTL alignment'
    );
    near(inner.caller.x, inner.host.x, 'nested actual slot');
    assert.equal(outer.inlinePercentage, '75');
    assert.equal(inner.inlinePercentage, '25');
    assert.equal(outer.slotContainsHost, true);
    assert.equal(inner.state, 25);
  } catch (error) {
    errors.push({ phase: 'nested', error: String(error.stack ?? error) });
  }
  // Meaningful native fault: duplicate the admitted whole-Root displacement
  // on the surface only. The same geometry oracle must reject the moved slot.
  try {
    const config = { expression: 2, width: 32, direction: 'ltr' };
    await mount(config);
    await page.evaluate(() => PuiPercentage.lab.move(50));
    await settle();
    const before = await page.evaluate(() => PuiPercentage.lab.sample());
    verifyRows(before, config, 50);
    await page.evaluate(() => PuiPercentage.lab.duplicateSurfaceGeometry(14));
    const faulty = await page.evaluate(() => PuiPercentage.lab.sample());
    let caught = null;
    try {
      verifyRows(faulty, config, 50);
    } catch (error) {
      caught = String(error);
    }
    await page.evaluate(() => PuiPercentage.lab.duplicateSurfaceGeometry(null));
    const restored = await page.evaluate(() => PuiPercentage.lab.sample());
    verifyRows(restored, config, 50);
    assert.ok(caught, 'duplicate geometry control must actually fail');
    report.controls.push({
      kind: 'duplicate-surface-translation',
      before,
      faulty,
      caught,
      restored,
    });
  } catch (error) {
    errors.push({ phase: 'negative-control', error: String(error.stack ?? error) });
  }
  await page.screenshot({ path: join(output, 'final.png') });
  await page.evaluate(() => PuiPercentage.lab.dispose());
  await settle();
  assert.deepEqual(report.pageErrors, []);
  assert.equal(report.matrix.length, 54);
  assert.equal(report.animations.length, 16);
  assert.equal(report.lifecycle.length, 9);
  assert.equal(report.controls.length, 1);
  assert.deepEqual(errors, []);
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failure = String(error.stack ?? error);
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  await browser.close();
  const data = Buffer.from(JSON.stringify(report, null, 2) + '\n');
  await writeFile(join(output, 'report.json.gz'), gzipSync(data));
  await writeFile(
    join(output, 'receipt.json'),
    JSON.stringify(
      {
        startedAt: report.startedAt,
        finishedAt: report.finishedAt,
        passed: report.passed,
        reportSha256: hash(data),
        matrix: {
          passed: report.matrix.filter((row) => row.passed).length,
          total: report.matrix.length,
        },
        animations: {
          passed: report.animations.filter((row) => row.passed).length,
          total: report.animations.length,
        },
        lifecycle: {
          passed: report.lifecycle.filter((row) => row.passed).length,
          total: report.lifecycle.length,
        },
        errors,
        pageErrors: report.pageErrors,
      },
      null,
      2
    ) + '\n'
  );
  console.log(
    JSON.stringify({
      passed: report.passed,
      errors: errors.length,
      pageErrors: report.pageErrors.length,
      output,
    })
  );
}
