import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page, Locator, ElementHandle, JSHandle } from 'playwright-core';
import type * as JourneyAPI from './contrast-native-journeys.mjs';
import type {
  DialogOutsideBinding, HoverBridgeBinding, ButtonKeyboardBinding,
} from './contrast-native-journeys.mjs';
import { CONTRAST_JOURNEY_TRANSFORM_ENDPOINT } from './contrast-native-journeys-plugin.mjs';

type JourneyGlobal = typeof globalThis & { puiContrastJourneys: typeof JourneyAPI };
type Observation = JourneyAPI.NativeJourneyObservation;
type JourneySubjectHandle = Omit<JourneyAPI.NativeJourneySubject, 'previewer'> & {
  previewer: ElementHandle<HTMLElement>;
};
type JourneyControlRecord = {
  kind: string;
  input: { method: string; point: JourneyAPI.NativePoint };
  result?: Observation;
  contentReused?: boolean;
};
type JourneyContext = {
  page: Page;
  subject: JourneySubjectHandle;
  target: Locator;
  owned(prototype: string): Promise<Locator>;
  settle(): Promise<void>;
  capture(state: string, observe: () => Promise<Observation>): Promise<void>;
  record: Record<string, unknown>;
};
const digest = (bytes: string) => createHash('sha256').update(bytes).digest('hex');

export type ContrastButtonTransform = {
  schemaVersion: number;
  source: string;
  originalSHA: string;
  helperSHA: string;
  transformedSHA: string;
  receipt: string;
  limitation: string;
};
export async function retainContrastButtonTransform({
  baseUrl, output, recipeSHA, helperSHA,
}: { baseUrl: string; output: string; recipeSHA: string; helperSHA: string }): Promise<ContrastButtonTransform> {
  const response = await fetch(new URL(CONTRAST_JOURNEY_TRANSFORM_ENDPOINT, baseUrl), {
    cache: 'no-store', signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Button command source binding unavailable: HTTP ${response.status}.`);
  const receipt = await response.json();
  if (receipt.schemaVersion !== 1 ||
      receipt.source !== 'apps/www/src/content/docs/zh-cn/demo-brutalist-button.demo.ts' ||
      typeof receipt.original !== 'string' || typeof receipt.transformed !== 'string' ||
      digest(receipt.original) !== receipt.originalSHA ||
      digest(receipt.transformed) !== receipt.transformedSHA ||
      receipt.originalSHA !== recipeSHA || receipt.helperSHA !== helperSHA)
    throw new Error('Button command observation does not bind the exact authored source/helper.');
  for (const [name, content] of [
    ['button-observer.original.source', receipt.original],
    ['button-observer.transformed.source', receipt.transformed],
    ['button-observer.transform.json', JSON.stringify(receipt, null, 2) + '\n'],
  ]) await writeFile(join(output, name), content, { flag: 'wx' });
  return { schemaVersion: receipt.schemaVersion, source: receipt.source,
    originalSHA: receipt.originalSHA, helperSHA: receipt.helperSHA,
    transformedSHA: receipt.transformedSHA,
    receipt: 'button-observer.transform.json',
    limitation: 'Audit-only consumer callback subscription; product recipe bytes and all product input/default handling remain original.',
  };
}
async function exact(target: Locator) {
  if (await target.count() !== 1) throw new Error('Native journey requires one exact physical target.');
  const handle = await target.elementHandle();
  if (!handle) throw new Error('Native journey physical target is unavailable.');
  return handle as ElementHandle<HTMLElement>;
}
async function release(handles: Array<JSHandle | null | undefined>) {
  const results = await Promise.allSettled(handles.filter(Boolean).map((handle) => handle!.dispose()));
  const failed = results.find((result) => result.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
}

export async function runContrastDialogOutside(ctx: JourneyContext) {
  const { page, subject, target, record } = ctx;
  const handles: JSHandle[] = [];
  let binding: JSHandle<DialogOutsideBinding> | undefined;
  try {
    const trigger = await exact(target); handles.push(trigger);
    const root = await exact(await ctx.owned('brutalist-dialog-root')); handles.push(root);
    const content = await exact(await ctx.owned('brutalist-dialog-content')); handles.push(content);
    const mask = await exact(await ctx.owned('brutalist-dialog-mask')); handles.push(mask);
    // Intentional broken-dismissal control: one native press strictly inside
    // the exact owned Content must leave the same Dialog open and painted.
    // It runs before the journal binding so its pointerup cannot be counted
    // as journey evidence or contamination.
    const interior = await content.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      for (const [fx, fy] of [[0.5, 0.06], [0.1, 0.5], [0.9, 0.5], [0.5, 0.94], [0.5, 0.5]] as const) {
        const point = { x: rect.left + rect.width * fx, y: rect.top + rect.height * fy };
        const hit = document.elementFromPoint(point.x, point.y);
        if (hit && element.contains(hit) && hit.closest('[data-pui-root]') === element)
          return point;
      }
      return null;
    });
    if (!interior) throw new Error('Dialog Content has no owned interior point for the broken-dismissal control.');
    const control: JourneyControlRecord = { kind: 'interior-press-must-not-dismiss',
      input: { method: 'page.mouse.move/down/up', point: interior } };
    record.control = control;
    await page.mouse.move(interior.x, interior.y);
    await page.mouse.down(); await page.mouse.up();
    await ctx.settle();
    const controlResult = await root.evaluate((element, content) => ({
      achieved: element.hasAttribute('data-open') && content.isConnected &&
        (globalThis as typeof globalThis & {
          puiContrastProbe: { readContrastPaintedVisibility(el: Element): { visible: boolean; classification: string } };
        }).puiContrastProbe.readContrastPaintedVisibility(content).classification === 'source-model-visible',
      basis: 'Interior owned-Content press must not dismiss; refusal stays recorded.',
    }), content);
    control.result = controlResult;
    if (!controlResult.achieved) throw new Error('Broken-dismissal control failed: interior press dismissed or unpainted the Dialog.');
    binding = await page.evaluateHandle((input) =>
      (globalThis as JourneyGlobal).puiContrastJourneys.bindContrastDialogOutside(input),
      { subject, root, trigger, content, mask });
    handles.push(binding);
    const observe = (phase: string) => page.evaluate(({ binding, phase }) =>
      (globalThis as JourneyGlobal).puiContrastJourneys.readContrastDialogOutside(binding, phase),
      { binding: binding!, phase });
    record.stage = 'outside-pointer-before';
    record.before = await observe('before');
    const point = await binding.evaluate((value) => value.point);
    if (!point) throw new Error('Dialog has no verified owned Mask exterior point.');
    await page.mouse.move(point.x, point.y);
    await ctx.capture('outside-pointer-before', () => observe('before'));
    await binding.evaluate((value) => { value.beforeAccepted = true; });
    record.input = { method: 'page.mouse.move/down/up', point, button: 'left' };
    record.stage = 'native-outside-press';
    await page.mouse.down();
    await page.mouse.up();
    record.afterInput = await observe('closed');
    await page.waitForFunction((binding) =>
      (globalThis as JourneyGlobal).puiContrastJourneys.readContrastDialogOutside(binding, 'closed').achieved,
      binding, { timeout: 20_000 });
    await ctx.settle();
    record.after = await observe('closed');
    await ctx.capture('outside-pointer-closed', () => observe('closed'));
    record.stage = 'observed';
  } catch (error) {
    record.error = String(error);
    if (binding) {
      try { record.failureObservation = await binding.evaluate((value) =>
        (globalThis as JourneyGlobal).puiContrastJourneys.readContrastDialogOutside(value, 'closed')); }
      catch (observationError) { record.observationError = String(observationError); }
    }
    throw error;
  } finally {
    if (binding) await binding.evaluate((value) => value.dispose());
    await release(handles);
  }
}

export async function runContrastHoverBridge(ctx: JourneyContext) {
  const { page, subject, target, record } = ctx;
  const handles: JSHandle[] = [];
  let binding: JSHandle<HoverBridgeBinding> | undefined;
  try {
    const trigger = await exact(target); handles.push(trigger);
    const root = await exact(await ctx.owned('brutalist-hover-card-root')); handles.push(root);
    let content = await exact(await ctx.owned('brutalist-hover-card-content')); handles.push(content);
    // Intentional broken-bridge control: a native move that bypasses Content
    // must close, never retain. The reopened physical Content is then rebound
    // by fresh exact owned resolution; borrowing a stale node is impossible.
    const bypass = await page.evaluate(({ trigger, content }) => {
      for (const point of [
        { x: 0, y: 0 }, { x: innerWidth - 1, y: 0 },
        { x: 0, y: innerHeight - 1 }, { x: innerWidth - 1, y: innerHeight - 1 },
      ]) {
        const hit = document.elementFromPoint(point.x, point.y);
        if (hit && !trigger.contains(hit) && !content.contains(hit)) return point;
      }
      return null;
    }, { trigger, content });
    if (!bypass) throw new Error('Hover Card has no exterior bypass point for the broken-bridge control.');
    const control: JourneyControlRecord = { kind: 'bypass-move-must-not-retain',
      input: { method: 'page.mouse.move', point: bypass } };
    record.control = control;
    await page.mouse.move(bypass.x, bypass.y, { steps: 2 });
    await (await ctx.owned('brutalist-hover-card-content')).waitFor({ state: 'hidden', timeout: 20_000 });
    const bypassClosed = await root.evaluate((element) => !element.hasAttribute('data-open'));
    control.result = { achieved: bypassClosed,
      basis: 'Pointer that never enters Content must not retain the card.' };
    if (!bypassClosed) throw new Error('Broken-bridge control failed: bypass move retained the Hover Card.');
    const triggerBox = await trigger.boundingBox();
    if (!triggerBox) throw new Error('Hover Card Trigger lost physical bounds before reopen.');
    await page.mouse.move(triggerBox.x + triggerBox.width / 2, triggerBox.y + triggerBox.height / 2);
    const reopened = await ctx.owned('brutalist-hover-card-content');
    await reopened.waitFor({ state: 'visible', timeout: 20_000 });
    const reopenedHandle = await exact(reopened);
    control.contentReused = await page.evaluate(
      ([a, b]) => a === b, [content, reopenedHandle]);
    content = reopenedHandle; handles.push(content);
    binding = await page.evaluateHandle((input) =>
      (globalThis as JourneyGlobal).puiContrastJourneys.bindContrastHoverBridge(input),
      { subject, root, trigger, content });
    handles.push(binding);
    const observe = (phase: string) => page.evaluate(({ binding, phase }) =>
      (globalThis as JourneyGlobal).puiContrastJourneys.readContrastHoverBridge(binding, phase),
      { binding: binding!, phase });
    record.stage = 'pointer-bridge-before';
    record.before = await observe('before');
    await ctx.capture('pointer-bridge-before', () => observe('before'));
    await binding.evaluate((value) => { value.beforeAccepted = true; });
    const point = await binding.evaluate((value) => value.point);
    record.input = { method: 'page.mouse.move', point, steps: 1,
      basis: 'One native handoff on the current authored zero close-delay recipe; no synthetic hover or gap sleep.' };
    record.stage = 'native-trigger-to-content';
    await page.mouse.move(point.x, point.y, { steps: 1 });
    await page.waitForFunction((binding) =>
      (globalThis as JourneyGlobal).puiContrastJourneys.readContrastHoverBridge(binding, 'retained').achieved,
      binding, { timeout: 20_000 });
    await ctx.settle();
    record.retained = await observe('retained');
    await ctx.capture('pointer-bridge-retained', () => observe('retained'));
    await binding.evaluate((value) => { value.retainedAccepted = true; });
    const leave = await binding.evaluate((value) =>
      (globalThis as JourneyGlobal).puiContrastJourneys.contrastHoverLeavePoint(value));
    if (!leave) throw new Error('Hover Card has no verified exterior leave point.');
    record.leaveInput = { method: 'page.mouse.move', point: leave };
    record.stage = 'native-content-leave';
    await page.mouse.move(leave.x, leave.y);
    await page.waitForFunction((binding) =>
      (globalThis as JourneyGlobal).puiContrastJourneys.readContrastHoverBridge(binding, 'closed').achieved,
      binding, { timeout: 20_000 });
    await ctx.settle();
    record.after = await observe('closed');
    await ctx.capture('pointer-bridge-closed', () => observe('closed'));
    record.stage = 'observed';
  } catch (error) {
    record.error = String(error);
    if (binding) {
      try { record.failureObservation = await binding.evaluate((value) =>
        (globalThis as JourneyGlobal).puiContrastJourneys.readContrastHoverBridge(value, 'retained')); }
      catch (observationError) { record.observationError = String(observationError); }
    }
    throw error;
  } finally {
    if (binding) await binding.evaluate((value) => value.dispose());
    await release(handles);
  }
}

export async function runContrastButtonKeyboard(
  ctx: JourneyContext,
  sourceBinding: ContrastButtonTransform,
) {
  const { page, subject, target, record } = ctx;
  const handles: JSHandle[] = [];
  let binding: JSHandle<ButtonKeyboardBinding> | undefined;
  try {
    const button = await exact(target); handles.push(button);
    const disabled: ElementHandle<HTMLElement>[] = [];
    for (const ref of ['disabledSolid', 'disabledSurface']) {
      const candidate = (await ctx.owned('brutalist-button')).and(page.locator(`[data-demo-ref="${ref}"]`));
      const element = await exact(candidate); handles.push(element); disabled.push(element);
    }
    binding = await page.evaluateHandle((input) =>
      (globalThis as JourneyGlobal).puiContrastJourneys.bindContrastButtonKeyboard(input),
      { subject, button, disabled });
    handles.push(binding);
    // The outward-callback baseline requires the exact authored Button to hold
    // real native focus before any key step begins.
    await button.evaluate((element) => element.focus());
    const actualSource = await binding.evaluate((value) => value.commands.session.sourceBinding);
    if (actualSource.originalSHA !== sourceBinding.originalSHA ||
        actualSource.helperSHA !== sourceBinding.helperSHA || actualSource.source !== sourceBinding.source)
      throw new Error('Exact physical Button command observer uses different source.');
    record.commandSource = sourceBinding;
    const keys: unknown[] = []; record.keys = keys;
    for (const [key, name] of [[' ', 'space'], ['Enter', 'enter'], ['a', 'unrelated']] as const) {
      record.stage = `${name}-before`;
      // The step contains actual ancestor references and stays in Chromium.
      const retainedStep = await page.evaluateHandle(
        ({ binding, key }) =>
        (globalThis as JourneyGlobal).puiContrastJourneys.beginContrastButtonKey(binding, key),
        { binding, key }
      );
      try {
        const before = await retainedStep.evaluate((step) => step.before);
        if (name !== 'unrelated')
          await ctx.capture(`${name}-before`, () => retainedStep.evaluate((step) => step.before));
        if (!before.achieved) throw new Error('Button lost its native keyboard-focus baseline.');
        record.stage = `native-${name}`;
        await page.keyboard.press(key === ' ' ? 'Space' : key);
        await ctx.settle();
        const observe = () => page.evaluate((input) =>
          (globalThis as JourneyGlobal).puiContrastJourneys.readContrastButtonKey(input),
          { binding: binding!, step: retainedStep });
        keys.push(await observe());
        await ctx.capture(name === 'unrelated' ? 'unrelated-key' : `${name}-activation`, observe);
      } finally { await retainedStep.dispose(); }
    }
    await binding.evaluate((value) =>
      (globalThis as JourneyGlobal).puiContrastJourneys.resetContrastButtonControlInputs(value));
    record.stage = 'native-disabled-tab-traversal';
    let exited = false;
    for (let step = 0; step < 32; step++) {
      await page.keyboard.press('Tab');
      exited = await page.evaluate(({ button, previewer }) => {
        const focused = document.activeElement;
        return focused !== button && (!focused || !previewer.contains(focused) ||
          !focused.closest('[data-projection-content]'));
      }, { button, previewer: subject.previewer });
      if (exited) break;
    }
    await binding.evaluate((value, exited) => { value.tabExited = exited; }, exited);
    record.disabledTab = await binding.evaluate((value) =>
      (globalThis as JourneyGlobal).puiContrastJourneys.readContrastDisabledButton(value, 'tab'));
    await ctx.capture('disabled-tab-exclusion', () => binding!.evaluate((value) =>
      (globalThis as JourneyGlobal).puiContrastJourneys.readContrastDisabledButton(value, 'tab')));
    await binding.evaluate((value) =>
      (globalThis as JourneyGlobal).puiContrastJourneys.resetContrastButtonControlInputs(value));
    const bounds = await disabled[0].boundingBox();
    if (!bounds) throw new Error('Authored disabled Button has no physical bounds.');
    const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    await binding.evaluate((value, point) => { value.disabledPoint = point; }, point);
    record.disabledInput = { method: 'page.mouse.move/down/up', point,
      boundary: 'Pointer-events may make the disabled physical node unreachable; exact input and hit result are retained.' };
    record.stage = 'native-disabled-pointer-attempt';
    await page.mouse.move(point.x, point.y);
    await page.mouse.down(); await page.mouse.up();
    await ctx.settle();
    record.disabledPointer = await binding.evaluate((value) =>
      (globalThis as JourneyGlobal).puiContrastJourneys.readContrastDisabledButton(value, 'pointer'));
    await ctx.capture('disabled-pointer', () => binding!.evaluate((value) =>
      (globalThis as JourneyGlobal).puiContrastJourneys.readContrastDisabledButton(value, 'pointer')));
    record.stage = 'observed';
  } catch (error) {
    record.error = String(error);
    throw error;
  } finally {
    if (binding) await binding.evaluate((value) => value.dispose());
    await release(handles);
  }
}
