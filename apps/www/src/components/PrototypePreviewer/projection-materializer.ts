import { loadDemo } from './demo-modules';
import { prepareDemoRuntime, renderDemo } from './demo-renderer';
import { collectPrototypeIds } from './demo-types';
import {
  createProjectionComposition,
  PROJECTION_FOCUS_KEYS,
  type ProjectionControlId,
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
  type ProjectionThemeSurfaceStyle,
} from './projection-theme';
import { loadPrototypes } from './prototype-modules';
import { releaseHostMount } from './runtimes/host-mount';
import { isRuntimeId, type RuntimeId } from './runtimes/registry';

export type ProjectionMaterializerOptions = Readonly<{
  mount: HTMLElement;
  ownerId: string;
  componentId: ProjectionComponentId;
  controls: ProjectionCompositionControls;
  controlIds?: readonly ProjectionControlId[];
}>;

export type MaterializedProjectionCandidate = ProjectionScopeCandidate &
  Readonly<{
    host: HTMLElement;
    scope: HTMLElement;
    setThemeSurfaceStyle(theme: ProjectionThemeSurfaceStyle): void;
  }>;

function nextPaint(element: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const view = element.ownerDocument.defaultView;
    if (view?.requestAnimationFrame) view.requestAnimationFrame(() => resolve());
    else queueMicrotask(resolve);
  });
}

function generationHosts(mount: HTMLElement, ownerId: string): HTMLElement[] {
  return Array.from(
    mount.querySelectorAll<HTMLElement>('[data-projection-generation-host]')
  ).filter((host) => host.dataset.projectionOwnerHost === ownerId);
}

type InlineStyleSnapshot = Readonly<{
  value: string;
  priority: string;
}>;

type ExternalPortalVisibilitySnapshot = Readonly<{
  inert: boolean;
  ariaHidden: string | null;
  visibility: InlineStyleSnapshot;
  pointerEvents: InlineStyleSnapshot;
}>;

const externalPortalVisibilitySnapshots = new WeakMap<
  HTMLElement,
  ExternalPortalVisibilitySnapshot
>();

function inlineStyleSnapshot(element: HTMLElement, property: string): InlineStyleSnapshot {
  return {
    value: element.style.getPropertyValue(property),
    priority: element.style.getPropertyPriority(property),
  };
}

function restoreInlineStyle(
  element: HTMLElement,
  property: string,
  snapshot: InlineStyleSnapshot
): void {
  if (snapshot.value) element.style.setProperty(property, snapshot.value, snapshot.priority);
  else element.style.removeProperty(property);
}

function lockExternalPortalRoot(root: HTMLElement): void {
  if (!externalPortalVisibilitySnapshots.has(root)) {
    externalPortalVisibilitySnapshots.set(root, {
      inert: root.inert,
      ariaHidden: root.getAttribute('aria-hidden'),
      visibility: inlineStyleSnapshot(root, 'visibility'),
      pointerEvents: inlineStyleSnapshot(root, 'pointer-events'),
    });
  }
  root.inert = true;
  root.setAttribute('aria-hidden', 'true');
  root.style.setProperty('visibility', 'hidden', 'important');
  root.style.setProperty('pointer-events', 'none', 'important');
}

function unlockExternalPortalRoot(root: HTMLElement): void {
  const snapshot = externalPortalVisibilitySnapshots.get(root);
  if (!snapshot) return;
  root.inert = snapshot.inert;
  if (snapshot.ariaHidden === null) root.removeAttribute('aria-hidden');
  else root.setAttribute('aria-hidden', snapshot.ariaHidden);
  restoreInlineStyle(root, 'visibility', snapshot.visibility);
  restoreInlineStyle(root, 'pointer-events', snapshot.pointerEvents);
  externalPortalVisibilitySnapshots.delete(root);
}

function externalProjectionPortalRoots(
  mount: HTMLElement,
  ownerId: string,
  generation?: number
): HTMLElement[] {
  const generationValue = generation === undefined ? undefined : String(generation);
  const ownsGeneration = (element: Element): boolean =>
    element.getAttribute('data-projection-owner') === ownerId &&
    (generationValue === undefined ||
      element.getAttribute('data-projection-generation') === generationValue);
  const sameOwnedGeneration = (left: Element, right: Element): boolean =>
    left.getAttribute('data-projection-owner') === right.getAttribute('data-projection-owner') &&
    left.getAttribute('data-projection-generation') ===
      right.getAttribute('data-projection-generation');
  const externalSurfaces = Array.from(
    mount.ownerDocument.querySelectorAll<HTMLElement>(
      '[data-projection-owner][data-projection-generation]'
    )
  ).filter((element) => !mount.contains(element) && ownsGeneration(element));

  return externalSurfaces.filter((surface) => {
    let ancestor = surface.parentElement;
    while (ancestor && !mount.contains(ancestor)) {
      if (sameOwnedGeneration(surface, ancestor)) return false;
      ancestor = ancestor.parentElement;
    }
    return true;
  });
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

function removeExternalGenerationSurfaces(
  mount: HTMLElement,
  ownerId: string,
  generation: number
): void {
  for (const root of externalProjectionPortalRoots(mount, ownerId, generation)) {
    externalPortalVisibilitySnapshots.delete(root);
    root.remove();
  }
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

  const themeSurfaceStyle = resolveProjectionThemeSurfaceStyle(
    projectionFamilyId,
    options.mount.ownerDocument
  );
  const childDemo = await loadDemo(componentManifest.recipeId);
  const composition = createProjectionComposition({
    ownerId: options.ownerId,
    runtimeId,
    projectionFamilyId,
    generation: request.generation,
    componentId: options.componentId,
    childDemo,
    controls: options.controls,
    controlIds: options.controlIds,
    themeSurfaceStyle,
    locked: true,
    eventGateOpen: false,
  });

  const prototypeIds = new Set<string>();
  collectPrototypeIds(composition.demo.root, prototypeIds);
  await Promise.all([loadPrototypes(Array.from(prototypeIds)), prepareDemoRuntime(runtimeId)]);

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
    await nextPaint(host);
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
      async dispose() {
        if (disposed) return;
        disposed = true;
        projectionLocked = true;
        await teardownCandidate();
      },
    };
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
  generation: number
): void {
  const document = mount.ownerDocument;
  const controlId = CONTROL_BY_FOCUS_KEY[focusKey as ProjectionFocusKey];
  if (!controlId) return;
  let newerFocusAcquired = false;
  const handleFocusIn = (): void => {
    newerFocusAcquired = true;
  };
  document.addEventListener('focusin', handleFocusIn, true);
  const restore = () => {
    document.removeEventListener('focusin', handleFocusIn, true);
    if (newerFocusAcquired) return;
    const activeHost = generationHosts(mount, mount.dataset.projectionOwner ?? '').find(
      (host) =>
        host.dataset.projectionGenerationState === 'active' &&
        host.dataset.projectionGenerationHost === String(generation)
    );
    activeHost
      ?.querySelector<HTMLElement>(`[data-projection-control="${controlId}"] [role="combobox"]`)
      ?.focus();
  };
  const view = document.defaultView;
  if (view?.requestAnimationFrame) view.requestAnimationFrame(restore);
  else queueMicrotask(restore);
}
