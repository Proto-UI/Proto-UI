// Same packed consumer, genuine preinstalled Chromium. No browser download fallback.
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [consumerArg, rootArg] = process.argv.slice(2);
assert(consumerArg && rootArg, 'expected the existing consumer and repository directories');
const consumer = realpathSync(consumerArg);
const root = realpathSync(rootArg);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const digestFile = (path) => digest(readFileSync(path));
const inside = (directory, path) => {
  const name = relative(directory, path);
  return name !== '..' && !name.startsWith('../') && !isAbsolute(name);
};
const repoRequire = createRequire(join(root, 'package.json'));
const wwwRequire = createRequire(join(root, 'apps', 'www', 'package.json'));
const esbuild = repoRequire('esbuild');
const { chromium } = wwwRequire('playwright-core');
const esbuildPackage = repoRequire('esbuild/package.json');
const playwrightPackage = wwwRequire('playwright-core/package.json');
assert.equal(esbuildPackage.version, '0.25.12', 'review tooling version changes separately');
assert.equal(playwrightPackage.version, '1.58.2', 'review tooling version changes separately');
const lock = readFileSync(join(root, 'pnpm-lock.yaml'), 'utf8');
const tooling = [
  ['esbuild', esbuildPackage.version, 'sha512-bbPBYYrtZbkt6Os6FiTLCTFxvq4tt3JKall1vRwshA3fdVztsLAatFaZobhkBC8/BrPetoa0oksYoKXoG4ryJg=='],
  ['playwright-core', playwrightPackage.version, 'sha512-yZkEtftgwS8CsfYo7nm0KE8jsvm6i/PTgVtB8DL726wNf6H2IMsDuxCpJj59KDaxCtSnrWan2AeDqM7JBaultg=='],
].map(([name, version, integrity]) => {
  assert(lock.includes(`${name}@${version}:`) && lock.includes(integrity), 'locked tool provenance drift');
  return { name, version, lockIntegrity: integrity };
});
// Only the runner's existing standard executable locations; never install or
// execute an arbitrary environment-provided path or a downloaded browser cache.
const chromePaths = [
  ['/usr/bin/google-chrome', '/opt/google/chrome/chrome'],
  ['/usr/bin/chromium', '/usr/lib/chromium/chromium'],
  ['/usr/bin/chromium-browser', '/usr/lib/chromium-browser/chromium-browser'],
].find((paths) => paths.every((path) => existsSync(path)));
assert(chromePaths, 'preinstalled runner Chrome/Chromium missing; no download fallback');
const [chrome, chromeBinary] = chromePaths;
const chromeVersion = spawnSync(chrome, ['--version'], { encoding: 'utf8', timeout: 10000 });
assert(!chromeVersion.error && chromeVersion.status === 0, 'cannot identify preinstalled Chrome');
const binding = JSON.parse(readFileSync(join(consumer, 'checkbox-delivery-evidence.json'), 'utf8'));
assert.equal(binding.lockSha256, digestFile(join(consumer, 'package-lock.json')));
assert.equal(binding.generatedFacadeSha256, digestFile(join(consumer, 'proto-ui/components/wc/index.ts')));

// This entry resolves all business imports inside the already installed consumer.
const entry = `
import * as facade from './proto-ui/components/wc/index.ts';
import { createShadcnCheckboxLabelComposition } from '@proto.ui/prototypes-shadcn/checkbox';
import { setElementAssociations, setElementProps } from '@proto.ui/adapter-web-component';
const order = [];
customElements.define('pui-native-order-parent', class extends HTMLElement {
  connectedCallback() { order.push('parent'); }
});
customElements.define('pui-native-order-child', class extends HTMLElement {
  connectedCallback() { order.push('child'); }
});
const parent = document.createElement('pui-native-order-parent');
parent.append(document.createElement('pui-native-order-child'));
document.body.append(parent);
parent.remove();
const pairs = [];
function mount(kind, { props = {}, indicator = kind === 'explicit' ? 'explicit' : 'default', raw = false } = {}) {
  console.info('[packed-native] mount:' + kind);
  const pair = createShadcnCheckboxLabelComposition();
  const control = raw ? new facade.ShadcnCheckboxRootElement() : new facade.ShadcnCheckboxElement();
  const label = new facade.ShadcnLabelRootElement();
  if (indicator === 'explicit') control.append(new facade.ShadcnCheckboxIndicatorElement());
  if (indicator === 'none') control.setAttribute('data-pui-no-default-indicator', '');
  const strong = document.createElement('strong');
  strong.textContent = 'Receive ' + kind + ' updates';
  const decoration = document.createElement('span');
  decoration.textContent = '✓';
  decoration.setAttribute('aria-hidden', 'true');
  label.append(decoration, strong);
  setElementProps(control, props);
  setElementProps(label, pair.label.props);
  setElementAssociations(control, pair.control.instanceAssociations);
  setElementAssociations(label, pair.label.instanceAssociations);
  const container = document.createElement('div');
  container.dataset.case = kind;
  container.append(control, label);
  const record = { pair, control, label, container, changes: 0 };
  control.addEventListener('checkedChange', () => record.changes++);
  // Keep the explicit child preassembled before the entire detached subtree connects.
  document.body.append(container);
  pairs.push(record);
  return record;
}
mount('default');
mount('explicit');
window.packedCheckboxSmoke = { order, pairs, mount, setLabelProps: setElementProps };
`;
writeFileSync(join(consumer, 'checkbox-native-entry.mjs'), entry);
const bundled = await esbuild.build({
  absWorkingDir: consumer,
  entryPoints: ['checkbox-native-entry.mjs'],
  outfile: 'checkbox-native-bundle.js',
  bundle: true,
  platform: 'browser',
  format: 'esm',
  write: false,
  metafile: true,
  logLevel: 'silent',
});
assert.equal(bundled.outputFiles.length, 1, 'unexpected additional bundle output');
const inputs = Object.entries(bundled.metafile.inputs).map(([name, metadata]) => {
  const path = realpathSync(resolve(consumer, name));
  assert(inside(consumer, path), `business source escaped packed consumer: ${name}`);
  assert(metadata.imports.every((item) => !item.external), 'unexpected external input import');
  return { path: relative(consumer, path).replaceAll('\\', '/'), sha256: digestFile(path) };
});
for (const output of Object.values(bundled.metafile.outputs)) {
  assert.equal(output.imports.length, 0, 'browser bundle must be self-contained');
}
const resources = new Map([
  ['/', { type: 'text/html', body: Buffer.from('<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><link rel="stylesheet" href="/src/styles/proto-ui-style.css"></head><body><script type="module" src="/checkbox-native-bundle.js"></script></body></html>') }],
  ['/checkbox-native-bundle.js', { type: 'text/javascript', body: Buffer.from(bundled.outputFiles[0].contents) }],
]);
// A separate page/realm, without CSS or business imports, executes the same
// import-free module copied into the standalone HappyDOM consumer process.
let orderModule;
const orderPreparationErrors = [];
const orderResources = new Map();
try {
  orderModule = readFileSync(new URL('./preassembled-ce-order.mjs', import.meta.url));
  const preparedOrderResources = new Map([
  ['/standalone-order', { type: 'text/html', body: Buffer.from('<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"></head><body><script type="module" src="/standalone-order-entry.mjs"></script></body></html>') }],
  ['/preassembled-ce-order.mjs', { type: 'text/javascript', body: orderModule }],
  ['/standalone-order-entry.mjs', { type: 'text/javascript', body: Buffer.from("import { observeStandaloneConnectionOrder } from '/preassembled-ce-order.mjs';\nwindow.standaloneOrder = observeStandaloneConnectionOrder();\n") }],
  ]);
  for (const [path, resource] of preparedOrderResources) {
    orderResources.set(path, resource);
    resources.set(path, resource);
  }
} catch (error) {
  orderPreparationErrors.push(error);
}
// Existing adapter infrastructure creates two empty style elements and then
// fills these fixed rules. Permit only their exact bytes, not arbitrary inline
// styles, and independently check the actual installed adapter's DOM output.
const infrastructureStyles = {
  'proto-ui-view-visibility': '\n:where([data-pui-view-pending]) { visibility: hidden !important; }\n:where([data-pui-view-pending], [data-pui-view-revealing]) { transition: none !important; animation: none !important; }\n:where([data-pui-view-detached]) { display: none !important; }\n',
  'proto-ui-wc-host-display': '\n:where(.pui-host-root) { display: block; }\n',
};
const infrastructureHashes = [
  'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
  'sha256-B/uN6mebmNl6Y8KAmaGkix/y4Eiyvq/jCIEHnporMZQ=',
  'sha256-+IRPBUpbuxn0ME6GWUx2UPIkh/vCUT0KS1CXnXBjQAY=',
];
assert.deepEqual(
  ['', ...Object.values(infrastructureStyles)].map((text) => `sha256-${createHash('sha256').update(text).digest('base64')}`),
  infrastructureHashes,
  'review fixed adapter stylesheet content/hash changes explicitly'
);
const contentSecurityPolicy = `default-src 'none'; script-src 'self'; style-src 'self'; style-src-elem 'self' ${infrastructureHashes.map((hash) => `'${hash}'`).join(' ')}; style-src-attr 'none'; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'`;
for (const name of ['proto-ui-style.css', 'shadcn-theme.css', 'proto-ui-tokens.generated.css']) {
  const path = realpathSync(join(consumer, 'src', 'styles', name));
  assert(inside(consumer, path));
  resources.set(`/src/styles/${name}`, { type: 'text/css', body: readFileSync(path) });
}
// Additive browser-realm replay of the unchanged synthetic fixture's sequence.
// Preparation failures are recorded, not allowed to prevent the trusted cases.
let replaySourceSha256 = null;
let originalSyntheticFixtureSha256 = null;
const replayInputs = [];
const replayResources = new Map();
const replayPreparationErrors = [];
try {
  const replaySource = readFileSync(new URL('./wc-checkbox-label-browser-replay.mjs', import.meta.url));
  replaySourceSha256 = digest(replaySource);
  originalSyntheticFixtureSha256 = digest(readFileSync(new URL('./wc-checkbox-label.mjs', import.meta.url)));
  const replayEntry = join(consumer, 'wc-checkbox-label-browser-replay.mjs');
  // Reject a pre-existing symlink that could redirect this consumer-local copy.
  assert(!existsSync(replayEntry) || inside(consumer, realpathSync(replayEntry)), 'replay entry escaped packed consumer');
  writeFileSync(replayEntry, replaySource, { flag: existsSync(replayEntry) ? 'w' : 'wx' });
  assert(inside(consumer, realpathSync(replayEntry)), 'replay entry escaped packed consumer');
  assert.equal(digestFile(replayEntry), replaySourceSha256, 'replay source copy must be verbatim');
  const replayBundle = await esbuild.build({
    absWorkingDir: consumer,
    entryPoints: ['wc-checkbox-label-browser-replay.mjs'],
    outfile: 'checkbox-replay-bundle.js',
    bundle: true,
    platform: 'browser',
    format: 'esm',
    write: false,
    metafile: true,
    logLevel: 'silent',
  });
  assert.equal(replayBundle.outputFiles.length, 1, 'unexpected additional replay bundle output');
  for (const [name, metadata] of Object.entries(replayBundle.metafile.inputs)) {
    const path = realpathSync(resolve(consumer, name));
    assert(inside(consumer, path), `replay business source escaped packed consumer: ${name}`);
    assert(metadata.imports.every((item) => !item.external), 'unexpected external replay input import');
    replayInputs.push({ path: relative(consumer, path).replaceAll('\\', '/'), sha256: digestFile(path) });
  }
  for (const output of Object.values(replayBundle.metafile.outputs)) {
    assert.equal(output.imports.length, 0, 'replay browser bundle must be self-contained');
  }
  replayResources.set('/checkbox-replay', { type: 'text/html', body: Buffer.from('<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><link rel="stylesheet" href="/src/styles/proto-ui-style.css"></head><body><script type="module" src="/checkbox-replay-bundle.js"></script></body></html>') });
  replayResources.set('/checkbox-replay-bundle.js', { type: 'text/javascript', body: Buffer.from(replayBundle.outputFiles[0].contents) });
  for (const name of ['proto-ui-style.css', 'shadcn-theme.css', 'proto-ui-tokens.generated.css']) {
    const path = `/src/styles/${name}`;
    replayResources.set(path, resources.get(path));
  }
  for (const [path, resource] of replayResources) resources.set(path, resource);
} catch (error) {
  replayPreparationErrors.push(error);
}
const failures = [];
failures.push(...orderPreparationErrors);
failures.push(...replayPreparationErrors);
let browser, context, server;
let nativeEvidence, replayEvidence;
console.log(JSON.stringify({
  kind: 'checkbox-label-packed-native-prepared',
  testedCommit: binding.testedCommit,
  packages: binding.packages,
  lockSha256: binding.lockSha256,
  generatedFacadeSha256: binding.generatedFacadeSha256,
  fixtureSha256: digestFile(fileURLToPath(import.meta.url)),
  repoLockSha256: digest(lock),
  tooling,
  infrastructureStyleHashes: infrastructureHashes,
  contentSecurityPolicy,
  browser: { command: chrome, executable: chromeBinary, launcherSha256: digestFile(realpathSync(chrome)), executableSha256: digestFile(chromeBinary), commandVersion: chromeVersion.stdout.trim() },
  runnerImage: { os: process.env.ImageOS ?? null, version: process.env.ImageVersion ?? null },
  inputs,
  replaySourceSha256,
  originalSyntheticFixtureSha256,
  replayInputs,
  resources: [...resources].map(([path, { body }]) => ({ path, sha256: digest(body) })),
  outcome: 'prepared-not-yet-executed',
}));
try {
  server = createServer((request, response) => {
    const resource = request.method === 'GET' ? resources.get(request.url) : undefined;
    if (!resource) {
      failures.push(new Error('unexpected loopback fixture resource request'));
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': resource.type,
      'Content-Security-Policy': contentSecurityPolicy,
      'Cache-Control': 'no-store',
    });
    response.end(resource.body);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    executablePath: chromeBinary,
    headless: true,
    chromiumSandbox: true,
    timeout: 20000,
    args: ['--disable-dev-shm-usage', '--disable-background-networking', '--no-proxy-server'],
  });
  context = await browser.newContext({ serviceWorkers: 'block' });
  context.setDefaultTimeout(10000);
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin && resources.has(url.pathname) && !url.search && !url.hash && route.request().method() === 'GET') {
      await route.continue();
    } else {
      failures.push(new Error('blocked non-test browser request'));
      await route.abort();
    }
  });
  await context.routeWebSocket('**/*', (socket) => {
    failures.push(new Error('blocked unexpected WebSocket'));
    socket.close();
  });
  let orderPage;
  try {
    assert.equal(orderPreparationErrors.length, 0, 'standalone native diagnostic preparation failed');
    orderPage = await context.newPage();
    orderPage.on('pageerror', (error) => failures.push(error));
    orderPage.on('console', (message) => {
      if (message.type() === 'error') failures.push(new Error(`standalone browser console: ${message.text()}`));
    });
    // The diagnostic realm cannot load even the product resources admitted for
    // the independent product page in this same browser context.
    await orderPage.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === origin && orderResources.has(url.pathname) && !url.search && !url.hash && route.request().method() === 'GET') {
        await route.continue();
      } else {
        failures.push(new Error('blocked non-diagnostic order-page request'));
        await route.abort();
      }
    });
    const orderResponse = await orderPage.goto(origin + '/standalone-order', { waitUntil: 'load' });
    assert.equal(orderResponse.status(), 200);
    await orderPage.waitForFunction(() => !!window.standaloneOrder);
    const standaloneOrder = await orderPage.evaluate(() => window.standaloneOrder);
    console.log(JSON.stringify({
      kind: 'standalone-preassembled-custom-element-order',
      host: 'native-chromium',
      productImports: false,
      sharedSourceSha256: digest(orderModule),
      ...standaloneOrder,
    }));
    assert.equal(standaloneOrder.errors.length, 0, 'standalone native diagnostic errors');
    assert.equal(standaloneOrder.observations.length, 2, 'standalone native diagnostic incomplete');
    // Collection success is not a host-admission pass. Original native
    // parent-first assertion and all product assertions remain below.
  } catch (error) {
    failures.push(error);
  } finally {
    try { await orderPage?.close(); } catch (error) { failures.push(error); }
  }
  const page = await context.newPage();
  page.on('pageerror', (error) => failures.push(error));
  page.on('console', (message) => {
    if (message.type() === 'info' && message.text().startsWith('[packed-native]')) console.log(message.text());
    if (message.type() === 'error') failures.push(new Error(`browser console: ${message.text()}`));
  });
  const response = await page.goto(origin, { waitUntil: 'load' });
  assert.equal(response.status(), 200);
  await page.waitForFunction(() => window.packedCheckboxSmoke?.pairs.length === 2);
  const installedStyles = await page.evaluate(() => [...document.querySelectorAll('style')]
    .map((style) => [style.id, style.textContent]));
  assert.equal(installedStyles.length, 2, 'only the two fixed adapter infrastructure styles');
  assert.deepEqual(Object.fromEntries(installedStyles), infrastructureStyles,
    'installed adapter styles must match the exact CSP-admitted text');
  const initial = await page.evaluate(() => ({
    order: window.packedCheckboxSmoke.order,
    pairs: window.packedCheckboxSmoke.pairs.map(({ control, label }) => ({
      indicators: [...control.children].filter((child) => child.localName === 'proto-ui-shadcn-checkbox-indicator').length,
      labelledby: control.getAttribute('aria-labelledby'),
      labelId: label.id,
      ariaLabel: control.getAttribute('aria-label'),
      nestedLabels: control.querySelectorAll('proto-ui-shadcn-label').length,
      controlTokens: (control.getAttribute('data-pui-style') ?? '').split(/\s+/),
      labelTokens: (label.getAttribute('data-pui-style') ?? '').split(/\s+/),
      state: control.getAttribute('aria-checked'),
      labelDisplay: getComputedStyle(label).display,
      controlShrink: getComputedStyle(control).flexShrink,
    })),
  }));
  assert.deepEqual(initial.order, ['parent', 'child']);
  for (const pair of initial.pairs) {
    assert.equal(pair.indicators, 1, 'default and explicit must each have exactly one Indicator');
    assert(pair.labelId);
    assert.equal(pair.labelledby, pair.labelId);
    assert.equal(pair.state, 'false');
    assert.equal(pair.ariaLabel, null, 'no duplicate hidden naming');
    assert.equal(pair.nestedLabels, 0, 'Label stays independent');
    for (const token of ['size-4', 'shrink-0', 'border']) assert(pair.controlTokens.includes(token));
    for (const token of ['flex', 'text-sm', 'font-medium', 'leading-none']) assert(pair.labelTokens.includes(token));
    assert.equal(pair.labelDisplay, 'flex', 'original generated Label CSS must apply');
    assert.equal(pair.controlShrink, '0', 'original generated Checkbox CSS must apply');
  }
  assert.notEqual(initial.pairs[0].labelId, initial.pairs[1].labelId);
  assert.equal(await page.getByRole('checkbox', { name: 'Receive default updates', exact: true }).count(), 1);
  assert.equal(await page.evaluate(() => window.packedCheckboxSmoke.pairs[0].pair.control.instanceAssociations.controlLabel !== window.packedCheckboxSmoke.pairs[1].pair.control.instanceAssociations.controlLabel), true);
  for (const [index, kind] of ['default', 'explicit'].entries()) {
    await page.locator(`[data-case="${kind}"] strong`).click();
    await page.waitForFunction((index) => window.packedCheckboxSmoke.pairs[index].control.getAttribute('aria-checked') === 'true', index);
    let states = await page.evaluate(() => window.packedCheckboxSmoke.pairs.map(({ control, changes }) => ({ state: control.getAttribute('aria-checked'), changes, focused: document.activeElement === control })));
    assert.equal(states[index].changes, 1, 'real Label pointer must activate once');
    assert.equal(states[index].focused, true);
    assert.equal(states[1 - index].state, 'false', 'other composition remains isolated');
    await page.keyboard.press('Space');
    await page.waitForFunction((index) => window.packedCheckboxSmoke.pairs[index].control.getAttribute('aria-checked') === 'false', index);
    states = await page.evaluate(() => window.packedCheckboxSmoke.pairs.map(({ changes }) => changes));
    assert.equal(states[index], 2, 'focused control keyboard must activate once');
  }
  console.log('[packed-native] direct-pointer-and-interactive-descendant');
  const neighborIdentity = await page.evaluate(() => {
    const smoke = window.packedCheckboxSmoke;
    const neighbor = smoke.mount('neighbor');
    return smoke.pairs[0].pair.control.instanceAssociations.controlLabel !== neighbor.pair.control.instanceAssociations.controlLabel;
  });
  assert.equal(neighborIdentity, true, 'two default pairs have independent association identities');
  const defaultControl = page.locator('[data-case="default"] > :first-child');
  await page.locator('[data-case="default"] strong').click();
  await page.waitForFunction(() => window.packedCheckboxSmoke.pairs[0].control.getAttribute('aria-checked') === 'true');
  assert.equal(await page.evaluate(() => window.packedCheckboxSmoke.pairs[0].changes), 3);
  assert.equal(await page.locator('[data-case="neighbor"] > :first-child').getAttribute('aria-checked'), 'false');
  await defaultControl.click();
  await page.waitForFunction(() => window.packedCheckboxSmoke.pairs[0].control.getAttribute('aria-checked') === 'false');
  assert.equal(await page.evaluate(() => window.packedCheckboxSmoke.pairs[0].changes), 4);
  await page.evaluate(() => {
    const action = document.createElement('button');
    action.textContent = 'Separate action';
    const smoke = window.packedCheckboxSmoke;
    smoke.actionClicks = 0;
    action.addEventListener('click', () => smoke.actionClicks++);
    smoke.pairs[0].label.append(action);
  });
  await page.getByRole('button', { name: 'Separate action', exact: true }).click();
  await page.waitForTimeout(50);
  assert.equal(await page.evaluate(() => window.packedCheckboxSmoke.actionClicks), 1,
    'interactive descendant must receive its own actual click exactly once');
  assert.equal(await page.evaluate(() => window.packedCheckboxSmoke.pairs[0].changes), 4,
    'interactive Label descendant must not also activate control');

  console.log('[packed-native] omitted-raw-disabled-controlled-mixed');
  await page.evaluate(() => {
    const { mount } = window.packedCheckboxSmoke;
    mount('omitted', { indicator: 'none' });
    mount('raw', { raw: true });
    mount('disabled', { props: { disabled: true, defaultChecked: true } });
    mount('controlled', { props: { checked: false } });
    mount('mixed', { props: { defaultIndeterminate: true } });
  });
  await page.waitForTimeout(50);
  const variants = await page.evaluate(() => Object.fromEntries(
    window.packedCheckboxSmoke.pairs.map(({ control, container }) => [container.dataset.case, {
      indicators: [...control.children].filter((child) => child.localName === 'proto-ui-shadcn-checkbox-indicator').length,
      checked: control.getAttribute('aria-checked'),
    }])
  ));
  assert.equal(variants.explicit.indicators, 1, 'explicit Indicator still never duplicates');
  assert.equal(variants.omitted.indicators, 0, 'default Indicator omission stays supported');
  assert.equal(variants.raw.indicators, 0, 'raw Root stays raw');
  assert.equal(variants.disabled.checked, 'true');
  assert.equal(variants.controlled.checked, 'false');
  assert.equal(variants.mixed.checked, 'mixed');
  for (const kind of ['disabled', 'controlled', 'mixed']) {
    await page.locator(`[data-case="${kind}"] strong`).click();
  }
  await page.waitForTimeout(50);
  const afterRequests = await page.evaluate(() => Object.fromEntries(
    window.packedCheckboxSmoke.pairs.map(({ control, container, changes }) => [container.dataset.case, {
      changes, checked: control.getAttribute('aria-checked'),
    }])
  ));
  assert.equal(afterRequests.disabled.changes, 0);
  assert.equal(afterRequests.disabled.checked, 'true');
  assert.equal(afterRequests.controlled.changes, 1);
  assert.equal(afterRequests.controlled.checked, 'false', 'controlled acceptance stays consumer-owned');
  assert.equal(afterRequests.mixed.checked, 'true');

  console.log('[packed-native] naming-only');
  await page.evaluate(() => {
    const smoke = window.packedCheckboxSmoke;
    const controlled = smoke.pairs.find(({ container }) => container.dataset.case === 'controlled');
    smoke.setLabelProps(controlled.label, { naming: true, activation: false });
  });
  await page.waitForTimeout(50);
  await page.locator('[data-case="controlled"] strong').click();
  await page.waitForTimeout(50);
  const namingOnly = await page.evaluate(() => {
    const { control, label, changes } = window.packedCheckboxSmoke.pairs.find(({ container }) => container.dataset.case === 'controlled');
    return { changes, labelledby: control.getAttribute('aria-labelledby'), labelId: label.id };
  });
  assert.equal(namingOnly.changes, 1, 'naming-only Label must not activate');
  assert.equal(namingOnly.labelledby, namingOnly.labelId);

  console.log('[packed-native] detached-label-programmatic-regression');
  await page.evaluate(() => window.packedCheckboxSmoke.pairs[0].label.remove());
  await page.waitForTimeout(50);
  // Detached nodes cannot receive real user pointers. Preserve the original
  // programmatic lifecycle regression in a native browser; do not call it a
  // native-pointer or full subscription/resource-release assertion.
  await page.evaluate(() => {
    const label = window.packedCheckboxSmoke.pairs[0].label;
    label.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 1, button: 0 }));
    label.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 1, button: 0 }));
    label.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, button: 0, detail: 1 }));
  });
  await page.waitForTimeout(50);
  assert.equal(await page.evaluate(() => window.packedCheckboxSmoke.pairs[0].changes), 4,
    'detached Label must not activate its former control');
  console.log('[packed-native] cleanup');
  await page.evaluate(() => {
    for (const { container } of window.packedCheckboxSmoke.pairs) container.remove();
  });
  await page.waitForTimeout(50); // allow asynchronous disposal errors to surface
  assert.equal(await page.locator('[data-case]').count(), 0);
  if (failures.length) throw new AggregateError(failures.splice(0), 'native page/network errors');
  nativeEvidence = {
    kind: 'checkbox-label-packed-native-evidence',
    testedCommit: binding.testedCommit,
    releaseVersion: binding.releaseVersion,
    packages: binding.packages,
    lockSha256: binding.lockSha256,
    generatedFacadeSha256: binding.generatedFacadeSha256,
    fixtureSha256: digestFile(fileURLToPath(import.meta.url)),
    repoLockSha256: digest(lock),
    tooling,
    browser: { executable: chromeBinary, executableSha256: digestFile(chromeBinary), commandVersion: chromeVersion.stdout.trim(), version: browser.version() },
    runnerImage: { os: process.env.ImageOS ?? null, version: process.env.ImageVersion ?? null },
    inputs,
    replaySourceSha256,
    originalSyntheticFixtureSha256,
    replayInputs,
    resources: [...resources].map(([path, { body }]) => ({ path, sha256: digest(body) })),
    platformOrder: initial.order,
    infrastructureStyleHashes: infrastructureHashes,
    outcome: 'bounded-wc-composition-contract-cases-passed',
    coveredCases: ['default', 'preassembled-explicit', 'rich-label-naming', 'label-pointer',
      'direct-pointer', 'focused-space', 'interactive-descendant-exclusion', 'pair-isolation',
      'omitted-indicator', 'raw-root', 'disabled', 'controlled-rejection', 'mixed',
      'naming-only', 'detached-label-programmatic-regression', 'removal-without-observed-pageerror'],
    syntheticAcceptance: 'separate-observed-fixture-host-policy',
    registryPublication: 'not-performed',
  };
} catch (error) {
  failures.push(error);
} finally {
  // Replay is deliberately in finally: an earlier trusted-pointer assertion
  // failure must not suppress the independent original-sequence observation.
  let replayPage;
  let replayResult = { checkpoints: [], outcome: 'failed', failureStage: 'imports-start', error: null, cleanupError: null };
  let replayRunnerError = null;
  let replayInstalledStyles = null;
  const replayFailureStart = failures.length;
  try {
    assert.equal(replayPreparationErrors.length, 0, 'browser replay preparation failed');
    assert(context && server?.listening, 'browser replay context unavailable');
    const replayOrigin = `http://127.0.0.1:${server.address().port}`;
    replayPage = await context.newPage();
    replayPage.on('pageerror', (error) => failures.push(error));
    replayPage.on('console', (message) => {
      if (message.type() === 'error') failures.push(new Error(`replay browser console: ${message.text()}`));
    });
    replayPage.on('requestfailed', (request) => failures.push(new Error(`replay browser request failed: ${request.failure()?.errorText ?? 'unknown'}`)));
    replayPage.on('response', (response) => {
      if (response.status() >= 400) failures.push(new Error(`replay browser HTTP ${response.status()}`));
    });
    // A page-specific route replaces the broader context resource allowlist.
    await replayPage.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === replayOrigin && replayResources.has(url.pathname) && !url.search && !url.hash && route.request().method() === 'GET') {
        await route.continue();
      } else {
        failures.push(new Error('blocked non-replay page request'));
        await route.abort();
      }
    });
    const replayResponse = await replayPage.goto(replayOrigin + '/checkbox-replay', { waitUntil: 'load' });
    assert.equal(replayResponse.status(), 200);
    await replayPage.waitForFunction(() => !!window.packedCheckboxReplay);
    replayResult = await replayPage.evaluate(() => window.packedCheckboxReplay);
    // The helper serializes only after body cleanup; infrastructure styles must
    // still be in head with exactly the CSP-admitted installed adapter bytes.
    replayInstalledStyles = await replayPage.evaluate(() => [...document.querySelectorAll('style')]
      .map((style) => ({ id: style.id, text: style.textContent, inHead: style.parentElement === document.head })));
    assert.equal(replayInstalledStyles.length, 2, 'replay keeps only the two fixed infrastructure styles');
    assert(replayInstalledStyles.every((style) => style.inHead), 'replay infrastructure styles remain in head after cleanup');
    assert.deepEqual(Object.fromEntries(replayInstalledStyles.map(({ id, text }) => [id, text])), infrastructureStyles,
      'replay installed adapter styles must match exact CSP-admitted text after cleanup');
    assert.equal(await replayPage.evaluate(() => document.body.childElementCount), 0, 'replay body cleanup completed');
    assert.equal(replayResult.outcome, 'passed', `browser replay failed at ${replayResult.failureStage}: ${JSON.stringify(replayResult.error)}`);
    assert.equal(replayResult.cleanupError, null, 'browser replay cleanup failed');
  } catch (error) {
    replayRunnerError = { name: error.name, message: error.message, stack: error.stack ?? null };
    failures.push(error);
  } finally {
    try { await replayPage?.close(); } catch (error) {
      failures.push(error);
      replayRunnerError ??= { name: error.name, message: error.message, stack: error.stack ?? null };
    }
    replayEvidence = {
      kind: 'checkbox-label-packed-browser-replay-evidence',
      host: 'native-chromium',
      eventMode: 'original-programmatic-dispatch-not-trusted-pointer',
      testedCommit: binding.testedCommit,
      releaseVersion: binding.releaseVersion,
      packages: binding.packages,
      lockSha256: binding.lockSha256,
      generatedFacadeSha256: binding.generatedFacadeSha256,
      fixtureSha256: digestFile(fileURLToPath(import.meta.url)),
      replaySourceSha256,
      originalSyntheticFixtureSha256,
      repoLockSha256: digest(lock),
      tooling,
      inputs: replayInputs,
      resources: [...replayResources].map(([path, { body }]) => ({ path, sha256: digest(body) })),
      browser: { executable: chromeBinary, executableSha256: digestFile(chromeBinary), commandVersion: chromeVersion.stdout.trim(), version: browser?.version() ?? null },
      infrastructureStyleHashes: infrastructureHashes,
      installedStylesAfterCleanup: replayInstalledStyles,
      ...replayResult,
      outcome: replayRunnerError || failures.length > replayFailureStart ? 'failed' : replayResult.outcome,
      runnerError: replayRunnerError,
      observedPageNetworkErrorCount: failures.length - replayFailureStart,
      syntheticAcceptance: 'separate-observed-fixture-host-policy',
      registryPublication: 'not-performed',
    };
    console.log(JSON.stringify(replayEvidence));
  }
  for (const close of [() => context?.close(), () => browser?.close(), () => server && new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  })]) {
    try { await close(); } catch (error) { failures.push(error); }
  }
}
if (failures.length) throw new AggregateError(failures, 'packed native Checkbox+Label failed');

console.log(JSON.stringify(nativeEvidence));

// Terminal receipt exists only after both real browser paths and all cleanup pass.
writeFileSync(join(consumer, 'checkbox-label-native-receipt.json'), JSON.stringify({
  kind: 'checkbox-label-native-process-receipt', version: 1, final: true,
  native: nativeEvidence, replay: replayEvidence,
}));
