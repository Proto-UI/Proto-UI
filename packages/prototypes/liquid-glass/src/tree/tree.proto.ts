import {
  COMMAND_DISABLED,
  COMMAND_DISABLED_FOCUSABLE,
  COMMAND_FOCUS,
  COMMAND_FOCUS_INSET,
} from '../interactive-surface';
import type {
  TreeRootProps,
  TreeRootExposes,
  TreeItemProps,
  TreeItemExposes,
  TreeGroupProps,
  TreeGroupExposes,
  TreeToggleProps,
  TreeToggleExposes,
} from '@proto.ui/prototypes-base/tree';
import { definePrototype, tw, type DefHandle, type State } from '@proto.ui/core';
import { asTreeRoot, asTreeItem, asTreeGroup, asTreeToggle } from '@proto.ui/prototypes-base/tree';
export type * from '@proto.ui/prototypes-base/tree';
export type LiquidGlassTreeToggleSize = 'default' | 'icon';
export interface LiquidGlassTreeToggleProps extends TreeToggleProps {
  size?: LiquidGlassTreeToggleSize;
}

/** Local pointer paint only; Base remains the sole focus, selection and activation owner. */
function setupItemHover(def: DefHandle<TreeItemProps, TreeItemExposes>, disabled: State<boolean>) {
  const hovered = def.state.bool('liquidGlassTreeItemPointerPaint', false);
  const clear = () => hovered.set(false, 'liquid glass tree item pointer paint reset');
  def.event.on('pointer.enter', () => {
    if (!disabled.get()) hovered.set(true, 'liquid glass tree item pointer paint enter');
  });
  def.event.on('pointer.leave', clear);
  def.event.on('pointer.cancel', clear);
  def.lifecycle.onUnmounted(clear);
  const watchable = disabled as State<boolean> & {
    watch?: (cb: (run: unknown, event: { type: string; next?: boolean }) => void) => void;
  };
  if (typeof watchable.watch === 'function') {
    watchable.watch((_run, event) => {
      if (event.type === 'next' && event.next) clear();
    });
  }
  return hovered;
}

// Per Apple Liquid Glass HIG and P-LIQUID-GLASS-TREE, tree content stays neutral
// without a glass coating (never stacking glass-on-glass inside list/outline rows),
// while preserving concentric radii (outer rounded-2xl 16px - p-2 8px = inner rounded-lg 8px).
export const treeRoot = definePrototype<TreeRootProps, TreeRootExposes>({
  name: 'liquid-glass-tree-root',
  modules: asTreeRoot.modules,
  setup(def) {
    const behavior = asTreeRoot();
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full flex flex-col gap-1 rounded-2xl border border-border bg-secondary text-secondary-foreground shadow-sm p-2 font-sans'
      )
    );
    return behavior.render;
  },
});
export { treeRoot as liquidGlassTreeRoot };

export const treeItem = definePrototype<TreeItemProps, TreeItemExposes>({
  name: 'liquid-glass-tree-item',
  modules: asTreeItem.modules,
  setup(def) {
    const behavior = asTreeItem();
    const states = behavior.stateHandles;
    if (!states) throw new Error('[liquid-glass-tree] Item state unavailable.');
    const hovered = setupItemHover(def, states.disabled);
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full flex items-center gap-2 min-h-8 rounded-lg px-3 py-1.5 text-sm font-sans font-medium text-foreground cursor-pointer select-none outline-none transition-colors'
      )
    );
    def.rule({
      when: (w) =>
        w.all(
          w.state(hovered).eq(true),
          w.state(states.disabled).eq(false),
          w.state(states.selected).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
    });
    def.rule({
      when: (w) => w.state(states.selected).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground font-semibold')),
    });
    def.rule({
      when: (w) => w.state(states.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS_INSET)),
    });
    def.rule({
      when: (w) => w.state(states.disabled).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(`${COMMAND_DISABLED_FOCUSABLE} text-muted-foreground`)),
    });
    return behavior.render;
  },
});
export { treeItem as liquidGlassTreeItem };

export const treeGroup = definePrototype<TreeGroupProps, TreeGroupExposes>({
  name: 'liquid-glass-tree-group',
  modules: asTreeGroup.modules,
  setup(def) {
    const behavior = asTreeGroup();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[liquid-glass-tree] Group state unavailable.');
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground grid gap-1'));
    def.rule({
      when: (w) => w.state(state.direction).eq('ltr'),
      intent: (i) => i.feedback.style.use(tw('ml-3 border-l border-border pl-3')),
    });
    def.rule({
      when: (w) => w.state(state.direction).eq('rtl'),
      intent: (i) => i.feedback.style.use(tw('mr-3 border-r border-border pr-3')),
    });
    return behavior.render;
  },
});
export { treeGroup as liquidGlassTreeGroup };

export const treeToggle = definePrototype<LiquidGlassTreeToggleProps, TreeToggleExposes>({
  name: 'liquid-glass-tree-toggle',
  modules: asTreeToggle.modules,
  setup(def) {
    def.props.define({
      size: { type: 'enum', options: ['default', 'icon'], empty: 'fallback' },
    });
    def.props.setDefaults({ size: 'default' });
    const behavior = asTreeToggle();
    const states = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!states) throw new Error('[liquid-glass-tree] Required inherited state is unavailable.');
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground font-sans font-medium text-xs select-none cursor-pointer transition-colors outline-none shadow-xs'
      )
    );
    def.rule({
      when: (w) => w.prop('size').eq('default'),
      intent: (i) => i.feedback.style.use(tw('min-h-7 px-3 py-1')),
    });
    def.rule({
      when: (w) => w.prop('size').eq('icon'),
      intent: (i) => i.feedback.style.use(tw('h-6 w-6 p-0')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(states.hovered).eq(true),
          w.state(states.pressed).eq(false),
          w.state(states.disabled).eq(false),
          w.state(states.focusVisible).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted')),
    });
    def.rule({
      when: (w) => w.all(w.state(states.pressed).eq(true), w.state(states.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-muted shadow-none')),
    });
    def.rule({
      when: (w) => w.state(states.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.state(states.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(`${COMMAND_DISABLED} text-muted-foreground`)),
    });
    return behavior.render;
  },
});
export { treeToggle as liquidGlassTreeToggle };
