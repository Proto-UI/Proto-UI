import {
  BRUTALIST_CONTROL_TOKENS,
  BRUTALIST_FOCUS_TOKENS,
  BRUTALIST_MOTION_HIT_TOKENS,
  BRUTALIST_PANEL_TOKENS,
  BRUTALIST_PRESS_TOKENS,
} from '../style';
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
export type BrutalistTreeToggleSize = 'default' | 'icon';
export interface BrutalistTreeToggleProps extends TreeToggleProps {
  size?: BrutalistTreeToggleSize;
}

/** Local pointer paint only; Base remains the sole focus, selection and activation owner. */
function setupItemHover(def: DefHandle<TreeItemProps, TreeItemExposes>, disabled: State<boolean>) {
  const hovered = def.state.bool('brutalistTreeItemPointerPaint', false);
  const clear = () => hovered.set(false, 'brutalist tree item pointer paint reset');
  def.event.on('pointer.enter', () => {
    if (!disabled.get()) hovered.set(true, 'brutalist tree item pointer paint enter');
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

export const treeRoot = definePrototype<TreeRootProps, TreeRootExposes>({
  name: 'brutalist-tree-root',
  modules: asTreeRoot.modules,
  setup(def) {
    const behavior = asTreeRoot();
    def.feedback.style.use(
      tw(
        `${BRUTALIST_PANEL_TOKENS} shadow-[4px_4px_0_0_#000] min-w-0 max-w-full flex flex-col gap-1.5 p-3`
      )
    );
    return behavior.render;
  },
});
export { treeRoot as brutalistTreeRoot };

export const treeItem = definePrototype<TreeItemProps, TreeItemExposes>({
  name: 'brutalist-tree-item',
  modules: asTreeItem.modules,
  setup(def) {
    const behavior = asTreeItem();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[brutalist-tree] Item state unavailable.');
    const hovered = setupItemHover(def, state.disabled);
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full flex items-center gap-2 rounded-base border-2 border-transparent px-3 py-2 text-sm font-sans font-medium text-foreground cursor-pointer select-none'
      )
    );
    def.rule({
      when: (w) =>
        w.all(
          w.state(hovered).eq(true),
          w.state(state.disabled).eq(false),
          w.state(state.selected).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-secondary-background border-black')),
    });
    def.rule({
      when: (w) => w.state(state.selected).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('bg-main text-main-foreground border-black font-heading font-bold')
        ),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(`${BRUTALIST_FOCUS_TOKENS} forced-colors-focus-outline`)),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-default')),
    });
    return behavior.render;
  },
});
export { treeItem as brutalistTreeItem };

export const treeGroup = definePrototype<TreeGroupProps, TreeGroupExposes>({
  name: 'brutalist-tree-group',
  modules: asTreeGroup.modules,
  setup(def) {
    const behavior = asTreeGroup();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[brutalist-tree] Group state unavailable.');
    def.feedback.style.use(
      tw('min-w-0 max-w-full text-foreground font-sans font-medium grid gap-1')
    );
    def.rule({
      when: (w) => w.state(state.direction).eq('ltr'),
      intent: (i) => i.feedback.style.use(tw('ml-3 border-l border-black pl-3')),
    });
    def.rule({
      when: (w) => w.state(state.direction).eq('rtl'),
      intent: (i) => i.feedback.style.use(tw('mr-3 border-r border-black pr-3')),
    });
    return behavior.render;
  },
});
export { treeGroup as brutalistTreeGroup };

export const treeToggle = definePrototype<BrutalistTreeToggleProps, TreeToggleExposes>({
  name: 'brutalist-tree-toggle',
  modules: asTreeToggle.modules,
  setup(def) {
    def.props.define({
      size: { type: 'enum', options: ['default', 'icon'], empty: 'fallback' },
    });
    def.props.setDefaults({ size: 'default' });
    const behavior = asTreeToggle();
    const states = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!states) throw new Error('[brutalist-tree] Required inherited state is unavailable.');
    def.feedback.style.use(
      tw(
        `${BRUTALIST_CONTROL_TOKENS} min-w-0 max-w-full inline-flex shrink-0 items-center justify-center font-heading font-bold text-sm select-none cursor-pointer`
      )
    );
    def.rule({
      when: (w) => w.prop('size').eq('default'),
      intent: (i) => i.feedback.style.use(tw('min-h-8 px-2.5 py-1')),
    });
    def.rule({
      when: (w) => w.prop('size').eq('icon'),
      intent: (i) => i.feedback.style.use(tw('h-7 w-7 p-0')),
    });
    def.rule({
      when: (w) => w.state(states.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(`${BRUTALIST_FOCUS_TOKENS} forced-colors-focus-outline`)),
    });
    def.rule({
      when: (w) => w.state(states.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-default shadow-none')),
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
export { treeToggle as brutalistTreeToggle };
