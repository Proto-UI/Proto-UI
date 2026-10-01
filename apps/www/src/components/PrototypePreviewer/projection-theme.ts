import { BRUTALIST_THEME } from '../../../../../packages/prototypes/brutalist/src/theme';

import type { ProjectionFamilyId } from './projection-families';

/**
 * Website Shadcn theme inputs that the projection scope is allowed to read.
 * Keeping this list explicit prevents arbitrary page CSS from becoming an
 * implicit Prototype dependency.
 */
export const WEBSITE_SHADCN_THEME_TOKENS = [
  'radius',
  'radius-xl',
  'radius-lg',
  'radius-md',
  'radius-sm',
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'border',
  'input',
  'ring',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'sidebar',
  'sidebar-foreground',
  'sidebar-primary',
  'sidebar-primary-foreground',
  'sidebar-accent',
  'sidebar-accent-foreground',
  'sidebar-border',
  'sidebar-ring',
  'surface',
  'surface-foreground',
  'code',
  'code-foreground',
  'code-highlight',
  'code-number',
  'selection',
  'selection-foreground',
] as const;

export type ProjectionThemeSurfaceStyle = Readonly<Record<`--pui-${string}`, string>>;

type ProjectionThemeSurface = HTMLElement | SVGElement;

const appliedThemeProperties = new WeakMap<ProjectionThemeSurface, ReadonlySet<string>>();

function isDarkTheme(scope: Element): boolean {
  for (let current: Element | null = scope; current; current = current.parentElement) {
    if (current.classList.contains('dark') || current.getAttribute('data-theme') === 'dark') {
      return true;
    }
    if (current.classList.contains('light') || current.getAttribute('data-theme') === 'light') {
      return false;
    }
  }
  return (
    scope.ownerDocument.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches === true
  );
}

function readWebsiteShadcnTheme(scope: Element): ProjectionThemeSurfaceStyle {
  const computed = scope.ownerDocument.defaultView?.getComputedStyle(scope);
  if (!computed) {
    throw new Error('[PrototypePreviewer] Website Shadcn theme input is unavailable.');
  }

  const entries = WEBSITE_SHADCN_THEME_TOKENS.map((name) => {
    const property = `--pui-${name}` as const;
    const value = computed.getPropertyValue(property).trim();
    if (!value) {
      throw new Error(
        `[PrototypePreviewer] Website Shadcn theme input is missing required ${property}.`
      );
    }
    return [property, value] as const;
  });
  return Object.freeze(Object.fromEntries(entries)) as ProjectionThemeSurfaceStyle;
}

function readBrutalistTheme(scope: Element): ProjectionThemeSurfaceStyle {
  const mode = isDarkTheme(scope) ? BRUTALIST_THEME.dark : BRUTALIST_THEME.light;
  return Object.freeze(
    Object.fromEntries(Object.entries(mode).map(([name, value]) => [`--pui-${name}`, value]))
  ) as ProjectionThemeSurfaceStyle;
}

/** Resolve only the manifest-declared consumer theme input for a projection lane. */
export function resolveProjectionThemeSurfaceStyle(
  projectionFamilyId: ProjectionFamilyId,
  scope: Element
): ProjectionThemeSurfaceStyle {
  if (projectionFamilyId === 'shadcn') return readWebsiteShadcnTheme(scope);
  if (projectionFamilyId === 'brutalist') return readBrutalistTheme(scope);
  const exhaustive: never = projectionFamilyId;
  throw new Error(`[PrototypePreviewer] unsupported projection theme ${String(exhaustive)}.`);
}

export function applyProjectionThemeSurfaceStyle(
  element: ProjectionThemeSurface,
  theme: ProjectionThemeSurfaceStyle
): void {
  const nextProperties = new Set(Object.keys(theme));
  for (const property of appliedThemeProperties.get(element) ?? []) {
    if (!nextProperties.has(property)) element.style.removeProperty(property);
  }
  for (const [property, value] of Object.entries(theme)) {
    element.style.setProperty(property, value);
  }
  appliedThemeProperties.set(element, nextProperties);
}

/**
 * Observe Website color-mode inputs and emit a complete, closed theme copy.
 * Repeated mutations that resolve to the same map are suppressed, so a
 * consumer may safely materialize the copy without creating an observer loop.
 */
export function watchProjectionThemeSurfaceStyle(
  projectionFamilyId: ProjectionFamilyId,
  scope: Element,
  onChange: (theme: ProjectionThemeSurfaceStyle) => void
): () => void {
  const doc = scope.ownerDocument;
  const view = doc.defaultView;
  if (!view) {
    throw new Error('[PrototypePreviewer] projection theme document has no window.');
  }

  let cleaned = false;
  let queued = false;
  let lastFingerprint: string | undefined;
  const emit = () => {
    queued = false;
    if (cleaned) return;
    const theme = resolveProjectionThemeSurfaceStyle(projectionFamilyId, scope);
    const fingerprint = JSON.stringify(Object.entries(theme));
    if (fingerprint === lastFingerprint) return;
    lastFingerprint = fingerprint;
    onChange(theme);
  };
  const schedule = () => {
    if (cleaned || queued) return;
    queued = true;
    view.queueMicrotask(emit);
  };

  const observer = new view.MutationObserver(schedule);
  for (let input: Element | null = scope; input; input = input.parentElement) {
    observer.observe(input, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'style'],
    });
  }
  const colorScheme = view.matchMedia?.('(prefers-color-scheme: dark)');
  colorScheme?.addEventListener?.('change', schedule);
  try {
    emit();
  } catch (error) {
    cleaned = true;
    observer.disconnect();
    colorScheme?.removeEventListener?.('change', schedule);
    throw error;
  }

  return () => {
    if (cleaned) return;
    cleaned = true;
    observer.disconnect();
    colorScheme?.removeEventListener?.('change', schedule);
  };
}
