import {
  defineAsHook,
  definePrototype,
  delay,
  tw,
  type DefHandle,
  type DelayTask,
} from '@proto.ui/core';
import { useOpenState } from '../tools';
import {
  deriveHoverCardInteractionOpen,
  HOVER_CARD_CONTEXT,
  HOVER_CARD_FAMILY,
  requestHoverCardOpen,
  type HoverCardContextValue,
} from './shared';
import type {
  HoverCardRootAsHookContract,
  HoverCardRootExposes,
  HoverCardRootProps,
} from './types';

const DEFAULT_OPEN_DELAY = 700;
const DEFAULT_CLOSE_DELAY = 300;

function normalizeDelay(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function sameContext(a: HoverCardContextValue, b: HoverCardContextValue): boolean {
  return (
    a.open === b.open &&
    a.controlled === b.controlled &&
    a.disabled === b.disabled &&
    a.openDelay === b.openDelay &&
    a.closeDelay === b.closeDelay &&
    a.triggerHovered === b.triggerHovered &&
    a.triggerFocused === b.triggerFocused &&
    a.contentHovered === b.contentHovered &&
    a.triggerInteractionOwner === b.triggerInteractionOwner &&
    a.contentInteractionOwner === b.contentInteractionOwner &&
    a.interactionReason === b.interactionReason &&
    a.interactionVersion === b.interactionVersion &&
    a.requestedOpen === b.requestedOpen &&
    a.requestReason === b.requestReason &&
    a.requestVersion === b.requestVersion
  );
}

function setupHoverCardRoot(def: DefHandle<HoverCardRootProps, HoverCardRootExposes>): void {
  // P-BASE-HOVER-CARD-ROLE-LINK-PREVIEW, P-BASE-HOVER-CARD-ROOT-OWNER
  def.anatomy.claim(HOVER_CARD_FAMILY, { role: 'root' });

  // P-BASE-HOVER-CARD-PROPS, P-BASE-HOVER-CARD-DELAYS
  def.props.define({
    open: { type: 'boolean', empty: 'fallback' },
    defaultOpen: { type: 'boolean', empty: 'fallback' },
    disabled: { type: 'boolean', empty: 'fallback' },
    openDelay: { type: 'number', empty: 'fallback' },
    closeDelay: { type: 'number', empty: 'fallback' },
  });
  def.props.setDefaults({
    defaultOpen: false,
    disabled: false,
    openDelay: DEFAULT_OPEN_DELAY,
    closeDelay: DEFAULT_CLOSE_DELAY,
  });

  const initialContext: HoverCardContextValue = {
    open: false,
    controlled: false,
    disabled: false,
    openDelay: DEFAULT_OPEN_DELAY,
    closeDelay: DEFAULT_CLOSE_DELAY,
    triggerHovered: false,
    triggerFocused: false,
    contentHovered: false,
    triggerInteractionOwner: null,
    contentInteractionOwner: null,
    interactionReason: null,
    interactionVersion: 0,
    requestedOpen: false,
    requestReason: null,
    requestVersion: 0,
  };
  // P-BASE-HOVER-CARD-CONTEXT
  def.context.provide(HOVER_CARD_CONTEXT, initialContext);

  // P-BASE-HOVER-CARD-OPEN-EXPOSE, P-BASE-HOVER-CARD-CONTROLLED-OWNER
  const openState = useOpenState({
    exposeOpenMethodKey: 'openHoverCard',
    requestOpen(run, nextOpen, reason) {
      const ctx = run.context.read(HOVER_CARD_CONTEXT);
      if (ctx.disabled) return;
      requestHoverCardOpen(run, nextOpen, reason);
    },
  });
  const open = openState.getState?.('open');
  // P-BASE-HOVER-CARD-OPEN-CHANGE
  def.expose.event('openChange', { payload: 'json' });

  let cleanupRun: import('@proto.ui/core').RunHandle<HoverCardRootProps> | null = null;
  // C-ANATOMY-0009-E: borrowers invoke this operation in this Root's callback
  // scope. They never retain our run handle or rediscover a provider at release.
  def.expose.method('releaseInteraction', (part, contributionId) => {
    if (
      !cleanupRun ||
      (part !== 'trigger' && part !== 'content') ||
      !Number.isSafeInteger(contributionId) ||
      contributionId <= 0
    )
      return false;
    const current = cleanupRun.context.read(HOVER_CARD_CONTEXT);
    const ownerKey = part === 'trigger' ? 'triggerInteractionOwner' : 'contentInteractionOwner';
    if (current[ownerKey] !== contributionId) return false;
    const wasActive =
      part === 'trigger'
        ? current.triggerHovered || current.triggerFocused
        : current.contentHovered;
    cleanupRun.context.update(HOVER_CARD_CONTEXT, {
      ...current,
      ...(part === 'trigger'
        ? { triggerHovered: false, triggerFocused: false }
        : { contentHovered: false }),
      [ownerKey]: null,
      // Retiring an already-false source must preserve a pending close deadline.
      interactionReason: wasActive ? `${part}.pointerleave` : current.interactionReason,
      interactionVersion: current.interactionVersion + (wasActive ? 1 : 0),
    });
    return true;
  });

  let snapshot = initialContext;
  let published = initialContext;
  let lastRequestVersion = 0;
  let lastInteractionVersion = 0;
  let pendingIntent: boolean | null = null;
  let pendingDelay: DelayTask | null = null;

  const cancelPending = () => {
    pendingDelay?.cancel();
    pendingDelay = null;
    pendingIntent = null;
  };

  const syncContext = (run: any) => {
    // P-BASE-HOVER-CARD-CONTEXT
    const next = { ...snapshot, open: open?.get() ?? false };
    snapshot = next;
    if (sameContext(published, next)) return;
    published = next;
    run.context.update(HOVER_CARD_CONTEXT, next);
  };

  const scheduleInteractionRequest = (run: any, nextOpen: boolean, reason: string) => {
    // P-BASE-HOVER-CARD-DELAYS, P-BASE-HOVER-CARD-INTERACTION-INTENT
    cancelPending();
    if (snapshot.disabled || nextOpen === (open?.get() ?? false)) return;

    const duration = nextOpen ? snapshot.openDelay : snapshot.closeDelay;
    pendingIntent = nextOpen;
    pendingDelay = delay(duration, () => {
      if (pendingIntent !== nextOpen) return;
      pendingDelay = null;
      pendingIntent = null;
      const latest = run.context.read(HOVER_CARD_CONTEXT);
      if (latest.disabled || deriveHoverCardInteractionOpen(latest) !== nextOpen) return;
      requestHoverCardOpen(run, nextOpen, reason);
    });
  };

  def.context.subscribe(HOVER_CARD_CONTEXT, (run, next) => {
    snapshot = next;
    published = next;

    if (next.requestVersion !== lastRequestVersion) {
      // P-BASE-HOVER-CARD-OPEN-CHANGE, P-BASE-HOVER-CARD-CONTROLLED-OWNER
      lastRequestVersion = next.requestVersion;
      if (!next.controlled) {
        open?.set(next.requestedOpen, 'reason: hover-card request => uncontrolled sync');
      }
      run.expose.emit('openChange', {
        open: next.requestedOpen,
        reason: next.requestReason,
      });
      return;
    }

    if (next.interactionVersion !== lastInteractionVersion) {
      lastInteractionVersion = next.interactionVersion;
      scheduleInteractionRequest(
        run,
        deriveHoverCardInteractionOpen(next),
        next.interactionReason ?? 'interaction'
      );
    }
  });

  def.lifecycle.onCreated((run) => {
    cleanupRun = run;
    // P-BASE-HOVER-CARD-ROOT-OWNER, P-BASE-HOVER-CARD-PROPS
    const props = run.props.get();
    snapshot = {
      ...snapshot,
      controlled: run.props.isProvided('open'),
      disabled: !!props.disabled,
      openDelay: normalizeDelay(props.openDelay, DEFAULT_OPEN_DELAY),
      closeDelay: normalizeDelay(props.closeDelay, DEFAULT_CLOSE_DELAY),
    };
    syncContext(run);
  });

  def.props.watch(['open', 'disabled', 'openDelay', 'closeDelay'], (run, next) => {
    snapshot = {
      ...snapshot,
      controlled: run.props.isProvided('open'),
      disabled: !!next.disabled,
      openDelay: normalizeDelay(next.openDelay, DEFAULT_OPEN_DELAY),
      closeDelay: normalizeDelay(next.closeDelay, DEFAULT_CLOSE_DELAY),
    };
    if (snapshot.disabled) cancelPending();
    syncContext(run);
  });

  open?.watch((run, event) => {
    if (event.type !== 'next') return;
    if (pendingIntent === event.next) cancelPending();
    syncContext(run);
  });

  def.lifecycle.onBeforeDispose(() => {
    cleanupRun = null;
    cancelPending();
  });
}

/*
 * P-BASE-HOVER-CARD-PROTOCOL-INDEPENDENCE: Root consumes protocol-neutral
 * state and runtime delay capabilities, not another Base prototype protocol.
 */

// P-BASE-HOVER-CARD-AUTHORING-ENTRIES
export const asHoverCardRoot = defineAsHook<
  HoverCardRootProps,
  HoverCardRootExposes,
  HoverCardRootAsHookContract
>({
  name: 'as-hover-card-root',
  setup: setupHoverCardRoot,
});

const hoverCardRoot = definePrototype({
  name: 'base-hover-card-root',
  setup(def) {
    setupHoverCardRoot(def);
    def.feedback.style.use(tw('relative inline-flex items-start'));
  },
});

export default hoverCardRoot;
