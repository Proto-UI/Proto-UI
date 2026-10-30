import { describe, expect, it } from 'vitest';
import type {
  FocusRequestOptions,
  FocusScopeActivationOptions,
  FocusScopeConfig,
} from '@proto.ui/core';
import { FocusCenter, type FocusCenterEntry } from '../src/center';

// Module policy tests, not native focus/paint or Dialog consumer acceptance.
function fixture(configuredEntry: FocusScopeConfig['entry'] = 'first', child = true) {
  const center = new FocusCenter();
  const moves: Array<{ name: string; options: FocusRequestOptions | undefined }> = [];
  const warnings: string[] = [];
  const scopeToken = {};
  let active = false;
  function entry(name: string, parent: object | null, scope = false): FocusCenterEntry {
    let focused = name === 'outside';
    // A materialized target exercises actual scope admission, not the pending-target bypass.
    const target = document.createElement('button');
    return {
      instance: scope ? scopeToken : { name },
      getParent: () => parent,
      isFocusable: () => !scope,
      isScopeProvider: () => scope,
      isRovingProvider: () => false,
      getFocusableConfig: () => ({ autoFocus: false, disabled: false, navParticipation: 'auto' }),
      getScopeConfig: () =>
        ({
          entry: configuredEntry,
          emptyPolicy: 'none',
          trap: true,
          loop: true,
        }) as FocusScopeConfig,
      getRovingConfig: () => ({ loop: true }) as ReturnType<FocusCenterEntry['getRovingConfig']>,
      getFacts: () =>
        ({ focused, focusVisible: false, active: false }) as ReturnType<
          FocusCenterEntry['getFacts']
        >,
      getRootTarget: () => target,
      requestFocus: (options) => {
        focused = true;
        moves.push({ name, options });
        return 'applied';
      },
      hasPendingFocus: () => false,
      clearFocus: () => {
        focused = false;
      },
      setScopeActive: (next) => {
        if (scope) active = next;
      },
      pushWarning: (message) => {
        warnings.push(message);
      },
    };
  }
  const outside = entry('outside', null);
  const scope = entry('scope', null, true);
  const inside = entry('inside', scopeToken);
  center.upsert(outside);
  center.upsert(scope);
  if (child) center.upsert(inside);
  return { center, scope, outside, inside, moves, warnings, active: () => active };
}

describe('FocusScope per-activation manual entry override', () => {
  for (const reason of ['keyboard', 'pointer', 'programmatic'] as const) {
    it(`keeps configured default entry and ${reason} request options`, () => {
      const f = fixture();
      expect(f.center.activateScope(f.scope, { reason, preventScroll: true })).toBe(true);
      expect(f.moves).toEqual([{ name: 'inside', options: { reason, preventScroll: true } }]);
      expect(f.active()).toBe(true);
    });
  }
  it('keeps omitted options defaulting to programmatic', () => {
    const f = fixture();
    f.center.activateScope(f.scope);
    expect(f.moves).toEqual([{ name: 'inside', options: { reason: 'programmatic' } }]);
  });
  it('configured-only has the same absent reason as existing empty options', () => {
    const empty = fixture();
    empty.center.activateScope(empty.scope, {});
    const configured = fixture();
    configured.center.activateScope(configured.scope, { entry: 'configured' });
    expect(configured.moves).toEqual(empty.moves);
    expect(configured.moves).toEqual([{ name: 'inside', options: {} }]);
  });
  it('only literal manual suppresses entry at the untyped runtime boundary', () => {
    const f = fixture();
    f.center.activateScope(f.scope, {
      entry: 'unknown',
      reason: 'keyboard',
    } as unknown as FocusScopeActivationOptions);
    expect(f.moves).toEqual([{ name: 'inside', options: { reason: 'keyboard' } }]);
  });
  it('suppresses only automatic entry, retaining gating, explicit inside focus and restoration', () => {
    const f = fixture();
    expect(f.center.activateScope(f.scope, { entry: 'manual', reason: 'keyboard' })).toBe(true);
    expect(f.active()).toBe(true);
    expect(f.moves).toEqual([]);
    f.center.requestFocus(f.outside, { reason: 'programmatic' });
    expect(f.moves).toEqual([]);
    expect(f.warnings).toHaveLength(1);
    f.center.requestFocus(f.inside, { reason: 'keyboard', preventScroll: true });
    expect(f.moves).toEqual([
      { name: 'inside', options: { reason: 'keyboard', preventScroll: true } },
    ]);
    f.center.deactivateScope(f.scope, { reason: 'keyboard' });
    expect(f.active()).toBe(false);
    expect(f.moves.at(-1)).toEqual({ name: 'outside', options: { reason: 'keyboard' } });
  });
  it('does not persist manual suppression into the next configured activation', () => {
    const f = fixture();
    f.center.activateScope(f.scope, { entry: 'manual' });
    expect(f.moves).toEqual([]);
    f.center.deactivateScope(f.scope);
    f.moves.length = 0;
    f.center.activateScope(f.scope, { entry: 'configured', reason: 'pointer' });
    expect(f.moves).toEqual([{ name: 'inside', options: { reason: 'pointer' } }]);
    expect(f.scope.getScopeConfig().entry).toBe('first');
  });
  it('configured never forces auto-entry over persistent manual configuration', () => {
    const f = fixture('manual');
    f.center.activateScope(f.scope, { entry: 'configured' });
    expect(f.active()).toBe(true);
    expect(f.moves).toEqual([]);
  });
  it('does not forward entry to a pending target or invent an entry for an empty container', () => {
    const f = fixture();
    f.inside.getRootTarget = () => null;
    const requests: Array<FocusRequestOptions | undefined> = [];
    f.inside.requestFocus = (options) => {
      requests.push(options);
      return 'pending';
    };
    expect(
      f.center.activateScope(f.scope, {
        entry: 'configured',
        reason: 'keyboard',
        preventScroll: true,
      })
    ).toBe(true);
    expect(requests).toEqual([{ reason: 'keyboard', preventScroll: true }]);
    const empty = fixture('first', false);
    const config = empty.scope.getScopeConfig();
    empty.scope.getScopeConfig = () => ({ ...config, emptyPolicy: 'container' });
    expect(
      empty.center.activateScope(empty.scope, { entry: 'configured', reason: 'keyboard' })
    ).toBe(true);
    expect(empty.active()).toBe(true);
    expect(empty.moves).toEqual([]);
  });
  it('manual retains an empty active boundary but default keeps existing empty failure', () => {
    const manual = fixture('first', false);
    expect(manual.center.activateScope(manual.scope, { entry: 'manual' })).toBe(true);
    expect(manual.active()).toBe(true);
    expect(manual.moves).toEqual([]);
    const configured = fixture('first', false);
    expect(configured.center.activateScope(configured.scope)).toBe(false);
    expect(configured.active()).toBe(false);
    expect(configured.moves).toEqual([]);
  });
});
