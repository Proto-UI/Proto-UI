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
import { definePrototype, tw, type State } from '@proto.ui/core';
import {
  asDataTableRoot,
  asDataTableRow,
  asDataTableCell,
  asDataTableHeader,
  asDataTableCaption,
  asDataTablePrevious,
  asDataTableNext,
} from '@proto.ui/prototypes-base/data-table';
export type * from '@proto.ui/prototypes-base/data-table';
export const dataTableRoot = definePrototype<DataTableRootProps, DataTableRootExposes>({
  name: 'brutalist-data-table-root',
  setup(def) {
    const behavior = asDataTableRoot();
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground rounded-none border-2 border-border bg-background shadow-md grid gap-0'
      )
    );
    const states = behavior.stateHandles as Record<string, State<boolean>> | undefined;
    if (states?.focusVisible)
      def.rule({
        when: (w) => w.state(states.focusVisible!).eq(true),
        intent: (i) =>
          i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
      });
    if (states?.selected)
      def.rule({
        when: (w) => w.state(states.selected!).eq(true),
        intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
      });
    return behavior.render;
  },
});
export { dataTableRoot as brutalistDataTableRoot };
export const dataTableRow = definePrototype<DataTableRowProps, DataTableRowExposes>({
  name: 'brutalist-data-table-row',
  setup(def) {
    const behavior = asDataTableRow();
    def.feedback.style.use(
      tw('min-w-0 max-w-full text-foreground grid items-stretch border-b border-border')
    );
    const states = behavior.stateHandles as Record<string, State<boolean>> | undefined;
    if (states?.focusVisible)
      def.rule({
        when: (w) => w.state(states.focusVisible!).eq(true),
        intent: (i) =>
          i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
      });
    if (states?.selected)
      def.rule({
        when: (w) => w.state(states.selected!).eq(true),
        intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
      });
    return behavior.render;
  },
});
export { dataTableRow as brutalistDataTableRow };
export const dataTableCell = definePrototype<DataTableCellProps, DataTableCellExposes>({
  name: 'brutalist-data-table-cell',
  setup(def) {
    const behavior = asDataTableCell();
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground px-4 py-3 text-left text-sm'));
    const states = behavior.stateHandles as Record<string, State<boolean>> | undefined;
    if (states?.focusVisible)
      def.rule({
        when: (w) => w.state(states.focusVisible!).eq(true),
        intent: (i) =>
          i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
      });
    if (states?.selected)
      def.rule({
        when: (w) => w.state(states.selected!).eq(true),
        intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
      });
    return behavior.render;
  },
});
export { dataTableCell as brutalistDataTableCell };
export const dataTableHeader = definePrototype<DataTableHeaderProps, DataTableHeaderExposes>({
  name: 'brutalist-data-table-header',
  setup(def) {
    const behavior = asDataTableHeader();
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground px-4 py-3 text-left text-sm font-semibold cursor-pointer'
      )
    );
    const states = behavior.stateHandles as Record<string, State<boolean>> | undefined;
    if (states?.focusVisible)
      def.rule({
        when: (w) => w.state(states.focusVisible!).eq(true),
        intent: (i) =>
          i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
      });
    if (states?.selected)
      def.rule({
        when: (w) => w.state(states.selected!).eq(true),
        intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
      });
    return behavior.render;
  },
});
export { dataTableHeader as brutalistDataTableHeader };
export const dataTableCaption = definePrototype<DataTableCaptionProps, DataTableCaptionExposes>({
  name: 'brutalist-data-table-caption',
  setup(def) {
    const behavior = asDataTableCaption();
    def.feedback.style.use(
      tw('min-w-0 max-w-full text-foreground px-4 py-3 text-left font-semibold')
    );
    const states = behavior.stateHandles as Record<string, State<boolean>> | undefined;
    if (states?.focusVisible)
      def.rule({
        when: (w) => w.state(states.focusVisible!).eq(true),
        intent: (i) =>
          i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
      });
    if (states?.selected)
      def.rule({
        when: (w) => w.state(states.selected!).eq(true),
        intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
      });
    return behavior.render;
  },
});
export { dataTableCaption as brutalistDataTableCaption };
export const dataTablePrevious = definePrototype<DataTablePreviousProps, DataTablePreviousExposes>({
  name: 'brutalist-data-table-previous',
  setup(def) {
    const behavior = asDataTablePrevious();
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm cursor-pointer'
      )
    );
    const states = behavior.stateHandles as Record<string, State<boolean>> | undefined;
    if (states?.focusVisible)
      def.rule({
        when: (w) => w.state(states.focusVisible!).eq(true),
        intent: (i) =>
          i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
      });
    if (states?.selected)
      def.rule({
        when: (w) => w.state(states.selected!).eq(true),
        intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
      });
    return behavior.render;
  },
});
export { dataTablePrevious as brutalistDataTablePrevious };
export const dataTableNext = definePrototype<DataTableNextProps, DataTableNextExposes>({
  name: 'brutalist-data-table-next',
  setup(def) {
    const behavior = asDataTableNext();
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm cursor-pointer'
      )
    );
    const states = behavior.stateHandles as Record<string, State<boolean>> | undefined;
    if (states?.focusVisible)
      def.rule({
        when: (w) => w.state(states.focusVisible!).eq(true),
        intent: (i) =>
          i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
      });
    if (states?.selected)
      def.rule({
        when: (w) => w.state(states.selected!).eq(true),
        intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
      });
    return behavior.render;
  },
});
export { dataTableNext as brutalistDataTableNext };
