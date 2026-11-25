import { createRuntimeLoadingMask } from '../PrototypePreviewer/runtime-loading-mask';
import type {
  ProjectionFamilyId,
  SharedBaseFamilyId,
} from '../PrototypePreviewer/projection-families';
import type { ProjectionScopeCommit } from '../PrototypePreviewer/projection-scope';
import type { RuntimeId } from '../PrototypePreviewer/runtimes/ids';
import { createHomepageShowcase, HOMEPAGE_SHOWCASE_ID } from './homepage-showcase';

export function homepageDemoParticipant(
  document: Document,
  actions?: {
    retry(): void;
    cancel(): void;
    restoreFocus?(origin: Element): void;
  }
) {
  const root = document.querySelector<HTMLElement>('[data-home-showcase]');
  if (!root) return null;
  const mount = root.querySelector<HTMLElement>('[data-home-demo-host]');
  if (!mount) throw new Error('[HomepageRuntime] live example mount is missing.');
  const view = root.ownerDocument.defaultView;
  const narrow = view?.matchMedia?.('(width < 768px)');
  const hasDemoTarget = () => view?.location.hash === `#${root.id}`;
  let expanded = hasDemoTarget();
  let destroyed = false;
  const observed = new Set<Element>();
  const syncScale = () => {
    if (destroyed) return;
    const stages = mount.querySelectorAll<HTMLElement>('[data-home-gallery-stage]');
    const targets = new Set<Element>([root]);
    for (const stage of stages) {
      targets.add(stage);
      if (stage.parentElement) targets.add(stage.parentElement);
    }
    for (const target of observed) {
      if (targets.has(target)) continue;
      resizeObserver?.unobserve(target);
      observed.delete(target);
    }
    for (const target of targets) {
      if (observed.has(target)) continue;
      resizeObserver?.observe(target);
      observed.add(target);
    }
    for (const stage of stages) {
      if (root.dataset.homeGalleryCompact !== 'true') {
        stage.style.removeProperty('--homepage-gallery-scale');
        continue;
      }
      // offsetWidth is unscaled; a zoomed client rect would compound the scale.
      // Measure the actual rem-based stage so font and container changes both fit.
      const availableWidth = stage.parentElement?.clientWidth ?? 0;
      const stageWidth = stage.offsetWidth;
      if (availableWidth <= 0 || stageWidth <= 0) continue;
      const scale = String(availableWidth / stageWidth);
      if (stage.style.getPropertyValue('--homepage-gallery-scale') !== scale)
        stage.style.setProperty('--homepage-gallery-scale', scale);
    }
  };
  const resizeObserver = view?.ResizeObserver ? new view.ResizeObserver(syncScale) : null;
  const syncLayout = () => {
    if (destroyed) return;
    const stages = mount.querySelectorAll<HTMLElement>('[data-home-gallery-stage]');
    // Resizing a desktop window must not turn a currently focused live control inert.
    if (narrow?.matches && [...stages].some((stage) => stage.matches(':focus-within'))) {
      expanded = true;
    }
    const compact = Boolean(narrow?.matches && !expanded);
    if (compact) root.dataset.homeGalleryCompact = 'true';
    else delete root.dataset.homeGalleryCompact;
    for (const stage of stages) stage.inert = compact;
    syncScale();
  };
  const syncFragment = () => {
    // The existing Hero link owns native fragment navigation. Its destination
    // also expresses intent to use the full-size demos, including direct links.
    expanded = hasDemoTarget();
    syncLayout();
  };
  view?.addEventListener('hashchange', syncFragment);
  view?.addEventListener('resize', syncScale);
  narrow?.addEventListener('change', syncLayout);
  syncLayout();
  const ownerId = root.dataset.projectionOwner || root.id || 'homepage-live-example';
  mount.dataset.projectionOwner = ownerId;
  const status = root.querySelector<HTMLElement>('[data-home-demo-status]');
  const mask = actions
    ? createRuntimeLoadingMask({
        root,
        content: mount,
        status,
        family: () => (root.dataset.projectionFamily === 'brutalist' ? 'brutalist' : 'shadcn'),
        ...actions,
      })
    : null;
  const setStatus = (
    state: 'loading' | 'ready' | 'error',
    runtime: RuntimeId,
    maskRuntime: RuntimeId = runtime
  ) => {
    root.dataset.runnerState = state;
    root.dataset.runnerRuntime = runtime;
    mount.setAttribute('aria-busy', String(state === 'loading'));
    mask?.setState(state, maskRuntime, Number(root.dataset.projectionGeneration ?? 0) > 0);
    if (status)
      status.textContent = `${runtime === 'wc' ? 'Web Components' : runtime === 'vue2' ? 'Vue 2' : runtime === 'react' ? 'React' : 'Vue'} · ${root.dataset[`status${state[0]!.toUpperCase()}${state.slice(1)}`] || state}`;
  };
  return {
    root,
    mount,
    ownerId,
    destroy: () => {
      destroyed = true;
      view?.removeEventListener('hashchange', syncFragment);
      view?.removeEventListener('resize', syncScale);
      narrow?.removeEventListener('change', syncLayout);
      resizeObserver?.disconnect();
      observed.clear();
      delete root.dataset.homeGalleryCompact;
      for (const stage of mount.querySelectorAll<HTMLElement>('[data-home-gallery-stage]')) {
        stage.inert = false;
        stage.style.removeProperty('--homepage-gallery-scale');
      }
      return mask?.destroy();
    },
    // The existing materializer requires a known lane member even when an explicit
    // app recipe supplies all content. No component picker is rendered for this task.
    initialFamily: 'shadcn' as ProjectionFamilyId,
    initialComponent: 'button' as SharedBaseFamilyId,
    setStatus,
    createContent(
      family: ProjectionFamilyId,
      runtime: RuntimeId,
      isActive: () => boolean,
      isCurrentGeneration: () => boolean
    ) {
      return createHomepageShowcase(
        family,
        runtime,
        root.dataset.locale || 'zh-cn',
        isActive,
        isCurrentGeneration
      );
    },
    prepareCommit(commit: ProjectionScopeCommit, _component: SharedBaseFamilyId) {
      const attributes = [
        'data-runner-state',
        'data-runner-runtime',
        'data-projection-runtime',
        'data-projection-family',
        'data-projection-component',
        'data-projection-generation',
      ];
      const previousAttributes = attributes.map((name) => [name, root.getAttribute(name)] as const);
      const oldStatus = status?.textContent ?? null;
      const oldBusy = mount.getAttribute('aria-busy');
      return {
        publish() {
          root.dataset.projectionRuntime = commit.selection.runtimeId;
          root.dataset.projectionFamily = commit.selection.projectionFamilyId;
          root.dataset.projectionComponent = HOMEPAGE_SHOWCASE_ID;
          root.dataset.projectionGeneration = String(commit.generation);
          syncLayout();
          setStatus('ready', commit.selection.runtimeId as RuntimeId);
        },
        rollback() {
          for (const [name, value] of previousAttributes) {
            if (value === null) root.removeAttribute(name);
            else root.setAttribute(name, value);
          }
          if (status) status.textContent = oldStatus;
          if (oldBusy === null) mount.removeAttribute('aria-busy');
          else mount.setAttribute('aria-busy', oldBusy);
          syncLayout();
        },
      };
    },
  };
}
