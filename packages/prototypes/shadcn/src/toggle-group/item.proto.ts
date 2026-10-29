import { definePrototype, tw } from '@proto.ui/core';
import { asToggleGroupItem } from '@proto.ui/prototypes-base/toggle-group';
import { SHADCN_STYLE_IDS, setupShadcnStyleSelection } from '../style-scope';
import { TOGGLE_COMMON, TOGGLE_PROFILE, TOGGLE_FOCUS, TOGGLE_SIZE } from '../toggle/profiles';
import { setupCollectionHover } from '../toolbar/action-visual';
import type { ShadcnToggleGroupItemProps, ShadcnToggleGroupItemExposes } from './types';

/** Upstream ToggleGroupItem reuses toggleVariants; only that paint is shared.
 * asToggleGroupItem remains the sole Base hook, not asToggle or asButton.
 * This maps the existing default-size/default-variant public subset. No size,
 * variant or spacing API is silently manufactured from the upstream API.
 * New York zero-spacing first/last outer radii need public membership facts;
 * neither DOM sibling selectors nor a replacement collection owner is used.
 */
export default definePrototype<ShadcnToggleGroupItemProps, ShadcnToggleGroupItemExposes>({
  name: 'shadcn-toggle-group-item',
  setup(def) {
    const behavior = asToggleGroupItem();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[shadcn-toggle-group] Item state unavailable.');
    const style = setupShadcnStyleSelection(def, 'nova');
    const hovered = setupCollectionHover(def, state.disabled);
    def.feedback.style.use(tw(TOGGLE_COMMON));
    def.feedback.style.use(tw('shrink-0 bg-transparent'));
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              profile === 'new-york-v4'
                ? 'h-9 w-auto min-w-0 shrink-0 px-3 rounded-none shadow-none gap-2 text-sm font-medium transition-[color,box-shadow]'
                : TOGGLE_PROFILE[profile]
            )
          ),
      });
      if (profile !== 'new-york-v4') {
        def.rule({
          when: (w) => w.state(style).eq(profile),
          intent: (i) => i.feedback.style.use(tw(TOGGLE_SIZE[`${profile}-default`])),
        });
      }
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.state(state.active).eq(true)),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              profile === 'new-york-v4'
                ? 'bg-accent text-accent-foreground'
                : profile === 'sera'
                  ? 'bg-muted text-foreground'
                  : 'bg-muted'
            )
          ),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.state(hovered).eq(true),
            w.state(state.disabled).eq(false),
            w.state(state.active).eq(false)
          ),
        intent: (i) =>
          i.feedback.style.use(
            tw(profile === 'new-york-v4' ? 'bg-muted text-muted-foreground' : 'text-foreground')
          ),
      });
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.state(state.focusVisible).eq(true)),
        intent: (i) => i.feedback.style.use(tw(TOGGLE_FOCUS[profile])),
      });
    }
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('z-10 forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) => w.state(state.focused).eq(true),
      intent: (i) => i.feedback.style.use(tw('z-10')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
    });
    return behavior.render;
  },
});
