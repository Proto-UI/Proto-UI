import { THEME as BOOTSTRAP_THEME } from '../../../../../packages/prototypes/bootstrap-2-3-2/src/theme';
import { THEME as LIQUID_GLASS_THEME } from '../../../../../packages/prototypes/liquid-glass/src/theme';
import { BRUTALIST_THEME } from '../../../../../packages/prototypes/brutalist/src/theme';
import { SHADCN_TYPOGRAPHY } from '../../../../../packages/prototypes/shadcn/src/text/typography';

import type { ProjectionFamilyId } from './projection-families';

export { scheduleProjectionThemeRead } from './projection-theme-read';

/**
 * Website Shadcn theme inputs that the projection scope is allowed to read.
 * Keeping this list explicit prevents arbitrary page CSS from becoming an
 * implicit Prototype dependency.
 */
export const WEBSITE_SHADCN_THEME_TOKENS = [
  'radius',
  'radius-2xl',
  'radius-3xl',
  'radius-4xl',
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
type ThemeStamp = Readonly<{ value: string; priority: string }>;
const preservedThemeStamps = new WeakMap<
  ProjectionThemeSurface,
  { properties: Map<string, ThemeStamp>; authored: Set<string> }
>();

const colorPreferenceSources = new WeakMap<
  Document,
  { listeners: Set<() => void>; stop: () => void }
>();

function subscribeColorPreference(doc: Document, schedule: () => void): () => void {
  let source = colorPreferenceSources.get(doc);
  if (!source) {
    const media = doc.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media?.addEventListener) return () => {};
    const listeners = new Set<() => void>();
    const refresh = () => {
      for (const listener of listeners) listener();
    };
    media.addEventListener('change', refresh);
    source = { listeners, stop: () => media.removeEventListener?.('change', refresh) };
    colorPreferenceSources.set(doc, source);
  }

  const { listeners, stop } = source;
  listeners.add(schedule);
  return () => {
    if (!listeners.delete(schedule) || listeners.size > 0) return;
    colorPreferenceSources.delete(doc);
    stop();
  };
}

function retainsThemeStamp(
  element: ProjectionThemeSurface,
  property: string,
  stamp: ThemeStamp
): boolean {
  return (
    element.style.getPropertyValue(property) === stamp.value &&
    element.style.getPropertyPriority(property) === stamp.priority
  );
}

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
  // Font selection is an opt-in consumer preset, unlike the required palette.
  // Read its dedicated bank, never a retained other-family --pui-font value.
  const typography = Object.entries(SHADCN_TYPOGRAPHY).map(([name, fallback]) => [
    `--pui-${name}`,
    computed.getPropertyValue(`--site-shadcn-${name}`).trim() || fallback,
  ]);
  return Object.freeze(
    Object.fromEntries([...entries, ...typography])
  ) as ProjectionThemeSurfaceStyle;
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
  if (projectionFamilyId === 'bootstrap-2-3-2' || projectionFamilyId === 'liquid-glass') {
    const palette = projectionFamilyId === 'bootstrap-2-3-2' ? BOOTSTRAP_THEME : LIQUID_GLASS_THEME;
    const mode = isDarkTheme(scope) ? palette.dark : palette.light;
    return Object.freeze(
      Object.fromEntries(Object.entries(mode).map(([name, value]) => [`--pui-${name}`, value]))
    ) as ProjectionThemeSurfaceStyle;
  }
  const exhaustive: never = projectionFamilyId;
  throw new Error(`[PrototypePreviewer] unsupported projection theme ${String(exhaustive)}.`);
}

export function applyProjectionThemeSurfaceStyle(
  element: ProjectionThemeSurface,
  theme: ProjectionThemeSurfaceStyle,
  mode: 'replace' | 'replace-batch' | 'preserve-inline' = 'replace'
): void {
  if (mode === 'replace-batch') {
    const nextProperties = new Set(Object.keys(theme));
    const removals = new Set<string>();
    for (const property of appliedThemeProperties.get(element) ?? []) {
      if (!nextProperties.has(property)) removals.add(property);
    }
    for (const [property, stamp] of preservedThemeStamps.get(element)?.properties ?? []) {
      if (retainsThemeStamp(element, property, stamp)) removals.add(property);
    }
    const writes = Object.entries(theme).filter(
      ([property, value]) =>
        removals.has(property) ||
        element.style.getPropertyValue(property) !== value ||
        element.style.getPropertyPriority(property)
    );
    let nextStyle: string | undefined;
    if (removals.size || writes.length) {
      // Parse with this document's CSSOM so unrelated declarations, priorities
      // and shorthand semantics survive. The draft never joins the document:
      // a connected text surface receives the complete palette in one write.
      const draft = element.ownerDocument.createElement('span').style;
      draft.cssText = element.style.cssText;
      for (const property of removals) draft.removeProperty(property);
      for (const [property, value] of writes) draft.setProperty(property, value);
      if (draft.cssText !== element.style.cssText) nextStyle = draft.cssText;
    }
    // A native style-attribute callback may synchronously clear or replace this
    // palette. Publish its lease first and never overwrite a newer lease after
    // the live write returns.
    preservedThemeStamps.delete(element);
    appliedThemeProperties.set(element, nextProperties);
    if (nextStyle !== undefined) element.style.cssText = nextStyle;
    return;
  }
  if (mode === 'preserve-inline') {
    if (appliedThemeProperties.has(element)) clearProjectionThemeSurfaceStyle(element);
    let state = preservedThemeStamps.get(element);
    if (!state) {
      state = { properties: new Map(), authored: new Set() };
      preservedThemeStamps.set(element, state);
    }
    const nextProperties = new Set(Object.keys(theme));
    for (const [property, stamp] of state.properties) {
      if (!retainsThemeStamp(element, property, stamp)) {
        // A changed value, priority, or deletion relinquishes this lease for
        // the rest of this stamp's lifetime, including later theme refreshes.
        state.properties.delete(property);
        state.authored.add(property);
      } else if (!nextProperties.has(property)) {
        element.style.removeProperty(property);
        state.properties.delete(property);
      }
    }
    for (const [property, value] of Object.entries(theme)) {
      if (state.authored.has(property)) continue;
      if (
        !state.properties.has(property) &&
        (element.style.getPropertyValue(property) || element.style.getPropertyPriority(property))
      ) {
        state.authored.add(property);
        continue;
      }
      if (
        !state.properties.has(property) ||
        element.style.getPropertyValue(property) !== value ||
        element.style.getPropertyPriority(property)
      ) {
        element.style.setProperty(property, value);
      }
      // Ownership starts with our write to an absent property, never with a
      // matching authored value. Equal external rewrites are indistinguishable.
      state.properties.set(property, {
        value: element.style.getPropertyValue(property),
        priority: element.style.getPropertyPriority(property),
      });
    }
    return;
  }
  if (preservedThemeStamps.has(element)) clearProjectionThemeSurfaceStyle(element);
  const nextProperties = new Set(Object.keys(theme));
  for (const property of appliedThemeProperties.get(element) ?? []) {
    if (!nextProperties.has(property)) element.style.removeProperty(property);
  }
  for (const [property, value] of Object.entries(theme)) {
    if (
      element.style.getPropertyValue(property) !== value ||
      element.style.getPropertyPriority(property)
    )
      element.style.setProperty(property, value);
  }
  appliedThemeProperties.set(element, nextProperties);
}

/** Drop a theme copy this projection applied so the element inherits again. */
export function clearProjectionThemeSurfaceStyle(element: ProjectionThemeSurface): void {
  for (const property of appliedThemeProperties.get(element) ?? []) {
    element.style.removeProperty(property);
  }
  appliedThemeProperties.delete(element);
  for (const [property, stamp] of preservedThemeStamps.get(element)?.properties ?? []) {
    if (retainsThemeStamp(element, property, stamp)) element.style.removeProperty(property);
  }
  preservedThemeStamps.delete(element);
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

  const observer = new view.MutationObserver((records) => {
    if (cleaned || queued) return;
    // Identical attribute writes are observable mutations, but introduce no
    // new theme input. Real changes in the same delivery still resolve a new
    // complete theme map; no computed value is cached across deliveries.
    if (
      records.some(
        (record) =>
          record.oldValue !==
          (record.target as Element).getAttributeNS(
            record.attributeNamespace,
            record.attributeName!
          )
      )
    )
      schedule();
  });
  for (let input: Element | null = scope; input; input = input.parentElement) {
    observer.observe(input, {
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ['class', 'data-theme', 'style'],
    });
  }
  let stopColorPreference = () => {};
  try {
    stopColorPreference = subscribeColorPreference(doc, schedule);
    emit();
  } catch (error) {
    cleaned = true;
    observer.disconnect();
    stopColorPreference();
    throw error;
  }

  return () => {
    if (cleaned) return;
    cleaned = true;
    observer.disconnect();
    stopColorPreference();
  };
}
