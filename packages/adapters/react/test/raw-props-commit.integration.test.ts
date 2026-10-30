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
});
