// packages/runtime/test/contract/state-phase-guards.v0.contract.test.ts
import { describe, it, expect } from 'vitest';
import type { Prototype, OwnedStateHandle } from '@proto.ui/core';
import type { StatePort } from '@proto.ui/module-state';
import { executeWithHost, RuntimeHost } from '../../src';

/**
 * Runtime Contract (v0): phase guards for OwnedStateHandle APIs
 *
 * This file asserts the *runtime-enforced* phase policy for owned state:
 * - setup phase:
 *   - `setDefault()` allowed
 *   - `set()` MUST throw
 * - runtime callback phase (e.g. created/mounted/updated/unmounted):
 *   - `set()` allowed
 *   - `setDefault()` MUST throw
 *
 * Notes:
 * - The kernel itself is intentionally phase-agnostic; it accepts operations anytime.
 * - Phase enforcement is a runtime/module concern (SystemCaps / exec-phase guard / module wrapper).
 * - This contract intentionally does NOT cover watch/borrowed/observed/exposed projections.
 */
describe('runtime contract: state phase guards (v0)', () => {
  it('owned handle phase guards: setDefault setup-only; set runtime-only', () => {
    const host: RuntimeHost<any> = {
      prototypeName: 'x-runtime-state-guards',
      getRawProps() {
        return {};
      },
      commit(_children, signal) {
        signal?.done();
      },
      schedule(task) {
        task();
      },
    };

    let s!: OwnedStateHandle<boolean>;

    const P: Prototype = {
      name: 'x-runtime-state-guards',
      setup(def) {
        s = def.state.bool('open', false);

        // setup: set must throw; setDefault allowed
        expect(() => s.set(true)).toThrow();
        expect(() => s.setDefault(false)).not.toThrow();

        def.lifecycle.onCreated(() => {
          // runtime callback: set allowed; setDefault must throw
          expect(() => s.setDefault(true)).toThrow();
          expect(() => s.set(true)).not.toThrow();
        });

        return (r) => [r.el('div', 'ok')];
      },
    };

    executeWithHost(P, host);
  });

  it('[T-STATE-0004-CASE-CALLBACK-SCOPE] dispatches internal state watch callbacks in callback phase', () => {
    const host: RuntimeHost<any> = {
      prototypeName: 'x-runtime-state-watch-callback-scope',
      getRawProps: () => ({}),
      commit(_children, signal) {
        signal?.done();
      },
      schedule(task) {
        task();
      },
    };

    let source!: OwnedStateHandle<boolean>;
    let derived!: OwnedStateHandle<boolean>;
    const P: Prototype = {
      name: 'x-runtime-state-watch-callback-scope',
      setup(def) {
        source = def.state.bool('source', false);
        derived = def.state.bool('derived', false);
      },
    };

    const session = executeWithHost(P, host);
    const kernel = session.kernel!;
    const statePort = session.caps.getPort<StatePort>('state')!;
    const phases: string[] = [];
    let receivedRun: unknown;

    statePort.watch(source, (run, event) => {
      if (event.type !== 'next') return;
      receivedRun = run;
      phases.push(kernel.getPhase());
      derived.set(event.next, 'reason: state watch callback regression');
    });

    expect(kernel.getPhase()).toBe('unknown');
    expect(() => statePort.set(source, true, 'reason: privileged host fact')).not.toThrow();
    expect(phases).toEqual(['callback']);
    expect(receivedRun).toBe(kernel.run);
    expect(derived.get()).toBe(true);
    expect(kernel.getPhase()).toBe('unknown');
    expect(() => derived.set(false)).toThrow();

    statePort.watch(source, (_run, event) => {
      if (event.type === 'next') throw new Error('state watcher callback failed');
    });
    expect(() =>
      statePort.set(source, false, 'reason: privileged host fact with throwing watcher')
    ).toThrow('state watcher callback failed');
    expect(kernel.getPhase()).toBe('unknown');
    expect(() => derived.set(true)).toThrow();
  });
});
