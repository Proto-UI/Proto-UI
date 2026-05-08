import { defineAsHook, definePrototype, tw, type DefHandle } from '@proto.ui/core';
import { asOverlay } from '@proto.ui/hooks';
import { TOOLTIP_CONTEXT, TOOLTIP_FAMILY } from './shared';
import type {
  TooltipOverlayAsHookContract,
  TooltipOverlayExposes,
  TooltipOverlayProps,
} from './types';

function deriveOpen(next: { open: boolean; openRevision: number; disabled: boolean }): boolean {
  if (next.disabled) return false;
  return next.open;
}

function setupTooltipOverlay(def: DefHandle<TooltipOverlayProps, TooltipOverlayExposes>): void {
  def.anatomy.claim(TOOLTIP_FAMILY, { role: 'overlay' });

  const overlay = asOverlay({
    closeOnEscape: true,
    closeOnOutsidePress: false,
    restore: 'trigger',
    entry: 'content',
    placement: 'top',
    sideOffset: 4,
    meta: { overlayKind: 'tooltip' },
  });

  const open = def.state.bool('open', false);
  def.expose.state('open', open);
  let lastOpenRevision = -1;

  const syncOpen = (
    _run: any,
    next: {
      open: boolean;
      openRevision: number;
      disabled: boolean;
      controlled: boolean;
    }
  ) => {
    if (next.openRevision < lastOpenRevision) return;
    lastOpenRevision = next.openRevision;

    const nextOpen = deriveOpen(next);
    open.set(nextOpen, 'reason: tooltip context sync => overlay open');
    if (nextOpen) {
      overlay.openOverlay(next.controlled ? 'controlled.sync' : 'trigger.hover');
      return;
    }
    overlay.close('controlled.sync');
  };

  def.context.subscribe(TOOLTIP_CONTEXT, syncOpen);

  def.lifecycle.onMounted((run) => {
    const trigger = run.anatomy.partsOf(TOOLTIP_FAMILY, 'trigger')[0] ?? null;
    const triggerTarget = trigger?.getRootTarget?.() ?? null;
    if (triggerTarget) {
      overlay.registerTrigger(triggerTarget);
    }

    const ctx = run.context.read(TOOLTIP_CONTEXT);
    lastOpenRevision = ctx.openRevision;
    const nextOpen = deriveOpen(ctx);
    open.set(nextOpen, 'reason: lifecycle.onMounted => tooltip overlay open sync');
    if (nextOpen) {
      overlay.openOverlay(ctx.controlled ? 'controlled.sync' : 'trigger.hover');
    } else {
      overlay.close('controlled.sync');
    }
  });

  def.rule({
    when: (w: any) => w.state(open).eq(false),
    intent: (i: any) => i.feedback.style.use(tw('hidden')),
  });
}

export const asTooltipOverlay = defineAsHook<
  TooltipOverlayProps,
  TooltipOverlayExposes,
  TooltipOverlayAsHookContract
>({
  name: 'as-tooltip-overlay',
  mode: 'once',
  setup: setupTooltipOverlay,
});

const tooltipOverlay = definePrototype({
  name: 'base-tooltip-overlay',
  setup(def) {
    setupTooltipOverlay(def);
    def.feedback.style.use(tw('z-50 rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-sm'));
  },
});

export default tooltipOverlay;
