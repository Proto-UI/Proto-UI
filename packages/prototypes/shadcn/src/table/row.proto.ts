import { defineAsHook, definePrototype, tw } from '@proto.ui/core';
import { tableRow as baseTableRow } from '@proto.ui/prototypes-base/table';
import { setupShadcnStyleScope } from '../style-scope';
import type { ShadcnTableRowExposes, ShadcnTableRowProps } from './types';

const asTableRow = defineAsHook({ ...baseTableRow, name: 'as-shadcn-table-row' });

export const tableRow = definePrototype<ShadcnTableRowProps, ShadcnTableRowExposes>({
  name: 'shadcn-table-row',
  modules: asTableRow.modules,
  setup(def) {
    const inherited = asTableRow();
    // The row recipe is profile-independent; explicit row scope still reaches cells.
    setupShadcnStyleScope(def);
    // There are no Base section or row-group roles. Callers specify visual
    // section membership and section-finality; neither modifies topology/ARIA.
    def.props.define({
      section: { type: 'enum', options: ['header', 'body', 'footer'], empty: 'fallback' },
      lastInSection: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({ section: 'body', lastInSection: false });
    def.feedback.style.use(tw('table-row border-border transition-colors'));
    def.rule({
      when: (w) =>
        w.not(
          w.all(
            w.any(w.prop('section').eq('body'), w.prop('section').eq('footer')),
            w.prop('lastInSection').eq(true)
          )
        ),
      intent: (i) => i.feedback.style.use(tw('border-b')),
    });
    def.rule({
      when: (w) => w.all(w.prop('section').eq('body'), w.prop('lastInSection').eq(true)),
      intent: (i) => i.feedback.style.use(tw('border-0')),
    });
    def.rule({
      when: (w) => w.all(w.prop('section').eq('footer'), w.prop('lastInSection').eq(true)),
      intent: (i) => i.feedback.style.use(tw('border-b-0')),
    });
    // With the Root's collapsed borders, touching footer-row top/bottom edges
    // combine into one rule just as the upstream tfoot and tr borders do.
    def.rule({
      when: (w) => w.prop('section').eq('footer'),
      intent: (i) => i.feedback.style.use(tw('border-t bg-muted/50 font-medium')),
    });
    // Hover is paint observation only: no Trigger, selection, focus or action owner.
    const hovered = def.state.bool('shadcnTableRowHovered', false);
    const clearHover = () => hovered.set(false, 'reason: passive table row hover ends');
    def.event.on('pointer.enter', () =>
      hovered.set(true, 'reason: passive table row pointer enters')
    );
    def.event.on('pointer.leave', clearHover);
    def.event.on('pointer.cancel', clearHover);
    def.lifecycle.onUnmounted(clearHover);
    def.rule({
      when: (w) => w.state(hovered).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-muted/50')),
    });
    return inherited.render;
  },
});

export default tableRow;
