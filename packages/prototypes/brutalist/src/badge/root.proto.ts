import { definePrototype, tw } from '@proto.ui/core';
import type {
  BrutalistBadgeRootExposes,
  BrutalistBadgeRootProps,
  BrutalistBadgeTone,
} from './types';

// P-BRUTALIST-BADGE-TONES
const BADGE_TONE_TOKENS: Record<BrutalistBadgeTone, string> = {
  accent: 'bg-canary text-canary-foreground',
  info: 'bg-sky text-sky-foreground',
  danger: 'bg-coral text-coral-foreground',
};

// P-BRUTALIST-BADGE-PASSIVE-BOUNDARY: consumers own status semantics; composed controls own interaction.
export const BrutalistBadgeRoot = definePrototype<
  BrutalistBadgeRootProps,
  BrutalistBadgeRootExposes
>({
  name: 'brutalist-badge-root',
  setup(def) {
    // P-BRUTALIST-BADGE-TONES
    def.props.define({
      tone: {
        type: 'enum',
        empty: 'fallback',
        options: ['accent', 'info', 'danger'],
      },
    });
    def.props.setDefaults({ tone: 'accent' });
    // P-BRUTALIST-BADGE-VISUAL-GRAMMAR
    def.feedback.style.use(
      tw(
        'inline-flex w-fit shrink-0 items-center justify-center rounded-none border-2 border-foreground px-2 py-0.5 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_var(--pui-foreground)]'
      )
    );
    // P-BRUTALIST-BADGE-TONES
    (Object.keys(BADGE_TONE_TOKENS) as BrutalistBadgeTone[]).forEach((tone) => {
      def.rule({
        when: (w) => w.prop('tone').eq(tone),
        intent: (i) => i.feedback.style.use(tw(BADGE_TONE_TOKENS[tone])),
      });
    });
    return (renderer) => [renderer.r.slot()];
  },
});
