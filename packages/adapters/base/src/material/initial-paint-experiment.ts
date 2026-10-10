import type { VisualFeedbackFrame } from '@proto.ui/module-feedback';
import type { OpticalFrame } from './program';
import type { WebMaterialOptions } from './sink';
import { inspectCanvasBackdrop } from './source';
import { resolveWebMaterialPreferences } from './preferences';
import { rgbaCss, resolvePaletteColor } from './style';
import {
  digestBytes,
  digestText,
  INITIAL_PAINT_PROFILE,
  materialKey,
  parseInitialPaintReceipt,
  readInitialPaintServerOwner,
  snapshotInitialPaintManifest,
  receiptFromAdmittedPaint,
  verifyInitialPaintArtifact,
  type InitialPaintLayout,
  type InitialPaintManifestBinding,
  type InitialPaintReceipt,
} from './initial-paint-receipt';
import {
  registerInternalInitialPaintCapture,
  registerInternalInitialPaintLease,
  readInternalInitialPaintLease,
  type InitialPaintLease,
} from './initial-paint-bridge';

const marker = 'data-pui-initial-seed';
const preparing = new WeakSet<HTMLElement>();
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const equalBytes = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((byte, index) => byte === b[index]);

// Short-lived preparation observers own their own native resources. They must
// never occupy/remove the ordinary sink's shared per-host geometry lease.
function observeInitialPlane(host: HTMLElement, changed: () => void) {
  const document = host.ownerDocument,
    win = document.defaultView!;
  const mutation = new win.MutationObserver(changed);
  mutation.observe(document.documentElement, {
    attributes: true,
    childList: true,
    subtree: true,
    characterData: true,
    attributeFilter: ['style', 'class', 'hidden', 'data-pui-style', 'data-theme', marker],
  });
  const resize = win.ResizeObserver ? new win.ResizeObserver(changed) : null;
  resize?.observe(host);
  win.addEventListener('resize', changed);
  win.addEventListener('scroll', changed, true);
  return () => {
    mutation.disconnect();
    resize?.disconnect();
    win.removeEventListener('resize', changed);
    win.removeEventListener('scroll', changed, true);
  };
}
export function initialPaintTuple(
  receipt: Pick<InitialPaintReceipt, 'image'>
): ReadonlyArray<readonly [string, string]> {
  return [
    ['background-image', `url("${receipt.image.dataUrl}")`],
    ['background-color', 'transparent'],
    ['background-origin', 'border-box'],
    ['background-clip', 'border-box'],
    ['background-size', '100% 100%'],
    ['background-repeat', 'no-repeat'],
  ];
}

/** CSS enables only the declared finite viewport/DPR/theme profile. Unsupported
 * preferences and profiles start opaque even with scripts disabled. This is a
 * capability experiment, not a general responsive Card layout guarantee. */
export function initialPaintPresentation(receipt: InitialPaintReceipt, hostId: string) {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(hostId)) throw new Error('seed-host-id-invalid');
  const host = `#${hostId}`,
    selected = `${host}[${marker}="${receipt.image.pngSha256}"]`,
    pending = `${selected},${host}[${marker}="${receipt.image.pngSha256}:rejected"]`;
  const { viewportWidth: width, viewportHeight: height, dpr, theme } = receipt.layout;
  const fallback = `background-image:none!important;background-color:${rgbaCss(receipt.fill)}!important;`;
  const paint = `background-image:url("${receipt.image.dataUrl}")!important;background-color:transparent!important;`;
  const eligibility = `(width:${width}px) and (height:${height}px) and (resolution:${dpr}dppx) and (prefers-reduced-transparency:no-preference) and (prefers-contrast:no-preference) and (forced-colors:none)`;
  const explicitTheme = `:root.${theme} ${selected},:root[data-theme="${theme}"] ${selected}`;
  const automaticTheme = `:root:not(.dark):not(.light):not([data-theme]) ${selected}`;
  return {
    attributes: {
      id: hostId,
      [marker]: receipt.image.pngSha256,
      'data-pui-style': receipt.tokens.join(' '),
    },
    style: initialPaintTuple(receipt)
      .map(([name, value]) => `${name}:${value}`)
      .join(';'),
    css: `${pending}{${fallback}}\n@media ${eligibility}{${explicitTheme}{${paint}}}\n@media ${eligibility} and (prefers-color-scheme:${theme}){${automaticTheme}{${paint}}}\n@media (prefers-reduced-transparency:reduce),(prefers-contrast:more),(prefers-contrast:less),(prefers-contrast:custom){${pending}{${fallback}}}\n@media (forced-colors:active){${pending}{background-image:none!important;background-color:Canvas!important;color:CanvasText!important;forced-color-adjust:auto;}}`,
    layoutLimit:
      'Only the declared viewport/DPR and build-owned layout profile may show initial optical paint; other profiles start opaque. Font-scale/layout variants require separate pre-render evidence.',
  };
}

export function armExperimentalInitialPaintCapture(host: HTMLElement, layout: InitialPaintLayout) {
  let live = true;
  let capture: Promise<InitialPaintReceipt> | null = null;
  const stop = registerInternalInitialPaintCapture(host, (visual, optical, image) => {
    if (!live || capture) return;
    capture = receiptFromAdmittedPaint(layout, visual, optical, image);
    // A caller may inspect after a failed export. Do not leak an unhandled rejection.
    void capture.catch(() => {});
  });
  return {
    async artifact() {
      if (!live || !capture) throw new Error('no-admitted-static-paint-captured');
      const receipt = await capture;
      if (!live) throw new Error('seed-capture-retired');
      const serialized = JSON.stringify(receipt);
      const binding: InitialPaintManifestBinding = {
        artifactSha256: await digestText(serialized),
        layoutId: receipt.layout.id,
        profile: INITIAL_PAINT_PROFILE,
        serverPaint: receipt.image,
      };
      if (!live) throw new Error('seed-capture-retired');
      return { receipt, serialized, binding };
    },
    dispose() {
      live = false;
      stop();
      capture = null;
    },
  };
}

/** The server already displays this generated paint. Verification never turns
 * the image on. It only grants a one-use bridge into the ordinary guarded sink.
 * A build manifest is product provenance, not a runtime authentication claim. */
export async function prepareExperimentalInitialPaint(
  host: HTMLElement,
  serialized: string,
  binding: InitialPaintManifestBinding,
  options: WebMaterialOptions
): Promise<{ receipt: InitialPaintReceipt; dispose(): void }> {
  // Reserve before the first await. A second caller cannot withdraw the first
  // caller's server plane while either verification or a live lease owns it.
  if (preparing.has(host) || readInternalInitialPaintLease(host))
    throw new Error('initial-paint-already-registered');
  preparing.add(host);
  const originalMarker = host.getAttribute(marker);
  const originalStyle = host.getAttribute('style');
  const ownerDocument = host.ownerDocument;
  const pendingStops: Array<() => void> = [];
  let invalidated = false;
  let pendingActive = true;
  let serverOwner: InitialPaintReceipt['image'] | null = null;
  let withdrawOwned = () => {};
  try {
    // The build-side manifest identifies our server plane even if the receipt
    // is absent or malformed. Neither candidate JSON nor DOM markers grant it.
    serverOwner = readInitialPaintServerOwner(binding);
    if (originalMarker !== serverOwner.pngSha256)
      throw new Error('seed-initial-plane-owner-mismatch');
    const ownedReceipt = { image: serverOwner };
    const withdrawPending = () => {
      if (!pendingActive) return;
      invalidated = true;
      if (host.getAttribute(marker) !== ownedReceipt.image.pngSha256) return;
      host.removeAttribute(marker);
      for (const [name, value] of initialPaintTuple(ownedReceipt)) {
        const probe = ownerDocument.createElement('span');
        probe.style.setProperty(name, value);
        if (
          host.style.getPropertyValue(name) === probe.style.getPropertyValue(name) &&
          !host.style.getPropertyPriority(name)
        )
          host.style.removeProperty(name);
      }
    };
    withdrawOwned = withdrawPending;
    const initialTupleIntact = initialPaintTuple(ownedReceipt).every(([name, value]) => {
      const probe = ownerDocument.createElement('span');
      probe.style.setProperty(name, value);
      return (
        host.style.getPropertyValue(name) === probe.style.getPropertyValue(name) &&
        host.style.getPropertyPriority(name) === ''
      );
    });
    if (!initialTupleIntact) {
      withdrawPending();
      throw new Error('seed-initial-plane-inputs-mismatch');
    }
    binding = snapshotInitialPaintManifest(binding);
    parseInitialPaintReceipt(serialized);
    const source = options.source.current();
    const watchPending = (subscribe: (changed: () => void) => () => void) => {
      let stop: () => void;
      try {
        stop = subscribe(withdrawPending);
      } catch (error) {
        withdrawPending();
        throw error;
      }
      if (invalidated) {
        try {
          stop();
        } catch {
          /* keep the rejection primary */
        }
      } else pendingStops.push(stop);
      if (invalidated) throw new Error('seed-verification-inputs-unavailable');
    };
    watchPending((changed) => options.source.subscribe(changed));
    const win = ownerDocument.defaultView;
    if (!source || !win) {
      withdrawPending();
      throw new Error('seed-owned-canvas-unavailable');
    }
    watchPending((changed) =>
      resolveWebMaterialPreferences(options.preferences, win).subscribe(changed)
    );
    watchPending((changed) => options.palette.subscribe(changed));
    const initialBounds = JSON.stringify(host.getBoundingClientRect());
    const pendingGeometry = () => {
      if (
        !host.isConnected ||
        host.ownerDocument !== ownerDocument ||
        options.source.current() !== source ||
        host.getAttribute('style') !== originalStyle ||
        host.getAttribute(marker) !== originalMarker ||
        JSON.stringify(host.getBoundingClientRect()) !== initialBounds
      )
        withdrawPending();
    };
    watchPending(() =>
      observeInitialPlane(host, () => {
        try {
          pendingGeometry();
        } catch {
          withdrawPending();
        }
      })
    );
    return await prepareReservedInitialPaint(
      host,
      serialized,
      binding,
      options,
      () =>
        !invalidated && host.ownerDocument === ownerDocument && options.source.current() === source
    );
  } catch (error) {
    // Only the receipt's marker identifies this server plane. Unchanged own
    // paint can select its opaque default; changed paint needs the old selector
    // removed and property-by-property cleanup so an author's value survives.
    if (
      serverOwner &&
      originalMarker === serverOwner.pngSha256 &&
      host.getAttribute(marker) === originalMarker &&
      host.getAttribute('style') === originalStyle
    )
      host.setAttribute(marker, `${serverOwner.pngSha256}:rejected`);
    else if (
      serverOwner &&
      originalMarker === serverOwner.pngSha256 &&
      host.getAttribute(marker) === originalMarker
    )
      withdrawOwned();
    throw error;
  } finally {
    pendingActive = false;
    for (const stop of pendingStops.splice(0)) {
      try {
        stop();
      } catch {
        /* owned preparation already settled */
      }
    }
    preparing.delete(host);
  }
}

async function prepareReservedInitialPaint(
  host: HTMLElement,
  serialized: string,
  binding: InitialPaintManifestBinding,
  options: WebMaterialOptions,
  stillPreparing: () => boolean
): Promise<{ receipt: InitialPaintReceipt; dispose(): void }> {
  const receipt = await verifyInitialPaintArtifact(serialized, binding);
  if (!stillPreparing()) throw new Error('seed-verification-inputs-unavailable');
  const document = host.ownerDocument,
    win = document.defaultView;
  if (!win) throw new Error('seed-document-unavailable');
  const tuple = initialPaintTuple(receipt);
  const inline = (name: string): readonly [string, string] => [
    host.style.getPropertyValue(name),
    host.style.getPropertyPriority(name),
  ];
  const normal = (name: string, value: string) => {
    const probe = document.createElement('span');
    probe.style.setProperty(name, value);
    return probe.style.getPropertyValue(name);
  };
  const expected = new Map(tuple.map(([name, value]) => [name, normal(name, value)]));
  const withdrawServerPlane = () => {
    if (host.getAttribute(marker) !== receipt.image.pngSha256) return;
    host.removeAttribute(marker);
    for (const [name] of tuple) {
      const value = inline(name);
      if (value[0] === expected.get(name) && value[1] === '') host.style.removeProperty(name);
    }
  };
  let source: NonNullable<ReturnType<WebMaterialOptions['source']['current']>>;
  try {
    const available = options.source.current();
    if (!available) throw new Error('seed-owned-canvas-unavailable');
    source = available;
  } catch (error) {
    withdrawServerPlane();
    throw error;
  }
  const originalPixels = Uint8Array.from(source.pixels);
  const prefs = resolveWebMaterialPreferences(options.preferences, win);
  let state: 'checking' | 'ready' | 'claiming' | 'claimed' | 'retired' = 'checking';
  let unregister = () => {};
  const stops: Array<() => void> = [];
  let lastVisual: VisualFeedbackFrame | null = null,
    lastOptical: OpticalFrame | null = null;
  let outputMatched = false;
  const tupleMatches = () =>
    host.getAttribute(marker) === receipt.image.pngSha256 &&
    tuple.every(([name]) => {
      const value = inline(name);
      return value[0] === expected.get(name) && value[1] === '';
    });
  // Unknown/denied preference inputs never qualify merely because a PNG exists.
  const preferencesAllow = () => {
    const current = prefs.current();
    return (
      current.reducedTransparency === 'no-preference' &&
      current.contrast === 'no-preference' &&
      current.forcedColors === 'none'
    );
  };
  const current = () => {
    if (
      state === 'retired' ||
      state === 'claimed' ||
      !host.isConnected ||
      host.ownerDocument !== document ||
      win.innerWidth !== receipt.layout.viewportWidth ||
      win.innerHeight !== receipt.layout.viewportHeight ||
      win.devicePixelRatio !== receipt.layout.dpr ||
      options.source.current() !== source ||
      source.width !== receipt.source.width ||
      source.height !== receipt.source.height ||
      !equalBytes(source.pixels, originalPixels) ||
      !preferencesAllow() ||
      !tupleMatches()
    )
      return false;
    const admission = inspectCanvasBackdrop(host, source);
    const visible = source.canvas
      .getContext('2d', { willReadFrequently: true })
      ?.getImageData(0, 0, source.width, source.height).data;
    if (
      !visible ||
      visible.length !== originalPixels.length ||
      visible.some((byte, index) => byte !== originalPixels[index]) ||
      source.canvas.toDataURL('image/png') !== receipt.source.pngDataUrl
    )
      return false;
    const rect = host.getBoundingClientRect(),
      css = win.getComputedStyle(host);
    const radii = [
      css.borderTopLeftRadius,
      css.borderTopRightRadius,
      css.borderBottomRightRadius,
      css.borderBottomLeftRadius,
    ];
    const tokens = (host.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean);
    const foreground = resolvePaletteColor(css.color, {});
    return (
      admission.valid &&
      same(admission.bounds, receipt.geometry.bounds) &&
      rect.width === receipt.geometry.width &&
      rect.height === receipt.geometry.height &&
      radii.every(
        (radius) =>
          /^\d+(\.\d+)?px$/.test(radius) &&
          Math.min(parseFloat(radius), rect.width / 2, rect.height / 2) === receipt.geometry.radius
      ) &&
      tokens.length === receipt.tokens.length &&
      receipt.tokens.every((token) => tokens.includes(token)) &&
      !!foreground &&
      foreground.every((value, index) => Math.abs(value - receipt.foreground[index]) <= 1 / 255) &&
      css.backgroundImage === expected.get('background-image') &&
      (!css.backgroundBlendMode || css.backgroundBlendMode === 'normal')
    );
  };
  const retire = () => {
    if (state === 'retired') {
      for (const stop of stops.splice(0)) {
        try {
          stop();
        } catch {
          /* drain late-installed subscriptions */
        }
      }
      return;
    }
    const delegated = state === 'claimed';
    state = 'retired';
    unregister();
    for (const stop of stops.splice(0)) {
      try {
        stop();
      } catch {
        /* still revoke remaining ownership */
      }
    }
    if (delegated) return; // The sink now owns removal, using its ordinary lease.
    withdrawServerPlane();
  };
  try {
    if (!current()) throw new Error('seed-initial-plane-inputs-mismatch');
    const invalidated = () => {
      try {
        if (state !== 'claimed' && !current()) retire();
      } catch {
        retire();
      }
    };
    const install = (subscribe: () => () => void) => {
      const stop = subscribe();
      if (state === 'retired') {
        try {
          stop();
        } catch {
          /* remain retired */
        }
      } else stops.push(stop);
      if (state === 'retired') throw new Error('seed-subscription-inputs-unavailable');
    };
    install(() => options.source.subscribe(invalidated));
    install(() => prefs.subscribe(invalidated));
    install(() => options.palette.subscribe(() => retire()));
    install(() => observeInitialPlane(host, invalidated));
    if ((await digestBytes(originalPixels)) !== receipt.source.rgbaSha256 || !current())
      throw new Error('seed-source-pixels-mismatch');
    state = 'ready';
    const lease: InitialPaintLease = {
      permitsInline(name, value) {
        return state === 'ready' && current() && expected.get(name) === value[0] && value[1] === '';
      },
      matches(visual, optical) {
        const geometry = {
          width: optical.geometry.width,
          height: optical.geometry.height,
          radius: optical.geometry.radius,
          dpr: optical.geometry.dpr,
          paintOutset: optical.geometry.paintOutset ?? 0,
          bounds: optical.geometry.bounds,
        };
        const match =
          state === 'ready' &&
          current() &&
          optical.source === source &&
          !optical.pressed &&
          !optical.contact &&
          same(geometry, receipt.geometry) &&
          optical.variant === receipt.variant &&
          same(optical.fill, receipt.fill) &&
          same(optical.foreground, receipt.foreground) &&
          materialKey(visual) === receipt.materialKey &&
          same(visual.style.tokens, receipt.tokens);
        lastVisual = match ? visual : null;
        lastOptical = match ? optical : null;
        return match;
      },
      matchesOutput(image) {
        outputMatched = state === 'ready' && image === receipt.image.dataUrl;
        return outputMatched;
      },
      claim() {
        if (
          !outputMatched ||
          !lastVisual ||
          !lastOptical ||
          !lease.matches(lastVisual, lastOptical)
        )
          return null;
        state = 'claiming';
        return [...expected.entries()];
      },
      finishClaim() {
        if (state !== 'claiming') throw new Error('seed-claim-state-invalid');
        state = 'claimed';
        unregister();
        for (const stop of stops.splice(0)) {
          try {
            stop();
          } catch {
            /* the sink already owns this paint */
          }
        }
        if (host.getAttribute(marker) === receipt.image.pngSha256) host.removeAttribute(marker);
      },
      retire,
    };
    unregister = registerInternalInitialPaintLease(host, lease);
    return { receipt, dispose: retire };
  } catch (error) {
    retire();
    throw error;
  }
}
