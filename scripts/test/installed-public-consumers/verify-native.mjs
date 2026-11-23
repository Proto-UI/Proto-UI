// Native assertions and owned server lifecycle retained from recovered
// c8a5cf evidence/verify-native.mjs; Select and the old-CLI control are separate.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
  realpathSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeNativeResources } from './native-cleanup.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OLD_CLI_SHA256 = '0dd1537bdb151fa6f265df07c1ba35cef37adc20b7e2e7c69e7e0f2e60b7af9d';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourceState = (repository) =>
  Object.fromEntries(
    Object.entries({
      head: ['rev-parse', 'HEAD'],
      tree: ['rev-parse', 'HEAD^{tree}'],
      status: ['status', '--porcelain=v1', '--untracked-files=all'],
    }).map(([key, args]) => [
      key,
      execFileSync('git', args, { cwd: repository, encoding: 'utf8' }).trim(),
    ])
  );

export function expectedConsumers(group) {
  if (group === 'tooltip')
    return ['wc', 'react', 'vue', 'vue2'].flatMap((host) =>
      ['base', 'shadcn', 'brutalist'].map((family) => ({ family, host }))
    );
  if (group === 'select')
    return ['wc', 'react', 'vue', 'vue2'].map((host) => ({ family: 'base', host }));
  if (group === 'old-cli') return [{ family: 'shadcn', host: 'react' }];
  throw new Error('Unknown installed public consumer group: ' + group);
}

function ownedFile(root, name) {
  assert.equal(typeof name, 'string');
  assert(
    name &&
      !isAbsolute(name) &&
      name.split('/').every((part) => part && part !== '.' && part !== '..'),
    'invalid artifact path'
  );
  let target = root;
  for (const part of name.split('/')) {
    target = join(target, part);
    assert(!lstatSync(target).isSymbolicLink(), 'artifact path contains a symlink');
  }
  assert(lstatSync(target).isFile(), 'artifact must be a regular file');
  const local = relative(realpathSync(root), realpathSync(target));
  assert(
    local && !local.startsWith('../') && !isAbsolute(local),
    'artifact escapes its owned root'
  );
  return target;
}

function readJson(root, name) {
  return JSON.parse(readFileSync(ownedFile(root, name), 'utf8'));
}

function inventory(root, prefix = '') {
  const result = [];
  for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
    const name = prefix ? prefix + '/' + entry.name : entry.name;
    assert(!entry.isSymbolicLink(), 'unexpected symlink in built artifacts');
    if (entry.isDirectory()) result.push(...inventory(root, name));
    else {
      assert(entry.isFile());
      result.push(name);
    }
  }
  return result.sort();
}

export function validatePreparedConsumers(consumers, repository, group, candidate) {
  const expected = expectedConsumers(group);
  const executionBytes = readFileSync(ownedFile(consumers, 'execution.json'));
  const execution = JSON.parse(executionBytes);
  assert.equal(execution.status, 'passed', 'preparation aggregate must have passed');
  assert.equal(execution.group, group, 'preparation group differs from native scope');
  assert.deepEqual(
    execution.rows.map(({ family, host }) => ({ family, host })),
    expected,
    'prepared set differs from the exact native scope'
  );
  assert(
    execution.rows.every((row) => row.status === 'passed'),
    'every prepared row must have passed'
  );
  assert.equal(execution.schemaVersion, 2);
  const bindingBytes = readFileSync(ownedFile(consumers, 'pack-binding.json'));
  assert.equal(
    digest(bindingBytes),
    execution.packBindingSha256,
    'preparation pack binding changed'
  );
  const binding = JSON.parse(bindingBytes);
  assert.deepEqual(binding, execution.packBindingAfter, 'pack binding drifted during preparation');
  assert.deepEqual(
    execution.fullSourceBefore,
    execution.fullSourceAfter,
    'authored source changed during preparation'
  );
  assert.deepEqual(binding.source, execution.fullSourceAfter, 'pack and authored source differ');
  assert.equal(execution.sourceHead, candidate, 'prepared source differs from requested candidate');
  assert.equal(binding.source.head, candidate);
  assert.equal(binding.source.status, '', 'candidate must remain clean');
  assert.deepEqual(
    sourceState(repository),
    binding.source,
    'candidate head/tree/status drifted before native run'
  );
  for (const item of execution.sourceFiles) {
    assert.equal(
      digest(readFileSync(ownedFile(repository, item.path))),
      item.sha256,
      'authored generator changed'
    );
  }
  const evidence = dirname(consumers);
  const authoredBytes = readFileSync(ownedFile(evidence, 'authored-files.json'));
  assert.equal(
    digest(authoredBytes),
    execution.authoredFilesSha256,
    'extracted public source changed'
  );
  const authored = JSON.parse(authoredBytes);
  assert.deepEqual(authored.sourceFiles, execution.sourceFiles);
  const packReceiptBytes = readFileSync(ownedFile(evidence, 'pack-execution.json'));
  assert.equal(digest(packReceiptBytes), binding.packReceiptSha256);
  const packReceipt = JSON.parse(packReceiptBytes);
  assert.equal(packReceipt.status, 'passed');
  assert.equal(packReceipt.exitCode, 0);
  assert.deepEqual(packReceipt.sourceBefore, binding.source);
  assert.deepEqual(packReceipt.sourceAfter, binding.source);
  const pack = join(evidence, 'packed-release');
  const manifestBytes = readFileSync(ownedFile(pack, 'pack-manifest.json'));
  assert.equal(digest(manifestBytes), binding.packManifestSha256);
  assert.equal(digest(manifestBytes), packReceipt.packManifestSha256);
  const manifest = JSON.parse(manifestBytes);
  assert.deepEqual(
    manifest.packages.map((item) => item.name).sort(),
    [...packReceipt.scope].sort()
  );
  assert.deepEqual(Object.keys(binding.packages).sort(), [...packReceipt.scope].sort());
  assert.equal(new Set(packReceipt.scope).size, packReceipt.scope.length);
  for (const entry of manifest.packages) {
    const artifact = binding.packages[entry.name];
    const path = ownedFile(pack, entry.tarball);
    const bytes = readFileSync(path);
    assert.equal(realpathSync(artifact.path), realpathSync(path));
    assert.equal(bytes.length, artifact.bytes);
    assert.equal(digest(bytes), artifact.sha256, 'packed bytes changed before native run');
    assert.equal('sha512-' + createHash('sha512').update(bytes).digest('base64'), entry.integrity);
    assert.equal(createHash('sha1').update(bytes).digest('hex'), entry.shasum);
  }
  const packages = { ...binding.packages };
  if (group === 'old-cli') {
    assert.equal(
      execution.packageOverrides?.length,
      1,
      'old-CLI control must replace exactly one package'
    );
    const old = execution.packageOverrides[0];
    assert.equal(old.sourceHead, '830287f95959a4a1a4fb797df68b0bd6889e0bae');
    assert.equal(old.artifact.manifest.name, '@proto.ui/cli');
    assert.equal(old.artifact.sha256, OLD_CLI_SHA256);
    assert.notEqual(
      old.artifact.sha256,
      binding.packages['@proto.ui/cli'].sha256,
      'control CLI must differ from the candidate CLI'
    );
    const oldPath = ownedFile(evidence, 'old-cli.tgz');
    assert.equal(realpathSync(old.artifact.path), realpathSync(oldPath));
    assert.equal(digest(readFileSync(oldPath)), OLD_CLI_SHA256);
    packages['@proto.ui/cli'] = old.artifact;
  } else {
    assert.deepEqual(
      execution.packageOverrides,
      [],
      'positive group cannot substitute historical packages'
    );
  }
  assert.equal(execution.buildDriverSha256, digest(readFileSync(join(HERE, 'build-consumer.mjs'))));
  for (const row of execution.rows) {
    const app = join(consumers, row.family + '-' + row.host);
    assert.deepEqual(
      row.authoredFiles,
      row.authoredFilesAfter,
      'public App changed during preparation'
    );
    const displayed =
      group === 'select'
        ? [
            {
              name:
                row.host === 'wc'
                  ? 'index.html'
                  : row.host === 'react'
                    ? 'src/App.tsx'
                    : 'src/App.vue',
              code: authored.select[row.host]['demo-base-select'],
            },
          ]
        : authored.tooltip[row.family][row.host];
    assert.deepEqual(
      row.authoredFiles,
      displayed.map((item) => ({ path: item.name, sha256: digest(Buffer.from(item.code + '\n')) })),
      'prepared App differs from the extracted public Usage'
    );
    for (const item of [...row.authoredFiles, row.entry, ...row.generatedFiles]) {
      assert.equal(
        digest(readFileSync(ownedFile(app, item.path))),
        item.sha256,
        'prepared application source changed'
      );
    }
    assert.equal(digest(readFileSync(ownedFile(app, 'build.mjs'))), execution.buildDriverSha256);
    assert.equal(digest(readFileSync(ownedFile(app, 'package-lock.json'))), row.lockSha256);
    const stepNames =
      group === 'select' ? ['install', 'init', 'build'] : ['install', 'init', 'add', 'build'];
    assert.deepEqual(
      row.steps.map((step) => step.name),
      stepNames
    );
    for (const step of row.steps) {
      assert.equal(step.status, 'passed');
      const negative = step.name === 'add' && row.family !== 'shadcn';
      assert.equal(step.expectedRejection, negative);
      assert.equal(step.timeout, false);
      assert.equal(step.interrupted, false);
      assert.equal(step.signal, null);
      assert.equal(step.cleanupFailure, null);
      if (negative) assert.equal(step.exitCode, 1);
      else assert.equal(step.exitCode, 0);
      assert.equal(digest(readFileSync(ownedFile(app, step.name + '.log'))), step.logSha256);
    }
    assert.deepEqual(row.installedArtifactsBefore, row.installedArtifactsAfter);
    assert.deepEqual(
      Object.keys(row.installedPackageSha256).sort(),
      [...row.selectedPackages].sort()
    );
    assert.equal(new Set(row.selectedPackages).size, row.selectedPackages.length);
    const installedNames = readdirSync(join(app, 'node_modules/@proto.ui'))
      .map((name) => '@proto.ui/' + name)
      .sort();
    assert.deepEqual(installedNames, [...row.selectedPackages].sort());
    for (const name of row.selectedPackages) {
      assert(packages[name], 'unknown installed internal package');
      assert.equal(row.installedPackageSha256[name], packages[name].sha256);
      const root = join(app, 'node_modules', name);
      assert(!lstatSync(root).isSymbolicLink(), 'installed package links to a workspace');
      for (const [path, checksum] of Object.entries(packages[name].files)) {
        assert.equal(
          digest(readFileSync(ownedFile(root, path))),
          checksum,
          'installed package bytes changed'
        );
      }
    }
    assert.deepEqual(
      inventory(join(app, 'dist')).map((name) => 'dist/' + name),
      row.outputs.map((item) => item.path).sort(),
      'built output inventory changed'
    );
    for (const required of ['dist/index.html', 'dist/app.js', 'dist/app.css']) {
      assert(
        row.outputs.some((item) => item.path === required),
        'missing browser build artifact: ' + required
      );
    }
    for (const item of row.outputs) {
      const bytes = readFileSync(ownedFile(app, item.path));
      assert.equal(bytes.length, item.bytes);
      assert.equal(digest(bytes), item.sha256, 'built bytes changed after preparation');
    }
  }
  return { execution, binding, installationReceiptSha256: digest(executionBytes) };
}

export function assertServedArtifacts(responses, execution) {
  assert(Array.isArray(responses), 'native served-output records are missing');
  const artifacts = new Map(
    execution.rows.flatMap((row) =>
      row.outputs.map((item) => ['/' + row.family + '-' + row.host + '/' + item.path, item])
    )
  );
  for (const response of responses) {
    assert(!response.failure, 'native server retained a failed response');
    const artifact = artifacts.get(response.path);
    assert(artifact, 'native server reported an unknown artifact');
    assert.equal(response.sha256, artifact.sha256, 'served-output hash differs from preparation');
    assert.equal(response.bytes, artifact.bytes, 'served-output size differs from preparation');
  }
  for (const row of execution.rows) {
    for (const name of ['index.html', 'app.js', 'app.css']) {
      const path = '/' + row.family + '-' + row.host + '/dist/' + name;
      assert(
        responses.some((response) => response.path === path),
        'missing actual served output: ' + path
      );
    }
  }
}

export function assertBodyPortal(portal) {
  assert.equal(portal.contentConnected, true);
  assert.equal(portal.inBody, true);
  assert.equal(
    portal.insideApp,
    false,
    'Content must actually leave the authored app through its body portal'
  );
}

export function assertOldCliCounterfactual(portal, accessibility) {
  // Reject setup failures: first establish the actual connected description.
  assert.equal(portal.contentConnected, true);
  assert.equal(portal.inBody, true);
  assert.equal(accessibility.ignored, false);
  assert.equal(accessibility.description, 'View account settings and profile details.');
  assert.throws(
    () => assertBodyPortal(portal),
    (error) =>
      error instanceof assert.AssertionError &&
      error.actual === true &&
      error.expected === false &&
      /Content must actually leave/.test(error.message),
    'old CLI must exhibit the original body-portal ownership defect'
  );
  return {
    assertion: 'body-portal-outside-authored-app',
    observedProductOutcome: 'rejected',
    expected: true,
  };
}

async function until(check, expected, message) {
  const deadline = Date.now() + 5000;
  let actual;
  do {
    actual = await check();
    if (actual === expected) return actual;
    await new Promise((resolve) => setTimeout(resolve, 30));
  } while (Date.now() < deadline);
  assert.equal(actual, expected, message);
}

async function ax(page) {
  const session = await page.context().newCDPSession(page);
  try {
    const { result } = await session.send('Runtime.evaluate', {
      expression: 'document.activeElement',
    });
    assert(result.objectId, 'focused subject object missing');
    const { nodes } = await session.send('Accessibility.getPartialAXTree', {
      objectId: result.objectId,
      fetchRelatives: false,
    });
    assert.equal(nodes.length, 1, 'expected one actual AX subject');
    return {
      ignored: nodes[0].ignored,
      role: nodes[0].role?.value ?? '',
      name: nodes[0].name?.value ?? '',
      description: nodes[0].description?.value ?? '',
    };
  } finally {
    await session.detach();
  }
}

async function disposeApp(page, host, marker) {
  await page.evaluate(
    ({ host, marker }) => {
      if (host === 'wc')
        document.querySelector('[data-' + marker + '-public-app]').replaceChildren();
      else {
        if (typeof window.disposePublicConsumer !== 'function')
          throw new Error('Actual framework unmount function missing');
        window.disposePublicConsumer();
      }
    },
    { host, marker }
  );
}

async function tooltipCase(page, row, group, screenshot) {
  const triggers = page.locator('.tooltip-example-trigger');
  await until(() => triggers.count(), 2, 'two real public Trigger instances');
  await until(() => page.getByRole('tooltip').count(), 0, 'initially closed');
  await page.keyboard.press('Tab');
  await until(
    () => triggers.nth(0).evaluate((element) => document.activeElement === element),
    true,
    'native Tab focuses Account'
  );
  await until(
    () =>
      page
        .getByRole('tooltip')
        .allTextContents()
        .then((text) => (text.length === 1 ? text[0] : '')),
    'View account settings and profile details.',
    'first focused Tooltip opens'
  );
  const portal = await page.getByRole('tooltip').evaluate((content) => ({
    contentConnected: content.isConnected,
    inBody: document.body.contains(content),
    insideApp: document.querySelector('[data-tooltip-public-app]').contains(content),
    portalMount: !!content.closest('[data-pui-portal-mount]'),
  }));
  const first = await ax(page);
  assert.equal(first.ignored, false);
  assert.equal(first.description, 'View account settings and profile details.');
  row.observations.push({
    stage: 'actual native focus and description before ownership assertion',
    portal,
    ax: first,
  });
  if (group === 'old-cli') row.expectedRejection = assertOldCliCounterfactual(portal, first);
  else assertBodyPortal(portal);
  row.observations.push({ stage: 'first native focus/body portal', portal, ax: first });
  await screenshot('open');
  await page.keyboard.press('Tab');
  await until(
    () => triggers.nth(1).evaluate((element) => document.activeElement === element),
    true,
    'native Tab focuses Notifications'
  );
  await until(
    () =>
      page
        .getByRole('tooltip')
        .allTextContents()
        .then((text) => (text.length === 1 ? text[0] : '')),
    'Review recent alerts and notification preferences.',
    'second public Tooltip opens'
  );
  assert.equal(await page.getByRole('tooltip').count(), 1);
  const second = await ax(page);
  assert.equal(second.description, 'Review recent alerts and notification preferences.');
  row.observations.push({ stage: 'native sibling Tab', ax: second });
  await page.keyboard.press('Escape');
  await until(() => page.getByRole('tooltip').count(), 0, 'Escape closes');
  assert.equal(
    await triggers.nth(1).evaluate((element) => document.activeElement === element),
    true
  );
  assert.equal(await triggers.nth(1).getAttribute('aria-describedby'), null);
  const closed = await ax(page);
  assert.equal(closed.description, '');
  row.observations.push({ stage: 'Escape retains focus', ax: closed });
  await screenshot('closed');
  await page.keyboard.press('Shift+Tab');
  await until(
    () =>
      page
        .getByRole('tooltip')
        .allTextContents()
        .then((text) => (text.length === 1 ? text[0] : '')),
    'View account settings and profile details.',
    'reopen before owner disposal'
  );
  const retired = await triggers.nth(0).elementHandle();
  assert(retired);
  await disposeApp(page, row.host, 'tooltip');
  await until(
    () => retired.evaluate((element) => element.isConnected),
    false,
    'old trigger retired'
  );
  await until(() => page.locator('[role="tooltip"]').count(), 0, 'all Content nodes retired');
  await until(() => page.locator('[data-pui-portal-mount]').count(), 0, 'portal mounts retired');
  await retired.dispose();
  row.observations.push({
    stage: 'actual framework unmount',
    staleTriggerConnected: false,
    remainingTooltipNodes: 0,
    remainingPortalMounts: 0,
  });
}

export async function assertSelectCommit(root, value) {
  await until(() => root.getAttribute('data-value'), 'vue', 'native Enter commits Vue');
  assert.equal(await root.getAttribute('data-text-value'), 'Vue');
  // Root attributes may commit before the framework's rendered child text.
  // Observe the same public value through the existing bounded polling owner.
  await until(() => value.textContent(), 'Vue', 'native committed value is displayed');
  assert.equal(await root.getAttribute('data-value'), 'vue');
  assert.equal(await root.getAttribute('data-text-value'), 'Vue');
}

async function selectCase(page, row, screenshot) {
  const trigger = page.getByRole('combobox', { name: 'Framework selector', exact: true });
  await until(() => trigger.count(), 1, 'one actual accessible public Select trigger');
  const app = page.locator('[data-select-public-app]');
  const root = app.locator('[data-pui-root][data-value][data-text-value]');
  const value = app.locator('[data-pui-root][data-display-value]');
  assert.equal(await value.textContent(), 'Pick a framework');
  assert.equal(await root.getAttribute('data-value'), '');
  await page.keyboard.press('Tab');
  assert.equal(await trigger.evaluate((element) => document.activeElement === element), true);
  const initialAx = await ax(page);
  assert.equal(initialAx.ignored, false);
  assert.equal(initialAx.role, 'combobox');
  assert.equal(initialAx.name, 'Framework selector');
  await page.keyboard.press('Enter');
  await until(() => trigger.getAttribute('aria-expanded'), 'true', 'native Enter opens Select');
  const contentId = await trigger.getAttribute('aria-controls');
  assert(contentId);
  const content = page.getByRole('listbox');
  await until(() => content.count(), 1, 'one connected listbox');
  assert.equal(await content.getAttribute('id'), contentId);
  const portal = await content.evaluate((element) => ({
    contentConnected: element.isConnected,
    inBody: document.body.contains(element),
    insideApp: document.querySelector('[data-select-public-app]').contains(element),
  }));
  assertBodyPortal(portal);
  const options = content.getByRole('option');
  assert.deepEqual(await options.allTextContents(), ['React', 'Vue', 'Web Components']);
  await until(
    () => options.nth(0).evaluate((element) => document.activeElement === element),
    true,
    'first option receives native focus'
  );
  await page.keyboard.press('ArrowDown');
  await until(
    () => options.nth(1).evaluate((element) => document.activeElement === element),
    true,
    'native ArrowDown moves to Vue'
  );
  assert.equal(await root.getAttribute('data-value'), '', 'focus movement does not commit');
  await screenshot('open');
  await page.keyboard.press('Enter');
  await assertSelectCommit(root, value);
  await until(() => trigger.getAttribute('aria-expanded'), 'false', 'commit closes Select');
  await until(
    () => trigger.evaluate((element) => document.activeElement === element),
    true,
    'commit restores trigger focus'
  );
  assert.equal(await trigger.getAttribute('aria-label'), 'Framework selector');
  row.observations.push({
    stage: 'native commit and restored focus',
    initialAx,
    portal,
    value: 'vue',
    textValue: 'Vue',
  });
  await page.keyboard.press('Enter');
  await until(() => trigger.getAttribute('aria-expanded'), 'true', 'reopen the selected value');
  await until(
    () =>
      content
        .getByRole('option', { name: 'Vue', exact: true })
        .evaluate((element) => document.activeElement === element),
    true,
    'selected option receives focus on reopen'
  );
  await page.keyboard.press('Escape');
  await until(() => trigger.getAttribute('aria-expanded'), 'false', 'Escape closes Select');
  await until(
    () => trigger.evaluate((element) => document.activeElement === element),
    true,
    'Escape keeps trigger focus'
  );
  assert.equal(await root.getAttribute('data-value'), 'vue');
  await screenshot('closed');
  await page.keyboard.press('Enter');
  await until(
    () => trigger.getAttribute('aria-expanded'),
    'true',
    'reopen before owner retirement'
  );
  await until(() => content.count(), 1, 'open Content is connected before unmount');
  const retiredContent = await content.elementHandle();
  const retiredTrigger = await trigger.elementHandle();
  assert(retiredContent && retiredTrigger);
  await disposeApp(page, row.host, 'select');
  await until(
    () => retiredTrigger.evaluate((element) => element.isConnected),
    false,
    'actual trigger retired'
  );
  await until(
    () => retiredContent.evaluate((element) => element.isConnected),
    false,
    'actual listbox retired'
  );
  await until(() => page.getByRole('listbox').count(), 0, 'no orphaned listbox');
  await until(() => page.locator('[data-pui-portal-mount]').count(), 0, 'no orphaned portal mount');
  await retiredContent.dispose();
  await retiredTrigger.dispose();
  row.observations.push({
    stage: 'actual framework unmount',
    remainingListboxes: 0,
    remainingPortalMounts: 0,
  });
}

export async function runNative(
  consumersArgument,
  repositoryArgument,
  outputArgument,
  group,
  candidate
) {
  const expected = expectedConsumers(group);
  assert(/^[0-9a-f]{40}$/.test(candidate), 'full candidate SHA required');
  const consumers = realpathSync(consumersArgument);
  const repository = realpathSync(repositoryArgument);
  const output = resolve(outputArgument);
  assert(!existsSync(output), 'refuse to replace earlier native evidence');
  mkdirSync(output, { recursive: true });
  const report = {
    schemaVersion: 2,
    kind:
      group === 'old-cli'
        ? 'installed-tooltip-old-cli-native-control'
        : 'installed-public-usage-native',
    group,
    candidate,
    startedAt: new Date().toISOString(),
    node: process.version,
    scope:
      group === 'old-cli'
        ? 'Current public App and current packages except the original 830287 CLI tarball; expected ownership rejection, not an all-current or all-historical product pass.'
        : 'Real Chromium on installed public application files; not physical OS assistive technology or actual Shenko adoption.',
    browser: null,
    chromiumSandbox: true,
    status: 'running',
    browserStarted: false,
    rows: expected.map(({ family, host }) => ({
      family,
      host,
      status: 'not-run',
      observations: [],
      pageErrors: [],
      consoleErrors: [],
      captures: [],
    })),
  };
  const save = () =>
    writeFileSync(join(output, 'native.json'), JSON.stringify(report, null, 2) + '\n');
  save();
  let browser;
  let server;
  let prepared;
  const responses = [];
  try {
    prepared = validatePreparedConsumers(consumers, repository, group, candidate);
    report.installationReceiptSha256 = prepared.installationReceiptSha256;
    report.preparedSource = prepared.execution.fullSourceAfter;
    report.packBindingSha256 = prepared.execution.packBindingSha256;
    report.packageOverrides = prepared.execution.packageOverrides;
    const require = createRequire(join(repository, 'apps/www/package.json'));
    const { chromium } = require('playwright-core');
    server = createServer((request, response) => {
      try {
        const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
        const local = pathname.replace(/^\/+/, '');
        const row = prepared.execution.rows.find((item) =>
          local.startsWith(item.family + '-' + item.host + '/dist/')
        );
        assert(row, 'not a consumer build artifact');
        const artifact = row.outputs.find(
          (item) => row.family + '-' + row.host + '/' + item.path === local
        );
        assert(artifact, 'unrecorded served file');
        const file = ownedFile(consumers, local);
        const bytes = readFileSync(file);
        assert.equal(digest(bytes), artifact.sha256, 'served bytes changed after build');
        const type = file.endsWith('.css')
          ? 'text/css'
          : file.endsWith('.js')
            ? 'text/javascript'
            : file.endsWith('.html')
              ? 'text/html'
              : 'application/json';
        responses.push({ path: pathname, sha256: artifact.sha256, bytes: bytes.length });
        response.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
        response.end(bytes);
      } catch (error) {
        responses.push({ path: request.url, failure: String(error) });
        response.writeHead(404);
        response.end('unavailable');
      }
    });
    await new Promise((accept, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', accept);
    });
    report.server = { address: '127.0.0.1', port: server.address().port, owned: true };
    assert(process.env.CHROME_PATH, 'CHROME_PATH must identify the installed browser');
    browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH,
      headless: true,
      chromiumSandbox: true,
    });
    report.browser = browser.version();
    report.browserStarted = true;
    save();
    for (const row of report.rows) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      page.on('pageerror', (error) => row.pageErrors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') row.consoleErrors.push(message.text());
      });
      const screenshot = async (stage) => {
        const name = row.family + '-' + row.host + '-' + stage + '.png';
        await page.screenshot({ path: join(output, name) });
        const bytes = readFileSync(ownedFile(output, name));
        assert.equal(
          bytes.subarray(0, 8).toString('hex'),
          '89504e470d0a1a0a',
          'capture must be a real PNG'
        );
        row.captures.push({ path: name, sha256: digest(bytes), bytes: bytes.length });
      };
      try {
        await page.goto(
          'http://127.0.0.1:' +
            report.server.port +
            '/' +
            row.family +
            '-' +
            row.host +
            '/dist/index.html',
          { waitUntil: 'networkidle' }
        );
        if (group === 'select') await selectCase(page, row, screenshot);
        else await tooltipCase(page, row, group, screenshot);
        assert.deepEqual(row.pageErrors, []);
        assert.deepEqual(row.consoleErrors, []);
        assert.deepEqual(
          row.captures.map((item) => item.path),
          ['open', 'closed'].map((stage) => row.family + '-' + row.host + '-' + stage + '.png')
        );
        row.status = 'passed';
      } catch (error) {
        row.status = 'failed';
        row.failure = error.stack ?? String(error);
        await screenshot('failure').catch((captureError) => {
          row.captureFailure = String(captureError);
        });
      } finally {
        try {
          await context.close();
        } catch (error) {
          row.status = 'failed';
          row.cleanupFailure = error.stack ?? String(error);
        } finally {
          save();
        }
      }
      console.log(group + '/' + row.family + '/' + row.host + ': ' + row.status);
    }
  } catch (error) {
    report.setupFailure = error.stack ?? String(error);
  } finally {
    report.cleanupFailures = await closeNativeResources(browser, server ?? { listening: false });
    report.serverClosed = !server?.listening;
    report.responses = responses;
    report.finishedAt = new Date().toISOString();
    if (prepared) {
      try {
        const after = validatePreparedConsumers(consumers, repository, group, candidate);
        assert.equal(after.installationReceiptSha256, prepared.installationReceiptSha256);
        assert.deepEqual(after.binding, prepared.binding);
        if (report.rows.every((row) => row.status === 'passed'))
          assertServedArtifacts(responses, prepared.execution);
        for (const row of report.rows)
          for (const capture of row.captures) {
            const bytes = readFileSync(ownedFile(output, capture.path));
            assert.equal(digest(bytes), capture.sha256);
            assert.equal(bytes.length, capture.bytes);
          }
      } catch (error) {
        report.integrityFailure = error.stack ?? String(error);
      }
    }
    report.status =
      !report.setupFailure &&
      !report.integrityFailure &&
      report.serverClosed &&
      report.cleanupFailures.length === 0 &&
      report.rows.every((row) => row.status === 'passed')
        ? 'passed'
        : 'failed';
    save();
  }
  console.log(
    JSON.stringify({
      group,
      status: report.status,
      passed: report.rows.filter((row) => row.status === 'passed').length,
      total: report.rows.length,
    })
  );
  return report.status === 'passed' ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.equal(
    args.length,
    5,
    'usage: verify-native.mjs CONSUMERS REPOSITORY NEW_OUTPUT tooltip|select|old-cli CANDIDATE_SHA'
  );
  process.exitCode = await runNative(...args);
}
