import type { A11ySemanticObjectSnapshot } from '@proto.ui/core';

import type { A11yProjector } from './caps';

const ARIA_STATE_ATTRS: Record<string, string> = {
  atomic: 'aria-atomic',
  busy: 'aria-busy',
  checked: 'aria-checked',
  disabled: 'aria-disabled',
  expanded: 'aria-expanded',
  hasPopup: 'aria-haspopup',
  invalid: 'aria-invalid',
  live: 'aria-live',
  orientation: 'aria-orientation',
  pressed: 'aria-pressed',
  readOnly: 'aria-readonly',
  selected: 'aria-selected',
  modal: 'aria-modal',
};

const ARIA_RELATION_ATTRS: Record<string, string> = {
  controls: 'aria-controls',
  describedBy: 'aria-describedby',
  labelledBy: 'aria-labelledby',
};

export function createWebA11yProjector(
  target: HTMLElement | (() => HTMLElement | null),
  subscribeTargetChange?: (listener: () => void) => () => void
): A11yProjector {
  const getTarget = typeof target === 'function' ? target : () => target;
  let lastTarget: HTMLElement | null = null;
  let lastSnapshot: A11ySemanticObjectSnapshot | null = null;

  const project = (snapshot: A11ySemanticObjectSnapshot) => {
    const nextTarget = getTarget();
    if (lastTarget && lastTarget !== nextTarget && lastSnapshot) {
      clearWebA11ySnapshot(lastTarget, lastSnapshot);
    }
    const previousSnapshot = lastTarget === nextTarget ? lastSnapshot : null;
    lastTarget = nextTarget;
    lastSnapshot = snapshot;
    if (nextTarget) applyWebA11ySnapshot(nextTarget, snapshot, previousSnapshot ?? undefined);
  };

  subscribeTargetChange?.(() => {
    if (lastSnapshot) project(lastSnapshot);
  });

  return project;
}

export function clearWebA11ySnapshot(el: HTMLElement, snapshot: A11ySemanticObjectSnapshot): void {
  if (typeof snapshot.id !== 'undefined') el.removeAttribute('id');
  if (typeof snapshot.role !== 'undefined') el.removeAttribute('role');
  if (snapshot.name) el.removeAttribute('aria-label');
  if (snapshot.description) el.removeAttribute('aria-description');

  for (const [key, attr] of Object.entries(ARIA_STATE_ATTRS)) {
    if (Object.prototype.hasOwnProperty.call(snapshot.states, key)) el.removeAttribute(attr);
  }
  if (Object.prototype.hasOwnProperty.call(snapshot.states, 'hidden')) {
    el.removeAttribute('aria-hidden');
    el.removeAttribute('hidden');
  }
  for (const [key, attr] of Object.entries(ARIA_RELATION_ATTRS)) {
    if (!Object.prototype.hasOwnProperty.call(snapshot.relations, key)) continue;
    if (snapshot.relationModes?.[key] === 'append') {
      setTokenListAttr(
        el,
        attr,
        withoutTokens(readTokens(el.getAttribute(attr)), relationTokens(snapshot, key))
      );
    } else {
      el.removeAttribute(attr);
    }
  }
  if (Object.keys(snapshot.actions).length) el.removeAttribute('data-pui-a11y-actions');
  if (snapshot.tree) {
    if (Object.prototype.hasOwnProperty.call(snapshot.tree, 'hidden')) {
      el.removeAttribute('aria-hidden');
    }
    if (Object.prototype.hasOwnProperty.call(snapshot.tree, 'mergeChildren')) {
      el.removeAttribute('data-pui-a11y-merge-children');
    }
  }
}

export function applyWebA11ySnapshot(
  el: HTMLElement,
  snapshot: A11ySemanticObjectSnapshot,
  previousSnapshot?: A11ySemanticObjectSnapshot
): void {
  if (typeof snapshot.id !== 'undefined') {
    setOptionalAttr(el, 'id', snapshot.id ?? undefined);
  }

  if (typeof snapshot.role !== 'undefined') {
    setOptionalAttr(el, 'role', snapshot.role);
  }

  if (snapshot.name) {
    if (snapshot.name.kind === 'text') {
      setOptionalAttr(el, 'aria-label', readTextTarget(snapshot.name.value));
    } else {
      el.removeAttribute('aria-label');
    }
  }

  if (snapshot.description) {
    if (snapshot.description.kind === 'text') {
      setOptionalAttr(el, 'aria-description', readTextTarget(snapshot.description.value));
    } else {
      el.removeAttribute('aria-description');
    }
  }

  for (const [key, attr] of Object.entries(ARIA_STATE_ATTRS)) {
    if (Object.prototype.hasOwnProperty.call(snapshot.states, key)) {
      setA11yStateAttr(el, attr, snapshot.states[key]);
    }
  }

  if (Object.prototype.hasOwnProperty.call(snapshot.states, 'hidden')) {
    setA11yStateAttr(el, 'aria-hidden', snapshot.states.hidden);
    setBooleanPresenceAttr(el, 'hidden', snapshot.states.hidden);
  }

  for (const [key, attr] of Object.entries(ARIA_RELATION_ATTRS)) {
    if (Object.prototype.hasOwnProperty.call(snapshot.relations, key)) {
      if (snapshot.relationModes?.[key] === 'append') {
        const current = readTokens(el.getAttribute(attr));
        const previousOwned =
          previousSnapshot?.relationModes?.[key] === 'append'
            ? relationTokens(previousSnapshot, key)
            : [];
        setTokenListAttr(el, attr, [
          ...withoutTokens(current, previousOwned),
          ...relationTokens(snapshot, key),
        ]);
      } else {
        setOptionalAttr(el, attr, snapshot.relations[key] ?? undefined);
      }
    }
  }

  const actionKeys = Object.keys(snapshot.actions).sort();
  if (actionKeys.length) {
    setOptionalAttr(el, 'data-pui-a11y-actions', actionKeys.join(' '));
  }

  if (snapshot.tree) {
    if (Object.prototype.hasOwnProperty.call(snapshot.tree, 'hidden')) {
      setA11yStateAttr(el, 'aria-hidden', snapshot.tree.hidden);
    }
    if (Object.prototype.hasOwnProperty.call(snapshot.tree, 'mergeChildren')) {
      setA11yStateAttr(el, 'data-pui-a11y-merge-children', snapshot.tree.mergeChildren);
    }
  }
}

function relationTokens(snapshot: A11ySemanticObjectSnapshot, key: string): string[] {
  return readTokens(snapshot.relations[key]);
}

function readTokens(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  return [...new Set(value.trim().split(/\s+/).filter(Boolean))];
}

function withoutTokens(current: string[], removed: string[]): string[] {
  const removal = new Set(removed);
  return current.filter((token) => !removal.has(token));
}

function setTokenListAttr(el: HTMLElement, attr: string, tokens: string[]): void {
  setOptionalAttr(el, attr, [...new Set(tokens)].join(' '));
}

function setOptionalAttr(el: HTMLElement, attr: string, value: string | undefined): void {
  if (value === undefined || value === '') {
    el.removeAttribute(attr);
    return;
  }
  el.setAttribute(attr, value);
}

function readTextTarget(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { get?: unknown }).get === 'function'
  ) {
    const next = (value as { get(): unknown }).get();
    return typeof next === 'string' ? next : undefined;
  }
  return undefined;
}

function setA11yStateAttr(el: HTMLElement, attr: string, value: unknown): void {
  if (value === undefined || value === null || value === '') {
    el.removeAttribute(attr);
    return;
  }
  if (typeof value === 'boolean') {
    el.setAttribute(attr, value ? 'true' : 'false');
    return;
  }
  el.setAttribute(attr, String(value));
}

function setBooleanPresenceAttr(el: HTMLElement, attr: string, value: unknown): void {
  if (value === true) {
    el.setAttribute(attr, '');
    return;
  }
  el.removeAttribute(attr);
}
