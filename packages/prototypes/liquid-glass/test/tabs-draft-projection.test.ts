import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { createRuntimeSession } from '@proto.ui/runtime';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import {
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import { EVENT_ROOT_TARGET_CAP, EVENT_GLOBAL_TARGET_CAP } from '@proto.ui/module-event';
import { FOCUS_INSTANCE_TOKEN_CAP, FOCUS_PARENT_CAP } from '@proto.ui/module-focus';
import { EFFECTS_CAP, type FeedbackPort } from '@proto.ui/module-feedback';
import type { StyleHandle } from '@proto.ui/core';
import {
  tabsRoot,
  tabsList,
  tabsTrigger,
  tabsContent,
  tabsIndicator,
  type LiquidGlassTabsListProps,
} from '../src/tabs';
import { styleContains } from '../../test-utils/style';

const Root = AdaptToWebComponent(tabsRoot);
const List = AdaptToWebComponent(tabsList);
const Trigger = AdaptToWebComponent(tabsTrigger);
const Content = AdaptToWebComponent(tabsContent);
const Indicator = AdaptToWebComponent(tabsIndicator);

async function flush() {
  for (let i = 0; i < 4; i++) await Promise.resolve();
}
function make(options: { orientation?: 'horizontal' | 'vertical'; value?: string } = {}) {
  const root = new Root();
  const list = new List();
  const a = new Trigger();
  const b = new Trigger();
  const content = new Content();
  const indicator = new Indicator();
  setElementProps(root, {
    defaultValue: 'a',
    orientation: options.orientation ?? 'horizontal',
    activationMode: 'manual',
    ...(options.value === undefined ? {} : { value: options.value }),
  });
  setElementProps(a, { value: 'a' });
  setElementProps(b, { value: 'b' });
  setElementProps(content, { value: 'a', keepMounted: true });
  a.textContent = 'Account';
  b.textContent = 'Password';
  content.textContent = 'Panel';
  list.append(a, b);
  root.append(list, indicator, content);
  document.body.append(root);
  return { root, list, a, b, content, indicator };
}

afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

describe('Liquid Glass Tabs draft projection', () => {
  it('keeps Indicator passive while exposing accepted selection, active focus and orientation', async () => {
    const { root, list, a, b, indicator } = make({ orientation: 'vertical' });
    await flush();
    const exposes = indicator.getExposes();
    const value = exposes.value;
    expect(value.get()).toBe('a');
    expect(exposes.orientation.get()).toBe('vertical');
    expect(styleContains(list, 'flex-col')).toBe(true);
    expect(indicator.getAttribute('role')).toBeNull();
    expect(Object.hasOwn(exposes, 'focusSelf')).toBe(false);
    expect(Object.hasOwn(exposes, 'valueChange')).toBe(false);
    expect(indicator.getAttribute('data-pui-style') ?? '').toBe('');

    a.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    await flush();
    expect(document.activeElement).toBe(b);
    expect(root.getExposes().value.get()).toBe('a');
    expect(value.get()).toBe('a');
    expect(exposes.activeValue.get()).toBe('b');
    b.click();
    await flush();
    expect(value.get()).toBe('b');
    setElementProps(root, {
      defaultValue: 'a',
      orientation: 'horizontal',
      activationMode: 'manual',
    });
    await flush();
    expect(indicator.getExposes().value).toBe(value);
    expect(value.get()).toBe('b');
    expect(exposes.orientation.get()).toBe('horizontal');
    expect(styleContains(list, 'flex-col')).toBe(false);
  });

  it('keeps functional navigation on the List and selected Trigger while Content remains neutral', async () => {
    const { root, list, a, b, content } = make();
    await flush();
    expect(styleContains(list, 'rounded-2xl')).toBe(true);
    expect(styleContains(a, 'bg-background')).toBe(true);
    expect(styleContains(content, 'bg-background')).toBe(false);
    b.click();
    await flush();
    expect(root.getExposes().value.get()).toBe('b');
    expect(b.getExposes().selected.get()).toBe(true);
    expect(b.getAttribute('aria-selected')).toBe('true');
    expect(styleContains(b, 'bg-background')).toBe(true);
    expect(styleContains(a, 'bg-background')).toBe(false);
    expect(content.getExposes().current.get()).toBe(false);
  });

  it('retains controlled refusal and disabled request suppression with the Indicator present', async () => {
    const { root, a, b, indicator } = make({ value: 'a' });
    await flush();
    const requests: unknown[] = [];
    root.addEventListener('valueChange', (event) => {
      if (event instanceof CustomEvent) requests.push(event.detail);
    });
    b.click();
    await flush();
    expect(requests).toEqual([{ value: 'b' }]);
    expect(root.getExposes().value.get()).toBe('a');
    expect(indicator.getExposes().value.get()).toBe('a');
    expect(indicator.getExposes().activeValue.get()).toBe('b');
    expect(styleContains(a, 'bg-background')).toBe(true);
    expect(styleContains(b, 'bg-background')).toBe(false);
    setElementProps(b, { value: 'b', disabled: true });
    b.click();
    await flush();
    expect(requests).toEqual([{ value: 'b' }]);
    expect(indicator.getExposes().value.get()).toBe('a');
  });

  it('changes navigation material and appearance without replacing state, focus or caller nodes', async () => {
    const { root, list, b, content, indicator } = make();
    await flush();
    b.click();
    b.focus();
    await flush();
    const value = root.getExposes().value;
    const selected = b.getExposes().selected;
    const indicatorValue = indicator.getExposes().value;
    const text = b.firstChild;
    const panelText = content.firstChild;
    for (const material of ['opaque', 'auto'] as const) {
      setElementProps(list, { material });
      await flush();
      expect(styleContains(list, 'bg-secondary')).toBe(true);
      expect(root.getExposes().value).toBe(value);
      expect(value.get()).toBe('b');
      expect(b.getExposes().selected).toBe(selected);
      expect(selected.get()).toBe(true);
      expect(indicator.getExposes().value).toBe(indicatorValue);
      expect(indicatorValue.get()).toBe('b');
      expect(document.activeElement).toBe(b);
      expect(b.firstChild).toBe(text);
      expect(content.firstChild).toBe(panelText);
    }
    setElementProps(list, { appearance: 'underline', material: 'auto' });
    setElementProps(b, { value: 'b', appearance: 'underline' });
    await flush();
    expect(styleContains(list, 'bg-secondary')).toBe(false);
    expect(styleContains(list, 'bg-transparent')).toBe(true);
    expect(styleContains(b, 'border-b-2')).toBe(true);
    expect(document.activeElement).toBe(b);
    expect(b.firstChild).toBe(text);
  });

  it('withdraws only the List material candidate for opaque/underline, retaining opaque style and unavailable-host diagnostics', async () => {
    // Existing real-runtime fixture pattern: no optical sink is supplied. This
    // observes candidate policy and explicit unavailability, not native glass.
    const rootTarget = document.createElement('div');
    const listTarget = document.createElement('div');
    const parent = (token: unknown) => (token === listTarget ? rootTarget : null);
    const prototype = (token: unknown) =>
      token === rootTarget ? tabsRoot : token === listTarget ? tabsList : null;
    let raw: LiquidGlassTabsListProps = {};
    const styles: StyleHandle[] = [];
    const root = createRuntimeSession(tabsRoot, {
      prototypeName: tabsRoot.name,
      getRawProps: () => ({}),
      schedule: (task) => task(),
      commit: (_children, signal) => signal?.done(),
      onRuntimeReady(wiring) {
        wiring.attach('context', [
          [CONTEXT_INSTANCE_TOKEN_CAP, rootTarget],
          [CONTEXT_PARENT_CAP, parent],
        ]);
        wiring.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, rootTarget],
          [ANATOMY_PARENT_CAP, parent],
          [ANATOMY_GET_PROTO_CAP, prototype],
          [
            ANATOMY_ROOT_TARGET_CAP,
            (token: unknown) => (token instanceof HTMLElement ? token : null),
          ],
        ]);
      },
    });
    const list = createRuntimeSession(tabsList, {
      prototypeName: tabsList.name,
      getRawProps: () => raw,
      schedule: (task) => task(),
      commit: (_children, signal) => signal?.done(),
      onRuntimeReady(wiring) {
        wiring.attach('context', [
          [CONTEXT_INSTANCE_TOKEN_CAP, listTarget],
          [CONTEXT_PARENT_CAP, parent],
        ]);
        wiring.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, listTarget],
          [ANATOMY_PARENT_CAP, parent],
          [ANATOMY_GET_PROTO_CAP, prototype],
          [
            ANATOMY_ROOT_TARGET_CAP,
            (token: unknown) => (token instanceof HTMLElement ? token : null),
          ],
        ]);
        wiring.attach('focus', [
          [FOCUS_INSTANCE_TOKEN_CAP, listTarget],
          [FOCUS_PARENT_CAP, parent],
        ]);
        wiring.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => listTarget],
          [EVENT_GLOBAL_TARGET_CAP, () => document],
        ]);
        wiring.attach('feedback', [
          [
            EFFECTS_CAP,
            {
              queueStyle: (style: StyleHandle) => {
                styles.push(style);
              },
              requestFlush() {},
            },
          ],
        ]);
      },
    });
    try {
      await root.mount();
      await list.mount();
      const port = list.caps.getPort<FeedbackPort>('feedback');
      if (!port?.exportMaterialFrame) throw new Error('Missing material feedback port');
      expect(port.exportMaterialFrame().candidates).toEqual([
        { intent: 'liquid-glass', variant: 'regular' },
      ]);
      expect(port.materialDiagnostics?.()).toContain('material-host-unavailable');
      expect(styles.at(-1)?.tokens).toContain('bg-secondary');
      raw = { material: 'opaque' };
      list.controller.applyRawProps(raw);
      expect(port.exportMaterialFrame().candidates).toEqual([]);
      expect(styles.at(-1)?.tokens).toContain('bg-secondary');
      raw = { material: 'auto' };
      list.controller.applyRawProps(raw);
      expect(port.exportMaterialFrame().candidates).toEqual([
        { intent: 'liquid-glass', variant: 'regular' },
      ]);
      raw = { material: 'auto', appearance: 'underline' };
      list.controller.applyRawProps(raw);
      expect(port.exportMaterialFrame().candidates).toEqual([]);
      expect(styles.at(-1)?.tokens).toContain('bg-transparent');
      expect(styles.at(-1)?.tokens).not.toContain('bg-secondary');
      expect(
        root.caps.getPort<FeedbackPort>('feedback')?.exportMaterialFrame?.().candidates
      ).toEqual([]);
    } finally {
      await list.dispose();
      await root.dispose();
    }
  });
});
