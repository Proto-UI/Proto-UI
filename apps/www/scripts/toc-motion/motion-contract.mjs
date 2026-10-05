import { createHash } from 'node:crypto';
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function near(a, b, tolerance = 1.5) {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance;
}
export function rectNear(a, b, tolerance = 1.5) {
  return (
    !!a && !!b && ['x', 'y', 'width', 'height'].every((key) => near(a[key], b[key], tolerance))
  );
}
export function nontransparent(value) {
  return (
    !!value &&
    value !== 'transparent' &&
    !/(?:rgba|hsla)\([^)]*,\s*0(?:\.0+)?\s*\)$/.test(value) &&
    !/\/\s*0(?:\.0+)?%?\s*\)$/.test(value)
  );
}
export function checkRestingFrame(frame, { expectHighlight = true } = {}) {
  const failures = [];
  if (!frame) return ['No frame was collected'];
  if (frame.current.length !== 1)
    failures.push(`Expected one aria-current link, got ${frame.current.length}`);
  if (frame.expectedCurrent && frame.current[0] !== frame.expectedCurrent)
    failures.push('aria-current does not match the last linked heading above the reading boundary');
  if (frame.viewport && (frame.viewport.dpr !== 1 || frame.viewport.scale !== 1))
    failures.push('Unexpected DPR/visual viewport scale');
  if (!expectHighlight) return failures;
  if (frame.highlightCount !== 1)
    failures.push(`Expected one shared highlight, got ${frame.highlightCount}`);
  if (!frame.target || !rectNear(frame.actual, frame.target))
    failures.push('Resting shared highlight does not cover the first/last in-view link union');
  if (frame.highlight?.ariaHidden !== 'true' || frame.highlight?.pointerEvents !== 'none')
    failures.push('Shared paint must be aria-hidden and pointer-inert');
  if (frame.highlight?.visibility !== 'visible' || Number(frame.highlight?.opacity) <= 0)
    failures.push('Shared highlight is not visibly painted');
  if (
    !nontransparent(frame.surface?.backgroundColor) ||
    frame.surface?.visibility !== 'visible' ||
    frame.surface?.display === 'none' ||
    Number(frame.surface?.opacity) <= 0 ||
    !frame.surface?.styleTokens?.split(/\s+/).includes('bg-muted')
  )
    failures.push('Public Surface lacks actual nontransparent visible muted paint');
  if (
    frame.surfaceCount !== 1 ||
    !frame.surface?.defined ||
    !/^wc-site-(shadcn|brutalist)-surface$/.test(frame.surface?.tag ?? '')
  )
    failures.push('Shared paint is not exactly one defined public-family WC Surface');
  return failures;
}
export function inspectMotion(frames) {
  const valid = frames.filter((frame) => frame.actual && frame.target);
  const geometryKey = (rect) =>
    ['x', 'y', 'width', 'height'].map((key) => Math.round(rect[key] * 100) / 100).join(',');
  const targetChanges = valid
    .slice(1)
    .filter(
      (frame, index) =>
        !rectNear(
          frame.inlineTarget ?? frame.target,
          valid[index].inlineTarget ?? valid[index].target,
          0.1
        )
    ).length;
  const actualChanges = valid
    .slice(1)
    .filter((frame, index) => !rectNear(frame.actual, valid[index].actual, 0.1)).length;
  const intermediateFrames = valid.filter(
    (frame) => !rectNear(frame.actual, frame.inlineTarget ?? frame.target, 0.4)
  ).length;
  const highlightIds = [...new Set(valid.map((frame) => frame.highlightId))];
  return {
    frameCount: frames.length,
    targetChanges,
    actualChanges,
    intermediateFrames,
    highlightIds,
    distinctActualGeometry: new Set(valid.map((frame) => geometryKey(frame.actual))).size,
    scrollMin: Math.min(...frames.map((frame) => frame.scrollY)),
    scrollMax: Math.max(...frames.map((frame) => frame.scrollY)),
  };
}
export function checkAnimatedRun(frames) {
  const summary = inspectMotion(frames);
  const failures = [];
  if (summary.targetChanges < 1)
    failures.push('Input did not produce a shared-range target change');
  if (summary.intermediateFrames < 2 || summary.distinctActualGeometry < 3)
    failures.push('No demonstrated multi-frame CSS interpolation between shared-range targets');
  if (summary.highlightIds.length !== 1)
    failures.push('Shared highlight node was replaced during scroll');
  return { summary, failures };
}

/** A timer from an earlier frame can run after a controlled input changes layout.
 * Classify by the captured input epoch, never by the observed current value. */
export function classifyFrameSamples(frames, expectedEpoch) {
  const beforeFrame = frames.filter((frame) => frame.sampledInputEpoch !== frame.inputEpoch);
  const postFrame = frames.filter((frame) => frame.sampledInputEpoch === frame.inputEpoch);
  const failures = [];
  if (!postFrame.some((frame) => frame.inputEpoch === expectedEpoch))
    failures.push(`No post-rAF sample for input epoch ${expectedEpoch}`);
  const invalid = postFrame.filter(
    (frame) =>
      frame.connected && (frame.current.length !== 1 || frame.current[0] !== frame.expectedCurrent)
  );
  if (invalid.length)
    failures.push(
      `${invalid.length} post-rAF samples have missing/nonunique/wrong native current; first at ${invalid[0].t}ms`
    );
  return { beforeFrame, postFrame, failures };
}
