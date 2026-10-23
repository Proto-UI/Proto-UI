import { definePrototype, tw } from '@proto.ui/core';
import { setupCardRootVisual } from './visual';
import type { ShadcnCardRootProps, ShadcnCardRootExposes } from './types';
export const ShadcnCardRoot = definePrototype<ShadcnCardRootProps, ShadcnCardRootExposes>({
  name: 'shadcn-card-root',
  setup(def) {
    const { style, size } = setupCardRootVisual(def);
    def.feedback.style.use(tw('flex flex-col bg-card text-card-foreground shadow-sm'));
    def.rule({
      when: (w) => w.state(style).eq('new-york-v4'),
      intent: (i) => i.feedback.style.use(tw('gap-6 rounded-xl border border-border py-6')),
    });
    def.rule({
      when: (w) => w.state(style).eq('rhea'),
      intent: (i) =>
        i.feedback.style.use(
          tw('overflow-hidden rounded-[min(var(--pui-radius-4xl),24px)] text-sm ring-1')
        ),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq('rhea'), w.not(w.meta('colorScheme').eq('dark'))),
      intent: (i) => i.feedback.style.use(tw('ring-foreground/5')),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq('rhea'), w.meta('colorScheme').eq('dark')),
      intent: (i) => i.feedback.style.use(tw('ring-foreground/10')),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq('rhea'), w.state(size).eq('default')),
      intent: (i) => i.feedback.style.use(tw('gap-5 py-5')),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq('rhea'), w.state(size).eq('sm')),
      intent: (i) => i.feedback.style.use(tw('gap-4 py-4')),
    });
    return (r) => [r.r.slot()];
  },
});
