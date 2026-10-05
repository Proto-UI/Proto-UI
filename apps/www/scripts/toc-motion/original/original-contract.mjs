import { createHash } from 'node:crypto';
export const BASELINE_SHA = '411c354cfbf76e9da34eafa90f1c8a7b973d043c';
export const ROUTE = '/zh-cn/start-here/quick-start/';
export const VIEWPORT = Object.freeze({ width: 1440, height: 900 });
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const rectNear = (a, b, tolerance = 0.4) =>
  !!a &&
  !!b &&
  ['x', 'y', 'width', 'height'].every(
    (k) => Number.isFinite(a[k]) && Number.isFinite(b[k]) && Math.abs(a[k] - b[k]) <= tolerance
  );

/** Historical first-left / last-right geometry, deliberately not a union/min/max fix. */
export function originalTarget(first, last, host, scrollLeft = 0, scrollTop = 0) {
  if (!first || !last || !host) return null;
  const left = first.left - host.left + scrollLeft - 16;
  const top = first.top - host.top + scrollTop - 4;
  return {
    x: left,
    y: top,
    width: Math.max(0, last.right - host.left + scrollLeft + 16 - left),
    height: Math.max(0, last.bottom - host.top + scrollTop + 4 - top),
  };
}

/** Browser-safe structural selector. Never add a marker or change the subject DOM. */
export function legacyHighlights(host) {
  return [...host.children].filter(
    (el) =>
      el.localName === 'div' &&
      el.getAttribute('aria-hidden') === 'true' &&
      el.classList.contains('bg-primary/5')
  );
}

export function summarize(frames) {
  const valid = frames.filter((f) => f.actual && f.inlineTarget);
  const changed = (key) =>
    valid.slice(1).filter((f, i) => !rectNear(f[key], valid[i][key], 0.1)).length;
  return {
    frameCount: frames.length,
    actualChanges: changed('actual'),
    targetChanges: changed('inlineTarget'),
    intermediateFrames: valid.filter((f) => !rectNear(f.actual, f.inlineTarget)).length,
    distinctActualGeometry: new Set(valid.map((f) => JSON.stringify(f.actual))).size,
    highlightIds: [...new Set(valid.map((f) => f.highlightId))],
    scrollMin: frames.length ? Math.min(...frames.map((f) => f.scrollY)) : null,
    scrollMax: frames.length ? Math.max(...frames.map((f) => f.scrollY)) : null,
    nonuniqueCurrentFrames: frames.filter((f) => f.current.length !== 1).length,
    currentBoundaryMismatchFrames: frames.filter(
      (f) => f.current.length === 1 && f.current[0] !== f.expectedCurrent
    ).length,
  };
}

/** Findings describe history; none silently rewrites it to current Surface semantics. */
export function historicFindings(frames) {
  const s = summarize(frames),
    rest = frames.at(-1),
    findings = [];
  if (!rest) return ['No recorded geometry samples'];
  if (s.nonuniqueCurrentFrames)
    findings.push(`${s.nonuniqueCurrentFrames} samples have nonunique/missing native aria-current`);
  if (s.currentBoundaryMismatchFrames)
    findings.push(
      `${s.currentBoundaryMismatchFrames} samples disagree with the independently measured reading boundary (historical IntersectionObserver behavior retained)`
    );
  if (!rectNear(rest.actual, rest.target, 1.5))
    findings.push('Resting geometry differs from the original padded first/last-link target');
  if (rest.highlight?.opacity === '0' || rest.highlight?.visibility !== 'visible')
    findings.push('Original highlight is not visibly painted at rest');
  if (s.targetChanges && (s.intermediateFrames < 2 || s.distinctActualGeometry < 3))
    findings.push(
      'No multi-frame computed-vs-inline interpolation was observed despite target changes'
    );
  return findings;
}
