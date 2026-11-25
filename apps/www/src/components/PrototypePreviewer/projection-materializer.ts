import { loadDemo } from './demo-modules';
import { prepareDemoRuntime, renderDemo } from './demo-renderer';
import { collectPrototypeIds, type DemoSpec } from './demo-types';
import {
  createProjectionComposition,
  PROJECTION_FOCUS_KEYS,
  type ProjectionControlId,
  type ProjectionContentRecipe,
  type ProjectionCompositionControls,
  type ProjectionFocusKey,
} from './projection-composition';
import {
  PROJECTION_FAMILY_MANIFESTS,
  type ProjectionComponentId,
  type ProjectionFamilyId,
  type ProjectionFamilyManifest,
} from './projection-families';
import type {
  ProjectionScopeCandidate,
  ProjectionScopeMaterializeRequest,
} from './projection-scope';
import {
  applyProjectionThemeSurfaceStyle,
  resolveProjectionThemeSurfaceStyle,
  watchProjectionThemeSurfaceStyle,
  type ProjectionThemeSurfaceStyle,
} from './projection-theme';
import { scheduleProjectionThemeRead } from './projection-theme-read';
import { loadPrototypes } from './prototype-modules';
import { previewerStartupTask } from './previewer-startup-task';
import {
  externalProjectionPortalRoots,
  lockExternalPortalRoot,
  removeExternalGenerationSurfaces,
  sealExternalProjectionPortals,
  unlockExternalPortalRoot,
} from './projection-portal-seal';
import { releaseHostMount } from './runtimes/host-mount';
import { isRuntimeId, type RuntimeId } from './runtimes/ids';

export type ProjectionMaterializerOptions = Readonly<{
  mount: HTMLElement;
  /** Use this owner's theme for preparation and subsequent color-mode changes. */
  themeSource?: Readonly<{
    scope: Element;
    family: ProjectionFamilyId;
    isCurrent(): boolean;
  }>;
  ownerId: string;
  componentId: ProjectionComponentId;
  controls: ProjectionCompositionControls;
  controlIds?: readonly ProjectionControlId[];
  /** Website-owned host composition, checked against an explicit recipe. */
  content?: Readonly<{ demo: DemoSpec; recipe: ProjectionContentRecipe }>;
  /** Opt out of automatic Liquid Glass backdrop scenes for chrome controls/surfaces. */
  automaticMaterialScene?: boolean;
  /** Let independent consumers finish preparation in a task after the frame. */
  yieldAfterPaint?: boolean;
  /** First-view preparation can yield while another consumer is preparing. */
  backgroundPreparation?: Readonly<{ signal: AbortSignal; isPending(): boolean }>;
  /**
   * Host-owned seal for the open portals of the generation that is leaving.
   *
   * A control switch request is applied after the control's own close
   * handback, so the host must seal the outgoing generation's portals in the
   * request's own turn. The host owns the whole scope, so it can seal the
   * candidates this composition does not own.
   */
  sealOutgoingPortals?: () => void;
}>;

export type MaterializedProjectionCandidate = ProjectionScopeCandidate &
  Readonly<{
    host: HTMLElement;
    scope: HTMLElement;
    setThemeSurfaceStyle(theme: ProjectionThemeSurfaceStyle): void;
    /**
     * Seal this generation's open external portals without switching.
     * Candidates that do not own external portals (e.g. typography) may omit
     * this; the callback is a no-op for them.
     */
    sealExternalPortals?(): void;
  }>;

// A focus lease belongs to the exact materialized composition, not a DOM role.
const compositionFocusRestorers = new WeakMap<HTMLElement, (key: ProjectionFocusKey) => boolean>();

function backgroundPreparationTask(
  options: ProjectionMaterializerOptions
): Promise<void> | undefined {
  const preparation = options.backgroundPreparation;
  if (!preparation) return;
  const { signal } = preparation;
  signal.throwIfAborted();
  if (!preparation.isPending()) return;
  return previewerStartupTask(options.mount, signal);
}

function nextPaint(element: HTMLElement, yieldAfterPaint = false): Promise<void> {
  return new Promise((resolve) => {
    const view = element.ownerDocument.defaultView;
    if (view?.requestAnimationFrame) {
      view.requestAnimationFrame(() => {
        if (yieldAfterPaint) view.setTimeout(resolve, 0);
        else resolve();
      });
    } else queueMicrotask(resolve);
  });
}

function generationHosts(mount: HTMLElement, ownerId: string): HTMLElement[] {
  return Array.from(
    mount.querySelectorAll<HTMLElement>('[data-projection-generation-host]')
  ).filter((host) => host.dataset.projectionOwnerHost === ownerId);
}

type PortalObserverRegistration = Readonly<{
  ownerId: string;
  generation: string;
  reconcile(): void;
}>;

type PortalObserverState = {
  observer: MutationObserver;
  registrations: Set<PortalObserverRegistration>;
};

const portalObserverStates = new WeakMap<Document, PortalObserverState>();

function portalCoordinateKey(ownerId: string, generation: string): string {
  return `${ownerId}\u0000${generation}`;
}

function addPortalCoordinate(
  coordinates: Set<string>,
  ownerId: string | null,
  generation: string | null
): void {
  if (ownerId && generation) coordinates.add(portalCoordinateKey(ownerId, generation));
}

function collectPortalCoordinates(
  node: Node,
  view: Window & typeof globalThis,
  coordinates: Set<string>
): void {
  if (!(node instanceof view.Element)) return;
  addPortalCoordinate(
    coordinates,
    node.getAttribute('data-projection-owner'),
    node.getAttribute('data-projection-generation')
  );
  for (const element of node.querySelectorAll(
    '[data-projection-owner][data-projection-generation]'
  )) {
    addPortalCoordinate(
      coordinates,
      element.getAttribute('data-projection-owner'),
      element.getAttribute('data-projection-generation')
    );
  }
}

function observeExternalProjectionPortals(
  document: Document,
  ownerId: string,
  generation: number,
  reconcile: () => void
): () => void {
  const view = document.defaultView;
  if (!view) return () => {};

  let state = portalObserverStates.get(document);
  if (!state) {
    const registrations = new Set<PortalObserverRegistration>();
    const observer = new view.MutationObserver((records) => {
      const affectedCoordinates = new Set<string>();
      for (const record of records) {
        if (record.type === 'attributes' && record.target instanceof view.Element) {
          const target = record.target;
          const currentOwnerId = target.getAttribute('data-projection-owner');
          const currentGeneration = target.getAttribute('data-projection-generation');
          addPortalCoordinate(affectedCoordinates, currentOwnerId, currentGeneration);
          if (record.attributeName === 'data-projection-owner') {
            addPortalCoordinate(affectedCoordinates, record.oldValue, currentGeneration);
          } else if (record.attributeName === 'data-projection-generation') {
            addPortalCoordinate(affectedCoordinates, currentOwnerId, record.oldValue);
          }
          continue;
        }
        for (const node of record.addedNodes) {
          collectPortalCoordinates(node, view, affectedCoordinates);
        }
        for (const node of record.removedNodes) {
          collectPortalCoordinates(node, view, affectedCoordinates);
        }
      }

      for (const registration of registrations) {
        if (
          !affectedCoordinates.has(
            portalCoordinateKey(registration.ownerId, registration.generation)
          )
        ) {
          continue;
        }
        try {
          registration.reconcile();
        } catch (error) {
          console.error(
            '[PrototypePreviewer] Failed to reconcile external projection portals.',
            error
          );
        }
      }
    });
    state = { observer, registrations };
    portalObserverStates.set(document, state);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ['data-projection-owner', 'data-projection-generation'],
    });
  }

  const registration: PortalObserverRegistration = {
    ownerId,
    generation: String(generation),
    reconcile,
  };
  state.registrations.add(registration);
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    const current = portalObserverStates.get(document);
    if (!current) return;
    current.registrations.delete(registration);
    if (current.registrations.size === 0) {
      current.observer.disconnect();
      portalObserverStates.delete(document);
    }
  };
}

function setGenerationVisibility(host: HTMLElement, visible: boolean): void {
  host.inert = !visible;
  host.dataset.projectionGenerationState = visible ? 'active' : 'staging';
  // The Website owns this generation wrapper as an atomic paint boundary.
  // Keep its opacity swap outside every page transition/animation rule so a
  // candidate can never fade or expand into view during activation.
  host.style.setProperty('transition', 'none', 'important');
  host.style.setProperty('animation', 'none', 'important');
  if (visible) {
    host.removeAttribute('aria-hidden');
    host.style.removeProperty('position');
    host.style.removeProperty('inset');
    host.style.removeProperty('opacity');
    host.style.removeProperty('pointer-events');
    host.style.removeProperty('z-index');
  } else {
    // Keep staging connected and fully laid out so framework mounts, anchor
    // measurements, and portal preparation observe real geometry without
    // exposing a partial generation. Opacity suppresses paint without
    // inheriting into Prototype roots as visibility would, so Adapter reveal
    // readiness remains observable before this wrapper activates.
    host.setAttribute('aria-hidden', 'true');
    host.style.position = 'absolute';
    host.style.inset = '0';
    host.style.setProperty('opacity', '0', 'important');
    host.style.pointerEvents = 'none';
    host.style.zIndex = '-1';
  }
}

/**
 * Prepare a complete connected-but-inert Website projection generation.
 * The returned activation is synchronous so the controller can commit its
 * coordinates in the same task as the DOM swap.
 */
export async function materializeProjectionCandidate(
  request: ProjectionScopeMaterializeRequest,
  options: ProjectionMaterializerOptions
): Promise<MaterializedProjectionCandidate> {
  const preparation = backgroundPreparationTask(options);
  if (preparation) await preparation;
  options.backgroundPreparation?.signal.throwIfAborted();
  const source = options.themeSource;
  if (!source?.isCurrent()) return prepareProjectionCandidate(request, options);

  let theme!: ProjectionThemeSurfaceStyle;
  let candidate: MaterializedProjectionCandidate | undefined;
  const assertCurrentAcquisition = () => {
    options.backgroundPreparation?.signal.throwIfAborted();
    if (!source.isCurrent())
      throw new DOMException(
        '[PrototypePreviewer] The themed projection owner was retired.',
        'AbortError'
      );
  };
  // A preference event can synchronously lock several old generations. Read
  // their live themes together after those writes, before any new preparation
  // resumes. Each scope still reads its own computed values; nothing is cached
  // across owners or deliveries.
  const stopTheme = await scheduleProjectionThemeRead(source.scope, () => {
    assertCurrentAcquisition();
    return watchProjectionThemeSurfaceStyle(source.family, source.scope, (next) => {
      theme = next;
      if (source.isCurrent()) candidate?.setThemeSurfaceStyle(next);
    });
  });
  const initialTheme = theme;
  try {
    // Another callback in the read batch may retire this owner before this
    // promise continues. Release its newly acquired watch without rendering.
    assertCurrentAcquisition();
    const prepared = await prepareProjectionCandidate(request, options, initialTheme);
    candidate = prepared;
    if (!source.isCurrent()) {
      stopTheme();
      return prepared;
    }
    if (theme !== initialTheme) prepared.setThemeSurfaceStyle(theme);
    return {
      ...prepared,
      async dispose() {
        stopTheme();
        await prepared.dispose();
      },
    };
  } catch (error) {
    stopTheme();
    try {
      await candidate?.dispose();
    } catch (cleanupError) {
      console.error('[PrototypePreviewer] Failed to dispose a themed candidate.', cleanupError);
    }
    throw error;
  }
}

async function prepareProjectionCandidate(
  request: ProjectionScopeMaterializeRequest,
  options: ProjectionMaterializerOptions,
  initialTheme?: ProjectionThemeSurfaceStyle
): Promise<MaterializedProjectionCandidate> {
  if (!isRuntimeId(request.selection.runtimeId)) {
    throw new Error(
      `[PrototypePreviewer] projection Runtime "${request.selection.runtimeId}" is not registered.`
    );
  }
  const runtimeId: RuntimeId = request.selection.runtimeId;
  const projectionFamilyId = request.selection.projectionFamilyId as ProjectionFamilyId;
  const familyManifest = PROJECTION_FAMILY_MANIFESTS[
    projectionFamilyId
  ] as ProjectionFamilyManifest;
  if (!familyManifest) {
    throw new Error(
      `[PrototypePreviewer] projection family "${request.selection.projectionFamilyId}" is not registered.`
    );
  }
  const componentManifest = familyManifest.families[options.componentId];
  if (!componentManifest) {
    throw new Error(
      `[PrototypePreviewer] projection family ${projectionFamilyId} has no component recipe for ${options.componentId}.`
    );
  }

  const themeSurfaceStyle =
    initialTheme ?? resolveProjectionThemeSurfaceStyle(projectionFamilyId, options.mount);
  const childDemo = options.content?.demo ?? (await loadDemo(componentManifest.recipeId));
  // Seed the scope in the renderer's mount so the initial theme and subtree
  // reach ancestor observers in the same delivery.
  const seed = options.mount.ownerDocument.createElement('div').style;
  for (const [property, value] of Object.entries(themeSurfaceStyle))
    seed.setProperty(property, value);
  const composition = createProjectionComposition({
    ownerId: options.ownerId,
    runtimeId,
    projectionFamilyId,
    generation: request.generation,
    componentId: options.componentId,
    childDemo,
    contentRecipe: options.content?.recipe,
    controls: options.controls,
    controlIds: options.controlIds,
    sealOutgoingPortals: options.sealOutgoingPortals,
    themeSurfaceStyle,
    scopeInlineStyle: seed.cssText,
    locked: true,
    eventGateOpen: false,
  });

  const prototypeIds = new Set<string>();
  collectPrototypeIds(composition.demo.root, prototypeIds);
  await Promise.all([loadPrototypes(Array.from(prototypeIds)), prepareDemoRuntime(runtimeId)]);
  // Shared dependency completion can otherwise start every independent
  // framework render in the same foreground turn.
  const renderPreparation = backgroundPreparationTask(options);
  if (renderPreparation) await renderPreparation;
  options.backgroundPreparation?.signal.throwIfAborted();

  const host = options.mount.ownerDocument.createElement('div');
  host.className = 'pui-projection-generation';
  host.dataset.projectionGenerationHost = String(request.generation);
  host.dataset.projectionOwnerHost = options.ownerId;
  setGenerationVisibility(host, false);
  options.mount.appendChild(host);

  let renderResult: Awaited<ReturnType<typeof renderDemo>> | null = null;
  let disposed = false;
  let projectionLocked = false;
  const reconcileCandidateExternalPortals = (): void => {
    const visible =
      !disposed && !projectionLocked && host.dataset.projectionGenerationState === 'active';
    for (const root of externalProjectionPortalRoots(
      options.mount,
      options.ownerId,
      request.generation
    )) {
      if (visible) unlockExternalPortalRoot(root);
      else lockExternalPortalRoot(root);
    }
  };
  const stopObservingExternalPortals = observeExternalProjectionPortals(
    options.mount.ownerDocument,
    options.ownerId,
    request.generation,
    reconcileCandidateExternalPortals
  );
  const teardownCandidate = async (): Promise<void> => {
    compositionFocusRestorers.delete(host);
    let teardownFailed = false;
    let teardownFailure: unknown;
    const recordFailure = (error: unknown): void => {
      if (!teardownFailed) {
        teardownFailed = true;
        teardownFailure = error;
      }
    };
    const attempt = (operation: () => void): void => {
      try {
        operation();
      } catch (error) {
        recordFailure(error);
      }
    };

    attempt(() => composition.setEventGateOpen(false));
    attempt(() => composition.setLocked(true));
    attempt(reconcileCandidateExternalPortals);
    try {
      if (renderResult) await renderResult.destroy();
      else releaseHostMount(host);
    } catch (error) {
      recordFailure(error);
    }
    attempt(stopObservingExternalPortals);
    attempt(() =>
      removeExternalGenerationSurfaces(options.mount, options.ownerId, request.generation)
    );
    attempt(() => host.remove());

    if (teardownFailed) throw teardownFailure;
  };
  try {
    renderResult = await renderDemo({
      runtime: runtimeId,
      demo: composition.demo,
      host,
      ...(options.automaticMaterialScene === false ? { automaticMaterialScene: false } : {}),
    });
    const scope = Array.from(host.querySelectorAll<HTMLElement>('[data-projection-scope]')).find(
      (element) => element.dataset.projectionScope === options.ownerId
    );
    if (!scope) {
      throw new Error('[PrototypePreviewer] materialized projection scope root is missing.');
    }
    applyProjectionThemeSurfaceStyle(scope, themeSurfaceStyle);
    // Release Prototype-owned disabled state while the candidate is still
    // connected, hidden, and inert. One paint lets framework Adapters commit
    // that update before activation exposes the generation.
    composition.setLocked(false);
    reconcileCandidateExternalPortals();
    await nextPaint(host, options.yieldAfterPaint);
    options.backgroundPreparation?.signal.throwIfAborted();
    reconcileCandidateExternalPortals();

    const candidate: MaterializedProjectionCandidate = {
      host,
      scope,
      activate() {
        if (disposed) {
          throw new Error('[PrototypePreviewer] cannot activate a disposed projection generation.');
        }
        for (const generationHost of generationHosts(options.mount, options.ownerId)) {
          setGenerationVisibility(generationHost, generationHost === host);
        }
        for (const root of externalProjectionPortalRoots(options.mount, options.ownerId)) {
          if (
            !projectionLocked &&
            root.getAttribute('data-projection-generation') === String(request.generation)
          ) {
            unlockExternalPortalRoot(root);
          } else {
            lockExternalPortalRoot(root);
          }
        }
        if (projectionLocked) host.inert = true;
        composition.setEventGateOpen(!projectionLocked);
      },
      setLocked(locked) {
        if (disposed) return;
        projectionLocked = locked;
        if (locked) composition.setEventGateOpen(false);
        composition.setLocked(locked);
        if (locked) host.inert = true;
        else if (host.dataset.projectionGenerationState === 'active') host.inert = false;
        reconcileCandidateExternalPortals();
        if (!locked && host.dataset.projectionGenerationState === 'active') {
          composition.setEventGateOpen(true);
        }
      },
      setThemeSurfaceStyle(theme) {
        if (disposed) return;
        composition.setThemeSurfaceStyle(theme);
        applyProjectionThemeSurfaceStyle(scope, theme);
      },
      sealExternalPortals() {
        if (disposed) return;
        sealExternalProjectionPortals(options.mount, options.ownerId, request.generation);
      },
      async dispose() {
        if (disposed) return;
        disposed = true;
        projectionLocked = true;
        await teardownCandidate();
      },
    };
    compositionFocusRestorers.set(host, (key) => {
      if (disposed || projectionLocked || !host.isConnected || host.inert) return false;
      return composition.restoreFocus(key);
    });
    return candidate;
  } catch (error) {
    disposed = true;
    projectionLocked = true;
    try {
      await teardownCandidate();
    } catch (teardownError) {
      console.error(
        '[PrototypePreviewer] Failed to clean up a projection candidate after preparation failure.',
        teardownError
      );
    }
    throw error;
  }
}

const CONTROL_BY_FOCUS_KEY: Readonly<Record<ProjectionFocusKey, string>> = Object.freeze({
  [PROJECTION_FOCUS_KEYS.runtime]: 'runtime',
  [PROJECTION_FOCUS_KEYS.family]: 'family',
  [PROJECTION_FOCUS_KEYS.component]: 'component',
});

export function restoreProjectionControlFocus(
  mount: HTMLElement,
  focusKey: string,
  generation: number,
  focusOrigin: Element | null = null
): void {
  const document = mount.ownerDocument;
  const controlId = CONTROL_BY_FOCUS_KEY[focusKey as ProjectionFocusKey];
  if (!controlId) return;
  const ownerId = mount.dataset.projectionOwner ?? '';
  const activeElement = document.activeElement;
  const focusOriginOwner = focusOrigin
    ?.closest('[data-projection-owner]')
    ?.getAttribute('data-projection-owner');
  const teardownFallback =
    focusOrigin !== null &&
    (activeElement === document.body || activeElement === document.documentElement) &&
    (!focusOrigin.isConnected || focusOriginOwner === mount.dataset.projectionOwner);
  if (focusOrigin !== null && activeElement !== focusOrigin && !teardownFallback) return;
  let newerFocusAcquired = false;
  const handleFocusIn = (): void => {
    newerFocusAcquired = true;
  };
  document.addEventListener('focusin', handleFocusIn, true);
  const restore = () => {
    document.removeEventListener('focusin', handleFocusIn, true);
    if (newerFocusAcquired) return;
    if (!mount.isConnected || mount.dataset.projectionOwner !== ownerId) return;
    const activeHost = generationHosts(mount, ownerId).find(
      (host) =>
        host.dataset.projectionGenerationState === 'active' &&
        host.dataset.projectionGenerationHost === String(generation)
    );
    if (activeHost) compositionFocusRestorers.get(activeHost)?.(focusKey as ProjectionFocusKey);
  };
  const view = document.defaultView;
  if (view?.requestAnimationFrame) view.requestAnimationFrame(restore);
  else queueMicrotask(restore);
}
