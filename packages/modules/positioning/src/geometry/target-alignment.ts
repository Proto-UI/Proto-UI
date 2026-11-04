/** Internal, platform-independent numerical plans. C-TARGET-ALIGNMENT-PLAN-0001.
 * Hosts supply facts and apply/read back constraints; this file never measures a host.
 * Internal mechanism; target hosts supply facts and consume its plans.
 */
import type { TargetAlignmentConstraints } from '@proto.ui/core';
export type { TargetAlignmentConstraints } from '@proto.ui/core';

export type TargetAlignmentMetrics = Readonly<{
  direction: 'ltr' | 'rtl';
  viewport: Readonly<{ width: number; height: number }>;
  reference: Readonly<{
    left: number;
    right: number;
    top: number;
    width: number;
    height: number;
    valueLeft: number;
    valueRight: number;
  }>;
  surface: Readonly<{
    left: number;
    right: number;
    width: number;
    clientHeight: number;
    borderTop: number;
    borderBottom: number;
    paddingTop: number;
    paddingBottom: number;
  }>;
  target: Readonly<{
    textLeft: number;
    textRight: number;
    offset: number;
    height: number;
    atStart: boolean;
    atEnd: boolean;
    /** Optional measured outer chrome needed to retain a requested row border box. */
    minimumOuterInlineSpan?: number;
  }>;
  scrollport: Readonly<{
    scrollHeight: number;
    offsetTop: number;
    height: number;
    paddingTop: number;
    paddingBottom: number;
  }>;
}>;

export type TargetAlignmentPlan = Readonly<{
  inline: Readonly<{ edge: 'left' | 'right'; inset: number; minimumSpan: number }>;
  block: Readonly<{
    pin: 'start' | 'end';
    margin: number;
    requestedSpan: number;
    minimumSpan: number;
    maximumSpan: number;
  }>;
  contentAlignment: 'normal';
  /** Omitted means no write, not a request to reset retained scroll to zero. */
  requestedScroll?: number;
}>;

type Invalid = Readonly<{
  kind: 'invalid';
  reason: 'nonfinite-fact' | 'invalid-extent' | 'invalid-constraint' | 'nonfinite-plan';
}>;
export type TargetAlignmentResult = Invalid | Readonly<{ kind: 'plan'; plan: TargetAlignmentPlan }>;
const invalid = (reason: Invalid['reason']): Invalid => Object.freeze({ kind: 'invalid', reason });
const finite = (numbers: readonly number[]) => numbers.every(Number.isFinite);
const nonnegative = (numbers: readonly number[]) => numbers.every((value) => value >= 0);
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

export function solveTargetAlignment(
  metrics: TargetAlignmentMetrics,
  constraints: TargetAlignmentConstraints
): TargetAlignmentResult {
  const { viewport: v, reference: a, surface: c, target: t, scrollport: s } = metrics;
  const facts = [
    ...Object.values(v),
    ...Object.values(a),
    ...Object.values(c),
    t.textLeft,
    t.textRight,
    t.offset,
    t.height,
    ...(t.minimumOuterInlineSpan === undefined ? [] : [t.minimumOuterInlineSpan]),
    ...Object.values(s),
  ];
  if (!finite(facts)) return invalid('nonfinite-fact');
  if (
    v.width <= 0 ||
    v.height <= 0 ||
    t.height <= 0 ||
    !nonnegative([
      a.width,
      a.height,
      c.width,
      c.clientHeight,
      c.borderTop,
      c.borderBottom,
      c.paddingTop,
      c.paddingBottom,
      t.offset,
      ...(t.minimumOuterInlineSpan === undefined ? [] : [t.minimumOuterInlineSpan]),
      s.scrollHeight,
      s.offsetTop,
      s.height,
      s.paddingTop,
      s.paddingBottom,
    ]) ||
    a.right < a.left ||
    a.valueRight < a.valueLeft ||
    c.right < c.left ||
    t.textRight < t.textLeft
  )
    return invalid('invalid-extent');
  const { margin, minimumTargetSpanCount } = constraints;
  if (
    !finite([margin, minimumTargetSpanCount]) ||
    margin < 0 ||
    minimumTargetSpanCount <= 0 ||
    constraints.boundary !== 'layout-viewport' ||
    constraints.inlineOverflow !== 'preserve-start' ||
    (metrics.direction !== 'ltr' && metrics.direction !== 'rtl') ||
    typeof constraints.expandOnScroll !== 'boolean'
  )
    return invalid('invalid-constraint');

  const rtl = metrics.direction === 'rtl';
  const textInset = rtl ? c.right - t.textRight : t.textLeft - c.left;
  const desiredInset = (rtl ? v.width - a.valueRight : a.valueLeft) - textInset;
  const referenceInset = rtl ? v.width - a.right : a.left;
  const minimumInlineSpan = Math.max(
    a.width + referenceInset - desiredInset,
    t.minimumOuterInlineSpan ?? 0
  );
  const widthForClamp = Math.max(minimumInlineSpan, c.width);
  const inlineInset = clamp(
    desiredInset,
    margin,
    Math.max(margin, v.width - margin - widthForClamp)
  );

  const available = v.height - 2 * margin;
  const natural = c.borderTop + c.paddingTop + s.scrollHeight + c.paddingBottom + c.borderBottom;
  const minimum = Math.min(minimumTargetSpanCount * t.height, natural);
  const beforeReference = a.top + a.height / 2 - margin;
  const afterReference = available - beforeReference;
  const half = t.height / 2;
  const beforeTarget = c.borderTop + c.paddingTop + t.offset + half;
  const afterTarget = natural - beforeTarget;
  const endPinned = beforeTarget <= beforeReference;
  const requestedSpan = endPinned
    ? beforeTarget +
      Math.max(
        afterReference,
        half +
          (t.atEnd ? s.paddingBottom : 0) +
          c.clientHeight -
          s.offsetTop -
          s.height +
          c.borderBottom
      )
    : Math.max(beforeReference, c.borderTop + s.offsetTop + (t.atStart ? s.paddingTop : 0) + half) +
      afterTarget;
  const requestedScroll = endPinned ? undefined : beforeTarget - beforeReference + s.offsetTop;
  if (
    !finite([
      minimumInlineSpan,
      inlineInset,
      available,
      minimum,
      requestedSpan,
      ...(requestedScroll === undefined ? [] : [requestedScroll]),
    ])
  )
    return invalid('nonfinite-plan');
  const plan: TargetAlignmentPlan = Object.freeze({
    inline: Object.freeze({
      edge: rtl ? 'right' : 'left',
      inset: inlineInset,
      minimumSpan: minimumInlineSpan,
    }),
    block: Object.freeze({
      pin: endPinned ? 'end' : 'start',
      margin,
      requestedSpan,
      minimumSpan: minimum,
      maximumSpan: available,
    }),
    contentAlignment: 'normal',
    ...(requestedScroll === undefined ? {} : { requestedScroll }),
  });
  return Object.freeze({ kind: 'plan', plan });
}

export type ScrollExpansionSample = Readonly<{
  enabled: boolean;
  previousActualScroll: number;
  actualScroll: number;
  previousRequestedSpan: number;
  minimumSpan: number;
  availableSpan: number;
  pin: 'start' | 'end';
}>;
export type ScrollExpansionPlan = Readonly<{
  /** The supplied actual sample. A requested correction still requires host readback. */
  nextPreviousActualScroll: number;
  requestedSpan?: number;
  requestedScroll?: number;
  contentAlignment?: 'end';
}>;
export type ScrollExpansionResult = Invalid | Readonly<{ kind: 'plan'; plan: ScrollExpansionPlan }>;

export function reduceScrollExpansion(sample: ScrollExpansionSample): ScrollExpansionResult {
  const values = [
    sample.previousActualScroll,
    sample.actualScroll,
    sample.previousRequestedSpan,
    sample.minimumSpan,
    sample.availableSpan,
  ];
  if (!finite(values)) return invalid('nonfinite-fact');
  if (!nonnegative(values.slice(0, 4))) return invalid('invalid-extent');
  if ((sample.pin !== 'start' && sample.pin !== 'end') || typeof sample.enabled !== 'boolean') {
    return invalid('invalid-constraint');
  }
  const delta = Math.abs(sample.previousActualScroll - sample.actualScroll);
  const previousSpan = Math.max(sample.minimumSpan, sample.previousRequestedSpan);
  let plan: ScrollExpansionPlan = { nextPreviousActualScroll: sample.actualScroll };
  if (sample.enabled && delta > 0 && previousSpan < sample.availableSpan) {
    const proposed = previousSpan + delta;
    const requestedSpan = Math.min(sample.availableSpan, proposed);
    if (!Number.isFinite(proposed)) return invalid('nonfinite-plan');
    plan = {
      ...plan,
      requestedSpan,
      ...(sample.pin === 'end'
        ? {
            requestedScroll: Math.max(proposed - requestedSpan, 0),
            contentAlignment: 'end' as const,
          }
        : {}),
    };
  }
  return Object.freeze({ kind: 'plan', plan: Object.freeze(plan) });
}
