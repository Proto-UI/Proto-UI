import { PREFERRED_ADAPTER_EVENT, PREFERRED_ADAPTER_KEY } from '../adapter-preference';
import {
  PROJECTION_FOCUS_KEYS,
  type ProjectionCompositionControls,
} from './projection-composition';
import {
  SHARED_BASE_FAMILY_IDS,
  resolveProjectionRecipe,
  type ProjectionFamilyId,
  type SharedBaseFamilyId,
} from './projection-families';
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

type DemoOption = Readonly<{
  id: string;
  label: string;
  description?: string;
}>;

type ProjectedDemoOption = DemoOption &
  Readonly<{
    componentId: SharedBaseFamilyId;
  }>;

type RuntimeOption = Readonly<{
  id: RuntimeId;
  label: string;
}>;

type RunnerState = 'loading' | 'ready' | 'error';

type AdapterPreferenceDetail = Readonly<{
  adapter?: unknown;
  source?: EventTarget | null;
}>;

const DEFAULT_RUNTIME_OPTIONS: readonly RuntimeOption[] = [
  { id: 'wc', label: 'Web Components' },
  { id: 'react', label: 'React' },
  { id: 'vue', label: 'Vue' },
  { id: 'vue2', label: 'Vue 2' },
];

const FAMILY_OPTIONS: ReadonlyArray<Readonly<{ id: ProjectionFamilyId; label: string }>> = [
  { id: 'shadcn', label: 'Shadcn' },
  { id: 'brutalist', label: 'Brutalist' },
];

function asSharedBaseFamilyId(familyId: string, recipeId: string): SharedBaseFamilyId {
  if (!SHARED_BASE_FAMILY_IDS.includes(familyId as SharedBaseFamilyId)) {
    throw new Error(
      `[HomeDemoPreviewer] component recipe "${recipeId}" is lane-only and cannot enter the cross-library selector.`
    );
  }
  return familyId as SharedBaseFamilyId;
}

function readPreferredRuntime(runtimeOptions: readonly RuntimeOption[]): RuntimeId | null {
  try {
    const stored = localStorage.getItem(PREFERRED_ADAPTER_KEY);
    return isRuntimeId(stored) && runtimeOptions.some((option) => option.id === stored)
      ? stored
      : null;
  } catch {
    return null;
  }
}

function readRuntimeOptions(raw: string | undefined): RuntimeOption[] {
  if (!raw) return [...DEFAULT_RUNTIME_OPTIONS];
  const parsed = JSON.parse(raw) as unknown;
  if (
    !Array.isArray(parsed) ||
    parsed.length === 0 ||
    parsed.some(
      (option) =>
        !option ||
        typeof option !== 'object' ||
        !isRuntimeId((option as RuntimeOption).id) ||
        typeof (option as RuntimeOption).label !== 'string'
    )
  ) {
    throw new Error('[HomeDemoPreviewer] runtime options contain an unsupported Runtime.');
  }
  return parsed as RuntimeOption[];
}

function readDemoOptions(raw: string | undefined): ProjectedDemoOption[] {
  const parsed = JSON.parse(raw || '[]') as unknown;
  if (
    !Array.isArray(parsed) ||
    parsed.length === 0 ||
    parsed.some(
      (option) =>
        !option ||
        typeof option !== 'object' ||
        typeof (option as DemoOption).id !== 'string' ||
        typeof (option as DemoOption).label !== 'string'
    )
  ) {
    throw new Error('[HomeDemoPreviewer] component options are missing or malformed.');
  }

  const componentIds = new Set<string>();
  return (parsed as DemoOption[]).map((option) => {
    const resolution = resolveProjectionRecipe(option.id);
    if (componentIds.has(resolution.familyId)) {
      throw new Error(
        `[HomeDemoPreviewer] component ${resolution.familyId} is declared more than once.`
      );
    }
    componentIds.add(resolution.familyId);
    return {
      ...option,
      componentId: asSharedBaseFamilyId(resolution.familyId, option.id),
    };
  });
}

export function initHomeDemoPreviewer(root: HTMLElement): void {
  if (root.dataset.inited === '1') return;
  root.dataset.inited = '1';

  const mount = root.querySelector<HTMLElement>('[data-home-demo-host]');
  const status = root.querySelector<HTMLElement>('[data-home-demo-status]');
  const description = root.querySelector<HTMLElement>('[data-home-demo-description]');
  if (!mount) {
    console.error('[HomeDemoPreviewer] projection mount is missing.');
    return;
  }

  const demoOptions = readDemoOptions(root.dataset.homeDemoOptions);
  const runtimeOptions = readRuntimeOptions(root.dataset.runtimeOptions);
  const configuredDemoId = root.dataset.initialDemoId || demoOptions[0]!.id;
  const initialDemo =
    demoOptions.find((option) => option.id === configuredDemoId) ?? demoOptions[0]!;
  const initialResolution = resolveProjectionRecipe(initialDemo.id);
  const configuredRuntimeValue = root.dataset.initialRuntime || runtimeOptions[0]!.id;
  const configuredRuntime = isRuntimeId(configuredRuntimeValue)
    ? configuredRuntimeValue
    : runtimeOptions[0]!.id;
  const initialRuntime =
    readPreferredRuntime(runtimeOptions) ??
    (runtimeOptions.some((option) => option.id === configuredRuntime)
      ? configuredRuntime
      : runtimeOptions[0]!.id);
  const ownerId = root.dataset.projectionOwner || root.id || 'home-demo-projection';
  mount.dataset.projectionOwner = ownerId;

  let desiredRuntimeId = initialRuntime;
  let desiredProjectionFamilyId = initialResolution.projectionFamilyId as ProjectionFamilyId;
  let desiredComponentId = asSharedBaseFamilyId(initialResolution.familyId, initialDemo.id);
  let committedComponentId = desiredComponentId;
  let controller!: ProjectionScopeController;
  let destroyed = false;
  let requestEpoch = 0;
  let desiredIntentRevision = 0;
  let latestCommittedGeneration = 0;
  let startPromise: Promise<ProjectionScopeSnapshot> | null = null;
  let destroyPromise: Promise<void> | null = null;
  let initialErrorSurface: HTMLElement | null = null;
  let activeCandidate: MaterializedProjectionCandidate | null = null;
  let watchedProjectionFamilyId: ProjectionFamilyId | null = null;
  let stopThemeWatcher: (() => void) | null = null;
  const componentByGeneration = new Map<number, SharedBaseFamilyId>();
  const candidateByGeneration = new Map<number, MaterializedProjectionCandidate>();

  const deleteGeneration = (generation: number): void => {
    componentByGeneration.delete(generation);
    candidateByGeneration.delete(generation);
  };

  const deleteOlderGenerations = (generation: number): void => {
    for (const candidateGeneration of Array.from(componentByGeneration.keys())) {
      if (candidateGeneration < generation) componentByGeneration.delete(candidateGeneration);
    }
    for (const candidateGeneration of Array.from(candidateByGeneration.keys())) {
      if (candidateGeneration < generation) candidateByGeneration.delete(candidateGeneration);
    }
  };

  const runtimeLabel = (runtimeId: RuntimeId): string =>
    runtimeOptions.find((option) => option.id === runtimeId)?.label ?? runtimeId;
  const componentOption = (componentId: SharedBaseFamilyId): ProjectedDemoOption | undefined =>
    demoOptions.find((option) => option.componentId === componentId);
  const setRunnerState = (state: RunnerState, runtimeId: RuntimeId): void => {
    root.dataset.runnerState = state;
    root.dataset.runnerRuntime = runtimeId;
    mount.setAttribute('aria-busy', String(state === 'loading'));
    if (!status) return;
    const stateLabel = root.dataset[`status${state[0]!.toUpperCase()}${state.slice(1)}`];
    status.textContent = `${runtimeLabel(runtimeId)} · ${stateLabel ?? state}`;
  };
  const renderInitialError = (error: unknown): void => {
    const pre = root.ownerDocument.createElement('pre');
    const detail = error instanceof Error ? error.stack || error.message : String(error);
    pre.textContent = `[Home Demo Error]\n${detail}`;
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.color = 'crimson';
    initialErrorSurface = pre;
    mount.replaceChildren(pre);
  };

  const resetDesiredToCommitted = (): ProjectionScopeSnapshot => {
    const snapshot = controller.getSnapshot();
    desiredRuntimeId = snapshot.selection.runtimeId as RuntimeId;
    desiredProjectionFamilyId = snapshot.selection.projectionFamilyId as ProjectionFamilyId;
    desiredComponentId = committedComponentId;
    desiredIntentRevision += 1;
    return snapshot;
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
  ): void => {
    const epoch = ++requestEpoch;
    setRunnerState('loading', targetRuntimeId);
    void promise.catch((error) => {
      if (destroyed || epoch !== requestEpoch) return;
      const snapshot = resetDesiredToCommitted();
      for (const generation of Array.from(componentByGeneration.keys())) {
        if (generation !== snapshot.generation) componentByGeneration.delete(generation);
      }
      for (const generation of Array.from(candidateByGeneration.keys())) {
        if (generation !== snapshot.generation) candidateByGeneration.delete(generation);
      }
      if (snapshot.generation === 0) renderInitialError(error);
      setRunnerState('error', snapshot.selection.runtimeId as RuntimeId);
      console.error(error);
    });
  };

  const requestDesiredIntent = (focusKey?: string): void => {
    const focusOrigin = focusKey ? root.ownerDocument.activeElement : null;
    const revision = desiredIntentRevision;
    const targetRuntimeId = desiredRuntimeId;
    const requestAfterStart = (
      snapshot: ProjectionScopeSnapshot
    ): Promise<ProjectionScopeSnapshot> => {
      if (destroyed || revision !== desiredIntentRevision) {
        return Promise.resolve(controller.getSnapshot());
      }

      const runtimeId = desiredRuntimeId;
      const projectionFamilyId = desiredProjectionFamilyId;
      const componentChanged = desiredComponentId !== committedComponentId;
      if (
        snapshot.phase === 'ready' &&
        snapshot.selection.runtimeId === runtimeId &&
        snapshot.selection.projectionFamilyId === projectionFamilyId &&
        !componentChanged
      ) {
        return Promise.resolve(snapshot);
      }

      return controller.request(
        { runtimeId, projectionFamilyId },
        { force: componentChanged, focusKey, focusOrigin }
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
    observeRequest(request, targetRuntimeId);
  };

  function requestRuntime(runtimeId: RuntimeId): void {
    if (destroyed || runtimeId === desiredRuntimeId) return;
    desiredRuntimeId = runtimeId;
    desiredIntentRevision += 1;
    requestDesiredIntent(PROJECTION_FOCUS_KEYS.runtime);
    try {
      localStorage.setItem(PREFERRED_ADAPTER_KEY, runtimeId);
    } catch {
      // Storage is optional; in-document synchronization remains authoritative.
    }
    root.ownerDocument.dispatchEvent(
      new CustomEvent(PREFERRED_ADAPTER_EVENT, {
        detail: { adapter: runtimeId, source: root },
      })
    );
  }

  function requestFamily(projectionFamilyId: ProjectionFamilyId): void {
    if (destroyed || projectionFamilyId === desiredProjectionFamilyId) return;
    desiredProjectionFamilyId = projectionFamilyId;
    desiredIntentRevision += 1;
    requestDesiredIntent(PROJECTION_FOCUS_KEYS.family);
  }

  function requestComponent(componentId: SharedBaseFamilyId): void {
    if (destroyed || componentId === desiredComponentId) return;
    desiredComponentId = componentId;
    desiredIntentRevision += 1;
    requestDesiredIntent(PROJECTION_FOCUS_KEYS.component);
  }

  const controlsFor = (): ProjectionCompositionControls => ({
    runtime: {
      label: root.dataset.runtimeLabel || 'Runtime',
      options: runtimeOptions.map((option) => ({ value: option.id, label: option.label })),
      onValueChange: requestRuntime,
    },
    family: {
      label: root.dataset.familyLabel || 'Component Library',
      options: FAMILY_OPTIONS.map((option) => ({ value: option.id, label: option.label })),
      onValueChange: requestFamily,
    },
    component: {
      label: root.dataset.pickerLabel || 'Component',
      options: demoOptions.map((option) => ({
        value: option.componentId,
        label: option.label,
      })),
      onValueChange: requestComponent,
    },
  });

  controller = createProjectionScopeController({
    initialSelection: {
      runtimeId: initialRuntime,
      projectionFamilyId: desiredProjectionFamilyId,
    },
    async materialize(request) {
      const componentId = desiredComponentId;
      const intentRevision = desiredIntentRevision;
      const candidate = await materializeProjectionCandidate(request, {
        mount,
        ownerId,
        componentId,
        controls: controlsFor(),
      });
      if (
        !destroyed &&
        intentRevision === desiredIntentRevision &&
        request.generation >= latestCommittedGeneration
      ) {
        componentByGeneration.set(request.generation, componentId);
        candidateByGeneration.set(request.generation, candidate);
      }
      return candidate;
    },
    prepareCommit(commit) {
      const runtimeId = commit.selection.runtimeId as RuntimeId;
      const projectionFamilyId = commit.selection.projectionFamilyId as ProjectionFamilyId;
      const componentId = componentByGeneration.get(commit.generation);
      if (!componentId) {
        deleteGeneration(commit.generation);
        throw new Error(
          `[HomeDemoPreviewer] generation ${commit.generation} component mapping is missing during commit preparation.`
        );
      }
      const candidate = candidateByGeneration.get(commit.generation);
      if (!candidate) {
        deleteGeneration(commit.generation);
        throw new Error(
          `[HomeDemoPreviewer] generation ${commit.generation} candidate is missing during commit preparation.`
        );
      }

      const previousRuntimeId = root.dataset.runnerRuntime;
      const previousRunnerState = root.dataset.runnerState;
      const previousProjectionFamily = root.dataset.projectionFamily;
      const previousProjectionComponent = root.dataset.projectionComponent;
      const previousDescription = description?.textContent ?? null;
      const previousStatus = status?.textContent ?? null;
      const previousAriaBusy = mount.getAttribute('aria-busy');
      const previousLatestCommittedGeneration = latestCommittedGeneration;
      const previousCommittedComponentId = committedComponentId;
      const previousDesiredRuntimeId = desiredRuntimeId;
      const previousDesiredProjectionFamilyId = desiredProjectionFamilyId;
      const previousDesiredComponentId = desiredComponentId;
      const previousActiveCandidate = activeCandidate;
      const previousWatchedProjectionFamilyId = watchedProjectionFamilyId;
      const previousStopThemeWatcher = stopThemeWatcher;
      const replacesThemeWatcher =
        watchedProjectionFamilyId !== projectionFamilyId || !stopThemeWatcher;
      let preparedThemeWatcher: (() => void) | null = null;
      let preparedThemeWatcherPublished = false;
      let published = false;

      try {
        candidate.setThemeSurfaceStyle(
          resolveProjectionThemeSurfaceStyle(projectionFamilyId, root)
        );
        if (replacesThemeWatcher) {
          preparedThemeWatcher = watchProjectionThemeSurfaceStyle(
            projectionFamilyId,
            root,
            (theme) => {
              if (
                preparedThemeWatcherPublished &&
                stopThemeWatcher === preparedThemeWatcher &&
                watchedProjectionFamilyId === projectionFamilyId
              ) {
                activeCandidate?.setThemeSurfaceStyle(theme);
              }
            }
          );
        }
      } catch (error) {
        preparedThemeWatcher?.();
        preparedThemeWatcher = null;
        deleteGeneration(commit.generation);
        throw error;
      }

      const rollbackPublishedState = (): void => {
        preparedThemeWatcherPublished = false;
        if (preparedThemeWatcher !== previousStopThemeWatcher) preparedThemeWatcher?.();
        preparedThemeWatcher = null;
        latestCommittedGeneration = previousLatestCommittedGeneration;
        committedComponentId = previousCommittedComponentId;
        desiredRuntimeId = previousDesiredRuntimeId;
        desiredProjectionFamilyId = previousDesiredProjectionFamilyId;
        desiredComponentId = previousDesiredComponentId;
        activeCandidate = previousActiveCandidate;
        watchedProjectionFamilyId = previousWatchedProjectionFamilyId;
        stopThemeWatcher = previousStopThemeWatcher;

        if (previousRuntimeId === undefined) delete root.dataset.runnerRuntime;
        else root.dataset.runnerRuntime = previousRuntimeId;
        if (previousRunnerState === undefined) delete root.dataset.runnerState;
        else root.dataset.runnerState = previousRunnerState;
        if (previousProjectionFamily === undefined) delete root.dataset.projectionFamily;
        else root.dataset.projectionFamily = previousProjectionFamily;
        if (previousProjectionComponent === undefined) delete root.dataset.projectionComponent;
        else root.dataset.projectionComponent = previousProjectionComponent;
        if (description && previousDescription !== null)
          description.textContent = previousDescription;
        if (status && previousStatus !== null) status.textContent = previousStatus;
        if (previousAriaBusy === null) mount.removeAttribute('aria-busy');
        else mount.setAttribute('aria-busy', previousAriaBusy);
        deleteGeneration(commit.generation);
        published = false;
      };

      return {
        publish() {
          if (published) return;
          try {
            latestCommittedGeneration = commit.generation;
            committedComponentId = componentId;
            activeCandidate = candidate;
            if (replacesThemeWatcher) {
              watchedProjectionFamilyId = projectionFamilyId;
              stopThemeWatcher = preparedThemeWatcher;
              preparedThemeWatcherPublished = true;
            }
            root.dataset.projectionFamily = projectionFamilyId;
            root.dataset.projectionComponent = componentId;
            if (description) {
              description.textContent = componentOption(componentId)?.description ?? '';
            }
            setRunnerState('ready', runtimeId);
            published = true;

            if (
              replacesThemeWatcher &&
              previousStopThemeWatcher &&
              previousStopThemeWatcher !== preparedThemeWatcher
            ) {
              queueMicrotask(() => {
                if (stopThemeWatcher === previousStopThemeWatcher) return;
                try {
                  previousStopThemeWatcher();
                } catch {
                  // Deferred observer cleanup cannot invalidate the committed generation.
                }
              });
            }
            deleteOlderGenerations(commit.generation);
            initialErrorSurface?.remove();
            initialErrorSurface = null;
          } catch (error) {
            rollbackPublishedState();
            throw error;
          }
        },
        rollback() {
          if (published) rollbackPublishedState();
          else {
            preparedThemeWatcherPublished = false;
            if (preparedThemeWatcher !== previousStopThemeWatcher) preparedThemeWatcher?.();
            preparedThemeWatcher = null;
            deleteGeneration(commit.generation);
          }
        },
      };
    },
    restoreFocus(focusKey, commit, focusOrigin) {
      restoreProjectionControlFocus(mount, focusKey, commit.generation, focusOrigin);
    },
  });

  const onAdapterChange = (event: Event): void => {
    const detail = (event as CustomEvent<AdapterPreferenceDetail>).detail;
    const runtimeId = detail?.adapter;
    if (
      detail?.source === root ||
      !isRuntimeId(runtimeId) ||
      !runtimeOptions.some((option) => option.id === runtimeId) ||
      runtimeId === desiredRuntimeId
    ) {
      return;
    }
    desiredRuntimeId = runtimeId;
    desiredIntentRevision += 1;
    requestDesiredIntent();
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
      componentByGeneration.clear();
      candidateByGeneration.clear();
      removalObserver.disconnect();
      root.ownerDocument.removeEventListener(PREFERRED_ADAPTER_EVENT, onAdapterChange);
      await controller.destroy();
    })();
    return destroyPromise;
  };
  removalObserver = new MutationObserver(() => {
    if (!root.isConnected) void destroy();
  });
  removalObserver.observe(root.ownerDocument.body, { childList: true, subtree: true });

  (root as HTMLElement & { __homeProjection__?: unknown }).__homeProjection__ = {
    destroy,
    getSnapshot: () => controller.getSnapshot(),
  };

  setRunnerState('loading', initialRuntime);
  observeRequest(ensureStarted(), initialRuntime);
}
