import { createPassiveShellComposition } from './passive-shell-composition';
import type { RuntimeId } from './runtimes/ids';
import { surfacePrototypeId, panelSurfaceProps } from '../surface-recipes';
import type { DemoChild, DemoSpec } from './demo-types';
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
  let active: ReturnType<typeof createPassiveShellComposition> | null = null;
  let currentFamily = family;
  let currentTheme = theme;
  let ready: Promise<unknown> = Promise.resolve();
  const demo: DemoSpec = {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'pui-runtime-preview-composition',
      children: [
        { kind: 'box', ref: `${SURFACE_REF}-mount`, attrs: { 'data-passive-shell-mount': '' } },
        { kind: 'box', ref: `${SURFACE_REF}-content`, children: [child.root] },
      ],
    },
    setup(context) {
      const {
        [`${SURFACE_REF}-mount`]: mount,
        [`${SURFACE_REF}-content`]: content,
        ...refs
      } = context.refs;
      if (!mount || !content || active) throw new Error('Invalid RuntimeBox shell composition');
      const cleanup = child.setup?.({ ...context, refs });
      active = createPassiveShellComposition({
        runtime,
        mount,
        content,
        family: currentFamily,
        theme: currentTheme,
        prototypeId: (next) => surfacePrototypeId(next as ProjectionFamilyId),
        props: () => ({ ...panelSurfaceProps('canvas') }),
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
      });
      ready = active.ready;
      void ready.catch((error) =>
        console.error('[RuntimeBox] Native demo retained after shell failure.', error)
      );
      return () => {
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
      currentFamily = nextFamily;
      currentTheme = nextTheme;
      return active?.update(nextFamily, nextTheme) ?? Promise.resolve();
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
