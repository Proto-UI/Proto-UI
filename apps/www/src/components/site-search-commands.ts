import { siteSearchShortcutLabel } from './site-search-shortcut';
import type { ExposeStateExternalHandle } from '@proto.ui/module-expose-state';
import searchIcon from '../../../../packages/prototypes/lucide/src/icons/search';
import closeIcon from '../../../../packages/prototypes/lucide/src/icons/x';
import { registerPrototype } from './PrototypePreviewer/registry';
import { PREFERRED_ADAPTER_EVENT, PREFERRED_ADAPTER_KEY } from './adapter-preference';
import { isRuntimeId, type RuntimeId } from './PrototypePreviewer/runtimes/ids';
import {
  createProjectionScopeController,
  type ProjectionScopeCommit,
  type ProjectionScopeMaterializeRequest,
} from './PrototypePreviewer/projection-scope';
import {
  materializeProjectionCandidate,
  type MaterializedProjectionCandidate,
} from './PrototypePreviewer/projection-materializer';
import { watchProjectionThemeSurfaceStyle } from './PrototypePreviewer/projection-theme';
import type { DemoSpec } from './PrototypePreviewer/demo-types';
import type { SiteLibraryFamily } from './site-library-family';

// These fixed glyphs are required by every Search generation. Keep them in
// the command owner's initial module graph instead of discovering their import
// chain only after the custom element connects. The materializer still owns
// rendering the registered prototypes and committing all three commands.
registerPrototype('lucide-search-icon', searchIcon);
registerPrototype('lucide-x-icon', closeIcon);

export type SearchCommand = 'open' | 'close' | 'retry';
type SearchCallbacks = Record<SearchCommand, () => unknown> & { prepare?: () => unknown };
export type SearchCommandParticipant = {
  root: HTMLElement;
  mounts: HTMLElement[];
  bind(callbacks: SearchCallbacks): void;
  setRetryDisabled(value: boolean): void;
  focus(command: SearchCommand): void;
  materialize(
    request: ProjectionScopeMaterializeRequest,
    namespace?: string
  ): Promise<MaterializedProjectionCandidate[]>;
  prepareCommit(commit: ProjectionScopeCommit): { publish(): void; rollback(): void };
  dispose(): void;
};
const commands: SearchCommand[] = ['open', 'close', 'retry'];
const participants = new WeakMap<HTMLElement, SearchCommandParticipant>();
let serial = 0;
const controls = {
  runtime: { label: 'Runtime', options: [], onValueChange() {} },
  family: { label: 'Family', options: [], onValueChange() {} },
  component: { label: 'Component', options: [], onValueChange() {} },
};

/** Website composition only. The native dialog and Pagefind owner outlive every view. */
export function searchCommandParticipant(root: HTMLElement): SearchCommandParticipant {
  const existing = participants.get(root);
  if (existing) return existing;
  const document = root.ownerDocument;
  const view = document.defaultView!;
  const owner = `site-search-${++serial}`;
  const mounts = commands.map((command) => {
    const mount = root.querySelector<HTMLElement>(`[data-search-command-mount="${command}"]`);
    if (!mount) throw new Error(`Search ${command} mount is missing`);
    return mount;
  });
  let callbacks: SearchCallbacks | null = null;
  let retryDisabled = false;
  let alive = true;
  const subscribers = new Set<() => void>();
  const publishState = () => subscribers.forEach((paint) => paint());
  const focusTargets = new Set<{ command: SearchCommand; active(): boolean; focus(): void }>();
  let focusEpoch = 0;
  const onFocus = () => {
    focusEpoch++;
  };
  document.addEventListener('focusin', onFocus, true);
  const rememberedFocus = new Map<
    number,
    { command: SearchCommand; origin: Element | null; epoch: number }
  >();
  let deferredFocus: { command: SearchCommand; origin: Element | null; epoch: number } | null =
    null;
  const focus = (command: SearchCommand) => {
    if (!alive) return;
    for (const target of focusTargets)
      if (target.command === command && target.active()) {
        deferredFocus = null;
        target.focus();
        return;
      }
    deferredFocus = { command, origin: document.activeElement, epoch: focusEpoch };
  };
  const content = (
    command: SearchCommand,
    family: SiteLibraryFamily,
    runtime: RuntimeId,
    isActive: () => boolean
  ): DemoSpec => {
    const label = root.dataset[`${command}Label`] || command;
    const icon = command === 'open' ? 'search' : command === 'close' ? 'x' : null;
    const props = {
      variant: family === 'brutalist' ? 'surface' : command === 'retry' ? 'secondary' : 'ghost',
      size: command === 'open' ? 'default' : 'sm',
    };
    return {
      type: 'demo',
      root: {
        kind: 'proto',
        prototypeId: `${family}-button`,
        ref: 'search-command',
        props: { ...props, disabled: !callbacks || (command === 'retry' && retryDisabled) },
        surfaceStyle:
          command === 'open'
            ? {
                width: 'var(--site-search-trigger-width, 2.75rem)',
                minWidth: '0',
                maxWidth: '100%',
                height: '2.75rem',
                minHeight: '2.75rem',
                paddingInline: 'var(--site-search-trigger-padding, 0)',
                justifyContent: 'var(--site-search-trigger-justify, center)',
              }
            : { minHeight: '2.75rem' },
        className:
          command === 'close'
            ? 'search-toolbar__close'
            : command === 'retry'
              ? 'search-failure__retry'
              : undefined,
        children: [
          ...(icon
            ? [
                {
                  kind: 'box' as const,
                  attrs: { 'aria-hidden': 'true' },
                  children: [
                    {
                      kind: 'proto' as const,
                      prototypeId: `lucide-${icon}-icon`,
                      props: { size: 16 },
                    },
                  ],
                },
              ]
            : []),
          { kind: 'box', className: 'sr-only', children: [label] },
          {
            kind: 'box',
            attrs: { 'aria-hidden': 'true' },
            className:
              command === 'open'
                ? 'site-search-label sl-hidden md:sl-block'
                : command === 'close'
                  ? 'search-toolbar__close-label'
                  : undefined,
            children: [label],
          },
          ...(command === 'open'
            ? [
                {
                  kind: 'box' as const,
                  attrs: { 'aria-hidden': 'true' },
                  className: 'site-search-shortcut sl-hidden md:sl-flex',
                  children: [siteSearchShortcutLabel(root.dataset.ctrlLabel || 'Ctrl')],
                },
              ]
            : []),
        ],
      },
      setup(context) {
        const button = context.refs['search-command'];
        button.dataset.searchCommand = command;
        button.dataset.siteControlFamily = family;
        if (command === 'open') {
          button.dataset.openModal = '';
          button.setAttribute(
            'aria-keyshortcuts',
            /(Mac|iPhone|iPod|iPad)/i.test(view.navigator.userAgent) ? 'Meta+K' : 'Control+K'
          );
        }
        if (command === 'close') button.dataset.closeModal = '';
        let live = true;
        let queued = false;
        // Consume public Button facts. Search owns resource preparation only;
        // it does not recreate hover/focus semantics or an activation route.
        const intentSubscriptions: Array<() => void> = [];
        if (command === 'open') {
          const exposes = context.api.getExposes('search-command');
          for (const key of ['hovered', 'focusVisible']) {
            const fact = exposes?.[key] as ExposeStateExternalHandle<boolean> | undefined;
            if (!fact?.subscribe) continue;
            intentSubscriptions.push(
              fact.subscribe((event) => {
                if (event.type !== 'next' || event.next !== true) return;
                queueMicrotask(() => {
                  if (alive && live && isActive()) callbacks?.prepare?.();
                });
              })
            );
          }
        }
        const activate = () => {
          // Both props and native-dialog focus must happen after the WC callback exits.
          queueMicrotask(() => {
            if (alive && live && isActive() && !(command === 'retry' && retryDisabled))
              callbacks?.[command]();
          });
        };
        const click = (event: Event) => {
          if (event instanceof view.CustomEvent) activate();
        };
        const paint = () => {
          if (queued) return;
          queued = true;
          queueMicrotask(() => {
            queued = false;
            if (!alive || !live) return;
            // The composition retains surfaceStyle; send the complete authored props bag.
            context.api.setProps('search-command', {
              ...props,
              disabled: !callbacks || (command === 'retry' && retryDisabled),
              ...(runtime === 'wc' ? {} : { onClick: activate }),
            });
          });
        };
        if (runtime === 'wc') button.addEventListener('click', click);
        const focusTarget = {
          command,
          active: isActive,
          focus: () => {
            context.api.call('search-command', 'focusSelf');
          },
        };
        focusTargets.add(focusTarget);
        subscribers.add(paint);
        paint();
        return () => {
          live = false;
          for (const unsubscribe of intentSubscriptions) unsubscribe();
          subscribers.delete(paint);
          focusTargets.delete(focusTarget);
          button.removeEventListener('click', click);
        };
      },
    };
  };
  const handle = {
    root,
    mounts,
    bind(next: SearchCallbacks) {
      callbacks = next;
      publishState();
    },
    setRetryDisabled(value: boolean) {
      retryDisabled = value;
      publishState();
    },
    focus,
    async materialize(request: ProjectionScopeMaterializeRequest, namespace = 'homepage') {
      rememberedFocus.clear();
      const origin = document.activeElement;
      const focusedCommand =
        origin instanceof view.HTMLElement && root.contains(origin)
          ? (origin.dataset.searchCommand as SearchCommand | undefined)
          : undefined;
      if (focusedCommand && commands.includes(focusedCommand))
        rememberedFocus.set(request.generation, {
          command: focusedCommand,
          origin,
          epoch: focusEpoch,
        });
      const family = request.selection.projectionFamilyId as SiteLibraryFamily;
      const runtime = request.selection.runtimeId as RuntimeId;
      const outcomes = await Promise.allSettled(
        commands.map(async (command, index) => {
          let candidate: MaterializedProjectionCandidate | undefined;
          const ownerId = `${owner}-${namespace}-${command}`;
          mounts[index]!.dataset.projectionOwner = ownerId;
          candidate = await materializeProjectionCandidate(request, {
            mount: mounts[index]!,
            ownerId,
            componentId: 'button',
            controls,
            controlIds: [],
            content: {
              demo: content(
                command,
                family,
                runtime,
                () =>
                  !!candidate &&
                  candidate.host.dataset.projectionGenerationState === 'active' &&
                  !candidate.host.inert
              ),
              recipe: {
                id: `website-search-${command}`,
                prototypeIds:
                  command === 'retry'
                    ? [`${family}-button`]
                    : [`${family}-button`, `lucide-${command === 'open' ? 'search' : 'x'}-icon`],
                rootPrototypeId: `${family}-button`,
              },
            },
          });
          return candidate;
        })
      );
      const candidates = outcomes.flatMap((outcome) =>
        outcome.status === 'fulfilled' ? [outcome.value] : []
      );
      const failure = outcomes.find((outcome) => outcome.status === 'rejected');
      if (failure?.status === 'rejected') {
        await Promise.allSettled(candidates.map((candidate) => candidate.dispose()));
        throw failure.reason;
      }
      return candidates;
    },
    prepareCommit(commit: ProjectionScopeCommit) {
      const names = [
        'data-search-runtime',
        'data-search-family',
        'data-search-generation',
        'data-search-view',
      ];
      const previous = names.map((name) => [name, root.getAttribute(name)] as const);
      let published = false;
      return {
        publish() {
          root.dataset.searchRuntime = commit.selection.runtimeId;
          root.dataset.searchFamily = commit.selection.projectionFamilyId;
          root.dataset.searchGeneration = String(commit.generation);
          root.dataset.searchView = 'ready';
          published = true;
          const target = deferredFocus ?? rememberedFocus.get(commit.generation);
          rememberedFocus.delete(commit.generation);
          queueMicrotask(() => {
            if (
              alive &&
              published &&
              target &&
              target.epoch === focusEpoch &&
              (document.activeElement === target.origin || document.activeElement === document.body)
            )
              focus(target.command);
          });
        },
        rollback() {
          published = false;
          rememberedFocus.delete(commit.generation);
          for (const [name, value] of previous) {
            if (value === null) root.removeAttribute(name);
            else root.setAttribute(name, value);
          }
        },
      };
    },
    dispose() {
      alive = false;
      callbacks = null;
      subscribers.clear();
      focusTargets.clear();
      rememberedFocus.clear();
      document.removeEventListener('focusin', onFocus, true);
      participants.delete(root);
    },
  };
  participants.set(root, handle);
  return handle;
}

/** Docs-only Search scope. Homepage contributes its candidates to the page controller. */
export function initDocumentationSearchCommands(participant: SearchCommandParticipant) {
  const { root } = participant;
  if (root.closest('[data-homepage-runtime]'))
    throw new Error('Homepage Search must use its page transaction');
  const document = root.ownerDocument;
  let runtime: RuntimeId = 'wc';
  try {
    const stored = document.defaultView?.localStorage.getItem(PREFERRED_ADAPTER_KEY);
    if (isRuntimeId(stored)) runtime = stored;
  } catch {
    /* Optional storage. */
  }
  const family = root.dataset.searchInitialFamily === 'brutalist' ? 'brutalist' : 'shadcn';
  let alive = true;
  let attempt = 0;
  const retired = new Set<Promise<void>>();
  const create = () => {
    const namespace = `docs-${++attempt}`;
    return createProjectionScopeController({
      initialSelection: { runtimeId: runtime, projectionFamilyId: family },
      async materialize(request) {
        const candidates = await participant.materialize(request, namespace);
        let stop: () => void;
        try {
          stop = watchProjectionThemeSurfaceStyle(family, root, (theme) =>
            candidates.forEach((candidate) => candidate.setThemeSurfaceStyle(theme))
          );
        } catch (error) {
          await Promise.allSettled(candidates.map((candidate) => candidate.dispose()));
          throw error;
        }
        return {
          activate() {
            candidates.forEach((candidate) => candidate.activate());
          },
          setLocked(locked) {
            candidates.forEach((candidate) => candidate.setLocked?.(locked));
          },
          async dispose() {
            stop();
            const results = await Promise.allSettled(
              candidates.map((candidate) => candidate.dispose())
            );
            const failed = results.find((result) => result.status === 'rejected');
            if (failed?.status === 'rejected') throw failed.reason;
          },
        };
      },
      prepareCommit: participant.prepareCommit,
    });
  };
  let controller = create();
  const observe = (pending: Promise<unknown>, owner = controller) =>
    pending.catch((error) => {
      if (!alive || owner !== controller) return;
      root.dataset.searchView = controller.getSnapshot().generation ? 'retained' : 'unavailable';
      console.error('[SiteSearch] Search command projection failed.', error);
    });
  const refresh = () => {
    if (!alive) return;
    if (controller.getSnapshot().generation === 0 && controller.getSnapshot().phase === 'idle') {
      const previous = controller;
      controller = create();
      const cleanup = previous.destroy();
      retired.add(cleanup);
      void cleanup.then(
        () => retired.delete(cleanup),
        (error) => {
          retired.delete(cleanup);
          console.error('[SiteSearch] retired projection cleanup failed.', error);
        }
      );
      return observe(controller.start());
    }
    return observe(controller.request({ runtimeId: runtime, projectionFamilyId: family }));
  };
  const onPreference = (event: Event) => {
    const next = (event as CustomEvent<{ adapter?: unknown }>).detail?.adapter;
    if (isRuntimeId(next)) {
      runtime = next;
      void refresh();
    }
  };
  document.addEventListener(PREFERRED_ADAPTER_EVENT, onPreference);
  return {
    ready: observe(controller.start()),
    refresh,
    async destroy() {
      if (!alive) return;
      alive = false;
      document.removeEventListener(PREFERRED_ADAPTER_EVENT, onPreference);
      try {
        await controller.destroy();
      } finally {
        await Promise.allSettled([...retired]);
      }
    },
  };
}
