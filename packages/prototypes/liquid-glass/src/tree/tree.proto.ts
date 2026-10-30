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
import { definePrototype, tw } from '@proto.ui/core';
import { asTreeRoot, asTreeItem, asTreeGroup, asTreeToggle } from '@proto.ui/prototypes-base/tree';
export type * from '@proto.ui/prototypes-base/tree';
export const treeRoot = definePrototype<TreeRootProps, TreeRootExposes>({
  name: 'liquid-glass-tree-root',
  setup(def) {
    const behavior = asTreeRoot();
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground rounded-2xl border border-border bg-background p-3 gap-2'
      )
    );
    return behavior.render;
  },
});
export { treeRoot as liquidGlassTreeRoot };
export const treeItem = definePrototype<TreeItemProps, TreeItemExposes>({
  name: 'liquid-glass-tree-item',
  setup(def) {
    const behavior = asTreeItem();
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground flex items-center gap-2 rounded-md px-3 py-2 cursor-pointer'
      )
    );
    const states = behavior.stateHandles!;
    def.rule({
      when: (w) => w.state(states.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) => w.state(states.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('cursor-default')),
    });
    def.rule({
      when: (w) => w.state(states.selected).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
    });
    return behavior.render;
  },
});
export { treeItem as liquidGlassTreeItem };
export const treeGroup = definePrototype<TreeGroupProps, TreeGroupExposes>({
  name: 'liquid-glass-tree-group',
  setup(def) {
    const behavior = asTreeGroup();
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground grid gap-1 pl-4'));
    return behavior.render;
  },
});
export { treeGroup as liquidGlassTreeGroup };
export const treeToggle = definePrototype<TreeToggleProps, TreeToggleExposes>({
  name: 'liquid-glass-tree-toggle',
  setup(def) {
    const behavior = asTreeToggle();
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground inline-flex min-h-9 items-center justify-center rounded-md border border-border px-3 py-2 text-sm cursor-pointer'
      )
    );
    const states = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!states) throw new Error('[liquid-glass-tree] Required inherited state is unavailable.');
    def.rule({
      when: (w) => w.state(states.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) => w.state(states.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('cursor-default shadow-none')),
    });
    // Presentation consumes the existing owner; no second interaction hook.
    def.rule({
      when: (w) => w.all(w.state(states.pressed).eq(true), w.state(states.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('shadow-xs')),
    });
    return behavior.render;
  },
});
export { treeToggle as liquidGlassTreeToggle };
