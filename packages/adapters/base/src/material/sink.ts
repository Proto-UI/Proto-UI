import { prepareOpticalImage } from './image-prepare';
import { observeMaterialGeometry } from './geometry-watch';
import type { EffectsPort } from '@proto.ui/core';
import type { VisualFeedbackFrame, VisualFeedbackSink } from '@proto.ui/module-feedback';
import { resolveMaterialPolicy } from '@proto.ui/module-feedback/internal/shared-policy';
import { inspectCanvasBackdrop, type CanvasBackdropLease } from './source';
import { createWebMaterialPreferences, type WebMaterialPreferences } from './preferences';
import type { OpticalGeometry } from './program';
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
 * Adapter EffectsPort. The optical image occupies only CSS background paint,
 * so it creates no content node, slot input, event owner or native control. */
export function createWebMaterialSink(
  host: HTMLElement,
  effects: EffectsPort,
  options: WebMaterialOptions
): VisualFeedbackSink {
  const win = host.ownerDocument.defaultView;
  if (!win) throw new Error('Material owner document unavailable');
  const preferences = options.preferences ?? createWebMaterialPreferences(win);
  const program = acquireWebOpticalProgram(host.ownerDocument, () => {
    paintSignature = '';
    repaint();
  });
  let retired = false,
    painting = false,
    again = false;
  let last: VisualFeedbackFrame | null = null;
  let lastOwnedStyle: string | null = null;
  let sourceRevision = -1,
    paletteRevision = -1,
    renders = 0;
  let desiredTokens: readonly string[] = [],
    paintSignature = '';
  let pending: { signature: string; cancel(): void } | null = null;
  let releaseImage = () => {};
  const cancelPending = () => {
    const previous = pending;
    pending = null;
    previous?.cancel();
  };
  const clearImage = () => {
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
  function externalPaintConflict() {
    return ['background-color', 'background-image', 'backdrop-filter'].some((name) => {
      const value = inline(name),
        previous = owned.get(name);
      return (
        value[0] !== '' &&
        !(previous && value[0] === previous.applied[0] && value[1] === previous.applied[1])
      );
    });
  }
  function restore() {
    for (const [name, value] of owned) {
      const current = inline(name);
      if (current[0] === value.applied[0] && current[1] === value.applied[1]) {
        if (value.before[0]) host.style.setProperty(name, ...value.before);
        else host.style.removeProperty(name);
      }
    }
    owned.clear();
    paintSignature = '';
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
    if (retired) return;
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
    if (releaseGPU) {
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
    if (retired || !last) return;
    if (painting) {
      again = true;
      return;
    }
    painting = true;
    const frame = last;
    safeFallback = null;
    try {
      if (!frame.material.slot) {
        ordinary();
        return;
      }
      const palette = options.palette.current();
      if (retired) return;
      if (
        !Number.isSafeInteger(palette.revision) ||
        palette.revision < 0 ||
        palette.revision < paletteRevision
      ) {
        ordinary('palette-revision-stale');
        return;
      }
      paletteRevision = palette.revision;
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
      if (retired) return;
      const applied = (host.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean);
      const finalStyleRealized =
        applied.length === tokens.length && tokens.every((token) => applied.includes(token));
      // React/Vue may deliver style after their EffectsPort call. Do not sample
      // stale geometry or announce an optical frame while that delivery waits.
      if (!finalStyleRealized || last !== frame) {
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
      if (retired) return;
      const admission = inspectCanvasBackdrop(host, source);
      const currentSource =
        !!source &&
        Number.isSafeInteger(source.revision) &&
        source.revision >= 0 &&
        source.revision >= sourceRevision;
      if (currentSource) sourceRevision = source!.revision;
      const prefs = preferences.current();
      if (retired) return;
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
          profile: 'liquidgl-v2-app-canvas-1',
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
      const opticalGeometry: OpticalGeometry = { ...geometry, bounds: admission.bounds };
      const signature = JSON.stringify([
        frame.view,
        frame.revision,
        source.revision,
        palette.revision,
        opticalGeometry,
        policy.effectiveMotion,
        candidate,
        resolved.fill,
        resolved.foreground,
      ]);
      if (
        paintSignature === signature &&
        owned.get('background-image')?.applied[0] === host.style.backgroundImage
      )
        return;
      if (pending?.signature === signature) return;
      cancelPending();
      // Withdraw the previous frame before GPU work; no transparent gap can
      // expose a revoked/stale source when this render fails.
      fallback(resolved.fill, 'preparing', false);
      if (retired || program.lost) return;
      const image = program.render({
        source,
        geometry: opticalGeometry,
        pressed: policy.effectiveMotion === 'press' && candidate.deformation?.phase === 'pressed',
        variant: candidate.variant ?? 'regular',
        fill: resolved.fill,
        foreground: resolved.foreground,
      });
      if (retired) return;
      const ticket = { signature, cancel() {} };
      pending = ticket;
      ticket.cancel = prepareOpticalImage(
        host.ownerDocument,
        image,
        () => {
          if (retired || pending !== ticket) return;
          try {
            const currentSource = options.source.current(),
              currentPalette = options.palette.current(),
              currentPreferences = preferences.current();
            const currentAdmission = inspectCanvasBackdrop(host, currentSource),
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
            if (retired || pending !== ticket) return;
            if (externalPaintConflict()) {
              ordinary('external-paint-conflict');
              lastOwnedStyle = host.getAttribute('style');
              return;
            }
            if (
              program.lost ||
              last !== frame ||
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
              repaint();
              return;
            }
            pending = null;
            releaseImage = () => ticket.cancel();
            own('background-image', `url("${image}")`);
            own('background-color', 'transparent');
            own('background-origin', 'border-box');
            own('background-clip', 'border-box');
            own('background-size', '100% 100%');
            own('background-repeat', 'no-repeat');
            paintSignature = signature;
            report('materialQuality', 'self-optical');
            report('materialReason', 'rendered');
            report('materialBackend', 'self-optical');
            report('materialProfile', 'liquidgl-v2-app-canvas-1');
            report('materialSource', 'visible-app-canvas');
            report('materialFrame', String(++renders));
            report('materialSourceRevision', String(source.revision));
            report(
              'materialPhase',
              policy.effectiveMotion === 'press' && candidate.deformation?.phase === 'pressed'
                ? 'pressed'
                : 'rest'
            );
            lastOwnedStyle = host.getAttribute('style');
          } catch {
            if (!retired && pending === ticket) {
              ordinary('material-prepare-input-failed');
              lastOwnedStyle = host.getAttribute('style');
            }
          }
        },
        () => {
          if (retired || pending !== ticket) return;
          try {
            const currentSource = options.source.current();
            const currentPalette = options.palette.current();
            const currentPreferences = preferences.current();
            if (retired || pending !== ticket) return;
            if (externalPaintConflict()) ordinary('external-paint-conflict');
            else if (
              last !== frame ||
              currentSource !== source ||
              currentPalette.revision !== palette.revision ||
              JSON.stringify(currentPreferences) !== JSON.stringify(prefs)
            )
              ordinary('lease-replaced-during-image-prepare');
            else fallback(resolved.fill!, 'optical-image-decode-failed');
          } catch {
            if (!retired && pending === ticket) ordinary('material-prepare-input-failed');
          }
          lastOwnedStyle = host.getAttribute('style');
        }
      );
    } catch (error) {
      if (!retired && last) {
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
    }
  }
  const disposers: Array<() => void> = [];
  try {
    disposers.push(observeMaterialGeometry(host, repaint, () => lastOwnedStyle));
    disposers.push(options.source.subscribe(repaint));
    disposers.push(options.palette.subscribe(repaint));
    disposers.push(preferences.subscribe(repaint));
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
      if (retired) return;
      if (
        !Number.isSafeInteger(frame.view) ||
        frame.view < 0 ||
        !Number.isSafeInteger(frame.revision) ||
        frame.revision < 0
      )
        throw new Error('Invalid material frame identity');
      if (last && (frame.view !== last.view || frame.revision <= last.revision))
        throw new Error('Stale or cross-view material frame');
      last = frame;
      repaint();
    },
    release(view) {
      if (retired || (last && view !== last.view)) return;
      retired = true;
      last = null;
      let error: unknown;
      for (const dispose of [
        cancelPending,
        clearImage,
        ...disposers,
        program.release,
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
