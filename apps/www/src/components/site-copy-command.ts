import {
  createCopyController,
  writeClipboard,
  type CopyController,
  type CopySnapshot,
} from './site-copy-controller';
import { PREFERRED_ADAPTER_EVENT, PREFERRED_ADAPTER_KEY } from './adapter-preference';
import { isRuntimeId, type RuntimeId } from './PrototypePreviewer/runtimes/ids';
import {
  createProjectionScopeController,
  type ProjectionScopeController,
  type ProjectionScopeSelection,
} from './PrototypePreviewer/projection-scope';
import {
  materializeProjectionCandidate,
  type MaterializedProjectionCandidate,
} from './PrototypePreviewer/projection-materializer';
import { watchProjectionThemeSurfaceStyle } from './PrototypePreviewer/projection-theme';
import type { ProjectionCompositionControls } from './PrototypePreviewer/projection-composition';
import type { DemoSpec, DemoNode } from './PrototypePreviewer/demo-types';
import type { SiteLibraryFamily } from './site-library-family';

const COPY_GLYPHS = {
  idle: 'copy',
  pending: 'loader-circle',
  success: 'check',
  error: 'circle-alert',
} as const;
const handles = new WeakMap<HTMLElement, SiteCopyCommand>();
let nextOwner = 0;
const NO_CONTROLS: ProjectionCompositionControls = {
  runtime: { label: 'Runtime', options: [], onValueChange() {} },
  family: { label: 'Family', options: [], onValueChange() {} },
  component: { label: 'Component', options: [], onValueChange() {} },
};

export function copyLabels(root: HTMLElement) {
  const zh = root.ownerDocument.documentElement.lang.toLowerCase().startsWith('zh');
  return {
    command: root.dataset.copyLabel || (zh ? '复制代码' : 'Copy code'),
    pending: zh ? '正在复制' : 'Copying',
    success: zh ? '已复制' : 'Copied',
    error: zh ? '复制失败，请重试或手动选择代码' : 'Copy failed. Retry or select the code manually',
  };
}

/** Explicit Website recipe: actual Button, decorative Lucide glyph and Base live-region. */
export function createCopyCommandDemo(
  root: HTMLElement,
  owner: CopyController,
  runtime: RuntimeId,
  family: SiteLibraryFamily,
  isActive: () => boolean
): DemoSpec {
  const labels = copyLabels(root);
  const buttonProps = { variant: family === 'brutalist' ? 'surface' : 'outline', size: 'icon' };
  const copyButton: DemoNode = {
    kind: 'proto',
    prototypeId: `${family}-button`,
    ref: 'copy-button',
    props: { ...buttonProps, disabled: false },
    children: [
      {
        kind: 'box',
        attrs: { 'aria-hidden': 'true' },
        className: 'site-copy-glyph',
        ref: 'copy-icon',
        children: Object.entries(COPY_GLYPHS).map(([state, icon]) => ({
          kind: 'box' as const,
          tag: 'span' as const,
          ref: `copy-glyph-${state}`,
          attrs: state === 'idle' ? undefined : { hidden: '' },
          children: [
            {
              kind: 'proto' as const,
              prototypeId: `lucide-${icon}-icon`,
              props: { size: 18 },
              surfaceStyle: { pointerEvents: 'none' },
            },
          ],
        })),
      },
      { kind: 'box', className: 'sr-only', children: [labels.command] },
    ],
  };
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'site-copy-command',
      children: [
        family === 'shadcn'
          ? {
              kind: 'proto',
              prototypeId: `${family}-surface-root`,
              ref: 'copy-backplate',
              props: {
                variant: 'outline',
                radius: family === 'shadcn' ? 'lg' : 'default',
                border: 'none',
                elevation: 'none',
              },
              surfaceStyle: { display: 'inline-flex', minWidth: '0', padding: '0' },
              children: [copyButton],
            }
          : copyButton,
        {
          kind: 'proto',
          prototypeId: 'base-live-region-root',
          props: { politeness: 'polite', atomic: true },
          className: 'sr-only',
          children: [{ kind: 'box', ref: 'copy-feedback', children: [''] }],
        },
      ],
    },
    setup(context) {
      const button = context.refs['copy-button'];
      const feedback = context.refs['copy-feedback'];
      const view = root.ownerDocument.defaultView!;
      let alive = true;
      let queued = false;
      let latest = owner.snapshot();
      const activate = () => {
        if (alive && isActive()) void owner.copy();
      };
      const click = (event: Event) => {
        if (event instanceof view.CustomEvent) activate();
      };
      const paint = () => {
        queued = false;
        if (!alive) return;
        context.api.setProps('copy-button', {
          ...buttonProps,
          // Pending Copy remains focusable. The logical effect owner synchronously
          // deduplicates activations; Base disabled would deliberately blur it.
          disabled: false,
          ...(runtime === 'wc' ? {} : { onClick: activate }),
        });
        for (const state of Object.keys(COPY_GLYPHS))
          context.refs[`copy-glyph-${state}`]!.hidden = state !== latest.state;
        button.setAttribute(
          'title',
          latest.state === 'idle' ? labels.command : labels[latest.state]
        );
        // The stable authored label supplies the accessible name. Do not race
        // the Adapter's accessible-name projection with an imperative aria-label.
        button.dataset.copyState = latest.state;
        // Content belongs to the application; LiveRegion owns announcement semantics.
        feedback.textContent = latest.state === 'idle' ? '' : labels[latest.state];
      };
      const update = (snapshot: CopySnapshot) => {
        latest = snapshot;
        if (queued) return;
        queued = true;
        // WC outward events are emitted inside a runtime callback. Render only after it exits.
        queueMicrotask(paint);
      };
      if (runtime === 'wc') button.addEventListener('click', click);
      const unsubscribe = owner.subscribe(update);
      return () => {
        if (!alive) return;
        alive = false;
        unsubscribe();
        button.removeEventListener('click', click);
      };
    },
  };
}

type Previewer = HTMLElement & { __previewer__?: { getCurrentRuntime(): unknown } };
export type SiteCopyCommand = {
  owner: CopyController;
  refresh(): void;
  destroy(): Promise<void>;
  ready: Promise<unknown>;
};

export function initCopyCommand(root: HTMLElement, readText: () => string): SiteCopyCommand {
  const existing = handles.get(root);
  if (existing) return existing;
  const doc = root.ownerDocument;
  const view = doc.defaultView!;
  const owner = createCopyController({
    readText,
    writeText: (text, signal) => writeClipboard(doc, text, signal),
  });
  const logicalOwnerId = `website-copy-${++nextOwner}`;
  let attempt = 0;
  const retiredControllers = new Set<Promise<void>>();
  const mount = doc.createElement('div');
  mount.className = 'site-copy-mount';
  root.append(mount);
  const previewer = root.closest<Previewer>('[data-previewer-id]');
  let preferred: RuntimeId = 'wc';
  try {
    const stored = view.localStorage.getItem(PREFERRED_ADAPTER_KEY);
    if (isRuntimeId(stored)) preferred = stored;
  } catch {
    /* The in-document preference still works when storage is disabled. */
  }
  let alive = true;
  let activeCandidate: MaterializedProjectionCandidate | null = null;
  let focusEpoch = 0;
  const focusRequests = new WeakMap<Element, number>();
  const onFocus = () => {
    focusEpoch += 1;
  };
  doc.addEventListener('focusin', onFocus, true);
  const selection = () => {
    const committed = previewer?.__previewer__?.getCurrentRuntime();
    const runtimeId = isRuntimeId(committed) ? committed : previewer ? 'wc' : preferred;
    const scope = root.closest<HTMLElement>('[data-projection-family], [data-site-library-family]');
    const family =
      scope?.dataset.projectionFamily ??
      scope?.dataset.siteLibraryFamily ??
      doc.documentElement.dataset.siteLibraryFamily;
    return {
      runtimeId,
      projectionFamilyId: family === 'brutalist' ? ('brutalist' as const) : ('shadcn' as const),
    };
  };
  const createController = (initialSelection: ProjectionScopeSelection) => {
    // A failed first mount has no committed view. Retry with the newest inputs
    // and a distinct owner namespace so late old cleanup cannot hit generation 1
    // of the new attempt. The Clipboard owner is deliberately not replaced.
    const ownerId = `${logicalOwnerId}-attempt-${++attempt}`;
    mount.dataset.projectionOwner = ownerId;
    return createProjectionScopeController({
      initialSelection,
      async materialize(request) {
        const runtime = request.selection.runtimeId as RuntimeId;
        const family = request.selection.projectionFamilyId as SiteLibraryFamily;
        let candidate: MaterializedProjectionCandidate | null = null;
        const demo = createCopyCommandDemo(
          root,
          owner,
          runtime,
          family,
          () =>
            alive &&
            candidate?.host.dataset.projectionGenerationState === 'active' &&
            !candidate.host.inert
        );
        candidate = await materializeProjectionCandidate(request, {
          mount,
          ownerId,
          componentId: 'button',
          controls: NO_CONTROLS,
          controlIds: [],
          content: {
            demo,
            recipe: {
              id: 'website-copy-command',
              rootPrototypeId: family === 'shadcn' ? 'shadcn-surface-root' : `${family}-button`,
              prototypeIds: [
                ...(family === 'shadcn' ? ['shadcn-surface-root'] : []),
                `${family}-button`,
                ...Object.values(COPY_GLYPHS).map((icon) => `lucide-${icon}-icon`),
                'base-live-region-root',
              ],
            },
          },
        });
        const mounted = candidate;
        let stopTheme: () => void;
        try {
          stopTheme = watchProjectionThemeSurfaceStyle(family, root, (theme) =>
            mounted.setThemeSurfaceStyle(theme)
          );
        } catch (error) {
          await mounted.dispose();
          throw error;
        }
        return {
          activate() {
            mounted.activate();
            activeCandidate = mounted;
          },
          setLocked(locked: boolean) {
            mounted.setLocked?.(locked);
          },
          async dispose() {
            stopTheme();
            if (activeCandidate === mounted) activeCandidate = null;
            await mounted.dispose();
          },
        };
      },
      prepareCommit(commit) {
        const prior = {
          runtime: root.dataset.copyRuntime,
          family: root.dataset.copyFamily,
          state: root.dataset.copyView,
        };
        const priorTitle = root.getAttribute('title');
        return {
          publish() {
            root.dataset.copyRuntime = commit.selection.runtimeId;
            root.dataset.copyFamily = commit.selection.projectionFamilyId;
            root.dataset.copyView = 'ready';
            root.removeAttribute('title');
          },
          rollback() {
            if (priorTitle === null) root.removeAttribute('title');
            else root.setAttribute('title', priorTitle);
            for (const [key, value] of Object.entries(prior)) {
              const name =
                key === 'state' ? 'copyView' : key === 'runtime' ? 'copyRuntime' : 'copyFamily';
              if (value === undefined) delete root.dataset[name];
              else root.dataset[name] = value;
            }
          },
        };
      },
      restoreFocus(_key, _commit, origin) {
        // A newer user focus wins. Clipboard settlement never requests focus.
        if (
          !alive ||
          !origin ||
          focusRequests.get(origin) !== focusEpoch ||
          (doc.activeElement !== origin && doc.activeElement !== doc.body)
        )
          return;
        activeCandidate?.scope
          .querySelector<HTMLElement>('[data-demo-ref="copy-button"]')
          ?.focus({ preventScroll: true });
      },
    });
  };
  let controller = createController(selection());
  const failed = (error: unknown) => {
    if (!alive) return;
    root.dataset.copyView = controller.getSnapshot().generation ? 'retained' : 'unavailable';
    root.title = copyLabels(root).error;
    console.error('[SiteCopy] Copy control projection failed.', error);
  };
  const observe = (operation: Promise<unknown>, operationController: ProjectionScopeController) =>
    operation.catch((error) => {
      if (controller === operationController) failed(error);
    });
  const retire = (previous: ProjectionScopeController) => {
    // destroy() revokes its request/activation lease synchronously. Its lazy
    // loader may finish later; do not make a usable new renderer wait for it.
    const cleanup = previous.destroy();
    retiredControllers.add(cleanup);
    void cleanup.then(
      () => retiredControllers.delete(cleanup),
      (error) => {
        retiredControllers.delete(cleanup);
        console.error('[SiteCopy] Retired initial projection cleanup failed.', error);
      }
    );
  };
  const refresh = () => {
    if (!alive) return;
    owner.syncSource();
    const origin = doc.activeElement;
    if (origin && root.contains(origin)) focusRequests.set(origin, focusEpoch);
    const latest = selection();
    const snapshot = controller.getSnapshot();
    if (snapshot.generation === 0 && snapshot.phase === 'idle') {
      const previous = controller;
      controller = createController(latest);
      retire(previous);
      void observe(controller.start(), controller);
      return;
    }
    void observe(
      controller.request(
        latest,
        root.contains(origin) ? { focusKey: 'copy', focusOrigin: origin } : {}
      ),
      controller
    );
  };
  const onPreference = (event: Event) => {
    const adapter = (event as CustomEvent<{ adapter?: unknown }>).detail?.adapter;
    if (!isRuntimeId(adapter)) return;
    preferred = adapter;
    if (!previewer) refresh();
  };
  doc.addEventListener(PREFERRED_ADAPTER_EVENT, onPreference);
  previewer?.addEventListener('runtime:changed', refresh);
  const observer = new view.MutationObserver(refresh);
  // Observe coordinate inputs only, not the new view's own published coordinates.
  for (let ancestor = root.parentElement; ancestor; ancestor = ancestor.parentElement)
    observer.observe(ancestor, {
      attributes: true,
      attributeFilter: [
        'data-site-library-family',
        'data-projection-family',
        'data-projection-runtime',
        'data-runner-runtime',
      ],
    });
  const handle: SiteCopyCommand = {
    owner,
    refresh,
    ready: observe(controller.start(), controller),
    async destroy() {
      if (!alive) return;
      alive = false;
      handles.delete(root);
      owner.dispose();
      observer.disconnect();
      doc.removeEventListener(PREFERRED_ADAPTER_EVENT, onPreference);
      doc.removeEventListener('focusin', onFocus, true);
      previewer?.removeEventListener('runtime:changed', refresh);
      try {
        await controller.destroy();
      } finally {
        await Promise.allSettled([...retiredControllers]);
        mount.remove();
      }
    },
  };
  handles.set(root, handle);
  return handle;
}
