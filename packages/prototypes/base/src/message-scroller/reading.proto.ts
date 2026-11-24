import {
  defineAsHook,
  type DefHandle,
  type ExposeMethod,
  type ExposeState,
  type State,
} from '@proto.ui/core';
import { asScrollSurface } from '@proto.ui/hooks';
import {
  captureMessageReadingAnchor,
  messageSelectionRestoreEligible,
  planMessageReadingRestore,
  sameMessageReadingSelection,
  type MessageReadingAnchor,
  type MessageReadingCapture,
  type MessageReadingFrame,
  type MessageReadingInput,
  type MessageReadingPolicy,
  type MessageReadingSelection,
  type MessageReadingSelectionFacts,
} from './reading-plan';

export type MessageReadingMode = 'following' | 'history' | 'interacting';
export interface MessageScrollerReadingProps {
  readingCapture?: MessageReadingCapture;
  readingInset?: number;
  readingPredecessor?: boolean;
}
export type MessageScrollerReadingExposes = {
  readingMode: ExposeState<MessageReadingMode>;
  restoringReading: ExposeState<boolean>;
  getReadingEpoch: ExposeMethod<() => number>;
  beginReading: ExposeMethod<(following: boolean, anchor: MessageReadingAnchor | null) => void>;
  syncReadingFollowing: ExposeMethod<(following: boolean) => void>;
  resumeReading: ExposeMethod<() => void>;
  readingInput: ExposeMethod<
    (input: MessageReadingInput, frame: MessageReadingFrame | null) => void
  >;
  captureReading: ExposeMethod<(frame: MessageReadingFrame) => MessageReadingAnchor | null>;
  restoreReading: ExposeMethod<(frame: MessageReadingFrame) => number>;
  commitReadingRestore: ExposeMethod<(ticket: number, frame: MessageReadingFrame) => void>;
  observeReadingScroll: ExposeMethod<(frame: MessageReadingFrame) => void>;
  readingAnchorForPersistence: ExposeMethod<
    (frame: MessageReadingFrame) => MessageReadingAnchor | null
  >;
  planSelectionRestore: ExposeMethod<(facts: MessageReadingSelectionFacts) => number>;
  commitSelectionRestore: ExposeMethod<(ticket: number) => void>;
};
export type MessageScrollerReadingAsHookContract = {
  state: { readingMode: State<MessageReadingMode>; restoringReading: State<boolean> };
};

/**
 * Opt-in stable-key reading policy over the same Scroll Surface. Host frames
 * contain facts only. This hook disables preserve-visible to leave one anchor
 * owner, and never receives native nodes, storage, text or application message objects.
 */
function setupReading(def: DefHandle<MessageScrollerReadingProps, MessageScrollerReadingExposes>) {
  const scroll = asScrollSurface();
  scroll.configure({ anchor: { mode: 'off' } });
  def.props.define({
    readingCapture: { type: 'enum', options: ['first-crossing', 'visible-preferred'] },
    readingInset: { type: 'number' },
    readingPredecessor: { type: 'boolean' },
  });
  def.props.setDefaults({
    readingCapture: 'first-crossing',
    readingInset: 0,
    readingPredecessor: true,
  });
  const mode = def.state.enum('readingMode', 'following', {
    options: ['following', 'history', 'interacting'],
  });
  const restoring = def.state.bool('restoringReading', false);
  def.expose.state('readingMode', mode);
  def.expose.state('restoringReading', restoring);

  let policy: MessageReadingPolicy = { capture: 'first-crossing', inset: 0, predecessor: true };
  let initialized = false;
  let active = false;
  let epoch = 0;
  let revision = 0;
  let requestedFollowing = true;
  let hint: MessageReadingAnchor | null = null;
  let anchor: MessageReadingAnchor | null = null;
  let lastScrollOffset: number | null = null;
  let sequence = 0;
  let pendingRestore = -1;
  let pendingSelection = -1;
  let pendingSelectionRecord: MessageReadingSelection | null = null;
  let restoredSelection: MessageReadingSelection | null = null;
  let restoringPosition = false;

  const validFrame = (frame: MessageReadingFrame) => active && frame.epoch === epoch;
  const cancelPlans = () => {
    pendingRestore = -1;
    pendingSelection = -1;
    pendingSelectionRecord = null;
    restoringPosition = false;
  };
  const retireHint = () => {
    hint = null;
    restoring.set(false, 'reader retired the initial restoration hint');
  };
  const resume = () => {
    const current = ++revision;
    cancelPlans();
    retireHint();
    if (revision !== current) return;
    anchor = null;
    requestedFollowing = true;
    mode.set('following', 'reader explicitly resumed the tail');
    if (active && revision === current) scroll.request({ kind: 'to-end', axis: 'vertical' });
  };
  const pause = (interacting: boolean) => {
    const current = revision;
    mode.set(interacting ? 'interacting' : 'history', 'reader holds a reading place');
    // A restored DOM selection is reported back as the same finite record and
    // never reaches this path again. Repeated host measurements do not pause.
    if (active && current === revision && scroll.endFollow.state.get() !== 'paused')
      scroll.pauseFollowing();
  };
  def.lifecycle.onCreated((run) => {
    const props = run.props.get();
    policy = {
      capture:
        props.readingCapture === 'visible-preferred' ? 'visible-preferred' : 'first-crossing',
      inset: Number.isFinite(props.readingInset) ? props.readingInset! : 0,
      predecessor: props.readingPredecessor !== false,
    };
  });
  def.props.watch(['readingCapture', 'readingInset', 'readingPredecessor'], (_run, props) => {
    policy = {
      capture:
        props.readingCapture === 'visible-preferred' ? 'visible-preferred' : 'first-crossing',
      inset: Number.isFinite(props.readingInset) ? props.readingInset! : 0,
      predecessor: props.readingPredecessor !== false,
    };
  });
  def.lifecycle.onMounted(() => {
    active = true;
    epoch += 1;
    revision += 1;
    lastScrollOffset = null;
    if (mode.get() !== 'following') scroll.pauseFollowing();
  });
  def.lifecycle.onUnmounted(() => {
    active = false;
    epoch += 1;
    revision += 1;
    lastScrollOffset = null;
    cancelPlans();
  });
  def.lifecycle.onBeforeDispose(() => {
    active = false;
    epoch += 1;
    revision += 1;
    cancelPlans();
  });
  scroll.endFollow.state.watch((_run, event) => {
    if (event.type !== 'next') return;
    if (event.next === 'pending' && mode.get() !== 'following') {
      if (active) scroll.pauseFollowing();
      return;
    }
    if (event.next === 'following') {
      if (restoring.get()) {
        if (active) scroll.pauseFollowing();
        return;
      }
      anchor = null;
      mode.set('following', 'shared scroll surface reports reader arrival');
    } else if (event.next === 'paused' && mode.get() === 'following') {
      mode.set('history', 'shared scroll surface reports reader departure');
    }
  });

  def.expose.method('getReadingEpoch', () => (active ? epoch : -1));
  def.expose.method('beginReading', (following, initialAnchor) => {
    if (initialized) return;
    initialized = true;
    const current = ++revision;
    requestedFollowing = following;
    hint = following ? null : initialAnchor;
    anchor = hint;
    restoring.set(hint !== null, 'initial stable-key restoration hint');
    if (revision !== current) return;
    if (following) mode.set('following', 'initial tail reading');
    else pause(false);
  });
  def.expose.method('syncReadingFollowing', (following) => {
    if (following === requestedFollowing) return;
    requestedFollowing = following;
    if (following) resume();
    else {
      revision += 1;
      pause(mode.get() === 'interacting');
    }
  });
  def.expose.method('resumeReading', resume);
  def.expose.method('readingInput', (input, frame) => {
    if (!active || !input.active || !input.inside) return;
    if (
      input.kind === 'selection' &&
      (sameMessageReadingSelection(input.selection, restoredSelection) ||
        sameMessageReadingSelection(input.selection, pendingSelectionRecord))
    )
      return;
    const current = ++revision;
    cancelPlans();
    const physical = input.kind === 'wheel' || input.kind === 'key' || input.kind === 'pointer';
    // selectionchange can result from Range replay. Pointer/key/wheel and
    // focused content/backfill are the explicit reader handoff boundaries.
    if (physical || input.kind === 'focus' || input.kind === 'backfill') retireHint();
    if (!active || current !== revision) return;
    const holdsPlace =
      input.kind === 'focus' ||
      input.kind === 'selection' ||
      input.kind === 'backfill' ||
      (input.kind === 'pointer' && input.interactive);
    if (holdsPlace) {
      pause(true);
      if (current === revision && frame && validFrame(frame) && !restoring.get()) {
        anchor = captureMessageReadingAnchor(frame, policy);
        lastScrollOffset = frame.scrollOffset;
      }
    }
  });
  def.expose.method('captureReading', (frame) => {
    if (!validFrame(frame) || mode.get() === 'following') return null;
    if (restoring.get()) return hint;
    if (policy.capture === 'first-crossing' || !anchor) {
      anchor = captureMessageReadingAnchor(frame, policy);
    }
    return anchor;
  });
  def.expose.method('restoreReading', (frame) => {
    if (!validFrame(frame) || mode.get() === 'following') return -1;
    // An initial hint survives empty materialization, predecessor/offset
    // fallback and zero-height exact matches until new reader input retires it.
    if (restoring.get() && frame.entries.length === 0) return -1;
    const target = restoring.get() ? hint : anchor;
    const plan = planMessageReadingRestore(target, frame, policy.predecessor);
    if (plan.kind !== 'by') return -1;
    if (scroll.endFollow.state.get() !== 'paused') scroll.pauseFollowing();
    if (!validFrame(frame) || mode.get() === 'following') return -1;
    const ticket = ++sequence;
    pendingRestore = ticket;
    restoringPosition = true;
    const result = scroll.request({ kind: 'by', axis: 'vertical', delta: plan.delta });
    restoringPosition = false;
    if (!validFrame(frame) || pendingRestore !== ticket || result.kind === 'rejected') {
      if (pendingRestore === ticket) pendingRestore = -1;
      return -1;
    }
    return ticket;
  });
  def.expose.method('commitReadingRestore', (ticket, frame) => {
    if (ticket < 0 || pendingRestore !== ticket || !validFrame(frame)) return;
    pendingRestore = -1;
    // The host reports the actual post-request offset. This preserves the
    // asynchronous scroll-event circuit breaker without redoing host clamping.
    lastScrollOffset = frame.scrollOffset;
    if (!restoring.get() && policy.capture === 'first-crossing') {
      anchor = captureMessageReadingAnchor(frame, policy);
    }
  });
  def.expose.method('observeReadingScroll', (frame) => {
    if (!validFrame(frame) || restoringPosition || frame.scrollOffset === lastScrollOffset) return;
    lastScrollOffset = frame.scrollOffset;
    if (mode.get() === 'following') anchor = null;
    else if (!restoring.get()) anchor = captureMessageReadingAnchor(frame, policy);
  });
  def.expose.method('readingAnchorForPersistence', (frame) => {
    if (!validFrame(frame) || mode.get() === 'following' || restoring.get()) return null;
    return captureMessageReadingAnchor(frame, policy);
  });
  def.expose.method('planSelectionRestore', (facts) => {
    if (
      !active ||
      facts.epoch !== epoch ||
      mode.get() === 'following' ||
      sameMessageReadingSelection(facts.record, restoredSelection) ||
      !messageSelectionRestoreEligible(facts)
    )
      return -1;
    pendingSelection = ++sequence;
    pendingSelectionRecord = facts.record;
    return pendingSelection;
  });
  def.expose.method('commitSelectionRestore', (ticket) => {
    if (!active || ticket < 0 || pendingSelection !== ticket) return;
    restoredSelection = pendingSelectionRecord;
    pendingSelection = -1;
    pendingSelectionRecord = null;
  });
}

export const asMessageScrollerReading = defineAsHook<
  MessageScrollerReadingProps,
  MessageScrollerReadingExposes,
  MessageScrollerReadingAsHookContract
>({ name: 'as-message-scroller-reading', setup: setupReading });
