import type {
  MoveGestureHost,
  MoveGestureHostBinding,
  MoveGestureHostLease,
  MoveGestureSample,
  ScrollAxis,
  ScrollAxisSnapshot,
  ScrollEndFollowRequestStatus,
  ScrollEndFollowState,
  ScrollProjectionPreference,
  ScrollSurfaceRequest,
  ScrollSurfaceSnapshot,
} from '@proto.ui/core';
import type {
  ScrollComposedChromeHostControl,
  ScrollSurfaceHost,
  ScrollSurfaceHostAttachment,
  ScrollSurfaceHostLease,
} from '../caps';
import { createReaderContactSession } from './reader-contact-session';

export type WebScrollSurfaceHostOptions = Readonly<{
  moveGestureHost: MoveGestureHost;
  preference?: ScrollProjectionPreference;
  scrollEndDelay?: number;
  /** Host-local proximity in CSS pixels; never projected into portable facts. */
  endThreshold?: number;
  minThumbSize?: number;
}>;

type DisplayStyle = Readonly<{ value: string; priority: string }>;
const hiddenDisplay: DisplayStyle = { value: 'none', priority: 'important' };
const readDisplay = (target: HTMLElement): DisplayStyle => ({
  value: target.style.getPropertyValue('display'),
  priority: target.style.getPropertyPriority('display'),
});
const writeDisplay = (target: HTMLElement, next: DisplayStyle) => {
  const current = readDisplay(target);
  if (current.value === next.value && current.priority === next.priority) return;
  if (next.value) target.style.setProperty('display', next.value, next.priority);
  else target.style.removeProperty('display');
};

type ThumbStyleSnapshot = Readonly<{
  width: string;
  height: string;
  transform: string;
  display: DisplayStyle;
  sizeVar: string;
  offsetVar: string;
}>;

const clampRatio = (value: number) =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
// Existing discrete wheel/key classification, separate from contact lifetime.
const DISCRETE_READER_INTENT_WINDOW_MS = 250;
const BASE_CONTENT_OBSERVER_OPTIONS = Object.freeze({ childList: true });
const END_FOLLOW_CONTENT_OBSERVER_OPTIONS = Object.freeze({
  attributes: true,
  characterData: true,
  childList: true,
  subtree: true,
});

function axisSnapshot(
  offset: number,
  viewport: number,
  extent: number,
  endThreshold: number
): ScrollAxisSnapshot {
  const range = Math.max(0, extent - viewport);
  const clampedOffset = Math.min(range, Math.max(0, Number.isFinite(offset) ? offset : 0));
  return Object.freeze({
    position: range > 0 ? clampRatio(clampedOffset / range) : 0,
    visibleRatio: extent > 0 ? clampRatio(viewport / extent) : 1,
    canScrollBefore: clampedOffset > 0,
    canScrollAfter: clampedOffset < range,
    atEnd: range - clampedOffset <= endThreshold,
  });
}

function resolveRequestOffset(target: HTMLElement, request: ScrollSurfaceRequest): number {
  const horizontal = request.axis === 'horizontal';
  const viewport = horizontal ? target.clientWidth : target.clientHeight;
  const extent = horizontal ? target.scrollWidth : target.scrollHeight;
  const range = Math.max(0, extent - viewport);
  const current = horizontal ? target.scrollLeft : target.scrollTop;
  let next = current;
  if (request.kind === 'by') next += request.delta;
  if (request.kind === 'page') next += request.direction === 'after' ? viewport : -viewport;
  if (request.kind === 'to' || request.kind === 'control-drag') {
    next = range * clampRatio(request.position);
  }
  if (request.kind === 'to-end') next = range;
  return Math.min(range, Math.max(0, next));
}

function requestReachesEnd(
  target: HTMLElement,
  request: ScrollSurfaceRequest,
  endThreshold: number
): boolean {
  const horizontal = request.axis === 'horizontal';
  const viewport = horizontal ? target.clientWidth : target.clientHeight;
  const extent = horizontal ? target.scrollWidth : target.scrollHeight;
  const range = Math.max(0, extent - viewport);
  return range - resolveRequestOffset(target, request) <= endThreshold;
}

function applyRequest(target: HTMLElement, request: ScrollSurfaceRequest): void {
  const horizontal = request.axis === 'horizontal';
  const next = resolveRequestOffset(target, request);
  if (request.kind === 'to-end') {
    const authoredScrollBehavior = target.style.getPropertyValue('scroll-behavior');
    const authoredScrollBehaviorPriority = target.style.getPropertyPriority('scroll-behavior');
    target.style.setProperty('scroll-behavior', 'auto', 'important');
    try {
      if (horizontal) target.scrollLeft = next;
      else target.scrollTop = next;
    } finally {
      if (authoredScrollBehavior) {
        target.style.setProperty(
          'scroll-behavior',
          authoredScrollBehavior,
          authoredScrollBehaviorPriority
        );
      } else {
        target.style.removeProperty('scroll-behavior');
      }
    }
    return;
  }
  if (horizontal) target.scrollLeft = next;
  else target.scrollTop = next;
}

function px(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isWebControl(
  control: ScrollComposedChromeHostControl
): control is ScrollComposedChromeHostControl & {
  trackTarget: HTMLElement;
  thumbTarget: HTMLElement;
} {
  return control.trackTarget instanceof HTMLElement && control.thumbTarget instanceof HTMLElement;
}

type WebScrollControl = ScrollComposedChromeHostControl & {
  trackTarget: HTMLElement;
  thumbTarget: HTMLElement;
};

type ControlGeometry = Readonly<{
  trackStart: number;
  available: number;
  thumbExtent: number;
  travel: number;
}>;

type ScheduledEndMovement = {
  axis: ScrollAxis;
  requestEpoch: number;
  cancel: (() => void) | null;
};

function coordinate(sample: MoveGestureSample, axis: ScrollAxis): number {
  return axis === 'vertical' ? sample.position.y : sample.position.x;
}

function measureControl(control: WebScrollControl, axis: ScrollAxis): ControlGeometry {
  const track = control.trackTarget;
  const thumb = control.thumbTarget;
  const ownerWindow = track.ownerDocument.defaultView;
  const style = ownerWindow?.getComputedStyle(track);
  const trackRect = track.getBoundingClientRect();
  const thumbRect = thumb.getBoundingClientRect();
  const trackExtent = axis === 'vertical' ? track.clientHeight : track.clientWidth;
  const startInset = style ? px(axis === 'vertical' ? style.paddingTop : style.paddingLeft) : 0;
  const endInset = style ? px(axis === 'vertical' ? style.paddingBottom : style.paddingRight) : 0;
  const borderStart = style
    ? px(axis === 'vertical' ? style.borderTopWidth : style.borderLeftWidth)
    : 0;
  const available = Math.max(0, trackExtent - startInset - endInset);
  const measuredThumbExtent = axis === 'vertical' ? thumbRect.height : thumbRect.width;
  const projectedThumbExtent = px(thumb.style.getPropertyValue('--proto-ui-scroll-thumb-size'));
  const thumbExtent = Math.min(available, Math.max(0, measuredThumbExtent || projectedThumbExtent));
  const trackStart =
    (axis === 'vertical' ? trackRect.top : trackRect.left) + borderStart + startInset;
  return Object.freeze({
    trackStart,
    available,
    thumbExtent,
    travel: Math.max(0, available - thumbExtent),
  });
}

export function createWebScrollSurfaceHost(
  target: HTMLElement,
  options: WebScrollSurfaceHostOptions
): ScrollSurfaceHost {
  return {
    support: Object.freeze({ system: true, composed: true }),
    preference: options.preference ?? 'auto',
    attach(initialConnection): ScrollSurfaceHostLease {
      let connection = initialConnection;
      let disposed = false;
      let scrolling = false;
      let cancelScrollEndTimer: (() => void) | null = null;
      let endFollowState: ScrollEndFollowState = 'off';
      let endFollowRequestStatus: ScrollEndFollowRequestStatus = 'idle';
      let scheduledEnd: ScheduledEndMovement | null = null;
      let endFollowRequestEpoch = 0;
      let readerIntentUntil = 0;
      const readerContacts = createReaderContactSession();
      let contactOrigin: {
        axis: ScrollAxis;
        offset: number;
        viewport: number;
        extent: number;
      } | null = null;
      let requestedDepartureAxis: ScrollAxis | null = null;
      let lastFollowLayout: { axis: ScrollAxis; viewport: number; extent: number } | null = null;
      const ownerWindow = target.ownerDocument.defaultView;
      const configuredEndThreshold = options.endThreshold ?? 1;
      const endThreshold = Number.isFinite(configuredEndThreshold)
        ? Math.max(0, configuredEndThreshold)
        : 1;
      let endTimer: ReturnType<typeof setTimeout> | undefined;
      let chromeHidden = false;
      const thumbStyles = new Map<HTMLElement, ThumbStyleSnapshot>();
      const trackStyles = new Map<HTMLElement, DisplayStyle>();
      const moveLeases = new Map<HTMLElement, MoveGestureHostLease>();
      const dragGrabOffsets = new Map<HTMLElement, number>();
      const original = {
        overflowX: target.style.overflowX,
        overflowY: target.style.overflowY,
        scrollbarWidth: target.style.scrollbarWidth,
        projection: target.getAttribute('data-pui-scroll-projection'),
      };

      const projectPolicy = () => {
        const axes = connection.config.axes;
        target.style.overflowX = axes === 'vertical' ? 'hidden' : 'auto';
        target.style.overflowY = axes === 'horizontal' ? 'hidden' : 'auto';
        target.style.scrollbarWidth = connection.projection === 'composed' ? 'none' : '';
        target.setAttribute('data-pui-scroll-projection', connection.projection);
      };
      const snapshot = (): ScrollSurfaceSnapshot =>
        Object.freeze({
          axes: connection.config.axes,
          horizontal: axisSnapshot(
            target.scrollLeft,
            target.clientWidth,
            target.scrollWidth,
            endThreshold
          ),
          vertical: axisSnapshot(
            target.scrollTop,
            target.clientHeight,
            target.scrollHeight,
            endThreshold
          ),
          scrolling,
          projection: connection.projection,
          endFollow: Object.freeze({
            state: endFollowState,
            requestStatus: endFollowRequestStatus,
          }),
        });
      const rememberThumb = (thumb: HTMLElement) => {
        if (thumbStyles.has(thumb)) return;
        thumbStyles.set(
          thumb,
          Object.freeze({
            width: thumb.style.width,
            height: thumb.style.height,
            transform: thumb.style.transform,
            display: readDisplay(thumb),
            sizeVar: thumb.style.getPropertyValue('--proto-ui-scroll-thumb-size'),
            offsetVar: thumb.style.getPropertyValue('--proto-ui-scroll-thumb-offset'),
          })
        );
      };
      const restoreThumb = (thumb: HTMLElement) => {
        const original = thumbStyles.get(thumb);
        if (!original) return;
        thumb.style.width = original.width;
        thumb.style.height = original.height;
        thumb.style.transform = original.transform;
        writeDisplay(thumb, original.display);
        if (original.sizeVar) {
          thumb.style.setProperty('--proto-ui-scroll-thumb-size', original.sizeVar);
        } else {
          thumb.style.removeProperty('--proto-ui-scroll-thumb-size');
        }
        if (original.offsetVar) {
          thumb.style.setProperty('--proto-ui-scroll-thumb-offset', original.offsetVar);
        } else {
          thumb.style.removeProperty('--proto-ui-scroll-thumb-offset');
        }
        thumbStyles.delete(thumb);
      };
      const restoreInactiveThumbs = (active: ReadonlySet<HTMLElement>) => {
        for (const thumb of Array.from(thumbStyles.keys())) {
          if (!active.has(thumb)) restoreThumb(thumb);
        }
      };
      const restoreTrackDisplay = (track: HTMLElement) => {
        const original = trackStyles.get(track);
        if (original === undefined) return;
        writeDisplay(track, original);
        trackStyles.delete(track);
      };
      const projectComposedChrome = (facts: ScrollSurfaceSnapshot) => {
        if (connection.projection !== 'composed') {
          // Hide authored Scrollbar/Thumb chrome while the host projects the
          // system scrollbar. Reconciled against the current controls on every
          // pass so controls attached or replaced after the fallback starts
          // are hidden too: the track (touch-none absolute element) would
          // otherwise intercept pointer input over the native scrollbar, and
          // the Thumb (flex-1 bg-border) would paint over it.
          chromeHidden = true;
          const active = new Set<HTMLElement>();
          for (const control of connection.composedChrome?.controls ?? []) {
            if (!isWebControl(control)) continue;
            const track = control.trackTarget;
            const thumb = control.thumbTarget;
            active.add(thumb);
            active.add(track);
            if (!trackStyles.has(track)) {
              trackStyles.set(track, readDisplay(track));
            }
            writeDisplay(track, hiddenDisplay);
            if (!thumbStyles.has(thumb)) {
              rememberThumb(thumb);
            }
            writeDisplay(thumb, hiddenDisplay);
          }
          for (const track of Array.from(trackStyles.keys())) {
            if (active.has(track)) continue;
            restoreTrackDisplay(track);
          }
          restoreInactiveThumbs(active);
          return;
        }
        const active = new Set<HTMLElement>();
        // Restore authored chrome visibility when the host re-projects composed.
        if (chromeHidden) {
          chromeHidden = false;
          for (const track of Array.from(trackStyles.keys())) {
            restoreTrackDisplay(track);
          }
          // Thumb display is restored by restoreInactiveThumbs below when
          // the thumb is no longer active, or by the composed projection
          // loop when the thumb is active.
        }
        for (const control of connection.composedChrome?.controls ?? []) {
          if (!isWebControl(control)) continue;
          const axis = control.getAxis();
          const track = control.trackTarget;
          const thumb = control.thumbTarget;
          active.add(thumb);
          rememberThumb(thumb);

          const axisFacts = facts[axis];
          const geometry = measureControl(control, axis);
          const available = geometry.available;

          if (available <= 0 || axisFacts.visibleRatio >= 1) {
            writeDisplay(thumb, hiddenDisplay);
            continue;
          }

          const minThumbSize = Math.max(0, options.minThumbSize ?? 18);
          const thumbExtent = Math.min(
            available,
            Math.max(minThumbSize, available * clampRatio(axisFacts.visibleRatio))
          );
          const offset = Math.max(0, available - thumbExtent) * clampRatio(axisFacts.position);
          const originalThumbStyle = thumbStyles.get(thumb);
          if (originalThumbStyle) writeDisplay(thumb, originalThumbStyle.display);
          thumb.style.setProperty('--proto-ui-scroll-thumb-size', `${thumbExtent}px`);
          thumb.style.setProperty('--proto-ui-scroll-thumb-offset', `${offset}px`);
          if (axis === 'vertical') {
            thumb.style.width = originalThumbStyle?.width ?? '';
            thumb.style.height = 'var(--proto-ui-scroll-thumb-size)';
            thumb.style.transform = 'translate3d(0, var(--proto-ui-scroll-thumb-offset), 0)';
          } else {
            thumb.style.height = originalThumbStyle?.height ?? '';
            thumb.style.width = 'var(--proto-ui-scroll-thumb-size)';
            thumb.style.transform = 'translate3d(var(--proto-ui-scroll-thumb-offset), 0, 0)';
          }
        }
        restoreInactiveThumbs(active);
      };
      const configuredFollowAxis = (): ScrollAxis | null =>
        connection.config.endFollow.mode === 'while-at-end'
          ? connection.config.endFollow.axis
          : null;
      const isAxisEnabled = (axis: ScrollAxis) =>
        connection.config.axes === 'both' || connection.config.axes === axis;
      const readFollowLayout = (axis: ScrollAxis) =>
        axis === 'horizontal'
          ? { axis, viewport: target.clientWidth, extent: target.scrollWidth }
          : { axis, viewport: target.clientHeight, extent: target.scrollHeight };
      const isAxisAtEnd = (axis: ScrollAxis) => {
        const horizontal = axis === 'horizontal';
        const offset = horizontal ? target.scrollLeft : target.scrollTop;
        const viewport = horizontal ? target.clientWidth : target.clientHeight;
        const extent = horizontal ? target.scrollWidth : target.scrollHeight;
        const range = Math.max(0, extent - viewport);
        const clampedOffset = Math.min(range, Math.max(0, Number.isFinite(offset) ? offset : 0));
        return range - clampedOffset <= endThreshold;
      };
      const cancelScheduledEnd = (rejected: boolean) => {
        const pending = scheduledEnd;
        scheduledEnd = null;
        pending?.cancel?.();
        if (pending) endFollowRequestEpoch++;
        if (pending && rejected) endFollowRequestStatus = 'rejected';
        return pending !== null;
      };
      const scheduleEnd = (axis: ScrollAxis) => {
        requestedDepartureAxis = null;
        if (disposed) return;
        if (!isAxisEnabled(axis)) {
          cancelScheduledEnd(false);
          endFollowRequestEpoch++;
          endFollowRequestStatus = 'rejected';
          publish();
          return;
        }
        cancelScheduledEnd(false);
        const movement: ScheduledEndMovement = {
          axis,
          requestEpoch: ++endFollowRequestEpoch,
          cancel: null,
        };
        scheduledEnd = movement;
        if (configuredFollowAxis() === axis) endFollowState = 'pending';
        endFollowRequestStatus = 'pending';
        publish();
        if (scheduledEnd !== movement || disposed) return;
        const apply = () => {
          if (scheduledEnd !== movement || disposed) return;
          scheduledEnd = null;
          const currentAxis = movement.axis;
          if (!isAxisEnabled(currentAxis)) {
            endFollowState = configuredFollowAxis() ? 'paused' : 'off';
            endFollowRequestStatus = 'rejected';
            publish();
            return;
          }
          applyRequest(target, { kind: 'to-end', axis: currentAxis });
          if (!readerContacts.active) readerIntentUntil = 0;
          const reachedEnd = isAxisAtEnd(currentAxis);
          const followAxis = configuredFollowAxis();
          if (followAxis === currentAxis) {
            lastFollowLayout = readFollowLayout(currentAxis);
            endFollowState = reachedEnd ? 'following' : 'paused';
            if (reachedEnd) readerContacts.clearMovement();
          }
          if (movement.requestEpoch === endFollowRequestEpoch) {
            endFollowRequestStatus = reachedEnd ? 'applied' : 'rejected';
          }
          publish();
        };
        if (ownerWindow?.requestAnimationFrame) {
          const frame = ownerWindow.requestAnimationFrame(apply);
          movement.cancel = () => ownerWindow.cancelAnimationFrame(frame);
        } else {
          const timer = setTimeout(apply, 0);
          movement.cancel = () => clearTimeout(timer);
        }
      };
      const executeRequest = (request: ScrollSurfaceRequest) => {
        const followAxis = configuredFollowAxis();
        if (request.kind === 'to-end') {
          if (followAxis && request.axis !== followAxis) {
            // Reject this request without canceling the configured axis's automatic work.
            endFollowRequestEpoch++;
            endFollowRequestStatus = 'rejected';
            publish();
            return;
          }
          scheduleEnd(request.axis);
          return;
        }
        const requestedAtEnd =
          followAxis === request.axis ? requestReachesEnd(target, request, endThreshold) : null;
        // A boundary-clamped departure emits no scroll event, so the pending
        // automatic end frame must be canceled from the classified input path.
        if (scheduledEnd?.axis === request.axis) cancelScheduledEnd(true);
        applyRequest(target, request);
        if (followAxis === request.axis) {
          const atEndAfterRequest = isAxisAtEnd(request.axis);
          const smoothMovement = ownerWindow?.getComputedStyle(target).scrollBehavior === 'smooth';
          const shouldPause = !atEndAfterRequest || (requestedAtEnd === false && smoothMovement);
          requestedDepartureAxis = shouldPause ? request.axis : null;
          endFollowState = shouldPause ? 'paused' : 'following';
        }
        publish();
      };
      const createMoveBinding = (control: WebScrollControl): MoveGestureHostBinding => {
        const thumb = control.thumbTarget;
        const getAxis = () => control.getAxis();
        const applyDrag = (sample: MoveGestureSample) => {
          const axis = getAxis();
          const geometry = measureControl(control, axis);
          const grabOffset = dragGrabOffsets.get(thumb);
          if (grabOffset === undefined || geometry.travel <= 0) return;
          const position =
            (coordinate(sample, axis) - geometry.trackStart - grabOffset) / geometry.travel;
          executeRequest({ kind: 'control-drag', axis, position: clampRatio(position) });
        };
        return Object.freeze({
          target: thumb,
          axis: getAxis(),
          activation: 'immediate',
          shouldStart: () => {
            if (connection.projection !== 'composed') return false;
            const axis = getAxis();
            const facts = snapshot()[axis];
            const geometry = measureControl(control, axis);
            return (
              thumb.isConnected &&
              control.trackTarget.isConnected &&
              thumb.style.display !== 'none' &&
              facts.visibleRatio < 1 &&
              geometry.travel > 0
            );
          },
          onStart: (sample: MoveGestureSample) => {
            const axis = getAxis();
            const thumbRect = thumb.getBoundingClientRect();
            const thumbStart = axis === 'vertical' ? thumbRect.top : thumbRect.left;
            const thumbExtent = axis === 'vertical' ? thumbRect.height : thumbRect.width;
            dragGrabOffsets.set(
              thumb,
              Math.min(Math.max(0, thumbExtent), Math.max(0, coordinate(sample, axis) - thumbStart))
            );
          },
          onMove: applyDrag,
          onEnd: (sample: MoveGestureSample) => {
            applyDrag(sample);
            dragGrabOffsets.delete(thumb);
          },
          onCancel: () => dragGrabOffsets.delete(thumb),
        });
      };
      const reconcileMoveGestures = () => {
        const active = new Set<HTMLElement>();
        if (connection.projection === 'composed') {
          for (const control of connection.composedChrome?.controls ?? []) {
            if (!isWebControl(control)) continue;
            const thumb = control.thumbTarget;
            active.add(thumb);
            const binding = createMoveBinding(control);
            const lease = moveLeases.get(thumb);
            if (lease) lease.update(binding);
            else moveLeases.set(thumb, options.moveGestureHost.attach(binding));
          }
        }
        for (const [thumb, lease] of Array.from(moveLeases.entries())) {
          if (active.has(thumb)) continue;
          lease.dispose();
          moveLeases.delete(thumb);
          dragGrabOffsets.delete(thumb);
        }
      };
      const publish = () => {
        if (disposed) return;
        const facts = snapshot();
        projectComposedChrome(facts);
        connection.onFacts(facts);
      };
      const onLayoutChange = () => {
        if (disposed) return;
        const axis = configuredFollowAxis();
        if (!axis) {
          lastFollowLayout = null;
          endFollowState = 'off';
          publish();
          return;
        }
        if (!isAxisEnabled(axis)) {
          endFollowState = 'paused';
          endFollowRequestStatus = 'rejected';
          publish();
          return;
        }
        const nextLayout = readFollowLayout(axis);
        const layoutChanged =
          !lastFollowLayout ||
          lastFollowLayout.axis !== nextLayout.axis ||
          lastFollowLayout.viewport !== nextLayout.viewport ||
          lastFollowLayout.extent !== nextLayout.extent;
        lastFollowLayout = nextLayout;
        if (endFollowState === 'following' && (layoutChanged || !isAxisAtEnd(axis))) {
          scheduleEnd(axis);
          return;
        }
        if (endFollowState === 'paused' && requestedDepartureAxis !== axis && isAxisAtEnd(axis)) {
          endFollowState = 'following';
        }
        publish();
      };
      const armReaderIntent = () => {
        requestedDepartureAxis = null;
        const now = ownerWindow?.performance.now() ?? Date.now();
        readerIntentUntil = now + DISCRETE_READER_INTENT_WINDOW_MS;
      };
      // A boundary-clamped departure gesture emits no scroll event, so a
      // pending follow frame must not wait for one to be canceled. Input
      // that can still move the surface keeps the deadline-only path.
      const cancelUnscrollableDeparture = (axis: ScrollAxis) => {
        if (!isAxisEnabled(axis) || isAxisAtEnd(axis) || !scheduledEnd) return;
        const offset = axis === 'horizontal' ? target.scrollLeft : target.scrollTop;
        if (offset > 0) return;
        cancelScheduledEnd(true);
        endFollowState = 'paused';
        requestedDepartureAxis = null;
        publish();
      };
      // Bubbled wheel/key input is evidence for this surface only when no
      // intervening scrollable on the composed path can still consume the
      // departure direction; scroll chaining hands such input to the
      // descendant and the outer surface never moves. The real classification
      // then arrives with the outer surface's own scroll event.
      const findDepartureConsumer = (event: Event, axis: ScrollAxis): boolean => {
        if (typeof event.composedPath !== 'function') return false;
        for (const node of event.composedPath()) {
          if (node === target) return false;
          if (!(node instanceof Element)) continue;
          const style = ownerWindow?.getComputedStyle(node);
          if (!style) continue;
          if (axis === 'vertical') {
            const overflow = style.overflowY;
            if (
              (overflow === 'auto' || overflow === 'scroll') &&
              node.scrollHeight > node.clientHeight &&
              node.scrollTop > 0
            ) {
              return true;
            }
          } else {
            const overflow = style.overflowX;
            if (
              (overflow === 'auto' || overflow === 'scroll') &&
              node.scrollWidth > node.clientWidth &&
              node.scrollLeft > 0
            ) {
              return true;
            }
          }
        }
        return false;
      };
      const hasReaderIntent = () => {
        const now = ownerWindow?.performance.now() ?? Date.now();
        const axis = configuredFollowAxis();
        return (axis !== null && readerContacts.hasDeparture(axis)) || readerIntentUntil > now;
      };
      const onWheel = (event: WheelEvent) => {
        if (event.ctrlKey || event.defaultPrevented) return;
        const axis = configuredFollowAxis();
        if (!axis) return;
        requestedDepartureAxis = null;
        const leavingEnd =
          axis === 'vertical'
            ? event.deltaY < 0
            : event.deltaX < 0 || (event.shiftKey && event.deltaY < 0);
        if (!leavingEnd) return;
        if (findDepartureConsumer(event, axis)) return;
        armReaderIntent();
        cancelUnscrollableDeparture(axis);
      };
      const beginContact = () => {
        const axis = configuredFollowAxis();
        if (!readerContacts.active && axis) {
          contactOrigin = {
            ...readFollowLayout(axis),
            offset: axis === 'horizontal' ? target.scrollLeft : target.scrollTop,
          };
        }
        readerIntentUntil = 0;
        requestedDepartureAxis = null;
      };
      const onPointerDown = (event: PointerEvent) => {
        beginContact();
        readerContacts.startPointer(event.pointerId, event.pointerType, {
          x: event.clientX,
          y: event.clientY,
        });
      };
      const onPointerMove = (event: PointerEvent) => {
        sampleContactDeparture();
        readerContacts.movePointer(event.pointerId, { x: event.clientX, y: event.clientY });
      };
      const onTouchStart = (event: TouchEvent) => {
        const owned = Array.from(event.changedTouches).filter((touch) =>
          target.contains(touch.target as Node)
        );
        if (owned.length === 0) return;
        beginContact();
        readerContacts.startTouches(
          owned.map((touch) => touch.identifier),
          owned.map((touch) => ({ x: touch.clientX, y: touch.clientY }))
        );
      };
      const onTouchMove = (event: TouchEvent) => {
        sampleContactDeparture();
        for (const touch of Array.from(event.changedTouches)) {
          readerContacts.moveTouch(touch.identifier, { x: touch.clientX, y: touch.clientY });
        }
      };
      const completeReaderIntent = () => {
        readerIntentUntil = 0;
      };
      const sampleContactDeparture = () => {
        const axis = configuredFollowAxis();
        const moved = axis !== null && readerContacts.hasDeparture(axis);
        if (moved && contactOrigin && axis === contactOrigin.axis && isAxisEnabled(axis)) {
          const layout = readFollowLayout(axis);
          const offset = axis === 'horizontal' ? target.scrollLeft : target.scrollTop;
          // Sample movement already applied during this session before its
          // scroll event arrives. A later callback cannot reopen the session.
          // Neither stationary contact nor reflow alone is input displacement.
          if (
            layout.viewport === contactOrigin.viewport &&
            layout.extent === contactOrigin.extent &&
            offset < contactOrigin.offset &&
            !isAxisAtEnd(axis)
          ) {
            cancelScheduledEnd(true);
            endFollowState = 'paused';
            requestedDepartureAxis = null;
            publish();
          }
        }
      };
      const finishContact = (release: () => boolean) => {
        sampleContactDeparture();
        release();
        if (!readerContacts.active) contactOrigin = null;
      };
      const onPointerUp = (event: PointerEvent) => {
        finishContact(() => readerContacts.finishPointer(event.pointerId, false));
      };
      const onPointerCancel = (event: PointerEvent) => {
        finishContact(() => readerContacts.finishPointer(event.pointerId, true));
      };
      // Both terminal TouchEvents close owned contacts. Native pointer handoff
      // remains active only while an owned touch session actually survives.
      const onTouchEnd = (event: TouchEvent) => {
        finishContact(() =>
          readerContacts.finishTouches(
            Array.from(event.changedTouches, (touch) => touch.identifier),
            Array.from(event.touches, (touch) => touch.identifier)
          )
        );
      };
      const resetReaderInput = () => {
        readerContacts.reset();
        contactOrigin = null;
        readerIntentUntil = 0;
      };
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.defaultPrevented) return;
        const axis = configuredFollowAxis();
        if (!axis) return;
        const scrollDirection =
          axis === 'vertical'
            ? event.key === 'ArrowUp' ||
              event.key === 'PageUp' ||
              event.key === 'Home' ||
              (event.key === ' ' && event.shiftKey)
              ? 'before'
              : event.key === 'ArrowDown' ||
                  event.key === 'PageDown' ||
                  event.key === 'End' ||
                  (event.key === ' ' && !event.shiftKey)
                ? 'after'
                : null
            : event.key === 'ArrowLeft' || event.key === 'PageUp' || event.key === 'Home'
              ? 'before'
              : event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === 'End'
                ? 'after'
                : null;
        if (!scrollDirection) return;
        requestedDepartureAxis = null;
        if (scrollDirection === 'before') {
          if (findDepartureConsumer(event, axis)) return;
          armReaderIntent();
          cancelUnscrollableDeparture(axis);
        }
      };
      const onScroll = () => {
        scrolling = true;
        const readerIntent = hasReaderIntent();
        const axis = configuredFollowAxis();
        if (axis && isAxisEnabled(axis)) {
          const atEnd = isAxisAtEnd(axis);
          const requestedDeparture = requestedDepartureAxis === axis;
          if (atEnd && !scheduledEnd && !requestedDeparture) {
            // A scroll callback for another axis at the unchanged followed end
            // is not an arrival; retain evidence for pending native delivery.
            if (endFollowState === 'paused') readerContacts.clearMovement();
            endFollowState = 'following';
          } else if (!atEnd && (readerIntent || requestedDeparture)) {
            cancelScheduledEnd(true);
            endFollowState = 'paused';
            readerIntentUntil = 0;
            requestedDepartureAxis = null;
          }
        }
        publish();
        cancelScrollEndTimer?.();
        const timer = setTimeout(() => {
          scrolling = false;
          publish();
        }, options.scrollEndDelay ?? 120);
        cancelScrollEndTimer = () => clearTimeout(timer);
      };
      const onContentReflow = () => {
        if (configuredFollowAxis()) onLayoutChange();
      };
      const fontFaceSet: FontFaceSet | undefined = target.ownerDocument.fonts;
      let observingFonts = false;
      const reconcileFontObservation = () => {
        if (!fontFaceSet || typeof fontFaceSet.addEventListener !== 'function') return;
        const shouldObserve = configuredFollowAxis() !== null;
        if (shouldObserve && !observingFonts) {
          fontFaceSet.addEventListener('loadingdone', onContentReflow);
          observingFonts = true;
        } else if (!shouldObserve && observingFonts) {
          fontFaceSet.removeEventListener('loadingdone', onContentReflow);
          observingFonts = false;
        }
      };
      target.addEventListener('scroll', onScroll, { passive: true });
      target.addEventListener('load', onContentReflow, true);
      target.addEventListener('transitionend', onContentReflow, true);
      target.addEventListener('transitioncancel', onContentReflow, true);
      target.addEventListener('animationend', onContentReflow, true);
      target.addEventListener('animationcancel', onContentReflow, true);
      let observingGestures = false;
      // Reader-input listeners exist only while a follow axis is configured,
      // so an ordinary Scroll Area never fans window movement events through
      // every attached surface. Same reconcile discipline as font observation.
      const reconcileGestureObservation = () => {
        const shouldObserve = configuredFollowAxis() !== null;
        if (shouldObserve === observingGestures) return;
        if (shouldObserve) {
          target.addEventListener('wheel', onWheel, { passive: true });
          target.addEventListener('pointerdown', onPointerDown, { passive: true });
          ownerWindow?.addEventListener('pointermove', onPointerMove, { passive: true });
          ownerWindow?.addEventListener('pointerup', onPointerUp, { passive: true });
          ownerWindow?.addEventListener('pointercancel', onPointerCancel, { passive: true });
          target.addEventListener('touchstart', onTouchStart, { passive: true });
          ownerWindow?.addEventListener('touchmove', onTouchMove, { passive: true });
          ownerWindow?.addEventListener('touchend', onTouchEnd, { passive: true });
          ownerWindow?.addEventListener('touchcancel', onTouchEnd, { passive: true });
          target.addEventListener('keydown', onKeyDown);
          ownerWindow?.addEventListener('keyup', completeReaderIntent);
          observingGestures = true;
          return;
        }
        resetReaderInput();
        target.removeEventListener('wheel', onWheel);
        target.removeEventListener('pointerdown', onPointerDown);
        ownerWindow?.removeEventListener('pointermove', onPointerMove);
        ownerWindow?.removeEventListener('pointerup', onPointerUp);
        ownerWindow?.removeEventListener('pointercancel', onPointerCancel);
        target.removeEventListener('touchstart', onTouchStart);
        ownerWindow?.removeEventListener('touchmove', onTouchMove);
        ownerWindow?.removeEventListener('touchend', onTouchEnd);
        ownerWindow?.removeEventListener('touchcancel', onTouchEnd);
        target.removeEventListener('keydown', onKeyDown);
        ownerWindow?.removeEventListener('keyup', completeReaderIntent);
        observingGestures = false;
      };
      ownerWindow?.addEventListener('blur', resetReaderInput);
      const resizeObserver =
        typeof ResizeObserver === 'function' ? new ResizeObserver(onLayoutChange) : undefined;
      const mutationObserver =
        typeof MutationObserver === 'function'
          ? new MutationObserver((records) => {
              if (disposed) return;
              if (
                records.some((record) => record.type === 'childList' && record.target === target)
              ) {
                observeGeometry();
              }
              onLayoutChange();
            })
          : undefined;
      function observeGeometry() {
        resizeObserver?.disconnect();
        mutationObserver?.disconnect();
        resizeObserver?.observe(target);
        for (const contentTarget of Array.from(target.children)) {
          resizeObserver?.observe(contentTarget);
        }
        mutationObserver?.observe(
          target,
          configuredFollowAxis()
            ? END_FOLLOW_CONTENT_OBSERVER_OPTIONS
            : BASE_CONTENT_OBSERVER_OPTIONS
        );
        for (const control of connection.composedChrome?.controls ?? []) {
          if (!isWebControl(control)) continue;
          resizeObserver?.observe(control.trackTarget);
          mutationObserver?.observe(control.trackTarget, {
            attributes: true,
            attributeFilter: ['class', 'style'],
          });
        }
      }
      const resetEndFollow = () => {
        resetReaderInput();
        cancelScheduledEnd(false);
        requestedDepartureAxis = null;
        const axis = configuredFollowAxis();
        if (!axis) {
          endFollowState = 'off';
          endFollowRequestStatus = 'idle';
          publish();
          return;
        }
        if (!isAxisEnabled(axis)) {
          endFollowState = 'paused';
          endFollowRequestStatus = 'rejected';
          publish();
          return;
        }
        lastFollowLayout = readFollowLayout(axis);
        scheduleEnd(axis);
      };
      ownerWindow?.addEventListener('resize', onLayoutChange);
      projectPolicy();
      reconcileMoveGestures();
      observeGeometry();
      reconcileFontObservation();
      reconcileGestureObservation();
      resetEndFollow();

      return {
        update(nextConnection: ScrollSurfaceHostAttachment) {
          if (disposed) return;
          const previousAxis = configuredFollowAxis();
          const previousAxes = connection.config.axes;
          connection = nextConnection;
          projectPolicy();
          reconcileMoveGestures();
          observeGeometry();
          reconcileFontObservation();
          reconcileGestureObservation();
          if (previousAxis !== configuredFollowAxis() || previousAxes !== connection.config.axes) {
            resetEndFollow();
          } else {
            onLayoutChange();
          }
        },
        request(request) {
          if (disposed) return;
          executeRequest(request);
        },
        dispose() {
          if (disposed) return;
          disposed = true;
          resetReaderInput();
          requestedDepartureAxis = null;
          cancelScheduledEnd(false);
          cancelScrollEndTimer?.();
          target.removeEventListener('scroll', onScroll);
          target.removeEventListener('load', onContentReflow, true);
          target.removeEventListener('transitionend', onContentReflow, true);
          target.removeEventListener('transitioncancel', onContentReflow, true);
          target.removeEventListener('animationend', onContentReflow, true);
          target.removeEventListener('animationcancel', onContentReflow, true);
          target.removeEventListener('wheel', onWheel);
          target.removeEventListener('pointerdown', onPointerDown);
          ownerWindow?.removeEventListener('pointermove', onPointerMove);
          ownerWindow?.removeEventListener('pointerup', onPointerUp);
          ownerWindow?.removeEventListener('pointercancel', onPointerCancel);
          target.removeEventListener('touchstart', onTouchStart);
          ownerWindow?.removeEventListener('touchmove', onTouchMove);
          ownerWindow?.removeEventListener('touchend', onTouchEnd);
          ownerWindow?.removeEventListener('touchcancel', onTouchEnd);
          target.removeEventListener('keydown', onKeyDown);
          ownerWindow?.removeEventListener('keyup', completeReaderIntent);
          ownerWindow?.removeEventListener('blur', resetReaderInput);
          ownerWindow?.removeEventListener('resize', onLayoutChange);
          if (observingFonts) {
            fontFaceSet?.removeEventListener('loadingdone', onContentReflow);
            observingFonts = false;
          }
          resizeObserver?.disconnect();
          mutationObserver?.disconnect();
          for (const lease of moveLeases.values()) lease.dispose();
          moveLeases.clear();
          dragGrabOffsets.clear();
          restoreInactiveThumbs(new Set());
          for (const track of Array.from(trackStyles.keys())) {
            restoreTrackDisplay(track);
          }
          target.style.overflowX = original.overflowX;
          target.style.overflowY = original.overflowY;
          target.style.scrollbarWidth = original.scrollbarWidth;
          if (original.projection === null) target.removeAttribute('data-pui-scroll-projection');
          else target.setAttribute('data-pui-scroll-projection', original.projection);
        },
      };
    },
  };
}
