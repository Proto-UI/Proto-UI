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

export type WebScrollSurfaceHostOptions = Readonly<{
  moveGestureHost: MoveGestureHost;
  preference?: ScrollProjectionPreference;
  scrollEndDelay?: number;
  /** Host-local proximity in CSS pixels; never projected into portable facts. */
  endThreshold?: number;
  minThumbSize?: number;
}>;

type ThumbStyleSnapshot = Readonly<{
  width: string;
  height: string;
  transform: string;
  display: string;
  sizeVar: string;
  offsetVar: string;
}>;

const clampRatio = (value: number) =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
const READER_INTENT_WINDOW_MS = 250;
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

function applyRequest(target: HTMLElement, request: ScrollSurfaceRequest): void {
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
  next = Math.min(range, Math.max(0, next));
  if (request.kind === 'to-end') {
    const authoredScrollBehavior = target.style.scrollBehavior;
    target.style.scrollBehavior = 'auto';
    try {
      if (horizontal) target.scrollLeft = next;
      else target.scrollTop = next;
    } finally {
      target.style.scrollBehavior = authoredScrollBehavior;
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
      let cancelEndFollowFrame: (() => void) | null = null;
      let scheduledAxis: ScrollAxis | null = null;
      let endFollowPending = false;
      let readerIntentUntil = 0;
      let readerGestureActive = false;
      let lastFollowLayout: { axis: ScrollAxis; viewport: number; extent: number } | null = null;
      const ownerWindow = target.ownerDocument.defaultView;
      const configuredEndThreshold = options.endThreshold ?? 1;
      const endThreshold = Number.isFinite(configuredEndThreshold)
        ? Math.max(0, configuredEndThreshold)
        : 1;
      const thumbStyles = new Map<HTMLElement, ThumbStyleSnapshot>();
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
            display: thumb.style.display,
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
        thumb.style.display = original.display;
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
      const projectComposedChrome = (facts: ScrollSurfaceSnapshot) => {
        const active = new Set<HTMLElement>();
        if (connection.projection !== 'composed') {
          restoreInactiveThumbs(active);
          return;
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
            thumb.style.display = 'none';
            continue;
          }

          const minThumbSize = Math.max(0, options.minThumbSize ?? 18);
          const thumbExtent = Math.min(
            available,
            Math.max(minThumbSize, available * clampRatio(axisFacts.visibleRatio))
          );
          const offset = Math.max(0, available - thumbExtent) * clampRatio(axisFacts.position);
          const originalThumbStyle = thumbStyles.get(thumb);
          thumb.style.display = originalThumbStyle?.display ?? '';
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
        const pending = endFollowPending;
        cancelEndFollowFrame?.();
        cancelEndFollowFrame = null;
        endFollowPending = false;
        scheduledAxis = null;
        if (pending && rejected) endFollowRequestStatus = 'rejected';
        return pending;
      };
      const scheduleEnd = (axis: ScrollAxis) => {
        if (disposed) return;
        if (!isAxisEnabled(axis)) {
          endFollowRequestStatus = 'rejected';
          publish();
          return;
        }
        if (endFollowPending && scheduledAxis === axis) {
          if (configuredFollowAxis() === axis) endFollowState = 'pending';
          endFollowRequestStatus = 'pending';
          publish();
          return;
        }
        cancelScheduledEnd(false);
        scheduledAxis = axis;
        endFollowPending = true;
        if (configuredFollowAxis() === axis) endFollowState = 'pending';
        endFollowRequestStatus = 'pending';
        publish();
        if (!endFollowPending || scheduledAxis !== axis || disposed) return;
        const apply = () => {
          cancelEndFollowFrame = null;
          endFollowPending = false;
          const currentAxis = scheduledAxis;
          scheduledAxis = null;
          if (disposed || !currentAxis) return;
          if (!isAxisEnabled(currentAxis)) {
            endFollowState = configuredFollowAxis() ? 'paused' : 'off';
            endFollowRequestStatus = 'rejected';
            publish();
            return;
          }
          applyRequest(target, { kind: 'to-end', axis: currentAxis });
          if (!readerGestureActive) readerIntentUntil = 0;
          const reachedEnd = isAxisAtEnd(currentAxis);
          const followAxis = configuredFollowAxis();
          if (followAxis === currentAxis) {
            lastFollowLayout = readFollowLayout(currentAxis);
            endFollowState = reachedEnd ? 'following' : 'paused';
          }
          endFollowRequestStatus = reachedEnd ? 'applied' : 'rejected';
          publish();
        };
        if (ownerWindow?.requestAnimationFrame) {
          const frame = ownerWindow.requestAnimationFrame(apply);
          cancelEndFollowFrame = () => ownerWindow.cancelAnimationFrame(frame);
        } else {
          const timer = setTimeout(apply, 0);
          cancelEndFollowFrame = () => clearTimeout(timer);
        }
      };
      const executeRequest = (request: ScrollSurfaceRequest) => {
        const followAxis = configuredFollowAxis();
        if (request.kind === 'to-end') {
          if (followAxis && request.axis !== followAxis) {
            endFollowRequestStatus = 'rejected';
            publish();
            return;
          }
          scheduleEnd(request.axis);
          return;
        }
        if (scheduledAxis === request.axis) cancelScheduledEnd(true);
        applyRequest(target, request);
        if (followAxis === request.axis) {
          endFollowState = isAxisAtEnd(followAxis) ? 'following' : 'paused';
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
        if (layoutChanged && endFollowState === 'following') {
          scheduleEnd(axis);
          return;
        }
        if (endFollowState === 'paused' && isAxisAtEnd(axis)) {
          endFollowState = 'following';
        }
        publish();
      };
      const interruptPendingFollow = () => {
        if (!cancelScheduledEnd(true)) return;
        endFollowState = configuredFollowAxis() ? 'paused' : 'off';
        publish();
      };
      const armReaderIntent = () => {
        const now = ownerWindow?.performance.now() ?? Date.now();
        readerIntentUntil = now + READER_INTENT_WINDOW_MS;
      };
      const hasReaderIntent = () => {
        const now = ownerWindow?.performance.now() ?? Date.now();
        return readerGestureActive || readerIntentUntil >= now;
      };
      const onWheel = (event: WheelEvent) => {
        if (event.ctrlKey) return;
        const axis = configuredFollowAxis();
        if (!axis) return;
        const leavingEnd =
          axis === 'vertical'
            ? event.deltaY < 0
            : event.deltaX < 0 || (event.shiftKey && event.deltaY < 0);
        if (!leavingEnd) return;
        armReaderIntent();
      };
      const onPointerDown = () => {
        readerGestureActive = true;
        armReaderIntent();
      };
      const onTouchStart = () => {
        readerGestureActive = true;
        armReaderIntent();
      };
      const onReaderIntentEnd = () => {
        readerGestureActive = false;
        readerIntentUntil = 0;
      };
      const onKeyDown = (event: KeyboardEvent) => {
        const axis = configuredFollowAxis();
        if (!axis) return;
        const leavingEnd =
          axis === 'vertical'
            ? event.key === 'ArrowUp' ||
              event.key === 'PageUp' ||
              event.key === 'Home' ||
              (event.key === ' ' && event.shiftKey)
            : event.key === 'ArrowLeft' || event.key === 'PageUp' || event.key === 'Home';
        if (!leavingEnd) return;
        armReaderIntent();
      };
      const onScroll = () => {
        scrolling = true;
        const readerIntent = hasReaderIntent();
        const axis = configuredFollowAxis();
        if (axis && isAxisEnabled(axis)) {
          const atEnd = isAxisAtEnd(axis);
          if (atEnd && !endFollowPending) {
            endFollowState = 'following';
          } else if (!atEnd && readerIntent) {
            cancelScheduledEnd(true);
            endFollowState = 'paused';
            readerIntentUntil = 0;
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
      target.addEventListener('scroll', onScroll, { passive: true });
      target.addEventListener('load', onContentReflow, true);
      target.addEventListener('transitionend', onContentReflow, true);
      target.addEventListener('animationend', onContentReflow, true);
      target.addEventListener('wheel', onWheel, { passive: true });
      target.addEventListener('pointerdown', onPointerDown, { passive: true });
      ownerWindow?.addEventListener('pointerup', onReaderIntentEnd, { passive: true });
      ownerWindow?.addEventListener('pointercancel', onReaderIntentEnd, { passive: true });
      target.addEventListener('touchstart', onTouchStart, { passive: true });
      ownerWindow?.addEventListener('touchend', onReaderIntentEnd, { passive: true });
      ownerWindow?.addEventListener('touchcancel', onReaderIntentEnd, { passive: true });
      target.addEventListener('keydown', onKeyDown);
      ownerWindow?.addEventListener('keyup', onReaderIntentEnd);
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
        cancelScheduledEnd(false);
        lastFollowLayout = null;
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
          readerGestureActive = false;
          readerIntentUntil = 0;
          cancelScheduledEnd(false);
          cancelScrollEndTimer?.();
          target.removeEventListener('scroll', onScroll);
          target.removeEventListener('load', onContentReflow, true);
          target.removeEventListener('transitionend', onContentReflow, true);
          target.removeEventListener('animationend', onContentReflow, true);
          target.removeEventListener('wheel', onWheel);
          target.removeEventListener('pointerdown', onPointerDown);
          ownerWindow?.removeEventListener('pointerup', onReaderIntentEnd);
          ownerWindow?.removeEventListener('pointercancel', onReaderIntentEnd);
          target.removeEventListener('touchstart', onTouchStart);
          ownerWindow?.removeEventListener('touchend', onReaderIntentEnd);
          ownerWindow?.removeEventListener('touchcancel', onReaderIntentEnd);
          target.removeEventListener('keydown', onKeyDown);
          ownerWindow?.removeEventListener('keyup', onReaderIntentEnd);
          ownerWindow?.removeEventListener('resize', onLayoutChange);
          resizeObserver?.disconnect();
          mutationObserver?.disconnect();
          for (const lease of moveLeases.values()) lease.dispose();
          moveLeases.clear();
          dragGrabOffsets.clear();
          restoreInactiveThumbs(new Set());
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
