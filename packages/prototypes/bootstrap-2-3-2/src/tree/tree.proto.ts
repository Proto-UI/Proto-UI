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
import {
  bootstrapButtonRestFill,
  bootstrapButtonInteractiveFill,
  bootstrapButtonFlatFill,
  bootstrapButtonPressedFill,
  bootstrapButtonRaised,
  bootstrapButtonPressed,
} from '../button/paint';
export type * from '@proto.ui/prototypes-base/tree';

/** Local pointer paint only; Base remains the sole focus, selection and activation owner. */
function setupItemHover(def: DefHandle<TreeItemProps, TreeItemExposes>, disabled: State<boolean>) {
  const hovered = def.state.bool('bootstrapTreeItemPointerPaint', false);
  const clear = () => hovered.set(false, 'bootstrap tree item pointer paint reset');
  def.event.on('pointer.enter', () => {
    if (!disabled.get()) hovered.set(true, 'bootstrap tree item pointer paint enter');
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

// Tree is a Proto extension. Its ordinary content uses less/navs.less .nav-list
// inside a classic .well frame and its expansion command uses .btn-mini, not an
// upstream Tree API. Base remains the only hierarchy, selection, expansion and
// navigation owner.
export const treeRoot = definePrototype<TreeRootProps, TreeRootExposes>({
  name: 'bootstrap-2-3-2-tree-root',
  modules: asTreeRoot.modules,
  setup(def) {
    const behavior = asTreeRoot();
    def.feedback.style.use(
      tw(
        'block min-w-0 max-w-full m-0 px-[12px] py-[8px] list-none rounded-[4px] border border-[#e5e5e5] bg-[#f5f5f5] shadow-[inset_0_1px_1px_rgb(0_0_0/7.5%)] font-sans text-[14px] leading-[20px] text-[#333]'
      )
    );
    return behavior.render;
  },
});
export { treeRoot as bootstrap232TreeRoot };

export const treeItem = definePrototype<TreeItemProps, TreeItemExposes>({
  name: 'bootstrap-2-3-2-tree-item',
  modules: asTreeItem.modules,
  setup(def) {
    const behavior = asTreeItem();
    const state = behavior.stateHandles!;
    const hovered = setupItemHover(def, state.disabled);
    // Do not impose a horizontal flex row on an arbitrary nested Group slot.
    def.feedback.style.use(
      tw('min-w-0 rounded-[3px] px-[10px] py-[3px] no-underline cursor-pointer select-none')
    );
    def.rule({
      when: (w) => w.state(state.hidden).eq(false),
      intent: (i) => i.feedback.style.use(tw('block')),
    });
    def.rule({
      when: (w) => w.state(state.selected).eq(false),
      intent: (i) => i.feedback.style.use(tw('text-paint-[#08c_0_1px_0_rgb(255_255_255/50%)]')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.selected).eq(false),
          w.state(state.disabled).eq(false),
          w.any(w.state(hovered).eq(true), w.state(state.focused).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-[#eee]')),
    });
    def.rule({
      when: (w) => w.state(state.selected).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('bg-[#08c] text-paint-[#fff_0_-1px_0_rgb(0_0_0/20%)]')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-[#999] cursor-default')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
    });
    return behavior.render;
  },
});
export { treeItem as bootstrap232TreeItem };

export const treeGroup = definePrototype<TreeGroupProps, TreeGroupExposes>({
  name: 'bootstrap-2-3-2-tree-group',
  modules: asTreeGroup.modules,
  setup(def) {
    const behavior = asTreeGroup();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[bootstrap-2-3-2-tree] Group state unavailable.');
    def.feedback.style.use(tw('block min-w-0 m-0'));
    def.rule({
      when: (w) => w.state(state.direction).eq('ltr'),
      intent: (i) => i.feedback.style.use(tw('pl-[15px]')),
    });
    def.rule({
      when: (w) => w.state(state.direction).eq('rtl'),
      intent: (i) => i.feedback.style.use(tw('pr-[15px]')),
    });
    return behavior.render;
  },
});
export { treeGroup as bootstrap232TreeGroup };

export const treeToggle = definePrototype<TreeToggleProps, TreeToggleExposes>({
  name: 'bootstrap-2-3-2-tree-toggle',
  modules: asTreeToggle.modules,
  setup(def) {
    const behavior = asTreeToggle();
    const state = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!state)
      throw new Error('[bootstrap-2-3-2-tree] Required inherited Button states unavailable.');
    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center rounded-[3px] border px-[6px] py-[0px] text-[10.5px] font-normal leading-[20px] select-none cursor-pointer text-paint-[#333_0_1px_1px_rgb(255_255_255/75%)] border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_#b3b3b3_rgb(0_0_0/10%)]'
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
export { treeToggle as bootstrap232TreeToggle };
