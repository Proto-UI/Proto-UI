import { describe, it, expect } from 'vitest';
import type { Prototype } from '@proto.ui/core';
import type { RuntimeHost } from '../../src';
import { executeWithHost } from '../../src';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import { isExposeEventDeclaration } from '@proto.ui/module-expose';
import { EXPOSES_RECORD_SINK_CAP } from '@proto.ui/module-expose-state';

function createMockHost() {
  const emitted: Array<{ key: string; payload: any; options: any }> = [];
  const exposes: Array<Record<string, unknown>> = [];

  const host: RuntimeHost<any> = {
    prototypeName: 'expose-event-contract',
    getRawProps() {
      return {};
    },
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    onRuntimeReady(wiring) {
      wiring.attach('expose-event', [
        [
          EXPOSE_EVENT_SINK_CAP,
          (key: string, payload: unknown, options: unknown) => {
            emitted.push({ key, payload, options });
          },
        ],
      ]);
      wiring.attach('expose-state', [
        [EXPOSES_RECORD_SINK_CAP, (r: Record<string, unknown>) => exposes.push(r)],
      ]);
    },
  };

  return { host, emitted, exposes };
}

describe('runtime contract: expose-event (v0)', () => {
  it('emit registered expose.event maps to host sink', () => {
    const P: Prototype<any> = {
      name: 'x-expose-event-emit',
      setup(def) {
        def.expose.event('ready', { payload: 'json' });
        def.lifecycle.onMounted((run) => {
          run.expose.emit('ready', { ok: true }, { note: 'x' });
        });
        return (r: any) => [r.el('div', 'ok')];
      },
    };

    const { host, emitted, exposes } = createMockHost();
    executeWithHost(P as any, host as any);

    expect(emitted).toEqual([{ key: 'ready', payload: { ok: true }, options: { note: 'x' } }]);
    expect(exposes.length).toBeGreaterThan(0);
    const last = exposes[exposes.length - 1];
    expect(isExposeEventDeclaration(last.ready)).toBe(true);
  });

  it('emit unregistered expose.event throws', () => {
    const P: Prototype<any> = {
      name: 'x-expose-event-throw',
      setup(def) {
        def.lifecycle.onMounted((run) => {
          run.expose.emit('missing', 1);
        });
        return (r) => [r.el('div', 'ok')];
      },
    };

    const { host } = createMockHost();
    expect(() => executeWithHost(P as any, host as any)).toThrow();
  });

  it('duplicate expose event keys do not leave stale event registrations', () => {
    const P: Prototype<any> = {
      name: 'x-expose-event-duplicate-key',
      setup(def) {
        def.expose.value('ready', 1);
        expect(() => def.expose.event('ready', { payload: 'json' })).toThrow();
        def.lifecycle.onMounted((run) => {
          expect(() => run.expose.emit('ready', { ok: true })).toThrow();
        });
        return (r) => [r.el('div', 'ok')];
      },
    };

    const { host, emitted } = createMockHost();
    expect(() => executeWithHost(P as any, host as any)).not.toThrow();
    expect(emitted).toEqual([]);
  });

  it('rejects legacy sink wiring on the Event module with a migration diagnostic', () => {
    const P: Prototype<any> = {
      name: 'x-expose-event-legacy-wiring',
      setup() {
        return (r) => [r.el('div', 'ok')];
      },
    };
    const { host } = createMockHost();
    host.onRuntimeReady = (wiring) => {
      wiring.attach('event', [[EXPOSE_EVENT_SINK_CAP, () => undefined]]);
    };

    expect(() => executeWithHost(P as any, host as any)).toThrow(
      /wired to the expose-event module, not event/i
    );
  });
});
