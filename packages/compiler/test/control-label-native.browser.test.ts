// @vitest-environment node
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { chromium, type Browser } from '../../../apps/www/node_modules/playwright-core';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { chromeExecutable } from '../../../apps/www/src/content/docs/zh-cn/browser-harness';
import { buildControlLabelNativeFixture } from './control-label-native-browser-fixture';
import type { createControlLabelBrowserFixture } from './control-label-browser-consumer';

declare global {
  interface Window {
    controlLabelNative: { fixture: ReturnType<typeof createControlLabelBrowserFixture> };
    controlLabelNativeEvents: { type: string; trusted: boolean; target: string | null }[];
  }
}
let browser: Browser;
let fixture: Awaited<ReturnType<typeof buildControlLabelNativeFixture>>;
beforeAll(async () => {
  fixture = await buildControlLabelNativeFixture();
  // A sandboxed launch is a real environment requirement, never a reason to
  // append --no-sandbox or change Chromium's process isolation for this test.
  browser = await chromium.launch({
    executablePath: await chromeExecutable(),
    headless: true,
    chromiumSandbox: true,
  });
  await writeFile(path.join(fixture.evidenceDir, 'browser-version.txt'), browser.version());
}, 60_000);
afterAll(async () => {
  await browser?.close();
});

const compositions = [
  ['compiled', 'compiled'],
  ['compiled', 'runtime'],
  ['runtime', 'compiled'],
] as const;
const cases = (['react', 'vue', 'vue2', 'wc'] as const).flatMap((target) =>
  (['button', 'toggle'] as const).flatMap((kind) =>
    compositions.map(([labelExecution, targetExecution]) => ({
      target,
      kind,
      labelExecution,
      targetExecution,
    }))
  )
);

it.each(cases)(
  '$target $labelExecution Label + $targetExecution $kind preserves native input ownership',
  async (scenario) => {
    const { target, kind, labelExecution, targetExecution } = scenario;
    const name = `${target}-${kind}-${labelExecution}-${targetExecution}`;
    const page = await browser.newPage({
      viewport: { width: 960, height: 640 },
      reducedMotion: 'reduce',
    });
    page.setDefaultTimeout(5_000);
    const errors: string[] = [];
    const blocked: string[] = [];
    const snapshots: unknown[] = [];
    const captureErrors: { stage: string; error: string }[] = [];
    let failed = false;
    let failure: unknown;
    let failureStage: string | null = null;
    let finalState: unknown;
    let nativeInput: unknown;
    const describeError = (error: unknown) => {
      try {
        return error instanceof Error ? (error.stack ?? error.message) : String(error);
      } catch {
        return '<unprintable thrown value>';
      }
    };
    const recordFailure = (error: unknown, stage: string) => {
      if (!failed) {
        failed = true;
        failure = error;
        failureStage = stage;
      }
    };
    const capture = async (stage: string, action: () => Promise<unknown>) => {
      try {
        await action();
      } catch (error) {
        captureErrors.push({ stage, error: describeError(error) });
      }
    };
    const writeResult = async () => {
      try {
        await writeFile(
          path.join(fixture.evidenceDir, name + '-result.json'),
          JSON.stringify(
            {
              head: fixture.head,
              buildSha256: fixture.buildSha256,
              scenario,
              outcome: failed ? 'FAIL' : 'PASS',
              snapshots,
              errors,
              blocked,
              failure: failed ? { stage: failureStage, error: describeError(failure) } : null,
              finalState,
              nativeInput,
              captureErrors,
            },
            null,
            2
          ) + '\n'
        );
      } catch (error) {
        recordFailure(error, 'result-write');
        captureErrors.push({ stage: 'result-write', error: describeError(error) });
      }
    };
    const read = () => page.evaluate(() => window.controlLabelNative.fixture.read());
    page.on('pageerror', (error) => {
      errors.push(error.message);
      recordFailure(error, 'pageerror');
    });
    try {
      await page.route('**/*', (route) => {
        blocked.push(route.request().url());
        return route.abort();
      });
      await page.setContent(
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Control Label native consumer</title></head><body><h1>Control Label native consumer</h1><main id="mount"></main></body></html>'
      );
      await page.addStyleTag({
        content:
          'body{font:18px system-ui;color:#172033;padding:32px}#mount{display:flex;gap:24px;align-items:center}.consumer-host{display:contents}[data-control-label-test="target"]{display:inline-flex;min-width:48px;min-height:44px;border:2px solid #64748b;border-radius:6px;background:#eef2ff}[data-control-label-test="label"]{display:inline-flex;padding:14px;cursor:pointer}[data-control-label-test="target"]:focus{outline:3px solid #2563eb;outline-offset:3px}',
      });
      await page.addScriptTag({ content: fixture.bundle });
      await page.evaluate(async (args) => {
        window.controlLabelNativeEvents = [];
        for (const type of ['pointerdown', 'pointerup', 'click', 'keydown'])
          document.addEventListener(
            type,
            (event) =>
              window.controlLabelNativeEvents.push({
                type,
                trusted: event.isTrusted,
                target:
                  event.target instanceof HTMLElement
                    ? (event.target.dataset.controlLabelTest ?? null)
                    : null,
              }),
            true
          );
        await window.controlLabelNative.fixture.mount(
          args.target,
          args.kind,
          args.labelExecution,
          args.targetExecution
        );
      }, scenario);
      const label = page.locator('[data-control-label-test="label"]');
      const initial = await read();
      snapshots.push({ step: 'paired', ...initial });
      expect(initial.labelId).not.toBe('');
      expect(initial.labelledBy).toBe(initial.labelId);
      expect(initial.explicitName).toBeNull();
      expect(initial.associationAttribute).toBeNull();
      expect(initial.labelTabIndex).toBeNull();
      expect(initial.labelRole).not.toBe('button');
      expect(
        await page.getByRole('button', { name: 'Visible control name', exact: true }).count()
      ).toBe(1);
      await label.click();
      const activated = await read();
      snapshots.push({ step: 'label-pointer', ...activated });
      expect(activated.signals).toEqual(kind === 'button' ? ['click'] : [{ active: true }]);
      expect(activated.focused).toBe(true);
      if (kind === 'toggle') expect(activated.pressed).toBe('true');
      await capture('activated-screenshot', () =>
        page.screenshot({ path: path.join(fixture.evidenceDir, name + '-activated.png') })
      );
      await page.keyboard.press(kind === 'button' ? 'Enter' : 'Space');
      const keyboard = await read();
      snapshots.push({ step: 'target-keyboard', ...keyboard });
      expect(keyboard.signals).toEqual(
        kind === 'button' ? ['click', 'click'] : [{ active: true }, { active: false }]
      );
      if (kind === 'toggle') {
        await page.evaluate(() =>
          window.controlLabelNative.fixture.setTargetProps({ active: false })
        );
        await label.click();
        const controlled = await read();
        snapshots.push({ step: 'controlled-refusal', ...controlled });
        expect(controlled.signals).toEqual([{ active: true }, { active: false }, { active: true }]);
        expect(controlled.pressed).toBe('false');
      }
      const beforeDisabled = (await read()).signals;
      await page.evaluate(async (toggle) => {
        await window.controlLabelNative.fixture.setTargetProps({
          disabled: true,
          ...(toggle ? { active: false } : {}),
        });
        window.controlLabelNative.fixture.blurTarget();
      }, kind === 'toggle');
      await label.click();
      const disabled = await read();
      snapshots.push({ step: 'disabled', ...disabled });
      expect(disabled.signals).toEqual(beforeDisabled);
      expect(disabled.focused).toBe(false);
      expect(disabled.labelledBy).toBe(disabled.labelId);
      await page.evaluate(async (toggle) => {
        await window.controlLabelNative.fixture.setTargetProps(toggle ? { active: false } : {});
        await window.controlLabelNative.fixture.replaceLabelReference();
      }, kind === 'toggle');
      await label.click();
      const replaced = await read();
      snapshots.push({ step: 'unpaired-replacement', ...replaced });
      expect(replaced.signals).toEqual(beforeDisabled);
      expect(replaced.labelledBy).toBeNull();
      await page.evaluate(() => window.controlLabelNative.fixture.matchTargetReference());
      await expect.poll(async () => (await read()).labelledBy).toBe((await read()).labelId);
      const beforeReentry = (await read()).signals;
      await page.evaluate(() => {
        window.controlLabelNative.fixture.blurTarget();
        window.controlLabelNative.fixture.detachLabelOnFocus();
      });
      await label.click();
      await expect.poll(async () => (await read()).labelledBy).toBeNull();
      const reentered = await read();
      snapshots.push({ step: 'focus-reentry-detach', ...reentered });
      expect(reentered.labelConnected).toBe(false);
      expect(reentered.signals).toEqual(beforeReentry);
      const observedNativeInput = await page.evaluate(() => window.controlLabelNativeEvents);
      nativeInput = observedNativeInput;
      expect(
        observedNativeInput.some(
          (event) => event.type === 'pointerdown' && event.target === 'label' && event.trusted
        )
      ).toBe(true);
      expect(
        observedNativeInput.some(
          (event) => event.type === 'keydown' && event.target === 'target' && event.trusted
        )
      ).toBe(true);
      expect(errors).toEqual([]);
      expect(blocked).toEqual([]);
    } catch (error) {
      recordFailure(error, 'scenario');
    } finally {
      // Persist the primary outcome before optional browser diagnostics. A crashed
      // page or failed screenshot must never replace the first assertion/page error.
      await writeResult();
      await capture('final-state', async () => {
        finalState = await read();
      });
      await capture('native-input', async () => {
        nativeInput = await page.evaluate(() => window.controlLabelNativeEvents);
      });
      await capture('final-screenshot', () =>
        page.screenshot({
          path: path.join(fixture.evidenceDir, name + (failed ? '-FAIL.png' : '-PASS.png')),
        })
      );
      try {
        await page.evaluate(() => window.controlLabelNative.fixture.dispose());
      } catch (error) {
        recordFailure(error, 'dispose');
        captureErrors.push({ stage: 'dispose', error: describeError(error) });
      } finally {
        try {
          await page.close();
        } catch (error) {
          recordFailure(error, 'page-close');
          captureErrors.push({ stage: 'page-close', error: describeError(error) });
        }
      }
      await writeResult();
    }
    if (failed) throw failure;
  },
  30_000
);
