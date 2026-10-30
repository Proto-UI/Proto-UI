import {
  createContextKey,
  type DefHandle,
  type RunHandle,
  type StyleHandle,
  tw,
} from '@proto.ui/core';
import { TABS_CONTEXT } from '@proto.ui/prototypes-base/tabs';
import {
  setupShadcnStyleSelection,
  SHADCN_STYLE_IDS,
  type ShadcnStyleId,
  type ShadcnStyleProps,
} from '../style-scope';

export const TABS_PROJECTED_STYLES = Object.freeze([...SHADCN_STYLE_IDS]);

/**
 * Private transport for the upstream List `variant` prop so each Trigger rule
 * can observe `group-data-[variant=…]/tabs-list` without prop drilling.
 */
export const TABS_LIST_VARIANT = createContextKey<{ variant: 'default' | 'line' }>(
  'shadcn-tabs-list-variant'
);

/** Derived visual observation only: Base remains the sole orientation/selection owner. */
export function setupTabsVisual(def: DefHandle<ShadcnStyleProps>) {
  const style = setupShadcnStyleSelection(def, 'new-york-v4', {
    supportedStyles: TABS_PROJECTED_STYLES,
  });
  const orientation = def.state.enum('shadcnTabsVisualOrientation', 'horizontal', {
    options: ['horizontal', 'vertical'],
  });
  const variant = def.state.enum('shadcnTabsListVariant', 'default', {
    options: ['default', 'line'],
  });
  const sync = (run: RunHandle<ShadcnStyleProps>) => {
    orientation.set(
      run.context.read(TABS_CONTEXT).orientation,
      'reason: observe Base Tabs orientation for paint'
    );
    variant.set(
      run.context.tryRead(TABS_LIST_VARIANT)?.variant ?? 'default',
      'reason: observe Tabs List variant for paint'
    );
  };
  def.context.subscribe(TABS_CONTEXT, sync);
  def.context.trySubscribe(TABS_LIST_VARIANT, sync);
  def.lifecycle.onMounted(sync);
  return { style, orientation, variant };
}

/*
 * Universal part of the upstream trigger recipe (apps/v4/registry/bases/base/ui/tabs.tsx
 * plus apps/v4/registry/new-york-v4/ui/tabs.tsx): identical across styles. Gap, padding,
 * rounding, text size/weight and icon paddings live in the per-style recipe below.
 * `select-none`/`outline-none` stay separate Proto compatibility extras.
 */
export const TAB_TRIGGER_COMMON = tw(
  'relative inline-flex h-[calc(100%_-_1px)] flex-1 items-center justify-center whitespace-nowrap text-foreground/60 transition-all select-none border border-transparent'
);

/**
 * Per-style `.cn-tabs-trigger` overrides from internal/fixtures/shadcn-style-source
 * (style-*.css, pinned at 3d98900e9b73c45f035f8109e9d41ba6a51685e7), plus the
 * independent new-york-v4 recipe. Icon `[&_svg]` / `has-data-[icon]` tokens are a
 * shared inline-glyph contract gap, not projected here.
 */
export const TAB_TRIGGER_RECIPES: Record<ShadcnStyleId, StyleHandle> = {
  vega: tw('gap-1.5 rounded-md px-2 py-1 text-sm font-medium'),
  nova: tw('gap-1.5 rounded-md px-1.5 py-0.5 text-sm font-medium'),
  maia: tw('gap-1.5 rounded-xl px-2 py-1 text-sm font-medium'),
  lyra: tw('gap-1.5 rounded-none px-1.5 py-0.5 text-xs font-medium'),
  mira: tw('gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium'),
  luma: tw('gap-2 rounded-full px-3 py-1 text-sm font-medium'),
  sera: tw('gap-2 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider'),
  rhea: tw('gap-1.5 rounded-2xl px-1.5 py-0.5 text-sm font-medium'),
  'new-york-v4': tw('gap-1.5 rounded-md px-2 py-1 text-sm font-medium'),
};

/** Styles whose `.cn-tabs-list` declares rounding (sera has none upstream). */
export const TAB_LIST_ROUNDED: Partial<Record<ShadcnStyleId, StyleHandle>> = {
  vega: tw('rounded-lg'),
  nova: tw('rounded-lg'),
  maia: tw('rounded-[var(--pui-radius-4xl)]'),
  lyra: tw('rounded-none'),
  mira: tw('rounded-lg'),
  luma: tw('rounded-full'),
  rhea: tw('rounded-2xl'),
  'new-york-v4': tw('rounded-lg'),
};

/** `.cn-tabs-list` padding per style: sera/luma use p-1, everyone else p-[3px]. */
export const TAB_LIST_PADDED: Partial<Record<ShadcnStyleId, StyleHandle>> = {
  luma: tw('p-1'),
  sera: tw('p-1'),
};

/** `.cn-tabs-list` horizontal height per style. */
export const TAB_LIST_HEIGHT: Record<ShadcnStyleId, StyleHandle> = {
  vega: tw('h-9'),
  nova: tw('h-8'),
  maia: tw('h-9'),
  lyra: tw('h-8'),
  mira: tw('h-8'),
  luma: tw('h-9'),
  sera: tw('h-10'),
  rhea: tw('h-8'),
  'new-york-v4': tw('h-9'),
};

/**
 * `.cn-tabs-list` vertical overrides per style (universal vertical rule is
 * `h-fit flex-col`; maia/luma re-round, rhea re-pads).
 */
export const TAB_LIST_VERTICAL: Partial<Record<ShadcnStyleId, StyleHandle>> = {
  maia: tw('rounded-2xl'),
  luma: tw('rounded-2xl'),
  rhea: tw('p-1'),
};

/** `.cn-tabs-trigger` vertical padding per style. */
export const TAB_TRIGGER_VERTICAL: Partial<Record<ShadcnStyleId, StyleHandle>> = {
  maia: tw('px-2.5 py-1.5'),
  // Tailwind's source --spacing(1.25) is 1.25 × 0.25rem, not a browser CSS function.
  lyra: tw('py-[0.3125rem]'),
  mira: tw('py-[0.3125rem]'),
  luma: tw('px-3 py-1.5 rounded-2xl'),
  sera: tw('px-4 py-2'),
  rhea: tw('px-3 py-0.5'),
};

/**
 * `.cn-tabs-content` text size per style; new-york-v4 inherits the default
 * (no `.cn-tabs-content` text rule in its recipe).
 */
export const TAB_CONTENT_TEXT: Partial<Record<ShadcnStyleId, StyleHandle>> = {
  vega: tw('text-sm'),
  nova: tw('text-sm'),
  maia: tw('text-sm'),
  lyra: tw('text-xs leading-relaxed'),
  mira: tw('text-xs leading-relaxed'),
  luma: tw('text-sm'),
  sera: tw('text-sm'),
  rhea: tw('text-sm'),
};

/**
 * `data-[variant=line]` list rules: universal `gap-1 bg-transparent`, plus
 * `rounded-none` where the style's default list rounds (sera has no rounding
 * upstream and no line rule). lyra already rounds to none; re-adding is the
 * same source token, kept for symmetry.
 */
export const TAB_LIST_LINE_ROUNDED: readonly ShadcnStyleId[] = [
  'vega',
  'nova',
  'maia',
  'lyra',
  'mira',
  'luma',
  'rhea',
  'new-york-v4',
];

/**
 * Styles whose `.cn-tabs-trigger` (or `-aria` twin) declares the
 * `variant=default` active `shadow-sm`; line replaces it with `shadow-none`.
 * maia/lyra/mira/sera/luma/rhea declare no shadow upstream.
 */
export const TAB_TRIGGER_DEFAULT_SHADOW: readonly ShadcnStyleId[] = ['vega', 'nova', 'new-york-v4'];

/*
 * Upstream line indicator: the trigger's `after:` decoration
 * (after:absolute after:bg-foreground after:opacity-0 after:transition-opacity,
 * orientation-specific placement, opacity-100 on line+active). Realized as an
 * owned decorative target (C-FEEDBACK-STYLE-OWNED-TARGET-0001), not a DOM
 * pseudo-element or a second semantic owner.
 */
export const LINE_INDICATION_BASE = tw('absolute bg-foreground opacity-0 transition-opacity');
export const LINE_INDICATION_HORIZONTAL = tw('left-0 right-0 bottom-[-5px] h-0.5');
export const LINE_INDICATION_VERTICAL = tw('top-0 bottom-0 -right-1 w-0.5');
export const LINE_INDICATION_ACTIVE = tw('opacity-100');
