import { definePrototype, tw } from '@proto.ui/core';
import { setupCardPartVisual, cardHorizontalPadding } from './visual';
import type { ShadcnCardHeaderProps, ShadcnCardHeaderExposes } from './types';
export const ShadcnCardHeader = definePrototype<ShadcnCardHeaderProps, ShadcnCardHeaderExposes>({
  name: 'shadcn-card-header',
  setup(def) {
    const visual = setupCardPartVisual(def);
    const { style, size } = visual;
    cardHorizontalPadding(def, visual);
    def.props.define({ divider: { type: 'boolean' } });
    def.props.setDefaults({ divider: false });
    def.feedback.style.use(tw('grid auto-rows-min grid-rows-[auto_auto] items-start'));
    def.rule({
      when: (w) => w.state(style).eq('rhea'),
      intent: (i) =>
        i.feedback.style.use(tw('rounded-t-[min(var(--pui-radius-4xl),24px)] gap-1.5')),
    });
    def.rule({
      when: (w) => w.state(style).eq('new-york-v4'),
      intent: (i) => i.feedback.style.use(tw('gap-2')),
    });
    def.rule({
      when: (w) => w.prop('divider').eq(true),
      intent: (i) => i.feedback.style.use(tw('border-b border-border')),
    });
    def.rule({
      when: (w) => w.all(w.prop('divider').eq(true), w.state(style).eq('new-york-v4')),
      intent: (i) => i.feedback.style.use(tw('pb-6')),
    });
    def.rule({
      when: (w) =>
        w.all(w.prop('divider').eq(true), w.state(style).eq('rhea'), w.state(size).eq('default')),
      intent: (i) => i.feedback.style.use(tw('pb-5')),
    });
    def.rule({
      when: (w) =>
        w.all(w.prop('divider').eq(true), w.state(style).eq('rhea'), w.state(size).eq('sm')),
      intent: (i) => i.feedback.style.use(tw('pb-4')),
    });
    return (r) => [r.r.slot()];
  },
});
