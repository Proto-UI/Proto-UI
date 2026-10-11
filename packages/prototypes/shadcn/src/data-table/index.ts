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
  name: 'shadcn-data-table-root',
  setup(def) {
    const behavior = asDataTableRoot();
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground rounded-lg border border-border bg-background shadow-sm grid gap-0'
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
export { dataTableRoot as shadcnDataTableRoot };
export const dataTableRow = definePrototype<DataTableRowProps, DataTableRowExposes>({
  name: 'shadcn-data-table-row',
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
export { dataTableRow as shadcnDataTableRow };
export const dataTableCell = definePrototype<DataTableCellProps, DataTableCellExposes>({
  name: 'shadcn-data-table-cell',
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
export { dataTableCell as shadcnDataTableCell };
export const dataTableHeader = definePrototype<DataTableHeaderProps, DataTableHeaderExposes>({
  name: 'shadcn-data-table-header',
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
export { dataTableHeader as shadcnDataTableHeader };
export const dataTableCaption = definePrototype<DataTableCaptionProps, DataTableCaptionExposes>({
  name: 'shadcn-data-table-caption',
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
export { dataTableCaption as shadcnDataTableCaption };
export const dataTablePrevious = definePrototype<DataTablePreviousProps, DataTablePreviousExposes>({
  name: 'shadcn-data-table-previous',
  setup(def) {
    const behavior = asDataTablePrevious();
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm cursor-pointer'
      )
    );
    const states = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!states) throw new Error('[shadcn-data-table] Required inherited state is unavailable.');
    def.rule({
      when: (w) => w.state(states.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) => w.state(states.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-default')),
    });
    // Presentation consumes the existing owner; no second interaction hook.
    def.rule({
      when: (w) => w.all(w.state(states.pressed).eq(true), w.state(states.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('translate-y-px')),
    });
    return behavior.render;
  },
});
export { dataTablePrevious as shadcnDataTablePrevious };
export const dataTableNext = definePrototype<DataTableNextProps, DataTableNextExposes>({
  name: 'shadcn-data-table-next',
  setup(def) {
    const behavior = asDataTableNext();
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm cursor-pointer'
      )
    );
    const states = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!states) throw new Error('[shadcn-data-table] Required inherited state is unavailable.');
    def.rule({
      when: (w) => w.state(states.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) => w.state(states.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-default')),
    });
    // Presentation consumes the existing owner; no second interaction hook.
    def.rule({
      when: (w) => w.all(w.state(states.pressed).eq(true), w.state(states.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('translate-y-px')),
    });
    return behavior.render;
  },
});
export { dataTableNext as shadcnDataTableNext };

export { dataTableHeaderRow, shadcnDataTableHeaderRow } from './header-row.proto';
