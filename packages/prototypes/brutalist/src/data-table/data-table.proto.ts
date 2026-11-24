import {
  BRUTALIST_CONTROL_TOKENS,
  BRUTALIST_DISABLED_TOKENS,
  BRUTALIST_FOCUS_TOKENS,
  BRUTALIST_MOTION_HIT_TOKENS,
  BRUTALIST_PRESS_TOKENS,
  BRUTALIST_STRUCTURE_TOKENS,
} from '../style';
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
import { definePrototype, tw, type DefHandle } from '@proto.ui/core';
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

function setupPointerHover(def: DefHandle<any, any>) {
  const hovered = def.state.bool('dataTablePointerHover', false);
  const clear = () => hovered.set(false, 'brutalist data table pointer hover reset');
  def.event.on('pointer.enter', () =>
    hovered.set(true, 'brutalist data table pointer hover enter')
  );
  def.event.on('pointer.leave', clear);
  def.event.on('pointer.cancel', clear);
  def.lifecycle.onUnmounted(clear);
  return hovered;
}

export const dataTableRoot = definePrototype<DataTableRootProps, DataTableRootExposes>({
  name: 'brutalist-data-table-root',
  modules: asDataTableRoot.modules,
  setup(def) {
    const behavior = asDataTableRoot();
    def.feedback.style.use(
      tw(
        `table w-full min-w-0 max-w-full caption-bottom bg-secondary-background text-foreground ${BRUTALIST_STRUCTURE_TOKENS}`
      )
    );
    return behavior.render;
  },
});
export { dataTableRoot as brutalistDataTableRoot };

export const dataTableRow = definePrototype<DataTableRowProps, DataTableRowExposes>({
  name: 'brutalist-data-table-row',
  modules: asDataTableRow.modules,
  setup(def) {
    const behavior = asDataTableRow();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[brutalist-data-table] Row state unavailable.');
    const hovered = setupPointerHover(def);
    def.feedback.style.use(tw('min-w-0 max-w-full font-sans font-medium'));
    def.rule({
      when: (w) => w.state(state.hidden).eq(false),
      intent: (i) => i.feedback.style.use(tw('table-row')),
    });
    def.rule({
      when: (w) => w.state(state.collectionLast).eq(false),
      intent: (i) => i.feedback.style.use(tw('border-b-2 border-black')),
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
          w.state(state.selected).eq(false),
          w.any(
            w.state(hovered).eq(false),
            w.state(state.hidden).eq(true),
            w.prop('header').eq(true)
          )
        ),
      intent: (i) => i.feedback.style.use(tw('bg-secondary-background text-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(hovered).eq(true),
          w.state(state.selected).eq(false),
          w.state(state.hidden).eq(false),
          w.prop('header').eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-background text-foreground')),
    });
    def.rule({
      when: (w) => w.state(state.selected).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-main text-main-foreground')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(`${BRUTALIST_FOCUS_TOKENS} forced-colors-focus-outline`)),
    });
    return behavior.render;
  },
});
export { dataTableRow as brutalistDataTableRow };

export const dataTableCell = definePrototype<DataTableCellProps, DataTableCellExposes>({
  name: 'brutalist-data-table-cell',
  modules: asDataTableCell.modules,
  setup(def) {
    const behavior = asDataTableCell();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[brutalist-data-table] Cell state unavailable.');
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full px-4 py-3 text-left align-middle text-sm font-sans font-medium text-inherit'
      )
    );
    def.rule({
      when: (w) => w.state(state.hidden).eq(false),
      intent: (i) => i.feedback.style.use(tw('table-cell')),
    });
    return behavior.render;
  },
});
export { dataTableCell as brutalistDataTableCell };

export const dataTableHeader = definePrototype<DataTableHeaderProps, DataTableHeaderExposes>({
  name: 'brutalist-data-table-header',
  modules: asDataTableHeader.modules,
  setup(def) {
    const behavior = asDataTableHeader();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[brutalist-data-table] Header state unavailable.');
    const hovered = setupPointerHover(def);
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full px-4 py-3 text-left align-middle text-sm font-heading font-bold text-foreground select-none'
      )
    );
    def.rule({
      when: (w) => w.state(state.hidden).eq(false),
      intent: (i) => i.feedback.style.use(tw('table-cell')),
    });
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
      intent: (i) => i.feedback.style.use(tw('bg-main/20')),
    });
    def.rule({
      when: (w) => w.any(w.state(state.sort).eq('ascending'), w.state(state.sort).eq('descending')),
      intent: (i) => i.feedback.style.use(tw('underline underline-offset-4')),
    });
    return behavior.render;
  },
});
export { dataTableHeader as brutalistDataTableHeader };

export const dataTableCaption = definePrototype<DataTableCaptionProps, DataTableCaptionExposes>({
  name: 'brutalist-data-table-caption',
  modules: asDataTableCaption.modules,
  setup(def) {
    const behavior = asDataTableCaption();
    def.feedback.style.use(
      tw('table-caption mt-3 px-2 py-1 text-left text-sm font-heading font-bold text-foreground')
    );
    return behavior.render;
  },
});
export { dataTableCaption as brutalistDataTableCaption };

export const dataTablePrevious = definePrototype<DataTablePreviousProps, DataTablePreviousExposes>({
  name: 'brutalist-data-table-previous',
  modules: asDataTablePrevious.modules,
  setup(def) {
    const behavior = asDataTablePrevious();
    def.feedback.style.use(
      tw(
        `min-w-0 max-w-full inline-flex shrink-0 min-h-9 items-center justify-center gap-2 px-3 py-2 text-sm whitespace-nowrap select-none ${BRUTALIST_CONTROL_TOKENS}`
      )
    );
    const states = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!states) throw new Error('[brutalist-data-table] Required inherited state is unavailable.');
    def.rule({
      when: (w) => w.state(states.disabled).eq(false),
      intent: (i) => i.feedback.style.use(tw('cursor-pointer')),
    });
    def.rule({
      when: (w) => w.state(states.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(`${BRUTALIST_FOCUS_TOKENS} forced-colors-focus-outline`)),
    });
    def.rule({
      when: (w) => w.state(states.disabled).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(`${BRUTALIST_DISABLED_TOKENS} cursor-default shadow-none`)),
    });
    // Presentation consumes the existing owner; no second interaction hook.
    def.rule({
      when: (w) => w.all(w.state(states.pressed).eq(true), w.state(states.disabled).eq(false)),
      intent: (i) =>
        i.feedback.style.use(tw(`${BRUTALIST_PRESS_TOKENS} ${BRUTALIST_MOTION_HIT_TOKENS}`)),
    });
    return behavior.render;
  },
});
export { dataTablePrevious as brutalistDataTablePrevious };

export const dataTableNext = definePrototype<DataTableNextProps, DataTableNextExposes>({
  name: 'brutalist-data-table-next',
  modules: asDataTableNext.modules,
  setup(def) {
    const behavior = asDataTableNext();
    def.feedback.style.use(
      tw(
        `min-w-0 max-w-full inline-flex shrink-0 min-h-9 items-center justify-center gap-2 px-3 py-2 text-sm whitespace-nowrap select-none ${BRUTALIST_CONTROL_TOKENS}`
      )
    );
    const states = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!states) throw new Error('[brutalist-data-table] Required inherited state is unavailable.');
    def.rule({
      when: (w) => w.state(states.disabled).eq(false),
      intent: (i) => i.feedback.style.use(tw('cursor-pointer')),
    });
    def.rule({
      when: (w) => w.state(states.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(`${BRUTALIST_FOCUS_TOKENS} forced-colors-focus-outline`)),
    });
    def.rule({
      when: (w) => w.state(states.disabled).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(`${BRUTALIST_DISABLED_TOKENS} cursor-default shadow-none`)),
    });
    // Presentation consumes the existing owner; no second interaction hook.
    def.rule({
      when: (w) => w.all(w.state(states.pressed).eq(true), w.state(states.disabled).eq(false)),
      intent: (i) =>
        i.feedback.style.use(tw(`${BRUTALIST_PRESS_TOKENS} ${BRUTALIST_MOTION_HIT_TOKENS}`)),
    });
    return behavior.render;
  },
});
export { dataTableNext as brutalistDataTableNext };

export { dataTableHeaderRow, brutalistDataTableHeaderRow } from './header-row.proto';
