import { defineAsHook, definePrototype, tw } from '@proto.ui/core';
import {
  tableRow as baseTableRow,
  type TableRowProps,
  type TableRowExposes,
} from '@proto.ui/prototypes-base/table';
import type { BootstrapTableRowExposes, BootstrapTableRowProps } from './types';

const asTableRow = defineAsHook<TableRowProps, TableRowExposes, {}>({
  ...baseTableRow,
  name: 'as-bootstrap-2-3-2-table-row-base',
});

export const tableRow = definePrototype<BootstrapTableRowProps, BootstrapTableRowExposes>({
  name: 'bootstrap-2-3-2-table-row',
  modules: asTableRow.modules,
  setup(def) {
    const behavior = asTableRow();
    def.props.define({
      section: { type: 'enum', options: ['header', 'body', 'footer'], empty: 'fallback' },
      striped: { type: 'boolean', empty: 'fallback' },
      hoverable: { type: 'boolean', empty: 'fallback' },
      tone: { type: 'enum', options: ['default', 'info', 'warning', 'error'], empty: 'fallback' },
    });
    def.props.setDefaults({
      section: 'body',
      striped: false,
      hoverable: false,
      tone: 'default',
    });
    def.feedback.style.use(tw('table-row'));
    def.rule({
      when: (w) => w.prop('section').eq('footer'),
      intent: (i) => i.feedback.style.use(tw('bg-secondary font-bold')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('striped').eq(true),
          w.prop('section').eq('body'),
          w.prop('tone').eq('default')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-secondary')),
    });
    def.rule({
      when: (w) => w.prop('tone').eq('info'),
      intent: (i) => i.feedback.style.use(tw('bg-[#d9edf7] text-[#333]')),
    });
    def.rule({
      when: (w) => w.prop('tone').eq('warning'),
      intent: (i) => i.feedback.style.use(tw('bg-[#fcf8e3] text-[#333]')),
    });
    def.rule({
      when: (w) => w.prop('tone').eq('error'),
      intent: (i) => i.feedback.style.use(tw('bg-destructive/15 text-foreground')),
    });
    // Passive hover observation only: no Trigger, selection, focus or action owner.
    const hovered = def.state.bool('bootstrapTableRowHovered', false);
    const clearHover = () => hovered.set(false, 'reason: passive table row hover ends');
    def.event.on('pointer.enter', () =>
      hovered.set(true, 'reason: passive table row pointer enters')
    );
    def.event.on('pointer.leave', clearHover);
    def.event.on('pointer.cancel', clearHover);
    def.lifecycle.onUnmounted(clearHover);
    def.rule({
      when: (w) =>
        w.all(
          w.state(hovered).eq(true),
          w.prop('hoverable').eq(true),
          w.prop('section').eq('body'),
          w.prop('tone').eq('default')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted')),
    });
    return behavior.render;
  },
});

export default tableRow;
