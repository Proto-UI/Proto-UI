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
  const toggle = root.querySelector<HTMLButtonElement>('[data-home-gallery-layout-toggle]');
  const narrow = root.ownerDocument.defaultView?.matchMedia?.('(width < 768px)');
  let expanded = false;
  const syncLayout = () => {
    const stages = mount.querySelectorAll<HTMLElement>('[data-home-gallery-stage]');
    // Resizing a desktop window must not turn a currently focused live control inert.
    if (narrow?.matches && [...stages].some((stage) => stage.matches(':focus-within'))) {
      expanded = true;
    }
    const compact = Boolean(narrow?.matches && !expanded && toggle);
    if (compact) root.dataset.homeGalleryCompact = 'true';
    else delete root.dataset.homeGalleryCompact;
    for (const stage of stages) stage.inert = compact;
    if (!toggle) return;
    toggle.hidden = !narrow?.matches;
    toggle.setAttribute('aria-expanded', String(!compact));
    toggle.textContent =
      (compact ? toggle.dataset.labelExpand : toggle.dataset.labelCollapse) ?? '';
  };
  const toggleLayout = () => {
    expanded = !expanded;
    syncLayout();
  };
  toggle?.addEventListener('click', toggleLayout);
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
      toggle?.removeEventListener('click', toggleLayout);
      narrow?.removeEventListener('change', syncLayout);
      if (toggle) toggle.hidden = true;
      delete root.dataset.homeGalleryCompact;
      for (const stage of mount.querySelectorAll<HTMLElement>('[data-home-gallery-stage]'))
        stage.inert = false;
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
