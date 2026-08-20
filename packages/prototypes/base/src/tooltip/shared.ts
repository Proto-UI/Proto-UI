import { createAnatomyFamily, createContextKey, type RunHandle } from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';

let nextTooltipRootId = 0;

export function createTooltipRootId(): string {
  nextTooltipRootId += 1;
  return `pui-tooltip-${nextTooltipRootId}`;
}

export function createTooltipContentId(rootId: string): string {
  return `${rootId || 'pui-tooltip'}-content`;
}

export type TooltipInteractionReason =
  | 'trigger.pointerenter'
  | 'trigger.pointerleave'
  | 'trigger.focus'
  | 'trigger.blur'
  | 'content.pointerenter'
  | 'content.pointerleave'
  | 'escape';

export type TooltipContextValue = {
  rootId: string;
  open: boolean;
  controlled: boolean;
  disabled: boolean;
  openDelay: number;
  closeDelay: number;
  triggerHovered: boolean;
  triggerFocused: boolean;
  contentHovered: boolean;
  interactionReason: TooltipInteractionReason | null;
  interactionVersion: number;
  requestedOpen: boolean;
  requestReason: string | null;
  requestVersion: number;
};

export type TooltipGroupContextValue = {
  openDelay: number;
  closeDelay: number;
  skipDelay: number;
  warm: boolean;
  activeTooltipId: string | null;
  requestTooltipId: string | null;
  requestOpen: boolean;
  requestReason: string | null;
  requestVersion: number;
};

export function deriveTooltipInteractionOpen(ctx: TooltipContextValue): boolean {
  return ctx.triggerHovered || ctx.triggerFocused || ctx.contentHovered;
}

export function updateTooltipInteraction<P extends PropsBaseType>(
  run: RunHandle<P>,
  patch: Partial<Pick<TooltipContextValue, 'triggerHovered' | 'triggerFocused' | 'contentHovered'>>,
  reason: TooltipInteractionReason
): boolean {
  try {
    run.context.update(
      TOOLTIP_CONTEXT,
      (prev): TooltipContextValue => ({
        ...prev,
        ...patch,
        interactionReason: reason,
        interactionVersion: prev.interactionVersion + 1,
      })
    );
    return true;
  } catch (error) {
    if ((error as { code?: string })?.code === 'CONTEXT_DISCONNECTED') return false;
    throw error;
  }
}

export function requestTooltipOpen<P extends PropsBaseType>(
  run: RunHandle<P>,
  nextOpen: boolean,
  reason: string
): boolean {
  try {
    run.context.update(TOOLTIP_CONTEXT, (prev) => ({
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

export function dismissTooltipFromEscape<P extends PropsBaseType>(run: RunHandle<P>): boolean {
  try {
    run.context.update(
      TOOLTIP_CONTEXT,
      (prev): TooltipContextValue => ({
        ...prev,
        triggerHovered: false,
        triggerFocused: false,
        contentHovered: false,
        interactionReason: 'escape',
        interactionVersion: prev.interactionVersion + 1,
        open: prev.controlled ? prev.open : false,
        requestedOpen: false,
        requestReason: 'escape',
        requestVersion: prev.requestVersion + 1,
      })
    );
    return true;
  } catch (error) {
    if ((error as { code?: string })?.code === 'CONTEXT_DISCONNECTED') return false;
    throw error;
  }
}

export function announceTooltipToGroup<P extends PropsBaseType>(
  run: RunHandle<P>,
  tooltipId: string,
  open: boolean,
  reason: string
): boolean {
  return run.context.tryUpdate(TOOLTIP_GROUP_CONTEXT, (prev) => ({
    ...prev,
    requestTooltipId: tooltipId,
    requestOpen: open,
    requestReason: reason,
    requestVersion: prev.requestVersion + 1,
  }));
}

export const TOOLTIP_FAMILY = createAnatomyFamily('base-tooltip', {
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

export const TOOLTIP_CONTEXT = createContextKey<TooltipContextValue>('base-tooltip');
export const TOOLTIP_GROUP_CONTEXT =
  createContextKey<TooltipGroupContextValue>('base-tooltip-group');
