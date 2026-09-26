import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FocusOrderTargets } from '../src/caps';
import { FocusCenter, type FocusCenterEntry } from '../src/center';

type Member = { id: string; target: object | null };

/**
 * Entries for one navigation owner and its members. Targets are plain objects,
 * as a non-DOM host's are; focus facts follow the requests the center makes.
 */
function navigation(options: {
  kind: 'roving' | 'scope';
  members: Member[];
  orderTargets?: FocusOrderTargets;
}) {
  const ownerToken = { id: 'owner' };
  const focused = new Set<object>();
  const requested: string[] = [];
  const owner: FocusCenterEntry = {
    instance: ownerToken,
    getParent: () => null,
    isFocusable: () => false,
    isScopeProvider: () => options.kind === 'scope',
    isRovingProvider: () => options.kind === 'roving',
    getFocusableConfig: () =>
      ({ disabled: false, navParticipation: 'auto' }) as ReturnType<
        FocusCenterEntry['getFocusableConfig']
      >,
    getScopeConfig: () => ({
      trap: false,
      loop: false,
      navigation: 'tab',
      orientation: 'vertical',
      entry: 'first',
      restore: 'none',
      emptyPolicy: 'none',
    }),
    getRovingConfig: () => ({
      loop: false,
      navigation: 'none',
      orientation: 'vertical',
      entry: 'first',
      selectOnFocus: false,
    }),
    getFacts: () => ({ focused: false }) as ReturnType<FocusCenterEntry['getFacts']>,
    getRootTarget: () => null,
    orderTargets: options.orderTargets,
    requestFocus: () => 'applied',
    hasPendingFocus: () => false,
    clearFocus: () => undefined,
    setScopeActive: () => undefined,
    pushWarning: () => undefined,
  };
  const entries = options.members.map((member): FocusCenterEntry => {
    const token = { id: member.id };
    return {
      instance: token,
      getParent: (instance) => (instance === token ? ownerToken : null),
      isFocusable: () => true,
      isScopeProvider: () => false,
      isRovingProvider: () => false,
      getFocusableConfig: () =>
        ({ disabled: false, navParticipation: 'auto' }) as ReturnType<
          FocusCenterEntry['getFocusableConfig']
        >,
      getScopeConfig: () => ({}) as ReturnType<FocusCenterEntry['getScopeConfig']>,
      getRovingConfig: () => ({}) as ReturnType<FocusCenterEntry['getRovingConfig']>,
      getFacts: () => ({ focused: focused.has(token) }) as ReturnType<FocusCenterEntry['getFacts']>,
      // The center only compares targets by identity.
      getRootTarget: () => member.target as HTMLElement | null,
      requestFocus: () => {
        requested.push(member.id);
        focused.add(token);
        return 'applied';
      },
      hasPendingFocus: () => false,
      clearFocus: () => {
        focused.delete(token);
      },
      setScopeActive: () => undefined,
      pushWarning: () => undefined,
    };
  });
  const center = new FocusCenter();
  // Registration order is the members' order.
  center.upsert(owner);
  for (const entry of entries) center.upsert(entry);
  return { center, owner, requested };
}

const targets = { a: { ref: 'a' }, b: { ref: 'b' }, c: { ref: 'c' } };
const members: Member[] = [
  { id: 'a', target: targets.a },
  { id: 'b', target: targets.b },
  { id: 'c', target: targets.c },
];

/** A host whose order is c, a, b: not the registration order a, b, c. */
const hostOrder: FocusOrderTargets = (given) =>
  [targets.c, targets.a, targets.b].filter((target) => given.includes(target));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FocusCenter host order', () => {
  it('moves through roving members in host order, not registration order', () => {
    // T-FOCUS-ORDER-0001-CASE-HOST-ORDER
    const { center, owner, requested } = navigation({
      kind: 'roving',
      members,
      orderTargets: hostOrder,
    });
    center.focusInRoving(owner, 'first');
    center.focusInRoving(owner, 'next');
    center.focusInRoving(owner, 'next');
    center.focusInRoving(owner, 'prev');
    center.focusInRoving(owner, 'last');
    expect(requested).toEqual(['c', 'a', 'b', 'a', 'b']);
  });

  it('enters and moves through a scope in the scope owner host order', () => {
    // T-FOCUS-ORDER-0001-CASE-HOST-ORDER
    const { center, owner, requested } = navigation({
      kind: 'scope',
      members,
      orderTargets: hostOrder,
    });
    center.activateScope(owner, { reason: 'keyboard' });
    center.focusInScope(owner, 'next');
    center.focusInScope(owner, 'next');
    expect(requested).toEqual(['c', 'a', 'b']);
  });

  it('needs no DOM API to order non-DOM targets', () => {
    // T-FOCUS-ORDER-0001-CASE-HOST-ORDER: a peer realm has no Node global.
    vi.stubGlobal('Node', undefined);
    const { center, owner, requested } = navigation({
      kind: 'roving',
      members,
      orderTargets: hostOrder,
    });
    expect(() => center.focusInRoving(owner, 'first')).not.toThrow();
    expect(requested).toEqual(['c']);
  });

  it.each([
    ['no order capability', undefined],
    ['a host that cannot order the set', () => null],
    ['an answer that leaves a target out', () => [targets.c, targets.a]],
    ['an answer that repeats a target', () => [targets.c, targets.c, targets.a]],
    ['an answer with a target not asked about', () => [targets.c, targets.a, { ref: 'x' }]],
    ['an array-like answer of the right length', () => ({ length: 3 }) as unknown as object[]],
  ] as Array<[string, FocusOrderTargets | undefined]>)(
    'keeps registration order for the whole navigation with %s',
    (_, orderTargets) => {
      // T-FOCUS-ORDER-0001-CASE-REGISTRATION-FALLBACK
      const { center, owner, requested } = navigation({ kind: 'roving', members, orderTargets });
      center.focusInRoving(owner, 'first');
      center.focusInRoving(owner, 'next');
      center.focusInRoving(owner, 'last');
      expect(requested).toEqual(['a', 'b', 'c']);
    }
  );

  it('keeps registration order, without asking the host, while a member has no target', () => {
    // T-FOCUS-ORDER-0001-CASE-REGISTRATION-FALLBACK
    const orderTargets = vi.fn(hostOrder);
    const { center, owner, requested } = navigation({
      kind: 'roving',
      members: [members[0]!, { id: 'b', target: null }, members[2]!],
      orderTargets,
    });
    center.focusInRoving(owner, 'first');
    center.focusInRoving(owner, 'last');
    expect(requested).toEqual(['a', 'c']);
    expect(orderTargets).not.toHaveBeenCalled();
  });
});
