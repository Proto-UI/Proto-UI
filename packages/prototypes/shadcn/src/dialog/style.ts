import { tw, type DefHandle, type OwnedStateHandle, type StyleHandle } from '@proto.ui/core';
import {
  SHADCN_STYLE_IDS,
  setupShadcnStyleSelection,
  type ShadcnStyleId,
  type ShadcnStyleProps,
} from '../style-scope';

export type OverlayRecipes = Readonly<Record<ShadcnStyleId, StyleHandle>>;
export const MODERN_OVERLAY_STYLES = [
  'vega',
  'nova',
  'maia',
  'lyra',
  'mira',
  'luma',
  'sera',
  'rhea',
] as const;

/** Paint only. Every caller still consumes its own public Base hook once.
 * Modern sources: shadcn-ui/ui 3d98900e9b73c45f035f8109e9d41ba6a51685e7,
 * apps/v4/registry/styles/style-*.css and bases/{base,radix}/ui/*.tsx.
 * New York recipes retain their component-specific pins; see each recipes.ts.
 * MIT Copyright (c) 2023 shadcn; package THIRD_PARTY_NOTICES.md retains the license.
 */
export function setupOverlayStyle(
  def: DefHandle<ShadcnStyleProps>,
  compatibility: ShadcnStyleId = 'new-york-v4'
) {
  return setupShadcnStyleSelection(def, compatibility, { supportedStyles: SHADCN_STYLE_IDS });
}

export function setupOverlayPaint(
  def: DefHandle<ShadcnStyleProps>,
  recipes: OverlayRecipes,
  compatibility: ShadcnStyleId = 'new-york-v4'
) {
  const style = setupOverlayStyle(def, compatibility);
  for (const profile of SHADCN_STYLE_IDS) {
    def.rule({
      when: (w) => w.state(style).eq(profile),
      intent: (i) => i.feedback.style.use(recipes[profile]),
    });
  }
  return style;
}

/** Luma and Rhea explicitly strengthen their five-percent surface ring in dark mode. */
export function setupOverlayDarkRing(
  def: DefHandle<ShadcnStyleProps>,
  style: OwnedStateHandle<ShadcnStyleId>
) {
  for (const profile of ['luma', 'rhea'] as const) {
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.meta('colorScheme').eq('dark')),
      intent: (i) => i.feedback.style.use(tw('ring-foreground/10')),
    });
  }
}

const MASK_PAINT = {
  vega: 'bg-black/10',
  nova: 'bg-black/10',
  maia: 'bg-black/80',
  lyra: 'bg-black/10',
  mira: 'bg-black/80',
  luma: 'bg-black/30',
  sera: 'bg-black/20',
  rhea: 'bg-black/30',
  'new-york-v4': 'bg-black/50',
} as const satisfies Readonly<Record<ShadcnStyleId, string>>;

export function setupOverlayMask(
  def: DefHandle<ShadcnStyleProps>,
  options: { opaqueFallback?: boolean } = {}
) {
  const style = setupOverlayStyle(def);
  def.feedback.style.use(tw('fixed inset-0'));
  if (options.opaqueFallback) {
    // Preserve the Dialog mask's existing fail-closed preference/support policy.
    def.feedback.style.use(tw('bg-background'));
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.meta('preference.reducedTransparency').eq('no-preference'),
            w.meta('preference.forcedColors').eq('none'),
            w.meta('styleSupport.backdropBlur4px').eq(true)
          ),
        intent: (i) => i.feedback.style.use(tw(MASK_PAINT[profile])),
      });
    }
  } else {
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) => i.feedback.style.use(tw(MASK_PAINT[profile])),
      });
    }
  }
  // The available public support fact is exactly 4px, not the source's 8px
  // backdrop-blur-sm. Do not silently substitute xs for Luma/Sera/Rhea.
  for (const profile of ['vega', 'nova', 'maia', 'lyra', 'mira', 'new-york-v4'] as const) {
    if (profile === 'new-york-v4' && !options.opaqueFallback) continue;
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.meta('preference.reducedTransparency').eq('no-preference'),
          w.meta('preference.forcedColors').eq('none'),
          w.meta('styleSupport.backdropBlur4px').eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('backdrop-blur-xs')),
    });
  }
  return style;
}
