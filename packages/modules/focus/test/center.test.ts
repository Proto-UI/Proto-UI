import { describe, expect, it } from 'vitest';
import { FocusCenter, type FocusCenterEntry, type FocusRequestOutcome } from '../src/center';

function createEntry(options: {
  instance: object;
  parent?: object | null;
  scope?: boolean;
  roving?: boolean;
  focused?: string[];
  outcomes?: FocusRequestOutcome[];
  requests?: Array<{ reason?: string; preventScroll?: boolean }>;
}): FocusCenterEntry {
  return {
    instance: options.instance,
    getParent: () => options.parent ?? null,
    isFocusable: () => !options.scope && !options.roving,
    isScopeProvider: () => !!options.scope,
    isRovingProvider: () => !!options.roving,
    getFocusableConfig: () =>
      ({ disabled: false, navParticipation: 'auto' }) as ReturnType<
        FocusCenterEntry['getFocusableConfig']
      >,
    getScopeConfig: () =>
      ({ entry: 'manual', emptyPolicy: 'none' }) as ReturnType<FocusCenterEntry['getScopeConfig']>,
    getRovingConfig: () => ({ loop: false }) as ReturnType<FocusCenterEntry['getRovingConfig']>,
    getFacts: () => ({ focused: false }) as ReturnType<FocusCenterEntry['getFacts']>,
    getRootTarget: () => null,
    requestFocus: (request) => {
      options.requests?.push(request ?? {});
      const outcome = options.outcomes?.shift() ?? 'applied';
      if (outcome === 'applied') {
        options.focused?.push(String((options.instance as { id?: string }).id ?? 'item'));
      }
      return outcome;
    },
    hasPendingFocus: () => false,
    clearFocus: () => undefined,
    setScopeActive: () => undefined,
    pushWarning: () => undefined,
  };
}

describe('FocusCenter retained owner entry', () => {
  it('skips programmatic-only members for scope traversal without removing roving access', () => {
    const center = new FocusCenter(),
      token = { id: 'scope' },
      focused: string[] = [];
    const scope = createEntry({ instance: token, scope: true, roving: true });
    const inactive = createEntry({ instance: { id: 'inactive' }, parent: token, focused });
    inactive.getFocusableConfig = () => ({
      autoFocus: false,
      disabled: false,
      navParticipation: 'none',
    });
    const current = createEntry({ instance: { id: 'current' }, parent: token, focused });
    center.upsert(scope);
    center.upsert(inactive);
    center.upsert(current);
    center.activateScope(scope);
    center.focusInScope(scope, 'next');
    expect(focused).toEqual(['current']);
    center.focusInRoving(scope, 'first');
    expect(focused).toEqual(['current', 'inactive']);
  });
  it('keeps a deferred roving request when a child view attaches before its provider view', () => {
    // T-FOCUS-ROVING-0001-CASE-DEFERRED-ENTRY
    const center = new FocusCenter();
    const providerToken = { id: 'provider' };
    const focused: string[] = [];
    const provider = createEntry({
      instance: providerToken,
      scope: true,
      roving: true,
    });

    center.remove(providerToken);
    center.activateScope(provider, { reason: 'keyboard' });
    expect(
      center.focusInRoving(provider, 'first', {
        entryRequest: { defer: true, reason: 'keyboard' },
      })
    ).toBe(true);

    center.detach(providerToken);

    center.upsert(
      createEntry({
        instance: { id: 'late-item' },
        parent: providerToken,
        focused,
      })
    );

    expect(focused).toEqual([]);
    center.upsert(provider);

    expect(focused).toEqual(['late-item']);
  });

  it('keeps deferred roving intent until a member focus request is applied', () => {
    // T-FOCUS-ROVING-0001-CASE-DEFERRED-ENTRY
    const center = new FocusCenter();
    const providerToken = { id: 'provider' };
    const firstItemToken = { id: 'first-item' };
    const focused: string[] = [];
    const provider = createEntry({
      instance: providerToken,
      scope: true,
      roving: true,
    });

    center.upsert(provider);
    center.upsert(
      createEntry({
        instance: firstItemToken,
        parent: providerToken,
        focused,
        outcomes: ['pending'],
      })
    );

    expect(
      center.focusInRoving(provider, 'first', {
        entryRequest: { defer: true, reason: 'keyboard' },
      })
    ).toBe(true);
    expect(focused).toEqual([]);

    center.remove(firstItemToken);
    center.upsert(
      createEntry({
        instance: { id: 'replacement-item' },
        parent: providerToken,
        focused,
      })
    );

    expect(focused).toEqual(['replacement-item']);
  });

  it('forwards target focus policies while consuming roving-only entry options', () => {
    const center = new FocusCenter();
    const providerToken = { id: 'provider' };
    const requests: Array<{ reason?: string; preventScroll?: boolean }> = [];
    const provider = createEntry({
      instance: providerToken,
      scope: true,
      roving: true,
    });

    center.upsert(provider);
    center.upsert(
      createEntry({
        instance: { id: 'item' },
        parent: providerToken,
        requests,
      })
    );
    center.focusInRoving(provider, 'first', {
      entryRequest: { defer: true, reason: 'pointer', preventScroll: true },
    });

    expect(requests).toEqual([{ reason: 'pointer', preventScroll: true }]);
  });
});
