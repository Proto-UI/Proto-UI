import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(new URL('../../apps/www/package.json', import.meta.url));
const domains = {
  'dialog-open-close': 'html-native-dialog',
  'tabs-manual-activation': 'html-aria-manual-tabs',
  'select-keyboard': 'html-native-select',
};
const viewport = { width: 1000, height: 760 };
const policy =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'";

/**
 * Public development/calibration oracle only. The input is a hand-authored HTML
 * reference (or an intentionally mutated negative control), never model output.
 * These checks validate the measurement path, not any Proto implementation.
 * Chromium's accessibility tree is supporting evidence, not screen-reader proof.
 */
export async function evaluateCalibration({
  caseId,
  htmlPath,
  evidenceDir,
  chromiumPath = '/usr/bin/chromium',
}) {
  if (!Object.hasOwn(domains, caseId))
    throw new Error(`Unknown public calibration case: ${caseId}`);
  await mkdir(evidenceDir, { recursive: true });
  const checks = [];
  const failures = [];
  const artifacts = [];
  const log = {
    console: [],
    pageErrors: [],
    blockedRequests: [],
    failedRequests: [],
    trustedInput: [],
  };
  const environment = {
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    osRelease: os.release(),
    viewport,
    locale: 'en-US',
    timezoneId: 'UTC',
    headless: true,
    inputMode: 'Playwright trusted keyboard and pointer events; DOM reads for assertions',
    semanticDomain: domains[caseId],
    fixtureOrigin: 'hand-authored-public-reference',
    scope: 'public-harness-calibration-only',
    protoConformance: 'untested',
    accessibilityEvidence:
      'Chromium accessibility tree; no assistive-technology or screen-reader test',
    networkPolicy:
      'All page requests aborted; service workers blocked; restrictive inline-only CSP',
    timeouts: {
      launchMs: 10_000,
      actionMs: 1_200,
      screenshotMs: 5_000,
      totalMs: null,
      limitation:
        'Per-operation timeouts are not a total-run bound. CDP snapshots, artifact writes, and shutdown have no evaluator-wide deadline; the caller must impose a process timeout for untrusted or hanging input.',
    },
  };
  const browserInfo = { name: 'chromium', version: null, executable: chromiumPath };
  let browser;
  let context;
  let page;
  let cdp;
  let traceStarted = false;
  let checkpointIndex = 0;
  let lastEvidence = [];

  async function json(filename, value) {
    await writeFile(path.join(evidenceDir, filename), `${JSON.stringify(value, null, 2)}\n`);
    if (!artifacts.includes(filename)) artifacts.push(filename);
    return filename;
  }
  function recordFailure(stage, error) {
    failures.push({ stage, message: error instanceof Error ? error.message : String(error) });
  }
  async function snapshot(label) {
    const prefix = `${String(++checkpointIndex).padStart(2, '0')}-${label}`;
    const names = [];
    await page.screenshot({
      path: path.join(evidenceDir, `${prefix}.png`),
      fullPage: true,
      animations: 'disabled',
      timeout: environment.timeouts.screenshotMs,
    });
    artifacts.push(`${prefix}.png`);
    names.push(`${prefix}.png`);
    names.push(
      await json(
        `${prefix}.dom.json`,
        await page.evaluate(() => ({
          html: document.documentElement.outerHTML,
          activeElement: document.activeElement?.id ?? null,
          title: document.title,
          controls: [
            ...document.querySelectorAll('button, input, select, option, dialog, [role]'),
          ].map((node) => ({
            tag: node.tagName.toLowerCase(),
            id: node.id,
            role: node.getAttribute('role'),
            text: node.textContent?.trim(),
            hidden: node.hidden,
            rendered: Boolean(node.getClientRects().length),
            disabled: Boolean(node.disabled),
            tabIndex: node.tabIndex,
            selected: node.getAttribute('aria-selected'),
            controls: node.getAttribute('aria-controls'),
            labelledBy: node.getAttribute('aria-labelledby'),
            value: 'value' in node ? node.value : null,
            open: node instanceof HTMLDialogElement ? node.open : null,
          })),
        }))
      )
    );
    names.push(
      await json(`${prefix}.accessibility.json`, {
        evidenceType: 'chromium-accessibility-tree',
        limitation: 'Not a screen-reader or other assistive-technology test',
        ...(await cdp.send('Accessibility.getFullAXTree')),
      })
    );
    lastEvidence = names;
    return names;
  }
  async function check(id, dimension, reason, assertion) {
    let status = 'pass';
    let detail = reason;
    try {
      await assertion();
    } catch (error) {
      status = 'fail';
      detail = `${reason}: ${error.message ?? String(error)}`;
      recordFailure(id, error);
    }
    checks.push({ id, dimension, status, reason: detail, evidence: [...lastEvidence] });
  }
  // A failed interaction is a failed check; it cannot become a passing assertion.
  async function step(id, dimension, reason, action, assertion) {
    await check(id, dimension, reason, async () => {
      await action();
      await assertion();
    });
    try {
      const evidence = await snapshot(id);
      checks.at(-1).evidence = evidence;
    } catch (error) {
      recordFailure(`evidence.${id}`, error);
      checks.push({
        id: `evidence.${id}`,
        dimension: 'host',
        status: 'fail',
        reason: error.message,
        evidence: [...lastEvidence],
      });
    }
  }
  async function active(expected) {
    assert.equal(
      await page.evaluate(() => document.activeElement?.id),
      expected,
      'focused element'
    );
  }
  async function ax(role, name) {
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    const node = nodes.find(
      (item) => !item.ignored && item.role?.value === role && item.name?.value === name
    );
    assert.ok(node, `No exposed accessibility node with role=${role} name=${JSON.stringify(name)}`);
    return node;
  }
  async function selectedTab(expected) {
    assert.deepEqual(
      await page
        .locator('[role="tab"][aria-selected="true"]')
        .evaluateAll((nodes) => nodes.map((n) => n.id)),
      [expected]
    );
    assert.deepEqual(
      await page
        .locator('[role="tabpanel"]')
        .evaluateAll((nodes) => nodes.filter((n) => !n.hidden).map((n) => n.id)),
      [expected.replace('tab-', 'panel-')]
    );
  }
  async function dialogOpen(expected) {
    assert.equal(await page.locator('#reference-dialog').evaluate((node) => node.open), expected);
    assert.equal(await page.locator('dialog:modal').count(), expected ? 1 : 0);
  }
  async function selectValue(expected) {
    assert.equal(await page.locator('#reference-select').inputValue(), expected);
    assert.equal(await page.locator('#selection-output').textContent(), expected);
  }

  try {
    const { chromium } = require('playwright-core');
    environment.playwrightVersion = require('playwright-core/package.json').version;
    const html = await readFile(htmlPath, 'utf8');
    browser = await chromium.launch({
      executablePath: chromiumPath,
      headless: true,
      timeout: environment.timeouts.launchMs,
      args: ['--disable-background-networking'],
    });
    browserInfo.version = browser.version();
    context = await browser.newContext({
      viewport,
      locale: 'en-US',
      timezoneId: 'UTC',
      colorScheme: 'light',
      serviceWorkers: 'block',
      offline: true,
    });
    await context.route('**/*', async (route) => {
      log.blockedRequests.push({
        url: route.request().url(),
        method: route.request().method(),
        resourceType: route.request().resourceType(),
      });
      await route.abort('blockedbyclient');
    });
    await context.routeWebSocket('**/*', (socket) => {
      log.blockedRequests.push({
        url: socket.url(),
        method: 'WEBSOCKET',
        resourceType: 'websocket',
      });
      socket.close();
    });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    traceStarted = true;
    page = await context.newPage();
    page.setDefaultTimeout(environment.timeouts.actionMs);
    page.on('console', (message) =>
      log.console.push({ type: message.type(), text: message.text() })
    );
    page.on('pageerror', (error) => log.pageErrors.push(error.message));
    page.on('requestfailed', (request) =>
      log.failedRequests.push({ url: request.url(), error: request.failure()?.errorText })
    );
    cdp = await context.newCDPSession(page);
    // Inject the policy before any fixture script or resource can run.
    assert.match(
      html,
      /<head(?:\s[^>]*)?>/i,
      'Public calibration HTML must contain a head element'
    );
    const securedHtml = html.replace(
      /<head(?:\s[^>]*)?>/i,
      (head) => `${head}\n<meta http-equiv="Content-Security-Policy" content="${policy}">`
    );
    await page.setContent(securedHtml, { waitUntil: 'load' });
    await page.evaluate(() => {
      window.__calibrationInput = [];
      for (const type of ['keydown', 'click', 'focusin', 'input', 'change']) {
        window.addEventListener(
          type,
          (event) => {
            window.__calibrationInput.push({
              type,
              isTrusted: event.isTrusted,
              key: event.key ?? null,
              target: event.target?.id ?? null,
            });
          },
          true
        );
      }
    });
    await snapshot('initial');
  } catch (error) {
    recordFailure('setup', error);
    checks.push({
      id: 'host.browser-ready',
      dimension: 'host',
      status: 'blocked',
      reason: `Calibration could not start: ${error.message}`,
      evidence: [],
    });
  }

  if (page && cdp && !checks.some((item) => item.status === 'blocked')) {
    try {
      await check(
        'host.fixture-domain',
        'host',
        'Hand-authored public fixture declares the expected HTML-only scope',
        async () => {
          assert.equal(
            await page.locator('#fixture').getAttribute('data-calibration-domain'),
            domains[caseId]
          );
        }
      );
      if (caseId === 'dialog-open-close') {
        await check(
          'dialog.initial-closed',
          'behavior',
          'Dialog starts closed and outside the modal top layer',
          () => dialogOpen(false)
        );
        await step(
          'dialog.keyboard-open',
          'keyboard',
          'Tab then Enter opens the dialog through trusted keyboard input',
          async () => {
            await page.keyboard.press('Tab');
            await active('open-dialog');
            await page.keyboard.press('Enter');
          },
          () => dialogOpen(true)
        );
        await check(
          'dialog.initial-focus',
          'focus',
          'Opening places focus on the dialog input',
          () => active('display-name')
        );
        await check(
          'dialog.accessible-name',
          'accessibility',
          'Modal dialog has a name and description in Chromium accessibility output',
          async () => {
            const node = await ax('dialog', 'Reference settings');
            assert.equal(
              node.description?.value,
              'A public harness fixture for a modal keyboard journey.'
            );
            assert.ok(
              node.properties?.some(
                (property) => property.name === 'modal' && property.value.value === true
              )
            );
          }
        );
        await step(
          'dialog.reverse-tab-wrap',
          'focus',
          'Shift+Tab from first control wraps to the last control',
          () => page.keyboard.press('Shift+Tab'),
          () => active('save-dialog')
        );
        await step(
          'dialog.forward-tab-wrap',
          'focus',
          'Tab from last control wraps to the first control',
          () => page.keyboard.press('Tab'),
          () => active('display-name')
        );
        await step(
          'dialog.escape-close',
          'keyboard',
          'Escape closes the dialog',
          () => page.keyboard.press('Escape'),
          () => dialogOpen(false)
        );
        await check(
          'dialog.escape-focus-return',
          'focus',
          'Escape returns focus to the trigger',
          () => active('open-dialog')
        );
        await step(
          'dialog.pointer-reopen',
          'lifecycle',
          'A pointer click can reopen the previously dismissed dialog',
          () => page.locator('#open-dialog').click(),
          () => dialogOpen(true)
        );
        await step(
          'dialog.cancel-close',
          'behavior',
          'The Cancel button closes the reopened dialog',
          () => page.locator('#cancel-dialog').click(),
          () => dialogOpen(false)
        );
        await check(
          'dialog.cancel-focus-return',
          'focus',
          'Cancel returns focus to the trigger',
          () => active('open-dialog')
        );
        await step(
          'dialog.repeat-cycle',
          'lifecycle',
          'Another open/save cycle leaves one closed dialog and restores trigger focus',
          async () => {
            await page.locator('#open-dialog').click();
            await dialogOpen(true);
            await page.locator('#save-dialog').click();
          },
          async () => {
            await dialogOpen(false);
            await active('open-dialog');
            assert.equal(await page.locator('#reference-dialog').count(), 1);
          }
        );
      } else if (caseId === 'tabs-manual-activation') {
        await check(
          'tabs.initial-selection',
          'behavior',
          'Only Overview and its panel are selected and visible initially',
          () => selectedTab('tab-overview')
        );
        await check(
          'tabs.accessibility-relationships',
          'accessibility',
          'Tabs and panels have explicit reciprocal relationships and exposed labels',
          async () => {
            await ax('tablist', 'Reference sections');
            await ax('tab', 'Overview');
            await ax('tabpanel', 'Overview');
            assert.equal(
              await page.locator('[role="tab"]').evaluateAll((tabs) =>
                tabs.every((tab) => {
                  const panel = document.getElementById(tab.getAttribute('aria-controls'));
                  return (
                    panel?.getAttribute('role') === 'tabpanel' &&
                    panel.getAttribute('aria-labelledby') === tab.id
                  );
                })
              ),
              true
            );
          }
        );
        await step(
          'tabs.tab-entry',
          'focus',
          'Tab enters the selected roving tab stop',
          () => page.keyboard.press('Tab'),
          () => active('tab-overview')
        );
        await step(
          'tabs.arrow-skip-disabled',
          'keyboard',
          'ArrowRight skips the disabled tab and focuses Details',
          () => page.keyboard.press('ArrowRight'),
          () => active('tab-details')
        );
        await check(
          'tabs.manual-navigation',
          'behavior',
          'Moving focus does not activate another panel in manual mode',
          () => selectedTab('tab-overview')
        );
        await check(
          'tabs.one-roving-stop',
          'focus',
          'Only the newly focused Details tab remains in the tab sequence',
          async () => {
            assert.deepEqual(
              await page
                .locator('[role="tab"]')
                .evaluateAll((tabs) =>
                  tabs.filter((tab) => tab.tabIndex === 0).map((tab) => tab.id)
                ),
              ['tab-details']
            );
          }
        );
        await step(
          'tabs.enter-activate',
          'keyboard',
          'Enter activates the focused Details tab',
          () => page.keyboard.press('Enter'),
          () => selectedTab('tab-details')
        );
        await step(
          'tabs.end-navigation',
          'keyboard',
          'End moves focus to History without selecting it',
          () => page.keyboard.press('End'),
          async () => {
            await active('tab-history');
            await selectedTab('tab-details');
          }
        );
        await step(
          'tabs.space-activate',
          'keyboard',
          'Space activates History',
          () => page.keyboard.press('Space'),
          () => selectedTab('tab-history')
        );
        await step(
          'tabs.arrow-wrap',
          'keyboard',
          'ArrowRight wraps from the last enabled tab to the first without activation',
          () => page.keyboard.press('ArrowRight'),
          async () => {
            await active('tab-overview');
            await selectedTab('tab-history');
          }
        );
        await step(
          'tabs.reverse-wrap',
          'keyboard',
          'ArrowLeft wraps back to the last enabled tab',
          () => page.keyboard.press('ArrowLeft'),
          () => active('tab-history')
        );
        await step(
          'tabs.home-navigation',
          'keyboard',
          'Home moves to the first tab without activation',
          () => page.keyboard.press('Home'),
          async () => {
            await active('tab-overview');
            await selectedTab('tab-history');
          }
        );
        await step(
          'tabs.pointer-selection',
          'behavior',
          'Pointer activation selects Overview',
          () => page.locator('#tab-overview').click(),
          () => selectedTab('tab-overview')
        );
        await step(
          'tabs.repeated-selection',
          'lifecycle',
          'Repeated selection produces no duplicate tabs or panels',
          async () => {
            await page.locator('#tab-details').click();
            await selectedTab('tab-details');
            await page.locator('#tab-overview').click();
            await page.locator('#tab-overview').click();
          },
          async () => {
            await selectedTab('tab-overview');
            assert.equal(await page.locator('[role="tab"]').count(), 4);
            assert.equal(await page.locator('[role="tabpanel"]').count(), 4);
          }
        );
      } else {
        await check(
          'select.finite-single-selection',
          'behavior',
          'The HTML control is a finite native single-select with Alpha initially selected',
          async () => {
            assert.deepEqual(
              await page.locator('#reference-select').evaluate((node) => ({
                tag: node.tagName,
                multiple: node.multiple,
                options: node.options.length,
                selected: node.selectedOptions.length,
              })),
              { tag: 'SELECT', multiple: false, options: 4, selected: 1 }
            );
            await selectValue('alpha');
          }
        );
        await check(
          'select.accessible-label',
          'accessibility',
          'The native select has its visible label in Chromium accessibility output',
          async () => {
            await ax('combobox', 'Reference choice');
          }
        );
        await step(
          'select.tab-entry',
          'focus',
          'Tab focuses the native select',
          () => page.keyboard.press('Tab'),
          () => active('reference-select')
        );
        await step(
          'select.down-skip-disabled',
          'keyboard',
          'ArrowDown commits Gamma, skipping disabled Beta in this native Chromium control',
          () => page.keyboard.press('ArrowDown'),
          () => selectValue('gamma')
        );
        await step(
          'select.down-next',
          'keyboard',
          'ArrowDown commits the next enabled value',
          () => page.keyboard.press('ArrowDown'),
          () => selectValue('delta')
        );
        await step(
          'select.end-boundary',
          'behavior',
          'ArrowDown at the last option preserves a single Delta selection',
          () => page.keyboard.press('ArrowDown'),
          async () => {
            await selectValue('delta');
            assert.equal(
              await page
                .locator('#reference-select')
                .evaluate((node) => node.selectedOptions.length),
              1
            );
          }
        );
        await step(
          'select.reverse-navigation',
          'keyboard',
          'Repeated ArrowUp skips disabled Beta and returns to Alpha',
          async () => {
            await page.keyboard.press('ArrowUp');
            await selectValue('gamma');
            await page.keyboard.press('ArrowUp');
          },
          () => selectValue('alpha')
        );
        await step(
          'select.repeat-cycle',
          'lifecycle',
          'A repeated keyboard round trip keeps the native value and visible output synchronized',
          async () => {
            await page.keyboard.press('ArrowDown');
            await selectValue('gamma');
            await page.keyboard.press('ArrowUp');
          },
          () => selectValue('alpha')
        );
        await check(
          'select.focus-retained',
          'focus',
          'Native keyboard changes leave focus on the select',
          () => active('reference-select')
        );
        await step(
          'select.label-pointer-focus',
          'focus',
          'Clicking the visible label moves focus back from an outside button to the native select',
          async () => {
            await page.locator('#after-fixture').click();
            await active('after-fixture');
            await page.locator('label[for="reference-select"]').click();
          },
          () => active('reference-select')
        );
      }
      await step(
        'cleanup.remove-fixture',
        'cleanup',
        'The remove control detaches the reference root with no remaining modal element',
        () => page.locator('#remove-fixture').click(),
        async () => {
          assert.equal(await page.locator('#fixture').count(), 0);
          assert.equal(await page.locator('dialog:modal').count(), 0);
        }
      );
      await step(
        'cleanup.keyboard-after-removal',
        'cleanup',
        'Tab reaches the outside button after fixture removal',
        () => page.keyboard.press('Tab'),
        () => active('after-fixture')
      );
      log.trustedInput = await page.evaluate(() => window.__calibrationInput);
      await check(
        'host.trusted-input',
        'host',
        'The journey captured browser-trusted keyboard and pointer events',
        async () => {
          assert.ok(log.trustedInput.some((event) => event.type === 'keydown' && event.isTrusted));
          assert.ok(log.trustedInput.some((event) => event.type === 'click' && event.isTrusted));
          assert.equal(
            log.trustedInput.filter(
              (event) =>
                !event.isTrusted && ['keydown', 'click', 'input', 'change'].includes(event.type)
            ).length,
            0
          );
        }
      );
      await check(
        'host.no-runtime-errors',
        'host',
        'No uncaught page errors or error-level console messages occurred',
        async () => {
          assert.deepEqual(log.pageErrors, []);
          assert.deepEqual(
            log.console.filter((message) => message.type === 'error'),
            []
          );
        }
      );
      await check(
        'host.no-network',
        'host',
        'The local-only reference attempted no external requests',
        async () => {
          assert.deepEqual(log.blockedRequests, []);
          assert.deepEqual(log.failedRequests, []);
        }
      );
    } catch (error) {
      recordFailure('journey', error);
      checks.push({
        id: 'host.journey-completed',
        dimension: 'host',
        status: 'fail',
        reason: `Unexpected evaluator error: ${error.message}`,
        evidence: [...lastEvidence],
      });
    }
  }
  checks.push({
    id: 'scope.proto-conformance',
    dimension: 'behavior',
    status: 'untested',
    evidence: [],
    reason:
      'Hand-authored HTML calibration does not execute Proto, adapters, generated facades, or compiler output; no Proto conformance or model-evaluation claim is supported.',
  });
  for (const [stage, operation] of [
    [
      'trace',
      async () => {
        if (traceStarted) {
          await context.tracing.stop({ path: path.join(evidenceDir, 'trace.zip') });
          artifacts.push('trace.zip');
        }
      },
    ],
    ['context-close', async () => context?.close()],
    ['browser-close', async () => browser?.close()],
  ]) {
    try {
      await operation();
    } catch (error) {
      recordFailure(stage, error);
      checks.push({
        id: `host.${stage}`,
        dimension: stage === 'trace' ? 'host' : 'cleanup',
        status: 'fail',
        reason: error.message,
        evidence: [],
      });
    }
  }
  await json('logs.json', log);
  await json('failures.json', failures);
  for (const item of checks) {
    item.evidence.push('logs.json');
    if (artifacts.includes('trace.zip')) item.evidence.push('trace.zip');
    if (item.status === 'fail' || item.status === 'blocked') item.evidence.push('failures.json');
  }
  return { checks, browser: browserInfo, environment, failures, artifacts };
}
