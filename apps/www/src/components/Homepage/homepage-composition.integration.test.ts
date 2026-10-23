import { afterEach, describe, expect, it, vi } from 'vitest';
import { getElementProps } from '@proto.ui/adapter-web-component';
import { renderDemo } from '../PrototypePreviewer/demo-renderer';
import { loadPrototypes } from '../PrototypePreviewer/prototype-modules';
import type { DemoSetupContext } from '../PrototypePreviewer/demo-types';
import { createHomepageShowcase } from './homepage-showcase';

// Real homepage recipe, loader, prototypes, renderer and WC Adapter in Happy DOM.
// Synthetic input/keyboard events do not establish browser paint or pointer geometry.
type Family = 'shadcn' | 'brutalist';
type ProtoElement = HTMLElement & {
  getExposes(): {
    value: { get(): number };
    visibleCount: { get(): number };
    visible: { get(): boolean };
    getOpenItems(): string[];
  };
};
let rendered: Awaited<ReturnType<typeof renderDemo>> | undefined;
let stopErrorWatch: (() => void) | undefined;
afterEach(async () => {
  try {
    await rendered?.destroy();
  } finally {
    rendered = undefined;
    stopErrorWatch?.();
    stopErrorWatch = undefined;
    document.body.replaceChildren();
  }
});
const settle = async () => {
  for (let index = 0; index < 32; index++) await Promise.resolve();
};
function press(element: HTMLElement, key: string) {
  element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  element.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
}
function fill(input: HTMLInputElement, text: string) {
  input.focus();
  input.value = text;
  input.setSelectionRange(text.length, text.length);
  input.dispatchEvent(
    new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' })
  );
}
async function mount(family: Family) {
  const errors: string[] = [];
  const onError = (event: ErrorEvent) => errors.push(event.message);
  window.addEventListener('error', onError);
  stopErrorWatch = () => window.removeEventListener('error', onError);
  const content = createHomepageShowcase(family, 'wc', 'en', () => true);
  await loadPrototypes([...content.recipe.prototypeIds]);
  const setup = content.demo.setup!;
  const writes = vi.fn<DemoSetupContext['api']['setProps']>();
  let cleanup: (() => void) | undefined;
  content.demo.setup = (context) => {
    writes.mockImplementation((ref, props) => context.api.setProps(ref, props));
    const result = setup({ ...context, api: { ...context.api, setProps: writes } });
    if (typeof result === 'function') cleanup = result;
    return result;
  };
  const host = document.createElement('div');
  document.body.append(host);
  rendered = await renderDemo({ runtime: 'wc', demo: content.demo, host });
  await settle();
  const ref = (name: string) => {
    const node = host.querySelector<ProtoElement>(`[data-demo-ref="${name}"]`);
    expect(node, name).not.toBeNull();
    return node!;
  };
  const verifyPlan = (value: number) => {
    expect(ref('composition-slider').getExposes().value.get()).toBe(value);
    expect(ref('composition-progress').getExposes().value.get()).toBe(value);
    expect(ref('composition-progress').getAttribute('role')).toBe('progressbar');
    expect(ref('composition-progress').getAttribute('aria-valuenow')).toBe(String(value));
    expect(ref('composition-slider-thumb').getAttribute('role')).toBe('slider');
    expect(ref('composition-slider-thumb').getAttribute('aria-valuenow')).toBe(String(value));
    expect(ref('composition-progress-status').textContent).toBe(`Plan progress: ${value}%`);
    expect(getElementProps(ref('composition-slider'))).toMatchObject({
      value,
      min: 0,
      max: 100,
      step: 5,
      ariaLabel: 'Adjust example plan progress',
    });
    expect(getElementProps(ref('composition-progress'))).toMatchObject({ value, min: 0, max: 100 });
    expect(getElementProps(ref('composition-reset'))).toMatchObject({ wrap: true });
    expect(ref('composition-slider-thumb').getAttribute('aria-label')).toBe(
      'Adjust example plan progress'
    );
    const label = host.querySelector<HTMLElement>(`wc-${family}-progress-label`)!;
    expect(label.id).toBeTruthy();
    expect(ref('composition-progress').getAttribute('aria-labelledby')?.split(/\s+/)).toEqual([
      label.id,
    ]);
  };
  return { host, ref, errors, writes, verifyPlan, stopSetup: () => cleanup?.() };
}

for (const family of ['shadcn', 'brutalist'] as const) {
  describe(`${family} homepage scenes real WC integration`, () => {
    it('filters Command, skips disabled results and accepts Arrow/Enter into Slider and Progress', async () => {
      const view = await mount(family);
      const root = view.ref('composition-command');
      const inputHost = view.ref('composition-command-input');
      const input = (
        inputHost.matches('input') ? inputHost : inputHost.querySelector('input')
      ) as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.getAttribute('role')).toBe('combobox');
      expect(input.getAttribute('aria-label')).toBe('Search example steps');
      view.verifyPlan(40);
      fill(input, 'no-matching-workspace-step');
      await expect.poll(() => root.getExposes().visibleCount.get()).toBe(0);
      const empty = view.host.querySelector<ProtoElement>(`wc-${family}-command-empty`)!;
      expect(empty.getExposes().visible.get()).toBe(true);
      press(input, 'Enter');
      await settle();
      view.verifyPlan(40);

      fill(input, 'publish');
      await expect.poll(() => root.getExposes().visibleCount.get()).toBe(1);
      const disabled = [
        ...view.host.querySelectorAll<HTMLElement>(`wc-${family}-command-item`),
      ].find((item) => item.textContent?.includes('Publish online'))!;
      expect(disabled.getAttribute('aria-disabled')).toBe('true');
      press(input, 'ArrowDown');
      press(input, 'Enter');
      disabled.click();
      await settle();
      view.verifyPlan(40);

      fill(input, 'prototype');
      await expect.poll(() => root.getExposes().visibleCount.get()).toBe(1);
      expect(empty.getExposes().visible.get()).toBe(false);
      fill(input, 'a');
      await expect.poll(() => root.getExposes().visibleCount.get()).toBe(3);
      await expect
        .poll(
          () => document.getElementById(input.getAttribute('aria-activedescendant')!)?.textContent
        )
        .toBe('Outline an idea');
      press(input, 'ArrowDown');
      await expect
        .poll(
          () => document.getElementById(input.getAttribute('aria-activedescendant')!)?.textContent
        )
        .toBe('Build a prototype');
      press(input, 'Enter');
      await expect.poll(() => view.ref('composition-progress').getExposes().value.get()).toBe(60);
      view.verifyPlan(60);
      expect(view.ref('composition-command-status').textContent).toBe(
        'Selected: Build a prototype'
      );
      expect(document.activeElement).toBe(input);
      expect(view.errors).toEqual([]);
    }, 20_000);

    it('keeps Slider configuration through keyboard changes and repeated resets, then revokes queued writes', async () => {
      const view = await mount(family);
      const thumb = view.ref('composition-slider-thumb');
      for (let cycle = 0; cycle < 3; cycle++) {
        thumb.focus();
        press(thumb, 'ArrowRight');
        await expect.poll(() => view.ref('composition-progress').getExposes().value.get()).toBe(45);
        view.verifyPlan(45);
        press(thumb, 'End');
        await expect
          .poll(() => view.ref('composition-progress').getExposes().value.get())
          .toBe(100);
        view.verifyPlan(100);
        view.ref('composition-reset').click();
        await expect.poll(() => view.ref('composition-progress').getExposes().value.get()).toBe(40);
        view.verifyPlan(40);
      }
      const command = view.ref('composition-command');
      const slider = view.ref('composition-slider');
      const reset = view.ref('composition-reset');
      const progressStatus = view.ref('composition-progress-status');
      const commandStatus = view.ref('composition-command-status');
      view.writes.mockClear();
      // Protocol injection is limited to the owner teardown contract; the previous
      // test establishes that the genuine Command can produce this event.
      command.dispatchEvent(new CustomEvent('execute', { detail: { value: 'review' } }));
      expect(view.writes).not.toHaveBeenCalled();
      view.stopSetup();
      const before = [progressStatus.textContent, commandStatus.textContent];
      await settle();
      expect(view.writes).not.toHaveBeenCalled();
      command.dispatchEvent(new CustomEvent('execute', { detail: { value: 'outline' } }));
      slider.dispatchEvent(new CustomEvent('valueChange', { detail: { value: 10 } }));
      reset.dispatchEvent(new CustomEvent('click', { detail: {} }));
      await settle();
      expect(view.writes).not.toHaveBeenCalled();
      expect([progressStatus.textContent, commandStatus.textContent]).toEqual(before);
      await rendered!.destroy();
      rendered = undefined;
      expect(view.errors).toEqual([]);
    }, 20_000);

    it('opens every Accordion panel with unique heading relations and retires closed views', async () => {
      const view = await mount(family);
      const root = view.ref('composition-help');
      const items = [...root.querySelectorAll<HTMLElement>(`wc-${family}-accordion-item`)];
      expect(items).toHaveLength(3);
      const triggers = items.map(
        (item) => item.querySelector<HTMLElement>(`wc-${family}-accordion-trigger`)!
      );
      const bodies = [
        'Choose a result in the step finder, or adjust the progress. Both scenes use the same page-local plan.',
        'Use Tab to move focus, arrows and Enter to choose search results, and arrows to adjust the slider.',
        'This is an interactive example on the current page. Nothing is uploaded, published or saved to an account. Reloading restores the defaults.',
      ];
      expect(root.getExposes().getOpenItems()).toEqual(['try']);
      for (const item of items) {
        const heading = item.querySelector<HTMLElement>(`wc-${family}-accordion-heading`)!;
        expect(heading.getAttribute('role')).toBe('heading');
        expect(heading.getAttribute('aria-level')).toBe('3');
      }
      triggers[0].click();
      await expect.poll(() => root.getExposes().getOpenItems()).toEqual([]);
      const activeRegions = () =>
        root.querySelectorAll('[role="region"]:not([hidden]):not([aria-hidden="true"])');
      await expect.poll(() => activeRegions().length).toBe(0);
      for (const item of items) {
        const panel = item.querySelector<HTMLElement>(`wc-${family}-accordion-content`)!;
        expect(panel.hasAttribute('data-pui-view-detached')).toBe(true);
        // Initially absent views may have no role; a previously opened view
        // may retain role="region" but must be hidden and no longer related.
        if (panel.hasAttribute('role')) {
          expect(panel.hidden).toBe(true);
          expect(panel.getAttribute('aria-hidden')).toBe('true');
        }
      }
      const panelIds = new Set<string>();
      const triggerIds = new Set<string>();
      for (let index = 0; index < items.length; index++) {
        const trigger = triggers[index];
        trigger.focus();
        press(trigger, 'Enter');
        await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('true');
        await expect
          .poll(() => items[index].querySelector('.home-gallery__copy')?.textContent)
          .toBe(bodies[index]);
        const panel = items[index].querySelector<HTMLElement>('[role="region"]')!;
        expect(panel).not.toBeNull();
        expect(panel.id).toBeTruthy();
        const panelId = panel.id;
        expect(panelIds.has(panel.id)).toBe(false);
        panelIds.add(panel.id);
        // A relation target may receive its ID lazily when its panel becomes
        // present. Require nonempty, unique IDs at every live relation instead
        // of requiring eager IDs on initially detached panels' triggers.
        expect(trigger.id).toBeTruthy();
        expect(triggerIds.has(trigger.id)).toBe(false);
        triggerIds.add(trigger.id);
        expect(trigger.getAttribute('role')).toBe('button');
        expect(trigger.getAttribute('aria-controls')?.split(/\s+/)).toEqual([panel.id]);
        expect(panel.getAttribute('aria-labelledby')?.split(/\s+/)).toEqual([trigger.id]);
        expect(document.querySelectorAll(`[id="${panel.id}"]`)).toHaveLength(1);
        expect(activeRegions()).toHaveLength(1);
        expect(document.activeElement).toBe(trigger);
        press(trigger, 'Enter');
        await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
        await expect.poll(() => panel.hasAttribute('data-pui-view-detached')).toBe(true);
        expect(panel.hidden).toBe(true);
        expect(panel.getAttribute('aria-hidden')).toBe('true');
        expect(panel.hasAttribute('aria-labelledby')).toBe(false);
        expect(trigger.hasAttribute('aria-controls')).toBe(false);
        expect(panel.hasAttribute('id')).toBe(false);
        expect(document.querySelectorAll(`[id="${panelId}"]`)).toHaveLength(0);
        expect(activeRegions()).toHaveLength(0);
        expect(root.getExposes().getOpenItems()).toEqual([]);
      }
      expect(panelIds.size).toBe(3);
      expect(triggerIds.size).toBe(3);
      expect(view.errors).toEqual([]);
    }, 20_000);
  });
}
