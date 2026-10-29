import { definePrototype, tw } from '@proto.ui/core';
import { asTextRoot } from '@proto.ui/prototypes-base/text';
import type { TextRootProps, TextRootExposes } from '@proto.ui/prototypes-base/text';

import type { ShadcnActionStyleProfile } from '../button/types';
import { SHADCN_STYLE_IDS } from '../style-scope';
export interface ShadcnTextRootProps extends TextRootProps {
  /** Explicit passive action typography; ordinary omission never inherits action paint. */
  actionProfile?: 'none' | ShadcnActionStyleProfile;
}

// P-SHADCN-TEXT-PROJECTION: family theme variables own font and ink; all inputs are portable.
// Explicit action typography follows the retained Button recipes in
// ../button/profiles.ts, including the independent 02cad611 New York profile.
const textRoot = definePrototype<ShadcnTextRootProps, TextRootExposes>({
  name: 'shadcn-text-root',
  setup(def) {
    asTextRoot();
    def.props.define({
      actionProfile: {
        type: 'enum',
        empty: 'fallback',
        options: ['none', ...SHADCN_STYLE_IDS, 'new-york'],
      },
    });
    def.props.setDefaults({ actionProfile: 'none' });
    // Action line boxes follow each Button's default text recipe. Caller size,
    // tone and weight stay Base inputs; the pure appearance helper pairs them.
    for (const profile of [
      'vega',
      'nova',
      'maia',
      'luma',
      'rhea',
      'new-york-v4',
      'new-york',
    ] as const) {
      def.rule({
        when: (w) => w.prop('actionProfile').eq(profile),
        intent: (i) => i.feedback.style.use(tw('leading-5')),
      });
    }
    for (const profile of ['lyra', 'sera'] as const) {
      def.rule({
        when: (w) => w.prop('actionProfile').eq(profile),
        intent: (i) => i.feedback.style.use(tw('leading-4')),
      });
    }
    def.rule({
      when: (w) => w.prop('actionProfile').eq('mira'),
      intent: (i) => i.feedback.style.use(tw('leading-relaxed')),
    });
    def.rule({
      when: (w) => w.prop('actionProfile').eq('sera'),
      intent: (i) => i.feedback.style.use(tw('uppercase tracking-widest')),
    });
    def.rule({
      when: (w) => w.prop('size').eq('xs'),
      intent: (i) => i.feedback.style.use(tw('text-xs')),
    });
    def.rule({
      when: (w) => w.prop('size').eq('sm'),
      intent: (i) => i.feedback.style.use(tw('text-sm')),
    });
    def.rule({
      when: (w) => w.prop('size').eq('base'),
      intent: (i) => i.feedback.style.use(tw('text-base')),
    });
    def.rule({
      when: (w) => w.prop('size').eq('lg'),
      intent: (i) => i.feedback.style.use(tw('text-lg')),
    });
    def.rule({
      when: (w) => w.prop('size').eq('xl'),
      intent: (i) => i.feedback.style.use(tw('text-xl')),
    });
    def.rule({
      when: (w) => w.prop('size').eq('2xl'),
      intent: (i) => i.feedback.style.use(tw('text-2xl')),
    });
    def.rule({
      when: (w) => w.prop('size').eq('3xl'),
      intent: (i) => i.feedback.style.use(tw('text-3xl')),
    });
    def.rule({
      when: (w) => w.prop('size').eq('4xl'),
      intent: (i) => i.feedback.style.use(tw('text-4xl')),
    });
    def.rule({
      when: (w) => w.prop('size').eq('5xl'),
      intent: (i) => i.feedback.style.use(tw('text-5xl')),
    });
    def.rule({
      when: (w) => w.prop('tone').eq('default'),
      intent: (i) => i.feedback.style.use(tw('text-foreground')),
    });
    def.rule({
      when: (w) => w.prop('tone').eq('muted'),
      intent: (i) => i.feedback.style.use(tw('text-muted-foreground')),
    });
    def.rule({
      when: (w) => w.prop('tone').eq('inherit'),
      intent: (i) => i.feedback.style.use(tw('text-inherit')),
    });
    def.rule({
      when: (w) => w.prop('weight').eq('normal'),
      intent: (i) => i.feedback.style.use(tw('font-normal')),
    });
    def.rule({
      when: (w) => w.prop('weight').eq('medium'),
      intent: (i) => i.feedback.style.use(tw('font-medium')),
    });
    def.rule({
      when: (w) => w.prop('weight').eq('semibold'),
      intent: (i) => i.feedback.style.use(tw('font-semibold')),
    });
    def.rule({
      when: (w) => w.prop('weight').eq('bold'),
      intent: (i) => i.feedback.style.use(tw('font-bold')),
    });
    def.rule({
      when: (w) => w.prop('font').eq('body'),
      intent: (i) => i.feedback.style.use(tw('font-sans')),
    });
    def.rule({
      when: (w) => w.prop('font').eq('heading'),
      intent: (i) => i.feedback.style.use(tw('font-heading')),
    });
    def.rule({
      when: (w) => w.prop('font').eq('mono'),
      intent: (i) => i.feedback.style.use(tw('font-mono')),
    });
    // leading=size keeps the selected size token's line box without an override.
    def.rule({
      when: (w) => w.all(w.prop('actionProfile').eq('none'), w.prop('leading').eq('tighter')),
      intent: (i) => i.feedback.style.use(tw('leading-[1.1]')),
    });
    def.rule({
      when: (w) => w.all(w.prop('actionProfile').eq('none'), w.prop('leading').eq('tight')),
      intent: (i) => i.feedback.style.use(tw('leading-tight')),
    });
    def.rule({
      when: (w) => w.all(w.prop('actionProfile').eq('none'), w.prop('leading').eq('snug')),
      intent: (i) => i.feedback.style.use(tw('leading-snug')),
    });
    def.rule({
      when: (w) => w.all(w.prop('actionProfile').eq('none'), w.prop('leading').eq('normal')),
      intent: (i) => i.feedback.style.use(tw('leading-normal')),
    });
    def.rule({
      when: (w) => w.all(w.prop('actionProfile').eq('none'), w.prop('leading').eq('relaxed')),
      intent: (i) => i.feedback.style.use(tw('leading-relaxed')),
    });
    def.rule({
      when: (w) =>
        w.all(w.not(w.prop('actionProfile').eq('sera')), w.prop('tracking').eq('normal')),
      intent: (i) => i.feedback.style.use(tw('tracking-normal')),
    });
    def.rule({
      when: (w) =>
        w.all(w.not(w.prop('actionProfile').eq('sera')), w.prop('tracking').eq('tighter')),
      intent: (i) => i.feedback.style.use(tw('tracking-tighter')),
    });
    def.rule({
      when: (w) => w.all(w.not(w.prop('actionProfile').eq('sera')), w.prop('tracking').eq('tight')),
      intent: (i) => i.feedback.style.use(tw('tracking-tight')),
    });
    def.rule({
      when: (w) => w.prop('emphasis').eq('normal'),
      intent: (i) => i.feedback.style.use(tw('not-italic')),
    });
    def.rule({
      when: (w) => w.prop('emphasis').eq('italic'),
      intent: (i) => i.feedback.style.use(tw('italic')),
    });
    def.rule({
      when: (w) => w.prop('decoration').eq('none'),
      intent: (i) => i.feedback.style.use(tw('no-underline')),
    });
    def.rule({
      when: (w) => w.prop('decoration').eq('underline'),
      intent: (i) => i.feedback.style.use(tw('underline')),
    });
    def.rule({
      when: (w) => w.prop('decoration').eq('line-through'),
      intent: (i) => i.feedback.style.use(tw('line-through')),
    });
  },
});
export default textRoot;
