import * as React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { inputRoot } from '@proto.ui/prototypes-base/input';
import { createReactAdapter } from '../src';

describe('React raw props participate in the actual host commit', () => {
  it('does not start Runtime lifecycle or prop delivery during server rendering', () => {
    const events: unknown[] = [];
    const Component = createReactAdapter(React)(inputRoot, {
      rootTag: 'input',
      diagnostics: { onLifecycleEvent: (event) => events.push(event) },
    });
    const html = renderToString(React.createElement(Component, { disabled: true }));
    // The existing Context-capable Adapter waits for its owner layout effect;
    // server rendering therefore emits no physical view, not a native input.
    expect(html).toBe('');
    expect(events).toEqual([]);
  });
  for (const strict of [false, true]) {
    for (const automatic of [false, true]) {
      it(`publishes disabled facts without a consumer read or later frame (strict=${strict}, automatic=${automatic})`, () => {
        const host = document.createElement('div');
        document.body.append(host);
        const root = createRoot(host);
        const Component = createReactAdapter(React)(inputRoot, {
          rootTag: 'input',
          autoUpdateOnPropsChange: automatic,
        });
        const ref = React.createRef<React.ComponentRef<typeof Component>>();
        let off: (() => void) | undefined;
        const render = (disabled: boolean) => {
          const child = React.createElement(Component, { ref, disabled });
          flushSync(() =>
            root.render(strict ? React.createElement(React.StrictMode, null, child) : child)
          );
        };
        try {
          render(false);
          const handle = ref.current;
          expect(handle).not.toBeNull();
          const fact = handle!.getExposes().disabled as {
            get(): boolean;
            subscribe(listener: (event: { type: string; next?: boolean }) => void): () => void;
          };
          expect(fact.get()).toBe(false);
          const events: boolean[] = [];
          off = fact.subscribe((event) => {
            if (event.type === 'next') events.push(event.next!);
          });
          const input = host.querySelector('input');
          expect(input).not.toBeNull();
          render(true);
          if (!automatic) {
            expect(input!.disabled).toBe(false);
            expect(events).toEqual([]);
            flushSync(() => handle!.update());
          }
          // Do not call getExposes/get/update here: callback entry can synchronize
          // raw props and conceal a missing ordinary commit notification.
          expect(ref.current).toBe(handle);
          expect(input!.disabled).toBe(true);
          expect(input!.getAttribute('aria-disabled')).toBe('true');
          expect(events).toEqual([true]);
          render(true);
          expect(events).toEqual([true]);
          render(false);
          if (!automatic) {
            expect(input!.disabled).toBe(true);
            expect(events).toEqual([true]);
            flushSync(() => handle!.update());
          }
          expect(input!.disabled).toBe(false);
          expect(input!.getAttribute('aria-disabled')).toBe('false');
          expect(events).toEqual([true, false]);
        } finally {
          try {
            off?.();
          } finally {
            try {
              flushSync(() => root.unmount());
            } finally {
              host.remove();
            }
          }
        }
      });
    }
  }

  for (const strict of [false, true]) {
    it(`keeps factory policy and subscriptions owned across manual/automatic replacement (strict=${strict})`, () => {
      const host = document.createElement('div');
      document.body.append(host);
      const root = createRoot(host);
      const adapt = createReactAdapter(React);
      const Manual = adapt(inputRoot, { autoUpdateOnPropsChange: false });
      const Automatic = adapt(inputRoot, { autoUpdateOnPropsChange: true });
      const ref = React.createRef<React.ComponentRef<typeof Manual>>();
      const initialProps = Object.freeze({ disabled: false });
      const cleanups: (() => void)[] = [];
      const retired: { handle: unknown; element: HTMLInputElement; events: boolean[] }[] = [];
      const render = (Component: typeof Manual, props: { disabled: boolean }) => {
        const child = React.createElement(Component, { ...props, ref });
        flushSync(() =>
          root.render(strict ? React.createElement(React.StrictMode, null, child) : child)
        );
      };
      try {
        // This is factory-policy replacement, not a nonexistent dynamic option.
        for (const Component of [Manual, Automatic, Manual]) {
          render(Component, initialProps);
          const handle = ref.current;
          expect(handle).not.toBeNull();
          const element = host.querySelector('input');
          expect(element).not.toBeNull();
          for (const old of retired) {
            expect(handle).not.toBe(old.handle);
            expect(old.element.isConnected).toBe(false);
            expect(old.events).toEqual([true]);
          }
          const fact = handle!.getExposes().disabled as {
            get(): boolean;
            subscribe(listener: (event: { type: string; next?: boolean }) => void): () => void;
          };
          expect(fact.get()).toBe(false);
          const events: boolean[] = [];
          cleanups.push(
            fact.subscribe((event) => {
              if (event.type === 'next') events.push(event.next!);
            })
          );
          render(Component, initialProps);
          expect(events).toEqual([]);
          render(Component, { disabled: true });
          if (Component === Manual) {
            expect(events).toEqual([]);
            expect(element!.disabled).toBe(false);
            flushSync(() => handle!.update());
          }
          expect(element!.disabled).toBe(true);
          expect(events).toEqual([true]);
          for (const old of retired) expect(old.events).toEqual([true]);
          retired.push({ handle, element: element!, events });
        }
      } finally {
        const errors: unknown[] = [];
        for (const off of cleanups) {
          try {
            off();
          } catch (error) {
            errors.push(error);
          }
        }
        try {
          flushSync(() => root.unmount());
        } catch (error) {
          errors.push(error);
        }
        host.remove();
        if (errors.length) throw new AggregateError(errors, 'Policy replacement cleanup failed');
      }
    });

    it(`does not deliver a queued manual render after terminal unmount (strict=${strict})`, async () => {
      const host = document.createElement('div');
      document.body.append(host);
      const root = createRoot(host);
      const Component = createReactAdapter(React)(inputRoot, { autoUpdateOnPropsChange: false });
      const ref = React.createRef<React.ComponentRef<typeof Component>>();
      let off: (() => void) | undefined;
      let unmounted = false;
      const child = (disabled: boolean) => {
        const value = React.createElement(Component, { ref, disabled });
        return strict ? React.createElement(React.StrictMode, null, value) : value;
      };
      try {
        flushSync(() => root.render(child(false)));
        const handle = ref.current;
        expect(handle).not.toBeNull();
        const fact = handle!.getExposes().disabled as {
          subscribe(listener: (event: { type: string; next?: boolean }) => void): () => void;
        };
        const next: boolean[] = [];
        off = fact.subscribe((event) => {
          if (event.type === 'next') next.push(event.next!);
        });
        const element = host.querySelector('input');
        expect(element).not.toBeNull();
        // A real concurrent root queues work; no injected fake effect callback.
        root.render(child(true));
        flushSync(() => root.unmount());
        unmounted = true;
        expect(ref.current).toBeNull();
        expect(element!.isConnected).toBe(false);
        expect(next).toEqual([]);
        for (let i = 0; i < 16; i += 1) await Promise.resolve();
        expect(next).toEqual([]);
        expect(host.childElementCount).toBe(0);
      } finally {
        try {
          off?.();
        } finally {
          try {
            if (!unmounted) flushSync(() => root.unmount());
          } finally {
            host.remove();
          }
        }
      }
    });
  }
});
