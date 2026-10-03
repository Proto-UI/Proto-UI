import type {
  ProjectionFamilyId,
  SharedBaseFamilyId,
} from '../PrototypePreviewer/projection-families';
import type { ProjectionScopeCommit } from '../PrototypePreviewer/projection-scope';
import type { RuntimeId } from '../PrototypePreviewer/runtimes/registry';
import { createHomepageShowcase, HOMEPAGE_SHOWCASE_ID } from './homepage-showcase';

export function homepageDemoParticipant(document: Document) {
  const root = document.querySelector<HTMLElement>('[data-home-showcase]');
  if (!root) return null;
  const mount = root.querySelector<HTMLElement>('[data-home-demo-host]');
  if (!mount) throw new Error('[HomepageRuntime] live example mount is missing.');
  const ownerId = root.dataset.projectionOwner || root.id || 'homepage-live-example';
  mount.dataset.projectionOwner = ownerId;
  const status = root.querySelector<HTMLElement>('[data-home-demo-status]');
  const setStatus = (state: 'loading' | 'ready' | 'error', runtime: RuntimeId) => {
    root.dataset.runnerState = state;
    root.dataset.runnerRuntime = runtime;
    mount.setAttribute('aria-busy', String(state === 'loading'));
    if (status)
      status.textContent = `${runtime === 'wc' ? 'Web Components' : runtime === 'vue2' ? 'Vue 2' : runtime === 'react' ? 'React' : 'Vue'} · ${root.dataset[`status${state[0]!.toUpperCase()}${state.slice(1)}`] || state}`;
  };
  return {
    root,
    mount,
    ownerId,
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
        },
      };
    },
  };
}
