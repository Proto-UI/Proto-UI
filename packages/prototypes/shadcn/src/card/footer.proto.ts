import { definePrototype, tw } from '@proto.ui/core';
import { setupCardPartVisual, cardHorizontalPadding } from './visual';
import type { ShadcnCardFooterProps, ShadcnCardFooterExposes } from './types';
export const ShadcnCardFooter = definePrototype<ShadcnCardFooterProps, ShadcnCardFooterExposes>({
  name: 'shadcn-card-footer',
  setup(def) {
    const visual = setupCardPartVisual(def);
    const { style, size } = visual;
    cardHorizontalPadding(def, visual);
    def.props.define({ divider: { type: 'boolean' } });
    def.props.setDefaults({ divider: false });
    def.feedback.style.use(tw('flex items-center'));
    def.rule({
      when: (w) => w.state(style).eq('rhea'),
      intent: (i) => i.feedback.style.use(tw('rounded-b-[min(var(--pui-radius-4xl),24px)]')),
    });

    def.rule({
      when: (w) => w.prop('divider').eq(true),
      intent: (i) => i.feedback.style.use(tw('border-t border-border')),
    });
    def.rule({
      when: (w) => w.all(w.prop('divider').eq(true), w.state(style).eq('new-york-v4')),
      intent: (i) => i.feedback.style.use(tw('pt-6')),
    });
    def.rule({
      when: (w) =>
        w.all(w.prop('divider').eq(true), w.state(style).eq('rhea'), w.state(size).eq('default')),
      intent: (i) => i.feedback.style.use(tw('pt-5')),
    });
    def.rule({
      when: (w) =>
        w.all(w.prop('divider').eq(true), w.state(style).eq('rhea'), w.state(size).eq('sm')),
      intent: (i) => i.feedback.style.use(tw('pt-4')),
    });
    return (r) => [r.r.slot()];
  },
});
