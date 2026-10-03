import { definePrototype, tw } from '@proto.ui/core';
import { BRUTALIST_PANEL_TOKENS } from '../../../../packages/prototypes/brutalist/src/style';

/** Website-only experimental, passive presentation. This is not Base CodeBlock
 * or the proposed private ChatUI composition. Native pre/code, source identity,
 * selection, scrolling, commands and their state remain with their owners. */
export const SiteCodeSurface = definePrototype<{
  family: 'shadcn' | 'brutalist';
  part: 'frame' | 'toolbar';
}>({
  name: 'site-code-surface',
  setup(def) {
    def.props.define({
      family: { type: 'enum', empty: 'fallback', options: ['shadcn', 'brutalist'] },
      part: { type: 'enum', empty: 'fallback', options: ['frame', 'toolbar'] },
    });
    def.props.setDefaults({ family: 'shadcn', part: 'frame' });
    def.feedback.style.use(tw('block w-full h-full pointer-events-none'));
    def.rule({
      when: (w) => w.all(w.prop('family').eq('shadcn'), w.prop('part').eq('frame')),
      intent: (i) => i.feedback.style.use(tw('rounded-xl border border-border bg-muted')),
    });
    def.rule({
      when: (w) => w.all(w.prop('family').eq('brutalist'), w.prop('part').eq('frame')),
      // Follow the family owner, including its future reviewed token corrections.
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_PANEL_TOKENS)),
    });
    def.rule({
      when: (w) => w.all(w.prop('family').eq('shadcn'), w.prop('part').eq('toolbar')),
      intent: (i) => i.feedback.style.use(tw('border-b border-border')),
    });
    def.rule({
      when: (w) => w.all(w.prop('family').eq('brutalist'), w.prop('part').eq('toolbar')),
      intent: (i) => i.feedback.style.use(tw('border-b-2 border-black')),
    });
    return (renderer) => renderer.r.slot();
  },
});
export default SiteCodeSurface;
