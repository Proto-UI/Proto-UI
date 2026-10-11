import { describe, expect, it, vi } from 'vitest';
import {
  createA11ySemanticObjectRef,
  definePrototype,
  type AccessibleHandle,
  type OwnedStateHandle,
  type State,
  type A11ySemanticObjectSnapshot,
} from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { A11Y_PROJECT_CAP, createWebA11yProjector, type A11yPort } from '@proto.ui/module-a11y';
import { createRuntimeSession, executeWithHost, type RuntimeHost } from '../../src';

// T-A11Y-0001-CASE-STATE-CONDITION
// T-A11Y-0001-CASE-STATE-CONDITION-LIFECYCLE
function fixture(web = false) {
  let gate!: OwnedStateHandle<boolean>;
  let value!: OwnedStateHandle<number>;
  let accessible!: AccessibleHandle;
  const snapshots: A11ySemanticObjectSnapshot[] = [];
  const target = document.createElement('div');
  const projector = createWebA11yProjector(() => target);
  const prototype = definePrototype({
    name: 'a11y-conditional-state',
    setup(def) {
      gate = def.state.bool('applicable', true);
      value = def.state.numberDiscrete('value', 25);
      accessible = asAccessible();
      accessible.role('separator');
      for (const key of ['valueMin', 'valueMax', 'valueNow'] as const) {
        accessible.state(key, value, { when: gate });
      }
      accessible.state('disabled', def.state.bool('disabled', false));
    },
  });
  const host: RuntimeHost<any> = {
    prototypeName: prototype.name,
    getRawProps: () => ({}),
    commit: (_children, signal) => signal?.done(),
    schedule: (task) => task(),
    onRuntimeReady: (wiring) =>
      wiring.attach('a11y', [
        [
          A11Y_PROJECT_CAP,
          Object.assign(
            (snapshot: A11ySemanticObjectSnapshot) => {
              snapshots.push(snapshot);
              if (web) projector(snapshot);
            },
            {
              detach: () => projector.detach?.(),
              reactivate: () => projector.reactivate?.(),
              dispose: () => projector.dispose?.(),
            }
          ),
        ],
      ]),
  };
  return {
    prototype,
    host,
    snapshots,
    target,
    get gate() {
      return gate;
    },
    get value() {
      return value;
    },
    get accessible() {
      return accessible;
    },
  };
}

describe('A11y conditional State applicability', () => {
  it('omits all three range keys and restores the current value after inactive changes', () => {
    const f = fixture();
    const result = executeWithHost(f.prototype, f.host);
    const snapshot = () => result.caps.getPort<A11yPort>('a11y')!.getSnapshot();
    expect(snapshot().states).toEqual({
      valueMin: 25,
      valueMax: 25,
      valueNow: 25,
      disabled: false,
    });
    result.invokeInCallbackScope(() => f.gate.set(false));
    expect(snapshot().states).toEqual({ disabled: false });
    result.invokeInCallbackScope(() => f.value.set(37));
    expect(snapshot().states).toEqual({ disabled: false });
    result.invokeInCallbackScope(() => f.gate.set(true));
    expect(snapshot().states.valueNow).toBe(37);
    expect(f.snapshots.at(-1)?.states.valueNow).toBe(37);
    result.invokeUnmounted();
  });

  it('preserves host baselines and later host rewrites on conditional withdrawal', () => {
    const f = fixture(true);
    f.target.setAttribute('aria-valuenow', 'original');
    const result = executeWithHost(f.prototype, f.host);
    expect(f.target.getAttribute('aria-valuenow')).toBe('25');
    result.invokeInCallbackScope(() => f.gate.set(false));
    expect(f.target.getAttribute('aria-valuenow')).toBe('original');
    expect(f.target.hasAttribute('aria-valuemin')).toBe(false);
    expect(f.target.hasAttribute('aria-valuemax')).toBe(false);
    result.invokeInCallbackScope(() => f.gate.set(true));
    f.target.setAttribute('aria-valuenow', 'later-host');
    result.invokeInCallbackScope(() => f.gate.set(false));
    expect(f.target.getAttribute('aria-valuenow')).toBe('later-host');
    result.invokeUnmounted();
  });

  it('replays current applicability after detach and remount without stale projection', async () => {
    const f = fixture(true);
    const session = createRuntimeSession(f.prototype, f.host);
    await session.mount();
    await session.unmount();
    const count = f.snapshots.length;
    session.invokeInCallbackScope(() => {
      f.gate.set(false);
      f.value.set(42);
    });
    expect(f.snapshots).toHaveLength(count);
    await session.mount();
    expect(f.snapshots.at(-1)?.states).toEqual({ disabled: false });
    session.invokeInCallbackScope(() => f.gate.set(true));
    expect(f.target.getAttribute('aria-valuenow')).toBe('42');
    await session.dispose();
    expect(f.target.hasAttribute('aria-valuenow')).toBe(false);
  });

  it.each([false, true, null, 0, () => true])('rejects non-State conditions (%s)', (condition) => {
    const P = definePrototype({
      name: 'invalid-condition',
      setup(def) {
        asAccessible().state('valueNow', def.state.numberDiscrete('value', 1), {
          when: condition as unknown as State<boolean>,
        });
      },
    });
    expect(() => executeWithHost(P, fixture().host)).toThrow(/condition|when|State/i);
  });

  it('rejects an initially non-Boolean real State condition', () => {
    const P = definePrototype({
      name: 'invalid-condition-value',
      setup(def) {
        asAccessible().state('valueNow', def.state.numberDiscrete('value', 1), {
          when: def.state.numberDiscrete('condition', 1) as unknown as State<boolean>,
        });
      },
    });
    expect(() => executeWithHost(P, fixture().host)).toThrow(/condition|when|Boolean/i);
  });

  it('omits a later non-Boolean condition without mutating it, then recovers', () => {
    const f = fixture();
    const result = executeWithHost(f.prototype, f.host);
    result.invokeInCallbackScope(() => (f.gate as OwnedStateHandle<unknown>).set('invalid'));
    expect(f.gate.get()).toBe('invalid');
    expect(f.snapshots.at(-1)?.states).toEqual({ disabled: false });
    result.invokeInCallbackScope(() => f.gate.set(true));
    expect(f.snapshots.at(-1)?.states.valueNow).toBe(25);
    result.invokeUnmounted();
  });

  it('does not hide a value read error behind an inactive condition', () => {
    const f = fixture();
    const result = executeWithHost(f.prototype, f.host);
    result.invokeInCallbackScope(() => f.gate.set(false));
    const error = new Error('source read failed');
    const spy = vi.spyOn(f.value, 'get').mockImplementation(() => {
      throw error;
    });
    expect(() => result.caps.getPort<A11yPort>('a11y')!.getSnapshot()).toThrow(error);
    spy.mockRestore();
    result.invokeUnmounted();
  });
  it('validates the final setup condition before alive', () => {
    const P = definePrototype({
      name: 'invalid-final-condition',
      setup(def) {
        const gate = def.state.bool('gate', true);
        asAccessible().state('valueNow', def.state.numberDiscrete('value', 1), { when: gate });
        (gate as OwnedStateHandle<unknown>).setDefault('invalid');
      },
    });
    expect(() => executeWithHost(P, fixture().host)).toThrow(/condition|when|Boolean/i);
  });

  it('replaces value and condition together and keeps independent keys independent', () => {
    let old!: OwnedStateHandle<boolean>,
      active!: OwnedStateHandle<boolean>,
      other!: OwnedStateHandle<boolean>;
    let value!: OwnedStateHandle<number>;
    const P = definePrototype({
      name: 'winning-conditional-binding',
      setup(def) {
        old = def.state.bool('old', false);
        active = def.state.bool('active', true);
        other = def.state.bool('other', false);
        value = def.state.numberDiscrete('value', 3);
        const a = asAccessible();
        a.state('valueNow', def.state.numberDiscrete('old-value', 1), { when: old });
        a.state('valueNow', value, { when: active });
        a.state('valueMax', value, { when: other });
        a.state('checked', def.state.bool('checked', false), { when: active });
      },
    });
    const f = fixture();
    const result = executeWithHost(P, f.host);
    expect(f.snapshots.at(-1)?.states).toEqual({ valueNow: 3, checked: false });
    const count = f.snapshots.length;
    result.invokeInCallbackScope(() => old.set(true));
    expect(f.snapshots).toHaveLength(count);
    result.invokeInCallbackScope(() => other.set(true));
    expect(f.snapshots.at(-1)?.states.valueMax).toBe(3);
    result.invokeInCallbackScope(() => active.set(false));
    expect(f.snapshots.at(-1)?.states).toEqual({ valueMax: 3 });
    result.invokeUnmounted();
  });

  it('rejects retained conditional declarations without replacing the original binding', () => {
    const f = fixture();
    const result = executeWithHost(f.prototype, f.host);
    expect(() => f.accessible.state('valueNow', f.value, { when: f.gate })).toThrow();
    result.invokeInCallbackScope(() => f.gate.set(false));
    expect(f.snapshots.at(-1)?.states).toEqual({ disabled: false });
    result.invokeUnmounted();
  });

  it('does not swallow condition read errors', () => {
    const f = fixture();
    const result = executeWithHost(f.prototype, f.host);
    const error = new Error('condition read failed');
    const spy = vi.spyOn(f.gate, 'get').mockImplementation(() => {
      throw error;
    });
    expect(() => result.caps.getPort<A11yPort>('a11y')!.getSnapshot()).toThrow(error);
    spy.mockRestore();
    result.invokeUnmounted();
  });

  it('withdraws only its own contribution when a second semantic object owns the same target', () => {
    const f = fixture(true);
    const result = executeWithHost(f.prototype, f.host);
    const second = createWebA11yProjector(() => f.target);
    const ref = result.caps.getPort<A11yPort>('a11y')!.getSnapshot();
    second({ ...ref, objectRef: createA11ySemanticObjectRef(), states: { valueNow: 75 } });
    expect(f.target.getAttribute('aria-valuenow')).toBe('75');
    result.invokeInCallbackScope(() => f.gate.set(false));
    expect(f.target.getAttribute('aria-valuenow')).toBe('75');
    second.dispose?.();
    expect(f.target.hasAttribute('aria-valuenow')).toBe(false);
    result.invokeUnmounted();
  });
});
