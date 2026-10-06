// One declared instrument limitation, never a generic catch/skip policy.
export const ROUNDED_SCROLL_DOMAIN = 'scroll-area-rounded-overflow-paint';
export const ROUNDED_SCROLL_FOLLOWUP = 'https://github.com/Proto-UI/Proto-UI/issues/853';
const LIMIT = 'unsupported-rounded-overflow-clip';
const soleRoundedLimit = (visibility) =>
  visibility?.visible === true &&
  visibility.classification === 'unsupported' &&
  Array.isArray(visibility.limits) &&
  visibility.limits.length === 1 &&
  visibility.limits[0] === LIMIT;
const ownedFixedClip = (visibility, owner, generation, requireInterior) => {
  const clips = visibility?.roundedOverflowClips;
  if (!Array.isArray(clips) || clips.length !== 1) return false;
  const clip = clips[0];
  return (
    clip.prototype === 'brutalist-scroll-area-root' &&
    clip.owner === owner &&
    clip.generation === generation &&
    clip.fixedPx === true &&
    clip.boxCount === 1 &&
    clip.whollyInsideSafeRect === false &&
    (!requireInterior || clip.safeInteriorOverlap === true) &&
    clip.overflowX === 'hidden' &&
    clip.overflowY === 'hidden' &&
    clip.safeRect &&
    Object.values(clip.safeRect).every(Number.isFinite) &&
    clip.safeRect.left < clip.safeRect.right &&
    clip.safeRect.top < clip.safeRect.bottom
  );
};

export function classifyKnownUnsupportedContrastFrame(item, frame) {
  const before = frame.projectionBefore,
    after = frame.projectionAfter;
  const primary = frame.primaryPaint,
    facts = frame.facts;
  const owner = before?.owner,
    generation = before?.generation;
  if (
    item.family !== 'scroll-area' ||
    frame.family !== item.family ||
    frame.runtime !== item.runtime ||
    frame.theme !== item.theme ||
    frame.requestedState !== 'rest' ||
    item.achievedTargets.length !== 0 ||
    primary?.prototype !== 'brutalist-scroll-area-viewport' ||
    primary.achieved !== false ||
    !soleRoundedLimit(primary.visibility) ||
    typeof owner !== 'string' ||
    !owner ||
    typeof generation !== 'string' ||
    !generation ||
    !ownedFixedClip(primary.visibility, owner, generation, true) ||
    before?.achieved !== true ||
    after?.achieved !== true ||
    frame.anatomyBefore?.achieved !== true ||
    frame.anatomyAfter?.achieved !== true ||
    frame.targetObservation?.achieved !== true ||
    frame.sameProjectionLease !== true ||
    frame.sameMeasurementLease !== true ||
    after.owner !== owner ||
    after.generation !== generation ||
    facts?.owner !== owner ||
    facts.generation !== generation ||
    typeof frame.beforeFingerprintDigest !== 'string' ||
    !frame.beforeFingerprintDigest.startsWith('sha256:') ||
    frame.beforeFingerprintDigest !== frame.afterFingerprintDigest ||
    frame.beforeFingerprintDigest !== facts.stateFingerprintDigest ||
    !frame.image?.path ||
    !frame.image?.digest ||
    !frame.factsFile?.path ||
    !frame.factsFile?.digest ||
    !Array.isArray(facts.surfaces) ||
    facts.surfaces.length === 0 ||
    facts.surfaces.filter((surface) => surface.prototype === 'brutalist-scroll-area-viewport')
      .length !== 1 ||
    facts.surfaces.filter((surface) => surface.prototype === 'brutalist-scroll-area-root')
      .length !== 1
  )
    return null;
  // Retain all original anatomy checks; no other hidden/unsupported physical
  // surface can be laundered through this primary-target limitation.
  for (const surface of facts.surfaces) {
    if (surface.visible !== true) return null;
    const visibility = { ...surface.visibility, visible: surface.visible };
    if (visibility.classification === 'source-model-visible' && visibility.limits?.length === 0)
      continue;
    if (!soleRoundedLimit(visibility) || !ownedFixedClip(visibility, owner, generation, false))
      return null;
  }
  return {
    domain: ROUNDED_SCROLL_DOMAIN,
    followup: ROUNDED_SCROLL_FOLLOWUP,
    family: item.family,
    runtime: item.runtime,
    theme: item.theme,
    state: frame.requestedState,
    achieved: false,
    numericAcceptance: 'not-evaluated',
    reason:
      'Declared ScrollArea rounded overflow edge paint is outside the fixed-px whole-box proof domain.',
    geometryOnly: primary.visibility.roundedOverflowClips,
    owner,
    generation,
    image: frame.image,
    factsFile: frame.factsFile,
    fingerprintDigest: frame.beforeFingerprintDigest,
    unexecutedTargets: item.plannedStates.filter((state) => !item.achievedTargets.includes(state)),
    boundary:
      'Raw PNG/facts and complete ownership/anatomy/fingerprint pairing retained. Interior overlap is geometry, not painted or numeric acceptance. No later journey was executed.',
  };
}

export class KnownUnsupportedContrastDomain extends Error {
  constructor(observation) {
    super(observation.reason);
    this.name = 'KnownUnsupportedContrastDomain';
    this.observation = observation;
  }
}
export function isKnownUnsupportedContrastCase(item) {
  const value = item.knownUnsupported;
  return (
    item.status === 'known-unsupported' &&
    item.family === 'scroll-area' &&
    value?.domain === ROUNDED_SCROLL_DOMAIN &&
    value.followup === ROUNDED_SCROLL_FOLLOWUP &&
    value.family === item.family &&
    value.runtime === item.runtime &&
    value.theme === item.theme &&
    value.state === 'rest' &&
    value.achieved === false &&
    value.numericAcceptance === 'not-evaluated' &&
    item.achievedTargets.length === 0
  );
}
export function isUnresolvedContrastCase(item) {
  return item.status !== 'observed' && !isKnownUnsupportedContrastCase(item);
}
