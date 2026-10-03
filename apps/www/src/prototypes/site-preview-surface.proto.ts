import { definePrototype, tw } from '@proto.ui/core';
import {
  BRUTALIST_PANEL_TOKENS,
  BRUTALIST_STRUCTURE_TOKENS,
} from '../../../../packages/prototypes/brutalist/src/style';

export type SitePreviewAppearance = 'card' | 'popup' | 'canvas';

/** Website-only experimental presentation surface, not a public Card protocol.
 * Native content semantics and preview data belong to the app. This Prototype
 * owns the selected family's visual shell and projects stable slot content. */
export const SitePreviewSurface = definePrototype<{
  family: 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass';
  emphasis: 'plain' | 'accent';
  appearance: SitePreviewAppearance;
}>({
  name: 'site-preview-surface',
  setup(def) {
    def.props.define({
      family: {
        type: 'enum',
        empty: 'fallback',
        options: ['shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'],
      },
      emphasis: { type: 'enum', empty: 'fallback', options: ['plain', 'accent'] },
      appearance: { type: 'enum', empty: 'fallback', options: ['card', 'popup', 'canvas'] },
    });
    def.props.setDefaults({ family: 'shadcn', emphasis: 'plain', appearance: 'card' });
    def.feedback.style.use(tw('block w-full min-w-0 border p-4 text-foreground'));
    def.rule({
      when: (w) => w.prop('family').eq('shadcn'),
      intent: (i) => i.feedback.style.use(tw('rounded-xl border-border bg-background')),
    });
    def.rule({
      when: (w) => w.all(w.prop('family').eq('shadcn'), w.prop('appearance').eq('card')),
      intent: (i) => i.feedback.style.use(tw('shadow-sm')),
    });
    def.rule({
      when: (w) => w.all(w.prop('family').eq('shadcn'), w.prop('emphasis').eq('accent')),
      intent: (i) => i.feedback.style.use(tw('bg-muted')),
    });
    def.rule({
      when: (w) => w.prop('family').eq('brutalist'),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_PANEL_TOKENS)),
    });
    // Elevation belongs to a card, never to the popup or demonstration canvas.
    def.rule({
      when: (w) => w.all(w.prop('family').eq('brutalist'), w.prop('appearance').eq('card')),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_STRUCTURE_TOKENS)),
    });
    def.rule({
      when: (w) => w.all(w.prop('family').eq('brutalist'), w.prop('emphasis').eq('accent')),
      intent: (i) => i.feedback.style.use(tw('bg-main text-main-foreground')),
    });
    // Partial families have real Button projections, but no generic Card or
    // Select guarantee. Their document canvas is an explicitly private passive
    // visual owner using that family's palette, never a Shadcn alias.
    def.rule({
      when: (w) => w.prop('family').eq('bootstrap-2-3-2'),
      intent: (i) => i.feedback.style.use(tw('rounded-[4px] border-border bg-background')),
    });
    def.rule({
      when: (w) => w.prop('family').eq('liquid-glass'),
      // Stage 0 deliberately leaves content panels neutral/opaque. The real
      // child Button owns its preference-gated material. A pill Button radius
      // is not promoted into a large content-canvas shape or optical claim.
      intent: (i) => i.feedback.style.use(tw('rounded-none border-border bg-background')),
    });
    return (renderer) => renderer.r.slot();
  },
});

export default SitePreviewSurface;
