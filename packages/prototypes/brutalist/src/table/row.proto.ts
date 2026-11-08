import { defineAsHook, definePrototype, tw } from '@proto.ui/core';
import { tableRow as baseTableRow } from '@proto.ui/prototypes-base/table';
import type { BrutalistTableRowExposes, BrutalistTableRowProps } from './types';

const asTableRow = defineAsHook({ ...baseTableRow, name: 'as-brutalist-table-row' });

export const tableRow = definePrototype<BrutalistTableRowProps, BrutalistTableRowExposes>({
  name: 'brutalist-table-row',
  modules: asTableRow.modules,
  setup(def) {
    const inherited = asTableRow();
    // There are no Base section or row-group roles. Callers specify visual
    // section membership and section-finality; neither modifies topology/ARIA.
    def.props.define({
      section: { type: 'enum', options: ['header', 'body', 'footer'], empty: 'fallback' },
      lastInSection: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({ section: 'body', lastInSection: false });
    // Separation is a black rule, not a muted fill: inner rows keep a 1px
    // bottom border while the section-final row lets the Root's 2px frame
    // close the table.
    def.feedback.style.use(tw('table-row'));
    def.rule({
      when: (w) =>
        w.not(
          w.all(
            w.any(w.prop('section').eq('body'), w.prop('section').eq('footer')),
            w.prop('lastInSection').eq(true)
          )
        ),
      intent: (i) => i.feedback.style.use(tw('border-b border-black')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.any(w.prop('section').eq('body'), w.prop('section').eq('footer')),
          w.prop('lastInSection').eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('border-b-0')),
    });
    // The footer earns its summary weight through a doubled top rule and
    // semibold ink rather than a muted fill.
    def.rule({
      when: (w) => w.prop('section').eq('footer'),
      intent: (i) => i.feedback.style.use(tw('border-t-2 border-black font-semibold')),
    });
    // Hover is paint observation only: no Trigger, selection, focus or action
    // owner. The state owner mirrors the Shadcn row; only the paint is family
    // tokens, a dimmed main accent rather than a muted wash.
    const hovered = def.state.bool('brutalistTableRowHovered', false);
    const clearHover = () => hovered.set(false, 'reason: passive table row hover ends');
    def.event.on('pointer.enter', () =>
      hovered.set(true, 'reason: passive table row pointer enters')
    );
    def.event.on('pointer.leave', clearHover);
    def.event.on('pointer.cancel', clearHover);
    def.lifecycle.onUnmounted(clearHover);
    def.rule({
      when: (w) => w.state(hovered).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-main/20')),
    });
    return inherited.render;
  },
});

export { tableRow as brutalistTableRow };
export default tableRow;
