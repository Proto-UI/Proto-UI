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
import {
  COMMAND_DISABLED,
  COMMAND_FOCUS,
  COMMAND_FOCUS_INSET,
  COMMAND_HOVER,
  COMMAND_PRESS,
} from '../interactive-surface';
export type * from '@proto.ui/prototypes-base/data-table';

export interface LiquidGlassDataTableControlProps {
  variant?: 'regular' | 'prominent';
  /** Auto enhances only when live host material preferences and support allow it. */
  material?: 'auto' | 'opaque';
}

export type LiquidGlassDataTablePreviousProps = DataTablePreviousProps &
  LiquidGlassDataTableControlProps;
export type LiquidGlassDataTableNextProps = DataTableNextProps & LiquidGlassDataTableControlProps;

const CONTROL_FILLS = {
  regular: 'bg-secondary text-secondary-foreground',
  prominent: 'bg-primary text-primary-foreground',
} as const;

function setupPointerHover(def: DefHandle<any, any>) {
  const hovered = def.state.bool('dataTablePointerHover', false);
  const clear = () => hovered.set(false, 'liquid glass data table pointer hover reset');
  def.event.on('pointer.enter', () =>
    hovered.set(true, 'liquid glass data table pointer hover enter')
  );
  def.event.on('pointer.leave', clear);
  def.event.on('pointer.cancel', clear);
  def.lifecycle.onUnmounted(clear);
  return hovered;
}

// Under Liquid Glass layering, dense tabular content remains on an opaque
// content sheet (never glass-on-glass rows), while floating pagination commands
// carry the interactive Liquid Glass control layer with opaque style fallbacks.
export const dataTableRoot = definePrototype<DataTableRootProps, DataTableRootExposes>({
  name: 'liquid-glass-data-table-root',
  modules: asDataTableRoot.modules,
  setup(def) {
    const behavior = asDataTableRoot();
    def.feedback.style.use(
      tw(
        'table w-full min-w-0 max-w-full caption-bottom overflow-hidden rounded-2xl border border-border bg-secondary text-secondary-foreground shadow-sm font-sans'
      )
    );
    return behavior.render;
  },
});
export { dataTableRoot as liquidGlassDataTableRoot };

export const dataTableRow = definePrototype<DataTableRowProps, DataTableRowExposes>({
  name: 'liquid-glass-data-table-row',
  modules: asDataTableRow.modules,
  setup(def) {
    const behavior = asDataTableRow();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[liquid-glass-data-table] Row state unavailable.');
    const hovered = setupPointerHover(def);
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground transition-colors'));
    def.rule({
      when: (w) => w.state(state.hidden).eq(false),
      intent: (i) => i.feedback.style.use(tw('table-row')),
    });
    def.rule({
      when: (w) => w.state(state.collectionLast).eq(false),
      intent: (i) => i.feedback.style.use(tw('border-b border-border/60')),
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
      intent: (i) => i.feedback.style.use(tw('bg-primary/15 text-foreground')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS_INSET)),
    });
    return behavior.render;
  },
});
export { dataTableRow as liquidGlassDataTableRow };

export const dataTableCell = definePrototype<DataTableCellProps, DataTableCellExposes>({
  name: 'liquid-glass-data-table-cell',
  modules: asDataTableCell.modules,
  setup(def) {
    const behavior = asDataTableCell();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[liquid-glass-data-table] Cell state unavailable.');
    def.feedback.style.use(
      tw('min-w-0 max-w-full px-4 py-3 text-left align-middle text-sm text-inherit')
    );
    def.rule({
      when: (w) => w.state(state.hidden).eq(false),
      intent: (i) => i.feedback.style.use(tw('table-cell')),
    });
    return behavior.render;
  },
});
export { dataTableCell as liquidGlassDataTableCell };

export const dataTableHeader = definePrototype<DataTableHeaderProps, DataTableHeaderExposes>({
  name: 'liquid-glass-data-table-header',
  modules: asDataTableHeader.modules,
  setup(def) {
    const behavior = asDataTableHeader();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[liquid-glass-data-table] Header state unavailable.');
    const hovered = setupPointerHover(def);
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full px-4 py-3 text-left align-middle text-xs font-semibold tracking-wide select-none transition-colors'
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
          w.state(state.sort).eq('none'),
          w.any(
            w.prop('sortable').eq(false),
            w.state(hovered).eq(false),
            w.state(state.hidden).eq(true)
          )
        ),
      intent: (i) => i.feedback.style.use(tw('text-muted-foreground')),
    });
    def.rule({
      when: (w) =>
        w.any(
          w.state(state.sort).eq('ascending'),
          w.state(state.sort).eq('descending'),
          w.all(
            w.prop('sortable').eq(true),
            w.state(hovered).eq(true),
            w.state(state.hidden).eq(false)
          )
        ),
      intent: (i) => i.feedback.style.use(tw('text-foreground')),
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
      intent: (i) => i.feedback.style.use(tw('underline underline-offset-4')),
    });
    return behavior.render;
  },
});
export { dataTableHeader as liquidGlassDataTableHeader };

export const dataTableCaption = definePrototype<DataTableCaptionProps, DataTableCaptionExposes>({
  name: 'liquid-glass-data-table-caption',
  modules: asDataTableCaption.modules,
  setup(def) {
    const behavior = asDataTableCaption();
    def.feedback.style.use(
      tw('table-caption mt-3 px-2 text-left text-xs font-medium text-muted-foreground')
    );
    return behavior.render;
  },
});
export { dataTableCaption as liquidGlassDataTableCaption };

function setupLiquidGlassPageControl(
  def: DefHandle<LiquidGlassDataTablePreviousProps, DataTablePreviousExposes>,
  behavior: ReturnType<typeof asDataTablePrevious>
) {
  def.props.define({
    variant: { type: 'enum', options: ['regular', 'prominent'], empty: 'fallback' },
    material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
  });
  def.props.setDefaults({ variant: 'regular', material: 'auto' });
  const states = behavior.getAsHookHandle?.('as-button')?.stateHandles;
  if (!states)
    throw new Error('[liquid-glass-data-table] Required inherited state is unavailable.');
  const { hovered, pressed, focusVisible, disabled } = states;

  def.feedback.style.use(
    tw(
      'min-w-0 max-w-full inline-flex shrink-0 min-h-9 items-center justify-center gap-2 rounded-full border border-border px-4 py-1.5 text-sm font-medium whitespace-nowrap select-none shadow-sm'
    )
  );
  (Object.keys(CONTROL_FILLS) as Array<keyof typeof CONTROL_FILLS>).forEach((variant) => {
    def.rule({
      when: (w) => w.prop('variant').eq(variant),
      intent: (i) => i.feedback.style.use(tw(CONTROL_FILLS[variant])),
    });
  });
  def.rule({
    when: (w) => w.state(disabled).eq(false),
    intent: (i) => i.feedback.style.use(tw('cursor-pointer')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(hovered).eq(true),
        w.state(pressed).eq(false),
        w.state(disabled).eq(false),
        w.state(focusVisible).eq(false)
      ),
    intent: (i) => i.feedback.style.use(tw(COMMAND_HOVER)),
  });
  def.feedback.material.declare({
    version: 2,
    shape: { kind: 'rounded-rect', geometry: 'style' },
    source: { kind: 'in-app-backdrop' },
    fallback: { fill: 'style', foreground: 'style' },
  });
  for (const variant of ['regular', 'prominent'] as const) {
    for (const phase of [false, true]) {
      def.rule({
        when: (w) =>
          w.all(
            w.prop('variant').eq(variant),
            w.prop('material').eq('auto'),
            w.state(disabled).eq(false),
            w.state(pressed).eq(phase)
          ),
        intent: (i) =>
          i.feedback.material.use({
            intent: 'liquid-glass',
            variant: 'regular',
            ...(variant === 'prominent' ? { tint: 'style-fill' as const } : {}),
            deformation: { kind: 'press', phase: phase ? 'pressed' : 'rest', contact: 'pointer' },
          }),
      });
    }
  }
  def.rule({
    when: (w) => w.all(w.state(pressed).eq(true), w.state(disabled).eq(false)),
    intent: (i) => i.feedback.style.use(tw(COMMAND_PRESS)),
  });
  def.rule({
    when: (w) => w.state(focusVisible).eq(true),
    intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
  });
  def.rule({
    when: (w) => w.state(disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw(COMMAND_DISABLED)),
  });
}

export const dataTablePrevious = definePrototype<
  LiquidGlassDataTablePreviousProps,
  DataTablePreviousExposes
>({
  name: 'liquid-glass-data-table-previous',
  modules: asDataTablePrevious.modules,
  setup(def) {
    const behavior = asDataTablePrevious();
    setupLiquidGlassPageControl(def, behavior);
    return behavior.render;
  },
});
export { dataTablePrevious as liquidGlassDataTablePrevious };

export const dataTableNext = definePrototype<LiquidGlassDataTableNextProps, DataTableNextExposes>({
  name: 'liquid-glass-data-table-next',
  modules: asDataTableNext.modules,
  setup(def) {
    const behavior = asDataTableNext();
    setupLiquidGlassPageControl(def, behavior);
    return behavior.render;
  },
});
export { dataTableNext as liquidGlassDataTableNext };

export { dataTableHeaderRow, liquidGlassDataTableHeaderRow } from './header-row.proto';
