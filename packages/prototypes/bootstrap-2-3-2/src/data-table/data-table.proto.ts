import type {
  DataTableRootProps,
  DataTableRootExposes,
  DataTableRowProps,
  DataTableRowExposes,
  DataTableCellProps,
  DataTableCellExposes,
  DataTableHeaderProps,
  DataTableHeaderExposes,
  DataTableCaptionProps,
  DataTableCaptionExposes,
  DataTablePreviousProps,
  DataTablePreviousExposes,
  DataTableNextProps,
  DataTableNextExposes,
} from '@proto.ui/prototypes-base/data-table';
import { definePrototype, tw } from '@proto.ui/core';
import {
  asDataTableRoot,
  asDataTableRow,
  asDataTableCell,
  asDataTableHeader,
  asDataTableCaption,
  asDataTablePrevious,
  asDataTableNext,
} from '@proto.ui/prototypes-base/data-table';
import {
  bootstrapButtonRestFill,
  bootstrapButtonInteractiveFill,
  bootstrapButtonFlatFill,
  bootstrapButtonPressedFill,
  bootstrapButtonRaised,
  bootstrapButtonPressed,
} from '../button/paint';
export type * from '@proto.ui/prototypes-base/data-table';

// Base owns sorting, paging, selection and passive Table Structure. Bootstrap
// 2.3.2 has .table, not this interactive DataTable protocol. The baseline table
// recipe is used; no bordered/striped/hover class or invented row-group is added.
export const dataTableRoot = definePrototype<DataTableRootProps, DataTableRootExposes>({
  name: 'bootstrap-2-3-2-data-table-root',
  modules: asDataTableRoot.modules,
  setup(def) {
    const behavior = asDataTableRoot();
    def.feedback.style.use(
      tw(
        'table w-full max-w-full mb-[20px] border-collapse border-spacing-0 bg-transparent font-sans text-[14px] leading-[20px] text-foreground'
      )
    );
    return behavior.render;
  },
});
export { dataTableRoot as bootstrap232DataTableRoot };

export const dataTableRow = definePrototype<DataTableRowProps, DataTableRowExposes>({
  name: 'bootstrap-2-3-2-data-table-row',
  modules: asDataTableRow.modules,
  setup(def) {
    const behavior = asDataTableRow();
    const state = behavior.stateHandles!;
    def.feedback.style.use(tw('table-row'));
    // Selection is a Proto extension, using the source .info row palette.
    def.rule({
      when: (w) => w.state(state.selected).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-[#d9edf7]')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
    });
    return behavior.render;
  },
});
export { dataTableRow as bootstrap232DataTableRow };

export const dataTableCell = definePrototype<DataTableCellProps, DataTableCellExposes>({
  name: 'bootstrap-2-3-2-data-table-cell',
  modules: asDataTableCell.modules,
  setup(def) {
    const behavior = asDataTableCell();
    def.feedback.style.use(
      tw('table-cell p-[8px] leading-[20px] text-left align-top font-normal border-t border-[#ddd]')
    );
    // Base's renderer owns the actual record text, not an anonymous slot copy.
    return behavior.render;
  },
});
export { dataTableCell as bootstrap232DataTableCell };

export const dataTableHeader = definePrototype<DataTableHeaderProps, DataTableHeaderExposes>({
  name: 'bootstrap-2-3-2-data-table-header',
  modules: asDataTableHeader.modules,
  setup(def) {
    const behavior = asDataTableHeader();
    def.feedback.style.use(
      tw('table-cell p-[8px] leading-[20px] text-left font-bold border-t border-[#ddd]')
    );
    def.rule({
      when: (w) => w.prop('headerKind').eq('column'),
      intent: (i) => i.feedback.style.use(tw('align-bottom')),
    });
    def.rule({
      when: (w) => w.not(w.prop('headerKind').eq('column')),
      intent: (i) => i.feedback.style.use(tw('align-top')),
    });
    // Header sorting remains with Base. Its public capture does not expose
    // the inherited structure row coordinate, so the source's first-thead
    // border exception cannot be inferred from DOM or arbitrary slot order.
    return behavior.render;
  },
});
export { dataTableHeader as bootstrap232DataTableHeader };

export const dataTableCaption = definePrototype<DataTableCaptionProps, DataTableCaptionExposes>({
  name: 'bootstrap-2-3-2-data-table-caption',
  modules: asDataTableCaption.modules,
  setup(def) {
    const behavior = asDataTableCaption();
    def.feedback.style.use(tw('table-caption text-center font-normal'));
    return behavior.render;
  },
});
export { dataTableCaption as bootstrap232DataTableCaption };

// These are standalone Proto paging commands, not a fabricated Bootstrap
// .pagination ul/li topology. Consume passive .btn paint, not another Button.
export const dataTablePrevious = definePrototype<DataTablePreviousProps, DataTablePreviousExposes>({
  name: 'bootstrap-2-3-2-data-table-previous',
  modules: asDataTablePrevious.modules,
  setup(def) {
    const behavior = asDataTablePrevious();
    const state = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!state)
      throw new Error('[bootstrap-2-3-2-data-table] Required inherited Button states unavailable.');
    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center rounded-[4px] border px-[12px] py-[4px] text-[14px] font-normal leading-[20px] select-none cursor-pointer min-w-0 max-w-full whitespace-normal wrap-anywhere text-paint-[#333_0_1px_1px_rgb(255_255_255/75%)] border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_#b3b3b3_rgb(0_0_0/10%)]'
      )
    );
    def.feedback.style.use(tw(bootstrapButtonRaised));
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.disabled).eq(false),
          w.state(state.pressed).eq(false),
          w.state(state.hovered).eq(false),
          w.not(w.state(state.focused).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonRestFill.default)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.disabled).eq(false),
          w.state(state.pressed).eq(false),
          w.any(w.state(state.hovered).eq(true), w.state(state.focused).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonInteractiveFill.default)),
    });
    def.rule({
      when: (w) =>
        w.any(
          w.state(state.disabled).eq(true),
          w.all(
            w.state(state.pressed).eq(true),
            w.state(state.hovered).eq(false),
            w.not(w.state(state.focused).eq(true))
          )
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonFlatFill.default)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.disabled).eq(false),
          w.state(state.pressed).eq(true),
          w.any(w.state(state.hovered).eq(true), w.state(state.focused).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonPressedFill.default)),
    });
    def.rule({
      when: (w) => w.all(w.state(state.pressed).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonPressed)),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-65 cursor-default shadow-none')),
    });
    return behavior.render;
  },
});
export { dataTablePrevious as bootstrap232DataTablePrevious };

export const dataTableNext = definePrototype<DataTableNextProps, DataTableNextExposes>({
  name: 'bootstrap-2-3-2-data-table-next',
  modules: asDataTableNext.modules,
  setup(def) {
    const behavior = asDataTableNext();
    const state = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!state)
      throw new Error('[bootstrap-2-3-2-data-table] Required inherited Button states unavailable.');
    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center rounded-[4px] border px-[12px] py-[4px] text-[14px] font-normal leading-[20px] select-none cursor-pointer min-w-0 max-w-full whitespace-normal wrap-anywhere text-paint-[#333_0_1px_1px_rgb(255_255_255/75%)] border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_#b3b3b3_rgb(0_0_0/10%)]'
      )
    );
    def.feedback.style.use(tw(bootstrapButtonRaised));
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.disabled).eq(false),
          w.state(state.pressed).eq(false),
          w.state(state.hovered).eq(false),
          w.not(w.state(state.focused).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonRestFill.default)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.disabled).eq(false),
          w.state(state.pressed).eq(false),
          w.any(w.state(state.hovered).eq(true), w.state(state.focused).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonInteractiveFill.default)),
    });
    def.rule({
      when: (w) =>
        w.any(
          w.state(state.disabled).eq(true),
          w.all(
            w.state(state.pressed).eq(true),
            w.state(state.hovered).eq(false),
            w.not(w.state(state.focused).eq(true))
          )
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonFlatFill.default)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.disabled).eq(false),
          w.state(state.pressed).eq(true),
          w.any(w.state(state.hovered).eq(true), w.state(state.focused).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonPressedFill.default)),
    });
    def.rule({
      when: (w) => w.all(w.state(state.pressed).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonPressed)),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-65 cursor-default shadow-none')),
    });
    return behavior.render;
  },
});
export { dataTableNext as bootstrap232DataTableNext };

export { dataTableHeaderRow, bootstrap232DataTableHeaderRow } from './header-row.proto';
