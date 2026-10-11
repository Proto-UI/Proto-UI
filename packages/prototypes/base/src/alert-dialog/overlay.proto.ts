import { defineAsHook, definePrototype, tw, type DefHandle } from '@proto.ui/core';
import { asHitParticipation, asOverlay } from '@proto.ui/hooks';
import { asTransition } from '../tools';
import { ALERT_DIALOG_CONTEXT, ALERT_DIALOG_FAMILY } from './shared';
import type {
  AlertDialogMaskAsHookContract,
  AlertDialogMaskExposes,
  AlertDialogMaskHandles,
  AlertDialogMaskProps,
} from './types';

function projectAlertDialogMaskHandle(
  result: import('@proto.ui/core').AsHookResult<AlertDialogMaskProps, AlertDialogMaskAsHookContract>
): AlertDialogMaskHandles {
  // C-AS-HOOK-0009-E, C-AS-HOOK-0009-F: selectively re-export Transition's
  // stable child handle without flattening its state into AlertDialog Mask.
  const open = result.getState?.('open');
  const asTransition = result.getAsHookHandle?.('asTransition');
  if (!open || !asTransition) {
    throw new Error('[as-alert-dialog-mask] missing captured AlertDialog or Transition handles.');
  }
  return { stateHandles: { open }, asTransition };
}

function setupAlertDialogMask(def: DefHandle<AlertDialogMaskProps, AlertDialogMaskExposes>): void {
  def.anatomy.claim(ALERT_DIALOG_FAMILY, { role: 'mask' });

  def.props.define({
    passthrough: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({
    passthrough: false,
  });

  const overlay = asOverlay<AlertDialogMaskProps>();
  overlay.configure({
    closeOnEscape: false,
    closeOnOutsidePress: false,
    closeOnFocusOutside: false,
    portal: true,
    modal: true,
    layerRole: 'alertDialog-mask',
  });

  const hitParticipation = asHitParticipation({
    debugLabel: 'alertDialog-mask',
    meta: {
      overlayKind: 'alertDialog-mask',
    },
  });

  const transition = asTransition();
  // A backdrop press must not steal native focus after Content synchronously
  // restores Trigger. Presence includes leaving; dismissal still belongs to Content.
  def.event.on('pointer.down', (run, event) => {
    if (!transition.isPresent.get() || run.props.get().passthrough) return;
    event.control.requestDefaultActionPrevention({
      reason: 'alertDialog.mask.preserve-focus',
      source: 'base-alert-dialog-mask',
    });
  });
  overlay.bindPresence({
    enter: transition.controls.enter,
    leave: transition.controls.leave,
    present: transition.isPresent,
  });
  const open = def.state.bool('open', false);

  // and focus restoration. Do not let the participating backdrop's native
  // pointer default steal that restored focus after Content handles the press.
  // This is the Mask-owned root event, not a global interception policy.
  def.event.on('pointer.down', (run, event) => {
    if (run.props.get().passthrough) return;
    event.control.requestDefaultActionPrevention({
      reason: 'alertDialog-mask.background-pointer',
      source: 'base-alert-dialog-mask',
    });
  });
  let hitRegionDispose: (() => void) | null = null;
  let hitSyncDisposed = false;

  const syncHitParticipation = (run: any) => {
    if (hitSyncDisposed) return;

    const target = run.host?.get?.() ?? null;

    hitRegionDispose?.();
    hitRegionDispose = null;

    if (!target) return;

    hitRegionDispose = hitParticipation.registerRegion(target, {
      role: 'mask',
      mode: run.props.get().passthrough ? 'passthrough' : 'participating',
      meta: {
        overlayKind: 'alertDialog-mask',
      },
    });
  };

  const updateOpen = (nextOpen: boolean, reason?: string) => {
    open.set(nextOpen, reason ?? 'reason: alertDialog mask sync => open');
    if (nextOpen) {
      overlay.openOverlay(reason ?? 'alertDialog.open');
    } else {
      overlay.close(reason ?? 'alertDialog.close');
    }
  };

  def.context.subscribe(ALERT_DIALOG_CONTEXT, (_run, next) => {
    updateOpen(next.open, 'reason: alertDialog context sync => mask open');
  });

  def.props.watch(['passthrough'], (run) => {
    syncHitParticipation(run);
  });

  def.lifecycle.onCreated((run) => {
    const ctx = run.context.read(ALERT_DIALOG_CONTEXT);
    updateOpen(ctx.open, 'reason: lifecycle.onCreated => alertDialog mask open sync');
  });

  def.lifecycle.onMounted((run) => {
    hitSyncDisposed = false;
    syncHitParticipation(run);
    updateOpen(open.get(), 'reason: lifecycle.onMounted => alertDialog mask open sync');
  });

  def.lifecycle.onUnmounted(() => {
    hitSyncDisposed = true;
    hitRegionDispose?.();
    hitRegionDispose = null;
  });

  def.rule({
    when: (w) => w.state(transition.isPresent).eq(false),
    intent: (i) => i.feedback.style.use(tw('hidden')),
  });
}

export const asAlertDialogMask = defineAsHook<
  AlertDialogMaskProps,
  AlertDialogMaskExposes,
  AlertDialogMaskAsHookContract,
  AlertDialogMaskHandles
>({
  name: 'as-alert-dialog-mask',
  setup: setupAlertDialogMask,
  projectHandle: projectAlertDialogMaskHandle,
});

const alertDialogMask = definePrototype({
  name: 'base-alert-dialog-mask',
  setup(def) {
    setupAlertDialogMask(def);
    def.feedback.style.use(tw('fixed inset-0'));
  },
});

export default alertDialogMask;
