import { describe, it, expect } from 'vitest';
import type { Prototype } from '@proto.ui/core';
import { executeWithHost } from '@proto.ui/runtime';
import { EXPOSES_RECORD_SINK_CAP } from '@proto.ui/module-expose-state';

function makeHost() {
  const tasks: Array<() => void> = [];
  let lastExposes: Record<string, unknown> | null = null;

  const host = {
    prototypeName: 'x-expose-state-contract',
    getRawProps() {
      return {} as any;
    },
    schedule(task: () => void) {
      tasks.push(task);
    },
    commit(_children: any, signal?: { done(): void }) {
      signal?.done();
    },
    onRuntimeReady(wiring: any) {
      wiring.attach('expose-state', [
        [
          EXPOSES_RECORD_SINK_CAP,
          (record: Record<string, unknown>) => {
            lastExposes = record;
          },
        ],
      ]);
    },
  } as any;

  return { host, tasks, getExposes: () => lastExposes };
}

describe('runtime contract: expose-state (v0)', () => {
  it('projects state handle to external handle with spec + subscribe', () => {
    const P: Prototype = {
      name: 'x-es-rt',
      setup(def) {
        const s = def.state.bool('ready', false);
        def.expose('ready', s);
        def.lifecycle.onMounted(() => {
          s.set(true);
        });
        return (r) => [r.el('div', 'ok')];
      },
    };

    const { host, tasks, getExposes } = makeHost();

    executeWithHost(P as any, host as any);

    const exposes = getExposes();
    expect(exposes).toBeTruthy();
    const ready: any = exposes?.ready;

    expect(typeof ready.get).toBe('function');
    expect(typeof ready.subscribe).toBe('function');
    expect(typeof ready.unsubscribe).toBe('function');
    expect(ready.spec?.kind).toBe('bool');
    expect((ready as any).set).toBeUndefined();

    const events: any[] = [];
    const off = ready.subscribe((e: any) => events.push(e));

    // flush scheduled mounted callbacks
    for (const t of tasks) t();

    expect(events.length).toBeGreaterThan(0);
    expect(events[0].type).toBe('next');
    expect(events[0].next).toBe(true);

    off();
  });
});
