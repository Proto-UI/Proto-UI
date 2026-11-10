import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import type { ElementHandle, JSHandle, Page } from 'playwright-core';
import type * as ContrastProbe from './contrast-probe.browser';
import type * as TooltipProbe from './contrast-tooltip-handoff.browser';
import type {
  TooltipHandoffBinding,
  TooltipHandoffPhase,
  TooltipHandoffPlan,
} from './contrast-tooltip-handoff.browser';
import { runTooltipWarmHandoff } from './contrast-tooltip-handoff.mjs';

interface BrowserGlobals {
  puiContrastProbe: typeof ContrastProbe;
  puiTooltipHandoff: typeof TooltipProbe;
}
export interface NativeTooltipAuditSubject {
  previewer: ElementHandle<HTMLElement>;
  previewerId: string;
  expected: ContrastProbe.ContrastProjectionExpectation;
}

/** Compile once per audit run and retain this exact executed code with its receipt. */
export async function prepareTooltipHandoffProbe() {
  const source = await readFile(new URL('./contrast-tooltip-handoff.browser.ts', import.meta.url), 'utf8');
  const { code } = await transform(source, {
    loader: 'ts', format: 'iife', globalName: 'puiTooltipHandoff', keepNames: false,
  });
  return {
    code,
    sourceDigest: `sha256:${createHash('sha256').update(source).digest('hex')}`,
    executedDigest: `sha256:${createHash('sha256').update(code).digest('hex')}`,
    transform: { loader: 'ts', format: 'iife', globalName: 'puiTooltipHandoff', keepNames: false },
  };
}

/** Shared by the real contrast collector and the dedicated native boundary consumer. */
export async function bindNativeTooltipHandoff(
  page: Page,
  subject: NativeTooltipAuditSubject,
  plan: TooltipHandoffPlan
) {
  const binding: JSHandle<TooltipHandoffBinding> = await page.evaluateHandle(
    ({ subject, plan }) => {
      const globals = globalThis as unknown as BrowserGlobals;
      return globals.puiTooltipHandoff.bindTooltipWarmHandoff(subject, plan, globals.puiContrastProbe);
    },
    { subject, plan }
  );
  const triggers: ElementHandle<HTMLElement>[] = [];
  try {
    for (const index of [0, 1])
      triggers.push(await binding.evaluateHandle((value, index) => value.pairs[index].trigger, index));
  } catch (error) {
    for (const trigger of triggers) await trigger.dispose();
    await binding.dispose();
    throw error;
  }
  return {
    binding,
    triggers,
    async arm(phase: TooltipHandoffPhase) {
      await binding.evaluate((value, phase) => {
        (globalThis as unknown as BrowserGlobals).puiTooltipHandoff.armTooltipHandoffPointer(value, phase);
      }, phase);
    },
    async hover(index: number) {
      // ElementHandle keeps the original physical Trigger; locator re-resolution
      // must not silently adopt a replacement during the journey.
      await triggers[index].hover();
    },
    async wait(phase: TooltipHandoffPhase) {
      const result = await page.waitForFunction(
        ({ binding, phase }) => {
          if (binding.pointer?.phase !== phase) throw new Error('Tooltip pointer phase changed.');
          return (globalThis as unknown as BrowserGlobals).puiTooltipHandoff.readTooltipHandoffPointerResult(binding);
        },
        { binding, phase },
        { polling: 'raf', timeout: phase === 'cold' ? plan.coldDeadlineMs + 2500 : 2500 }
      );
      try {
        return await result.jsonValue();
      } finally {
        await result.dispose();
      }
    },
    async observe(phase: TooltipHandoffPhase) {
      return binding.evaluate((value, phase) =>
        (globalThis as unknown as BrowserGlobals).puiTooltipHandoff.readTooltipWarmHandoff(value, phase), phase);
    },
    async dispose() {
      try {
        await binding.evaluate((value) => {
          (globalThis as unknown as BrowserGlobals).puiTooltipHandoff.disposeTooltipHandoff(value);
        });
      } finally {
        for (const trigger of triggers) await trigger.dispose();
        await binding.dispose();
      }
    },
    async run(capture: (state: string) => Promise<void>, record: Record<string, unknown>) {
      try {
        return await runTooltipWarmHandoff({
          arm: this.arm,
          hover: this.hover,
          wait: this.wait,
          capture,
          record,
        });
      } catch (error) {
        try {
          record.failedNativeObservation = await binding.evaluate((value) =>
            (globalThis as unknown as BrowserGlobals).puiTooltipHandoff.readTooltipHandoffDiagnostics(value));
        } catch (diagnosticError) {
          record.diagnosticsUnavailable = diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError);
        }
        throw error;
      }
    },
  };
}
