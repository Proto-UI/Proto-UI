import { definePrototype, tw } from '@proto.ui/core';
import { brutalistCardHorizontalPadding, setupBrutalistCardPartVisual } from './visual';
import type { BrutalistCardFooterExposes, BrutalistCardFooterProps } from './types';

// P-BRUTALIST-CARD-FOOTER-VISUAL: child content and composed controls retain their own semantics.
export const BrutalistCardFooter = definePrototype<
  BrutalistCardFooterProps,
  BrutalistCardFooterExposes
>({
  name: 'brutalist-card-footer',
  setup(def) {
    const visual = setupBrutalistCardPartVisual(def);
    const { size } = visual;
    brutalistCardHorizontalPadding(def, visual);
    def.props.define({ divider: { type: 'boolean' } });
    def.props.setDefaults({ divider: false });
    def.feedback.style.use(tw('flex items-center justify-between gap-4'));
    def.rule({
      when: (w) => w.prop('divider').eq(true),
      intent: (i) => i.feedback.style.use(tw('border-t-2 border-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.prop('divider').eq(true), w.state(size).eq('default')),
      intent: (i) => i.feedback.style.use(tw('pt-6')),
    });
    def.rule({
      when: (w) => w.all(w.prop('divider').eq(true), w.state(size).eq('sm')),
      intent: (i) => i.feedback.style.use(tw('pt-4')),
    });
    return (renderer) => [renderer.r.slot()];
  },
});
