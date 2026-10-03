import * as React from 'react';
import { act } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as base from '../../../prototypes/base/src/select';
import * as shadcn from '../../../prototypes/shadcn/src/select';
import { createReactAdapter } from '../src';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const mountedRoots: Array<ReturnType<typeof createRoot>> = [];

async function flushTimers(): Promise<void> {
  await act(async () => {
    await vi.runAllTimersAsync();
  });
}

async function press(target: Element, key: string): Promise<KeyboardEvent> {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  await act(async () => {
    target.dispatchEvent(event);
  });
  await flushTimers();
  return event;
}

afterEach(async () => {
  for (const root of mountedRoots.splice(0)) await act(async () => root.unmount());
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('adapter-react: portaled Select keyboard focus', () => {
  it.each([
    { contentFamily: 'base', itemFamily: 'base' },
    { contentFamily: 'base', itemFamily: 'shadcn' },
    { contentFamily: 'shadcn', itemFamily: 'base' },
    { contentFamily: 'shadcn', itemFamily: 'shadcn' },
  ] as const)(
    'keeps observed focus ready with $contentFamily Content and $itemFamily Item',
    async ({ contentFamily, itemFamily }) => {
      // P-BASE-SELECT-CONTENT-A11Y / P-BASE-SELECT-CONTENT-KEYBOARD
      // C-AS-FOCUSABLE-0001-G: a connected target may still be awaiting readiness.
      // Shadcn Item schedules its selected-indicator render. Entry focus must
      // wait for that pending React commit's host focus observer to be effective.
      vi.useFakeTimers();
      const adapt = createReactAdapter({ ...React, createPortal });
      const Root = adapt(shadcn.selectRoot);
      const Trigger = adapt(shadcn.selectTrigger);
      const Value = adapt(shadcn.selectValue);
      const Content = adapt(contentFamily === 'base' ? base.selectContent : shadcn.selectContent);
      const Item = adapt(itemFamily === 'base' ? base.selectItem : shadcn.selectItem);
      const selectedRef = React.createRef<React.ComponentRef<typeof Item>>();
      const host = document.createElement('div');
      document.body.append(host);
      const root = createRoot(host);
      mountedRoots.push(root);
      await act(async () => {
        root.render(
          React.createElement(
            Root,
            { value: 'react' },
            React.createElement(Trigger, {}, React.createElement(Value)),
            React.createElement(
              Content,
              { align: 'start' },
              ...['wc', 'react', 'vue', 'vue2'].map((value) =>
                React.createElement(
                  Item,
                  {
                    key: value,
                    value,
                    textValue: value,
                    ref: value === 'react' ? selectedRef : undefined,
                  },
                  value
                )
              )
            )
          )
        );
      });
      await flushTimers();
      const trigger = host.querySelector<HTMLElement>('[role="combobox"]')!;
      await act(async () => trigger.focus());
      await press(trigger, 'Enter');
      await flushTimers();

      const content = document.getElementById(trigger.getAttribute('aria-controls')!)!;
      const options = [...content.querySelectorAll<HTMLElement>('[role="option"]')];
      expect(host.contains(content)).toBe(false);
      expect(options).toHaveLength(4);
      expect(document.activeElement).toBe(options[1]);
      expect(selectedRef.current?.getExposes().focused.get()).toBe(true);
      if (itemFamily === 'shadcn') expect(options[1].querySelector('svg path')).not.toBeNull();

      const home = await press(options[1], 'Home');
      expect(home.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(options[0]);
      expect(options[1].getAttribute('aria-selected')).toBe('true');
      await press(options[0], 'ArrowDown');
      expect(document.activeElement).toBe(options[1]);
      await press(options[1], 'End');
      expect(document.activeElement).toBe(options[3]);
      await press(options[3], 'Escape');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(trigger);

      // A new portal view epoch must reacquire the same observation boundary.
      await press(trigger, 'Enter');
      await flushTimers();
      const reopened = document.getElementById(trigger.getAttribute('aria-controls')!)!;
      const reopenedOptions = [...reopened.querySelectorAll<HTMLElement>('[role="option"]')];
      expect(document.activeElement).toBe(reopenedOptions[1]);
      expect(selectedRef.current?.getExposes().focused.get()).toBe(true);
      await press(reopenedOptions[1], 'Home');
      expect(document.activeElement).toBe(reopenedOptions[0]);
    }
  );
});
