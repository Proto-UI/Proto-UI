import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Derived from the public consumer observation command. This separate evaluator
// accepts equivalent consumer structures; the historical recipe checker is intact.
// Authority: the unchanged task.txt and WAI-ARIA APG Tabs Pattern, not a producer.

const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    out: { type: 'string' },
    project: { type: 'string' },
    viewport: { type: 'string', default: 'wide' },
    'color-scheme': { type: 'string', default: 'light' },
    'negative-control': { type: 'string', default: 'none' },
    'calibration-control': { type: 'string', default: 'none' },
  },
});
assert.ok(
  values.url && values.out && values.project,
  'Required: --project PROJECT --url http://127.0.0.1:PORT --out NEW_DIRECTORY'
);
const target = new URL(values.url);
assert.ok(
  target.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)
);
assert.equal(
  target.href,
  `${target.origin}${target.pathname}`,
  'Use a local URL without credentials, query or fragment'
);
assert.ok(['wide', 'narrow'].includes(values.viewport));
assert.ok(['light', 'dark'].includes(values['color-scheme']));
assert.ok(['none', 'automatic', 'relationship', 'removal'].includes(values['negative-control']));
assert.ok(
  ['none', 'legal-structure', 'duplicate-panel', 'live-off', 'unrelated-count'].includes(
    values['calibration-control']
  )
);
assert.ok(values['negative-control'] === 'none' || values['calibration-control'] === 'none');

const out = path.resolve(values.out);
const sourceRoot = path.resolve(values.project);
const { chromium } = createRequire(path.join(sourceRoot, 'package.json'))('playwright-core');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourcePaths = [
  'package.json',
  'package-lock.json',
  'index.html',
  'src/main.jsx',
  'src/style.css',
];
const planned = [
  'controls',
  'initial-selection',
  'keyboard-entry',
  'right-skips-disabled',
  'right-to-last',
  'right-wraps',
  'left-wraps',
  'home',
  'end',
  'enter-activates',
  'home-keeps-selection',
  'space-activates',
  'pointer-activates',
  'disabled-does-not-activate',
  'repeated-selections',
  'tab-leaves-list',
  'tab-reaches-host',
  'removal',
  'keyboard-after-removal',
  'host-action',
  'runtime-errors',
  'source-stability',
];
const report = {
  schemaVersion: 1,
  kind: 'interaction-knowledge-development-study-observation',
  scope: 'Public development task; no blind/held-out, screen-reader or Proto conformance claim.',
  caseId: 'tabs-manual-activation',
  taskExtension:
    'After fixture increments a visible, politely announced action count starting at zero.',
  url: target.href,
  startedAt: new Date().toISOString(),
  nodeVersion: process.version,
  platform: process.platform,
  architecture: process.arch,
  viewport: values.viewport === 'wide' ? { width: 1280, height: 800 } : { width: 390, height: 844 },
  colorScheme: values['color-scheme'],
  injectedControl: values['negative-control'],
  calibrationControl: values['calibration-control'],
  mutationEvents: [],
  browserVersion: null,
  checks: planned.map((id) => ({ id, status: 'not-run' })),
  source: [],
  artifacts: [],
  runtimeErrors: [],
  cleanupErrors: [],
  limitations: [
    'This observation is evidence only for its bound submitted source; participant identity and exposure are recorded in the separate frozen study manifest.',
    'Only the declared project files and evaluator are captured; installed dependencies are bound by the exact retained lock.',
    'Computed layout and accessibility snapshots do not establish paint contrast, screen-reader behavior or other-host conformance.',
    'A killed process may leave start.json and partial evidence without report.json; retain that incomplete attempt.',
  ],
};
await mkdir(out);
await mkdir(path.join(out, 'source'));
const evaluatorBytes = await readFile(fileURLToPath(import.meta.url));
await writeFile(path.join(out, 'evaluator.mjs'), evaluatorBytes, { flag: 'wx' });
report.evaluator = { sha256: sha256(evaluatorBytes), bytes: evaluatorBytes.length };
for (const relative of sourcePaths) {
  const bytes = await readFile(path.join(sourceRoot, relative));
  const saved = `source/${relative}`;
  await mkdir(path.dirname(path.join(out, saved)), { recursive: true });
  await writeFile(path.join(out, saved), bytes, { flag: 'wx' });
  report.source.push({ path: relative, sha256: sha256(bytes), bytes: bytes.length });
}
await writeFile(path.join(out, 'start.json'), JSON.stringify(report, null, 2) + '\n', {
  flag: 'wx',
});

let browser;
let context;
let page;
let failure;
let tracing = false;
const errorText = (error) =>
  error instanceof Error ? error.stack || error.message : String(error);

async function check(id, action) {
  const row = report.checks.find((entry) => entry.id === id);
  row.startedAt = new Date().toISOString();
  try {
    await action();
    row.status = 'passed';
  } catch (error) {
    row.status = 'failed';
    row.error = errorText(error);
    throw error;
  } finally {
    row.finishedAt = new Date().toISOString();
  }
}

async function save(relative, bytes) {
  const content = Buffer.from(bytes);
  await writeFile(path.join(out, relative), content, { flag: 'wx' });
  report.artifacts.push({ path: relative, sha256: sha256(content), bytes: content.length });
}

async function capture(name) {
  await save(`${name}.html`, await page.content());
  await save(`${name}.aria.yml`, await page.locator('body').ariaSnapshot());
  await save(`${name}.png`, await page.screenshot({ fullPage: true, timeout: 5000 }));
  await save(
    `${name}.json`,
    JSON.stringify(
      await page.evaluate(() => ({
        activeElement: {
          role: document.activeElement?.getAttribute('role'),
          text: document.activeElement?.textContent,
          id: document.activeElement?.id,
        },
        tabs: [...document.querySelectorAll('[role="tab"]')].map((tab) => ({
          text: tab.textContent,
          selected: tab.getAttribute('aria-selected'),
          tabIndex: tab.tabIndex,
          controls: tab.getAttribute('aria-controls'),
          disabled: tab.matches(':disabled') || tab.getAttribute('aria-disabled') === 'true',
        })),
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
      })),
      null,
      2
    ) + '\n'
  );
}

// Wait for the actual DOM invariant; an animation-frame count is not a React commit barrier.
async function state(selectedName, focusedName, allowInitialContainerEntry = false) {
  const selectedByName = page.getByRole('tab', { name: selectedName, exact: true });
  const focusedByName = focusedName && page.getByRole('tab', { name: focusedName, exact: true });
  const deadline = Date.now() + 2500;
  let matches = false;
  do {
    matches =
      (await selectedByName.count()) === 1 &&
      (await selectedByName.evaluate((namedTab, allowInitialContainerEntry) => {
        const tabs = [...document.querySelectorAll('[role="tab"]')];
        const selected = tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true');
        const visiblePanels = [...document.querySelectorAll('[role="tabpanel"]')].filter(
          (panel) =>
            !panel.hidden &&
            panel.getClientRects().length > 0 &&
            getComputedStyle(panel).visibility === 'visible'
        );
        const current = selected[0];
        const panel = visiblePanels[0];
        const stops = tabs.filter(
          (tab) =>
            !tab.matches(':disabled') &&
            tab.getAttribute('aria-disabled') !== 'true' &&
            tab.tabIndex === 0
        );
        // Radix's public roving-focus implementation initially exposes the list
        // as the single sequential entry, then transfers real Tab focus to its
        // selected tab. The subsequent keyboard-entry check verifies that transfer.
        const list = namedTab.closest('[role="tablist"]');
        const initialContainerEntry =
          allowInitialContainerEntry &&
          stops.length === 0 &&
          list?.tabIndex === 0 &&
          !list.contains(document.activeElement);
        return (
          tabs.length === 4 &&
          selected.length === 1 &&
          current === namedTab &&
          visiblePanels.length === 1 &&
          panel.id &&
          current.getAttribute('aria-controls') === panel.id &&
          panel.getAttribute('aria-labelledby')?.split(/\s+/).includes(current.id) &&
          (stops.length === 1 || initialContainerEntry)
        );
      }, allowInitialContainerEntry));
    if (matches && focusedByName) {
      matches =
        (await focusedByName.count()) === 1 &&
        (await focusedByName.evaluate(
          (element) => element === document.activeElement && element.tabIndex === 0
        ));
    }
    if (matches) break;
    await new Promise((resolve) => setTimeout(resolve, 25));
  } while (Date.now() < deadline);
  assert.ok(
    matches,
    `Selection/relationships/focus did not settle: selected=${selectedName}, focused=${focusedName ?? 'unspecified'}`
  );
  assert.equal(await page.getByRole('tabpanel', { name: selectedName, exact: true }).count(), 1);
}

try {
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
    headless: true,
    chromiumSandbox: true,
    timeout: 15000,
  });
  report.browserVersion = browser.version();
  context = await browser.newContext({
    viewport: report.viewport,
    colorScheme: report.colorScheme,
  });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  tracing = true;
  page = await context.newPage();
  page.setDefaultTimeout(2500);
  page.setDefaultNavigationTimeout(15000);
  page.on('pageerror', (error) =>
    report.runtimeErrors.push({ type: 'pageerror', text: error.message })
  );
  page.on('console', (message) => {
    if (message.type() === 'error')
      report.runtimeErrors.push({ type: 'console', text: message.text() });
  });
  const response = await page.goto(target.href, { waitUntil: 'domcontentloaded' });
  assert.equal(response?.status(), 200, 'Consumer document must load successfully');
  const list = page.getByRole('tablist', { name: 'Reference sections', exact: true });
  const tab = (name) => list.getByRole('tab', { name, exact: true });
  const remove = page.getByRole('button', { name: 'Remove reference fixture', exact: true });
  const after = page.getByRole('button', { name: 'After fixture', exact: true });
  await list.waitFor({ state: 'visible' });
  if (values['calibration-control'] === 'legal-structure') {
    await list.getByRole('tab').evaluateAll((elements) => {
      for (const element of elements) {
        const decoration = document.createElement('span');
        decoration.setAttribute('aria-hidden', 'true');
        decoration.textContent = '★';
        element.prepend(decoration);
      }
    });
  }

  if (values['negative-control'] === 'automatic') {
    await list.evaluate((element) => {
      window.__knowledgeMutationEvents = [];
      element.addEventListener('focusin', (event) => {
        if (event.target.getAttribute('role') !== 'tab') return;
        // Radix Tabs 1.1.13 selects on Enter/Space or primary mousedown,
        // not HTMLElement.click(). This deliberately violates manual activation
        // through an event that the pinned component actually handles.
        const activation = new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        });
        window.__knowledgeMutationEvents.push({
          target: event.target.textContent.trim(),
          event: 'keydown',
          key: activation.key,
          isTrusted: activation.isTrusted,
          selectedBefore: event.target.getAttribute('aria-selected'),
        });
        event.target.dispatchEvent(activation);
      });
    });
  } else if (values['negative-control'] === 'relationship') {
    await tab('Overview').evaluate((element) => element.removeAttribute('aria-controls'));
  } else if (values['negative-control'] === 'removal') {
    await remove.evaluate((element) =>
      element.addEventListener('click', (event) => event.stopImmediatePropagation(), true)
    );
  }

  await check('controls', async () => {
    assert.equal(await list.count(), 1);
    assert.equal(await list.getByRole('tab').count(), 4);
    for (const [index, name] of ['Overview', 'Unavailable', 'Details', 'History'].entries()) {
      assert.equal(await tab(name).count(), 1);
      assert.equal(
        await tab(name).evaluate(
          (element, index) =>
            [...element.closest('[role="tablist"]').querySelectorAll('[role="tab"]')][index] ===
            element,
          index
        ),
        true
      );
    }
    assert.ok([null, 'horizontal'].includes(await list.getAttribute('aria-orientation')));
    assert.equal(await tab('Unavailable').isDisabled(), true);
    for (const name of ['Overview', 'Details', 'History'])
      assert.equal(await tab(name).isEnabled(), true);
    assert.equal(await remove.count(), 1);
    assert.equal(await after.count(), 1);
  });
  await check('initial-selection', () => state('Overview', undefined, true));
  await capture('01-initial');
  await check('keyboard-entry', async () => {
    // A harmless preceding link is not an interaction failure. Still reach the
    // list through the real sequential keyboard order, with a bounded search.
    for (let attempt = 0; attempt < 12; attempt++) {
      await page.keyboard.press('Tab');
      if (await list.evaluate((element) => element.contains(document.activeElement))) break;
    }
    await state('Overview', 'Overview');
  });
  await check('right-skips-disabled', async () => {
    await page.keyboard.press('ArrowRight');
    await state('Overview', 'Details');
  });
  await capture('02-focus-without-selection');
  await check('right-to-last', async () => {
    await page.keyboard.press('ArrowRight');
    await state('Overview', 'History');
  });
  await check('right-wraps', async () => {
    await page.keyboard.press('ArrowRight');
    await state('Overview', 'Overview');
  });
  await check('left-wraps', async () => {
    await page.keyboard.press('ArrowLeft');
    await state('Overview', 'History');
  });
  await check('home', async () => {
    await page.keyboard.press('Home');
    await state('Overview', 'Overview');
  });
  await check('end', async () => {
    await page.keyboard.press('End');
    await state('Overview', 'History');
  });
  await check('enter-activates', async () => {
    await page.keyboard.press('Enter');
    await state('History', 'History');
  });
  await capture('03-activated');
  await check('home-keeps-selection', async () => {
    await page.keyboard.press('Home');
    await state('History', 'Overview');
  });
  await check('space-activates', async () => {
    await page.keyboard.press('Space');
    await state('Overview', 'Overview');
  });
  await check('pointer-activates', async () => {
    await tab('Details').click();
    await state('Details', 'Details');
  });
  await check('disabled-does-not-activate', async () => {
    await tab('Unavailable').click({ force: true });
    await state('Details');
  });
  await check('repeated-selections', async () => {
    for (const name of ['Overview', 'Details', 'History', 'Overview']) {
      await tab(name).click();
      await state(name, name);
    }
    assert.equal(await list.getByRole('tab').count(), 4);
    if (values['calibration-control'] === 'duplicate-panel') {
      await page.getByRole('tabpanel', { name: 'Overview', exact: true }).evaluate((element) => {
        for (const other of document.querySelectorAll('[role="tabpanel"]'))
          if (other !== element) other.remove();
        const duplicate = element.cloneNode(true);
        duplicate.id = 'calibration-duplicate-panel';
        duplicate.hidden = true;
        element.after(duplicate);
      });
    }
    // The task requires one visible panel, not four retained hidden panels.
    // Both conditional rendering and retained content are legal React choices.
    const panels = page.getByRole('tabpanel', { includeHidden: true });
    assert.ok((await panels.count()) >= 1 && (await panels.count()) <= 4);
    const ids = await page
      .locator('[role="tab"], [role="tabpanel"]')
      .evaluateAll((elements) => elements.map((element) => element.id));
    assert.ok(ids.every(Boolean), 'Interactive relationships need nonempty IDs');
    assert.equal(
      new Set(ids).size,
      ids.length,
      'Repeated activation must not duplicate relationship IDs'
    );
    assert.equal(
      await panels.evaluateAll((elements) => {
        const owners = elements.map((panel) => {
          const labels = (panel.getAttribute('aria-labelledby') ?? '').split(/\s+/);
          const tabs = labels
            .map((id) => document.getElementById(id))
            .filter((element) => element?.getAttribute('role') === 'tab');
          return tabs.length === 1 && tabs[0].getAttribute('aria-controls') === panel.id
            ? tabs[0].id
            : null;
        });
        return owners.every(Boolean) && new Set(owners).size === owners.length;
      }),
      true,
      'Each mounted panel belongs to exactly one tab; no tab has duplicate panels'
    );
  });
  await check('tab-leaves-list', async () => {
    if (values['calibration-control'] === 'legal-structure') {
      await page.getByRole('tabpanel', { name: 'Overview', exact: true }).evaluate((element) => {
        element.tabIndex = -1;
        const link = document.createElement('a');
        link.href = '#reference-information';
        link.textContent = 'More information';
        element.append(link);
      });
    }
    await page.keyboard.press('Tab');
    assert.equal(
      await page
        .getByRole('tabpanel', { name: 'Overview', exact: true })
        .evaluate(
          (element) =>
            element === document.activeElement || element.contains(document.activeElement)
        ),
      true
    );
  });
  await check('tab-reaches-host', async () => {
    for (let attempt = 0; attempt < 12; attempt++) {
      await page.keyboard.press('Tab');
      if (await remove.evaluate((element) => element === document.activeElement)) break;
    }
    assert.equal(await remove.evaluate((element) => element === document.activeElement), true);
  });
  await check('removal', async () => {
    await page.keyboard.press('Enter');
    await list.waitFor({ state: 'detached' });
    assert.equal(await page.getByRole('tab', { includeHidden: true }).count(), 0);
    assert.equal(await page.getByRole('tabpanel', { includeHidden: true }).count(), 0);
  });
  await check('keyboard-after-removal', async () => {
    for (let attempt = 0; attempt < 12; attempt++) {
      await page.keyboard.press('Tab');
      if (await after.evaluate((element) => element === document.activeElement)) break;
    }
    assert.equal(await after.evaluate((element) => element === document.activeElement), true);
  });
  await check('host-action', async () => {
    if (values['calibration-control'] === 'live-off') {
      await page.getByRole('status').evaluateAll((elements) => {
        for (const element of elements)
          if (/\b0\b/.test(element.textContent)) element.setAttribute('aria-live', 'off');
      });
    } else if (values['calibration-control'] === 'unrelated-count') {
      await after.evaluate((element) => {
        const noise = document.createElement('p');
        noise.setAttribute('role', 'status');
        noise.textContent = 'Build: 9';
        element.after(noise);
        element.addEventListener(
          'click',
          (event) => {
            event.stopImmediatePropagation();
            noise.textContent = 'Build: 1';
          },
          true
        );
      });
    }
    const snapshot = (element) => {
      const explicit = element.closest('[aria-live]')?.getAttribute('aria-live');
      const polite = explicit
        ? explicit === 'polite'
        : element.getAttribute('role') === 'status' || element.tagName === 'OUTPUT';
      if (
        !element.isConnected ||
        !polite ||
        !element.getClientRects().length ||
        getComputedStyle(element).visibility !== 'visible'
      )
        return null;
      return {
        text: element.textContent.trim(),
        numbers: (element.textContent.match(/\b\d+\b/g) ?? []).map(Number),
      };
    };
    const handles = await page
      .locator('[role="status"], [aria-live="polite"], output')
      .elementHandles();
    try {
      const before = await Promise.all(handles.map((element) => element.evaluate(snapshot)));
      assert.ok(
        before.some((entry) => entry?.numbers.includes(0)),
        'A visible polite count starts at zero'
      );
      await page.keyboard.press('Enter');
      const deadline = Date.now() + 2500;
      let afterCount;
      let changed = false;
      do {
        afterCount = await Promise.all(handles.map((element) => element.evaluate(snapshot)));
        changed = before.some((old, region) => {
          const current = afterCount[region];
          if (!old || !current || old.numbers.length !== current.numbers.length) return false;
          const differences = old.numbers
            .map((number, index) => ({ before: number, after: current.numbers[index] }))
            .filter((pair) => pair.before !== pair.after);
          return (
            differences.length === 1 && differences[0].before === 0 && differences[0].after === 1
          );
        });
        if (changed) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      } while (Date.now() < deadline);
      report.hostCount = {
        before,
        after: afterCount,
        identity: 'same connected live-region nodes before and after activation',
      };
      assert.ok(
        changed,
        'The same polite live region increments its count from zero to one; unrelated regions cannot supply the result'
      );
    } finally {
      await Promise.all(handles.map((element) => element.dispose()));
    }
  });
  await capture('04-host-after-removal');
  await check('runtime-errors', () => assert.deepEqual(report.runtimeErrors, []));
  await check('source-stability', async () => {
    for (const file of report.source)
      assert.equal(
        sha256(await readFile(path.join(sourceRoot, file.path))),
        file.sha256,
        `Source changed: ${file.path}`
      );
  });
} catch (error) {
  failure = errorText(error);
  if (page) {
    try {
      await capture('failure');
    } catch (captureError) {
      report.captureError = errorText(captureError);
    }
  }
} finally {
  if (page) {
    try {
      report.mutationEvents = await page.evaluate(() => window.__knowledgeMutationEvents ?? []);
    } catch (error) {
      report.cleanupErrors.push(errorText(error));
    }
  }
  if (tracing) {
    try {
      await context.tracing.stop({ path: path.join(out, 'trace.zip') });
      const bytes = await readFile(path.join(out, 'trace.zip'));
      report.artifacts.push({ path: 'trace.zip', sha256: sha256(bytes), bytes: bytes.length });
    } catch (error) {
      report.cleanupErrors.push(errorText(error));
    }
  }
  if (browser) {
    try {
      await browser.close();
    } catch (error) {
      report.cleanupErrors.push(errorText(error));
    }
  }
}
report.finishedAt = new Date().toISOString();
report.failure = failure ?? null;
report.outcome = failure !== undefined || report.cleanupErrors.length > 0 ? 'failed' : 'passed';
await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n', {
  flag: 'wx',
});
console.log(
  JSON.stringify({
    outcome: report.outcome,
    injectedControl: report.injectedControl,
    passed: report.checks.filter((row) => row.status === 'passed').length,
    planned: planned.length,
    report: path.join(out, 'report.json'),
  })
);
process.exitCode = report.outcome === 'passed' ? 0 : 1;
