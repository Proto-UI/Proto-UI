import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import ts from 'typescript';
import { emitReact } from '@proto.ui/compiler/targets/react';
import { authoredSource } from './fixtures/authoring-source.mjs';

const require = createRequire(import.meta.url);
const compiler = fileURLToPath(new URL('../', import.meta.url));

async function linkPackage(directory, name, source) {
  const destination = path.join(directory, 'node_modules', name);
  await mkdir(path.dirname(destination), { recursive: true });
  await symlink(source, destination, 'dir');
}

async function openConsumer(t, browser, script) {
  const page = await browser.newPage();
  t.after(() => page.close());
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.setContent('<main id="app"></main>');
  await page.addScriptTag({ content: script });
  await page.getByRole('button', { name: 'Off', exact: true }).waitFor();
  return page;
}

const snapshot = (page) => page.evaluate(() => window.toggleTrace.snapshot());
const publish = (page, change) =>
  page.evaluate((change) => window.toggleTrace.publish(change), change);
const request = (channel, active, observed) => ({
  channel,
  payload: { active },
  observed,
  immutable: true,
});

async function visibleState(page, active, disabled, width) {
  const label = active ? 'On' : 'Off';
  const button = page.getByRole('button', { name: label, exact: true });
  await button.waitFor();
  assert.equal(await button.innerText(), label);
  const state = await snapshot(page);
  assert.deepEqual([state.active, state.disabled], [active, disabled]);
  assert.equal(
    await button.evaluate((node) => getComputedStyle(node).borderLeftWidth),
    `${width}px`
  );
  return state;
}

function assertActiveInputError(error, source) {
  assert.ok(error, 'the native host observed the invalid active input');
  assert.equal(error.typed, true);
  assert.equal(error.code, 'invalid-host-value');
  assert.ok(error.origin.includes(`${source.file}:${source.start}-${source.end}`), error.origin);
  assert.match(error.origin, /\bactive\b/);
}

async function expectRejection(page, count, source) {
  await page.waitForFunction(
    (count) => window.toggleTrace.notifications().diagnostics.length >= count,
    count
  );
  const { diagnostics } = await page.evaluate(() => window.toggleTrace.notifications());
  assert.equal(diagnostics.length, count);
  assertActiveInputError(diagnostics[count - 1], source);
}

test('authored controlled Toggle compiles into an external typed React DOM consumer', async (t) => {
  const result = authoredSource('controlled-toggle.proto.ts.txt', 'ControlledToggle');
  assert.equal(result.status, 'produced', JSON.stringify(result.diagnostics));
  assert.equal(result.component.name, 'ControlledToggle');
  const activeInput = result.component.props.find((prop) => prop.name === 'active');
  assert.ok(activeInput, 'authored active input has a diagnostic source');
  assert.match(activeInput.source.file, /controlled-toggle\.proto\.ts\.txt$/);

  const retained = process.env.PROTO_UI_REACT_CONSUMER_DIR;
  if (retained) await mkdir(retained, { recursive: true });
  const directory = await mkdtemp(
    path.join(retained || tmpdir(), 'proto-controlled-source-react-')
  );
  if (!retained) t.after(() => rm(directory, { force: true, recursive: true }));
  await linkPackage(directory, '@proto.ui/compiler', compiler);
  for (const name of ['react', 'react-dom', '@types/react', '@types/react-dom']) {
    await linkPackage(directory, name, path.dirname(require.resolve(`${name}/package.json`)));
  }
  if (retained)
    await writeFile(path.join(directory, 'authored-source.json'), JSON.stringify(result));
  await writeFile(path.join(directory, 'ControlledToggle.tsx'), emitReact(result.component));
  const app = path.join(directory, 'controlled-source.tsx');
  await copyFile(new URL('./consumers/react/controlled-source.tsx.in', import.meta.url), app);
  const options = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    types: [],
    allowImportingTsExtensions: true,
    strict: true,
    noEmit: true,
  };
  const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([app], options));
  assert.equal(
    diagnostics.length,
    0,
    ts.formatDiagnostics(diagnostics, {
      getCanonicalFileName: (file) => file,
      getCurrentDirectory: () => directory,
      getNewLine: () => '\n',
    })
  );
  const bundle = await build({
    entryPoints: [app],
    bundle: true,
    write: false,
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' },
  });
  const browser = await chromium.launch({ executablePath: process.env.PUI_CHROMIUM_EXECUTABLE });
  t.after(() => browser.close());
  const script = bundle.outputFiles[0].text;

  await t.test(
    'trusted clicks request change while the owner delays, rejects, accepts or disables',
    async (t) => {
      const page = await openConsumer(t, browser, script);
      const button = page.getByRole('button');
      const events = [];
      assert.deepEqual((await visibleState(page, false, false, 2)).requests, events);
      for (let i = 0; i < 2; i++) {
        await button.click();
        events.push(request('original', true, false));
        const pending = await visibleState(page, false, false, 2);
        assert.deepEqual(pending.requests, events);
        assert.equal(pending.trustedClicks, i + 1);
      }
      // The owner explicitly republishes false after the requests, then accepts a later one.
      await publish(page, { input: false, defaultActive: false, channel: 'owner', width: 3 });
      assert.deepEqual((await visibleState(page, false, false, 3)).requests, events);
      await button.click();
      events.push(request('owner', true, false));
      assert.deepEqual((await visibleState(page, false, false, 3)).requests, events);
      await publish(page, { input: true });
      assert.deepEqual((await visibleState(page, true, false, 3)).requests, events);
      await publish(page, { disabled: true });
      await visibleState(page, true, true, 3);
      // Send real pointer input even when this target exposes native button.disabled.
      await button.click({ force: true });
      assert.equal(await page.evaluate(() => window.toggleTrace.activate()), 'committed');
      assert.deepEqual((await visibleState(page, true, true, 3)).requests, events);
      await publish(page, { disabled: false });
      await button.click();
      events.push(request('owner', false, true));
      const final = await visibleState(page, true, false, 3);
      assert.deepEqual(final.requests, events);
      assert.deepEqual(final.diagnostics, []);
    }
  );

  await t.test(
    'same-key rejection preserves all committed inputs and a fresh key selects its mode',
    async (t) => {
      const page = await openConsumer(t, browser, script);
      const button = page.getByRole('button');
      const events = [];
      const accepted = {
        input: true,
        defaultActive: true,
        disabled: false,
        channel: 'accepted',
        width: 4,
      };
      const rejected = {
        input: 'omitted',
        defaultActive: false,
        disabled: true,
        channel: 'rejected',
        width: 9,
      };
      await publish(page, accepted);
      await visibleState(page, true, false, 4);
      await page.evaluate(() => {
        window.toggleTrace.remember();
        window.toggleTrace.recordNextRejectionInState();
      });
      await publish(page, rejected);
      await page.waitForFunction(() => window.toggleTrace.feedbackState() !== null);
      await expectRejection(page, 1, activeInput.source);
      const feedback = await page.evaluate(() => window.toggleTrace.feedbackState());
      assert.deepEqual(feedback, (await snapshot(page)).diagnostics[0]);
      assert.equal(await page.evaluate(() => window.toggleTrace.sameHandle()), true);
      assert.deepEqual((await visibleState(page, true, false, 4)).requests, events);
      await button.click();
      events.push(request('accepted', false, true));
      assert.deepEqual((await visibleState(page, true, false, 4)).requests, events);

      await publish(page, accepted);
      assert.equal((await visibleState(page, true, false, 4)).diagnostics.length, 1);
      await publish(page, rejected);
      await expectRejection(page, 2, activeInput.source);
      const repeated = await visibleState(page, true, false, 4);
      assert.deepEqual(repeated.diagnostics, [feedback, feedback]);
      assert.deepEqual(repeated.requests, events);

      await publish(page, accepted);
      await publish(page, {
        input: 'explicit-undefined',
        disabled: true,
        channel: 'invalid bool',
        width: 9,
      });
      await expectRejection(page, 3, activeInput.source);
      assert.deepEqual((await visibleState(page, true, false, 4)).requests, events);
      await publish(page, { input: false, disabled: false, channel: 'recovered', width: 3 });
      assert.equal(await page.evaluate(() => window.toggleTrace.sameHandle()), true);
      assert.deepEqual((await visibleState(page, false, false, 3)).requests, events);
      await button.click();
      events.push(request('recovered', true, false));
      assert.deepEqual((await visibleState(page, false, false, 3)).requests, events);

      await publish(page, {
        key: 'local',
        input: 'omitted',
        defaultActive: true,
        channel: 'local',
        width: 5,
      });
      assert.equal(await page.evaluate(() => window.toggleTrace.sameHandle()), false);
      assert.deepEqual(await page.evaluate(() => window.toggleTrace.savedAfterRemoval()), {
        action: 'disposed',
        projection: 'disposed',
      });
      assert.deepEqual((await visibleState(page, true, false, 5)).requests, events);
      await button.click();
      events.push(request('local', false, false));
      assert.deepEqual((await visibleState(page, false, false, 5)).requests, events);
      // An explicitly present undefined must also fail on an omitted-mode owner,
      // where incorrectly treating it as omission would otherwise accept the update.
      await publish(page, {
        input: 'explicit-undefined',
        disabled: true,
        channel: 'invalid local bool',
        width: 8,
      });
      await expectRejection(page, 4, activeInput.source);
      assert.deepEqual((await visibleState(page, false, false, 5)).requests, events);
      await publish(page, { input: 'omitted', disabled: false, channel: 'local', width: 5 });
      await publish(page, { input: true, disabled: true, channel: 'rejected reverse', width: 8 });
      await expectRejection(page, 5, activeInput.source);
      assert.deepEqual((await visibleState(page, false, false, 5)).requests, events);
      await button.click();
      events.push(request('local', true, true));
      assert.deepEqual((await visibleState(page, true, false, 5)).requests, events);
      await publish(page, {
        key: 'controlled-again',
        input: true,
        disabled: false,
        channel: 'fresh',
        width: 6,
      });
      const fresh = await visibleState(page, true, false, 6);
      assert.deepEqual(fresh.requests, events);
      assert.equal(fresh.diagnostics.length, 5);
    }
  );

  await t.test(
    'an omitted input initializes once and its saved owner survives hide and reveal',
    async (t) => {
      const page = await openConsumer(t, browser, script);
      const events = [];
      await publish(page, {
        key: 'omitted',
        input: 'omitted',
        defaultActive: true,
        channel: 'local',
        width: 5,
      });
      await visibleState(page, true, false, 5);
      await page.evaluate(() => window.toggleTrace.remember());
      await publish(page, { defaultActive: false });
      assert.deepEqual((await visibleState(page, true, false, 5)).requests, events);
      await page.getByRole('button').click();
      events.push(request('local', false, false));
      assert.deepEqual((await visibleState(page, false, false, 5)).requests, events);
      await publish(page, { defaultActive: true });
      assert.deepEqual((await visibleState(page, false, false, 5)).requests, events);

      await page.evaluate(() => window.toggleTrace.hide());
      await page.locator('#app button').waitFor({ state: 'hidden' });
      const hidden = await snapshot(page);
      assert.deepEqual([hidden.active, hidden.disabled, hidden.requests], [false, false, events]);
      assert.equal(await page.evaluate(() => window.toggleTrace.activateSaved()), 'committed');
      events.push(request('local', true, true));
      const updated = await snapshot(page);
      assert.deepEqual([updated.active, updated.requests], [true, events]);
      await page.evaluate(() => window.toggleTrace.reveal());
      assert.deepEqual((await visibleState(page, true, false, 5)).requests, events);
      assert.equal(await page.evaluate(() => window.toggleTrace.sameHandle()), true);
      await page.evaluate(() => window.toggleTrace.hide());
      await page.locator('#app button').waitFor({ state: 'hidden' });
      await page.evaluate(() => window.toggleTrace.unmount());
      assert.deepEqual(await page.evaluate(() => window.toggleTrace.savedAfterRemoval()), {
        action: 'disposed',
        projection: 'disposed',
      });
      assert.equal(await page.locator('#app').innerHTML(), '');
      assert.deepEqual(await page.evaluate(() => window.toggleTrace.notifications()), {
        requests: events,
        diagnostics: [],
      });
    }
  );

  await t.test(
    'an invalid first input reaches the native error boundary without publishing an owner',
    async (t) => {
      const page = await openConsumer(t, browser, script);
      await page.evaluate(() => {
        window.toggleTrace.remember();
        window.toggleTrace.mountInvalidFirst();
      });
      await page.waitForFunction(() => {
        const result = window.toggleTrace.firstMountResult();
        return (
          result.error !== undefined ||
          result.handles > 0 ||
          window.toggleTrace.notifications().diagnostics.length > 0
        );
      });
      const first = await page.evaluate(() => window.toggleTrace.firstMountResult());
      assertActiveInputError(first.error, activeInput.source);
      assert.equal(first.handles, 0);
      assert.equal(await page.locator('#app button').count(), 0);
      assert.deepEqual(await page.evaluate(() => window.toggleTrace.notifications()), {
        requests: [],
        diagnostics: [],
      });
      assert.deepEqual(await page.evaluate(() => window.toggleTrace.savedAfterRemoval()), {
        action: 'disposed',
        projection: 'disposed',
      });

      await publish(page, {
        key: 'recovered-first',
        input: 'omitted',
        defaultActive: true,
        channel: 'fresh',
      });
      await visibleState(page, true, false, 2);
      await page.getByRole('button').click();
      assert.deepEqual((await visibleState(page, false, false, 2)).requests, [
        request('fresh', false, false),
      ]);
    }
  );
});
