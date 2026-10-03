import type { DemoChild, DemoSetupContext, DemoSpec } from './demo-types';
import type { ProjectionContentRecipe } from './projection-composition';
import {
  PROJECTION_FAMILY_MANIFESTS,
  resolveProjectionPart,
  type ProjectionComponentId,
  type ProjectionFamilyId,
  type ProjectionFamilyManifest,
} from './projection-families';
import {
  applyProjectionThemeSurfaceStyle,
  type ProjectionThemeSurfaceStyle,
} from './projection-theme';
import { resolveSiteLibraryFamily } from '../site-library-family';

export const RUNTIME_PREVIEW_SURFACE_ID = 'site-preview-surface';
const SURFACE_REF = '__website_runtime_preview_surface__';

function assertAvailableRef(node: DemoChild): void {
  if (typeof node === 'string' || node.kind === 'text') return;
  if (node.ref === SURFACE_REF) throw new Error('[RuntimeBox] reserved surface ref is in use.');
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
  theme?: ProjectionThemeSurfaceStyle
) {
  assertCanvasFamily(family);
  assertAvailableRef(child.root);
  const surfaceStyle: Record<string, string> = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minWidth: '0',
    minHeight: 'var(--runtime-box-content-min, 10rem)',
    padding: 'var(--runtime-box-content-padding, 1.5rem 1rem)',
    ...theme,
  };
  let active: DemoSetupContext | null = null;
  let currentFamily = family;
  const surface = {
    kind: 'proto' as const,
    prototypeId: RUNTIME_PREVIEW_SURFACE_ID,
    className: 'pui-runtime-preview-surface',
    ref: SURFACE_REF,
    props: { family, emphasis: 'plain', appearance: 'canvas' },
    surfaceStyle,
    children: [child.root],
  };
  const demo: DemoSpec = {
    type: 'demo',
    root: surface,
    setup(context) {
      if (active) throw new Error('[RuntimeBox] surface composition is already mounted.');
      active = context;
      let cleanup: void | (() => void);
      try {
        const { [SURFACE_REF]: _surface, ...refs } = context.refs;
        cleanup = child.setup?.({ ...context, refs });
      } catch (error) {
        active = null;
        throw error;
      }
      return () => {
        if (active !== context) return;
        active = null;
        cleanup?.();
      };
    },
  };
  return {
    demo,
    setAppearance(nextFamily: ProjectionFamilyId, nextTheme: ProjectionThemeSurfaceStyle) {
      assertCanvasFamily(nextFamily);
      for (const key of Object.keys(surfaceStyle)) {
        if (key.startsWith('--pui-')) delete surfaceStyle[key];
      }
      Object.assign(surfaceStyle, nextTheme);
      surface.props = { family: nextFamily, emphasis: 'plain', appearance: 'canvas' };
      if (active) {
        // A color-mode update only changes the declared theme values. It does
        // not rebuild the slot subtree or reinitialize the demonstrated state.
        if (nextFamily !== currentFamily) active.api.setProps(SURFACE_REF, surface.props);
        const target = active.refs[SURFACE_REF];
        if (target) applyProjectionThemeSurfaceStyle(target, nextTheme);
      }
      currentFamily = nextFamily;
    },
  };
}

/** Add exactly this app surface to the original accepted content closure. */
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
    prototypeIds: [...recipe.recipePrototypeIds, RUNTIME_PREVIEW_SURFACE_ID],
    rootPrototypeId: resolveProjectionPart(family, component, 'root').prototypeId,
  };
}
