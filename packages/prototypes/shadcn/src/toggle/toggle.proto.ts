import { definePrototype, tw } from '@proto.ui/core';
import { asToggle } from '@proto.ui/prototypes-base/toggle';
import { SHADCN_STYLE_IDS, setupShadcnStyleSelection } from '../style-scope';
import {
  TOGGLE_COMMON,
  TOGGLE_PROFILE,
  TOGGLE_OUTLINE,
  TOGGLE_FOCUS,
  TOGGLE_SIZE,
} from './profiles';
import type { ShadcnToggleExposes, ShadcnToggleProps } from './types';

const toggle = definePrototype<ShadcnToggleProps, ShadcnToggleExposes>({
  name: 'shadcn-toggle',
  setup(def) {
    def.props.define({
      variant: { type: 'enum', empty: 'fallback', options: ['default', 'outline'] },
      size: { type: 'enum', empty: 'fallback', options: ['default', 'sm', 'lg'] },
      active: { type: 'boolean', empty: 'fallback' },
      defaultActive: { type: 'boolean', empty: 'fallback' },
      disabled: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({
      variant: 'default',
      size: 'default',
      defaultActive: false,
      disabled: false,
    });

    // No second selection, activation, focus or disabled owner.
    const toggleState = asToggle().stateHandles;
    if (!toggleState) {
      throw new Error('[shadcn-toggle] asToggle must project Toggle state handles.');
    }
    const { active, disabled, hovered, focusVisible } = toggleState;
    const style = setupShadcnStyleSelection(def, 'new-york-v4', {
      supportedStyles: SHADCN_STYLE_IDS,
    });
    def.feedback.style.use(tw(TOGGLE_COMMON));
    def.rule({
      when: (w) => w.prop('variant').eq('default'),
      intent: (i) => i.feedback.style.use(tw('bg-transparent')),
    });
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) => i.feedback.style.use(tw(TOGGLE_PROFILE[profile])),
      });
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.prop('variant').eq('outline')),
        intent: (i) => i.feedback.style.use(tw(TOGGLE_OUTLINE[profile])),
      });
      for (const size of ['default', 'sm', 'lg'] as const) {
        def.rule({
          when: (w) => w.all(w.state(style).eq(profile), w.prop('size').eq(size)),
          intent: (i) => i.feedback.style.use(tw(TOGGLE_SIZE[`${profile}-${size}`])),
        });
      }
    }
    // Modern CSS uses muted for pressed/selected and foreground only on hover;
    // independently retained New York uses accent/accent-foreground for active.
    def.rule({
      when: (w) => w.all(w.not(w.state(style).eq('new-york-v4')), w.state(active).eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-muted')),
    });
    def.rule({
      when: (w) => w.all(w.not(w.state(style).eq('new-york-v4')), w.state(hovered).eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq('new-york-v4'), w.state(active).eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.prop('variant').eq('default'),
          w.state(hovered).eq(true),
          w.state(active).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-muted-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.prop('variant').eq('outline'),
          w.state(hovered).eq(true),
          w.state(active).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
    });
    // Focus follows outline border paint so border-ring remains authoritative.
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.state(focusVisible).eq(true)),
        intent: (i) => i.feedback.style.use(tw(TOGGLE_FOCUS[profile])),
      });
    }
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
    });
  },
});

/** P-SHADCN-TOGGLE-COMPATIBILITY-SUBSET remains draft: upstream pressed aliases,
 * native forwarding, invalid/glyph selectors and native visual closure remain
 * independent gaps. Style updates never replace the inherited active owner.
 */
export type {
  ShadcnToggleProps,
  ShadcnToggleExposes,
  ShadcnToggleStateHandles,
  ShadcnToggleAsHookContract,
} from './types';
export default toggle;
