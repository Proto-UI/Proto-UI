import { definePrototype, tw } from '@proto.ui/core';
import {
  asLabelRoot,
  type LabelRootProps,
  type LabelRootExposes,
} from '@proto.ui/prototypes-base/label';
import { setupShadcnStyleSelection, type ShadcnStyleProps } from '../style-scope';
export type ShadcnLabelRootProps = LabelRootProps & ShadcnStyleProps;
export default definePrototype<ShadcnLabelRootProps, LabelRootExposes>({
  name: 'shadcn-label-root',
  modules: asLabelRoot.modules,
  setup(def) {
    const inherited = asLabelRoot();
    const style = setupShadcnStyleSelection(def, 'new-york-v4');
    // .cn-label at shadcn-ui/ui@3d98900e. Peer/disabled-control recipes
    // require target facts that Base Label does not currently project.
    def.feedback.style.use(tw('flex items-center gap-2 text-foreground'));
    def.rule({
      when: (w) =>
        w.not(
          w.any(w.state(style).eq('lyra'), w.state(style).eq('mira'), w.state(style).eq('sera'))
        ),
      intent: (i) => i.feedback.style.use(tw('text-sm font-medium leading-none')),
    });
    def.rule({
      when: (w) => w.state(style).eq('lyra'),
      intent: (i) => i.feedback.style.use(tw('text-xs leading-none')),
    });
    def.rule({
      when: (w) => w.state(style).eq('mira'),
      intent: (i) => i.feedback.style.use(tw('text-xs font-medium leading-none')),
    });
    def.rule({
      when: (w) => w.state(style).eq('sera'),
      intent: (i) =>
        i.feedback.style.use(tw('text-xs font-semibold leading-relaxed uppercase tracking-wide')),
    });
    // Naming and activation remain independently configured by Base. In
    // particular, passive naming-only labels retain selectable authored text.
    return inherited.render;
  },
});
