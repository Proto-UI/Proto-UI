import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  RUNTIMES,
  applyColorScheme,
  launchBrowser,
  openRoute,
  selectRuntime,
  startServer,
  stopServer,
} from '../../../../apps/www/src/content/docs/zh-cn/browser-harness.ts';

// Observations for #639, not a contract or a new CI gate. Run from the repository root.
const output = await mkdtemp(path.join(tmpdir(), 'proto-rule-meta-'));
let browser;
console.log(`Rule Meta observations: ${output}`);

async function paint(locator) {
  return locator.evaluateAll(async (elements) => {
    // Let host effects and finite CSS transitions settle before recording paint.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await Promise.allSettled(
      elements.flatMap((element) => element.getAnimations().map((animation) => animation.finished))
    );
    return elements.map((element) => {
      const style = getComputedStyle(element);
      return {
        text: element.textContent?.trim(),
        tokens: element.getAttribute('data-pui-style'),
        background: style.backgroundColor,
        border: style.borderColor,
        color: style.color,
      };
    });
  });
}

try {
  const baseUrl = await startServer('/en/ui-libraries/shadcn/button/');
  browser = await launchBrowser();
  const observations = { browser: browser.version(), buttons: [], controls: [], transitions: [] };

  for (const runtime of RUNTIMES) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(`${baseUrl}/en/ui-libraries/shadcn/button/`, { waitUntil: 'networkidle' });
    await page.getByRole('combobox', { name: '选择适配器', exact: true }).click();
    await page.locator(`wc-shadcn-select-item[data-value="${runtime}"]:visible`).last().click();
    const panel = page.locator(`[data-adapter-panel="${runtime}"]`);
    await panel.waitFor({ state: 'visible' });
    const buttons = panel.locator('.host').getByRole('button');
    await buttons.getByText('Destructive', { exact: true }).waitFor();
    assert.equal(await buttons.count(), 6);
    const entry = { runtime, initialLight: await paint(buttons) };

    await applyColorScheme(page, 'dark');
    entry.darkBeforeInteraction = await paint(buttons);
    await panel.screenshot({ path: path.join(output, `${runtime}-dark-before.png`) });
    await buttons.filter({ hasText: 'Destructive' }).click();
    await page.getByRole('heading', { name: 'Button', exact: true }).click();
    entry.darkAfterInteraction = await paint(buttons);
    await panel.screenshot({ path: path.join(output, `${runtime}-dark-after.png`) });

    await applyColorScheme(page, 'light');
    entry.lightBeforeInteraction = await paint(buttons);
    await buttons.filter({ hasText: 'Destructive' }).click();
    await page.getByRole('heading', { name: 'Button', exact: true }).click();
    entry.lightAfterInteraction = await paint(buttons);
    observations.buttons.push(entry);
    await context.close();
  }

  for (const [control, selector, count] of [
    ['checkbox', '[role="checkbox"]', 5],
    ['switch', '[role="switch"]', 3],
    ['textarea', 'textarea', 3],
  ]) {
    for (const runtime of RUNTIMES) {
      const { context, page, previewer } = await openRoute(
        browser,
        baseUrl,
        `/en/ui-libraries/shadcn/${control}/`,
        { width: 1280, height: 900 }
      );
      await selectRuntime(page, previewer, runtime, selector, count);
      const states = [];
      for (const colorScheme of ['light', 'dark', 'light']) {
        await applyColorScheme(page, colorScheme);
        states.push({ colorScheme, paint: await paint(previewer.locator(`.host ${selector}`)) });
      }
      observations.controls.push({ control, runtime, states });
      await context.close();
    }
  }

  // The public Transition page exposes these three runtimes. This is not a Vue 2 claim.
  for (const runtime of ['wc', 'react', 'vue']) {
    for (const reducedMotion of ['no-preference', 'reduce']) {
      const { context, page, previewer } = await openRoute(
        browser,
        baseUrl,
        '/en/ui-libraries/base/transition/',
        { width: 1280, height: 900 }
      );
      await page.emulateMedia({ reducedMotion });
      await selectRuntime(page, previewer, runtime, '[data-demo-ref="stateLabel"]', 1);
      const label = previewer.locator('[data-demo-ref="stateLabel"]');
      await label.getByText('entered', { exact: true }).waitFor();
      const samples = [];
      for (const [control, terminal] of [
        ['leaveBtn', 'closed'],
        ['enterBtn', 'entered'],
      ]) {
        const observation = label.evaluate(
          (element, expected) =>
            new Promise((resolve) => {
              const started = performance.now();
              const states = [];
              const observer = new MutationObserver(() => {
                const state = element.textContent?.trim();
                states.push({ state, elapsedMs: performance.now() - started });
                if (state !== expected) return;
                observer.disconnect();
                resolve(states);
              });
              observer.observe(element, { childList: true, characterData: true, subtree: true });
            }),
          terminal
        );
        await previewer.locator(`[data-demo-ref="${control}"]`).click();
        samples.push({ control, states: await observation });
      }
      observations.transitions.push({ runtime, reducedMotion, samples });
      await context.close();
    }
  }

  await writeFile(
    path.join(output, 'observations.json'),
    JSON.stringify(observations, null, 2) + '\n'
  );
  console.log(
    `Captured ${observations.buttons.length} Button journeys, ${observations.controls.length} control journeys and ${observations.transitions.length} Transition journeys.`
  );
} finally {
  await browser?.close();
  await stopServer();
}
