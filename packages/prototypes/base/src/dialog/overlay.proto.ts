import { defineAsHook, definePrototype, tw, type DefHandle } from '@proto.ui/core';
import { asHitParticipation, asOverlay } from '@proto.ui/hooks';
import { asTransition } from '../tools';
import { DIALOG_CONTEXT, DIALOG_FAMILY } from './shared';
import type {
  DialogMaskAsHookContract,
  DialogMaskExposes,
  DialogMaskHandles,
  DialogMaskProps,
} from './types';

function projectDialogMaskHandle(
  result: import('@proto.ui/core').AsHookResult<DialogMaskProps, DialogMaskAsHookContract>
): DialogMaskHandles {
  // C-AS-HOOK-0009-E, C-AS-HOOK-0009-F: selectively re-export Transition's
  // stable child handle without flattening its state into Dialog Mask.
  const open = result.getState?.('open');
  const asTransition = result.getAsHookHandle?.('asTransition');
  if (!open || !asTransition) {
    throw new Error('[as-dialog-mask] missing captured Dialog or Transition handles.');
  }
  return { stateHandles: { open }, asTransition };
}

function setupDialogMask(def: DefHandle<DialogMaskProps, DialogMaskExposes>): void {
  // P-BASE-DIALOG-MASK-MODAL
  def.anatomy.claim(DIALOG_FAMILY, { role: 'mask' });
  // P-BASE-DIALOG-MASK-PASSTHROUGH
  def.props.define({
    passthrough: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({
    passthrough: false,
  });

  // P-BASE-DIALOG-MASK-MODAL, P-BASE-DIALOG-MASK-NO-DISMISS
  const overlay = asOverlay<DialogMaskProps>();
  overlay.configure({
    closeOnEscape: false,
    closeOnOutsidePress: false,
    closeOnFocusOutside: false,
    portal: true,
    modal: true,
    layerRole: 'dialog-mask',
  });
  // P-BASE-DIALOG-MASK-PASSTHROUGH
  const hitParticipation = asHitParticipation({
    debugLabel: 'dialog-mask',
    meta: {
      overlayKind: 'dialog-mask',
    },
  });

  // P-BASE-DIALOG-MASK-PRESENCE
  const transition = asTransition();
  // A backdrop press must not steal native focus after Content synchronously
  // restores Trigger. Presence includes leaving; dismissal still belongs to Content.
  def.event.on('pointer.down', (run, event) => {
    if (!transition.isPresent.get() || run.props.get().passthrough) return;
    event.control.requestDefaultActionPrevention({
      reason: 'dialog.mask.preserve-focus',
      source: 'base-dialog-mask',
    });
  });
  overlay.bindPresence({
    enter: transition.controls.enter,
    leave: transition.controls.leave,
    present: transition.isPresent,
  });
  const open = def.state.bool('open', false);
  let hitRegionDispose: (() => void) | null = null;
  let hitSyncDisposed = false;

  const syncHitParticipation = (run: any) => {
    // P-BASE-DIALOG-MASK-PASSTHROUGH
    if (hitSyncDisposed) return;

    const target = run.host?.get?.() ?? null;

    hitRegionDispose?.();
    hitRegionDispose = null;

    if (!target) return;

    hitRegionDispose = hitParticipation.registerRegion(target, {
      role: 'mask',
      mode: run.props.get().passthrough ? 'passthrough' : 'participating',
      meta: {
        overlayKind: 'dialog-mask',
      },
    });
  };

  const updateOpen = (nextOpen: boolean, reason?: string) => {
    // P-BASE-DIALOG-MASK-PRESENCE
    open.set(nextOpen, reason ?? 'reason: dialog mask sync => open');
    if (nextOpen) {
      overlay.openOverlay(reason ?? 'dialog.open');
    } else {
      overlay.close(reason ?? 'dialog.close');
    }
  };

  def.context.subscribe(DIALOG_CONTEXT, (_run, next) => {
    updateOpen(next.open, 'reason: dialog context sync => mask open');
  });

  def.props.watch(['passthrough'], (run) => {
    syncHitParticipation(run);
  });

  def.lifecycle.onCreated((run) => {
    const ctx = run.context.read(DIALOG_CONTEXT);
    updateOpen(ctx.open, 'reason: lifecycle.onCreated => dialog mask open sync');
  });

  def.lifecycle.onMounted((run) => {
    hitSyncDisposed = false;
    syncHitParticipation(run);
    updateOpen(open.get(), 'reason: lifecycle.onMounted => dialog mask open sync');
  });

  def.lifecycle.onUnmounted(() => {
    hitSyncDisposed = true;
    hitRegionDispose?.();
    hitRegionDispose = null;
  });

  def.rule({
    // P-BASE-DIALOG-MASK-PRESENCE
    when: (w) => w.state(transition.isPresent).eq(false),
    intent: (i) => i.feedback.style.use(tw('hidden')),
  });
}

// P-BASE-DIALOG-MASK-AUTHORING-ENTRIES
export const asDialogMask = defineAsHook<
  DialogMaskProps,
  DialogMaskExposes,
  DialogMaskAsHookContract,
  DialogMaskHandles
>({
  name: 'as-dialog-mask',
  setup: setupDialogMask,
  projectHandle: projectDialogMaskHandle,
});

const dialogMask = definePrototype({
  name: 'base-dialog-mask',
  setup(def) {
    setupDialogMask(def);
    def.feedback.style.use(tw('fixed inset-0'));
  },
});

export default dialogMask;
