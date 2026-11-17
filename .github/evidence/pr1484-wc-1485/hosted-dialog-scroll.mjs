import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Proposed parent-only execution; the supplied repository and evidence directory are explicit.
const [rootArg, evidenceArg] = process.argv.slice(2);
if (!rootArg || !evidenceArg) throw new Error('Usage: node --import tsx hosted-dialog-scroll.mjs <repository-root> <new-evidence-directory>');
const root = path.resolve(rootArg);
const evidence = path.resolve(evidenceArg);
const packet = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(path.join(packet, 'native-bindings.json'), 'utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const runtimePaths = [
  'packages/adapters/web-component/src/runtime/session.ts',
  'packages/adapters/web-component/src/shadow-split-effects.ts',
  'packages/core/src/spec/feedback/application-role.ts',
];
const boundPaths = [
  ...runtimePaths,
  'apps/www/src/content/docs/zh-cn/browser-harness.ts',
  'scripts/analysis/fixtures/shadow-s4/dialog.ts',
];
async function sourceBindings() {
  return Promise.all(boundPaths.map(async relativePath => {
    const expected = manifest.records.find(record => record.relativePath === relativePath)?.edited
      ?? manifest.support.find(record => record.relativePath === relativePath);
    assert.ok(expected, relativePath);
    const bytes = await readFile(path.join(root, relativePath));
    const sha256 = digest(bytes);
    assert.equal(sha256, expected.sha256, 'Selected native source changed: ' + relativePath);
    return { relativePath, bytes: bytes.length, sha256 };
  }));
}
const beforeBindings = await sourceBindings();
const requireRoot = createRequire(path.join(root, 'package.json'));
const { build } = requireRoot('esbuild');
const fixture = await build({
  absWorkingDir: root,
  entryPoints: ['scripts/analysis/fixtures/shadow-s4/dialog.ts'],
  nodePaths: [path.join(root, 'apps/www/node_modules')],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
  globalName: 'S4Audit',
  metafile: true,
  tsconfigRaw: { compilerOptions: {} },
});
const fixtureInputs = Object.keys(fixture.metafile.inputs);
assert.ok(fixtureInputs.some(input => input.includes('adapters/web-component/dist/')));
assert.ok(fixtureInputs.some(input => input.includes('prototypes/shadcn/dist/dialog/')));
assert.ok(fixtureInputs.some(input => input.endsWith('proto-ui-shadow-style.generated.js')));
assert.ok(!fixtureInputs.some(input => /packages\/.+\/src\//.test(input)), 'Public consumer admitted a package source alias');
const styles = await build({
  absWorkingDir: root,
  entryPoints: ['apps/www/src/styles/proto-ui-style.css'],
  outfile: 'hosted-dialog-consumer.css',
  bundle: true,
  write: false,
  metafile: true,
});
async function inputBindings(inputs) {
  return Promise.all(Object.keys(inputs).map(async input => {
    const bytes = await readFile(path.resolve(root, input));
    return { path: input, bytes: bytes.length, sha256: digest(bytes) };
  }));
}
const consumerBindings = {
  source: beforeBindings,
  publicBundle: await inputBindings(fixture.metafile.inputs),
  generatedStyles: await inputBindings(styles.metafile.inputs),
};
await mkdir(evidence, { recursive: true, mode: 0o700 });
const record = (name, value) => writeFile(path.join(evidence, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
await record('dialog-inputs.json', consumerBindings);
await record('dialog-metafiles.json', { fixture: fixture.metafile, styles: styles.metafile });
// Reuse the repository helper unchanged: chromiumSandbox:true and its existing launch defaults.
const { launchBrowser } = await import(pathToFileURL(path.join(root, 'apps/www/src/content/docs/zh-cn/browser-harness.ts')).href);
const browser = await launchBrowser();
const results = [];
const sample = `(() => {
  const a = window.audit, p = window.scrollProbe;
  const host = a.parts.content;
  const surface = host.shadowRoot?.querySelector('[part="surface"]') ?? host;
  const triggerSurface = a.parts.trigger.shadowRoot?.querySelector('[part="surface"]') ?? a.parts.trigger;
  const metrics = node => {
    const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
      position: style.position, maxHeight: style.maxHeight, overflowY: style.overflowY,
      background: style.backgroundColor, scrollTop: node.scrollTop,
      scrollHeight: node.scrollHeight, clientHeight: node.clientHeight };
  };
  return { open: a.sample().open, host: metrics(host), surface: metrics(surface),
    sameTarget: surface === host, portal: host.parentElement === document.body,
    bodyLock: document.body.style.overflow, bodyScrollTop: document.scrollingElement.scrollTop,
    inputActive: document.activeElement === p.input, triggerActive: document.activeElement === a.parts.trigger,
    callerValue: p.input.value, callerParentRetained: p.input.parentNode === p.caller,
    callerAssigned: surface === host ? host.contains(p.caller) : (surface.querySelector('slot')?.assignedNodes().includes(p.caller) ?? false),
    triggerCallerAssigned: triggerSurface === a.parts.trigger ? a.parts.trigger.contains(p.caption) : (triggerSurface.querySelector('slot')?.assignedNodes().includes(p.caption) ?? false),
    triggerCaption: p.caption.data,
    rootFontSize: parseFloat(getComputedStyle(document.documentElement).fontSize) };
})()`;
const closeEnough = (left, right, label) => assert.ok(Math.abs(left - right) < 0.1, label + ': ' + left + ' / ' + right);
const sameFrame = (before, after, label) => {
  for (const target of ['host', 'surface']) {
    for (const key of ['x', 'y', 'width', 'height']) closeEnough(before[target][key], after[target][key], label + '/' + target + '/' + key);
    assert.equal(after[target].background, before[target].background, label + '/' + target + '/paint');
  }
};
const callerIntact = value => {
  assert.equal(value.callerValue, 'retained caller value');
  assert.equal(value.callerParentRetained, true);
  assert.equal(value.callerAssigned, true);
  assert.equal(value.triggerCallerAssigned, true);
  assert.equal(value.triggerCaption, ' retained trigger caller');
};
try {
  for (const mode of ['light', 'split', 'mixed']) {
    const page = await browser.newPage({ viewport: { width: 880, height: 580 }, colorScheme: 'light' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.addStyleTag({ content: styles.outputFiles[0].text });
      await page.addScriptTag({ content: fixture.outputFiles[0].text });
      await page.evaluate('window.audit = S4Audit.mount(' + JSON.stringify(mode) + ')');
      await page.evaluate(`(() => {
        const a = window.audit;
        a.parts.root.addEventListener('openChange', event => a.setOpen(event.detail.open));
        const caller = document.createElement('div');
        for (let index = 0; index < 40; index++) {
          const line = document.createElement('p');
          line.textContent = 'Caller content row ' + index;
          caller.append(line);
        }
        const input = document.createElement('input');
        input.type = 'text'; input.value = 'retained caller value'; input.id = 'scroll-caller-last';
        caller.append(input);
        a.parts.content.insertBefore(caller, a.parts.footer);
        const caption = document.createTextNode(' retained trigger caller');
        a.parts.trigger.append(caption);
        a.parts.trigger.update();
        window.scrollProbe = { caller, input, caption };
      })()`);
      await page.locator('[data-part=trigger]').focus();
      await page.locator('[data-part=trigger]').click();
      await page.waitForTimeout(350);
      // Keep the last caller below the initial viewport even if native initial focus visited it.
      await page.locator('[data-part=close]').focus();
      await page.evaluate(`(() => {
        const h = window.audit.parts.content;
        (h.shadowRoot?.querySelector('[part="surface"]') ?? h).scrollTop = 0;
      })()`);
      const before = await page.evaluate(sample);
      assert.equal(before.open, true);
      assert.equal(before.portal, true);
      assert.equal(before.bodyLock, 'hidden');
      assert.equal(before.host.position, 'fixed');
      closeEnough(parseFloat(before.host.maxHeight), 580 - 2 * before.rootFontSize, mode + '/max-height');
      closeEnough(before.host.x + before.host.width / 2, 440, mode + '/center-x');
      closeEnough(before.host.y + before.host.height / 2, 290, mode + '/center-y');
      assert.ok(before.surface.scrollHeight > before.surface.clientHeight);
      assert.equal(before.surface.overflowY, 'auto');
      assert.equal(before.sameTarget, mode === 'light');
      callerIntact(before);
      if (mode !== 'light') assert.equal(before.host.scrollTop, 0);
      await page.mouse.move(before.host.x + before.host.width / 2, before.host.y + before.host.height / 2);
      await page.mouse.wheel(0, 480);
      await page.waitForFunction(`(() => { const h = window.audit.parts.content; return (h.shadowRoot?.querySelector('[part="surface"]') ?? h).scrollTop > 0; })()`);
      const afterWheel = await page.evaluate(sample);
      sameFrame(before, afterWheel, mode + '/wheel');
      assert.equal(afterWheel.bodyScrollTop, before.bodyScrollTop);
      assert.equal(afterWheel.bodyLock, 'hidden');
      callerIntact(afterWheel);
      if (mode !== 'light') assert.equal(afterWheel.host.scrollTop, 0);
      await page.locator('#scroll-caller-last').focus();
      await page.waitForFunction(`(() => { const a = window.audit, p = window.scrollProbe; const h = a.parts.content, s = h.shadowRoot?.querySelector('[part="surface"]') ?? h; const r = p.input.getBoundingClientRect(), b = s.getBoundingClientRect(); return document.activeElement === p.input && r.top >= b.top && r.bottom <= b.bottom; })()`);
      const afterFocus = await page.evaluate(sample);
      assert.equal(afterFocus.inputActive, true);
      assert.ok(afterFocus.surface.scrollTop > afterWheel.surface.scrollTop);
      sameFrame(before, afterFocus, mode + '/caller-focus');
      assert.equal(afterFocus.bodyScrollTop, before.bodyScrollTop);
      callerIntact(afterFocus);
      if (mode !== 'light') assert.equal(afterFocus.host.scrollTop, 0);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(350);
      const closed = await page.evaluate(sample);
      assert.equal(closed.open, false);
      assert.equal(closed.bodyLock, '');
      assert.equal(closed.triggerActive, true);
      assert.equal(closed.callerValue, 'retained caller value');
      assert.equal(closed.callerParentRetained, true);
      await page.locator('[data-part=trigger]').click();
      await page.waitForTimeout(350);
      const reopened = await page.evaluate(sample);
      assert.equal(reopened.open, true);
      callerIntact(reopened);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(350);
      assert.deepEqual(errors, []);
      const result = { mode, status: 'passed', before, afterWheel, afterFocus, closed, reopened, errors };
      results.push(result);
      await record('dialog-' + mode + '.json', result);
      console.log(JSON.stringify({ mode, status: 'passed', wheelScrollTop: afterWheel.surface.scrollTop, callerFocusScrollTop: afterFocus.surface.scrollTop }));
    } catch (error) {
      await record('dialog-' + mode + '-failure.json', { mode, status: 'failed', error: String(error), errors });
      throw error;
    } finally {
      await page.close();
    }
  }
  const afterBindings = await sourceBindings();
  assert.deepEqual(afterBindings, beforeBindings);
  await record('dialog-terminal.json', { browser: browser.version(), viewport: [880, 580], helper: 'unchanged launchBrowser; chromiumSandbox:true', sourceBindings: afterBindings, results, scope: 'Bounded actual public Dialog wheel/focus/slot composition; no full S4 settings or DemoMatrix claim' });
} finally {
  await browser.close();
}
