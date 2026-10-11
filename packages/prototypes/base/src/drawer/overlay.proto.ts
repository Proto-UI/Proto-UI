import { defineAsHook, definePrototype, tw, type DefHandle } from '@proto.ui/core';
import { asHitParticipation, asOverlay } from '@proto.ui/hooks';
import { asTransition } from '../tools';
import { DRAWER_CONTEXT, DRAWER_FAMILY } from './shared';
import type {
  DrawerMaskAsHookContract,
  DrawerMaskExposes,
  DrawerMaskHandles,
  DrawerMaskProps,
} from './types';

function projectDrawerMaskHandle(
  result: import('@proto.ui/core').AsHookResult<DrawerMaskProps, DrawerMaskAsHookContract>
): DrawerMaskHandles {
  // C-AS-HOOK-0009-E, C-AS-HOOK-0009-F: selectively re-export Transition's
  // stable child handle without flattening its state into Drawer Mask.
  const open = result.getState?.('open');
  const asTransition = result.getAsHookHandle?.('asTransition');
  if (!open || !asTransition) {
    throw new Error('[as-drawer-mask] missing captured Drawer or Transition handles.');
  }
  return { stateHandles: { open }, asTransition };
}

function setupDrawerMask(def: DefHandle<DrawerMaskProps, DrawerMaskExposes>): void {
  def.anatomy.claim(DRAWER_FAMILY, { role: 'mask' });

  def.props.define({
    passthrough: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({
    passthrough: false,
  });

  const overlay = asOverlay<DrawerMaskProps>();
  overlay.configure({
    closeOnEscape: false,
    closeOnOutsidePress: false,
    closeOnFocusOutside: false,
    portal: true,
    modal: true,
    layerRole: 'drawer-mask',
  });

  const hitParticipation = asHitParticipation({
    debugLabel: 'drawer-mask',
    meta: {
      overlayKind: 'drawer-mask',
    },
  });

  const transition = asTransition();
  // A backdrop press must not steal native focus after Content synchronously
  // restores Trigger. Presence includes leaving; dismissal still belongs to Content.
  def.event.on('pointer.down', (run, event) => {
    if (!transition.isPresent.get() || run.props.get().passthrough) return;
    event.control.requestDefaultActionPrevention({
      reason: 'drawer.mask.preserve-focus',
      source: 'base-drawer-mask',
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
      reason: 'drawer-mask.background-pointer',
      source: 'base-drawer-mask',
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
        overlayKind: 'drawer-mask',
      },
    });
  };

  const updateOpen = (nextOpen: boolean, reason?: string) => {
    open.set(nextOpen, reason ?? 'reason: drawer mask sync => open');
    if (nextOpen) {
      overlay.openOverlay(reason ?? 'drawer.open');
    } else {
      overlay.close(reason ?? 'drawer.close');
    }
  };

  def.context.subscribe(DRAWER_CONTEXT, (_run, next) => {
    updateOpen(next.open, 'reason: drawer context sync => mask open');
  });

  def.props.watch(['passthrough'], (run) => {
    syncHitParticipation(run);
  });

  def.lifecycle.onCreated((run) => {
    const ctx = run.context.read(DRAWER_CONTEXT);
    updateOpen(ctx.open, 'reason: lifecycle.onCreated => drawer mask open sync');
  });

  def.lifecycle.onMounted((run) => {
    hitSyncDisposed = false;
    syncHitParticipation(run);
    updateOpen(open.get(), 'reason: lifecycle.onMounted => drawer mask open sync');
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

export const asDrawerMask = defineAsHook<
  DrawerMaskProps,
  DrawerMaskExposes,
  DrawerMaskAsHookContract,
  DrawerMaskHandles
>({
  name: 'as-drawer-mask',
  setup: setupDrawerMask,
  projectHandle: projectDrawerMaskHandle,
});

const drawerMask = definePrototype({
  name: 'base-drawer-mask',
  setup(def) {
    setupDrawerMask(def);
    def.feedback.style.use(tw('fixed inset-0'));
  },
});

export default drawerMask;
