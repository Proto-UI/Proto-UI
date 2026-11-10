import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

// One declared instrument limitation, never a generic catch/skip policy.
export const ROUNDED_SCROLL_DOMAIN = 'scroll-area-rounded-overflow-paint';
export const ROUNDED_SCROLL_FOLLOWUP = 'https://github.com/Proto-UI/Proto-UI/issues/853';
const LIMIT = 'unsupported-rounded-overflow-clip';
const ROOT = 'brutalist-scroll-area-root';
const VIEWPORT = 'brutalist-scroll-area-viewport';
const digest = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const positiveNodeId = (id) => Number.isSafeInteger(id) && id > 0;
const validRect = (rect) =>
  rect &&
  ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(rect[key])) &&
  rect.width > 0 &&
  rect.height > 0;
const soleRoundedLimit = (visibility) =>
  visibility?.visible === true &&
  visibility.classification === 'unsupported' &&
  Array.isArray(visibility.limits) &&
  visibility.limits.length === 1 &&
  visibility.limits[0] === LIMIT;
const ownedFixedClip = (visibility, owner, generation, root, target) => {
  const clips = visibility?.roundedOverflowClips;
  if (!Array.isArray(clips) || clips.length !== 1) return false;
  const clip = clips[0];
  if (
    !clip ||
    clip.prototype !== ROOT ||
    clip.owner !== owner ||
    clip.generation !== generation ||
    clip.physicalNodeId !== root.physicalNodeId ||
    clip.fixedPx !== true ||
    clip.boxCount !== 1 ||
    clip.whollyInsideSafeRect !== false ||
    clip.safeInteriorOverlap !== true ||
    clip.overflowX !== 'hidden' ||
    clip.overflowY !== 'hidden' ||
    !Array.isArray(clip.radii) ||
    clip.radii.length !== 4 ||
    !clip.radii.every((radius) => /^(?:5px|5px 5px)$/.test(radius)) ||
    !Array.isArray(clip.borderWidths) ||
    clip.borderWidths.length !== 4 ||
    !clip.borderWidths.every((width) => width === '2px') ||
    !validRect(clip.borderBox) ||
    !validRect(clip.clientBox) ||
    !isDeepStrictEqual(clip.borderBox, root.rect) ||
    !Array.isArray(clip.targetBoxes) ||
    clip.targetBoxes.length !== 1 ||
    !isDeepStrictEqual(clip.targetBoxes[0], target.rect)
  )
    return false;
  const border = clip.borderBox,
    client = clip.clientBox,
    box = target.rect;
  if (
    client.x !== border.x + 2 ||
    client.y !== border.y + 2 ||
    client.x + client.width > border.x + border.width ||
    client.y + client.height > border.y + border.height ||
    box.x < client.x ||
    box.y < client.y ||
    box.x + box.width > client.x + client.width ||
    box.y + box.height > client.y + client.height
  )
    return false;
  const safe = {
    left: Math.max(client.x, border.x + 5),
    right: Math.min(client.x + client.width, border.x + border.width - 5),
    top: Math.max(client.y, border.y + 5),
    bottom: Math.min(client.y + client.height, border.y + border.height - 5),
  };
  // Recompute the bounded geometry from observations, rather than trusting
  // booleans that could label an entirely clipped rounded-corner box safe.
  return (
    isDeepStrictEqual(clip.safeRect, safe) &&
    safe.left < safe.right &&
    safe.top < safe.bottom &&
    Math.min(box.x + box.width, safe.right) > Math.max(box.x, safe.left) &&
    Math.min(box.y + box.height, safe.bottom) > Math.max(box.y, safe.top) &&
    !(
      box.x >= safe.left &&
      box.y >= safe.top &&
      box.x + box.width <= safe.right &&
      box.y + box.height <= safe.bottom
    )
  );
};

// Raw bytes are required even when the caller already checked in-memory state.
// The PNG is the exact image decoded by the collector, not a later screenshot.
export function classifyKnownUnsupportedContrastFrame(item, frame, raw) {
  const before = frame.projectionBefore,
    after = frame.projectionAfter;
  const primary = frame.primaryPaint,
    facts = frame.facts;
  const owner = before?.owner,
    generation = before?.generation;
  if (
    item.family !== 'scroll-area' ||
    !['wc', 'react', 'vue', 'vue2'].includes(item.runtime) ||
    !['light', 'dark'].includes(item.theme) ||
    frame.family !== item.family ||
    frame.runtime !== item.runtime ||
    frame.theme !== item.theme ||
    frame.requestedState !== 'rest' ||
    item.achievedTargets.length !== 0 ||
    primary?.prototype !== VIEWPORT ||
    primary.achieved !== false ||
    !soleRoundedLimit(primary.visibility) ||
    typeof owner !== 'string' ||
    !owner ||
    typeof generation !== 'string' ||
    !generation ||
    before?.achieved !== true ||
    after?.achieved !== true ||
    frame.anatomyBefore?.achieved !== true ||
    frame.anatomyAfter?.achieved !== true ||
    frame.anatomyBefore.owner !== owner ||
    frame.anatomyBefore.generation !== generation ||
    frame.anatomyAfter.owner !== owner ||
    frame.anatomyAfter.generation !== generation ||
    frame.targetObservation?.achieved !== true ||
    frame.sameProjectionLease !== true ||
    frame.sameMeasurementLease !== true ||
    after.owner !== owner ||
    after.generation !== generation ||
    facts?.owner !== owner ||
    facts.generation !== generation ||
    facts.family !== item.family ||
    facts.theme !== item.theme ||
    !Buffer.isBuffer(raw?.image) ||
    typeof raw.facts !== 'string' ||
    typeof raw.fingerprints !== 'string' ||
    raw.image.length < 24 ||
    raw.image.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
    raw.image.subarray(12, 16).toString('ascii') !== 'IHDR' ||
    !Array.isArray(facts.surfaces) ||
    facts.surfaces.length === 0 ||
    facts.surfaces.filter((surface) => surface.prototype === VIEWPORT)
      .length !== 1 ||
    facts.surfaces.filter((surface) => surface.prototype === ROOT)
      .length !== 1
  )
    return null;
  const name = `${item.family}-${item.runtime}-${item.theme}-rest`;
  if (
    frame.image?.path !== `${name}.png` ||
    frame.image.digest !== digest(raw.image) ||
    frame.factsFile?.path !== `${name}.facts.json` ||
    frame.factsFile.digest !== digest(raw.facts) ||
    raw.facts !== `${JSON.stringify(facts, null, 2)}\n` ||
    frame.fingerprintsFile?.path !== `${name}.fingerprints.json` ||
    frame.fingerprintsFile.digest !== digest(raw.fingerprints)
  )
    return null;
  let fingerprints, snapshot;
  try {
    fingerprints = JSON.parse(raw.fingerprints);
    if (
      typeof fingerprints?.before !== 'string' ||
      fingerprints.before !== fingerprints.facts ||
      fingerprints.before !== fingerprints.after
    )
      return null;
    snapshot = JSON.parse(fingerprints.before);
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
  const fingerprintDigest = digest(fingerprints.before);
  if (
    frame.beforeFingerprintDigest !== fingerprintDigest ||
    frame.afterFingerprintDigest !== fingerprintDigest ||
    facts.stateFingerprintDigest !== fingerprintDigest ||
    facts.imageDigest !== frame.image.digest ||
    snapshot?.owner !== owner ||
    snapshot.generation !== generation ||
    !Array.isArray(snapshot.viewport) ||
    snapshot.viewport.length !== 5 ||
    !snapshot.viewport.every(Number.isFinite) ||
    !snapshot.viewport.slice(0, 3).every((value) => value > 0) ||
    facts.devicePixelRatio !== snapshot.viewport[2] ||
    facts.raster?.width !== raw.image.readUInt32BE(16) ||
    facts.raster?.height !== raw.image.readUInt32BE(20) ||
    facts.raster.width !== Math.round(snapshot.viewport[0] * snapshot.viewport[2]) ||
    facts.raster.height !== Math.round(snapshot.viewport[1] * snapshot.viewport[2]) ||
    !Array.isArray(snapshot.surfaces) ||
    snapshot.surfaces.length !== facts.surfaces.length ||
    !Array.isArray(snapshot.scope?.attributes) ||
    !Array.isArray(snapshot.theme?.attributes)
  )
    return null;
  const scopeAttributes = Object.fromEntries(snapshot.scope.attributes);
  const themeAttributes = Object.fromEntries(snapshot.theme.attributes);
  if (
    scopeAttributes['data-projection-owner'] !== owner ||
    scopeAttributes['data-projection-generation'] !== generation ||
    scopeAttributes['data-projection-family'] !== 'brutalist' ||
    scopeAttributes['data-projection-runtime'] !== item.runtime ||
    themeAttributes['data-theme'] !== item.theme
  )
    return null;
  const root = facts.surfaces.find((surface) => surface.prototype === ROOT);
  const viewport = facts.surfaces.find((surface) => surface.prototype === VIEWPORT);
  const physicalIds = new Set();
  for (const [index, surface] of facts.surfaces.entries()) {
    const captured = snapshot.surfaces[index];
    const host = captured?.host,
      target = captured?.target?.[0];
    if (
      !positiveNodeId(surface.physicalNodeId) ||
      !positiveNodeId(surface.hostNodeId) ||
      physicalIds.has(surface.physicalNodeId) ||
      !validRect(surface.rect) ||
      surface.owner !== owner ||
      surface.generation !== generation ||
      host?.id !== surface.hostNodeId ||
      target?.id !== surface.physicalNodeId ||
      !Array.isArray(host.attributes) ||
      !isDeepStrictEqual(target.rect, [
        surface.rect.x, surface.rect.y, surface.rect.width, surface.rect.height,
      ]) ||
      surface.rect.x < 0 ||
      surface.rect.y < 0 ||
      surface.rect.x + surface.rect.width > snapshot.viewport[0] ||
      surface.rect.y + surface.rect.height > snapshot.viewport[1]
    )
      return null;
    const attributes = Object.fromEntries(host.attributes);
    if (
      attributes['data-projection-owner'] !== owner ||
      attributes['data-projection-generation'] !== generation ||
      attributes['data-projection-prototype'] !== surface.prototype
    )
      return null;
    physicalIds.add(surface.physicalNodeId);
  }
  if (
    primary.physicalNodeId !== viewport.physicalNodeId ||
    primary.owner !== owner ||
    primary.generation !== generation ||
    !isDeepStrictEqual(primary.rect, viewport.rect) ||
    !isDeepStrictEqual(primary.visibility, { ...viewport.visibility, visible: viewport.visible }) ||
    !ownedFixedClip(primary.visibility, owner, generation, root, viewport)
  )
    return null;
  // Retain all original anatomy checks; no other hidden/unsupported physical
  // surface can be laundered through this primary-target limitation.
  for (const surface of facts.surfaces) {
    if (surface.visible !== true) return null;
    const visibility = { ...surface.visibility, visible: surface.visible };
    if (visibility.classification === 'source-model-visible' && visibility.limits?.length === 0)
      continue;
    if (!soleRoundedLimit(visibility) || !ownedFixedClip(visibility, owner, generation, root, surface))
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
    declaredProfile: { radiusPx: 5, borderPx: 2, overflowX: 'hidden', overflowY: 'hidden' },
    physicalNodeId: viewport.physicalNodeId,
    owner,
    generation,
    image: frame.image,
    factsFile: frame.factsFile,
    fingerprintsFile: frame.fingerprintsFile,
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
