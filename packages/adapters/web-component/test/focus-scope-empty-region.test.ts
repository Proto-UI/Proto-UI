import { describe, expect, it, vi } from 'vitest';
import { hasWebComponentScopeDescendant } from '../src/focus-scope-targets';
import { createWebComponentPortalMount } from '../src/portal-mount';
import { isWebComponentNativeFocusCandidate as nativeFocusable } from '../src/native-focus-candidate';

// Exercise the actual Adapter-owned entry predicate. Supplied wrappers keep the
// complete sampler and have separate effect/order controls in focus-descendant-potential.
const hasDescendant = (container: HTMLElement) =>
  hasWebComponentScopeDescendant(container, nativeFocusable);
const button = () => {
  const target = document.createElement('button');
  target.tabIndex = 0;
  return target;
};

describe('WC entry descendant absence before computed style', () => {
  it.each(['empty', 'text-only', 'unowned-comment'] as const)(
    'returns false for a %s region without sampling ancestor or container styles',
    (kind) => {
      const scope = document.createElement('div');
      scope.tabIndex = 0; // The container itself is deliberately not a descendant.
      if (kind === 'text-only') scope.append(document.createTextNode('Current label'));
      if (kind === 'unowned-comment') scope.append(document.createComment('not a portal origin'));
      document.body.append(scope);
      const styles = vi.spyOn(scope.ownerDocument.defaultView!, 'getComputedStyle');
      try {
        expect(hasDescendant(scope)).toBe(false);
        expect(styles).not.toHaveBeenCalled();
      } finally {
        styles.mockRestore();
        scope.remove();
      }
    }
  );

  it('uses the open shadow branch and rechecks its later insertion and removal', () => {
    const scope = document.createElement('div');
    const ignoredLightTarget = button();
    scope.append(ignoredLightTarget);
    const shadow = scope.attachShadow({ mode: 'open' });
    shadow.append(document.createTextNode('Shadow label'));
    document.body.append(scope);
    const styles = vi.spyOn(scope.ownerDocument.defaultView!, 'getComputedStyle');
    try {
      expect(hasDescendant(scope)).toBe(false);
      expect(styles).not.toHaveBeenCalled();
      const currentTarget = button();
      shadow.append(currentTarget);
      expect(hasDescendant(scope)).toBe(true);
      expect(styles).toHaveBeenCalled();
      currentTarget.remove();
      styles.mockClear();
      expect(hasDescendant(scope)).toBe(false);
      expect(styles).not.toHaveBeenCalled();
    } finally {
      styles.mockRestore();
      scope.remove();
    }
  });

  it('does not traverse an opaque closed root or discard the existing accessible light branch', () => {
    const scope = document.createElement('div');
    scope.attachShadow({ mode: 'closed' }).append(button());
    document.body.append(scope);
    const styles = vi.spyOn(scope.ownerDocument.defaultView!, 'getComputedStyle');
    try {
      expect(scope.shadowRoot).toBeNull();
      expect(hasDescendant(scope)).toBe(false);
      expect(styles).not.toHaveBeenCalled();
      // Preserve this bounded sampler's existing accessible branch. This is
      // not a new claim about native traversal inside closed ShadowRoots.
      scope.append(button());
      expect(hasDescendant(scope)).toBe(true);
    } finally {
      styles.mockRestore();
      scope.remove();
    }
  });

  it('keeps assigned and fallback slot nodes live even when the slot has no own elements', () => {
    const host = document.createElement('div');
    const slot = document.createElement('slot');
    host.attachShadow({ mode: 'open' }).append(slot);
    const assigned = button();
    host.append(assigned);
    document.body.append(host);
    try {
      expect(slot.childElementCount).toBe(0);
      expect(slot.assignedNodes()).toContain(assigned);
      expect(hasDescendant(slot)).toBe(true);
      assigned.remove();
      const fallback = button();
      slot.append(fallback);
      expect(hasDescendant(slot)).toBe(true);
      slot.replaceChildren(document.createTextNode('Fallback label'));
      expect(hasDescendant(slot)).toBe(false);
      assigned.slot = 'later';
      host.append(assigned);
      expect(hasDescendant(slot)).toBe(false);
      slot.name = 'later';
      expect(hasDescendant(slot)).toBe(true);
    } finally {
      host.remove();
    }
  });

  it.each(['light', 'open-shadow', 'slot'] as const)(
    'keeps a comment-only %s portal origin and withdraws it after removal',
    (branch) => {
      const host = document.createElement('div');
      let origin: Node = host;
      let scope: HTMLElement = host;
      if (branch !== 'light') {
        const shadow = host.attachShadow({ mode: 'open' });
        if (branch === 'open-shadow') origin = shadow;
        else {
          const slot = document.createElement('slot');
          slot.name = 'projected';
          shadow.append(slot);
          scope = slot;
        }
      }
      const projected = document.createElement('section');
      if (branch === 'slot') projected.slot = 'projected';
      projected.append(button());
      origin.appendChild(projected);
      document.body.append(host);
      const portal = createWebComponentPortalMount();
      portal.mount(projected);
      try {
        expect(projected.parentElement).toBe(document.body);
        expect(scope.childElementCount).toBe(0);
        expect(hasDescendant(scope)).toBe(true);
        portal.unmount(projected);
        expect(hasDescendant(scope)).toBe(true);
        projected.remove();
        expect(hasDescendant(scope)).toBe(false);
      } finally {
        portal.unmount(projected);
        host.remove();
      }
    }
  );

  it.each(['foreignObject', 'svg-link'] as const)(
    'does not mistake a non-HTML %s path for an empty region',
    (kind) => {
      const scope = document.createElement('div');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      let target: Element;
      if (kind === 'foreignObject') {
        const foreign = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
        target = button();
        foreign.append(target);
        svg.append(foreign);
      } else {
        target = document.createElementNS('http://www.w3.org/2000/svg', 'a');
        target.setAttribute('href', '#destination');
        // Match the original scope sampler's explicit Happy DOM host-fact
        // fixture; real SVG native tabIndex remains a browser evidence scope.
        Object.defineProperty(target, 'tabIndex', { configurable: true, value: 0 });
        svg.append(target);
      }
      scope.append(svg);
      document.body.append(scope);
      try {
        expect(hasDescendant(scope)).toBe(true);
        target.remove();
        expect(hasDescendant(scope)).toBe(false);
      } finally {
        scope.remove();
      }
    }
  );

  it('rechecks ordinary insertion and relocation without caching the earlier absence', () => {
    const scope = document.createElement('div');
    const other = document.createElement('div');
    document.body.append(scope, other);
    try {
      expect(hasDescendant(scope)).toBe(false);
      const target = button();
      scope.append(target);
      expect(hasDescendant(scope)).toBe(true);
      other.append(target);
      expect(hasDescendant(scope)).toBe(false);
      expect(hasDescendant(other)).toBe(true);
      target.remove();
      expect(hasDescendant(other)).toBe(false);
    } finally {
      scope.remove();
      other.remove();
    }
  });

  it('retains the full ancestor eligibility check when an element descendant exists', () => {
    const outside = document.createElement('div');
    const scope = document.createElement('div');
    scope.append(button());
    outside.append(scope);
    document.body.append(outside);
    try {
      outside.style.display = 'none';
      expect(hasDescendant(scope)).toBe(false);
      outside.style.display = '';
      expect(hasDescendant(scope)).toBe(true);
      outside.setAttribute('inert', '');
      expect(hasDescendant(scope)).toBe(false);
      outside.removeAttribute('inert');
      expect(hasDescendant(scope)).toBe(true);
    } finally {
      outside.remove();
    }
  });
});
