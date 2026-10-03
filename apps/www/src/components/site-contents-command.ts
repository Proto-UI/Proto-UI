import {
  materializeProjectionCandidate,
  type MaterializedProjectionCandidate,
} from './PrototypePreviewer/projection-materializer';
import type {
  ProjectionScopeCommit,
  ProjectionScopeMaterializeRequest,
} from './PrototypePreviewer/projection-scope';
import { siteContentsNavigation } from './site-header-disclosure';

const controls = {
  runtime: { label: 'Runtime', options: [], onValueChange() {} },
  family: { label: 'Family', options: [], onValueChange() {} },
  component: { label: 'Component', options: [], onValueChange() {} },
};
let serial = 0;

/** A replaceable command view of the app's existing Contents disclosure.
 * Button owns activation/interaction/paint; the app owns drawer state and ARIA. */
export function contentsCommandParticipant(header: HTMLElement) {
  const root = header.querySelector<HTMLElement>('[data-site-contents-command]');
  const mount = root?.querySelector<HTMLElement>('[data-site-contents-mount]');
  const fallback = root?.querySelector<HTMLButtonElement>('[data-site-contents-fallback]');
  if (!root || !mount || !fallback) return null;
  const document = root.ownerDocument;
  const view = document.defaultView!;
  const navigation = siteContentsNavigation(document)!;
  const owner = `site-contents-${++serial}`;
  const label = root.dataset.contentsLabel || 'Page contents';
  const names = ['data-contents-runtime', 'data-contents-family', 'data-contents-generation'];
  const subscribers = new Set<() => void>();
  let alive = true;
  let disabled = fallback.disabled;
  let focusEpoch = 0;
  const onFocus = () => {
    focusEpoch++;
  };
  document.addEventListener('focusin', onFocus, true);
  const rememberedFocus = new Map<number, { origin: Element; epoch: number }>();
  const revoke = () => {
    alive = false;
    subscribers.clear();
    rememberedFocus.clear();
    document.removeEventListener('focusin', onFocus, true);
    navigation.destroy();
  };
  return {
    root,
    mount,
    revoke,
    setDisabled(value: boolean) {
      disabled = value;
      fallback.disabled = value;
      subscribers.forEach((paint) => paint());
    },
    async materialize(request: ProjectionScopeMaterializeRequest, namespace = 'docs') {
      const { projectionFamilyId: family, runtimeId: runtime } = request.selection;
      if (family !== 'shadcn' && family !== 'brutalist')
        throw new Error('Contents command family is unavailable');
      const origin = document.activeElement;
      rememberedFocus.clear();
      if (origin && root.contains(origin))
        rememberedFocus.set(request.generation, { origin, epoch: focusEpoch });
      let candidate: MaterializedProjectionCandidate | undefined;
      const isActive = () =>
        alive &&
        !disabled &&
        !!candidate &&
        candidate.host.dataset.projectionGenerationState === 'active' &&
        !candidate.host.inert;
      const props = { variant: family === 'brutalist' ? 'surface' : 'ghost', size: 'icon' };
      candidate = await materializeProjectionCandidate(request, {
        mount,
        ownerId: `${owner}-${namespace}`,
        componentId: 'button',
        controls,
        controlIds: [],
        content: {
          recipe: {
            id: 'website-contents-command',
            prototypeIds: [`${family}-button`, 'lucide-list-icon'],
            rootPrototypeId: `${family}-button`,
          },
          demo: {
            type: 'demo',
            root: {
              kind: 'proto',
              prototypeId: `${family}-button`,
              ref: 'contents-command',
              props: { ...props, disabled },
              surfaceStyle: {
                width: '2.75rem',
                height: '2.75rem',
                minWidth: '2.75rem',
                minHeight: '2.75rem',
              },
              children: [
                {
                  kind: 'box',
                  attrs: { 'aria-hidden': 'true' },
                  children: [
                    { kind: 'proto', prototypeId: 'lucide-list-icon', props: { size: 18 } },
                  ],
                },
                { kind: 'box', className: 'sr-only', children: [label] },
              ],
            },
            setup(context) {
              const button = context.refs['contents-command'];
              button.dataset.siteContentsButton = '';
              button.dataset.siteControlFamily = family;
              button.title = label;
              let live = true;
              let queued = false;
              const activate = () => {
                // Leave the WC dispatch stack before focusing or updating peers.
                queueMicrotask(() => {
                  if (live && isActive()) navigation.toggle();
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
                  context.api.setProps('contents-command', {
                    ...props,
                    disabled,
                    ...(runtime === 'wc' ? {} : { onClick: activate }),
                  });
                });
              };
              const unbind = navigation.bindButton(button, isActive, () => {
                context.api.call('contents-command', 'focusSelf');
              });
              if (runtime === 'wc') button.addEventListener('click', click);
              subscribers.add(paint);
              paint();
              return () => {
                live = false;
                subscribers.delete(paint);
                button.removeEventListener('click', click);
                unbind();
              };
            },
          },
        },
      });
      const materialized = candidate;
      return {
        ...materialized,
        setLocked(locked: boolean) {
          materialized.setLocked?.(locked);
          if (!locked) navigation.refresh();
        },
      };
    },
    prepareCommit(commit: ProjectionScopeCommit) {
      const previous = names.map((name) => [name, root.getAttribute(name)] as const);
      const wasHidden = fallback.hidden;
      const wasInert = fallback.inert;
      let published = false;
      return {
        publish() {
          fallback.hidden = true;
          fallback.inert = true;
          root.dataset.contentsRuntime = commit.selection.runtimeId;
          root.dataset.contentsFamily = commit.selection.projectionFamilyId;
          root.dataset.contentsGeneration = String(commit.generation);
          published = true;
          const target = rememberedFocus.get(commit.generation);
          rememberedFocus.delete(commit.generation);
          queueMicrotask(() => {
            if (!alive || !published) return;
            navigation.refresh();
            if (
              target &&
              target.epoch === focusEpoch &&
              (document.activeElement === target.origin || document.activeElement === document.body)
            )
              navigation.focus();
          });
        },
        rollback() {
          published = false;
          rememberedFocus.delete(commit.generation);
          fallback.hidden = wasHidden;
          fallback.inert = wasInert;
          for (const [name, value] of previous) {
            if (value === null) root.removeAttribute(name);
            else root.setAttribute(name, value);
          }
        },
      };
    },
    dispose() {
      revoke();
      fallback.hidden = false;
      fallback.inert = false;
      for (const name of names) root.removeAttribute(name);
    },
  };
}
