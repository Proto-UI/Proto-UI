// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import type { FocusRequestOptions, FocusRovingConfig, FocusScopeConfig } from '@proto.ui/core';
import { FocusCenter, type FocusCenterEntry } from '../src/center';

// Real DOM focus effects, with explicit host-fact reports into the real Center.
// This is Module policy evidence, not browser input or Adapter certification.
type FixtureEntry = FocusCenterEntry & {
  name: string;
  element: HTMLButtonElement;
  onActive?: (active: boolean) => void;
  reportFocused(): void;
  setPending(pending: boolean): void;
};

function fixture(restore: FocusScopeConfig['restore'] = 'previous') {
  const center = new FocusCenter();
  const parents = new Map<unknown, unknown | null>();
  const entries: FixtureEntry[] = [];
  const requests: Array<{ name: string; options: FocusRequestOptions | undefined }> = [];
  const cleared: string[] = [];
  const warnings: string[] = [];
  const scopeConfig: FocusScopeConfig = {
    trap: false,
    loop: false,
    navigation: 'tab',
    orientation: 'vertical',
    entry: 'first',
    restore,
    entryFallback: 'none',
    emptyPolicy: 'none',
  };
  const rovingConfig: FocusRovingConfig = {
    loop: false,
    navigation: 'none',
    orientation: 'vertical',
    entry: 'first',
    selectOnFocus: false,
  };

  function entry(name: string, parent: unknown | null, config?: FocusScopeConfig): FixtureEntry {
    const element = document.createElement('button');
    element.textContent = name;
    document.body.append(element);
    const instance = {};
    parents.set(instance, parent);
    let focused = false;
    let pending = false;
    const value: FixtureEntry = {
      name,
      element,
      instance,
      getParent: (token) => parents.get(token) ?? null,
      isFocusable: () => !config,
      isScopeProvider: () => !!config,
      isRovingProvider: () => false,
      getFocusableConfig: () => ({ autoFocus: false, disabled: false, navParticipation: 'auto' }),
      getScopeConfig: () => config ?? scopeConfig,
      getRovingConfig: () => rovingConfig,
      getFacts: () => ({
        focused,
        focusVisible: focused,
        focusable: !config,
        active: focused,
        hasFocused: false,
        rovingSelected: false,
        rovingActive: false,
      }),
      getRootTarget: () => element,
      requestFocus: (options) => {
        requests.push({ name, options });
        focused = true;
        pending = false;
        element.focus();
        return 'applied';
      },
      hasPendingFocus: () => pending,
      cancelPendingFocus: () => {
        cleared.push(name);
        pending = false;
      },
      clearFocus: () => {
        cleared.push(name);
        focused = pending = false;
      },
      setScopeActive: (next) => value.onActive?.(next),
      pushWarning: (message) => warnings.push(message),
      reportFocused: () => {
        focused = true;
      },
      setPending: (next) => {
        pending = next;
      },
    };
    entries.push(value);
    center.upsert(value);
    return value;
  }

  const trigger = entry('trigger', null);
  const scope = entry('scope', null, scopeConfig);
  const inside = entry('inside', scope.instance);
  const destination = entry('destination', null);
  function userFocus(target: FixtureEntry) {
    target.element.focus();
    target.reportFocused();
    center.noteFocused(target);
  }
  return {
    center,
    entry,
    scopeConfig,
    scope,
    trigger,
    inside,
    destination,
    requests,
    cleared,
    warnings,
    userFocus,
    cleanup() {
      for (const value of entries) value.element.remove();
    },
  };
}

describe('FocusScope restore policy', () => {
  it('none preserves the outside destination and releases the ordinary request gate', () => {
    const f = fixture('none');
    try {
      f.userFocus(f.trigger);
      expect(f.center.activateScope(f.scope, { reason: 'pointer' })).toBe(true);
      expect(document.activeElement).toBe(f.inside.element);
      f.userFocus(f.destination);
      expect(f.center.deactivateScope(f.scope, { reason: 'pointer' })).toBe(true);
      expect(f.requests.map((request) => request.name)).toEqual(['inside']);
      expect(document.activeElement).toBe(f.destination.element);
      expect(f.destination.getFacts().focused).toBe(true);
      expect(f.center.isScopeActive(f.scope)).toBe(false);
      expect(f.center.requestFocus(f.destination)).toBe(true);
      expect(f.warnings).toEqual([]);
    } finally {
      f.cleanup();
    }
  });

  it('previous restores the captured owner and preserves close request options', () => {
    const f = fixture();
    try {
      f.userFocus(f.trigger);
      f.center.activateScope(f.scope, { reason: 'pointer' });
      f.userFocus(f.destination);
      f.center.deactivateScope(f.scope, { reason: 'keyboard', preventScroll: true });
      expect(f.requests.map((request) => request.name)).toEqual(['inside', 'trigger']);
      expect(f.requests.at(-1)?.options).toEqual({ reason: 'keyboard', preventScroll: true });
      expect(document.activeElement).toBe(f.trigger.element);
      f.userFocus(f.destination);
      expect(f.center.deactivateScope(f.scope)).toBe(false);
      expect(document.activeElement).toBe(f.destination.element);
    } finally {
      f.cleanup();
    }
  });

  it('none still clears scoped target facts and pending work without physically blurring', () => {
    const f = fixture('none');
    try {
      const pending = f.entry('pending', f.scope.instance);
      f.userFocus(f.trigger);
      f.center.activateScope(f.scope);
      pending.setPending(true);
      f.center.deactivateScope(f.scope);
      expect(f.requests.map((request) => request.name)).toEqual(['inside']);
      expect(f.inside.getFacts()).toMatchObject({
        focused: false,
        focusVisible: false,
        active: false,
      });
      expect(pending.hasPendingFocus()).toBe(false);
      expect(f.cleared).toContain('pending');
      expect(document.activeElement).toBe(f.inside.element);
      expect(f.center.isScopeActive(f.scope)).toBe(false);
    } finally {
      f.cleanup();
    }
  });

  it('a nested none scope preserves its destination while the parent still restores normally', () => {
    const f = fixture();
    try {
      const nested = f.entry('nested', f.scope.instance, { ...f.scopeConfig, restore: 'none' });
      const nestedChild = f.entry('nested-child', nested.instance);
      const sibling = f.entry('sibling', f.scope.instance);
      f.userFocus(f.trigger);
      f.center.activateScope(f.scope);
      f.center.activateScope(nested);
      expect(document.activeElement).toBe(nestedChild.element);
      f.userFocus(sibling);
      f.center.deactivateScope(nested);
      expect(document.activeElement).toBe(sibling.element);
      expect(f.center.isScopeActive(f.scope)).toBe(true);
      expect(f.center.requestFocus(f.destination)).toBe(false);
      f.center.deactivateScope(f.scope);
      expect(document.activeElement).toBe(f.trigger.element);
      expect(f.requests.map((request) => request.name)).toEqual([
        'inside',
        'nested-child',
        'trigger',
      ]);
    } finally {
      f.cleanup();
    }
  });

  it.each(['none', 'previous'] as const)(
    '%s keeps an active boundary after its previous owner is removed',
    (restore) => {
      const f = fixture(restore);
      try {
        f.userFocus(f.trigger);
        f.center.activateScope(f.scope);
        f.center.remove(f.trigger.instance);
        f.trigger.element.remove();
        expect(f.center.isScopeActive(f.scope)).toBe(true);
        expect(f.center.requestFocus(f.destination)).toBe(false);
        expect(f.center.deactivateScope(f.scope)).toBe(true);
        expect(f.requests.map((request) => request.name)).toEqual(['inside']);
        expect(f.inside.getFacts().focused).toBe(false);
      } finally {
        f.cleanup();
      }
    }
  );

  it('does not restore over an explicit focus transfer from an active-state notification', () => {
    const f = fixture();
    try {
      f.userFocus(f.trigger);
      f.center.activateScope(f.scope);
      f.scope.onActive = (active) => {
        if (!active) f.userFocus(f.destination);
      };
      f.center.deactivateScope(f.scope);
      expect(document.activeElement).toBe(f.destination.element);
      expect(f.destination.getFacts().focused).toBe(true);
      expect(f.requests.map((request) => request.name)).toEqual(['inside']);
    } finally {
      f.cleanup();
    }
  });

  it('does not clear a newer activation created by the old deactivation notification', () => {
    const f = fixture('none');
    try {
      f.userFocus(f.trigger);
      f.center.activateScope(f.scope);
      f.scope.onActive = (active) => {
        if (!active) f.center.activateScope(f.scope, { entry: 'manual' });
      };
      f.center.deactivateScope(f.scope);
      expect(f.center.isScopeActive(f.scope)).toBe(true);
      expect(f.inside.getFacts().focused).toBe(true);
      expect(f.center.requestFocus(f.destination)).toBe(false);
      expect(f.requests.map((request) => request.name)).toEqual(['inside']);
    } finally {
      f.cleanup();
    }
  });

  it('does not resume entry after the active notification closes the scope', () => {
    const f = fixture('none');
    try {
      f.userFocus(f.trigger);
      f.scope.onActive = (active) => {
        if (active) f.center.deactivateScope(f.scope);
      };
      expect(f.center.activateScope(f.scope)).toBe(false);
      expect(f.center.isScopeActive(f.scope)).toBe(false);
      expect(f.requests).toEqual([]);
      expect(document.activeElement).toBe(f.trigger.element);
    } finally {
      f.cleanup();
    }
  });

  it('does not restore after the closing scope is removed by its notification', () => {
    const f = fixture();
    try {
      f.userFocus(f.trigger);
      f.center.activateScope(f.scope);
      f.userFocus(f.destination);
      f.scope.onActive = (active) => {
        if (!active) f.center.remove(f.scope.instance);
      };
      f.center.deactivateScope(f.scope);
      expect(document.activeElement).toBe(f.destination.element);
      expect(f.requests.map((request) => request.name)).toEqual(['inside']);
    } finally {
      f.cleanup();
    }
  });

  it('keeps a different manual scope active when an empty activation retires itself', () => {
    const f = fixture();
    try {
      f.center.remove(f.inside.instance);
      f.inside.element.remove();
      const nextScope = f.entry('next-scope', null, { ...f.scopeConfig, restore: 'none' });
      const nextChild = f.entry('next-child', nextScope.instance);
      f.userFocus(f.trigger);
      f.scope.onActive = (active) => {
        if (active) f.center.activateScope(nextScope, { entry: 'manual' });
      };

      expect(f.center.activateScope(f.scope)).toBe(false);
      expect(f.center.isScopeActive(f.scope)).toBe(false);
      expect(f.center.isScopeActive(nextScope)).toBe(true);
      expect(f.center.isTopActiveScope(nextScope)).toBe(true);
      expect(document.activeElement).toBe(f.trigger.element);
      expect(f.requests).toEqual([]);
      expect(f.center.requestFocus(f.destination)).toBe(false);
      expect(f.center.requestFocus(nextChild, { reason: 'keyboard' })).toBe(true);
      expect(document.activeElement).toBe(nextChild.element);
      f.center.deactivateScope(nextScope);
      expect(f.center.requestFocus(f.destination)).toBe(true);
    } finally {
      f.cleanup();
    }
  });

  it('does not restore through a different manual scope activated by the close notification', () => {
    const f = fixture();
    try {
      const nextScope = f.entry('next-scope', null, { ...f.scopeConfig, restore: 'none' });
      const nextChild = f.entry('next-child', nextScope.instance);
      f.userFocus(f.trigger);
      f.center.activateScope(f.scope);
      expect(document.activeElement).toBe(f.inside.element);
      f.scope.onActive = (active) => {
        if (!active) f.center.activateScope(nextScope, { entry: 'manual' });
      };

      f.center.deactivateScope(f.scope, { reason: 'keyboard' });
      expect(document.activeElement).toBe(f.inside.element);
      expect(f.requests.map((request) => request.name)).toEqual(['inside']);
      expect(f.center.isScopeActive(f.scope)).toBe(false);
      expect(f.center.isScopeActive(nextScope)).toBe(true);
      expect(f.center.isTopActiveScope(nextScope)).toBe(true);
      expect(f.center.requestFocus(f.destination)).toBe(false);
      expect(f.center.requestFocus(nextChild, { reason: 'keyboard' })).toBe(true);
      expect(document.activeElement).toBe(nextChild.element);
      f.center.deactivateScope(nextScope);
      expect(f.center.requestFocus(f.destination)).toBe(true);
    } finally {
      f.cleanup();
    }
  });

  it("preserves a nested manual scope's newer pending request during the old close notification", () => {
    const f = fixture();
    try {
      const nextScope = f.entry('next-scope', f.scope.instance, {
        ...f.scopeConfig,
        restore: 'none',
      });
      const nextChild = f.entry('next-child', nextScope.instance);
      const queued: Array<FocusRequestOptions | undefined> = [];
      nextChild.getRootTarget = () => null;
      nextChild.requestFocus = (options) => {
        queued.push(options);
        nextChild.setPending(true);
        return 'pending';
      };
      f.userFocus(f.trigger);
      f.center.activateScope(f.scope);
      f.scope.onActive = (active) => {
        if (active) return;
        f.center.activateScope(nextScope, { entry: 'manual' });
        expect(f.center.requestFocus(nextChild, { reason: 'keyboard' })).toBe(true);
      };

      f.center.deactivateScope(f.scope);
      expect(queued).toEqual([{ reason: 'keyboard' }]);
      expect(nextChild.hasPendingFocus()).toBe(true);
      expect(f.cleared).not.toContain('next-child');
      expect(f.center.isScopeActive(f.scope)).toBe(false);
      expect(f.center.isTopActiveScope(nextScope)).toBe(true);
      expect(f.center.requestFocus(f.destination)).toBe(false);
      expect(document.activeElement).toBe(f.inside.element);
      f.center.deactivateScope(nextScope);
      expect(nextChild.hasPendingFocus()).toBe(false);
      expect(f.cleared).toContain('next-child');
    } finally {
      f.cleanup();
    }
  });

  it('does not auto-enter a nested manual scope from the older activation notification', () => {
    const f = fixture();
    try {
      f.center.remove(f.inside.instance);
      f.inside.element.remove();
      const nextScope = f.entry('next-scope', f.scope.instance, {
        ...f.scopeConfig,
        restore: 'none',
      });
      const nextChild = f.entry('next-child', nextScope.instance);
      f.userFocus(f.trigger);
      f.scope.onActive = (active) => {
        if (active) f.center.activateScope(nextScope, { entry: 'manual' });
      };

      expect(f.center.activateScope(f.scope)).toBe(true);
      expect(f.center.isScopeActive(f.scope)).toBe(true);
      expect(f.center.isTopActiveScope(nextScope)).toBe(true);
      expect(document.activeElement).toBe(f.trigger.element);
      expect(f.requests).toEqual([]);
      expect(f.center.requestFocus(f.destination)).toBe(false);
      expect(f.center.requestFocus(nextChild, { reason: 'keyboard' })).toBe(true);
      expect(document.activeElement).toBe(nextChild.element);
      f.center.deactivateScope(nextScope);
      f.center.deactivateScope(f.scope);
      expect(document.activeElement).toBe(f.trigger.element);
      expect(f.requests.map((request) => request.name)).toEqual(['next-child', 'trigger']);
    } finally {
      f.cleanup();
    }
  });

  it('preserves a newer pending request from the close notification without a scope change', () => {
    const f = fixture();
    try {
      const pendingChild = f.entry('pending-child', f.scope.instance);
      const queued: Array<FocusRequestOptions | undefined> = [];
      pendingChild.getRootTarget = () => null;
      pendingChild.requestFocus = (options) => {
        queued.push(options);
        pendingChild.setPending(true);
        return 'pending';
      };
      f.userFocus(f.trigger);
      f.center.activateScope(f.scope);
      f.scope.onActive = (active) => {
        if (!active) expect(f.center.requestFocus(pendingChild, { reason: 'keyboard' })).toBe(true);
      };

      f.center.deactivateScope(f.scope);
      expect(queued).toEqual([{ reason: 'keyboard' }]);
      expect(pendingChild.hasPendingFocus()).toBe(true);
      expect(f.cleared).not.toContain('pending-child');
      expect(f.requests.map((request) => request.name)).toEqual(['inside']);
      expect(document.activeElement).toBe(f.inside.element);
      expect(f.center.isScopeActive(f.scope)).toBe(false);

      // A subsequent successful owner is still allowed to clear this pending
      // intent; it is only the superseded close continuation that must stop.
      expect(f.center.requestFocus(f.destination, { reason: 'keyboard' })).toBe(true);
      expect(document.activeElement).toBe(f.destination.element);
      expect(pendingChild.hasPendingFocus()).toBe(false);
    } finally {
      f.cleanup();
    }
  });

  it('retires older scoped pending work while preserving a newer request from the close notification', () => {
    const f = fixture();
    try {
      const queued: string[] = [];
      function pendingTarget(name: string, parent: unknown | null) {
        const value = f.entry(name, parent);
        const apply = value.requestFocus;
        let available = false;
        let pendingRequest: FocusRequestOptions | undefined;
        value.getRootTarget = () => (available ? value.element : null);
        value.requestFocus = (options) => {
          if (!available) {
            pendingRequest = options;
            value.setPending(true);
            queued.push(name);
            return 'pending';
          }
          return apply(options);
        };
        return {
          value,
          ready() {
            available = true;
            // Host readiness may replay only the entry's retained pending intent.
            if (value.hasPendingFocus()) f.center.requestFocus(value, pendingRequest);
          },
        };
      }

      const oldChild = pendingTarget('old-pending-child', f.scope.instance);
      const nextTarget = pendingTarget('new-pending-destination', null);
      f.userFocus(f.trigger);
      f.center.activateScope(f.scope);
      expect(f.center.requestFocus(oldChild.value, { reason: 'keyboard' })).toBe(true);
      expect(oldChild.value.hasPendingFocus()).toBe(true);
      expect(nextTarget.value.hasPendingFocus()).toBe(false);
      f.scope.onActive = (active) => {
        if (!active)
          expect(f.center.requestFocus(nextTarget.value, { reason: 'keyboard' })).toBe(true);
      };

      f.center.deactivateScope(f.scope);
      f.scope.onActive = undefined;
      expect(queued).toEqual(['old-pending-child', 'new-pending-destination']);
      expect(oldChild.value.hasPendingFocus()).toBe(false);
      expect(f.cleared).toContain('old-pending-child');
      expect(nextTarget.value.hasPendingFocus()).toBe(true);
      expect(f.cleared).not.toContain('new-pending-destination');
      expect(f.center.isScopeActive(f.scope)).toBe(false);

      // C becomes ready before D can succeed, so D's eventual owner transfer
      // cannot mask a missed cancellation of the closed scope's older request.
      oldChild.ready();
      expect(document.activeElement).toBe(f.inside.element);
      expect(f.requests.map((request) => request.name)).toEqual(['inside']);
      expect(nextTarget.value.hasPendingFocus()).toBe(true);
      nextTarget.ready();
      expect(document.activeElement).toBe(nextTarget.value.element);
      expect(nextTarget.value.hasPendingFocus()).toBe(false);
      expect(f.requests.map((request) => request.name)).toEqual([
        'inside',
        'new-pending-destination',
      ]);

      // The following ordinary close still restores the captured previous owner.
      f.center.activateScope(f.scope);
      expect(document.activeElement).toBe(f.inside.element);
      f.center.deactivateScope(f.scope);
      expect(document.activeElement).toBe(nextTarget.value.element);
      expect(f.requests.at(-1)?.name).toBe('new-pending-destination');
    } finally {
      f.cleanup();
    }
  });
});
