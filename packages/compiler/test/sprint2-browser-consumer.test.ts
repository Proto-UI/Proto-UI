// @vitest-environment happy-dom
import * as React from 'react';
import { flushSync } from 'react-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { createSprint2BrowserConsumer } from './sprint2-browser-consumer';

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

/** A deliberately deferred ordinary React view isolates the browser fixture's readiness contract. */
function deferredConsumer() {
  const mounted = Promise.withResolvers<void>();
  let reveal = () => {};
  let alive = true;
  const handle = {
    getExposes: () => ({
      disabled: {
        get() {
          if (!alive) throw new Error('retired test owner');
          return false;
        },
      },
    }),
  };
  const Component = React.forwardRef<typeof handle, { children?: React.ReactNode }>(
    function DeferredConsumer({ children }, ref) {
      const [present, setPresent] = React.useState(false);
      React.useImperativeHandle(ref, () => handle, []);
      React.useLayoutEffect(() => {
        reveal = () => flushSync(() => setPresent(true));
        mounted.resolve();
        return () => {
          alive = false;
        };
      }, []);
      return present
        ? React.createElement('div', { 'data-pui-root': '', role: 'button' }, children)
        : null;
    }
  );
  const module = { CompiledComponent: Component };
  const kinds = { base: module, shadcn: module, brutalist: module, text: module };
  const fixture = createSprint2BrowserConsumer({
    react: kinds,
    vue: kinds,
    vue2: kinds,
    wc: kinds,
  });
  const host = document.createElement('main');
  host.id = 'mount';
  document.body.append(host);
  cleanups.push(() => fixture.dispose());
  return { fixture, host, mounted: mounted.promise, reveal: () => reveal() };
}

it('waits for a real physical Root before capturing initial identity or marking a deferred React view', async () => {
  const { fixture, host, mounted, reveal } = deferredConsumer();
  let resolved = false;
  const mounting = fixture.mount('react', 'base').then((result) => {
    resolved = true;
    return result;
  });
  await mounted;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  // Cross the next task so the original one-frame fixture has actually returned.
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  expect(host.querySelector('[data-pui-root]')).toBeNull();
  expect(resolved).toBe(false);

  reveal();
  expect(await mounting).toMatchObject({
    rootIdentity: true,
    ownerIdentity: true,
    childIdentity: true,
    childText: 'Ordinary child',
    role: 'button',
  });
  expect(host.querySelector('[data-sprint2-target]')).toBe(host.querySelector('[data-pui-root]'));
});

it('retires the observer, deadline and framework owner when no physical Root arrives', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const observing = Promise.withResolvers<void>();
  const observe = MutationObserver.prototype.observe;
  vi.spyOn(MutationObserver.prototype, 'observe').mockImplementation(function (
    this: MutationObserver,
    ...args
  ) {
    const result = observe.apply(this, args);
    observing.resolve();
    return result;
  });
  const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
  const { fixture, host } = deferredConsumer();
  const mounting = fixture.mount('react', 'base');
  const rejected = expect(mounting).rejects.toThrow('physical Root did not become present');
  await observing.promise;
  await vi.advanceTimersByTimeAsync(5000);
  await rejected;
  expect(disconnect).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
  expect(host.childElementCount).toBe(0);
});
