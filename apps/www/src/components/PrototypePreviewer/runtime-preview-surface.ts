import {
  createPassiveShellComposition,
  type PassiveShellAppearance,
} from './passive-shell-composition';
import type { RuntimeId } from './runtimes/ids';
import { surfacePrototypeId, panelSurfaceProps } from '../surface-recipes';
import {
  assertDemoSpec,
  type DemoChild,
  type DemoNode,
  type DemoRuntimeApi,
  type DemoSpec,
  type DemoSurfaceStyle,
} from './demo-types';
import type { ProjectionContentRecipe } from './projection-composition';
import {
  PROJECTION_FAMILY_MANIFESTS,
  resolveProjectionPart,
  type ProjectionComponentId,
  type ProjectionFamilyId,
  type ProjectionFamilyManifest,
} from './projection-families';
import { type ProjectionThemeSurfaceStyle } from './projection-theme';
import { resolveSiteLibraryFamily } from '../site-library-family';

export const RUNTIME_PREVIEW_SURFACE_ID = surfacePrototypeId;
const SURFACE_REF = '__website_runtime_preview_surface__';

function assertAvailableRef(node: DemoChild): void {
  if (typeof node === 'string' || node.kind === 'text') return;
  if (
    node.ref === SURFACE_REF ||
    node.ref === `${SURFACE_REF}-content` ||
    node.ref === `${SURFACE_REF}-mount`
  )
    throw new Error('[RuntimeBox] reserved surface ref is in use.');
  for (const child of node.children ?? []) assertAvailableRef(child);
}

export function runtimePreviewFamily(root: HTMLElement): ProjectionFamilyId {
  for (let scope: HTMLElement | null = root; scope; scope = scope.parentElement) {
    const family = scope.dataset.projectionFamily ?? scope.dataset.siteLibraryFamily;
    if (family === 'shadcn' || family === 'brutalist') return family;
    if (scope.classList.contains('brutalist-demo-frame')) return 'brutalist';
  }
  return resolveSiteLibraryFamily(root.ownerDocument.defaultView?.location.pathname ?? '/');
}

function assertCanvasFamily(family: ProjectionFamilyId): void {
  if (!Object.hasOwn(PROJECTION_FAMILY_MANIFESTS, family))
    throw new Error(`[RuntimeBox] unsupported canvas family: ${String(family)}`);
}

/** Flatten only opted-in Website surfaces. Vue 2 cannot consume a mixed
 * string/object style array; parse declaration strings before crossing the
 * existing normalized surface channel. Authored entries keep their order. */
function portalSurfaceStyle(
  theme: ProjectionThemeSurfaceStyle,
  authored?: DemoSurfaceStyle
): Record<string, string> {
  const declarations = new Map<string, string>(Object.entries(theme));
  const rejectImportant = (value: string) => {
    // The Demo surface contract forbids priority. Reuse its conservative
    // fallback before CSSOM parsing (including case/comment variations).
    if (/!\s*important(?:\s*;|\s*$)/i.test(value.replace(/\/\*[\s\S]*?\*\//g, ''))) {
      throw new Error('[RuntimeBox] owned portal surfaceStyle does not support !important.');
    }
  };
  const append = (property: string, value: string) => {
    // Match normalized JS style aliases, preserving case-sensitive custom
    // properties. CSS declaration parsing remains the platform's CSSOM job.
    const name = property.startsWith('--')
      ? property
      : property === 'cssFloat'
        ? 'float'
        : property
            .replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
            .replace(/^ms-/, '-ms-');
    // A repeated shorthand must stay after intervening longhands. Do not
    // inherit the first insertion's position from a merged object bag.
    declarations.delete(name);
    declarations.set(name, value);
  };
  for (const entry of Array.isArray(authored)
    ? authored
    : authored === undefined
      ? []
      : [authored]) {
    if (typeof entry !== 'string') {
      for (const [property, value] of Object.entries(entry)) {
        rejectImportant(value);
        append(property, value);
      }
      continue;
    }
    rejectImportant(entry);
    const declaration = document.createElement('span').style;
    declaration.cssText = entry;
    for (let index = 0; index < declaration.length; index += 1) {
      const property = declaration.item(index);
      append(property, declaration.getPropertyValue(property));
    }
  }
  return Object.fromEntries(declarations);
}

/** App composition, not Prototype template composition. The original recipe
 * remains the slot child, with its own refs, setup, state and cleanup. */
export function createRuntimePreviewSurface(
  child: DemoSpec,
  family: ProjectionFamilyId,
  theme: ProjectionThemeSurfaceStyle = {},
  runtime: RuntimeId = 'wc'
) {
  assertCanvasFamily(family);
  assertAvailableRef(child.root);
  const ownedSurfaces = new Map<
    string,
    {
      node: Extract<DemoNode, { kind: 'proto' }> & { surfaceStyle: Record<string, string> };
      authored?: DemoSurfaceStyle;
    }
  >();
  const refCounts = new Map<string, number>();
  const project = (node: DemoChild): DemoChild => {
    if (typeof node === 'string' || node.kind === 'text') return node;
    if (node.ref) refCounts.set(node.ref, (refCounts.get(node.ref) ?? 0) + 1);
    const children = node.children?.map(project);
    const changedChildren = children?.some((child, index) => child !== node.children![index]);
    if (node.kind === 'proto' && node.previewTheme !== undefined) {
      // Validate only the opt-in addition; preserve existing setup/props input behavior.
      assertDemoSpec({
        type: 'demo',
        root: {
          kind: 'proto',
          prototypeId: node.prototypeId,
          ref: node.ref,
          previewTheme: node.previewTheme,
          surfaceStyle: node.surfaceStyle,
        },
      });
      const projected = {
        ...node,
        children,
        surfaceStyle: portalSurfaceStyle(theme, node.surfaceStyle),
      };
      ownedSurfaces.set(node.ref!, { node: projected, authored: node.surfaceStyle });
      return projected;
    }
    return changedChildren ? { ...node, children } : node;
  };
  const projectedRoot = project(child.root) as DemoNode;
  for (const ref of ownedSurfaces.keys()) {
    if (refCounts.get(ref) !== 1)
      throw new Error('[RuntimeBox] owned portal surface ref must be unique.');
  }
  let surfaceApi: DemoRuntimeApi | null = null;
  let disposed = false;
  let active: ReturnType<typeof createPassiveShellComposition> | null = null;
  let currentFamily = family;
  let committedAppearance: PassiveShellAppearance | null = null;
  let currentTheme = theme;
  let ready: Promise<unknown> = Promise.resolve();
  const demo: DemoSpec = {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'pui-runtime-preview-composition',
      children: [
        { kind: 'box', ref: `${SURFACE_REF}-mount`, attrs: { 'data-passive-shell-mount': '' } },
        { kind: 'box', ref: `${SURFACE_REF}-content`, children: [projectedRoot] },
      ],
    },
    setup(context) {
      const {
        [`${SURFACE_REF}-mount`]: mount,
        [`${SURFACE_REF}-content`]: content,
        ...refs
      } = context.refs;
      if (!mount || !content || active) throw new Error('Invalid RuntimeBox shell composition');
      if (ownedSurfaces.size && !context.api.setSurfaceStyle) {
        throw new Error('[RuntimeBox] renderer lacks the normalized surface update channel.');
      }
      surfaceApi = context.api;
      // Rendering may have awaited a framework while appearance changed.
      // Replay the current declarations through the same owned channel.
      for (const [ref, owned] of ownedSurfaces) {
        surfaceApi.setSurfaceStyle!(ref, owned.node.surfaceStyle!);
      }
      const cleanup = child.setup?.({ ...context, refs });
      active = createPassiveShellComposition({
        runtime,
        mount,
        content,
        family: currentFamily,
        theme: currentTheme,
        prototypeId: (next) => surfacePrototypeId(next as ProjectionFamilyId),
        props: (next) => ({
          ...panelSurfaceProps('canvas'),
          ...(next === 'liquid-glass' ? { variant: 'transparent' } : {}),
        }),
        layout: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          minWidth: '0',
          minHeight: 'var(--runtime-box-content-min, 10rem)',
          padding: 'var(--runtime-box-content-padding, 1.5rem 1rem)',
        },
        className: 'pui-runtime-preview-surface',
        surfaceRef: SURFACE_REF,
        prepareAppearance(appearance) {
          let published = false;
          let previousAppearance: PassiveShellAppearance | null = null;
          let previousStyles = new Map<string, Record<string, string>>();
          return {
            publish() {
              if (disposed) return;
              previousAppearance = committedAppearance;
              previousStyles = new Map(
                [...ownedSurfaces].map(([ref, owned]) => [ref, owned.node.surfaceStyle])
              );
              committedAppearance = appearance;
              published = true;
              for (const [ref, owned] of ownedSurfaces) {
                if (disposed || committedAppearance !== appearance) return;
                const style = portalSurfaceStyle(appearance.theme, owned.authored);
                owned.node.surfaceStyle = style;
                surfaceApi?.setSurfaceStyle?.(ref, style);
              }
            },
            rollback() {
              if (!published || disposed) return;
              // Generation rollback revokes even a nested theme update to that
              // failed generation. A theme-only rollback must keep a newer edit.
              const owns =
                appearance.kind === 'generation'
                  ? committedAppearance?.generation === appearance.generation
                  : committedAppearance === appearance;
              if (!owns) return;
              committedAppearance = previousAppearance;
              for (const [ref, owned] of ownedSurfaces) {
                if (disposed || committedAppearance !== previousAppearance) return;
                const style = previousStyles.get(ref)!;
                owned.node.surfaceStyle = style;
                surfaceApi?.setSurfaceStyle?.(ref, style);
              }
            },
          };
        },
      });
      ready = active.ready;
      void ready.catch((error) =>
        console.error('[RuntimeBox] Native demo retained after shell failure.', error)
      );
      return () => {
        disposed = true;
        surfaceApi = null;
        const retiring = active;
        if (!retiring) return;
        active = null;
        // destroy synchronously restores the content owner's parent before its
        // renderer retires the original child tree.
        void retiring
          ?.destroy()
          .catch((error) => console.error('[RuntimeBox] Shell cleanup failed.', error));
        cleanup?.();
      };
    },
  };
  return {
    demo,
    get ready() {
      return ready;
    },
    setAppearance(nextFamily: ProjectionFamilyId, nextTheme: ProjectionThemeSurfaceStyle) {
      assertCanvasFamily(nextFamily);
      if (disposed) return Promise.resolve();
      currentFamily = nextFamily;
      currentTheme = nextTheme;
      if (active) return active.update(nextFamily, nextTheme);
      // Before the shell exists, stage current inputs for the first renderer
      // and its late setup replay. Mounted updates belong to the shell commit.
      for (const owned of ownedSurfaces.values()) {
        owned.node.surfaceStyle = portalSurfaceStyle(nextTheme, owned.authored);
      }
      return Promise.resolve();
    },
  };
}

/** The content owner declares only its actual tree. The independent shell
 * validates its own one-Prototype recipe before rendering. */
export function runtimePreviewRecipe(
  family: ProjectionFamilyId,
  component: ProjectionComponentId
): ProjectionContentRecipe {
  const recipe = (PROJECTION_FAMILY_MANIFESTS[family] as ProjectionFamilyManifest).families[
    component
  ];
  if (!recipe) throw new Error(`[RuntimeBox] unavailable ${family}/${component} recipe.`);
  return {
    id: `website-runtime-preview:${recipe.recipeId}`,
    prototypeIds: [...recipe.recipePrototypeIds],
    rootPrototypeId: resolveProjectionPart(family, component, 'root').prototypeId,
  };
}
