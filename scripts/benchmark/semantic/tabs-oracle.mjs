import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { TABS_POLICY } from './tabs-policy.mjs';

const require = createRequire(new URL('../../../apps/www/package.json', import.meta.url));
const csp =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'";

/** Candidate public-development oracle, independent of product and control code.
 * Reads Web-observable semantics only. Evidence is not screen-reader proof.
 * Caller MUST impose an outer process deadline for arbitrary submissions.
 * Missing inactive views retain disputed relationship applicability, not fail/pass.
 */
export async function evaluateTabs({ htmlPath, evidenceDir, chromiumPath, chromiumLauncher }) {
  if (!chromiumPath) throw new Error('An explicit verified Chromium executable is required');
  const html = await readFile(htmlPath, 'utf8');
  if (Buffer.byteLength(html) > 1_000_000) throw new Error('HTML exceeds 1MB input bound');
  await mkdir(evidenceDir, { recursive: true });
  const checks = [];
  const errors = [];
  const artifacts = [];
  const log = { console: [], pageErrors: [], requests: [], actions: [] };
  let browser, context, page, cdp;
  let checkpoint = 0;
  let lastEvidence = [];
  const hash = createHash('sha256').update(html).digest('hex');
  const result = {
    schemaVersion: 1,
    oracle: TABS_POLICY,
    inputSha256: hash,
    execution: 'blocked',
    browser: { executable: chromiumPath, version: null },
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      os: os.release(),
      viewport: { width: 1000, height: 760 },
      locale: 'en-US',
      timezone: 'UTC',
      network: 'requests aborted, service workers blocked, inline-only CSP',
      isolation: 'browser network restriction only; not participant isolation or OS sandbox proof',
      input: 'Playwright keyboard/pointer; DOM/AX observation',
      totalDeadline: 'required from caller',
    },
    checks,
    errors,
    artifacts,
  };
  async function save(name, data) {
    await writeFile(
      path.join(evidenceDir, name),
      typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n'
    );
    artifacts.push(name);
    return name;
  }
  async function snapshot(label) {
    const prefix = `${String(++checkpoint).padStart(2, '0')}-${label}`;
    const evidence = [];
    try {
      await page.screenshot({ path: path.join(evidenceDir, `${prefix}.png`), timeout: 5000 });
      artifacts.push(`${prefix}.png`);
      evidence.push(`${prefix}.png`);
      evidence.push(
        await save(
          `${prefix}.dom.json`,
          await page.evaluate(() => ({
            html: document.documentElement.outerHTML,
            active: document.activeElement?.outerHTML,
          }))
        )
      );
      evidence.push(await save(`${prefix}.ax.json`, await cdp.send('Accessibility.getFullAXTree')));
    } catch (e) {
      errors.push({ stage: `evidence.${label}`, message: e.message });
      checks.push({
        id: `evidence.${label}`,
        layer: 'evidence',
        status: 'blocked',
        reason: e.message,
        evidence,
      });
    }
    lastEvidence = evidence;
    await save('progress.json', { stage: label, checks, errors, artifacts: [...artifacts] });
    return evidence;
  }
  async function check(id, layer, source, assertion) {
    let status = 'pass',
      reason = 'Observed expected task-scoped semantics';
    try {
      await assertion();
    } catch (e) {
      status = 'fail';
      reason = e.message;
    }
    checks.push({ id, layer, source, status, reason, evidence: [...lastEvidence] });
  }
  function observation(id, layer, source, status, reason) {
    checks.push({ id, layer, source, status, reason, evidence: [...lastEvidence] });
  }
  async function unique(locator, label) {
    assert.equal(
      await locator.count(),
      1,
      `${label} must resolve uniquely by accessible role/name`
    );
    return locator;
  }
  const list = () => page.getByRole('tablist', { name: TABS_POLICY.listName, exact: true });
  const tab = (name) => list().getByRole('tab', { name, exact: true });
  const button = (name) => page.getByRole('button', { name, exact: true });
  async function selected() {
    return list()
      .getByRole('tab')
      .evaluateAll((nodes) =>
        nodes.filter((n) => n.getAttribute('aria-selected') === 'true').map((n) => n.outerHTML)
      );
  }
  async function expectSelected(name) {
    assert.equal((await selected()).length, 1, 'Exactly one selected tab');
    assert.equal(
      await tab(name).getAttribute('aria-selected'),
      'true',
      `${name} must remain selected`
    );
  }
  async function expectFocused(name) {
    assert.equal(
      await tab(name).evaluate((n) => n === document.activeElement),
      true,
      `Focus must be on ${name}`
    );
  }
  async function relationships() {
    // Role locators resolve the first supported ARIA role token, including hidden
    // panels. Do not require literal role attribute equality or token membership.
    const panelIds = await page
      .getByRole('tabpanel', { includeHidden: true })
      .evaluateAll((nodes) => nodes.map((n) => n.id));
    return list()
      .getByRole('tab')
      .evaluateAll(
        (nodes, panelIds) =>
          nodes.map((n) => {
            const refs = (n.getAttribute('aria-controls') || '')
              .trim()
              .split(/\s+/)
              .filter(Boolean);
            const targets = refs.map((id) =>
              [...document.querySelectorAll('[id]')].filter((p) => p.id === id)
            );
            const p = targets[0]?.[0];
            const labels = (p?.getAttribute('aria-labelledby') || '')
              .trim()
              .split(/\s+/)
              .filter(Boolean);
            return {
              selected: n.getAttribute('aria-selected') === 'true',
              refs,
              targetCount: targets[0]?.length ?? 0,
              tabId: n.id,
              tabIdCount: [...document.querySelectorAll('[id]')].filter((t) => t.id === n.id)
                .length,
              panelRole: p && panelIds.includes(p.id) ? 'tabpanel' : null,
              reciprocal: !!n.id && labels.includes(n.id),
              labelsResolve: labels.every(
                (id) =>
                  [...document.querySelectorAll('[id]')].filter((t) => t.id === id).length === 1
              ),
              targetVisible:
                !!p && !!p.getClientRects().length && getComputedStyle(p).visibility !== 'hidden',
            };
          }),
        panelIds
      );
  }
  async function audit(label) {
    await snapshot(label);
    await check(`${label}.single-selected`, 'journey', 'task', async () => {
      assert.equal((await selected()).length, 1, 'Exactly one selected tab');
    });
    await check(`${label}.roving`, 'platform', 'apg', async () => {
      const stops = await list()
        .getByRole('tab')
        .evaluateAll((nodes) =>
          nodes.filter(
            (n) =>
              n.tabIndex >= 0 &&
              !n.matches(':disabled') &&
              n.getAttribute('aria-disabled') !== 'true'
          )
        );
      assert.equal(stops.length, 1, 'Exactly one enabled tab in sequential focus order');
      assert.equal(
        await list()
          .getByRole('tab')
          .evaluateAll((nodes) => nodes.some((n) => n.tabIndex > 0)),
        false,
        'Positive tabindex is not a roving tab stop'
      );
    });
    const links = await relationships();
    await check(`${label}.present-relationships`, 'platform', 'aria+apg', async () => {
      for (const link of links) {
        if (!link.selected && link.targetCount === 0) continue;
        assert.equal(link.refs.length, 1, 'One control target per tab');
        assert.equal(link.targetCount, 1, 'Control target must uniquely resolve');
        assert.equal(link.tabIdCount, 1, 'Referenced tab identity must be unique');
        assert.equal(link.panelRole, 'tabpanel');
        assert.equal(
          link.reciprocal,
          true,
          'Present panel must be labelled by its controlling tab'
        );
        assert.equal(link.labelsResolve, true, 'Panel label references must resolve uniquely');
        assert.equal(
          link.targetVisible,
          link.selected,
          'Only selected associated panel is rendered'
        );
      }
      const presentTargets = links.filter((l) => l.targetCount > 0).map((l) => l.refs[0]);
      assert.equal(
        new Set(presentTargets).size,
        presentTargets.length,
        'Tabs may not cross-share panel targets'
      );
    });
    if (links.some((l) => !l.selected && l.targetCount === 0)) {
      observation(
        `${label}.inactive-relationships`,
        'platform',
        'aria+apg',
        'disputed',
        'Inactive view absent: task reciprocal-reference applicability needs independent adjudication; not passing or failing'
      );
    }
    await check(`${label}.visible-panel`, 'journey', 'task', async () => {
      assert.equal(
        await page.getByRole('tabpanel').count(),
        1,
        'Exactly one accessible visible panel, including unexpected extra panels'
      );
    });
    await check(`${label}.unique-controls`, 'journey', 'task', async () => {
      assert.equal(await list().getByRole('tab').count(), 4, 'Four visible tabs, no duplicates');
      for (const name of TABS_POLICY.names) {
        await unique(page.getByRole('tab', { name, exact: true }), name);
      }
    });
    // Same observations are separately mapped only to scoped draft criteria.
    observation(
      `${label}.proto-single-selection`,
      'proto',
      'P-BASE-TABS-ROLE-SINGLE-SELECTION',
      checks.find((c) => c.id === `${label}.single-selected`).status,
      'Draft Web-observable single-selection alignment only, not internal state conformance'
    );
    observation(
      `${label}.proto-present-relationships`,
      'proto',
      'P-BASE-TABS-A11Y-RELATIONSHIP-TARGET',
      checks.find((c) => c.id === `${label}.present-relationships`).status,
      'Present-view draft relationship alignment; internal protocol-value/domain ownership untested'
    );
  }
  async function action(id, perform, verify, protoCriterion) {
    log.actions.push({
      id,
      mechanism: 'trusted keyboard/pointer',
      started: new Date().toISOString(),
    });
    await check(id, 'journey', 'task', async () => {
      await perform();
      await verify();
    });
    const actionCheck = checks.at(-1);
    actionCheck.evidence = await snapshot(id);
    if (protoCriterion)
      observation(
        `${id}.proto`,
        'proto',
        protoCriterion,
        actionCheck.status,
        'Separately reported draft Web-observable alignment'
      );
    await audit(`after-${id}`);
  }
  try {
    await save('progress.json', { stage: 'launching', inputSha256: hash, checks, errors });
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
    page.on('console', (message) =>
      log.console.push({ type: message.type(), text: message.text() })
    );
    page.on('pageerror', (error) => log.pageErrors.push(error.message));
    cdp = await context.newCDPSession(page);
    // Preserve standards mode; prepending a meta tag before the doctype would
    // change layout/focus evidence. Require ordinary standalone HTML for this slice.
    assert.match(html, /^\s*<!doctype html>/i, 'Standalone HTML doctype required');
    const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
    const secured = /<head[\s>]/i.test(html)
      ? html.replace(/<head(?:\s[^>]*)?>/i, (match) => `${match}${meta}`)
      : html.replace(/<!doctype html>/i, (match) => `${match}${meta}`);
    await save('progress.json', {
      stage: 'before-submission',
      inputSha256: hash,
      browser: result.browser,
      checks,
      errors,
    });
    await page.setContent(secured, { timeout: 5000 });
    result.execution = 'completed';
    await snapshot('loaded');
    await check('discovery', 'platform', 'aria+apg', async () => {
      await unique(list(), 'Named tablist');
      for (const name of TABS_POLICY.names) await unique(tab(name), name);
      await unique(button(TABS_POLICY.removeName), 'Removal control');
      await unique(button(TABS_POLICY.afterName), 'Post-removal control');
    });
    if (checks.at(-1).status === 'fail') {
      observation(
        'journey-not-reachable',
        'journey',
        'task',
        'blocked',
        'Semantic discovery failed; no arbitrary first-match journey'
      );
    } else {
      await audit('initial');
      await check('initial.overview', 'journey', 'task', () => expectSelected('Overview'));
      await check('initial.disabled', 'platform', 'aria+apg', async () => {
        assert.equal(
          await tab('Unavailable').evaluate(
            (n) => n.matches(':disabled') || n.getAttribute('aria-disabled') === 'true'
          ),
          true
        );
        assert.equal(
          await tab('Unavailable').evaluate((n) => n.matches(':disabled') || n.tabIndex < 0),
          true,
          'Disabled item may not be a sequential tab stop'
        );
      });
      await tab('Overview').click();
      const navigation = [
        ['right-skip-disabled', 'ArrowRight', 'Details'],
        ['right-next', 'ArrowRight', 'History'],
        ['right-wrap', 'ArrowRight', 'Overview'],
        ['left-wrap', 'ArrowLeft', 'History'],
        ['home', 'Home', 'Overview'],
        ['end', 'End', 'History'],
      ];
      for (const [id, key, focus] of navigation) {
        await action(
          id,
          () => page.keyboard.press(key),
          async () => {
            await expectFocused(focus);
            await expectSelected('Overview');
          },
          'P-BASE-TABS-TRIGGER-MANUAL-FOCUS-STABLE'
        );
      }
      await action(
        'enter-activation',
        () => page.keyboard.press('Enter'),
        () => expectSelected('History'),
        'P-BASE-TABS-TRIGGER-KEYBOARD-ACTIVATION'
      );
      await action(
        'home-after-selection',
        () => page.keyboard.press('Home'),
        async () => {
          await expectFocused('Overview');
          await expectSelected('History');
        },
        'P-BASE-TABS-TRIGGER-MANUAL-FOCUS-STABLE'
      );
      await action(
        'space-activation',
        () => page.keyboard.press('Space'),
        () => expectSelected('Overview'),
        'P-BASE-TABS-TRIGGER-KEYBOARD-ACTIVATION'
      );
      await action(
        'pointer-activation',
        () => tab('Details').click(),
        () => expectSelected('Details')
      );
      await action(
        'repeat-selection',
        async () => {
          await tab('Details').click();
          await tab('Details').click();
        },
        () => expectSelected('Details')
      );
      await action(
        'disabled-pointer',
        () => tab('Unavailable').click({ force: true }),
        () => expectSelected('Details'),
        'P-BASE-TABS-TRIGGER-DISABLED-SUPPRESS-ACTIVATION'
      );
      await check('cleanup', 'journey', 'task', async () => {
        await button(TABS_POLICY.removeName).click();
        assert.equal(await list().count(), 0, 'Named tablist must be removed');
        for (const name of TABS_POLICY.names)
          assert.equal(
            await page.getByRole('tab', { name, exact: true }).count(),
            0,
            'No stale accessible tabs'
          );
        assert.equal(await page.getByRole('tabpanel').count(), 0, 'No stale accessible panels');
        // Removal may already restore focus to the surviving After control.
        // Otherwise measure sequential navigation from a known surviving origin,
        // rather than imposing an undocumented universal focus-restoration rule.
        if (!(await button(TABS_POLICY.afterName).evaluate((n) => n === document.activeElement))) {
          await button(TABS_POLICY.removeName).focus();
          await page.keyboard.press('Tab');
        }
        assert.equal(
          await button(TABS_POLICY.afterName).evaluate((n) => n === document.activeElement),
          true,
          'After fixture is focused or sequentially reachable from surviving Remove control'
        );
      });
      checks.at(-1).evidence = await snapshot('cleanup');
    }
    await check('page-errors', 'evidence', 'host', async () =>
      assert.deepEqual(log.pageErrors, [])
    );
    for (const scope of TABS_POLICY.untested)
      observation(
        `untested.${scope}`,
        'scope',
        null,
        'untested',
        'Outside this candidate Web journey'
      );
  } catch (e) {
    result.execution = 'blocked';
    errors.push({ stage: 'execution', message: e.message });
  } finally {
    if (context) {
      try {
        await context.tracing.stop({ path: path.join(evidenceDir, 'trace.zip') });
        artifacts.push('trace.zip');
      } catch (e) {
        errors.push({ stage: 'trace', message: e.message });
      }
    }
    if (browser)
      await browser.close().catch((e) => errors.push({ stage: 'shutdown', message: e.message }));
    await save('browser-log.json', log);
    result.admission = 'not-admitted';
    result.summary = Object.fromEntries(
      ['platform', 'journey', 'proto', 'evidence', 'scope'].map((layer) => {
        const rows = checks.filter((c) => c.layer === layer);
        return [
          layer,
          Object.fromEntries(
            ['pass', 'fail', 'blocked', 'disputed', 'untested'].map((s) => [
              s,
              rows.filter((c) => c.status === s).length,
            ])
          ),
        ];
      })
    );
    await save('result.json', result);
  }
  return result;
}
