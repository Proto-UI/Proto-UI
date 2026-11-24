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
  ScrollSurfacePositionRequest,
  ScrollSurfaceSnapshot,
} from '@proto.ui/core';
import type {
  ScrollComposedChromeHostControl,
  ScrollSurfaceHost,
  ScrollSurfaceHostAttachment,
  ScrollSurfaceHostLease,
} from '../caps';
import { createReaderContactSession } from './reader-contact-session';
import { createScrollPolicyLease } from './scroll-policy-lease';
import { revealWebScrollTarget } from './target-reveal';

export type WebScrollSurfaceHostOptions = Readonly<{
  moveGestureHost: MoveGestureHost;
  preference?: ScrollProjectionPreference;
  scrollEndDelay?: number;
  /** Host-local proximity in CSS pixels; never projected into portable facts. */
  endThreshold?: number;
  minThumbSize?: number;
  /** Binding-aware hosts opt into exclusive guarded projection ownership. */
  exclusivePolicy?: boolean;
  onPolicyLost?: () => void;
  /** Authority for deferred physical writes in a binding-aware host. */
  isCurrentBinding?: () => boolean;
}>;

type StyleEntry = readonly [value: string, priority: string];
type ScrollGeometry = Readonly<{ offset: number; viewport: number; extent: number }>;
const movedWithinLayout = (previous: ScrollGeometry, next: ScrollGeometry): boolean =>
  next.offset !== previous.offset &&
  next.viewport === previous.viewport &&
  next.extent === previous.extent;
// An opt-in styling sink for edge-aligned composed tracks, not a portable fact.
const TRACK_END_INSET = '--proto-ui-scroll-track-end-inset';
const THUMB_SIZE_VAR = '--proto-ui-scroll-thumb-size';
const THUMB_OFFSET_VAR = '--proto-ui-scroll-thumb-offset';
const THUMB_STYLE_KEYS = [
  'width',
  'height',
  'transform',
  'top',
  'left',
  'flexGrow',
  'alignSelf',
] as const;
const TRACK_MUTATION_OPTIONS: MutationObserverInit = Object.freeze({
  attributes: true,
  attributeFilter: ['class', 'style'],
});
const EXCLUSIVE_TARGET_MUTATION_OPTIONS: MutationObserverInit = Object.freeze({
  childList: true,
  attributes: true,
  attributeFilter: ['style', 'data-pui-scroll-projection'],
});
const HIDDEN_DISPLAY: StyleEntry = ['none', 'important'];
const readStyleProp = (target: HTMLElement, name: string): StyleEntry => [
  target.style.getPropertyValue(name),
  target.style.getPropertyPriority(name),
];
const writeStyleProp = (target: HTMLElement, name: string, [value, priority]: StyleEntry) => {
  if (
    target.style.getPropertyValue(name) === value &&
    target.style.getPropertyPriority(name) === priority
  )
    return;
  if (value) target.style.setProperty(name, value, priority);
  else target.style.removeProperty(name);
};
const readDisplay = (target: HTMLElement): StyleEntry => readStyleProp(target, 'display');
const writeDisplay = (target: HTMLElement, next: StyleEntry) =>
  writeStyleProp(target, 'display', next);

type ThumbStyleSnapshot = readonly [
  props: readonly string[],
  display: StyleEntry,
  sizeVar: string,
  offsetVar: string,
];

const clampRatio = (value: number) =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
// Existing discrete wheel/key classification, separate from contact lifetime.
const DISCRETE_READER_INTENT_WINDOW_MS = 250;
const horizontalSign = (target: Element): 1 | -1 =>
  target.ownerDocument.defaultView?.getComputedStyle(target).direction === 'rtl' ? -1 : 1;
const horizontalOffset = (target: HTMLElement, sign?: 1 | -1): number => {
  const raw = target.scrollLeft;
  return raw === 0 ? 0 : raw * (sign ?? horizontalSign(target));
};
const sameAxisSnapshot = (a: ScrollAxisSnapshot, b: ScrollAxisSnapshot): boolean =>
  a.position === b.position &&
  a.visibleRatio === b.visibleRatio &&
  a.canScrollBefore === b.canScrollBefore &&
  a.canScrollAfter === b.canScrollAfter &&
  a.atEnd === b.atEnd;
const sameSurfaceSnapshot = (a: ScrollSurfaceSnapshot, b: ScrollSurfaceSnapshot): boolean =>
  a.axes === b.axes &&
  a.scrolling === b.scrolling &&
  a.projection === b.projection &&
  a.endFollow.state === b.endFollow.state &&
  a.endFollow.requestStatus === b.endFollow.requestStatus &&
  sameAxisSnapshot(a.horizontal, b.horizontal) &&
  sameAxisSnapshot(a.vertical, b.vertical);
const BASE_CONTENT_OBSERVER_OPTIONS: MutationObserverInit = Object.freeze({ childList: true });
const END_FOLLOW_CONTENT_OBSERVER_OPTIONS: MutationObserverInit = Object.freeze({
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

function readMetrics(
  target: HTMLElement,
  axis: ScrollAxis,
  sign?: 1 | -1
): { offset: number; viewport: number; extent: number; range: number } {
  const h = axis === 'horizontal';
  const viewport = h ? target.clientWidth : target.clientHeight;
  const extent = h ? target.scrollWidth : target.scrollHeight;
  return {
    offset: h ? horizontalOffset(target, sign) : target.scrollTop,
    viewport,
    extent,
    range: Math.max(0, extent - viewport),
  };
}

function resolveRequestOffset(
  target: HTMLElement,
  request: ScrollSurfacePositionRequest,
  sign?: 1 | -1
): number {
  const { offset, viewport, range } = readMetrics(target, request.axis, sign);
  let next = offset;
  if (request.kind === 'by') next += request.delta;
  else if (request.kind === 'page') next += request.direction === 'after' ? viewport : -viewport;
  else if (request.kind === 'to' || request.kind === 'control-drag') {
    next = range * clampRatio(request.position);
  } else if (request.kind === 'to-end') next = range;
  return Math.min(range, Math.max(0, next));
}

function requestReachesEnd(
  target: HTMLElement,
  request: ScrollSurfacePositionRequest,
  endThreshold: number,
  sign?: 1 | -1
): boolean {
  const { range } = readMetrics(target, request.axis, sign);
  return range - resolveRequestOffset(target, request, sign) <= endThreshold;
}

function applyRequest(
  target: HTMLElement,
  request: ScrollSurfacePositionRequest,
  sign?: 1 | -1
): void {
  const horizontal = request.axis === 'horizontal';
  const dirSign = horizontal ? (sign ?? horizontalSign(target)) : 1;
  const next = resolveRequestOffset(target, request, dirSign);
  const write = () => {
    if (horizontal) target.scrollLeft = next * dirSign;
    else target.scrollTop = next;
  };
  if (request.kind !== 'to-end') {
    write();
    return;
  }
  const authored = readStyleProp(target, 'scroll-behavior');
  target.style.setProperty('scroll-behavior', 'auto', 'important');
  try {
    write();
  } finally {
    writeStyleProp(target, 'scroll-behavior', authored);
  }
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

function readTrackBox(track: HTMLElement, axis: ScrollAxis) {
  const v = axis === 'vertical';
  const style = track.ownerDocument.defaultView?.getComputedStyle(track);
  const startInset = style ? px(v ? style.paddingTop : style.paddingLeft) : 0;
  const endInset = style ? px(v ? style.paddingBottom : style.paddingRight) : 0;
  const borderStart = style ? px(v ? style.borderTopWidth : style.borderLeftWidth) : 0;
  const available = Math.max(
    0,
    (v ? track.clientHeight : track.clientWidth) - startInset - endInset
  );
  return { available, startInset, borderStart };
}

function measureControl(control: WebScrollControl, axis: ScrollAxis): ControlGeometry {
  const { trackTarget: track, thumbTarget: thumb } = control;
  const v = axis === 'vertical';
  const { available, startInset, borderStart } = readTrackBox(track, axis);
  const trackRect = track.getBoundingClientRect();
  const thumbRect = thumb.getBoundingClientRect();
  const measuredThumbExtent = v ? thumbRect.height : thumbRect.width;
  const projectedThumbExtent = px(thumb.style.getPropertyValue(THUMB_SIZE_VAR));
  const thumbExtent = Math.min(available, Math.max(0, measuredThumbExtent || projectedThumbExtent));
  return Object.freeze({
    trackStart: (v ? trackRect.top : trackRect.left) + borderStart + startInset,
    available,
    thumbExtent,
    travel: Math.max(0, available - thumbExtent),
  });
}

function measureTrackThickness(control: WebScrollControl): number {
  const track = control.trackTarget;
  const vertical = control.getAxis() === 'vertical';
  const outer = vertical ? track.offsetWidth : track.offsetHeight;
  if (!track.isConnected || outer <= 0) return 0;
  const style = track.ownerDocument.defaultView?.getComputedStyle(track);
  if (!style || style.display === 'none') return 0;
  const extent = Number.parseFloat(vertical ? style.width : style.height);
  if (!Number.isFinite(extent)) return outer;
  // Computed used lengths retain fractions and are not scaled by transforms.
  return Math.max(
    0,
    extent +
      (style.boxSizing === 'border-box'
        ? 0
        : vertical
          ? px(style.paddingLeft) +
            px(style.paddingRight) +
            px(style.borderLeftWidth) +
            px(style.borderRightWidth)
          : px(style.paddingTop) +
            px(style.paddingBottom) +
            px(style.borderTopWidth) +
            px(style.borderBottomWidth))
  );
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
      let scrollEndTimer: ReturnType<typeof setTimeout> | undefined;
      const clearScrollEndTimer = () => {
        if (scrollEndTimer === undefined) return;
        clearTimeout(scrollEndTimer);
        scrollEndTimer = undefined;
      };
      let endFollowState: ScrollEndFollowState = 'off';
      let endFollowRequestStatus: ScrollEndFollowRequestStatus = 'idle';
      let scheduledEnd: ScheduledEndMovement | null = null;
      let endFollowRequestEpoch = 0;
      let readerIntentUntil = 0;
      let readerArrivalUntil = 0;
      const readerContacts = createReaderContactSession();
      const clearReaderMovement = () => {
        readerIntentUntil = 0;
        readerArrivalUntil = 0;
        readerContacts.clearMovement();
      };
      let contactOrigin: {
        axis: ScrollAxis;
        offset: number;
        viewport: number;
        extent: number;
      } | null = null;
      let requestedDepartureAxis: ScrollAxis | null = null;
      let explicitPauseObservation: {
        axis: ScrollAxis;
        offset: number;
        viewport: number;
        extent: number;
      } | null = null;
      let lastFollowLayout: { axis: ScrollAxis; viewport: number; extent: number } | null = null;
      // Head-element identity of the scroll target's own child list. A batch that
      // inserts children and replaces this head is head growth, which is the web
      // host's evidence for content arriving above the anchor.
      let headNode: Element | null = null;
      let anchorObservation: {
        axis: ScrollAxis;
        viewport: number;
        extent: number;
        offset: number;
      } | null = null;
      let anchorHeadGrowthPending = false;
      const ownerWindow = target.ownerDocument.defaultView;
      const configuredEndThreshold = options.endThreshold ?? 1;
      const endThreshold = Number.isFinite(configuredEndThreshold)
        ? Math.max(0, configuredEndThreshold)
        : 1;
      let chromeHidden = false;
      let cachedDirSign: 1 | -1 | null = null;
      let lastFacts: ScrollSurfaceSnapshot | null = null;
      const thumbStyles = new Map<HTMLElement, ThumbStyleSnapshot>();
      const trackStyles = new Map<HTMLElement, StyleEntry>();
      const trackInsets = new Map<HTMLElement, StyleEntry>();
      const trackAvailableCache = new Map<HTMLElement, readonly [ScrollAxis, number]>();
      const projectedThumbState = new Map<
        HTMLElement,
        readonly [boolean, ScrollAxis, string, string]
      >();
      let observedResizeTargets = new Set<Element>();
      let observedTargetOpts: MutationObserverInit | null = null;
      let observedMutationTracks = new Set<HTMLElement>();
      const moveLeases = new Map<HTMLElement, MoveGestureHostLease>();
      const dragGrabOffsets = new Map<HTMLElement, number>();
      const policyLease = options.exclusivePolicy ? createScrollPolicyLease(target) : null;
      const original = {
        overflowX: target.style.overflowX,
        overflowY: target.style.overflowY,
        scrollbarWidth: target.style.scrollbarWidth,
        projection: target.getAttribute('data-pui-scroll-projection'),
      };
      const now = () => ownerWindow?.performance.now() ?? Date.now();
      const getControls = () => (connection.composedChrome?.controls ?? []).filter(isWebControl);
      const getHorizontalSign = (): 1 | -1 => {
        if (cachedDirSign === null) cachedDirSign = horizontalSign(target);
        return cachedDirSign;
      };
      const readHorizontalOffset = (): number => {
        const raw = target.scrollLeft;
        if (raw === 0) return 0;
        if (raw < 0 && cachedDirSign === 1) cachedDirSign = horizontalSign(target);
        return raw * getHorizontalSign();
      };
      const readAxis = (axis: ScrollAxis) => {
        const h = axis === 'horizontal';
        const viewport = h ? target.clientWidth : target.clientHeight;
        const extent = h ? target.scrollWidth : target.scrollHeight;
        return {
          axis,
          offset: h ? readHorizontalOffset() : target.scrollTop,
          viewport,
          extent,
          range: Math.max(0, extent - viewport),
        };
      };

      const projectPolicy = () => {
        if (policyLease) {
          policyLease.project(connection);
          return;
        }
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
            readHorizontalOffset(),
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
        const { style } = thumb;
        thumbStyles.set(thumb, [
          THUMB_STYLE_KEYS.map((key) => style[key]),
          readDisplay(thumb),
          style.getPropertyValue(THUMB_SIZE_VAR),
          style.getPropertyValue(THUMB_OFFSET_VAR),
        ]);
      };
      const restoreThumb = (thumb: HTMLElement) => {
        projectedThumbState.delete(thumb);
        const saved = thumbStyles.get(thumb);
        if (!saved) return;
        const { style } = thumb;
        THUMB_STYLE_KEYS.forEach((key, i) => {
          style[key] = saved[0][i]!;
        });
        writeDisplay(thumb, saved[1]);
        writeStyleProp(thumb, THUMB_SIZE_VAR, [saved[2], '']);
        writeStyleProp(thumb, THUMB_OFFSET_VAR, [saved[3], '']);
        thumbStyles.delete(thumb);
      };
      const restoreInactiveThumbs = (active: ReadonlySet<HTMLElement>) => {
        for (const thumb of Array.from(thumbStyles.keys())) {
          if (!active.has(thumb)) restoreThumb(thumb);
        }
      };
      const restoreTrackDisplay = (track: HTMLElement) => {
        const saved = trackStyles.get(track);
        if (saved === undefined) return;
        writeDisplay(track, saved);
        trackStyles.delete(track);
      };
      const restoreTrackInsets = (active: ReadonlySet<HTMLElement>) => {
        for (const [track, saved] of trackInsets) {
          if (active.has(track)) continue;
          writeStyleProp(track, TRACK_END_INSET, saved);
          trackInsets.delete(track);
        }
      };
      const projectTrackInsets = (controls: readonly WebScrollControl[]) => {
        let axesMask = 0;
        for (const c of controls) axesMask |= c.getAxis() === 'vertical' ? 1 : 2;
        const thickness = { vertical: 0, horizontal: 0 };
        if (axesMask === 3) {
          for (const control of controls) {
            const axis = control.getAxis();
            thickness[axis] = Math.max(thickness[axis], measureTrackThickness(control));
          }
        }
        const active = new Set<HTMLElement>();
        for (const control of controls) {
          const track = control.trackTarget;
          active.add(track);
          if (!trackInsets.has(track))
            trackInsets.set(track, readStyleProp(track, TRACK_END_INSET));
          writeStyleProp(track, TRACK_END_INSET, [
            `${thickness[control.getAxis() === 'vertical' ? 'horizontal' : 'vertical']}px`,
            '',
          ]);
        }
        restoreTrackInsets(active);
      };
      const projectComposedChrome = (facts: ScrollSurfaceSnapshot, layoutDirty = true) => {
        const controls = getControls();
        if (connection.projection !== 'composed') {
          trackAvailableCache.clear();
          projectedThumbState.clear();
          restoreTrackInsets(new Set());
          chromeHidden = true;
          const active = new Set<HTMLElement>();
          for (const { trackTarget: track, thumbTarget: thumb } of controls) {
            active.add(thumb);
            active.add(track);
            if (!trackStyles.has(track)) trackStyles.set(track, readDisplay(track));
            writeDisplay(track, HIDDEN_DISPLAY);
            rememberThumb(thumb);
            writeDisplay(thumb, HIDDEN_DISPLAY);
          }
          for (const track of Array.from(trackStyles.keys())) {
            if (!active.has(track)) restoreTrackDisplay(track);
          }
          restoreInactiveThumbs(active);
          return;
        }
        let forceLayout = layoutDirty;
        if (chromeHidden) {
          chromeHidden = false;
          forceLayout = true;
          for (const track of Array.from(trackStyles.keys())) restoreTrackDisplay(track);
        }
        if (controls.length === 0) {
          trackAvailableCache.clear();
          if (trackInsets.size > 0) restoreTrackInsets(new Set());
          if (thumbStyles.size > 0) restoreInactiveThumbs(new Set());
          return;
        }
        if (forceLayout) {
          projectTrackInsets(controls);
          trackAvailableCache.clear();
        }
        // Read phase: batch all track geometry reads before any thumb style writes.
        const plans = controls.map((control) => {
          const axis = control.getAxis();
          const track = control.trackTarget;
          const cached = trackAvailableCache.get(track);
          const available =
            cached && cached[0] === axis ? cached[1] : readTrackBox(track, axis).available;
          if (!cached || cached[0] !== axis) trackAvailableCache.set(track, [axis, available]);
          const dirSign: 1 | -1 =
            axis === 'horizontal' && available > 0 && facts.horizontal.visibleRatio < 1
              ? getHorizontalSign()
              : 1;
          return [axis, control.thumbTarget, available, dirSign] as const;
        });
        // Write phase: apply only changed thumb properties.
        const active = new Set<HTMLElement>();
        const minThumbSize = Math.max(0, options.minThumbSize ?? 18);
        for (const [axis, thumb, available, dirSign] of plans) {
          active.add(thumb);
          rememberThumb(thumb);
          const axisFacts = facts[axis];
          const prev = projectedThumbState.get(thumb);
          if (available <= 0 || axisFacts.visibleRatio >= 1) {
            if (!prev?.[0]) {
              writeDisplay(thumb, HIDDEN_DISPLAY);
              projectedThumbState.set(thumb, [true, axis, '', '']);
            }
            continue;
          }
          const thumbExtent = Math.min(
            available,
            Math.max(minThumbSize, available * clampRatio(axisFacts.visibleRatio))
          );
          const position =
            axis === 'horizontal' && dirSign < 0 ? 1 - axisFacts.position : axisFacts.position;
          const sizeStr = `${thumbExtent}px`;
          const offsetStr = `${Math.max(0, available - thumbExtent) * clampRatio(position)}px`;
          const full = !prev || prev[0] || prev[1] !== axis;
          const { style } = thumb;
          if (full) {
            const orig = thumbStyles.get(thumb);
            if (orig) writeDisplay(thumb, orig[1]);
            style.flexGrow = '0';
            style.alignSelf = 'flex-start';
            style.transform = 'none';
            if (axis === 'vertical') {
              style.width = orig?.[0][0] ?? '';
              style.height = `var(${THUMB_SIZE_VAR})`;
              style.left = orig?.[0][4] ?? '';
            } else {
              style.height = orig?.[0][1] ?? '';
              style.width = `var(${THUMB_SIZE_VAR})`;
              style.top = orig?.[0][3] ?? '';
            }
          }
          if (full || prev[2] !== sizeStr) style.setProperty(THUMB_SIZE_VAR, sizeStr);
          if (full || prev[3] !== offsetStr) {
            style.setProperty(THUMB_OFFSET_VAR, offsetStr);
            style[axis === 'vertical' ? 'top' : 'left'] = offsetStr;
          }
          projectedThumbState.set(thumb, [false, axis, sizeStr, offsetStr]);
        }
        restoreInactiveThumbs(active);
      };
      const configuredFollowAxis = (): ScrollAxis | null =>
        connection.config.endFollow.mode === 'while-at-end'
          ? connection.config.endFollow.axis
          : null;
      const isAxisEnabled = (axis: ScrollAxis) =>
        connection.config.axes === 'both' || connection.config.axes === axis;
      const readFollowLayout = (axis: ScrollAxis) => readAxis(axis);
      const isAxisAtEnd = (axis: ScrollAxis) => {
        const { offset, range } = readAxis(axis);
        const clampedOffset = Math.min(range, Math.max(0, Number.isFinite(offset) ? offset : 0));
        return range - clampedOffset <= endThreshold;
      };
      const configuredAnchorAxis = (): ScrollAxis | null =>
        connection.config.anchor?.mode === 'preserve-visible'
          ? connection.config.anchor.axis
          : null;
      const refreshHeadMarkers = () => {
        headNode = target.firstElementChild;
      };
      const readAnchorObservation = (axis: ScrollAxis) => Object.freeze(readAxis(axis));
      const syncAnchorObservation = () => {
        const axis = configuredAnchorAxis();
        anchorObservation = axis && isAxisEnabled(axis) ? readAnchorObservation(axis) : null;
      };
      // Head growth shifts the anchor down by the extent delta. Compensate only
      // while the offset is unchanged, the reader is away from the end, and the
      // end-follow lease does not already own a movement on this axis.
      const applyAnchorCompensation = (axis: ScrollAxis) => {
        const next = readAnchorObservation(axis);
        const previous =
          anchorObservation && anchorObservation.axis === axis ? anchorObservation : null;
        const headGrowth = anchorHeadGrowthPending;
        anchorHeadGrowthPending = false;
        if (
          previous &&
          next.offset === previous.offset &&
          headGrowth &&
          next.extent > previous.extent &&
          !isAxisAtEnd(axis)
        ) {
          const delta = next.extent - previous.extent;
          if (axis === 'horizontal')
            target.scrollLeft = (next.offset + delta) * getHorizontalSign();
          else target.scrollTop = next.offset + delta;
          // The baseline must record the post-compensation offset; otherwise a
          // second head-growth delivery inside the same frame sees a moved
          // offset and under-compensates by its own delta.
          anchorObservation = Object.freeze({ ...next, offset: next.offset + delta });
          return;
        }
        anchorObservation = next;
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
        explicitPauseObservation = null;
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
          if (scheduledEnd !== movement || disposed || !policyCurrent()) return;
          scheduledEnd = null;
          const currentAxis = movement.axis;
          if (!isAxisEnabled(currentAxis)) {
            endFollowState = configuredFollowAxis() ? 'paused' : 'off';
            endFollowRequestStatus = 'rejected';
            publish(false);
            return;
          }
          const dirSign = currentAxis === 'horizontal' ? getHorizontalSign() : undefined;
          applyRequest(target, { kind: 'to-end', axis: currentAxis }, dirSign);
          if (!readerContacts.active) readerIntentUntil = 0;
          const reachedEnd = isAxisAtEnd(currentAxis);
          const followAxis = configuredFollowAxis();
          if (followAxis === currentAxis) {
            lastFollowLayout = readFollowLayout(currentAxis);
            endFollowState = reachedEnd ? 'following' : 'paused';
            if (reachedEnd) readerContacts.clearMovement();
          }
          syncAnchorObservation();
          if (movement.requestEpoch === endFollowRequestEpoch) {
            endFollowRequestStatus = reachedEnd ? 'applied' : 'rejected';
          }
          publish(false);
        };
        if (ownerWindow?.requestAnimationFrame) {
          const frame = ownerWindow.requestAnimationFrame(apply);
          movement.cancel = () => ownerWindow.cancelAnimationFrame(frame);
        } else {
          const timer = setTimeout(apply, 0);
          movement.cancel = () => clearTimeout(timer);
        }
      };
      const policyCurrent = () => {
        if (disposed || options.isCurrentBinding?.() === false) return false;
        if (!policyLease || policyLease.valid()) return !disposed;
        options.onPolicyLost?.();
        return false;
      };
      const executeRequest = (request: ScrollSurfacePositionRequest, readerRequest = false) => {
        if (!policyCurrent()) return;
        const followAxis = configuredFollowAxis();
        if (request.kind === 'to-end') {
          if (followAxis && request.axis !== followAxis) {
            // Reject this request without canceling the configured axis's automatic work.
            endFollowRequestEpoch++;
            endFollowRequestStatus = 'rejected';
            publish(false);
            return;
          }
          scheduleEnd(request.axis);
          return;
        }
        const dirSign = request.axis === 'horizontal' ? getHorizontalSign() : undefined;
        const requestedAtEnd =
          followAxis === request.axis
            ? requestReachesEnd(target, request, endThreshold, dirSign)
            : null;
        // A boundary-clamped departure emits no scroll event, so the pending
        // automatic end frame must be canceled from the classified input path.
        if (scheduledEnd?.axis === request.axis) cancelScheduledEnd(true);
        if (followAxis === request.axis && explicitPauseObservation) {
          // Only host-owned control input may attribute this movement to the
          // reader. Public position commands preserve the pause and retire
          // old movement evidence without losing ownership of live contacts.
          explicitPauseObservation = readAnchorObservation(request.axis);
          if (readerRequest) {
            readerArrivalUntil = now() + DISCRETE_READER_INTENT_WINDOW_MS;
          } else {
            clearReaderMovement();
          }
        }
        applyRequest(target, request, dirSign);
        if (configuredAnchorAxis() === request.axis) syncAnchorObservation();
        if (followAxis === request.axis) {
          const atEndAfterRequest = isAxisAtEnd(request.axis);
          if (explicitPauseObservation) {
            const previous = explicitPauseObservation;
            const next = readAnchorObservation(request.axis);
            const readerArrived =
              readerRequest && atEndAfterRequest && movedWithinLayout(previous, next);
            explicitPauseObservation = readerArrived ? null : next;
          }
          const smoothMovement = ownerWindow?.getComputedStyle(target).scrollBehavior === 'smooth';
          const shouldPause =
            explicitPauseObservation !== null ||
            !atEndAfterRequest ||
            (requestedAtEnd === false && smoothMovement);
          requestedDepartureAxis = shouldPause ? request.axis : null;
          endFollowState = shouldPause ? 'paused' : 'following';
        }
        publish(false);
      };
      const createMoveBinding = (control: WebScrollControl): MoveGestureHostBinding => {
        const thumb = control.thumbTarget;
        const getAxis = () => control.getAxis();
        const applyDrag = (sample: MoveGestureSample) => {
          const axis = getAxis();
          const geometry = measureControl(control, axis);
          const grabOffset = dragGrabOffsets.get(thumb);
          if (grabOffset === undefined || geometry.travel <= 0) return;
          let position =
            (coordinate(sample, axis) - geometry.trackStart - grabOffset) / geometry.travel;
          if (axis === 'horizontal' && getHorizontalSign() < 0) position = 1 - position;
          executeRequest({ kind: 'control-drag', axis, position: clampRatio(position) }, true);
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
          for (const control of getControls()) {
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
      const publish = (layoutDirty = true) => {
        if (disposed || !policyCurrent()) return;
        const facts = snapshot();
        projectComposedChrome(facts, layoutDirty);
        if (lastFacts && sameSurfaceSnapshot(lastFacts, facts)) return;
        lastFacts = facts;
        connection.onFacts(facts);
      };
      const onLayoutChange = () => {
        if (disposed) return;
        cachedDirSign = null;
        const axis = configuredFollowAxis();
        const anchorAxis = configuredAnchorAxis();
        if (axis) {
          if (!isAxisEnabled(axis)) {
            endFollowState = 'paused';
            endFollowRequestStatus = 'rejected';
          } else {
            const nextLayout = readFollowLayout(axis);
            const layoutChanged =
              !lastFollowLayout ||
              lastFollowLayout.axis !== nextLayout.axis ||
              lastFollowLayout.viewport !== nextLayout.viewport ||
              lastFollowLayout.extent !== nextLayout.extent;
            lastFollowLayout = nextLayout;
            if (endFollowState === 'following' && (layoutChanged || !isAxisAtEnd(axis))) {
              scheduleEnd(axis);
            } else if (
              endFollowState === 'paused' &&
              requestedDepartureAxis !== axis &&
              explicitPauseObservation?.axis !== axis &&
              isAxisAtEnd(axis)
            ) {
              endFollowState = 'following';
            }
          }
        } else {
          lastFollowLayout = null;
          endFollowState = 'off';
        }
        if (anchorAxis && isAxisEnabled(anchorAxis)) {
          const followOwnsAnchor =
            axis === anchorAxis &&
            (endFollowState === 'following' ||
              endFollowState === 'pending' ||
              scheduledEnd?.axis === anchorAxis);
          if (followOwnsAnchor) {
            // The end-follow lease owns this layout window: anchor evidence is
            // consumed here, not carried into a later anchor-owned pass where
            // a non-head growth could be misread as head growth.
            anchorHeadGrowthPending = false;
            anchorObservation = readAnchorObservation(anchorAxis);
          } else applyAnchorCompensation(anchorAxis);
        } else {
          anchorObservation = null;
          anchorHeadGrowthPending = false;
        }
        if (explicitPauseObservation) {
          explicitPauseObservation = readAnchorObservation(explicitPauseObservation.axis);
        }
        publish(true);
      };
      const armReaderIntent = () => {
        requestedDepartureAxis = null;
        readerIntentUntil = now() + DISCRETE_READER_INTENT_WINDOW_MS;
      };
      // A boundary-clamped departure gesture emits no scroll event, so a
      // pending follow frame must not wait for one to be canceled. Input
      // that can still move the surface keeps the deadline-only path.
      const cancelUnscrollableDeparture = (axis: ScrollAxis) => {
        if (!isAxisEnabled(axis) || isAxisAtEnd(axis) || !scheduledEnd) return;
        if (readAxis(axis).offset > 0) return;
        cancelScheduledEnd(true);
        endFollowState = 'paused';
        requestedDepartureAxis = null;
        publish(false);
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
          const v = axis === 'vertical';
          const overflow = v ? style.overflowY : style.overflowX;
          if (
            (overflow === 'auto' || overflow === 'scroll') &&
            (v
              ? node.scrollHeight > node.clientHeight && node.scrollTop > 0
              : node.scrollWidth > node.clientWidth &&
                horizontalOffset(node as HTMLElement, style.direction === 'rtl' ? -1 : 1) > 0)
          ) {
            return true;
          }
        }
        return false;
      };
      const hasReaderIntent = () => {
        const axis = configuredFollowAxis();
        return (axis !== null && readerContacts.hasDeparture(axis)) || readerIntentUntil > now();
      };
      const onWheel = (event: WheelEvent) => {
        if (event.ctrlKey || event.defaultPrevented) return;
        const axis = configuredFollowAxis();
        if (!axis) return;
        const dirSign = axis === 'horizontal' ? getHorizontalSign() : 1;
        const delta =
          axis === 'vertical'
            ? event.deltaY
            : (event.deltaX || (event.shiftKey ? event.deltaY : 0)) * dirSign;
        if (delta === 0) return;
        readerArrivalUntil = now() + DISCRETE_READER_INTENT_WINDOW_MS;
        requestedDepartureAxis = null;
        const leavingEnd =
          axis === 'vertical'
            ? event.deltaY < 0
            : event.deltaX * dirSign < 0 || (event.shiftKey && event.deltaY * dirSign < 0);
        if (!leavingEnd) return;
        if (findDepartureConsumer(event, axis)) return;
        armReaderIntent();
        cancelUnscrollableDeparture(axis);
      };
      const beginContact = () => {
        const axis = configuredFollowAxis();
        if (!readerContacts.active && axis) contactOrigin = readAxis(axis);
        readerIntentUntil = 0;
        readerArrivalUntil = 0;
        requestedDepartureAxis = null;
      };
      const onPointerDown = (event: PointerEvent) => {
        beginContact();
        readerContacts.startPointer(event.pointerId, event.pointerType, {
          x: event.clientX * getHorizontalSign(),
          y: event.clientY,
        });
      };
      const onPointerMove = (event: PointerEvent) => {
        sampleContactDeparture();
        readerContacts.movePointer(event.pointerId, {
          x: event.clientX * getHorizontalSign(),
          y: event.clientY,
        });
      };
      const onTouchStart = (event: TouchEvent) => {
        const owned = Array.from(event.changedTouches).filter((touch) =>
          target.contains(touch.target as Node)
        );
        if (owned.length === 0) return;
        beginContact();
        const dirSign = getHorizontalSign();
        readerContacts.startTouches(
          owned.map((touch) => touch.identifier),
          owned.map((touch) => ({ x: touch.clientX * dirSign, y: touch.clientY }))
        );
      };
      const onTouchMove = (event: TouchEvent) => {
        sampleContactDeparture();
        const dirSign = getHorizontalSign();
        for (const touch of Array.from(event.changedTouches)) {
          readerContacts.moveTouch(touch.identifier, {
            x: touch.clientX * dirSign,
            y: touch.clientY,
          });
        }
      };
      const completeReaderIntent = () => {
        readerIntentUntil = 0;
      };
      const sampleContactDeparture = () => {
        const axis = configuredFollowAxis();
        const moved = axis !== null && readerContacts.hasDeparture(axis);
        if (moved && contactOrigin && axis === contactOrigin.axis && isAxisEnabled(axis)) {
          const cur = readAxis(axis);
          if (
            cur.viewport === contactOrigin.viewport &&
            cur.extent === contactOrigin.extent &&
            cur.offset < contactOrigin.offset &&
            !isAxisAtEnd(axis)
          ) {
            cancelScheduledEnd(true);
            endFollowState = 'paused';
            requestedDepartureAxis = null;
            publish(false);
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
        readerArrivalUntil = 0;
      };
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.defaultPrevented) return;
        const axis = configuredFollowAxis();
        if (!axis) return;
        const k = event.key;
        const v = axis === 'vertical';
        const beforeKey = v ? 'ArrowUp' : getHorizontalSign() < 0 ? 'ArrowRight' : 'ArrowLeft';
        const afterKey = v ? 'ArrowDown' : getHorizontalSign() < 0 ? 'ArrowLeft' : 'ArrowRight';
        const scrollDirection =
          k === beforeKey || k === 'PageUp' || k === 'Home' || (v && k === ' ' && event.shiftKey)
            ? 'before'
            : k === afterKey ||
                k === 'PageDown' ||
                k === 'End' ||
                (v && k === ' ' && !event.shiftKey)
              ? 'after'
              : null;
        if (!scrollDirection) return;
        readerArrivalUntil = now() + DISCRETE_READER_INTENT_WINDOW_MS;
        requestedDepartureAxis = null;
        if (scrollDirection === 'before') {
          if (findDepartureConsumer(event, axis)) return;
          armReaderIntent();
          cancelUnscrollableDeparture(axis);
        }
      };
      const onScrollEnd = () => {
        scrollEndTimer = undefined;
        scrolling = false;
        publish(false);
      };
      const onScroll = () => {
        scrolling = true;
        const readerIntent = hasReaderIntent();
        const axis = configuredFollowAxis();
        if (axis && isAxisEnabled(axis)) {
          const atEnd = isAxisAtEnd(axis);
          if (explicitPauseObservation?.axis === axis) {
            const next = readAnchorObservation(axis);
            const moved = movedWithinLayout(explicitPauseObservation, next);
            const readerArrival = readerArrivalUntil > now() || readerContacts.hasMovement(axis);
            explicitPauseObservation = atEnd && moved && readerArrival ? null : next;
          }
          const requestedDeparture =
            requestedDepartureAxis === axis || explicitPauseObservation?.axis === axis;
          if (atEnd && !scheduledEnd && !requestedDeparture) {
            if (endFollowState === 'paused') readerContacts.clearMovement();
            endFollowState = 'following';
          } else if (!atEnd && (readerIntent || requestedDeparture)) {
            cancelScheduledEnd(true);
            endFollowState = 'paused';
            readerIntentUntil = 0;
            requestedDepartureAxis = null;
          }
        }
        syncAnchorObservation();
        publish(false);
        clearScrollEndTimer();
        scrollEndTimer = setTimeout(onScrollEnd, options.scrollEndDelay ?? 120);
      };
      const onContentReflow = () => {
        if (configuredFollowAxis() || configuredAnchorAxis()) onLayoutChange();
      };
      const fontFaceSet: FontFaceSet | undefined = target.ownerDocument.fonts;
      let observingFonts = false;
      const reconcileFontObservation = () => {
        if (!fontFaceSet || typeof fontFaceSet.addEventListener !== 'function') return;
        const shouldObserve = configuredFollowAxis() !== null || configuredAnchorAxis() !== null;
        if (shouldObserve === observingFonts) return;
        fontFaceSet[shouldObserve ? 'addEventListener' : 'removeEventListener'](
          'loadingdone',
          onContentReflow
        );
        observingFonts = shouldObserve;
      };

      const PASSIVE = { passive: true } as const;
      type ListenerEntry = readonly [
        EventTarget | null | undefined,
        string,
        EventListener,
        (AddEventListenerOptions | boolean)?,
      ];
      const baseListeners: readonly ListenerEntry[] = [
        [target, 'scroll', onScroll, PASSIVE],
        [target, 'load', onContentReflow, true],
        [target, 'transitionend', onContentReflow, true],
        [target, 'transitioncancel', onContentReflow, true],
        [target, 'animationend', onContentReflow, true],
        [target, 'animationcancel', onContentReflow, true],
        [ownerWindow, 'blur', resetReaderInput],
        [ownerWindow, 'resize', onLayoutChange],
      ];
      const gestureListeners: readonly ListenerEntry[] = [
        [target, 'wheel', onWheel as EventListener, PASSIVE],
        [target, 'pointerdown', onPointerDown as EventListener, PASSIVE],
        [ownerWindow, 'pointermove', onPointerMove as EventListener, PASSIVE],
        [ownerWindow, 'pointerup', onPointerUp as EventListener, PASSIVE],
        [ownerWindow, 'pointercancel', onPointerCancel as EventListener, PASSIVE],
        [target, 'touchstart', onTouchStart as EventListener, PASSIVE],
        [ownerWindow, 'touchmove', onTouchMove as EventListener, PASSIVE],
        [ownerWindow, 'touchend', onTouchEnd as EventListener, PASSIVE],
        [ownerWindow, 'touchcancel', onTouchEnd as EventListener, PASSIVE],
        [target, 'keydown', onKeyDown as EventListener],
        [ownerWindow, 'keyup', completeReaderIntent],
      ];
      const removeListener = ([el, type, fn, opt]: ListenerEntry) =>
        el?.removeEventListener(type, fn, typeof opt === 'boolean' ? opt : undefined);

      let observingGestures = false;
      const reconcileGestureObservation = () => {
        const shouldObserve = configuredFollowAxis() !== null;
        if (shouldObserve === observingGestures) return;
        if (shouldObserve) {
          for (const [el, type, fn, opt] of gestureListeners) el?.addEventListener(type, fn, opt);
        } else {
          resetReaderInput();
          for (const entry of gestureListeners) removeListener(entry);
        }
        observingGestures = shouldObserve;
      };
      let resizeObserver: ResizeObserver | undefined;
      let mutationObserver: MutationObserver | undefined;
      const onMutation = (records: MutationRecord[]) => {
        if (disposed) return;
        if (configuredAnchorAxis() !== null) {
          const inserted = records.some(
            (record) =>
              record.type === 'childList' &&
              record.target === target &&
              record.addedNodes.length > 0
          );
          if (inserted && headNode && target.firstElementChild !== headNode)
            anchorHeadGrowthPending = true;
        }
        refreshHeadMarkers();
        if (records.some((record) => record.type === 'childList' && record.target === target)) {
          observeGeometry();
        }
        onLayoutChange();
      };
      function observeGeometry() {
        refreshHeadMarkers();
        const controls = getControls();
        if (resizeObserver) {
          const nextResize = new Set<Element>([target]);
          for (let child = target.firstElementChild; child; child = child.nextElementSibling) {
            nextResize.add(child);
          }
          for (const control of controls) nextResize.add(control.trackTarget);
          const hasUnobserve = typeof resizeObserver.unobserve === 'function';
          let reset = false;
          for (const previous of observedResizeTargets) {
            if (nextResize.has(previous)) continue;
            if (hasUnobserve) resizeObserver.unobserve(previous);
            else {
              reset = true;
              break;
            }
          }
          if (reset) {
            resizeObserver.disconnect();
            observedResizeTargets.clear();
          }
          for (const next of nextResize) {
            if (!observedResizeTargets.has(next)) resizeObserver.observe(next);
          }
          observedResizeTargets = nextResize;
        }
        if (mutationObserver) {
          const nextOpts = configuredFollowAxis()
            ? END_FOLLOW_CONTENT_OBSERVER_OPTIONS
            : options.exclusivePolicy
              ? EXCLUSIVE_TARGET_MUTATION_OPTIONS
              : BASE_CONTENT_OBSERVER_OPTIONS;
          const nextTracks = new Set(controls.map((control) => control.trackTarget));
          const tracksChanged =
            nextTracks.size !== observedMutationTracks.size ||
            controls.some((control) => !observedMutationTracks.has(control.trackTarget));
          if (nextOpts !== observedTargetOpts || tracksChanged) {
            mutationObserver.disconnect();
            mutationObserver.observe(target, nextOpts);
            for (const track of nextTracks) mutationObserver.observe(track, TRACK_MUTATION_OPTIONS);
            observedTargetOpts = nextOpts;
            observedMutationTracks = nextTracks;
          }
        }
      }
      const resetEndFollow = () => {
        resetReaderInput();
        cancelScheduledEnd(false);
        requestedDepartureAxis = null;
        explicitPauseObservation = null;
        syncAnchorObservation();
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
      const dispose = () => {
        if (disposed) return;
        disposed = true;
        let failed = false;
        let failure: unknown;
        const attempt = (action: () => void) => {
          try {
            action();
          } catch (error) {
            if (!failed) {
              failed = true;
              failure = error;
            }
          }
        };
        attempt(resetReaderInput);
        requestedDepartureAxis = null;
        explicitPauseObservation = null;
        anchorObservation = null;
        anchorHeadGrowthPending = false;
        headNode = null;
        cachedDirSign = null;
        lastFacts = null;
        attempt(() => cancelScheduledEnd(false));
        attempt(clearScrollEndTimer);
        for (const entry of baseListeners) attempt(() => removeListener(entry));
        for (const entry of gestureListeners) attempt(() => removeListener(entry));
        if (observingFonts) {
          observingFonts = false;
          attempt(() => fontFaceSet?.removeEventListener('loadingdone', onContentReflow));
        }
        attempt(() => resizeObserver?.disconnect());
        attempt(() => mutationObserver?.disconnect());
        observedResizeTargets.clear();
        observedMutationTracks.clear();
        observedTargetOpts = null;
        trackAvailableCache.clear();
        projectedThumbState.clear();
        const leases = Array.from(moveLeases.values());
        moveLeases.clear();
        for (const lease of leases) attempt(() => lease.dispose());
        dragGrabOffsets.clear();
        attempt(() => restoreInactiveThumbs(new Set()));
        attempt(() => restoreTrackInsets(new Set()));
        for (const track of Array.from(trackStyles.keys()))
          attempt(() => restoreTrackDisplay(track));
        if (policyLease) attempt(() => policyLease.release());
        else {
          for (const fn of [
            () => {
              target.style.overflowX = original.overflowX;
            },
            () => {
              target.style.overflowY = original.overflowY;
            },
            () => {
              target.style.scrollbarWidth = original.scrollbarWidth;
            },
            () => {
              if (original.projection === null)
                target.removeAttribute('data-pui-scroll-projection');
              else target.setAttribute('data-pui-scroll-projection', original.projection);
            },
          ])
            attempt(fn);
        }
        if (failed) throw failure;
      };
      try {
        for (const [el, type, fn, opt] of baseListeners) el?.addEventListener(type, fn, opt);
        const Resize = ownerWindow?.ResizeObserver;
        const Mutation = ownerWindow?.MutationObserver;
        resizeObserver = typeof Resize === 'function' ? new Resize(onLayoutChange) : undefined;
        mutationObserver = typeof Mutation === 'function' ? new Mutation(onMutation) : undefined;
        projectPolicy();
        reconcileMoveGestures();
        observeGeometry();
        reconcileFontObservation();
        reconcileGestureObservation();
        resetEndFollow();
      } catch (error) {
        try {
          dispose();
        } catch {
          /* preserve the initiating acquisition failure */
        }
        throw error;
      }

      return {
        update(nextConnection: ScrollSurfaceHostAttachment) {
          if (disposed || !policyCurrent()) return;
          const previousAxis = configuredFollowAxis();
          const previousAxes = connection.config.axes;
          const previousOnFacts = connection.onFacts;
          connection = nextConnection;
          if (nextConnection.onFacts !== previousOnFacts) lastFacts = null;
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
        pauseFollowing() {
          if (disposed || !policyCurrent()) return false;
          const axis = configuredFollowAxis();
          if (!axis || !isAxisEnabled(axis)) return false;
          cancelScheduledEnd(true);
          clearReaderMovement();
          endFollowState = 'paused';
          // Input intent alone cannot resume: a reader must actually arrive at
          // the end. Keep an observation through stationary contact, editing,
          // other-axis input and reflow without changing the reader's anchor.
          requestedDepartureAxis = axis;
          explicitPauseObservation = readAnchorObservation(axis);
          syncAnchorObservation();
          publish(false);
          return !disposed && policyCurrent();
        },
        reveal(subject, axis, isCurrentTarget) {
          if (axis !== 'vertical' || !isAxisEnabled(axis)) return false;
          const current = () => policyCurrent() && isCurrentTarget() && policyCurrent();
          const accepted = revealWebScrollTarget(target, subject, current, () => {
            if (scheduledEnd?.axis === axis) cancelScheduledEnd(true);
          });
          if (!accepted || !current()) return false;
          if (configuredFollowAxis() === axis) {
            if (explicitPauseObservation) {
              clearReaderMovement();
              explicitPauseObservation = readAnchorObservation(axis);
            }
            const atEnd = isAxisAtEnd(axis);
            const shouldPause = explicitPauseObservation !== null || !atEnd;
            requestedDepartureAxis = shouldPause ? axis : null;
            endFollowState = shouldPause ? 'paused' : 'following';
          }
          publish(false);
          return current();
        },
        dispose,
      };
    },
  };
}
