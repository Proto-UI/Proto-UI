import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';

const [distArg, outputArg] = process.argv.slice(2);
if (!distArg || !outputArg || process.argv.length !== 4) throw new Error('Usage: node run.mjs <production-build-directory> <new-evidence-directory>');
const dist = path.resolve(distArg), output = path.resolve(outputArg);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const build = JSON.parse(fs.readFileSync(path.join(dist, 'build.json')));
for (const file of build.files) assert.equal(sha256(fs.readFileSync(path.join(dist, file.path))), file.sha256, `Production file changed: ${file.path}`);
fs.mkdirSync(output, { recursive: false });
const report = { schemaVersion: 1, issue: 757, startedAt: new Date().toISOString(),
  sourceRevision: build.sourceRevision, build, node: process.version,
  browser: null, executionComplete: false, setupFailure: null, cells: [], controls: [],
  limitations: build.protocol.exclusions, claims: { osAT: false, crossHostAdvantage: false, independentAIGenerations: 0, stableConformance: false },
};
const save = () => fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n');
save();
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = pathname === '/' ? 'index.html' : pathname === '/app.js' ? 'app.js' : null;
  if (!file) { response.writeHead(404); response.end(); return; }
  response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'text/html');
  response.setHeader('Cache-Control', 'no-store');
  response.end(fs.readFileSync(path.join(dist, file)));
});
let browser;
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const executablePath = process.env.CHROME_PATH || ['/usr/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium-browser'].find((file) => fs.existsSync(file));
  assert.ok(executablePath, 'Set CHROME_PATH to an installed Chromium binary');
  browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  report.browser = { version: browser.version(), executableSha256: sha256(fs.readFileSync(executablePath)), playwright: '1.58.2', headless: true };

  async function snapshot(page) {
    return page.evaluate(() => {
      const visible = (el) => Boolean(el.getClientRects().length) && getComputedStyle(el).visibility !== 'hidden';
      const tabs = [...document.querySelectorAll('[role=tab]')].filter(visible);
      const panels = [...document.querySelectorAll('[role=tabpanel]')].filter(visible);
      const list = document.querySelector('[role=tablist]');
      return { tabs: tabs.map((el) => ({ text: el.textContent, id: el.id, selected: el.getAttribute('aria-selected'), tabIndex: el.tabIndex, focused: document.activeElement === el, controls: el.getAttribute('aria-controls') })),
        panels: panels.map((el) => ({ id: el.id, text: el.textContent, labelledBy: el.getAttribute('aria-labelledby'), focused: document.activeElement === el })),
        listName: list?.getAttribute('aria-label') ?? null,
        focus: { text: document.activeElement?.textContent?.slice(0, 100), role: document.activeElement?.getAttribute('role'), id: document.activeElement?.id },
        scrollY, hostResult: document.getElementById('host-result')?.textContent,
        mutationCount: window.__catalogMutationCount ?? 0 };
    });
  }
  async function settle(page) { await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
  async function launch(pathName, mode, mutation) {
    const context = await browser.newContext({ viewport: { width: 960, height: 680 }, deviceScaleFactor: 1, colorScheme: 'light' });
    const page = await context.newPage();
    const errors = [], assets = [];
    page.on('pageerror', (error) => errors.push({ kind: 'pageerror', message: error.message }));
    page.on('requestfailed', (request) => errors.push({ kind: 'requestfailed', path: new URL(request.url()).pathname, error: request.failure() }));
    const responses = [];
    page.on('response', (response) => {
      const pathname = new URL(response.url()).pathname;
      const file = pathname === '/' ? 'index.html' : pathname.slice(1);
      if (!build.files.some((candidate) => candidate.path === file)) return;
      responses.push(response.body().then((body) => {
        assert.equal(response.status(), 200);
        const hash = sha256(body);
        assert.equal(hash, build.files.find((candidate) => candidate.path === file).sha256);
        assets.push({ path: file, sha256: hash });
      }).catch((error) => errors.push({ kind: 'asset-binding', message: error.message })));
    });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
    await page.goto(`${origin}/?path=${pathName}&mode=${mode}${mutation ? `&mutation=${mutation}` : ''}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(window.__catalogStudy));
    await Promise.all(responses);
    return { context, page, errors, assets };
  }
  async function checkpoint(cell, page, name) {
    await settle(page);
    const state = await snapshot(page);
    cell.checkpoints.push({ name, state });
    return state;
  }
  function selected(state, text) {
    assert.deepEqual(state.tabs.filter((tab) => tab.selected === 'true').map((tab) => tab.text), [text], 'single selected tab');
    assert.equal(state.panels.length, 1, 'one visible panel');
    assert.equal(state.tabs.filter((tab) => tab.tabIndex >= 0).length, 1, 'one roving tab stop');
  }
  function focused(state, text) { assert.deepEqual(state.tabs.filter((tab) => tab.focused).map((tab) => tab.text), [text], 'native focused tab'); }
  function relations(state) {
    assert.equal(state.listName, 'Account settings', 'tablist accessible name');
    const tab = state.tabs.find((item) => item.selected === 'true');
    assert.ok(tab?.id && state.panels[0]?.id, 'real tab and panel IDs');
    assert.equal(tab.controls, state.panels[0].id, 'selected tab controls its live panel');
    assert.ok(state.panels[0].labelledBy?.split(/\s+/).includes(tab.id), 'live panel is named by selected tab');
  }

  for (let repeat = 1; repeat <= build.protocol.repetitions; repeat++) {
    // Counterbalance deterministic path order; do not call these AI replications.
    for (const pathName of repeat % 2 ? ['ordinary', 'proto'] : ['proto', 'ordinary']) {
      for (const mode of build.protocol.catalogPolicies.activationModes) {
        const id = `${pathName}-${mode}-${repeat}`;
        const cell = { id, path: pathName, mode, repeat, status: 'running', checkpoints: [], failure: null };
        report.cells.push(cell); save();
        let run;
        try {
          run = await launch(pathName, mode);
          const { page } = run;
          let state = await checkpoint(cell, page, 'initial'); selected(state, 'General'); relations(state);
          await page.keyboard.press('Tab'); state = await checkpoint(cell, page, 'tab-entry'); focused(state, 'General');
          await page.keyboard.press('ArrowRight'); state = await checkpoint(cell, page, 'right'); focused(state, 'Privacy'); selected(state, mode === 'manual' ? 'General' : 'Privacy');
          await page.keyboard.press('Enter'); state = await checkpoint(cell, page, 'activate'); selected(state, 'Privacy'); relations(state);
          await page.keyboard.press('End'); state = await checkpoint(cell, page, 'end'); focused(state, 'Notifications'); selected(state, mode === 'manual' ? 'Privacy' : 'Notifications');
          await page.keyboard.press('Home'); state = await checkpoint(cell, page, 'home'); focused(state, 'General'); selected(state, mode === 'manual' ? 'Privacy' : 'General');
          await page.keyboard.press('ArrowLeft'); state = await checkpoint(cell, page, 'wrap-left'); focused(state, 'Notifications'); selected(state, mode === 'manual' ? 'Privacy' : 'Notifications');
          await page.keyboard.press('ArrowRight'); state = await checkpoint(cell, page, 'wrap-right'); focused(state, 'General'); selected(state, mode === 'manual' ? 'Privacy' : 'General');
          const beforeScroll = state.scrollY;
          await page.keyboard.press('Space'); state = await checkpoint(cell, page, 'space'); selected(state, 'General'); assert.equal(state.scrollY, beforeScroll, 'Space prevented page scroll');
          await page.getByRole('tab', { name: 'Privacy', exact: true }).click(); state = await checkpoint(cell, page, 'pointer'); selected(state, 'Privacy'); focused(state, 'Privacy'); relations(state);
          await page.keyboard.press('Tab'); state = await checkpoint(cell, page, 'panel-entry'); assert.equal(state.panels[0].focused, true, 'plain text panel receives Tab');
          await page.keyboard.press('Tab'); state = await checkpoint(cell, page, 'panel-exit'); assert.equal(state.focus.id, 'host-action', 'Tab leaves panel for host action');
          await page.evaluate(() => { window.__retainedTab = [...document.querySelectorAll('[role=tab]')].find((el) => el.textContent === 'Privacy'); });
          const components = structuredClone(build.input[0].createSurface.components);
          components[0].tabs[1].title = 'Personal privacy';
          components.find((item) => item.id === 'privacy').text = 'Updated privacy content.';
          await page.evaluate((message) => window.__catalogStudy.apply(message), { version: '1.0', updateComponents: { surfaceId: 'settings-1', components } });
          state = await checkpoint(cell, page, 'update'); selected(state, 'Personal privacy'); relations(state); assert.match(state.panels[0].text, /Updated privacy content/);
          assert.equal(await page.evaluate(() => window.__retainedTab === [...document.querySelectorAll('[role=tab]')].find((el) => el.textContent === 'Personal privacy')), true, 'task-policy trigger DOM identity');
          if (repeat === 1) { const screenshot = `${id}-updated.png`; await page.screenshot({ path: path.join(output, screenshot), fullPage: true }); cell.screenshot = screenshot; }
          await page.evaluate(() => window.__catalogStudy.apply({ version: '1.0', deleteSurface: { surfaceId: 'settings-1' } }));
          state = await checkpoint(cell, page, 'delete'); assert.equal(state.tabs.length, 0); assert.equal(state.panels.length, 0);
          await page.evaluate(() => window.__retainedTab?.click()); // Explicit synthetic stale-handle probe, not native-input evidence.
          await page.getByRole('button', { name: 'Continue in host' }).click();
          state = await checkpoint(cell, page, 'stale-and-host'); assert.equal(state.tabs.length, 0); assert.equal(state.hostResult, 'Host action completed');
          const recreation = structuredClone(build.input[0]); recreation.createSurface.surfaceId = 'settings-2';
          await page.evaluate((message) => window.__catalogStudy.apply(message), recreation);
          state = await checkpoint(cell, page, 'recreate'); selected(state, 'General'); assert.equal(state.tabs.length, 3); relations(state);
          assert.deepEqual(run.errors, [], 'runtime/served-asset errors');
          cell.status = 'passed';
        } catch (error) {
          cell.status = 'failed'; cell.failure = { message: error.message, after: cell.checkpoints.at(-1)?.name ?? 'setup' };
          if (run) { const name = `${id}-failure.png`; await run.page.screenshot({ path: path.join(output, name), fullPage: true }).catch(() => {}); cell.screenshot = name; }
        } finally {
          if (run) {
            cell.events = await run.page.evaluate(() => window.__catalogEvents ?? []);
            cell.errors = run.errors; cell.assets = run.assets;
            await run.context.tracing.stop({ path: path.join(output, `${id}.zip`) }); await run.context.close();
          }
          save();
        }
      }
    }
  }
  for (const pathName of ['ordinary', 'proto']) {
    for (const mutation of ['missing-label', 'swallowed-arrow', 'dynamic-title']) {
      const control = { path: pathName, mutation, status: 'running', observations: [] };
      report.controls.push(control); save(); let run;
      try {
        run = await launch(pathName, 'manual', mutation);
        if (mutation === 'dynamic-title') {
          const text = await run.page.getByRole('alert').innerText();
          assert.match(text, /Unsupported dynamic tab title/); control.observations.push({ text });
          control.status = 'explicit-unsupported';
        } else {
          await settle(run.page); const before = await snapshot(run.page); control.observations.push({ before });
          if (mutation === 'missing-label') {
            assert.equal(before.tabs.length, 3, 'mutation still renders actual tabs');
            assert.ok(!before.listName, 'the label mutation must actually remove the name');
            control.status = 'behavioral-name-failure-observed';
          } else {
            selected(before, 'General'); relations(before);
            await run.page.keyboard.press('Tab');
            await run.page.keyboard.press('ArrowRight'); await settle(run.page);
            const after = await snapshot(run.page); control.observations.push({ after });
            assert.ok(after.mutationCount > 0, 'mutation handler executed');
            focused(after, 'General'); control.status = 'behavioral-focus-failure-observed';
          }
        }
        assert.deepEqual(run.errors, []);
      } catch (error) { control.status = 'failed-control'; control.failure = error.message; }
      finally {
        if (run) { control.events = await run.page.evaluate(() => window.__catalogEvents ?? []); await run.context.tracing.stop({ path: path.join(output, `${pathName}-${mutation}.zip`) }); await run.context.close(); }
        save();
      }
    }
  }
  report.executionComplete = true;
} catch (error) { report.setupFailure = { name: error.name, message: error.message }; }
finally {
  if (browser) await browser.close();
  if (server.listening) await new Promise((resolve) => server.close(resolve));
  report.finishedAt = new Date().toISOString();
  report.summary = { passed: report.cells.filter((cell) => cell.status === 'passed').length, failed: report.cells.filter((cell) => cell.status === 'failed').length,
    expectedCells: build.protocol.repetitions * 2 * build.protocol.catalogPolicies.activationModes.length,
    controls: report.controls.map(({ path, mutation, status }) => ({ path, mutation, status })) };
  save();
}
console.log(JSON.stringify({ executionComplete: report.executionComplete, summary: report.summary, setupFailure: report.setupFailure }));
if (!report.executionComplete || report.summary.failed || report.controls.some((control) => control.status === 'failed-control')) process.exitCode = 1;
