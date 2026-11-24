import { definePrototype, tw } from '@proto.ui/core';
import {
  asDataTableRoot,
  asDataTableRow,
  asDataTableCell,
  asDataTableHeader,
  asDataTableCaption,
  asDataTablePrevious,
  asDataTableNext,
  type DataTableRootProps,
  type DataTableRootExposes,
  type DataTableRowProps,
  type DataTableRowExposes,
  type DataTableCellProps,
  type DataTableCellExposes,
  type DataTableHeaderProps,
  type DataTableHeaderExposes,
  type DataTableCaptionProps,
  type DataTableCaptionExposes,
  type DataTablePreviousProps,
  type DataTablePreviousExposes,
  type DataTableNextProps,
  type DataTableNextExposes,
} from '@proto.ui/prototypes-base/data-table';
import {
  setupShadcnStyleScope,
  setupShadcnStyleSelection,
  type ShadcnStyleProps,
} from '../style-scope';
import { setupCollectionActionVisual, setupCollectionHover } from '../toolbar/action-visual';
import { setupDataTableText, setupDataTableCell } from './visual';
export type * from '@proto.ui/prototypes-base/data-table';
export type ShadcnDataTableRootProps = DataTableRootProps & ShadcnStyleProps;
export type ShadcnDataTableRowProps = DataTableRowProps & ShadcnStyleProps;
export type ShadcnDataTableCellProps = DataTableCellProps & ShadcnStyleProps;
export type ShadcnDataTableHeaderProps = DataTableHeaderProps & ShadcnStyleProps;
export type ShadcnDataTableCaptionProps = DataTableCaptionProps & ShadcnStyleProps;
export type ShadcnDataTablePreviousProps = DataTablePreviousProps & ShadcnStyleProps;
export type ShadcnDataTableNextProps = DataTableNextProps & ShadcnStyleProps;

export const dataTableRoot = definePrototype<ShadcnDataTableRootProps, DataTableRootExposes>({
  name: 'shadcn-data-table-root',
  modules: asDataTableRoot.modules,
  setup(def) {
    const behavior = asDataTableRoot();
    setupShadcnStyleScope(def);
    setupDataTableText(def);
    def.feedback.style.use(tw('table w-full min-w-0 caption-bottom text-foreground'));
    return behavior.render;
  },
});
export { dataTableRoot as shadcnDataTableRoot };

export const dataTableRow = definePrototype<ShadcnDataTableRowProps, DataTableRowExposes>({
  name: 'shadcn-data-table-row',
  modules: asDataTableRow.modules,
  setup(def) {
    const behavior = asDataTableRow();
    setupShadcnStyleSelection(def, 'nova');
    const state = behavior.stateHandles;
    if (!state) throw new Error('[shadcn-data-table] Row state unavailable.');
    const hovered = setupCollectionHover(def);
    def.feedback.style.use(tw('transition-colors'));
    def.rule({
      when: (w) => w.state(state.hidden).eq(false),
      intent: (i) => i.feedback.style.use(tw('table-row')),
    });
    def.rule({
      when: (w) => w.state(state.collectionLast).eq(false),
      intent: (i) => i.feedback.style.use(tw('border-b border-border')),
    });
    def.rule({
      when: (w) => w.state(state.collectionLast).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-b-0')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.hidden).eq(false), w.prop('header').eq(false)),
      intent: (i) => i.feedback.style.use(tw('cursor-pointer')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(hovered).eq(true),
          w.state(state.selected).eq(false),
          w.state(state.hidden).eq(false),
          w.prop('header').eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted/50')),
    });
    def.rule({
      when: (w) => w.state(state.selected).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-muted')),
    });
    // Proto's selectable row adds this keyboard affordance; upstream TableRow
    // is not itself an interaction or focus owner.
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
    });
    return behavior.render;
  },
});
export { dataTableRow as shadcnDataTableRow };

export const dataTableCell = definePrototype<ShadcnDataTableCellProps, DataTableCellExposes>({
  name: 'shadcn-data-table-cell',
  modules: asDataTableCell.modules,
  setup(def) {
    const behavior = asDataTableCell();
    if (!behavior.stateHandles) throw new Error('[shadcn-data-table] Cell state unavailable.');
    setupDataTableCell(def, behavior.stateHandles.hidden);
    return behavior.render;
  },
});
export { dataTableCell as shadcnDataTableCell };

export const dataTableHeader = definePrototype<ShadcnDataTableHeaderProps, DataTableHeaderExposes>({
  name: 'shadcn-data-table-header',
  modules: asDataTableHeader.modules,
  setup(def) {
    const behavior = asDataTableHeader();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[shadcn-data-table] Header state unavailable.');
    setupDataTableCell(def, state.hidden, true);
    const hovered = setupCollectionHover(def);
    def.feedback.style.use(tw('transition-colors select-none'));
    def.rule({
      when: (w) => w.prop('sortable').eq(true),
      intent: (i) => i.feedback.style.use(tw('cursor-pointer')),
    });
    def.rule({
      when: (w) => w.prop('sortable').eq(false),
      intent: (i) => i.feedback.style.use(tw('cursor-default')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('sortable').eq(true),
          w.state(hovered).eq(true),
          w.state(state.hidden).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted/50')),
    });
    def.rule({
      when: (w) => w.any(w.state(state.sort).eq('ascending'), w.state(state.sort).eq('descending')),
      intent: (i) => i.feedback.style.use(tw('font-semibold underline underline-offset-4')),
    });
    // Its public hook exposes sort only; do not fabricate focus/selected facts
    // by probing undeclared states or install a second focus owner for paint.
    return behavior.render;
  },
});
export { dataTableHeader as shadcnDataTableHeader };

export const dataTableCaption = definePrototype<
  ShadcnDataTableCaptionProps,
  DataTableCaptionExposes
>({
  name: 'shadcn-data-table-caption',
  modules: asDataTableCaption.modules,
  setup(def) {
    const behavior = asDataTableCaption();
    setupDataTableText(def);
    def.feedback.style.use(tw('table-caption mt-4 text-muted-foreground'));
    return behavior.render;
  },
});
export { dataTableCaption as shadcnDataTableCaption };

export const dataTablePrevious = definePrototype<
  ShadcnDataTablePreviousProps,
  DataTablePreviousExposes
>({
  name: 'shadcn-data-table-previous',
  modules: asDataTablePrevious.modules,
  setup(def) {
    const behavior = asDataTablePrevious();
    const state = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!state) throw new Error('[shadcn-data-table] Previous state unavailable.');
    setupCollectionActionVisual(def, state, 'outline');
    def.rule({
      when: (w) => w.state(state.disabled).eq(false),
      intent: (i) => i.feedback.style.use(tw('cursor-pointer')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('cursor-default')),
    });
    return behavior.render;
  },
});
export { dataTablePrevious as shadcnDataTablePrevious };

export const dataTableNext = definePrototype<ShadcnDataTableNextProps, DataTableNextExposes>({
  name: 'shadcn-data-table-next',
  modules: asDataTableNext.modules,
  setup(def) {
    const behavior = asDataTableNext();
    const state = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!state) throw new Error('[shadcn-data-table] Next state unavailable.');
    setupCollectionActionVisual(def, state, 'outline');
    def.rule({
      when: (w) => w.state(state.disabled).eq(false),
      intent: (i) => i.feedback.style.use(tw('cursor-pointer')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('cursor-default')),
    });
    return behavior.render;
  },
});
export { dataTableNext as shadcnDataTableNext };

export {
  dataTableHeaderRow,
  shadcnDataTableHeaderRow,
  type ShadcnDataTableHeaderRowProps,
} from './header-row.proto';
