import { describe, expect, it } from 'vitest';
import { definePrototype, tw } from '@proto.ui/core';
import { AdaptToWebComponent } from '../src';
import { renderProtoShadowSplitStyleArtifact } from '../../../cli/src/services/proto-style-css';

let serial = 0;
type Delivery = 'synchronous' | 'deferred';

function createConsumer(delivery: Delivery) {
  const tasks: Array<() => void> = [];
  const environmentListeners = new Set<() => void>();
  const caller = document.createElement('input');
  caller.value = 'Caller';
  const { promise: disposed, resolve: finishDisposal } = Promise.withResolvers<void>();
  const C = AdaptToWebComponent(
    definePrototype({
      name: `split-mounted-consumer-${++serial}`,
      setup(def) {
        def.feedback.style.use(tw('p-2'));
        def.expose.method('ping', () => 'live');
        def.expose.event('ready', { payload: 'json' });
        def.expose.event('action', { payload: 'json' });
        def.lifecycle.onMounted((run) => run.expose.emit('ready', { phase: 'mounted' }));
        def.event.on('host:click', (run) => run.expose.emit('action', { source: 'host' }));
        return (r) => r.slot();
      },
    }),
    {
      shadow: {
        mode: 'open',
        presentation: 'split',
        styleArtifact: renderProtoShadowSplitStyleArtifact(['p-2']),
        colorSchemeSource: {
          get: () => 'light',
          subscribe(listener) {
            environmentListeners.add(listener);
            return () => environmentListeners.delete(listener);
          },
        },
      },
      schedule(task) {
        if (delivery === 'synchronous') task();
        else tasks.push(task);
      },
      diagnostics: {
        onLifecycleEvent(event) {
          if (event.type === 'instance.dispose.done') finishDisposal();
        },
      },
    }
  );
  const host = new C();
  host.append(caller);
  const ready: unknown[] = [];
  const actions: unknown[] = [];
  host.addEventListener('ready', (event) => {
    const surface = host.shadowRoot?.querySelector('[part="surface"]');
    ready.push({
      detail: (event as CustomEvent<unknown>).detail,
      connected: host.isConnected,
      surfaceStyle: surface?.getAttribute('data-pui-style'),
      rootStyle: host.getAttribute('data-pui-split-root-style'),
      scheme: host.getAttribute('data-pui-color-scheme'),
      callerAssigned: surface?.querySelector('slot')?.assignedNodes()[0] === caller,
    });
    // The App Maker consumes the real outward mounted signal.
    caller.value = 'Mounted caller';
  });
  host.addEventListener('action', (event) => {
    actions.push((event as CustomEvent<unknown>).detail);
  });
  return {
    host,
    caller,
    ready,
    actions,
    disposed,
    environmentListeners,
    flushScheduled() {
      // Bound a broken scheduler/reentrant producer without relying on timing.
      for (let turn = 0; tasks.length && turn < 20; turn++) {
        for (const task of tasks.splice(0)) task();
      }
      expect(tasks).toHaveLength(0);
    },
  };
}

// C-LIFECYCLE-0002-D/I; A-WEB-COMPONENT-0001-I.
// These are public Adapter consumer checks, not browser paint evidence.
describe('split mounted consumer delivery', () => {
  it.each(['synchronous', 'deferred'] as const)(
    'publishes the caller and admitted Root effect before %s mounted delivery',
    async (delivery) => {
      const f = createConsumer(delivery);
      try {
        document.body.append(f.host);
        if (delivery === 'deferred') {
          expect(f.caller.value).toBe('Caller');
          expect(f.ready).toEqual([]);
          const assigned = f.host.shadowRoot?.querySelector('slot')?.assignedNodes();
          expect(assigned).toHaveLength(1);
          expect(assigned?.[0]).toBe(f.caller);
        }
        f.flushScheduled();
        expect(f.ready).toEqual([
          {
            detail: { phase: 'mounted' },
            connected: true,
            surfaceStyle: expect.stringContaining('p-2'),
            rootStyle: expect.stringContaining('p-2'),
            scheme: 'light',
            callerAssigned: true,
          },
        ]);
        expect(f.caller.value).toBe('Mounted caller');
        expect(f.host.firstChild).toBe(f.caller);
        const exposes = f.host.getExposes();
        if (typeof exposes.ping !== 'function') throw new Error('Missing public ping method.');
        expect(exposes.ping()).toBe('live');
        f.host.click();
        expect(f.actions).toEqual([{ source: 'host' }]);
        expect(f.environmentListeners.size).toBe(1);
        f.host.remove();
        await f.disposed;
        expect(f.environmentListeners.size).toBe(0);
        expect(f.host.shadowRoot?.childNodes).toHaveLength(0);
      } finally {
        f.host.remove();
        await Promise.resolve();
      }
    }
  );

  it('retires the published split owner before deferred mounted delivery without reviving it', async () => {
    const f = createConsumer('deferred');
    try {
      document.body.append(f.host);
      expect(f.caller.value).toBe('Caller');
      expect(f.ready).toEqual([]);
      expect(f.host.getAttribute('data-pui-split-root-style')).toContain('p-2');
      const assigned = f.host.shadowRoot?.querySelector('slot')?.assignedNodes();
      expect(assigned).toHaveLength(1);
      expect(assigned?.[0]).toBe(f.caller);
      expect(f.environmentListeners.size).toBe(1);
      f.host.remove();
      await f.disposed;
      expect(f.host.getExposes?.() ?? {}).toEqual({});
      expect(f.host.shadowRoot?.childNodes).toHaveLength(0);
      expect(f.environmentListeners.size).toBe(0);
      f.flushScheduled();
      f.host.click();
      expect(f.ready).toEqual([]);
      expect(f.actions).toEqual([]);
      expect(f.caller.value).toBe('Caller');
      expect(f.caller.parentNode).toBe(f.host);
      expect(f.caller.isConnected).toBe(false);
      expect(f.host.getExposes?.() ?? {}).toEqual({});
      expect(f.host.hasAttribute('data-pui-color-scheme')).toBe(false);
      expect(f.host.hasAttribute('data-pui-split-root-style')).toBe(false);
      expect(f.host.shadowRoot?.childNodes).toHaveLength(0);
      expect(f.environmentListeners.size).toBe(0);
    } finally {
      f.host.remove();
      await Promise.resolve();
    }
  });
});
