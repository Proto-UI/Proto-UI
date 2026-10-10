import { createAnatomyFamily, createContextKey, type RunHandle } from '@proto.ui/core';
import { allocateHoverCardInteractionId } from './interaction-id';
import type { HoverCardInteractionPart, HoverCardReleaseInteraction } from './types';

export type HoverCardInteractionReason =
  | 'trigger.pointerenter'
  | 'trigger.pointerleave'
  | 'trigger.focus'
  | 'trigger.blur'
  | 'content.pointerenter'
  | 'content.pointerleave';

export type HoverCardContextValue = {
  // P-BASE-HOVER-CARD-CONTEXT
  open: boolean;
  controlled: boolean;
  disabled: boolean;
  openDelay: number;
  closeDelay: number;
  triggerHovered: boolean;
  triggerFocused: boolean;
  contentHovered: boolean;
  triggerInteractionOwner: number | null;
  contentInteractionOwner: number | null;
  interactionReason: HoverCardInteractionReason | null;
  interactionVersion: number;
  requestedOpen: boolean;
  requestReason: string | null;
  requestVersion: number;
};

export function deriveHoverCardInteractionOpen(ctx: HoverCardContextValue): boolean {
  // P-BASE-HOVER-CARD-INTERACTION-INTENT, P-BASE-HOVER-CARD-CONTENT-HOVER-BRIDGE
  return ctx.triggerHovered || ctx.triggerFocused || ctx.contentHovered;
}

type InteractionRole = HoverCardInteractionPart;
type InteractionPatch = Partial<
  Pick<HoverCardContextValue, 'triggerHovered' | 'triggerFocused' | 'contentHovered'>
>;

/** Borrow the current Root's cleanup operation before the part leaves its domain. */
export function createHoverCardInteraction(role: InteractionRole) {
  let owner: number | null = null;
  let releaseOwner: HoverCardReleaseInteraction | null = null;
  return {
    mount(run: RunHandle<any>) {
      const release = run.anatomy
        .partsOf(HOVER_CARD_FAMILY, 'root')[0]
        ?.getExpose('releaseInteraction');
      if (typeof release !== 'function')
        throw new Error('[HoverCard] Root releaseInteraction capability missing');
      owner = allocateHoverCardInteractionId();
      releaseOwner = release as HoverCardReleaseInteraction;
    },
    update(run: RunHandle<any>, patch: InteractionPatch, reason: HoverCardInteractionReason) {
      if (owner === null) return;
      let current: HoverCardContextValue;
      try {
        current = run.context.read(HOVER_CARD_CONTEXT);
      } catch (error) {
        if ((error as { code?: string })?.code === 'CONTEXT_DISCONNECTED') return;
        throw error;
      }
      const recordedOwner =
        role === 'trigger' ? current.triggerInteractionOwner : current.contentInteractionOwner;
      // A superseded publisher's leave/blur cannot clear a replacement's input.
      if (recordedOwner !== null && recordedOwner !== owner && !Object.values(patch).some(Boolean))
        return;
      updateHoverCardInteraction(run, patch, reason, role, owner);
    },
    release() {
      const previousOwner = owner;
      const release = releaseOwner;
      // Retire before calling the owner: request subscribers may synchronously remount.
      owner = null;
      releaseOwner = null;
      if (previousOwner !== null) release?.(role, previousOwner);
    },
  };
}

export function updateHoverCardInteraction(
  run: any,
  patch: InteractionPatch,
  reason: HoverCardInteractionReason,
  role?: InteractionRole,
  owner?: number
): boolean {
  try {
    run.context.update(HOVER_CARD_CONTEXT, (prev: HoverCardContextValue) => ({
      ...prev,
      ...patch,
      ...(role === 'trigger' ? { triggerInteractionOwner: owner ?? null } : {}),
      ...(role === 'content' ? { contentInteractionOwner: owner ?? null } : {}),
      interactionReason: reason,
      interactionVersion: prev.interactionVersion + 1,
    }));
    return true;
  } catch (error) {
    if ((error as { code?: string })?.code === 'CONTEXT_DISCONNECTED') return false;
    throw error;
  }
}

export function requestHoverCardOpen(run: any, nextOpen: boolean, reason: string): boolean {
  // P-BASE-HOVER-CARD-OPEN-CHANGE, P-BASE-HOVER-CARD-CONTROLLED-OWNER
  try {
    run.context.update(HOVER_CARD_CONTEXT, (prev: HoverCardContextValue) => ({
      ...prev,
      open: prev.controlled ? prev.open : nextOpen,
      requestedOpen: nextOpen,
      requestReason: reason,
      requestVersion: prev.requestVersion + 1,
    }));
    return true;
  } catch (error) {
    if ((error as { code?: string })?.code === 'CONTEXT_DISCONNECTED') return false;
    throw error;
  }
}

// P-BASE-HOVER-CARD-ANATOMY
export const HOVER_CARD_FAMILY = createAnatomyFamily('base-hover-card', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    trigger: { cardinality: { min: 0, max: 1 } },
    content: { cardinality: { min: 0, max: 1 } },
  },
  relations: [
    { kind: 'contains', parent: 'root', child: 'trigger' },
    { kind: 'contains', parent: 'root', child: 'content' },
  ],
});

// P-BASE-HOVER-CARD-CONTEXT
export const HOVER_CARD_CONTEXT = createContextKey<HoverCardContextValue>('base-hover-card');
