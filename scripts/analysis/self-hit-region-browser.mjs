import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const repo = fileURLToPath(new URL('../../', import.meta.url));
const bundle = await build({
  entryPoints: [path.join(repo, 'scripts/analysis/fixtures/self-hit-region.mjs')],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'SelfHitProbe',
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
  console.log('Self-region four-runtime fixture bundled; no browser executed.');
  process.exit(0);
}
assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Native execution requires the official runner.');
assert.ok(process.env.CANDIDATE_SHA, 'Exact candidate SHA required');
const out = process.env.STATIC_HIT_EVIDENCE_DIR;
assert.ok(out);
await fs.mkdir(out, { recursive: true });
const { chromium } = createRequire(path.join(repo, 'apps/www/package.json'))('playwright-core');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const observations = [],
  screenshots = [],
  errors = [];
let page, runtime;
const observe = async (stage) => {
  const state = await page.evaluate(() => SelfHitProbe.sample());
  observations.push({ runtime, stage, state });
  return state;
};
const capture = async (name) => {
  const file = path.join(out, name);
  await page.screenshot({ path: file, fullPage: true });
  screenshots.push({
    name,
    sha256: createHash('sha256')
      .update(await fs.readFile(file))
      .digest('hex'),
  });
};
try {
  for (runtime of ['wc', 'react', 'vue', 'vue2']) {
    page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await page.route('**/*', (r) => r.abort());
    page.on('pageerror', (e) => errors.push({ runtime, message: e.message }));
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.evaluate((r) => SelfHitProbe.mount(r), runtime);
    let state = await observe('initial');
    assert.equal(state.same, true);
    assert.equal(state.width, 32);
    assert.equal(state.height, 20);
    assert.equal(state.marked, false);
    assert.equal(state.checked, 'false');
    await page.mouse.click(state.x - 8, state.y + 10);
    assert.equal((await observe('outside-without-lease')).checked, 'false');
    await page.locator('[role=switch]').focus();
    const before = await observe('focused');
    assert.equal(before.focused, true);
    await page.evaluate(() => SelfHitProbe.expanded(true));
    state = await observe('lease-acquired');
    assert.equal(state.same, true);
    assert.equal(state.focused, true);
    assert.equal(state.marked, true);
    assert.equal(state.width, before.width);
    assert.equal(state.height, before.height);
    assert.equal(state.checked, before.checked);
    const points = [
      [-8, 10],
      [39, 10],
      [16, -5],
      [16, 24],
    ];
    for (const [dx, dy] of points) {
      const old = await observe('before-expanded-click');
      await page.mouse.click(old.x + dx, old.y + dy);
      const next = await observe('after-expanded-click');
      assert.notEqual(next.checked, old.checked);
      assert.equal(next.same, true);
      assert.equal(
        next.events.filter((e) => e.type === 'click').length,
        old.events.filter((e) => e.type === 'click').length + 1
      );
      assert.ok(next.events.at(-1).trusted);
    }
    await capture(`self-region-${runtime}-expanded.png`);
    await page.evaluate(() => SelfHitProbe.disabled(true));
    await page.waitForFunction(
      () => SelfHitProbe.sample().disabled === 'true',
      {},
      { timeout: 2000 }
    );
    state = await observe('disabled');
    assert.equal(state.same, true);
    assert.equal(state.marked, true);
    await page.mouse.click(state.x - 8, state.y + 10);
    assert.equal((await observe('disabled-outside-click')).checked, state.checked);
    await page.evaluate(() => SelfHitProbe.disabled(false));
    await page.waitForFunction(
      () => SelfHitProbe.sample().disabled === 'false',
      {},
      { timeout: 2000 }
    );
    await page.locator('[role=switch]').focus();
    state = await observe('before-release');
    assert.equal(state.same, true);
    assert.equal(state.marked, true);
    assert.equal(state.focused, true);
    await page.evaluate(() => SelfHitProbe.expanded(false));
    let next = await observe('released');
    assert.equal(next.same, true);
    assert.equal(next.marked, false);
    assert.equal(next.focused, true);
    assert.equal(next.checked, state.checked);
    await page.mouse.click(next.x - 8, next.y + 10);
    assert.equal((await observe('outside-after-release')).checked, next.checked);
    await capture(`self-region-${runtime}-released.png`);
    await page.evaluate(() => SelfHitProbe.expanded(true));
    assert.equal((await observe('reacquired')).marked, true);
    await page.evaluate(() => SelfHitProbe.dispose());
    await page.waitForFunction(() => !SelfHitProbe.sample().connected, {}, { timeout: 2000 });
    next = await observe('disposed');
    assert.equal(next.marked, false);
    assert.deepEqual(errors, []);
    await page.close();
    page = undefined;
  }
} catch (error) {
  if (page) {
    await observe('failure').catch(() => {});
    await capture(`self-region-${runtime}-failure.png`).catch(() => {});
  }
  await fs.writeFile(
    path.join(out, 'self-region-failure.json'),
    JSON.stringify(
      {
        candidate: process.env.CANDIDATE_SHA,
        error: String(error),
        errors,
        observations,
        screenshots,
      },
      null,
      2
    )
  );
  throw error;
} finally {
  await fs.writeFile(
    path.join(out, 'self-region-results.json'),
    JSON.stringify(
      {
        candidate: process.env.CANDIDATE_SHA,
        browser: browser.version(),
        errors,
        observations,
        screenshots,
      },
      null,
      2
    )
  );
  await browser.close();
}
