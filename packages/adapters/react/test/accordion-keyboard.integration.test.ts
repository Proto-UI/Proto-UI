import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import * as base from '../../../prototypes/base/src/accordion';
import { createReactAdapter } from '../src';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

it('restores reciprocal Accordion relationships at the rematerialized React commit', async () => {
  const adapt = createReactAdapter(React);
  const Root = adapt(base.accordionRoot);
  const Item = adapt(base.accordionItem);
  const Heading = adapt(base.accordionHeading);
  const Trigger = adapt(base.accordionTrigger);
  const Content = adapt(base.accordionContent);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => {
      root.render(
        React.createElement(
          Root,
          {},
          React.createElement(
            Item,
            { value: 'panel' },
            React.createElement(Heading, {}, React.createElement(Trigger, {}, 'Toggle')),
            React.createElement(Content, {}, 'Panel')
          )
        )
      );
    });
    const trigger = host.querySelector<HTMLElement>('[aria-expanded]')!;
    const content = () =>
      [...host.querySelectorAll<HTMLElement>('[data-pui-root]')].find(
        (el) => el.textContent === 'Panel'
      );
    await act(async () => trigger.focus());
    const press = async (key: string, observe?: () => void) => {
      await act(async () => {
        trigger.dispatchEvent(
          new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
        );
        trigger.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
        observe?.();
      });
    };
    await press('Enter');
    const id = content()!.id;
    expect(id).not.toBe('');
    expect(trigger.getAttribute('aria-controls')).toBe(id);
    expect(content()!.getAttribute('aria-labelledby')).toBe(trigger.id);
    for (let cycle = 0; cycle < 3; cycle++) {
      await press(' ');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(trigger.getAttribute('aria-controls')).toBeNull();
      expect(content()).toBeUndefined();
      await press('Enter', () => {
        // Either React scheduling is legal: a not-yet-committed Content must
        // not leave a dangling IDREF, while a ready view must already restore it.
        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        const panel = content();
        if (
          !panel ||
          panel.hasAttribute('data-pui-view-pending') ||
          panel.hasAttribute('data-pui-view-detached')
        ) {
          expect(trigger.getAttribute('aria-controls')).toBeNull();
        } else {
          expect(panel.id).toBe(id);
          expect(trigger.getAttribute('aria-controls')).toBe(id);
          expect(panel.getAttribute('aria-labelledby')).toBe(trigger.id);
        }
      });
      expect(content()!.id).toBe(id);
      expect(trigger.getAttribute('aria-controls')).toBe(id);
      expect(content()!.getAttribute('aria-labelledby')).toBe(trigger.id);
      expect(content()!.hasAttribute('data-pui-view-pending')).toBe(false);
      expect(content()!.hasAttribute('data-pui-view-detached')).toBe(false);
    }
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
