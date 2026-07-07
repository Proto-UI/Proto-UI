import type { VisibilityFacts } from '@proto.ui/core';
import type { VisibilityHostBridge } from '../types';

const VISIBILITY_PREV_HIDDEN_MARK = Symbol.for('@proto.ui/module-visibility/__prev_hidden');
const VISIBILITY_OWN_HIDDEN_MARK = Symbol.for('@proto.ui/module-visibility/__own_hidden');

type VisibilityElement = HTMLElement & Record<symbol, unknown>;

function applyHidden(target: VisibilityElement, hidden: boolean): void {
  if (hidden) {
    if (!target[VISIBILITY_OWN_HIDDEN_MARK]) {
      target[VISIBILITY_PREV_HIDDEN_MARK] = target.hidden;
      target[VISIBILITY_OWN_HIDDEN_MARK] = true;
    }
    target.hidden = true;
    return;
  }

  if (!target[VISIBILITY_OWN_HIDDEN_MARK]) return;

  const prev = target[VISIBILITY_PREV_HIDDEN_MARK];
  target.hidden = typeof prev === 'boolean' ? prev : false;
  delete target[VISIBILITY_OWN_HIDDEN_MARK];
  delete target[VISIBILITY_PREV_HIDDEN_MARK];
}

export function createWebVisibilityHostBridge(target: HTMLElement): VisibilityHostBridge {
  return {
    project(facts: VisibilityFacts) {
      applyHidden(target as VisibilityElement, facts.hidden);
    },
  };
}

export const __VISIBILITY_PREV_HIDDEN_MARK = VISIBILITY_PREV_HIDDEN_MARK;
export const __VISIBILITY_OWN_HIDDEN_MARK = VISIBILITY_OWN_HIDDEN_MARK;
