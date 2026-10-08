import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(new URL('../../../apps/www/package.json', import.meta.url));
const CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'";
const NAMES = ['Overview', 'Unavailable', 'Details', 'History'];
export const SETTINGS_CRITERIA = Object.freeze(
  [
    ['initial-structure', ['C01', 'C06', 'C07']],
    ['settings-defaults', ['C01', 'C02', 'C03']],
    ['horizontal-clamp', ['C02', 'C03', 'C04']],
    ['horizontal-wrap', ['C03', 'C04']],
    ['orientation-live', ['C02', 'C04', 'C07']],
    ['vertical-clamp', ['C02', 'C03', 'C04']],
    ['vertical-wrap', ['C02', 'C03', 'C04']],
    ['home-end', ['C03', 'C04']],
    ['manual-focus', ['C04']],
    ['enter-activation', ['C05']],
    ['space-activation', ['C05']],
    ['pointer-repeat', ['C05', 'C07']],
    ['disabled-suppression', ['C06']],
    ['retained-relationships', ['C01', 'C03', 'C07']],
    ['cleanup-after', ['C08']],
  ].map(([id, claimIds]) => Object.freeze({ id, claimIds: Object.freeze(claimIds), layer: 'core' }))
);
export const SETTINGS_CHECKS = Object.freeze(SETTINGS_CRITERIA.map((c) => c.id));

export function classifySettingsFailure(
  error,
  { pageClosed = false, browserConnected = true } = {}
) {
  return error.oracleInfrastructure ||
    /(?:Target|Browser|Context|Page|Session).*closed|crash(?:ed)?|browser has been closed|Connection closed/i.test(
      error.message
    ) ||
    pageClosed ||
    !browserConnected
    ? 'blocked'
    : 'fail';
}

/** Bounded task oracle, not full Tabs/spec/AT conformance. Uses role/name discovery
 * and observed Web relationships, never starter IDs, implementation imports, or
 * control implementation. Do NOT run the wrap-only baseline on default-false HTML.
 * Arbitrary submissions MUST enter through boundedSettings (outer process deadline).
 */
export async function evaluateTabsSettings({
  htmlPath,
  evidenceDir,
  chromiumPath,
  chromiumLauncher,
}) {
  assert.ok(chromiumPath, 'An explicit verified Chromium executable is required');
  const bytes = await readFile(htmlPath);
  assert.ok(bytes.length <= 1_000_000, 'HTML exceeds 1MB input bound');
  const html = bytes.toString('utf8');
  assert.match(html, /^\s*<!doctype html>/i, 'Standalone standards-mode HTML required');
  const meta = `<meta http-equiv="Content-Security-Policy" content="${CSP}">`;
  const secured = /<head[\s>]/i.test(html)
    ? html.replace(/<head(?:\s[^>]*)?>/i, (match) => match + meta)
    : html.replace(/<!doctype html>/i, (match) => match + meta);
  await mkdir(evidenceDir, { recursive: true });
  const checks = [],
    errors = [],
    artifacts = [],
    relationshipObservations = [];
  const log = { actions: [], pageErrors: [], console: [], requests: [], disabledKeyboard: [] };
  const result = {
    schemaVersion: 1,
    kind: 'tabs-settings.bounded-task-oracle',
    status: 'candidate-unreviewed',
    admission: 'not-admitted',
    synthetic: false,
    execution: 'blocked',
    inputSha256: createHash('sha256').update(bytes).digest('hex'),
    browser: { executable: chromiumPath, version: null },
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      os: os.release(),
      viewport: { width: 1000, height: 760 },
      locale: 'en-US',
      timezone: 'UTC',
      network: 'all browser requests aborted; service workers blocked; inline-only CSP',
      input: 'Playwright keyboard and pointer; DOM/AX observation and key-default instrumentation',
      deadline: 'caller must use outer process deadline; per-operation timeouts are not sufficient',
      isolation: 'not an OS sandbox or malicious-submission isolation proof',
    },
    scope:
      '15 grouped checks of the task-owned standalone Web journey; draft-derived guidance only',
    untested: [
      'screen readers',
      'cross-adapter behavior',
      'internal ownership',
      'controlled state',
      'dynamic trigger fallback',
      'library APIs',
      'event/signal counts',
      'full accessibility conformance',
    ],
    checks,
    errors,
    artifacts,
  };
  let browser,
    context,
    page,
    cdp,
    serial = 0,
    documentEpoch = 0,
    unavailableReason = null;
  const infrastructureError = (e) =>
    classifySettingsFailure(e, {
      pageClosed: page?.isClosed() || false,
      browserConnected: browser ? browser.isConnected() : true,
    }) === 'blocked';
  async function save(name, data) {
    await writeFile(
      path.join(evidenceDir, name),
      typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n'
    );
    if (!artifacts.includes(name)) artifacts.push(name);
    return name;
  }
  const list = () => page.getByRole('tablist', { name: 'Reference sections', exact: true });
  const tab = (name) => list().getByRole('tab', { name, exact: true });
  const orientation = () => page.getByRole('combobox', { name: 'Orientation', exact: true });
  const wrap = () => page.getByRole('checkbox', { name: 'Wrap navigation', exact: true });
  const button = (name) => page.getByRole('button', { name, exact: true });
  async function unique(locator) {
    assert.equal(await locator.count(), 1, 'One matching accessible control');
  }
  async function focusIs(name) {
    assert.equal(
      await tab(name).evaluate((n) => n === document.activeElement),
      true,
      `Focus expected on ${name}`
    );
  }
  async function selectionIs(name) {
    assert.equal(
      await list()
        .getByRole('tab')
        .evaluateAll(
          (nodes) => nodes.filter((n) => n.getAttribute('aria-selected') === 'true').length
        ),
      1,
      'One selected tab'
    );
    assert.equal(
      await tab(name).getAttribute('aria-selected'),
      'true',
      `${name} selected by accessible name`
    );
    assert.equal(
      await page.getByRole('tabpanel').count(),
      1,
      'Exactly one accessible visible panel'
    );
    const controlled = await tab(name).getAttribute('aria-controls');
    assert.deepEqual(
      await page.getByRole('tabpanel').evaluateAll((nodes) => nodes.map((n) => n.id)),
      [controlled],
      'Visible panel is the selected tab control target'
    );
  }
  async function observe(label) {
    const panelIds = await page
      .getByRole('tabpanel', { includeHidden: true })
      .evaluateAll((nodes) => nodes.map((n) => n.id));
    const links = await list()
      .getByRole('tab')
      .evaluateAll((nodes, panelIds) => {
        const ids = [...document.querySelectorAll('[id]')];
        const resolve = (id) => ids.filter((n) => n.id === id);
        return nodes.map((n) => {
          const controls = (n.getAttribute('aria-controls') || '')
            .trim()
            .split(/\s+/)
            .filter(Boolean);
          const panel = resolve(controls[0])[0];
          const labels = (panel?.getAttribute('aria-labelledby') || '')
            .trim()
            .split(/\s+/)
            .filter(Boolean);
          return {
            tabId: n.id,
            controls,
            panelId: panel?.id,
            targetCount: resolve(controls[0]).length,
            tabIdCount: resolve(n.id).length,
            panelRole: panelIds.includes(panel?.id),
            reciprocal: !!n.id && labels.includes(n.id),
            labelsResolve: labels.length > 0 && labels.every((id) => resolve(id).length === 1),
            selected: n.getAttribute('aria-selected'),
            disabled: n.matches(':disabled') || n.getAttribute('aria-disabled') === 'true',
            tabIndex: n.tabIndex,
            visible:
              !!panel && panel.checkVisibility({ visibilityProperty: true, opacityProperty: true }),
          };
        });
      }, panelIds);
    const row = {
      label,
      documentEpoch,
      links,
      panelIds,
      allTabCount: await page.getByRole('tab', { includeHidden: true }).count(),
    };
    relationshipObservations.push(row);
    return row;
  }
  function assertRelationships(row) {
    assert.equal(row.links.length, 4, `${row.label}: retain four named tabs`);
    assert.equal(row.allTabCount, 4, `${row.label}: no duplicate or hidden extra tabs`);
    assert.equal(row.panelIds.length, 4, `${row.label}: retain all four panels`);
    assert.equal(new Set(row.panelIds).size, 4, `${row.label}: unique panel identities`);
    assert.equal(row.links.filter((n) => n.selected === 'true').length, 1);
    assert.equal(row.links.filter((n) => n.visible).length, 1);
    assert.equal(
      row.links.filter((n) => n.tabIndex === 0 && !n.disabled).length,
      1,
      'One enabled roving stop'
    );
    for (const n of row.links) {
      assert.ok(
        n.tabIndex <= 0 && (!n.disabled || n.tabIndex < 0),
        'No positive or disabled tab stop'
      );
      assert.ok(n.selected === 'true' || n.selected === 'false', 'Explicit selected state');
      assert.equal(n.controls.length, 1);
      assert.equal(n.targetCount, 1);
      assert.equal(n.tabIdCount, 1);
      assert.equal(n.panelRole, true);
      assert.equal(n.reciprocal, true);
      assert.equal(n.labelsResolve, true);
      assert.equal(n.visible, n.selected === 'true', 'Only selected panel visible');
    }
    assert.equal(new Set(row.links.map((n) => n.panelId)).size, 4, 'Distinct panel per tab');
  }
  async function snapshot(label) {
    const prefix = `${String(++serial).padStart(2, '0')}-${label}`;
    const evidence = [];
    for (const [suffix, capture] of [
      [
        'dom.json',
        () =>
          page.evaluate(() => ({
            html: document.documentElement.outerHTML,
            active: document.activeElement?.outerHTML,
            scrollY,
          })),
      ],
      ['ax.json', () => cdp.send('Accessibility.getFullAXTree')],
      [
        'png',
        () => page.screenshot({ path: path.join(evidenceDir, `${prefix}.png`), timeout: 5000 }),
      ],
    ]) {
      try {
        const name = `${prefix}.${suffix}`;
        const value = await capture();
        if (suffix !== 'png') await save(name, value);
        else artifacts.push(name);
        evidence.push(name);
      } catch (e) {
        errors.push({ layer: 'evidence', stage: nameFor(label, suffix), message: e.message });
        if (infrastructureError(e)) unavailableReason = e.message;
      }
    }
    await save('progress.json', { stage: label, checks, errors, artifacts });
    return evidence;
  }
  function nameFor(label, suffix) {
    return `${label}.${suffix}`;
  }
  async function fresh() {
    try {
      await page.setContent(secured, { timeout: 5000 });
    } catch (e) {
      e.oracleInfrastructure = true;
      throw e;
    }
    documentEpoch++;
    await unique(list());
    for (const name of NAMES) await unique(tab(name));
    await observe('fresh');
  }
  async function press(key, focused, selected) {
    log.actions.push({
      input: 'keyboard',
      key,
      expectedFocus: focused,
      expectedSelection: selected,
    });
    await page.keyboard.press(key);
    await focusIs(focused);
    await selectionIs(selected);
    await observe(`key-${key}`);
  }
  async function click(name) {
    log.actions.push({ input: 'pointer', name });
    await tab(name).click();
  }
  async function chooseOrientation(direction) {
    await orientation().focus();
    // Headless macOS native select ignores arrow/Home/End; native type-ahead is
    // trusted and supports the two explicit labels. Blur clears its search buffer.
    await page.keyboard.press('Tab');
    await orientation().focus();
    await page.keyboard.press(direction === 'Horizontal' ? 'h' : 'v');
    await page.keyboard.press('Tab');
  }
  async function configure(direction, looping) {
    log.actions.push({ input: 'settings', direction, looping });
    // Native select keys and pointer checkbox actions, not synthetic DOM events.
    await chooseOrientation(direction);
    await wrap().setChecked(looping);
  }
  async function group(id, body, reload = true) {
    if (unavailableReason) {
      checks.push({
        id,
        layer: 'core',
        status: 'blocked',
        reason: unavailableReason,
        evidence: [],
      });
      return;
    }
    let status = 'pass',
      reason = 'Observed task-scoped behavior';
    try {
      if (reload) await fresh();
      await body();
    } catch (e) {
      status = infrastructureError(e) ? 'blocked' : 'fail';
      reason = e.message;
      if (status === 'blocked') {
        unavailableReason = reason;
        errors.push({ layer: 'execution', stage: id, message: reason });
      }
    }
    const evidence = unavailableReason ? [] : await snapshot(id);
    if (unavailableReason) {
      status = 'blocked';
      reason = unavailableReason;
    }
    checks.push({ id, layer: 'core', status, reason, evidence });
    await save('progress.json', { stage: id, checks, errors, artifacts });
  }
  try {
    await save('progress.json', {
      stage: 'launching',
      inputSha256: result.inputSha256,
      checks,
      errors,
    });
    const { chromium } = require('playwright-core');
    browser = await chromium.launch({
      executablePath: chromiumLauncher || chromiumPath,
      headless: true,
      timeout: 10000,
    });
    result.browser.version = browser.version();
    context = await browser.newContext({
      viewport: result.environment.viewport,
      locale: 'en-US',
      timezoneId: 'UTC',
      serviceWorkers: 'block',
    });
    await context.route('**/*', (route) => {
      log.requests.push(route.request().url());
      return route.abort();
    });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    page = await context.newPage();
    page.setDefaultTimeout(1200);
    page.on('pageerror', (e) => log.pageErrors.push(e.message));
    page.on('console', (m) => log.console.push({ type: m.type(), text: m.text() }));
    page.on('dialog', (d) =>
      d.dismiss().catch((e) => errors.push({ layer: 'host', stage: 'dialog', message: e.message }))
    );
    cdp = await context.newCDPSession(page);
    await save('progress.json', {
      stage: 'before-submission',
      inputSha256: result.inputSha256,
      browser: result.browser,
      checks,
      errors,
    });
    await group('initial-structure', async () => {
      assert.equal(await page.getByRole('tablist').count(), 1);
      const namedIds = [];
      for (const name of NAMES) {
        await unique(tab(name));
        namedIds.push(await tab(name).getAttribute('id'));
      }
      assert.deepEqual(
        await list()
          .getByRole('tab')
          .evaluateAll((nodes) => nodes.map((n) => n.id)),
        namedIds,
        'Tab order by accessible name, not visible text'
      );
      assert.equal(await tab('Unavailable').isDisabled(), true);
      await selectionIs('Overview');
      assertRelationships(await observe('initial'));
    });
    await group('settings-defaults', async () => {
      await unique(orientation());
      await unique(wrap());
      assert.equal(await orientation().locator('option:checked').textContent(), 'Horizontal');
      assert.deepEqual(await orientation().locator('option').allTextContents(), [
        'Horizontal',
        'Vertical',
      ]);
      assert.equal(await wrap().isChecked(), false);
      assert.equal(await list().getAttribute('aria-orientation'), 'horizontal');
      await selectionIs('Overview');
    });
    await group('horizontal-clamp', async () => {
      // Exercise untouched default, not a test-imposed false setting.
      await tab('Overview').focus();
      await press('ArrowLeft', 'Overview', 'Overview');
      await press('ArrowRight', 'Details', 'Overview');
      await press('ArrowLeft', 'Overview', 'Overview');
      await press('End', 'History', 'Overview');
      await press('ArrowRight', 'History', 'Overview');
      await press('ArrowLeft', 'Details', 'Overview');
      await press('ArrowUp', 'Details', 'Overview');
      await press('ArrowDown', 'Details', 'Overview');
    });
    await group('horizontal-wrap', async () => {
      await click('Details');
      await selectionIs('Details');
      const before = await observe('before-horizontal-wrap-toggle');
      await configure('Horizontal', true);
      await selectionIs('Details');
      assert.deepEqual(
        (await observe('horizontal-wrap-enabled')).links.map((n) => [n.tabId, n.panelId]),
        before.links.map((n) => [n.tabId, n.panelId]),
        'Wrap enable preserves live identities'
      );
      await tab('Overview').focus();
      await press('ArrowLeft', 'History', 'Details');
      await press('ArrowRight', 'Overview', 'Details');
      await press('ArrowRight', 'Details', 'Details');
      await press('ArrowLeft', 'Overview', 'Details');
      await wrap().uncheck();
      await selectionIs('Details');
      assert.deepEqual(
        (await observe('horizontal-wrap-disabled')).links.map((n) => [n.tabId, n.panelId]),
        before.links.map((n) => [n.tabId, n.panelId]),
        'Wrap disable preserves live identities'
      );
      await tab('History').focus();
      await press('ArrowRight', 'History', 'Details');
    });
    await group('orientation-live', async () => {
      await click('Details');
      await selectionIs('Details');
      const before = await observe('before-orientation');
      await configure('Vertical', false);
      assert.equal(await list().getAttribute('aria-orientation'), 'vertical');
      await selectionIs('Details');
      await tab('Overview').focus();
      await press('ArrowLeft', 'Overview', 'Details');
      await press('ArrowRight', 'Overview', 'Details');
      await press('ArrowDown', 'Details', 'Details');
      await configure('Horizontal', false);
      assert.equal(await list().getAttribute('aria-orientation'), 'horizontal');
      await tab('Details').focus();
      await press('ArrowDown', 'Details', 'Details');
      await press('ArrowUp', 'Details', 'Details');
      await press('ArrowRight', 'History', 'Details');
      assert.deepEqual(
        (await observe('after-orientation')).links.map((n) => [n.tabId, n.panelId]),
        before.links.map((n) => [n.tabId, n.panelId])
      );
    });
    await group('vertical-clamp', async () => {
      await configure('Vertical', false);
      await tab('Overview').focus();
      await press('ArrowUp', 'Overview', 'Overview');
      await press('ArrowDown', 'Details', 'Overview');
      await press('ArrowUp', 'Overview', 'Overview');
      await press('End', 'History', 'Overview');
      await press('ArrowDown', 'History', 'Overview');
      await press('ArrowUp', 'Details', 'Overview');
    });
    await group('vertical-wrap', async () => {
      await click('Details');
      await selectionIs('Details');
      const before = await observe('before-vertical-wrap-toggle');
      await configure('Vertical', true);
      await selectionIs('Details');
      assert.deepEqual(
        (await observe('vertical-wrap-enabled')).links.map((n) => [n.tabId, n.panelId]),
        before.links.map((n) => [n.tabId, n.panelId]),
        'Wrap enable preserves live identities'
      );
      await tab('Overview').focus();
      await press('ArrowUp', 'History', 'Details');
      await press('ArrowDown', 'Overview', 'Details');
      await press('ArrowDown', 'Details', 'Details');
      await press('ArrowUp', 'Overview', 'Details');
      await wrap().uncheck();
      await selectionIs('Details');
      assert.deepEqual(
        (await observe('vertical-wrap-disabled')).links.map((n) => [n.tabId, n.panelId]),
        before.links.map((n) => [n.tabId, n.panelId]),
        'Wrap disable preserves live identities'
      );
      await tab('Overview').focus();
      await press('ArrowUp', 'Overview', 'Details');
    });
    await group('home-end', async () => {
      for (const direction of ['Horizontal', 'Vertical'])
        for (const looping of [false, true]) {
          await configure(direction, looping);
          await tab('Details').focus();
          await press('Home', 'Overview', 'Overview');
          await press('End', 'History', 'Overview');
        }
    });
    await group('manual-focus', async () => {
      await click('History');
      await selectionIs('History');
      for (const direction of ['Horizontal', 'Vertical']) {
        await configure(direction, false);
        await tab('History').focus();
        await press('Home', 'Overview', 'History');
        await press(direction === 'Horizontal' ? 'ArrowRight' : 'ArrowDown', 'Details', 'History');
        await press('End', 'History', 'History');
      }
    });
    await group('enter-activation', async () => {
      await tab('Overview').focus();
      await press('End', 'History', 'Overview');
      await press('Enter', 'History', 'History');
      await press('Enter', 'History', 'History');
    });
    await group('space-activation', async () => {
      await tab('Overview').focus();
      await press('End', 'History', 'Overview');
      // Observe the real trusted key event after page handlers, even if they stop propagation.
      await page.evaluate(() => {
        window.__settingsSpaceEvidence = [];
        document.addEventListener(
          'keydown',
          (e) => {
            if (e.key === ' ') window.__settingsSpaceEvidence.push(e);
          },
          { capture: true }
        );
      });
      await press('Space', 'History', 'History');
      assert.deepEqual(
        await page.evaluate(() =>
          window.__settingsSpaceEvidence.map((e) => ({
            trusted: e.isTrusted,
            prevented: e.defaultPrevented,
          }))
        ),
        [{ trusted: true, prevented: true }]
      );
      await press('Home', 'Overview', 'History');
      await press('Space', 'Overview', 'Overview');
    });
    await group('pointer-repeat', async () => {
      const before = await observe('before-repeat');
      await click('Details');
      await selectionIs('Details');
      await click('Details');
      await click('Details');
      await selectionIs('Details');
      await press('Enter', 'Details', 'Details');
      await press('Space', 'Details', 'Details');
      const after = await observe('after-repeat');
      assertRelationships(after);
      assert.deepEqual(
        after.links.map((n) => [n.tabId, n.panelId]),
        before.links.map((n) => [n.tabId, n.panelId])
      );
    });
    await group('disabled-suppression', async () => {
      for (const direction of ['Horizontal', 'Vertical']) {
        await configure(direction, false);
        await click('Details');
        await selectionIs('Details');
        assert.equal(await tab('Unavailable').isDisabled(), true);
        const before = (await observe('before-disabled-' + direction)).links.map((n) => n.tabIndex);
        // Pointer suppression and host focusability are independent observations.
        const box = await tab('Unavailable').boundingBox();
        assert.ok(box);
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await selectionIs('Details');
        assert.deepEqual(
          (await observe('disabled-pointer-' + direction)).links.map((n) => n.tabIndex),
          before
        );
        const pointerAcceptsFocus = await tab('Unavailable').evaluate(
          (n) => n === document.activeElement
        );
        // Explicit host focus probe is NOT keyboard input. The following keys are
        // trusted Playwright input, even if mousedown prevents pointer focus.
        await tab('Unavailable').focus();
        const acceptsFocus = await tab('Unavailable').evaluate((n) => n === document.activeElement);
        const keys = [
          'Enter',
          'Space',
          ...(direction === 'Horizontal'
            ? ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp']
            : ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft']),
          'Home',
          'End',
        ];
        log.disabledKeyboard.push({
          orientation: direction,
          pointerAcceptsFocus,
          acceptsFocus,
          focusMethod: 'explicit Playwright locator.focus host probe',
          keys: acceptsFocus ? keys : [],
          note: acceptsFocus
            ? 'trusted keys on explicitly host-focused disabled tab'
            : 'native/host disabled tab did not accept explicit focus; keyboard-target branch not applicable',
        });
        await selectionIs('Details');
        assert.deepEqual(
          (await observe('disabled-explicit-focus-' + direction)).links.map((n) => n.tabIndex),
          before
        );
        if (acceptsFocus) {
          for (const key of keys) {
            await page.keyboard.press(key);
            await selectionIs('Details');
            await focusIs('Unavailable');
            assert.deepEqual(
              (await observe('disabled-' + direction + '-' + key)).links.map((n) => n.tabIndex),
              before
            );
          }
        }
        await tab('Overview').focus();
        await press(direction === 'Horizontal' ? 'ArrowRight' : 'ArrowDown', 'Details', 'Details');
      }
    });
    await group('retained-relationships', async () => {
      await observe('relationships-final');
      for (const row of relationshipObservations) assertRelationships(row);
      // Stable within a live document, not across evaluator-imposed fresh reloads.
      const identity = (row) => row.links.map((n) => [n.tabId, n.panelId]);
      const baselineByEpoch = new Map();
      for (const row of relationshipObservations) {
        if (!baselineByEpoch.has(row.documentEpoch))
          baselineByEpoch.set(row.documentEpoch, identity(row));
        assert.deepEqual(
          identity(row),
          baselineByEpoch.get(row.documentEpoch),
          `${row.label}: stable live identities`
        );
      }
    });
    await group('cleanup-after', async () => {
      await button('Remove reference').click();
      const removed = async () => {
        assert.equal(await page.getByRole('tablist', { includeHidden: true }).count(), 0);
        assert.equal(await page.getByRole('tab', { includeHidden: true }).count(), 0);
        assert.equal(await page.getByRole('tabpanel', { includeHidden: true }).count(), 0);
        const ids = [
          ...new Set(
            relationshipObservations.flatMap((row) => [
              ...row.panelIds,
              ...row.links.map((n) => n.tabId),
            ])
          ),
        ];
        assert.deepEqual(
          await page.evaluate((ids) => ids.filter((id) => document.getElementById(id)), ids),
          [],
          'No stale reference IDs'
        );
      };
      await removed();
      await unique(button('After'));
      if (!(await button('After').evaluate((n) => n === document.activeElement))) {
        // A valid alternative keeps focus on Remove; validate trusted sequential navigation.
        await button('Remove reference').focus();
        await page.keyboard.press('Tab');
      }
      assert.equal(
        await button('After').evaluate((n) => n === document.activeElement),
        true,
        'After keyboard reachable'
      );
      for (const key of ['ArrowRight', 'ArrowDown', 'Home', 'End', 'Enter', 'Space'])
        await page.keyboard.press(key);
      await removed();
      if (await orientation().count()) await chooseOrientation('Vertical');
      if (await wrap().count()) await wrap().setChecked(true);
      await removed();
    });
    if (!unavailableReason) result.execution = 'completed';
  } catch (e) {
    errors.push({ layer: 'execution', stage: 'execution', message: e.message });
  } finally {
    for (const id of SETTINGS_CHECKS)
      if (!checks.some((c) => c.id === id))
        checks.push({
          id,
          layer: 'core',
          status: 'blocked',
          reason: 'Execution did not reach check',
          evidence: [],
        });
    if (context)
      try {
        await context.tracing.stop({ path: path.join(evidenceDir, 'trace.zip') });
        artifacts.push('trace.zip');
      } catch (e) {
        errors.push({ layer: 'evidence', stage: 'trace', message: e.message });
      }
    if (browser)
      await browser
        .close()
        .catch((e) => errors.push({ layer: 'host', stage: 'shutdown', message: e.message }));
    await save('browser-log.json', log);
    await save('relationships.json', relationshipObservations);
    result.hostErrors = {
      status: log.pageErrors.length || errors.some((e) => e.layer === 'host') ? 'fail' : 'pass',
      pageErrors: log.pageErrors,
      errors: errors.filter((e) => e.layer === 'host'),
    };
    result.evidence = {
      status:
        errors.some((e) => e.layer === 'evidence') ||
        !artifacts.includes('trace.zip') ||
        checks.some((c) => c.status === 'blocked' || !c.evidence.length)
          ? 'blocked'
          : 'complete',
      errors: errors.filter((e) => e.layer === 'evidence'),
    };
    result.summary = {
      core: Object.fromEntries(
        ['pass', 'fail', 'blocked'].map((s) => [s, checks.filter((c) => c.status === s).length])
      ),
      hostErrors: result.hostErrors.status,
      evidence: result.evidence.status,
    };
    result.eligibility = {
      scoringEligible: false,
      allCorePassed:
        checks.length === SETTINGS_CHECKS.length && checks.every((c) => c.status === 'pass'),
      taskAccepted: false,
      reason:
        'Outer worker cleanup receipt required; consult settings-eligibility.json from boundedSettings, never core pass alone',
    };
    await save('result.json', result);
  }
  return result;
}
