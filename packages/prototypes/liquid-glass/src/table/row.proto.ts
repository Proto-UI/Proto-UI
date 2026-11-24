// Neutral content projection: a passive structural row, no selection or focus
// ownership and no material candidate.
import { defineAsHook, definePrototype, tw } from '@proto.ui/core';
import {
  tableRow,
  type TableRowProps,
  type TableRowExposes,
} from '@proto.ui/prototypes-base/table';
import type { LiquidGlassTableRowExposes, LiquidGlassTableRowProps } from './types';

const asLiquidGlassTableRow = defineAsHook<TableRowProps, TableRowExposes, {}>({
  ...tableRow,
  name: 'as-liquid-glass-table-row',
});

export const liquidGlassTableRow = definePrototype<
  LiquidGlassTableRowProps,
  LiquidGlassTableRowExposes
>({
  name: 'liquid-glass-table-row',
  modules: asLiquidGlassTableRow.modules,
  setup(def) {
    const behavior = asLiquidGlassTableRow();
    def.props.define({
      section: { type: 'enum', options: ['header', 'body', 'footer'], empty: 'fallback' },
      lastInSection: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({ section: 'body', lastInSection: false });
    // Base owns row membership, rowIndex projection and the authored slot. The
    // family contributes a neutral content-layer row without glass optics.
    def.feedback.style.use(tw('table-row border-border transition-colors'));
    def.rule({
      when: (w) => w.meta('reducedMotion').eq('reduce'),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });
    def.rule({
      when: (w) => w.meta('preference.forcedColors').eq('active'),
      intent: (i) => i.feedback.style.use(tw('border-foreground')),
    });
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
      when: (w) =>
        w.all(
          w.any(w.prop('section').eq('body'), w.prop('section').eq('footer')),
          w.prop('lastInSection').eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('border-b-0')),
    });
    def.rule({
      when: (w) => w.prop('section').eq('footer'),
      intent: (i) => i.feedback.style.use(tw('border-t bg-muted/50 font-medium')),
    });
    // Passive hover observation only: no Trigger, selection, focus or material owner.
    const hovered = def.state.bool('liquidGlassTableRowHovered', false);
    const clearHover = () => hovered.set(false, 'reason: passive table row hover ends');
    def.event.on('pointer.enter', () =>
      hovered.set(true, 'reason: passive table row pointer enters')
    );
    def.event.on('pointer.leave', clearHover);
    def.event.on('pointer.cancel', clearHover);
    def.lifecycle.onUnmounted(clearHover);
    def.rule({
      when: (w) => w.all(w.state(hovered).eq(true), w.prop('section').eq('body')),
      intent: (i) => i.feedback.style.use(tw('bg-muted/50')),
    });
    return behavior.render;
  },
});

export default liquidGlassTableRow;
