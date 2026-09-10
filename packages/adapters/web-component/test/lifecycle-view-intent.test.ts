import { asAccessible } from '@proto.ui/hooks';
import { describe, expect, it } from 'vitest';
import { definePrototype, type RunHandle } from '@proto.ui/core';
import { AdaptToWebComponent } from '../src/adapt';

async function flushReconciliation() {
  for (let index = 0; index < 6; index += 1) await Promise.resolve();
}

describe('adapter-web-component: L1 view intent', () => {
  it('keeps the custom element owner while replacing its internal view epochs', async () => {
    const calls = { setup: 0, created: 0, render: 0, mounted: 0, unmounted: 0, disposed: 0 };
    let run!: RunHandle<any>;
    const proto = definePrototype({
      name: 'x-wc-view-intent',
      setup(def) {
        calls.setup += 1;
        def.lifecycle.onCreated((nextRun) => {
          calls.created += 1;
          run = nextRun;
          run.lifecycle.setPresent(false);
        });
        def.lifecycle.onMounted(() => {
          calls.mounted += 1;
        });
        def.lifecycle.onUnmounted(() => {
          calls.unmounted += 1;
        });
        def.lifecycle.onBeforeDispose(() => {
          calls.disposed += 1;
        });
        def.expose('view', {
          show: () => run.lifecycle.setPresent(true),
          hide: () => run.lifecycle.setPresent(false),
        });
        return (renderer) => {
          calls.render += 1;
          return renderer.el('div', 'ok');
        };
      },
    });

    AdaptToWebComponent(proto, { schedule: (task) => task() });
    const el = document.createElement(proto.name) as HTMLElement & {
      getExposes(): { view: { show(): void; hide(): void } };
    };
    document.body.appendChild(el);

    expect(el.isConnected).toBe(true);
    expect(el.querySelector('div')).toBeNull();
    expect(calls).toEqual({
      setup: 1,
      created: 1,
      render: 0,
      mounted: 0,
      unmounted: 0,
      disposed: 0,
    });

    el.getExposes().view.show();
    await flushReconciliation();
    expect(el.querySelector('div')?.textContent).toBe('ok');
    expect(calls.mounted).toBe(1);

    // The latest request wins before the WC reconciliation queue starts.
    el.getExposes().view.hide();
    el.getExposes().view.show();
    await flushReconciliation();
    expect(el.querySelector('div')).not.toBeNull();
    expect(calls.unmounted).toBe(0);

    el.getExposes().view.hide();
    await flushReconciliation();
    expect(el.isConnected).toBe(true);
    expect(calls.unmounted).toBe(1);
    expect(el.querySelector('div')).toBeNull();

    // Owner-level exposes survive view release and can rematerialize it.
    el.getExposes().view.show();
    await flushReconciliation();
    expect(el.querySelector('div')).not.toBeNull();
    expect(calls.setup).toBe(1);
    expect(calls.created).toBe(1);
    expect(calls.mounted).toBe(2);

    el.remove();
    await flushReconciliation();
    expect(calls.disposed).toBe(1);
  });

  it('preserves consumer light-DOM children while their projected view is detached', async () => {
    let run!: RunHandle<any>;
    const proto = definePrototype({
      name: 'x-wc-view-intent-slot',
      setup(def) {
        def.lifecycle.onCreated((nextRun) => {
          run = nextRun;
          run.lifecycle.setPresent(false);
        });
        def.expose('view', {
          show: () => run.lifecycle.setPresent(true),
          hide: () => run.lifecycle.setPresent(false),
        });
        return (renderer) => renderer.el('div', [renderer.slot()]);
      },
    });

    AdaptToWebComponent(proto, { schedule: (task) => task() });
    const el = document.createElement(proto.name) as HTMLElement & {
      getExposes(): { view: { show(): void; hide(): void } };
    };
    el.innerHTML = '<span>consumer</span>';
    document.body.appendChild(el);

    expect(el.innerHTML).toBe('<span>consumer</span>');
    expect(el.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(getComputedStyle(el).display).toBe('none');

    el.getExposes().view.show();
    await flushReconciliation();
    expect(el.innerHTML).toBe('<div><span>consumer</span></div>');
    expect(el.hasAttribute('data-pui-view-detached')).toBe(false);

    el.getExposes().view.hide();
    await flushReconciliation();
    expect(el.innerHTML).toBe('<span>consumer</span>');
    expect(el.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(getComputedStyle(el).display).toBe('none');

    el.remove();
    await flushReconciliation();
  });

  it('projects the latest a11y state before revealing a rematerialized view', async () => {
    let run!: RunHandle<any>;
    const proto = definePrototype({
      name: 'x-wc-view-intent-a11y-replay',
      setup(def) {
        const hidden = def.state.bool('hidden', true);
        asAccessible().state('hidden', hidden);
        def.lifecycle.onCreated((nextRun) => {
          run = nextRun;
          run.lifecycle.setPresent(false);
        });
        def.expose('view', {
          show: () => {
            hidden.set(false);
            run.lifecycle.setPresent(true);
          },
          hide: () => {
            hidden.set(true);
            run.lifecycle.setPresent(false);
          },
        });
      },
    });

    AdaptToWebComponent(proto, { schedule: (task) => task() });
    const el = document.createElement(proto.name) as HTMLElement & {
      getExposes(): { view: { show(): void; hide(): void } };
    };
    document.body.appendChild(el);

    el.getExposes().view.show();
    await flushReconciliation();
    expect(el.hasAttribute('data-pui-view-detached')).toBe(false);
    expect(el.hasAttribute('hidden')).toBe(false);
    expect(el.getAttribute('aria-hidden')).toBe('false');

    el.getExposes().view.hide();
    await flushReconciliation();
    expect(el.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(el.hasAttribute('hidden')).toBe(true);

    el.getExposes().view.show();
    await flushReconciliation();
    expect(el.hasAttribute('data-pui-view-detached')).toBe(false);
    expect(el.hasAttribute('hidden')).toBe(false);
    expect(el.getAttribute('aria-hidden')).toBe('false');

    el.remove();
    await flushReconciliation();
  });
});
