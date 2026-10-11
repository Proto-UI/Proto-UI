import { readInternalInitialPaintLease, recordInternalInitialPaint } from './initial-paint-bridge';
import { withOwnedCarrierMarker } from './paint-mutations';
import { observeWebPointerContact } from '../events/pointer-contact';
import { createContactMotion } from './contact-motion';
import { createContactCarrier, inspectContactCarrier } from './contact-carrier';
import { contactProfile, contactPaintOutset } from './contact-profile';
import { prepareOpticalImage } from './image-prepare';
import { observeMaterialGeometry } from './geometry-watch';
import type { EffectsPort } from '@proto.ui/core';
import type { VisualFeedbackFrame, VisualFeedbackSink } from '@proto.ui/module-feedback';
import { resolveMaterialPolicy } from '@proto.ui/module-feedback/internal/shared-policy';
import { inspectCanvasBackdrop, type CanvasBackdropLease } from './source';
import { resolveWebMaterialPreferences, type WebMaterialPreferences } from './preferences';
import type { OpticalGeometry, OpticalFrame } from './program';
import { acquireWebOpticalProgram } from './program-pool';
import {
  resolveMaterialStyle,
  resolvePaletteColor,
  rgbaCss,
  type MaterialPaletteSource,
} from './style';

export type WebMaterialOptions = {
  source: CanvasBackdropLease;
  palette: MaterialPaletteSource;
  preferences?: WebMaterialPreferences;
};
/** One physical view owns one V2 consumer. Style continues through the real
 * Adapter EffectsPort. Static optics use host background paint; contact optics
 * use a leased paint-only pseudo-element. Neither creates a content node, slot
 * input, event owner, transformed hitbox or native control. */
export function createWebMaterialSink(
  host: HTMLElement,
  effects: EffectsPort,
  options: WebMaterialOptions
): VisualFeedbackSink {
  let retired = false;
  let last: VisualFeedbackFrame | null = null;
  let document = host.ownerDocument;
  let generation = 0;
  let rebinding = false;
  let binding: VisualFeedbackSink | null = null;
  // Author ownership belongs to the host/view, not its document-bound GPU.
  const externalPaintOwners = new Set<string>();
  const motion = createContactMotion();
  // Providers and view survive adoption; physical rebinding grants no rewind.
  const revisions = { source: -1, palette: -1 };
  function bindDocument() {
    // A provider cleanup/subscription may synchronously commit newer intent.
    // Queue that frame until old cleanup finishes, before acquiring new paint.
    if (rebinding) return;
    rebinding = true;
    const operation = ++generation;
    try {
      const previous = binding;
      binding = null;
      previous?.release(last?.view ?? 0);
      if (retired || generation !== operation) return;
      document = host.ownerDocument;
      const next = createDocumentMaterialSink(
        host,
        effects,
        options,
        externalPaintOwners,
        motion,
        revisions,
        () => {
          if (!retired && host.ownerDocument !== document) bindDocument();
        }
      );
      if (retired || generation !== operation) {
        next.release(last?.view ?? 0);
        return;
      }
      binding = next;
    } finally {
      rebinding = false;
    }
    if (last) binding?.commit(last);
  }
  bindDocument();
  return {
    commit(frame) {
      if (retired) return;
      assertFrameIdentity(frame, last);
      last = frame;
      if (!binding || host.ownerDocument !== document) bindDocument();
      else binding.commit(frame);
    },
    release(view) {
      if (retired || (last && last.view !== view)) return;
      retired = true;
      generation++;
      const previous = binding;
      binding = null;
      previous?.release(view);
    },
  };
}

function assertFrameIdentity(frame: VisualFeedbackFrame, last: VisualFeedbackFrame | null) {
  if (
    !Number.isSafeInteger(frame.view) ||
    frame.view < 0 ||
    !Number.isSafeInteger(frame.revision) ||
    frame.revision < 0
  )
    throw new Error('Invalid material frame identity');
  if (last && (frame.view !== last.view || frame.revision <= last.revision))
    throw new Error('Stale or cross-view material frame');
}

/** A document change retires this complete physical binding before the current
 * intent is replayed with destination preferences, GPU, image and observers.
 * Old asynchronous work can request rebinding but cannot paint the new owner. */
function createDocumentMaterialSink(
  host: HTMLElement,
  effects: EffectsPort,
  options: WebMaterialOptions,
  externalPaintOwners: Set<string>,
  motion: ReturnType<typeof createContactMotion>,
  revisions: { source: number; palette: number },
  adopted: () => void
): VisualFeedbackSink {
  const document = host.ownerDocument;
  const initialPaint = readInternalInitialPaintLease(host);
  const win = document.defaultView;
  if (!win) throw new Error('Material owner document unavailable');
  const preferences = resolveWebMaterialPreferences(options.preferences, win);
  const program = acquireWebOpticalProgram(document, () => {
    invalidate('optical-context-invalidated');
  });
  let retired = false,
    painting = false,
    again = false;
  function currentDocument() {
    if (retired) return false;
    if (host.ownerDocument === document) return true;
    adopted();
    return false;
  }
  let scheduled: number | null = null;
  let queued = false;
  let paintLease = '';
  let geometryLease = '';
  let externalStyleRevision = 0;
  let renderFailure: { key: string; reason: string } | null = null;
  let carrier: ReturnType<typeof createContactCarrier> | null = null;
  let paintedImage = '';
  let cancellationSession: number | null = null;
  let cancelledPointerPhase = false;
  let contactEpoch = 0;
  let neutralPaint: {
    lease: string;
    image: string;
    sourceRevision: number;
    retain(): () => void;
    release(): void;
  } | null = null;
  let last: VisualFeedbackFrame | null = null;
  const contact = observeWebPointerContact(host, (sample) => {
    if (!currentDocument()) return;
    if (motion.update(sample, win.performance.now())) {
      contactEpoch++;
      if (sample.active) {
        cancellationSession = null;
        cancelledPointerPhase = false;
      }
      cancelPending();
      // A fresh down retires the old session's completion, not an already
      // admitted image. Keep that paint until the new session decodes, subject
      // to the same source/style/geometry admission on its next repaint.
      // Cancellation still withdraws the rejected contact immediately.
      if (!sample.active) {
        clearImage(true);
        restore();
        // Re-admit a decoded neutral image through the ordinary source, style,
        // geometry and preference guards in this same event turn.
        cancellationSession = sample.session;
        cancelledPointerPhase = true;
        repaint();
        lastOwnedStyle = host.getAttribute('style');
        lastOwnedTokens = host.getAttribute('data-pui-style');
      }
    }
    schedule();
  });
  function schedule() {
    if (!currentDocument() || scheduled !== null) return;
    scheduled = win!.requestAnimationFrame(() => {
      scheduled = null;
      repaint();
    });
  }
  function invalidate(reason: string) {
    if (!currentDocument()) return;
    renderFailure = null;
    motion.stop();
    ordinary(reason);
    repaint();
  }
  let lastOwnedStyle: string | null = null;
  let lastOwnedTokens: string | null = null;
  let sourceEpoch = 0;
  let sourceOwner: { canvas: HTMLCanvasElement; scope: HTMLElement } | null = null;
  let renders = 0;
  let desiredTokens: readonly string[] = [],
    paintSignature = '';
  let pending: { signature: string; lease: string; cancel(): void } | null = null;
  let releaseImage = () => {};
  const cancelPending = () => {
    const previous = pending;
    pending = null;
    previous?.cancel();
  };
  const clearImage = (keepNeutral = false) => {
    if (!keepNeutral) {
      neutralPaint?.release();
      neutralPaint = null;
    }
    const previous = releaseImage;
    releaseImage = () => {};
    previous();
  };
  let safeFallback: Parameters<typeof rgbaCss>[0] | null = null;
  const owned = new Map<string, { before: [string, string]; applied: [string, string] }>();
  const diagnostics = new Map<
    string,
    { before: string | undefined; applied: string | undefined }
  >();
  const inline = (name: string): [string, string] => [
    host.style.getPropertyValue(name),
    host.style.getPropertyPriority(name),
  ];
  function authoredInlineStyle() {
    const entries: Array<[string, string, string]> = [];
    const names = new Set([
      ...Array.from({ length: host.style.length }, (_, index) => host.style[index]),
      ...owned.keys(),
    ]);
    for (const name of names) {
      const current = inline(name),
        prior = owned.get(name);
      const value =
        prior && current[0] === prior.applied[0] && current[1] === prior.applied[1]
          ? prior.before
          : current;
      if (value[0]) entries.push([name, ...value]);
    }
    return entries.sort(([a], [b]) => a.localeCompare(b));
  }
  function externalPaintConflict() {
    // An optical receipt owns the complete inline paint tuple, including CSS
    // priority. A surviving image alone cannot certify its size/tiling/clip.
    // restore() retires our lease, not a replacement author's ownership. Keep
    // every takeover across source/semantic repaints until explicitly removed.
    for (const name of externalPaintOwners) if (!inline(name)[0]) externalPaintOwners.delete(name);
    for (const [name, prior] of owned) {
      const current = inline(name);
      if (current[0] !== prior.applied[0] || current[1] !== prior.applied[1])
        externalPaintOwners.add(name);
    }
    if (externalPaintOwners.size) return true;
    return ['background-color', 'background-image', 'backdrop-filter'].some((name) => {
      const value = inline(name),
        previous = owned.get(name);
      return (
        value[0] !== '' &&
        !(previous && value[0] === previous.applied[0] && value[1] === previous.applied[1]) &&
        !initialPaint?.permitsInline(name, value)
      );
    });
  }
  function restore() {
    withOwnedCarrierMarker(host, () => carrier?.release());
    carrier = null;
    paintedImage = '';
    for (const [name, value] of owned) {
      const current = inline(name);
      if (current[0] === value.applied[0] && current[1] === value.applied[1]) {
        if (value.before[0]) host.style.setProperty(name, ...value.before);
        else host.style.removeProperty(name);
      } else externalPaintOwners.add(name);
    }
    owned.clear();
    paintSignature = '';
    paintLease = '';
  }
  function own(name: string, value: string) {
    const current = inline(name),
      prior = owned.get(name);
    const before =
      prior && current[0] === prior.applied[0] && current[1] === prior.applied[1]
        ? prior.before
        : current;
    if (current[0] !== value || current[1]) host.style.setProperty(name, value);
    owned.set(name, { before, applied: inline(name) });
  }
  function report(key: string, value: string | undefined) {
    if (!currentDocument()) return;
    const current = host.dataset[key],
      old = diagnostics.get(key);
    const before = old && current === old.applied ? old.before : current;
    if (value === undefined) delete host.dataset[key];
    else if (current !== value) host.dataset[key] = value;
    diagnostics.set(key, { before, applied: value });
  }
  function clearDiagnostics() {
    for (const [key, value] of diagnostics)
      if (host.dataset[key] === value.applied) {
        if (value.before === undefined) delete host.dataset[key];
        else host.dataset[key] = value.before;
      }
    diagnostics.clear();
  }
  function style(tokens: readonly string[]) {
    if (
      tokens.length === desiredTokens.length &&
      tokens.every((token, i) => token === desiredTokens[i])
    )
      return;
    desiredTokens = [...tokens];
    effects.queueStyle({ kind: 'tw', tokens: [...tokens] });
    effects.requestFlush();
  }
  function ordinary(reason?: string) {
    initialPaint?.retire();
    motion.stop();
    cancelPending();
    clearImage();
    program.clear();
    restore();
    if (last) style(last.style.tokens);
    clearDiagnostics();
    if (reason) {
      report('materialQuality', 'unavailable');
      report('materialReason', reason);
    }
  }
  function fallback(fill: Parameters<typeof rgbaCss>[0], reason: string, releaseGPU = true) {
    initialPaint?.retire();
    if (releaseGPU) {
      motion.stop();
      cancelPending();
      program.clear();
    }
    clearImage();
    restore();
    own('background-color', rgbaCss(fill));
    own('background-image', 'none');
    report('materialQuality', 'opaque-fallback');
    report('materialReason', reason);
    report('materialBackend', undefined);
    report('materialProfile', undefined);
    report('materialSource', undefined);
  }
  function repaint() {
    if (!currentDocument() || !last) return;
    if (painting) {
      again = true;
      return;
    }
    painting = true;
    const frame = last;
    const frameContactEpoch = contactEpoch;
    const cancellingContact = cancellationSession !== null;
    safeFallback = null;
    try {
      if (!frame.material.slot) {
        ordinary();
        return;
      }
      const palette = options.palette.current();
      if (!currentDocument()) return;
      if (
        !Number.isSafeInteger(palette.revision) ||
        palette.revision < 0 ||
        palette.revision < revisions.palette
      ) {
        ordinary('palette-revision-stale');
        return;
      }
      revisions.palette = palette.revision;
      if (externalPaintConflict()) {
        ordinary('external-paint-conflict');
        return;
      }
      const resolved = resolveMaterialStyle(frame.style.tokens, palette.colors);
      safeFallback =
        resolved.provenance === 'post-patch-complete' && !resolved.competingPaint.length
          ? resolved.fill
          : null;
      if (
        resolved.provenance !== 'post-patch-complete' ||
        !resolved.fill ||
        !resolved.foreground ||
        resolved.competingPaint.length
      ) {
        ordinary('unresolved-owned-opaque-fallback');
        return;
      }
      // Keep the complete fallback IR on the actual host. The admitted painter
      // suppresses only its proven background-color property using one owned
      // inline value; the fallback token does not produce a second paint layer.
      // Restoration therefore never waits for an asynchronous framework flush.
      const tokens = frame.style.tokens;
      style(tokens);
      if (!currentDocument()) return;
      const applied = (host.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean);
      const finalStyleRealized =
        applied.length === tokens.length && tokens.every((token) => applied.includes(token));
      // React/Vue may deliver style after their EffectsPort call. Do not sample
      // stale geometry or announce an optical frame while that delivery waits.
      if (!finalStyleRealized || last !== frame) {
        initialPaint?.retire();
        cancelPending();
        clearImage();
        program.clear();
        restore();
        report('materialQuality', 'unavailable');
        report('materialReason', 'final-style-host-commit-pending');
        return;
      }
      for (let ancestor: Element | null = host; ancestor; ancestor = ancestor.parentElement) {
        const paint = win!.getComputedStyle(ancestor);
        if (
          (paint.opacity && Number(paint.opacity) !== 1) ||
          (paint.filter && paint.filter !== 'none') ||
          (paint.mixBlendMode && paint.mixBlendMode !== 'normal')
        ) {
          ordinary('external-compositing-unavailable');
          return;
        }
      }
      const css = win!.getComputedStyle(host),
        rect = host.getBoundingClientRect();
      const foregroundCss = css.color;
      const foreground = resolvePaletteColor(foregroundCss, {});
      if (
        !foreground ||
        foreground.some((value, i) => Math.abs(value - resolved.foreground![i]) > 1 / 255)
      ) {
        ordinary('external-foreground-mismatch');
        return;
      }
      const radii = [
        css.borderTopLeftRadius,
        css.borderTopRightRadius,
        css.borderBottomRightRadius,
        css.borderBottomLeftRadius,
      ];
      const geometryValid =
        radii.every((value) => /^\d+(\.\d+)?px$/.test(value)) &&
        radii.every((value) => value === radii[0]);
      const source = options.source.current();
      if (!currentDocument()) return;
      const requestedCandidate =
        frame.material.candidates.length === 1 ? frame.material.candidates[0] : null;
      const wantsContact =
        requestedCandidate?.intent === 'liquid-glass' &&
        requestedCandidate.deformation?.contact === 'pointer';
      const paintOutset = wantsContact ? contactPaintOutset(rect.width, rect.height) : 0;
      const admission = inspectCanvasBackdrop(host, source, paintOutset);
      const carrierConflict =
        carrier && !carrier.valid(paintedImage)
          ? 'contact-carrier-style-conflict'
          : wantsContact
            ? inspectContactCarrier(host)
            : null;
      if (carrierConflict) {
        fallback(resolved.fill, carrierConflict);
        return;
      }
      const currentSource =
        !!source &&
        Number.isSafeInteger(source.revision) &&
        source.revision >= 0 &&
        source.revision >= revisions.source;
      if (currentSource) {
        if (
          !sourceOwner ||
          sourceOwner.canvas !== source!.canvas ||
          sourceOwner.scope !== source!.scope
        ) {
          if (sourceOwner) motion.stop();
          sourceEpoch++;
          sourceOwner = { canvas: source!.canvas, scope: source!.scope };
        }
        revisions.source = source!.revision;
      } else sourceOwner = null;
      const prefs = preferences.current();
      if (!currentDocument()) return;
      const geometry = {
        width: rect.width,
        height: rect.height,
        radius: geometryValid
          ? Math.min(parseFloat(radii[0]), rect.width / 2, rect.height / 2)
          : NaN,
        dpr: win!.devicePixelRatio,
        axisAligned: geometryValid,
      };
      const policy = resolveMaterialPolicy({
        slot: frame.material.slot,
        candidates: frame.material.candidates,
        finalStyle: resolved,
        geometry,
        preferences: prefs,
        source: source
          ? {
              kind: 'in-app-backdrop',
              current: currentSource && admission.valid,
              sameScope: admission.valid,
              excludesOwnOutput: admission.valid,
            }
          : null,
        provider: {
          backend: 'self-optical',
          profile: wantsContact ? contactProfile : 'liquidgl-v2-app-canvas-1',
          ready: !program.lost,
          sourceKind: 'in-app-backdrop',
          staticSupported: true,
          pressDeformationSupported: true,
          variants: ['regular', 'clear'],
          tones: [],
          maxSurfacePixels: 1048576,
        },
      });
      report('materialIntent', policy.requestedIntent ?? undefined);
      report(
        'materialMotion',
        policy.effectiveMotion ?? (prefs.reducedMotion === 'no-preference' ? undefined : 'static')
      );
      if (policy.decision !== 'eligible' || !source || !admission.valid) {
        fallback(
          resolved.fill,
          !admission.valid ? admission.reason : (policy.diagnostics[0] ?? 'material-unavailable')
        );
        return;
      }
      const candidate = frame.material.candidates[0];
      if (candidate.intent !== 'liquid-glass') {
        fallback(resolved.fill, 'intent-backend-mismatch');
        return;
      }
      const nextGeometryLease = JSON.stringify([
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        geometry.radius,
        geometry.dpr,
      ]);
      if (geometryLease && nextGeometryLease !== geometryLease) motion.stop();
      geometryLease = nextGeometryLease;
      const tracksContact = candidate.deformation?.contact === 'pointer';
      // A stale pressed contribution is not a new keyboard gesture. Require
      // its neutral phase (or a fresh pointer session) before centered press
      // may re-arm; source ticks alone cannot revive cancelled contact.
      if (candidate.deformation?.phase !== 'pressed') cancelledPointerPhase = false;
      const suppressCancelledPress = cancellingContact || cancelledPointerPhase;
      if (policy.effectiveMotion !== 'press' || !tracksContact) motion.stop();
      const motionFrame = motion.frame(
        win!.performance.now(),
        policy.effectiveMotion === 'press' && tracksContact
      );
      // Keyboard press retains the established centred finite response; it
      // does not manufacture a pointer contact or revive a rejected session.
      if (
        tracksContact &&
        policy.effectiveMotion === 'press' &&
        candidate.deformation?.phase === 'pressed' &&
        !suppressCancelledPress &&
        !contact.current()?.active &&
        motionFrame.contact?.strength === 0
      )
        motionFrame.contact = { x: 0.5, y: 0.5, deltaX: 0, deltaY: 0, strength: 1 };
      const opticalGeometry: OpticalGeometry = {
        ...geometry,
        paintOutset,
        bounds: admission.bounds,
      };
      const currentMaterialCompatible = () => {
        if (last === frame) return true;
        if (
          !tracksContact ||
          !last ||
          last.view !== frame.view ||
          last.material.candidates.length !== 1
        )
          return false;
        const current = last.material.candidates[0];
        return (
          current.intent === 'liquid-glass' &&
          current.deformation?.contact === 'pointer' &&
          current.variant === candidate.variant &&
          JSON.stringify(last.material.slot) === JSON.stringify(frame.material.slot)
        );
      };
      const nextPaintLease = JSON.stringify([
        frame.view,
        sourceEpoch,
        palette.revision,
        opticalGeometry,
        policy.effectiveMotion,
        resolved.fill,
        resolved.foreground,
        tracksContact,
        candidate.variant,
      ]);
      const installPaint = (image: string, currentCss: CSSStyleDeclaration) => {
        if (tracksContact) {
          carrier ??= withOwnedCarrierMarker(host, () => createContactCarrier(host));
          if (!currentCss.position || currentCss.position === 'static') own('position', 'relative');
          own('isolation', 'isolate');
          // The absolute carrier origin is the current padding box, not the
          // border box sampled by the renderer. Rebuild this translation for
          // both decoded publication and neutral restoration; never replay a
          // former border-relative offset just because the outer rect matches.
          const borderLeft = parseFloat(currentCss.borderLeftWidth || '0');
          const borderTop = parseFloat(currentCss.borderTopWidth || '0');
          if (![borderLeft, borderTop].every((value) => Number.isFinite(value) && value >= 0))
            throw new Error('contact-carrier-border-unavailable');
          own('--pui-material-left', `${-paintOutset - borderLeft}px`);
          own('--pui-material-top', `${-paintOutset - borderTop}px`);
          own('--pui-material-width', `${rect.width + 2 * paintOutset}px`);
          own('--pui-material-height', `${rect.height + 2 * paintOutset}px`);
          own('--pui-material-image', `url("${image}")`);
          own('background-image', 'none');
          if (!carrier.valid(image)) throw new Error('contact-carrier-style-unavailable');
        } else own('background-image', `url("${image}")`);
        own('background-color', 'transparent');
        own('background-origin', 'border-box');
        own('background-clip', 'border-box');
        own('background-size', '100% 100%');
        own('background-repeat', 'no-repeat');
      };
      // A cancelled held image is never a bridge. Only an already decoded rest
      // image from the exact admitted generation can cover its neutral successor.
      if (cancellingContact && neutralPaint?.lease === nextPaintLease) {
        const neutral = neutralPaint;
        installPaint(neutral.image, css);
        paintedImage = neutral.image;
        paintLease = nextPaintLease;
        releaseImage = neutral.retain();
        report('materialQuality', 'self-optical');
        report('materialReason', 'rendered');
        report('materialBackend', 'self-optical');
        report('materialProfile', contactProfile);
        report('materialSource', 'visible-app-canvas');
        report('materialFrame', String(++renders));
        report('materialSourceRevision', String(neutral.sourceRevision));
        report('materialContact', 'rest');
        report('materialContactSession', String(motionFrame.session));
        report('materialPhase', 'rest');
      }
      // Session identity gates pending work/retries, while compatible admitted
      // pixels can bridge a new down without exposing the opaque fallback.
      const lease = JSON.stringify([nextPaintLease, motionFrame.session]);
      // Carrier/transport refusal is independent of changing source pixels or
      // pointer-move samples. Only a new style/geometry/profile/session can
      // make that failed admission useful to retry; GPU failures remain uncached.
      const retryKey = JSON.stringify([
        lease,
        externalStyleRevision,
        tokens,
        candidate.deformation?.phase,
        host.getAttribute('class'),
        authoredInlineStyle(),
      ]);
      if (renderFailure?.key === retryKey) {
        fallback(resolved.fill, renderFailure.reason);
        return;
      }
      const signature = JSON.stringify([
        frame.view,
        frame.revision,
        source.revision,
        palette.revision,
        opticalGeometry,
        policy.effectiveMotion,
        candidate,
        motionFrame.session,
        tracksContact ? motionFrame.contact : null,
        resolved.fill,
        resolved.foreground,
      ]);
      if (
        paintSignature === signature &&
        owned.get('background-image')?.applied[0] === host.style.backgroundImage &&
        (!carrier || carrier.valid(paintedImage))
      )
        return;
      if (pending?.signature === signature) return;
      if (pending?.lease === lease) {
        queued = true;
        return;
      }
      cancelPending();
      const renderFrame: OpticalFrame = {
        source,
        geometry: opticalGeometry,
        pressed:
          !suppressCancelledPress &&
          policy.effectiveMotion === 'press' &&
          candidate.deformation?.phase === 'pressed',
        contact: tracksContact ? motionFrame.contact : undefined,
        variant: candidate.variant ?? 'regular',
        fill: resolved.fill,
        foreground: resolved.foreground,
      };
      // Only an explicitly registered internal server-plane lease can defer the
      // preparing fallback. All ordinary source/policy/style guards ran above.
      const initialCandidate = initialPaint?.matches(frame, renderFrame) ?? false;
      // A same-generation admitted image stays visible until its decoded
      // successor is ready. Revoked source/geometry/preferences never qualify.
      if (paintLease !== nextPaintLease && !initialCandidate)
        fallback(resolved.fill, 'preparing', false);
      if (!currentDocument() || program.lost) return;
      cancellationSession = null;
      const image = program.render(renderFrame);
      // Host callbacks may cancel/replace input reentrantly while rendering.
      // Never install a ticket for that already rejected lifetime.
      if (!currentDocument() || frameContactEpoch !== contactEpoch) return;
      if (initialCandidate) {
        // Replaying this very renderer is required in addition to manifest/hash
        // checks. An arbitrary or differently rendered background never adopts.
        const seedTuple =
          last === frame &&
          initialPaint!.matches(frame, renderFrame) &&
          initialPaint!.matchesOutput(image)
            ? initialPaint!.claim()
            : null;
        if (seedTuple) {
          for (const [name, value] of seedTuple)
            owned.set(name, { before: ['', ''], applied: [value, ''] });
          paintedImage = image;
          paintLease = nextPaintLease;
          // Drop the SSR-only CSS selector after adopting the identical tuple.
          // Decode below still owns live-resource and diagnostic publication.
          initialPaint!.finishClaim();
        } else fallback(resolved.fill, 'initial-paint-replay-mismatch', false);
      }
      const ticket = { signature, lease, cancel() {} };
      pending = ticket;
      ticket.cancel = prepareOpticalImage(
        document,
        image,
        () => {
          if (!currentDocument() || pending !== ticket || frameContactEpoch !== contactEpoch)
            return;
          try {
            const currentSource = options.source.current(),
              currentPalette = options.palette.current(),
              currentPreferences = preferences.current();
            const currentAdmission = inspectCanvasBackdrop(host, currentSource, paintOutset),
              currentRect = host.getBoundingClientRect(),
              currentCss = win!.getComputedStyle(host);
            const currentTokens = (host.getAttribute('data-pui-style') ?? '')
              .split(/\s+/)
              .filter(Boolean);
            const currentRadii = [
              currentCss.borderTopLeftRadius,
              currentCss.borderTopRightRadius,
              currentCss.borderBottomRightRadius,
              currentCss.borderBottomLeftRadius,
            ];
            if (!currentDocument() || pending !== ticket || frameContactEpoch !== contactEpoch)
              return;
            if (externalPaintConflict()) {
              ordinary('external-paint-conflict');
              lastOwnedStyle = host.getAttribute('style');
              lastOwnedTokens = host.getAttribute('data-pui-style');
              return;
            }
            if (
              program.lost ||
              !currentMaterialCompatible() ||
              currentSource !== source ||
              currentPalette.revision !== palette.revision ||
              JSON.stringify(currentPreferences) !== JSON.stringify(prefs) ||
              !currentAdmission.valid ||
              currentAdmission.bounds.some((value, index) => value !== admission.bounds[index]) ||
              [
                currentRect.x,
                currentRect.y,
                currentRect.width,
                currentRect.height,
                win!.devicePixelRatio,
              ].some(
                (value, index) =>
                  value !== [rect.x, rect.y, rect.width, rect.height, geometry.dpr][index]
              ) ||
              currentRadii.some((value, index) => value !== radii[index]) ||
              currentTokens.length !== tokens.length ||
              !tokens.every((token) => currentTokens.includes(token)) ||
              currentCss.color !== foregroundCss
            ) {
              ordinary('lease-replaced-during-image-prepare');
              lastOwnedStyle = host.getAttribute('style');
              lastOwnedTokens = host.getAttribute('data-pui-style');
              repaint();
              return;
            }
            const previousImage = releaseImage;
            installPaint(image, currentCss);
            renderFailure = null;
            paintSignature = signature;
            paintLease = nextPaintLease;
            paintedImage = image;
            pending = null;
            let imageUsers = 0;
            const retain = () => {
              imageUsers++;
              let live = true;
              return () => {
                if (!live) return;
                live = false;
                if (--imageUsers === 0) ticket.cancel();
              };
            };
            releaseImage = retain();
            if (tracksContact && !renderFrame.pressed && !motionFrame.contact?.strength) {
              const previousNeutral = neutralPaint;
              neutralPaint = {
                lease: nextPaintLease,
                image,
                sourceRevision: source.revision,
                retain,
                release: retain(),
              };
              previousNeutral?.release();
            }
            previousImage();
            recordInternalInitialPaint(host, frame, renderFrame, image);
            report('materialQuality', 'self-optical');
            report('materialReason', 'rendered');
            report('materialBackend', 'self-optical');
            report('materialProfile', tracksContact ? contactProfile : 'liquidgl-v2-app-canvas-1');
            report('materialSource', 'visible-app-canvas');
            report('materialFrame', String(++renders));
            report('materialSourceRevision', String(source.revision));
            report(
              'materialContact',
              tracksContact
                ? motionFrame.animating
                  ? 'release'
                  : motionFrame.contact?.strength
                    ? 'held'
                    : 'rest'
                : undefined
            );
            report(
              'materialContactSession',
              tracksContact ? String(motionFrame.session) : undefined
            );
            report('materialPhase', renderFrame.pressed ? 'pressed' : 'rest');
            lastOwnedStyle = host.getAttribute('style');
            lastOwnedTokens = host.getAttribute('data-pui-style');
            if (queued || motionFrame.animating) {
              queued = false;
              schedule();
            }
          } catch (error) {
            if (currentDocument() && pending === ticket) {
              const reason =
                error instanceof Error ? error.message : 'material-prepare-input-failed';
              renderFailure = { key: retryKey, reason };
              ordinary(reason);
              lastOwnedStyle = host.getAttribute('style');
              lastOwnedTokens = host.getAttribute('data-pui-style');
            }
          }
        },
        () => {
          if (!currentDocument() || pending !== ticket || frameContactEpoch !== contactEpoch)
            return;
          try {
            const currentSource = options.source.current();
            const currentPalette = options.palette.current();
            const currentPreferences = preferences.current();
            if (!currentDocument() || pending !== ticket || frameContactEpoch !== contactEpoch)
              return;
            if (externalPaintConflict()) ordinary('external-paint-conflict');
            else if (
              !currentMaterialCompatible() ||
              currentSource !== source ||
              currentPalette.revision !== palette.revision ||
              JSON.stringify(currentPreferences) !== JSON.stringify(prefs)
            )
              ordinary('lease-replaced-during-image-prepare');
            else {
              renderFailure = { key: retryKey, reason: 'optical-image-decode-failed' };
              fallback(resolved.fill!, 'optical-image-decode-failed');
            }
          } catch {
            if (currentDocument() && pending === ticket) ordinary('material-prepare-input-failed');
          }
          lastOwnedStyle = host.getAttribute('style');
          lastOwnedTokens = host.getAttribute('data-pui-style');
        }
      );
    } catch (error) {
      if (currentDocument() && last) {
        if (safeFallback && last === frame)
          fallback(safeFallback, error instanceof Error ? error.message : 'material-frame-failed');
        else ordinary('unresolved-owned-opaque-fallback');
      }
    } finally {
      painting = false;
      if (again) {
        again = false;
        repaint();
      }
      lastOwnedStyle = host.getAttribute('style');
      lastOwnedTokens = host.getAttribute('data-pui-style');
    }
  }
  const disposers: Array<() => void> = [];
  try {
    disposers.push(contact.dispose);
    disposers.push(
      observeMaterialGeometry(
        host,
        (revision) => {
          externalStyleRevision = revision;
          repaint();
        },
        () => lastOwnedStyle,
        () => lastOwnedTokens
      )
    );
    disposers.push(
      options.source.subscribe(() => {
        if (!currentDocument()) return;
        // A new frame from the same admitted canvas lease supersedes an in-flight
        // decode, not its input session. Repaint withdraws null/rebound/invalid
        // sources synchronously, while a valid successor can replace atomically.
        cancelPending();
        repaint();
      })
    );
    disposers.push(options.palette.subscribe(() => invalidate('material-palette-invalidated')));
    disposers.push(preferences.subscribe(() => invalidate('material-preferences-invalidated')));
  } catch (error) {
    retired = true;
    for (const dispose of disposers) {
      try {
        dispose();
      } catch {}
    }
    program.release();
    throw error;
  }
  return {
    commit(frame) {
      if (!currentDocument()) return;
      // Retire a decode made against the previous style snapshot before it can
      // mistake an ordinary Rule transition (for example pointerleave shadow)
      // for source/session loss. Re-admit geometry below without cancelling the
      // router-owned contact. Zero candidates still stop it through fallback.
      if (
        last &&
        (last.style.tokens.length !== frame.style.tokens.length ||
          last.style.tokens.some((token, index) => token !== frame.style.tokens[index]))
      )
        cancelPending();
      last = frame;
      repaint();
    },
    release(view) {
      if (retired || (last && view !== last.view)) return;
      retired = true;
      if (scheduled !== null) win!.cancelAnimationFrame(scheduled);
      scheduled = null;
      motion.stop();
      last = null;
      let error: unknown;
      for (const dispose of [
        cancelPending,
        clearImage,
        ...disposers,
        program.release,
        () => initialPaint?.retire(),
        restore,
        clearDiagnostics,
      ]) {
        try {
          dispose();
        } catch (failure) {
          error ??= failure;
        }
      }
      if (error) throw error;
    },
  };
}
