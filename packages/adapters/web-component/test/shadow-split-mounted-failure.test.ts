import { describe, expect, it } from 'vitest';
import { definePrototype, tw } from '@proto.ui/core';
import { AdaptToWebComponent } from '../src';
import { renderProtoShadowSplitStyleArtifact } from '../../../cli/src/services/proto-style-css';

let serial = 0;
const failures = [
  { label: 'Error identity', value: new Error('authored mounted failed') },
  { label: 'object identity', value: { reason: 'authored mounted failed' } },
  { label: 'zero', value: 0 },
  { label: 'null', value: null },
  { label: 'undefined', value: undefined },
];

// Compatibility regression for the existing synchronous scheduler boundary.
// C-LIFECYCLE-0002-D/I governs ordering, not general callback error recovery.
// This uses the real Adapter and native Custom Element connection entry point
// in the DOM harness; it makes no browser paint or native18 acceptance claim.
describe('split synchronous mounted failure consumer', () => {
  it.each(failures)(
    'preserves $label through scheduling and connection cleanup',
    async ({ value }) => {
      const environmentListeners = new Set<() => void>();
      const schedulerFailures: unknown[] = [];
      const connectionFailures: unknown[] = [];
      const snapshots: unknown[] = [];
      const caller = document.createElement('input');
      caller.value = 'Caller';
      let laterMounted = 0;
      let staleClicks = 0;
      let beforeDispose = 0;
      let disposalCount = 0;
      let host!: HTMLElement & { getExposes?: () => Record<string, unknown> };
      const { promise: disposed, resolve: finishDisposal } = Promise.withResolvers<void>();
      const C = AdaptToWebComponent(
        definePrototype({
          name: `split-mounted-failure-${++serial}`,
          setup(def) {
            def.feedback.style.use(tw('p-2'));
            def.expose.method('ping', () => 'live');
            def.event.on('host:click', () => staleClicks++);
            def.lifecycle.onMounted(() => {
              const surface = host.shadowRoot?.querySelector('[part="surface"]');
              snapshots.push({
                rootStyle: host.getAttribute('data-pui-split-root-style'),
                surfaceStyle: surface?.getAttribute('data-pui-style'),
                callerAssigned: surface?.querySelector('slot')?.assignedNodes()[0] === caller,
                scheme: host.getAttribute('data-pui-color-scheme'),
              });
              throw value;
            });
            def.lifecycle.onMounted(() => laterMounted++);
            def.lifecycle.onBeforeDispose(() => beforeDispose++);
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
            // A consumer-provided immediate scheduler must still see task failure
            // before it returns. Capture and rethrow the identical value.
            try {
              task();
            } catch (error) {
              schedulerFailures.push(error);
              throw error;
            }
          },
          diagnostics: {
            onLifecycleEvent(event) {
              if (event.type === 'instance.dispose.done') {
                disposalCount++;
                finishDisposal();
              }
            },
          },
        }
      );
      host = new C();
      host.append(caller);
      const capture = (event: ErrorEvent) => {
        connectionFailures.push(event.error);
        event.preventDefault();
      };
      window.addEventListener('error', capture);
      try {
        try {
          document.body.append(host);
        } catch (error) {
          connectionFailures.push(error);
        }
        // Count separately from the payload: throwing undefined is still failure.
        // On the queued baseline this fails immediately, without waiting for a
        // disposal signal that the lost synchronous failure never initiated.
        expect(schedulerFailures).toHaveLength(1);
        expect(schedulerFailures[0]).toBe(value);
        expect(connectionFailures).toHaveLength(1);
        expect(snapshots).toEqual([
          {
            rootStyle: expect.stringContaining('p-2'),
            surfaceStyle: expect.stringContaining('p-2'),
            callerAssigned: true,
            scheme: 'light',
          },
        ]);
        expect(laterMounted).toBe(0);
        await disposed;
        expect(beforeDispose).toBe(1);
        expect(disposalCount).toBe(1);
        expect(environmentListeners.size).toBe(0);
        expect(host.getExposes?.() ?? {}).toEqual({});
        expect(host.shadowRoot?.childNodes).toHaveLength(0);
        expect(host.hasAttribute('data-pui-split-root-style')).toBe(false);
        expect(host.hasAttribute('data-pui-color-scheme')).toBe(false);
        expect(host.firstChild).toBe(caller);
        expect(caller.value).toBe('Caller');
        host.click();
        expect(staleClicks).toBe(0);
        host.remove();
        await Promise.resolve();
        expect(disposalCount).toBe(1);
      } finally {
        host.remove();
        await Promise.resolve();
        window.removeEventListener('error', capture);
      }
    }
  );
});
