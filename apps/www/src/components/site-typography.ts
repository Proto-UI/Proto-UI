import { siteTextRecipe } from './site-text-recipes';
import { SITE_TYPOGRAPHY_ROLES, type SiteTypographyRole } from './site-text-recipes';
import { prepareDemoRuntime, renderDemo } from './PrototypePreviewer/demo-renderer';
import { loadPrototypes } from './PrototypePreviewer/prototype-modules';
import type { DemoRenderResult, DemoSpec } from './PrototypePreviewer/demo-types';
import type { MaterializedProjectionCandidate } from './PrototypePreviewer/projection-materializer';
import type { ProjectionScopeMaterializeRequest } from './PrototypePreviewer/projection-scope';
import {
  applyProjectionThemeSurfaceStyle,
  resolveProjectionThemeSurfaceStyle,
  type ProjectionThemeSurfaceStyle,
} from './PrototypePreviewer/projection-theme';
import { releaseHostMount } from './PrototypePreviewer/runtimes/host-mount';
import { isRuntimeId } from './PrototypePreviewer/runtimes/registry';

const ROLES = new Set<string>(SITE_TYPOGRAPHY_ROLES);
const SEMANTIC_TARGETS = 'h1,h2,h3,h4,h5,h6,p,label,legend,figcaption';
const COMPONENT_OWNED =
  '[data-previewer-id],[data-home-showcase],[data-homepage-actions],[data-site-native-link],[data-site-native-button],pre,code,script,style,template';
const PASSIVE_HEADER_FRAME =
  '.site-header-popup-surface:is([data-projection-prototype="shadcn-surface-root"],[data-projection-prototype="brutalist-surface-root"])';
const MARKERS = [
  'data-typography-owner',
  'data-typography-runtime',
  'data-typography-family',
  'data-typography-generation',
] as const;
type Target = { native: HTMLElement; role: SiteTypographyRole };
type ScopedTarget = Target & { context: 'site' | 'document' };
type View = ScopedTarget & {
  carrier: HTMLElement;
  surface: HTMLElement;
  slot: HTMLElement;
  home: HTMLElement;
};
const activeViews = new WeakMap<HTMLElement, View>();
// These are renderer-owned containers, never authored source nodes. Recording
// their source slot lets selection boundaries follow source siblings instead
// of keeping an offset into a carrier that will be moved or retired.
const selectionContainers = new WeakMap<Node, { native: HTMLElement; slot: HTMLElement }>();
let serial = 0;

/** Inventory uses native semantics, never discovers text by replacing HTML.
 * Existing Proto component content is deliberately not wrapped a second time. */
export function collectSiteTypographyTargets(root: ParentNode, docsOnly = false): Target[] {
  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>(
      docsOnly
        ? '[data-site-typography], [data-doc-flow] :is(h1,h2,h3,h4,h5,h6,p,label,legend,figcaption)'
        : `[data-site-typography],${SEMANTIC_TARGETS}`
    )
  );
  return candidates.flatMap((native): Target[] => {
    const explicit = native.dataset.siteTypography;
    const explicitRole = explicit !== undefined && ROLES.has(explicit);
    if (
      (native.closest(COMPONENT_OWNED) &&
        !(explicitRole && native.matches('output[data-home-demo-status]'))) ||
      native.closest('[data-site-typography-batch]')
    )
      return [];
    const prototypeOwner = native.closest('[data-pui-root],[data-pui-style]');
    // Only the existing passive Header frame is allowed to contain explicitly
    // marked native labels. An explicit marker never bypasses another actual
    // component's text owner or a preview/example island.
    if (
      prototypeOwner &&
      !(
        explicitRole &&
        native.closest('[data-site-header-panel-content]') &&
        prototypeOwner.matches(PASSIVE_HEADER_FRAME)
      )
    )
      return [];
    const tag = native.localName;
    const role =
      explicit && ROLES.has(explicit)
        ? (explicit as SiteTypographyRole)
        : /^h[1-6]$/.test(tag)
          ? (tag as SiteTypographyRole)
          : tag === 'label' || tag === 'legend'
            ? 'label'
            : tag === 'figcaption'
              ? 'caption'
              : 'body';
    // Only phrasing content can pass through a span. Leaf paragraphs/headings
    // and authored label/legend keep native semantics; block compositions stay
    // with their separately inventoried owner instead of producing invalid DOM.
    if (native.querySelector('p,h1,h2,h3,h4,h5,h6,div,section,article,ul,ol,li,table,fieldset,pre'))
      return [];
    if (!native.textContent?.trim() && !activeViews.has(native)) return [];
    return [{ native, role }];
  });
}

function sourceNodes(native: HTMLElement): Node[] {
  const active = activeViews.get(native);
  return Array.from(native.childNodes).flatMap((node) =>
    node === active?.carrier ? Array.from(active.slot.childNodes) : [node]
  );
}
type SelectionBoundary = {
  node: Node;
  offset: number;
  previous: Node | null;
  next: Node | null;
  native: HTMLElement | null;
};
function captureBoundary(node: Node | null, offset: number): SelectionBoundary | null {
  if (!node) return null;
  const owner = selectionContainers.get(node);
  const edge = (child: Node | undefined, end: boolean): Node | null => {
    if (!child) return null;
    const source = selectionContainers.get(child)?.slot;
    return source ? (end ? source.lastChild : source.firstChild) : child;
  };
  return {
    node,
    offset,
    previous: edge(node.childNodes[offset - 1], true),
    next: edge(node.childNodes[offset], false),
    native: owner?.native ?? (activeViews.has(node as HTMLElement) ? (node as HTMLElement) : null),
  };
}
function resolveBoundary(
  boundary: SelectionBoundary | null
): { node: Node; offset: number } | null {
  if (!boundary) return null;
  // Prefer the same source node immediately to the right; a terminal boundary
  // follows the same source node on its left. This maps native p child offsets
  // into a new slot and maps retired slot offsets back to native p on teardown.
  for (const [sibling, after] of [
    [boundary.next, false],
    [boundary.previous, true],
  ] as const) {
    const parent = sibling?.parentNode;
    if (sibling?.isConnected && parent)
      return {
        node: parent,
        offset: Array.prototype.indexOf.call(parent.childNodes, sibling) + (after ? 1 : 0),
      };
  }
  if (boundary.native?.isConnected)
    return {
      node: activeViews.get(boundary.native)?.slot ?? boundary.native,
      offset: 0,
    };
  return boundary.node.isConnected ? { node: boundary.node, offset: boundary.offset } : null;
}
function preserveSelection(document: Document, move: () => void): void {
  const focus = document.activeElement as HTMLElement | null;
  const selection = document.getSelection();
  const anchor = captureBoundary(selection?.anchorNode ?? null, selection?.anchorOffset ?? 0);
  const extent = captureBoundary(selection?.focusNode ?? null, selection?.focusOffset ?? 0);
  move();
  if (focus?.isConnected && document.activeElement !== focus) focus.focus({ preventScroll: true });
  const nextAnchor = resolveBoundary(anchor);
  const nextExtent = resolveBoundary(extent);
  if (selection && nextAnchor && nextExtent) {
    try {
      selection.setBaseAndExtent(
        nextAnchor.node,
        nextAnchor.offset,
        nextExtent.node,
        nextExtent.offset
      );
    } catch {
      /* Source changed while selecting. */
    }
  }
}

/** One renderer/framework root and runtime preparation for an entire scope.
 * Each passive carrier is moved as an opaque subtree; no VDOM update is ever
 * issued while carriers are borrowed. They return to their original batch
 * parent before renderer.destroy(), in original order, on every exit path. */
export function siteTypographyParticipant(
  root: HTMLElement,
  options: { docsOnly?: boolean; ownerId?: string } = {}
) {
  const document = root.ownerDocument;
  const ownerId = options.ownerId ?? `site-typography-${++serial}`;
  let alive = true;
  let committed: ScopedTarget[] = [];
  let committedCompact = false;
  const compact = () => document.defaultView?.matchMedia('(max-width: 47.999rem)').matches === true;
  const targets = (): ScopedTarget[] =>
    collectSiteTypographyTargets(root, options.docsOnly).map((target) => ({
      ...target,
      context:
        options.docsOnly &&
        target.native.closest('main[data-pagefind-body]') &&
        !target.native.closest('[data-homepage-runtime],aside,.starlight-aside')
          ? 'document'
          : 'site',
    }));
  let sourceRevision = 0;
  let sourceSnapshot: { targets: ScopedTarget[]; nodes: Node[][]; compact: boolean } | undefined;
  return {
    root,
    // A participant-local revision, independent of the page's runtime/family
    // generation. Native source nodes are compared by identity, never copied.
    getSourceRevision() {
      const next = targets();
      const nodes = next.map(({ native }) => sourceNodes(native));
      const isCompact = compact();
      const previous = sourceSnapshot;
      if (
        !previous ||
        previous.compact !== isCompact ||
        next.length !== previous.targets.length ||
        next.some(
          ({ native, role, context }, index) =>
            native !== previous.targets[index]!.native ||
            role !== previous.targets[index]!.role ||
            context !== previous.targets[index]!.context ||
            nodes[index]!.length !== previous.nodes[index]!.length ||
            nodes[index]!.some((node, offset) => node !== previous.nodes[index]![offset])
        )
      ) {
        sourceSnapshot = { targets: next, nodes, compact: isCompact };
        sourceRevision++;
      }
      return sourceRevision;
    },
    needsRefresh() {
      if (!alive) return false;
      const next = targets();
      return (
        compact() !== committedCompact ||
        next.length !== committed.length ||
        next.some(
          (target, index) =>
            target.native !== committed[index]?.native ||
            target.role !== committed[index]?.role ||
            target.context !== committed[index]?.context ||
            activeViews.get(target.native)?.carrier.parentElement !== target.native ||
            Array.from(target.native.childNodes).some(
              (node) => node !== activeViews.get(target.native)?.carrier
            )
        )
      );
    },
    async materialize(
      request: ProjectionScopeMaterializeRequest
    ): Promise<MaterializedProjectionCandidate> {
      const runtime = request.selection.runtimeId;
      const family = request.selection.projectionFamilyId;
      if (!isRuntimeId(runtime) || (family !== 'shadcn' && family !== 'brutalist'))
        throw new Error('[SiteTypography] Unsupported projection selection.');
      const selected = targets();
      const isCompact = compact();
      const host = document.createElement('span');
      host.dataset.siteTypographyBatch = ownerId;
      host.hidden = true;
      host.setAttribute('aria-hidden', 'true');
      // Staging contains no source text, IDs, controls or duplicate SEO copy.
      document.body.append(host);
      let renderer: DemoRenderResult | undefined;
      let batch: HTMLElement | undefined;
      let views: View[] = [];
      let disposed = false;
      let theme: ProjectionThemeSurfaceStyle;
      const applyTheme = () => {
        // Shadcn keeps its existing system-sans contract even when the retained
        // native parent still inherits a previous Brutalist font theme.
        const fontTheme =
          family === 'shadcn'
            ? {
                ...theme,
                '--pui-font-sans':
                  document.defaultView
                    ?.getComputedStyle(document.documentElement)
                    .getPropertyValue('--font-sans')
                    .trim() || 'ui-sans-serif, system-ui, sans-serif',
              }
            : theme;
        for (const view of views) applyProjectionThemeSurfaceStyle(view.surface, fontTheme);
      };
      const restoreNative = () =>
        preserveSelection(document, () => {
          for (const view of views) {
            if (activeViews.get(view.native) !== view) continue;
            // A source author may already have replaced textContent/innerHTML.
            // Never restore detached old copy over that newer native content.
            if (view.carrier.parentElement === view.native)
              view.carrier.replaceWith(...Array.from(view.slot.childNodes));
            activeViews.delete(view.native);
            for (const marker of MARKERS) view.native.removeAttribute(marker);
          }
        });
      const dispose = async () => {
        if (disposed) return;
        disposed = true;
        restoreNative();
        // Legal renderer parent ownership restored before framework teardown.
        if (batch) for (const view of views) batch.append(view.carrier);
        try {
          if (renderer) await renderer.destroy();
          else releaseHostMount(host);
        } finally {
          host.remove();
        }
      };
      try {
        theme = resolveProjectionThemeSurfaceStyle(family, root);
        if (selected.length === 0)
          return {
            host,
            scope: host,
            activate() {
              committed = [];
              committedCompact = isCompact;
            },
            setLocked() {},
            setThemeSurfaceStyle() {},
            dispose,
          };
        await Promise.all([prepareDemoRuntime(runtime), loadPrototypes([`${family}-text-root`])]);
        if (!alive) throw new Error('[SiteTypography] Scope was disposed during preparation.');
        const demo: DemoSpec = {
          type: 'demo',
          root: {
            kind: 'box',
            tag: 'span',
            ref: 'typography-batch',
            children: selected.map(({ role, context }, index) => ({
              kind: 'box',
              tag: 'span',
              ref: `carrier-${index}`,
              attrs: { 'data-site-typography-carrier': '' },
              children: [
                {
                  kind: 'proto',
                  prototypeId: `${family}-text-root`,
                  rootTag: 'span',
                  ref: `surface-${index}`,
                  props: { ...siteTextRecipe(role, family, isCompact, context) },
                  surfaceStyle: theme,
                  children: [
                    {
                      kind: 'box',
                      tag: 'span',
                      ref: `slot-${index}`,
                      attrs: { 'data-site-typography-slot': '' },
                    },
                  ],
                },
              ],
            })),
          },
          setup(context) {
            batch = context.refs['typography-batch'];
            views = selected.map((target, index) => {
              const carrier = context.refs[`carrier-${index}`];
              const surface = context.refs[`surface-${index}`];
              const slot = context.refs[`slot-${index}`];
              if (!carrier || !surface || !slot)
                throw new Error('[SiteTypography] Missing prepared inline slot.');
              surface.dataset.typographyPrototype = `${family}-text-root`;
              surface.dataset.typographyRole = target.role;
              surface.dataset.typographyRuntime = runtime;
              surface.dataset.typographyFamily = family;
              surface.dataset.typographyGeneration = String(request.generation);
              for (const container of [carrier, surface, slot])
                selectionContainers.set(container, { native: target.native, slot });
              return { ...target, carrier, surface, slot, home: batch! };
            });
          },
        };
        renderer = await renderDemo({ runtime, host, demo, isCurrent: () => alive && !disposed });
        if (!batch || views.length !== selected.length)
          throw new Error('[SiteTypography] Renderer did not prepare the whole batch.');
        applyTheme();
        return {
          host,
          scope: batch,
          activate() {
            if (disposed) throw new Error('[SiteTypography] Cannot activate a disposed batch.');
            preserveSelection(document, () => {
              for (const view of views) {
                if (!view.native.isConnected) continue;
                const previous = activeViews.get(view.native);
                const content = sourceNodes(view.native);
                view.slot.append(...content);
                // Leave a retired carrier under its own hidden batch, not in
                // native semantic content. It has no source nodes to duplicate.
                if (previous && previous !== view) {
                  previous.home.append(previous.carrier);
                }
                view.native.append(view.carrier);
                activeViews.set(view.native, view);
                view.native.dataset.typographyOwner = ownerId;
                view.native.dataset.typographyRuntime = runtime;
                view.native.dataset.typographyFamily = family;
                view.native.dataset.typographyGeneration = String(request.generation);
              }
            });
            committed = selected;
            committedCompact = isCompact;
          },
          // Passive text must remain selectable/clickable during preparation.
          setLocked() {},
          setThemeSurfaceStyle(next: ProjectionThemeSurfaceStyle) {
            theme = next;
            applyTheme();
          },
          dispose,
        };
      } catch (error) {
        await dispose();
        throw error;
      }
    },
    destroy() {
      alive = false;
      sourceSnapshot = undefined;
    },
  };
}
