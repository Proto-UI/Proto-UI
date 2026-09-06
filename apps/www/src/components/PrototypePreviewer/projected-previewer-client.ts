import { PREFERRED_ADAPTER_EVENT, PREFERRED_ADAPTER_KEY } from '../adapter-preference';
import { refreshCodePanel } from './code-panel-client';
import {
  PROJECTION_FOCUS_KEYS,
  type ProjectionCompositionControls,
} from './projection-composition';
import type { ProjectionComponentId, ProjectionFamilyId } from './projection-families';
import {
  materializeProjectionCandidate,
  restoreProjectionControlFocus,
  type MaterializedProjectionCandidate,
} from './projection-materializer';
import {
  createProjectionScopeController,
  type ProjectionScopeController,
  type ProjectionScopeSnapshot,
} from './projection-scope';
import {
  resolveProjectionThemeSurfaceStyle,
  watchProjectionThemeSurfaceStyle,
} from './projection-theme';
import { isRuntimeId, type RuntimeId } from './runtimes/registry';

export type ProjectedPreviewerOptions = Readonly<{
  root: HTMLElement;
  initialRuntime: RuntimeId;
  runtimeList: RuntimeId[];
  projectionFamilyId: ProjectionFamilyId;
  componentId: ProjectionComponentId;
  toolbar: boolean;
}>;

type AdapterPreferenceDetail = Readonly<{
  adapter?: unknown;
  source?: unknown;
}>;

const RUNTIME_LABELS: Readonly<Record<RuntimeId, string>> = Object.freeze({
  wc: 'Web Components',
  react: 'React',
  vue: 'Vue',
  vue2: 'Vue 2',
});

function dispatch(root: HTMLElement, name: string, detail: unknown): void {
  root.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
}

function preferredRuntime(
  root: HTMLElement,
  initialRuntime: RuntimeId,
  runtimeList: readonly RuntimeId[]
): RuntimeId {
  try {
    const preferred = root.ownerDocument.defaultView?.localStorage.getItem(PREFERRED_ADAPTER_KEY);
    if (isRuntimeId(preferred) && runtimeList.includes(preferred)) return preferred;
  } catch {
    // Storage is optional; the in-document preference event remains authoritative.
  }
  return initialRuntime;
}

/**
 * Mount a cataloged demo as one fixed-family projection generation.
 *
 * Runtime selection is rendered by that family's Select Prototype and a
 * switch rematerializes both the control and child recipe atomically. Family
 * and component coordinates are intentionally fixed by the caller.
 */
export function initProjectedPreviewer(options: ProjectedPreviewerOptions): void {
  const { root, runtimeList, projectionFamilyId, componentId, toolbar } = options;
  if (root.dataset.inited === '1') {
    console.warn('[PrototypePreviewer] already initialized:', root.dataset.previewerId);
    return;
  }
  root.dataset.inited = '1';

  const mount = root.querySelector<HTMLElement>('.host');
  if (!mount) {
    throw new Error('[PrototypePreviewer] fixed-family projection mount is missing.');
  }
  const initialRuntime = preferredRuntime(root, options.initialRuntime, runtimeList);
  const ownerId =
    root.dataset.projectionOwner ||
    root.dataset.previewerId ||
    `prototype-previewer-${projectionFamilyId}-${componentId}`;
  mount.dataset.projectionOwner = ownerId;

  let desiredRuntimeId = initialRuntime;
  let desiredIntentRevision = 0;
  let controller!: ProjectionScopeController;
  let destroyed = false;
  let requestEpoch = 0;
  let mounted = false;
  let startPromise: Promise<ProjectionScopeSnapshot> | null = null;
  let destroyPromise: Promise<void> | null = null;
  let initialErrorSurface: HTMLElement | null = null;
  let latestCommittedGeneration = 0;
  let latestMaterializationGeneration = 0;
  let activeCandidate: MaterializedProjectionCandidate | null = null;
  let stopThemeWatcher: (() => void) | null = null;
  const candidateByGeneration = new Map<number, MaterializedProjectionCandidate>();
  const codeHighlights: Record<string, string> = root.dataset.codeHighlights
    ? JSON.parse(root.dataset.codeHighlights)
    : {};

  const setState = (state: 'loading' | 'ready' | 'error'): void => {
    root.dataset.projectionState = state;
    mount.setAttribute('aria-busy', String(state === 'loading'));
  };
  const renderInitialError = (error: unknown): void => {
    const pre = root.ownerDocument.createElement('pre');
    const detail = error instanceof Error ? error.stack || error.message : String(error);
    pre.textContent = `[Preview Error]\n${detail}`;
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.color = 'crimson';
    initialErrorSurface = pre;
    mount.replaceChildren(pre);
  };

  const updateCodePanel = (runtimeId: RuntimeId): void => {
    const codeContent = root.querySelector<HTMLElement>('[data-code-content]');
    const html = codeHighlights[runtimeId];
    if (!codeContent || !html) return;
    codeContent.innerHTML = html;
    const shell = codeContent.closest<HTMLElement>('[data-code-shell]');
    if (shell) refreshCodePanel(shell, { reset: true });
  };

  const ensureStarted = (): Promise<ProjectionScopeSnapshot> => {
    const snapshot = controller.getSnapshot();
    if (snapshot.generation > 0) return Promise.resolve(snapshot);
    if (startPromise) return startPromise;
    startPromise = controller.start().finally(() => {
      startPromise = null;
    });
    return startPromise;
  };

  const observeRequest = (
    promise: Promise<ProjectionScopeSnapshot>,
    targetRuntimeId: RuntimeId
  ): Promise<ProjectionScopeSnapshot> => {
    const epoch = ++requestEpoch;
    setState('loading');
    void promise.then(
      () => {
        if (destroyed || epoch !== requestEpoch) return;
        const snapshot = controller.getSnapshot();
        if (snapshot.phase === 'ready') setState('ready');
      },
      (error) => {
        if (destroyed || epoch !== requestEpoch) return;
        const snapshot = controller.getSnapshot();
        if (snapshot.generation === 0) renderInitialError(error);
        desiredRuntimeId = snapshot.selection.runtimeId as RuntimeId;
        desiredIntentRevision += 1;
        setState('error');
        console.error(error);
        dispatch(root, 'error', { error, runtime: targetRuntimeId });
      }
    );
    return promise;
  };

  const requestRuntime = (
    runtimeId: RuntimeId,
    requestOptions: Readonly<{ broadcast?: boolean; restoreFocus?: boolean }> = {}
  ): Promise<ProjectionScopeSnapshot> => {
    if (destroyed) return Promise.resolve(controller.getSnapshot());
    if (!runtimeList.includes(runtimeId)) return Promise.resolve(controller.getSnapshot());
    if (runtimeId === desiredRuntimeId && controller.getSnapshot().phase !== 'idle') {
      return Promise.resolve(controller.getSnapshot());
    }

    desiredRuntimeId = runtimeId;
    const revision = ++desiredIntentRevision;

    const requestAfterStart = (
      snapshot: ProjectionScopeSnapshot
    ): Promise<ProjectionScopeSnapshot> => {
      if (destroyed || revision !== desiredIntentRevision) {
        return Promise.resolve(controller.getSnapshot());
      }
      if (snapshot.selection.runtimeId === runtimeId && snapshot.phase === 'ready') {
        return Promise.resolve(snapshot);
      }
      return controller.request(
        { runtimeId },
        requestOptions.restoreFocus ? { focusKey: PROJECTION_FOCUS_KEYS.runtime } : undefined
      );
    };
    const snapshot = controller.getSnapshot();
    // Once the first generation exists, enter controller.request() in this
    // stack so its current-generation lock seals open portals before the
    // caller can observe the switch. Only initial start needs deferred replay.
    const request =
      snapshot.phase !== 'idle'
        ? requestAfterStart(snapshot)
        : ensureStarted().then(requestAfterStart);
    const observed = observeRequest(request, runtimeId);

    // Publish the preference only after a ready generation has synchronously
    // entered controller.request() and sealed its current request surfaces.
    if (requestOptions.broadcast) {
      try {
        root.ownerDocument.defaultView?.localStorage.setItem(PREFERRED_ADAPTER_KEY, runtimeId);
      } catch {
        // Storage is optional; dispatch still synchronizes the current document.
      }
      root.ownerDocument.dispatchEvent(
        new CustomEvent(PREFERRED_ADAPTER_EVENT, {
          detail: { adapter: runtimeId, source: root },
        })
      );
    }
    return observed;
  };

  const controls = (): ProjectionCompositionControls => ({
    runtime: {
      label: 'Runtime',
      options: runtimeList.map((runtimeId) => ({
        value: runtimeId,
        label: RUNTIME_LABELS[runtimeId],
      })),
      onValueChange(runtimeId) {
        void requestRuntime(runtimeId, { broadcast: true, restoreFocus: true });
      },
    },
    family: {
      label: 'Component Library',
      options: [{ value: projectionFamilyId, label: projectionFamilyId }],
      onValueChange() {},
    },
    component: {
      label: 'Component',
      options: [{ value: componentId, label: componentId }],
      onValueChange() {},
    },
  });

  controller = createProjectionScopeController({
    initialSelection: {
      runtimeId: initialRuntime,
      projectionFamilyId,
    },
    async materialize(request) {
      latestMaterializationGeneration = Math.max(
        latestMaterializationGeneration,
        request.generation
      );
      for (const generation of candidateByGeneration.keys()) {
        if (generation > latestCommittedGeneration && generation < request.generation) {
          candidateByGeneration.delete(generation);
        }
      }
      const intentRevision = desiredIntentRevision;
      const candidate = await materializeProjectionCandidate(request, {
        mount,
        ownerId,
        componentId,
        controls: controls(),
        controlIds: toolbar ? ['runtime'] : [],
      });
      if (
        !destroyed &&
        intentRevision === desiredIntentRevision &&
        request.generation === latestMaterializationGeneration &&
        request.generation >= latestCommittedGeneration
      ) {
        candidateByGeneration.set(request.generation, candidate);
      }
      return candidate;
    },
    prepareCommit(commit) {
      const committedRuntimeId = commit.selection.runtimeId as RuntimeId;
      const candidate = candidateByGeneration.get(commit.generation);
      if (!candidate) {
        throw new Error(
          `[PrototypePreviewer] projection candidate ${commit.generation} is unavailable for commit preparation.`
        );
      }

      const previousLatestCommittedGeneration = latestCommittedGeneration;
      const previousActiveCandidate = activeCandidate;
      const previousStopThemeWatcher = stopThemeWatcher;
      const previousMounted = mounted;
      const retainedCandidateEntries = Array.from(candidateByGeneration.entries()).filter(
        ([generation]) => generation <= previousLatestCommittedGeneration
      );
      const previousDataset = {
        family: root.dataset.projectionFamily,
        component: root.dataset.projectionComponent,
        runtime: root.dataset.projectionRuntime,
        state: root.dataset.projectionState,
      };
      const previousAriaBusy = mount.getAttribute('aria-busy');
      const skeleton = mount.querySelector<HTMLElement>('.proto-previewer__skeleton');
      const skeletonParent = skeleton?.parentNode ?? null;
      const skeletonNextSibling = skeleton?.nextSibling ?? null;
      let preparedStopThemeWatcher: (() => void) | null = null;
      let watcherPublished = false;

      try {
        candidate.setThemeSurfaceStyle(
          resolveProjectionThemeSurfaceStyle(projectionFamilyId, root.ownerDocument)
        );
        if (!previousStopThemeWatcher) {
          preparedStopThemeWatcher = watchProjectionThemeSurfaceStyle(
            projectionFamilyId,
            root.ownerDocument,
            (theme) => {
              if (
                watcherPublished &&
                stopThemeWatcher === preparedStopThemeWatcher &&
                activeCandidate
              ) {
                activeCandidate.setThemeSurfaceStyle(theme);
              }
            }
          );
        }
      } catch (error) {
        preparedStopThemeWatcher?.();
        candidateByGeneration.delete(commit.generation);
        throw error;
      }

      const restoreDatasetValue = (key: string, value: string | undefined): void => {
        if (value === undefined) delete root.dataset[key];
        else root.dataset[key] = value;
      };

      return {
        publish() {
          const shouldDispatchMounted = !mounted;
          latestCommittedGeneration = commit.generation;
          activeCandidate = candidate;
          if (preparedStopThemeWatcher) {
            watcherPublished = true;
            stopThemeWatcher = preparedStopThemeWatcher;
          }
          for (const generation of Array.from(candidateByGeneration.keys())) {
            if (generation < commit.generation) candidateByGeneration.delete(generation);
          }
          root.dataset.projectionFamily = projectionFamilyId;
          root.dataset.projectionComponent = componentId;
          root.dataset.projectionRuntime = committedRuntimeId;
          setState('ready');
          skeleton?.remove();
          initialErrorSurface?.remove();
          initialErrorSurface = null;
          mounted = true;

          queueMicrotask(() => {
            if (
              destroyed ||
              latestCommittedGeneration !== commit.generation ||
              activeCandidate !== candidate
            ) {
              return;
            }
            try {
              updateCodePanel(committedRuntimeId);
            } catch (error) {
              console.error(error);
            }
            try {
              dispatch(root, 'runtime:changed', { id: committedRuntimeId });
              if (shouldDispatchMounted) {
                dispatch(root, 'previewer:mounted', { runtime: committedRuntimeId });
              }
            } catch (error) {
              console.error(error);
            }
          });
        },
        rollback() {
          watcherPublished = false;
          preparedStopThemeWatcher?.();
          latestCommittedGeneration = previousLatestCommittedGeneration;
          activeCandidate = previousActiveCandidate;
          stopThemeWatcher = previousStopThemeWatcher;
          mounted = previousMounted;
          for (const generation of Array.from(candidateByGeneration.keys())) {
            if (generation > previousLatestCommittedGeneration && generation <= commit.generation) {
              candidateByGeneration.delete(generation);
            }
          }
          for (const [generation, retainedCandidate] of retainedCandidateEntries) {
            candidateByGeneration.set(generation, retainedCandidate);
          }
          restoreDatasetValue('projectionFamily', previousDataset.family);
          restoreDatasetValue('projectionComponent', previousDataset.component);
          restoreDatasetValue('projectionRuntime', previousDataset.runtime);
          restoreDatasetValue('projectionState', previousDataset.state);
          if (previousAriaBusy === null) mount.removeAttribute('aria-busy');
          else mount.setAttribute('aria-busy', previousAriaBusy);
          if (skeleton && skeletonParent && !skeleton.isConnected) {
            const insertionPoint =
              skeletonNextSibling?.parentNode === skeletonParent ? skeletonNextSibling : null;
            skeletonParent.insertBefore(skeleton, insertionPoint);
          }
        },
      };
    },
    restoreFocus(focusKey, commit) {
      restoreProjectionControlFocus(mount, focusKey, commit.generation);
    },
  });

  const onAdapterChange = (event: Event): void => {
    const detail = (event as CustomEvent<AdapterPreferenceDetail>).detail;
    const runtimeId = detail?.adapter;
    if (
      detail?.source === root ||
      !isRuntimeId(runtimeId) ||
      !runtimeList.includes(runtimeId) ||
      runtimeId === desiredRuntimeId
    ) {
      return;
    }
    void requestRuntime(runtimeId);
  };
  root.ownerDocument.addEventListener(PREFERRED_ADAPTER_EVENT, onAdapterChange);

  let removalObserver!: MutationObserver;
  const destroy = (): Promise<void> => {
    if (destroyPromise) return destroyPromise;
    destroyPromise = (async () => {
      destroyed = true;
      requestEpoch += 1;
      stopThemeWatcher?.();
      stopThemeWatcher = null;
      activeCandidate = null;
      candidateByGeneration.clear();
      removalObserver.disconnect();
      root.ownerDocument.removeEventListener(PREFERRED_ADAPTER_EVENT, onAdapterChange);
      await controller.destroy();
      mount.replaceChildren();
    })();
    return destroyPromise;
  };

  removalObserver = new MutationObserver(() => {
    if (!root.isConnected) void destroy();
  });
  removalObserver.observe(root.ownerDocument.body, { childList: true, subtree: true });

  (root as HTMLElement & { __previewer__?: unknown }).__previewer__ = {
    switchRuntime: (runtimeId: string) =>
      isRuntimeId(runtimeId)
        ? requestRuntime(runtimeId)
        : Promise.resolve(controller.getSnapshot()),
    reload: () => {
      const snapshot = controller.getSnapshot();
      const runtimeId = snapshot.selection.runtimeId as RuntimeId;
      if (snapshot.generation === 0) return observeRequest(ensureStarted(), runtimeId);
      return observeRequest(controller.request({}, { force: true }), runtimeId);
    },
    getCurrentRuntime: () => {
      const snapshot = controller.getSnapshot();
      return snapshot.generation > 0 && snapshot.phase !== 'destroyed'
        ? snapshot.selection.runtimeId
        : null;
    },
    setProps: () => {
      console.warn('[PrototypePreviewer] setProps is not supported in demo mode.');
    },
    destroy,
  };

  observeRequest(ensureStarted(), initialRuntime);
}
