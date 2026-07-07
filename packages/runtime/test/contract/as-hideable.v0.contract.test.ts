import { describe, expect, it } from 'vitest';
import { definePrototype, type HideableHandle } from '@proto.ui/core';
import { asHideable } from '@proto.ui/hooks';
import type { PropsBaseType } from '@proto.ui/types';
import { VISIBILITY_HOST_BRIDGE_CAP, type VisibilityPort } from '@proto.ui/module-visibility';
import type { RuntimeHost } from '../../src';
import { executeWithHost } from '../../src';

const createHost = <P extends PropsBaseType>(
  name: string,
  opt?: { onVisibilityProject?: (facts: { hidden: boolean }) => void }
): RuntimeHost<P> => ({
  prototypeName: name,
  getRawProps: () => ({}) as any,
  commit(_children, signal) {
    signal?.done();
  },
  schedule(task) {
    task();
  },
  onRuntimeReady(wiring) {
    if (!opt?.onVisibilityProject) return;
    wiring.attach('visibility', [
      [
        VISIBILITY_HOST_BRIDGE_CAP,
        {
          project: opt.onVisibilityProject,
        },
      ],
    ]);
  },
});

describe('runtime contract: asHideable (v0)', () => {
  it('AS-HIDEABLE-0100: repeated asHideable calls reuse one no-arg privileged handle', () => {
    let first!: HideableHandle<PropsBaseType>;
    let second!: HideableHandle<PropsBaseType>;

    const P = definePrototype({
      name: 'x-as-hideable-0100',
      setup() {
        first = asHideable<PropsBaseType>();
        first.setDefaultHidden(true);
        second = asHideable<PropsBaseType>();
        return (r) => r.el('div', 'ok');
      },
    });

    const result = executeWithHost(P as any, createHost(P.name) as any);
    const port = result.caps.getPort<VisibilityPort>('visibility');

    expect(first).toBe(second);
    expect(first.hidden.get()).toBe(true);
    expect(port?.getConfig()).toEqual({ defaultHidden: true });
    expect(port?.getFacts()).toEqual({ hidden: true });
    expect((P as any).__asHooks).toEqual([
      { name: 'asHideable', order: 0, privileged: true, mode: 'once' },
    ]);
  });

  it('AS-HIDEABLE-0200: hidden is a state-backed observed handle without write authority', () => {
    let hideable!: HideableHandle<PropsBaseType>;
    const seen: any[] = [];

    const P = definePrototype({
      name: 'x-as-hideable-0200',
      setup(def) {
        hideable = asHideable<PropsBaseType>();
        hideable.hidden.watch((run, e) => {
          seen.push({ run, e });
        });
        def.lifecycle.onCreated(() => {
          hideable.hide();
        });
        return (r) => r.el('div', 'ok');
      },
    });

    executeWithHost(P as any, createHost(P.name) as any);

    expect(typeof hideable.hidden.get).toBe('function');
    expect(typeof hideable.hidden.watch).toBe('function');
    expect((hideable.hidden as any).set).toBeUndefined();
    expect((hideable.hidden as any).setDefault).toBeUndefined();
    expect((hideable.hidden as any).__stateId).toBeTruthy();
    expect((hideable.hidden as any).__stateName).toBe('hidden');
    expect(seen).toHaveLength(1);
    expect(typeof seen[0].run?.update).toBe('function');
    expect(seen[0].e).toMatchObject({
      type: 'next',
      prev: false,
      next: true,
      reason: 'visibility.hide',
    });
  });

  it('AS-HIDEABLE-0300: setup default and runtime mutation APIs are phase guarded', () => {
    let hideable!: HideableHandle<PropsBaseType>;
    const calls: string[] = [];
    const projected: Array<{ hidden: boolean }> = [];

    const P = definePrototype({
      name: 'x-as-hideable-0300',
      setup(def) {
        hideable = asHideable<PropsBaseType>();
        hideable.setDefaultHidden(false);
        expect(() => hideable.hide()).toThrow(/callback|runtime/i);
        expect(() => hideable.show()).toThrow(/callback|runtime/i);
        expect(() => hideable.setHidden(true)).toThrow(/callback|runtime/i);

        def.lifecycle.onCreated(() => {
          expect(() => hideable.setDefaultHidden(true)).toThrow(/setup/i);
          hideable.hide();
          calls.push(String(hideable.hidden.get()));
          hideable.show();
          calls.push(String(hideable.hidden.get()));
          hideable.setHidden(true);
          calls.push(String(hideable.hidden.get()));
        });
        return (r) => r.el('div', 'ok');
      },
    });

    const result = executeWithHost(
      P as any,
      createHost(P.name, {
        onVisibilityProject: (facts) => {
          projected.push({ ...facts });
        },
      }) as any
    );
    const port = result.caps.getPort<VisibilityPort>('visibility');

    expect(calls).toEqual(['true', 'false', 'true']);
    expect(port?.getFacts()).toEqual({ hidden: true });
    expect(projected).toEqual([
      { hidden: false },
      { hidden: false },
      { hidden: true },
      { hidden: false },
      { hidden: true },
    ]);
  });
});
