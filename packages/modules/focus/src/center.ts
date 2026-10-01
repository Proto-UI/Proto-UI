import type {
  FocusRequestOptions,
  FocusRovingKey,
  FocusableConfig,
  FocusRovingConfig,
  FocusFacts,
  FocusScopeConfig,
  FocusRovingEntryRequestOptions,
} from '@proto.ui/core';
import type { FocusInstanceToken, FocusOrderTargets, FocusParentGetter } from './caps';

export type FocusRequestBehavior = Readonly<{
  bypassGate?: boolean;
  syncFacts?: boolean;
}>;

export type FocusRequestOutcome = 'applied' | 'pending' | 'rejected';

export type FocusCenterEntry = {
  instance: FocusInstanceToken;
  getParent: FocusParentGetter;
  isFocusable(): boolean;
  isScopeProvider(): boolean;
  isRovingProvider(): boolean;
  getFocusableConfig(): FocusableConfig;
  getScopeConfig(): FocusScopeConfig;
  getRovingConfig(): FocusRovingConfig;
  getFacts(): FocusFacts;
  getRootTarget(): HTMLElement | null;
  /** The host's order for a navigation this entry owns, if the host has one. */
  orderTargets?: FocusOrderTargets;
  requestFocus(options?: FocusRequestOptions, behavior?: FocusRequestBehavior): FocusRequestOutcome;
  hasPendingFocus(): boolean;
  clearFocus(reason: unknown): void;
  setScopeActive(active: boolean): void;
  pushWarning(message: string): void;
};

type ActiveScopeRecord = {
  scope: FocusInstanceToken;
  previous: FocusInstanceToken | null;
};

export class FocusCenter {
  private readonly entries = new Map<FocusInstanceToken, FocusCenterEntry>();
  private readonly activeScopes: ActiveScopeRecord[] = [];
  private readonly lastFocusedByScope = new Map<FocusInstanceToken, FocusInstanceToken>();
  private currentFocused: FocusInstanceToken | null = null;
  private readonly pendingRovingEntries = new Map<
    FocusInstanceToken,
    {
      op: 'first' | 'last' | 'selected';
      options?: FocusRovingEntryRequestOptions;
      attempted?: FocusInstanceToken;
    }
  >();

  upsert(entry: FocusCenterEntry): void {
    this.entries.set(entry.instance, entry);
    this.fulfillPendingRovingEntries(entry.instance);
  }

  remove(instance: FocusInstanceToken): void {
    this.entries.delete(instance);
    this.pendingRovingEntries.delete(instance);
    if (this.currentFocused === instance) this.currentFocused = null;
    this.lastFocusedByScope.delete(instance);
    for (const [scope, focused] of this.lastFocusedByScope) {
      if (focused === instance) this.lastFocusedByScope.delete(scope);
    }
    for (let i = this.activeScopes.length - 1; i >= 0; i--) {
      if (this.activeScopes[i]?.scope === instance || this.activeScopes[i]?.previous === instance) {
        this.activeScopes.splice(i, 1);
      }
    }
  }

  detach(instance: FocusInstanceToken): void {
    this.entries.delete(instance);
    if (this.currentFocused === instance) this.currentFocused = null;
    for (const [scope, focused] of this.lastFocusedByScope) {
      if (focused === instance) this.lastFocusedByScope.delete(scope);
    }
    // A retained logical owner may already hold an active scope or deferred
    // roving-entry intent for its next view epoch. Those semantic records are
    // intentionally preserved until reattachment or terminal remove().
  }

  private resolveKeyedRovingProvider(
    instance: FocusInstanceToken,
    groupKey: FocusRovingKey,
    getParent: FocusParentGetter
  ): FocusInstanceToken | null {
    let cur: FocusInstanceToken | null = instance;
    while (cur) {
      const entry = this.entries.get(cur);
      if (entry?.getRovingConfig().key === groupKey) {
        return cur;
      }
      cur = getParent(cur);
    }
    return null;
  }

  private resolveNearestRovingProvider(
    instance: FocusInstanceToken,
    getParent: FocusParentGetter
  ): FocusInstanceToken | null {
    let cur = getParent(instance);
    while (cur) {
      const entry = this.entries.get(cur);
      if (entry?.isRovingProvider()) return cur;
      cur = getParent(cur);
    }
    return null;
  }

  /**
   * Puts one navigation's members, given in registration order, in the host
   * order of the entry that owns the navigation.
   *
   * The host orders the whole set or none of it. Without an order capability,
   * with a member that has no target yet, or with an answer that is not an
   * order of exactly these targets, the navigation keeps registration order
   * throughout: host answers and registration order are never mixed pair by
   * pair.
   */
  private orderEntries(owner: FocusCenterEntry, entries: FocusCenterEntry[]): FocusCenterEntry[] {
    if (entries.length < 2 || !owner.orderTargets) return entries;
    const targets: object[] = [];
    for (const entry of entries) {
      const target = entry.getRootTarget();
      if (!target) return entries;
      if (!targets.includes(target)) targets.push(target);
    }
    const ordered = owner.orderTargets(targets);
    if (!ordered || !isOrderOf(ordered, targets)) return entries;
    const rank = new Map(ordered.map((target, index) => [target, index]));
    // A stable sort keeps members that share a target in registration order.
    return [...entries].sort(
      (a, b) => rank.get(a.getRootTarget()!)! - rank.get(b.getRootTarget()!)!
    );
  }

  private isDescendantOf(entry: FocusCenterEntry, ancestor: FocusCenterEntry): boolean {
    if (entry.instance === ancestor.instance) return true;
    let cur = entry.getParent(entry.instance);
    while (cur) {
      if (cur === ancestor.instance) return true;
      cur = entry.getParent(cur);
    }
    return false;
  }

  private getTopActiveScope(): FocusCenterEntry | null {
    for (let i = this.activeScopes.length - 1; i >= 0; i--) {
      const entry = this.entries.get(this.activeScopes[i]!.scope);
      if (entry?.isScopeProvider()) return entry;
      if (this.pendingRovingEntries.has(this.activeScopes[i]!.scope)) return null;
      this.activeScopes.splice(i, 1);
    }
    return null;
  }

  private getFocusedEntry(): FocusCenterEntry | null {
    if (this.currentFocused) {
      const entry = this.entries.get(this.currentFocused);
      if (entry?.getFacts().focused) return entry;
      this.currentFocused = null;
    }
    return Array.from(this.entries.values()).find((entry) => entry.getFacts().focused) ?? null;
  }

  private clearOtherFocusedEntries(next: FocusCenterEntry, reason: unknown): void {
    for (const entry of this.entries.values()) {
      if (entry.instance === next.instance) continue;
      if (!entry.isFocusable()) continue;
      const facts = entry.getFacts();
      if (!facts.focused && !facts.focusVisible && !facts.active && !entry.hasPendingFocus()) {
        continue;
      }
      entry.clearFocus(reason);
    }
  }

  private getScopeMembers(scope: FocusCenterEntry): FocusCenterEntry[] {
    if (!scope.isScopeProvider()) return [];
    const members = Array.from(this.entries.values()).filter((entry) => {
      if (!entry.isFocusable()) return false;
      if (entry.instance === scope.instance) return false;
      const focusable = entry.getFocusableConfig();
      if (focusable.disabled) return false;
      return this.isDescendantOf(entry, scope);
    });
    return this.dedupeSharedHostTargets(this.orderEntries(scope, members));
  }

  private dedupeSharedHostTargets(entries: FocusCenterEntry[]): FocusCenterEntry[] {
    const deduped: FocusCenterEntry[] = [];
    for (const entry of entries) {
      const target = entry.getRootTarget();
      const existingIndex = target
        ? deduped.findIndex((candidate) => candidate.getRootTarget() === target)
        : -1;
      if (existingIndex < 0) {
        deduped.push(entry);
        continue;
      }

      const existing = deduped[existingIndex]!;
      if (this.isDescendantOf(entry, existing)) {
        deduped[existingIndex] = entry;
      }
    }
    return deduped;
  }

  private requestFocusAllowed(entry: FocusCenterEntry): boolean {
    const scope = this.getTopActiveScope();
    if (!scope) return true;
    return this.isDescendantOf(entry, scope);
  }

  private requestFocusOutcome(
    entry: FocusCenterEntry,
    options?: FocusRequestOptions,
    behavior?: FocusRequestBehavior
  ): FocusRequestOutcome {
    // A pre-projection request cannot be gated reliably yet: the logical parent
    // may be established by the same adapter commit that supplies the target.
    // Retain it on the entry and re-run the normal gate when that commit lands.
    if (!entry.getRootTarget()) {
      return entry.requestFocus(options, behavior);
    }
    if (!behavior?.bypassGate && !this.requestFocusAllowed(entry)) {
      const scope = this.getTopActiveScope();
      entry.pushWarning(
        `[Focus] requestFocus ignored: active scope ${String(
          scope?.getScopeConfig().key?.meta?.debugLabel ?? scope?.instance ?? 'unknown'
        )} does not contain the requesting focus target.`
      );
      return 'rejected';
    }
    const outcome = entry.requestFocus(options, behavior);
    if (outcome === 'rejected') return 'rejected';
    if (outcome === 'pending') return 'pending';
    this.clearOtherFocusedEntries(entry, options?.reason ?? 'focus.request');
    if (behavior?.syncFacts !== false) {
      this.currentFocused = entry.instance;
    }
    this.noteFocused(entry);
    return 'applied';
  }

  requestFocus(
    entry: FocusCenterEntry,
    options?: FocusRequestOptions,
    behavior?: FocusRequestBehavior
  ): boolean {
    return this.requestFocusOutcome(entry, options, behavior) !== 'rejected';
  }

  noteFocused(entry: FocusCenterEntry): void {
    this.clearOtherFocusedEntries(entry, 'focus.host:focus');
    this.currentFocused = entry.instance;
    for (const record of this.activeScopes) {
      const scope = this.entries.get(record.scope);
      if (!scope?.isScopeProvider()) continue;
      if (this.isDescendantOf(entry, scope)) {
        this.lastFocusedByScope.set(scope.instance, entry.instance);
      }
    }
  }

  activateScope(scope: FocusCenterEntry, options?: FocusRequestOptions): boolean {
    if (!scope.isScopeProvider()) return false;

    // A retained logical owner may request activation before its next host view
    // epoch has materialized. Re-register that semantic owner immediately so
    // child view epochs cannot observe and discard an ownerless pending request.
    this.entries.set(scope.instance, scope);

    const existingIndex = this.activeScopes.findIndex((record) => record.scope === scope.instance);
    if (existingIndex >= 0) {
      this.activeScopes.splice(existingIndex, 1);
    }

    const focused = this.getFocusedEntry();
    const previous = focused && !this.isDescendantOf(focused, scope) ? focused.instance : null;
    this.activeScopes.push({ scope: scope.instance, previous });
    scope.setScopeActive(true);

    if (scope.getScopeConfig().entry === 'manual') return true;

    const target = scope.isRovingProvider()
      ? (this.getRovingMembers(scope)[0] ?? null)
      : (this.getScopeMembers(scope)[0] ?? null);
    if (target) {
      this.requestFocus(target, options ?? { reason: 'programmatic' }, { syncFacts: true });
      return true;
    }

    if (scope.getScopeConfig().emptyPolicy === 'container') return true;
    this.activeScopes.pop();
    scope.setScopeActive(false);
    return false;
  }

  deactivateScope(scope: FocusCenterEntry, options?: FocusRequestOptions): boolean {
    let index = -1;
    for (let i = this.activeScopes.length - 1; i >= 0; i--) {
      if (this.activeScopes[i]?.scope === scope.instance) {
        index = i;
        break;
      }
    }
    if (index < 0) {
      scope.setScopeActive(false);
      return false;
    }

    const [{ previous }] = this.activeScopes.splice(index, 1);
    scope.setScopeActive(false);

    for (const entry of this.entries.values()) {
      if (entry.instance === scope.instance || !entry.isFocusable()) continue;
      if (!this.isDescendantOf(entry, scope)) continue;
      const facts = entry.getFacts();
      if (!facts.focused && !facts.focusVisible && !facts.active && !entry.hasPendingFocus()) {
        continue;
      }
      entry.clearFocus(options?.reason ?? 'focus.scope.deactivate');
      if (this.currentFocused === entry.instance) this.currentFocused = null;
    }

    const previousEntry = previous ? (this.entries.get(previous) ?? null) : null;
    if (previousEntry) {
      this.requestFocus(previousEntry, options ?? { reason: 'programmatic' }, {
        bypassGate: true,
        syncFacts: true,
      });
    }
    return true;
  }

  isScopeActive(scope: FocusCenterEntry): boolean {
    return this.activeScopes.some((record) => record.scope === scope.instance);
  }

  isTopActiveScope(scope: FocusCenterEntry): boolean {
    return this.getTopActiveScope()?.instance === scope.instance;
  }

  focusInScope(scope: FocusCenterEntry, op: 'next' | 'prev'): boolean {
    if (!scope.isScopeProvider() || !this.isTopActiveScope(scope)) return false;

    const members = this.getScopeMembers(scope);
    if (members.length === 0) return false;

    const focused = this.getFocusedEntry();
    const remembered = this.lastFocusedByScope.get(scope.instance) ?? null;
    const currentIndex = focused
      ? members.findIndex((entry) => entry.instance === focused.instance)
      : remembered
        ? members.findIndex((entry) => entry.instance === remembered)
        : -1;
    const delta = op === 'next' ? 1 : -1;
    let nextIndex =
      currentIndex >= 0 ? currentIndex + delta : op === 'next' ? 0 : members.length - 1;

    if (scope.getScopeConfig().loop) {
      nextIndex = (nextIndex + members.length) % members.length;
    } else {
      nextIndex = Math.max(0, Math.min(members.length - 1, nextIndex));
    }

    const target = members[nextIndex] ?? null;
    if (!target) return false;
    this.requestFocus(target, { reason: 'keyboard' }, { syncFacts: false });
    return true;
  }

  getRovingMembers(provider: FocusCenterEntry): FocusCenterEntry[] {
    const groupKey = provider.getRovingConfig().key;
    if (!provider.isRovingProvider()) return [];

    const members = Array.from(this.entries.values()).filter((entry) => {
      if (!entry.isFocusable()) return false;
      if (entry.instance === provider.instance) return false;

      const focusable = entry.getFocusableConfig();
      if (focusable.disabled) return false;

      if (focusable.groupKey) {
        if (!groupKey || focusable.groupKey !== groupKey) return false;
        const resolved = this.resolveKeyedRovingProvider(
          entry.instance,
          focusable.groupKey,
          entry.getParent
        );
        if (resolved === provider.instance) return true;

        // Compatibility fallback for hosts/tests that cannot provide a logical parent chain yet.
        return resolved === null && entry.getParent(entry.instance) === null;
      }

      const resolved = this.resolveNearestRovingProvider(entry.instance, entry.getParent);
      return resolved === provider.instance;
    });

    return this.dedupeSharedHostTargets(this.orderEntries(provider, members));
  }

  focusInRoving(
    provider: FocusCenterEntry,
    op: 'first' | 'last' | 'next' | 'prev' | 'selected',
    options?: {
      requireFocusedMember?: boolean;
      entryRequest?: FocusRovingEntryRequestOptions;
    }
  ): boolean {
    // The provider handle survives view detachment. A deferred entry request is
    // therefore also a semantic re-registration point for the provider; Items
    // may attach before the provider's own host view callback in React/Vue.
    this.entries.set(provider.instance, provider);
    const members = this.getRovingMembers(provider);
    if (members.length === 0) {
      if (options?.entryRequest?.defer && (op === 'first' || op === 'last' || op === 'selected')) {
        this.pendingRovingEntries.set(provider.instance, {
          op,
          options: options.entryRequest,
        });
        return true;
      }
      return false;
    }

    const focusedIndex = members.findIndex((entry) => entry.getFacts().focused);
    const activeIndex = members.findIndex((entry) => entry.getFacts().rovingActive);
    if (options?.requireFocusedMember && focusedIndex < 0) return false;
    const currentIndex = focusedIndex >= 0 ? focusedIndex : activeIndex;

    const loop = provider.getRovingConfig().loop;

    let target: FocusCenterEntry | null = null;
    if (op === 'first') {
      target = members[0] ?? null;
    } else if (op === 'selected') {
      const selected = members.filter((entry) => entry.getFacts().rovingSelected);
      if (selected.length > 1) {
        provider.pushWarning(
          `[Focus] roving set has multiple selected members; focusSelected uses the first member in host order.`
        );
      }
      target = selected[0] ?? members[0] ?? null;
    } else if (op === 'last') {
      target = members[members.length - 1] ?? null;
    } else if (currentIndex >= 0) {
      const delta = op === 'next' ? 1 : -1;
      let nextIndex = currentIndex + delta;
      if (loop) {
        nextIndex = (nextIndex + members.length) % members.length;
      }
      target = members[nextIndex] ?? null;
    } else {
      target = op === 'prev' ? (members[members.length - 1] ?? null) : (members[0] ?? null);
    }

    if (!target) return false;
    // Prevent focus-fact state updates from re-entering this same provider
    // intent while the host request is still on the stack. A pending outcome
    // is restored below with the member that was actually attempted.
    this.pendingRovingEntries.delete(provider.instance);
    const outcome = this.requestFocusOutcome(
      target,
      {
        reason: options?.entryRequest?.reason ?? 'keyboard',
        preventScroll: options?.entryRequest?.preventScroll,
      },
      { syncFacts: true }
    );
    if (outcome === 'pending' && options?.entryRequest?.defer) {
      this.pendingRovingEntries.set(provider.instance, {
        op: op as 'first' | 'last' | 'selected',
        options: options.entryRequest,
        attempted: target.instance,
      });
    } else {
      this.pendingRovingEntries.delete(provider.instance);
    }
    return outcome !== 'rejected';
  }

  private fulfillPendingRovingEntries(changedInstance: FocusInstanceToken): void {
    for (const [instance, pending] of [...this.pendingRovingEntries]) {
      const provider = this.entries.get(instance);
      if (!provider) continue;
      if (!provider.isRovingProvider()) {
        this.pendingRovingEntries.delete(instance);
        continue;
      }
      if (
        pending.attempted &&
        this.entries.has(pending.attempted) &&
        changedInstance !== pending.attempted &&
        changedInstance !== provider.instance
      ) {
        continue;
      }
      if (this.getRovingMembers(provider).length === 0) continue;
      this.focusInRoving(provider, pending.op, { entryRequest: pending.options });
    }
  }
}

/**
 * Whether a host's answer is an array holding each of `targets` exactly once,
 * and nothing else. The answer comes from outside the Module, so anything else
 * it could be, such as an array-like object, fails here rather than throwing.
 */
function isOrderOf(ordered: unknown, targets: readonly object[]): ordered is readonly object[] {
  if (!Array.isArray(ordered) || ordered.length !== targets.length) return false;
  const seen = new Set<unknown>();
  for (let index = 0; index < ordered.length; index++) seen.add(ordered[index]);
  return seen.size === targets.length && targets.every((target) => seen.has(target));
}

export const FOCUS_CENTER = new FocusCenter();
