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
import { definePrototype, tw, type State } from '@proto.ui/core';
import { asTreeRoot, asTreeItem, asTreeGroup, asTreeToggle } from '@proto.ui/prototypes-base/tree';
export type * from '@proto.ui/prototypes-base/tree';
export type ShadcnTreeAppearance = 'default' | 'embedded';
export interface ShadcnTreeRootProps extends TreeRootProps { appearance?: ShadcnTreeAppearance }
export interface ShadcnTreeItemProps extends TreeItemProps { appearance?: ShadcnTreeAppearance }

export const treeRoot = definePrototype<ShadcnTreeRootProps, TreeRootExposes>({
  name: 'shadcn-tree-root',
  setup(def) {
    def.props.define({ appearance: { type: 'enum', options: ['default', 'embedded'], empty: 'fallback' } });
    def.props.setDefaults({ appearance: 'default' });
    const behavior = asTreeRoot();
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground'));
    def.rule({
      when: (w) => w.prop('appearance').eq('default'),
      intent: (i) => i.feedback.style.use(tw('rounded-lg border border-border bg-background shadow-sm p-3 gap-2')),
    });
    def.rule({
      when: (w) => w.prop('appearance').eq('embedded'),
      intent: (i) => i.feedback.style.use(tw('flex flex-col gap-1.5 rounded-none border-0 bg-transparent shadow-none p-0')),
    });
    const states = behavior.stateHandles as Record<string, State<boolean>> | undefined;
    if (states?.focusVisible)
      def.rule({
        when: (w) => w.state(states.focusVisible!).eq(true),
        intent: (i) =>
          i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
      });
    if (states?.disabled)
      def.rule({
        when: (w) => w.state(states.disabled!).eq(true),
        intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-default')),
      });
  },
});
export { treeRoot as shadcnTreeRoot };
export const treeItem = definePrototype<ShadcnTreeItemProps, TreeItemExposes>({
  name: 'shadcn-tree-item',
  setup(def) {
    def.props.define({ appearance: { type: 'enum', options: ['default', 'embedded'], empty: 'fallback' } });
    def.props.setDefaults({ appearance: 'default' });
    const behavior = asTreeItem();
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground flex items-center gap-2 cursor-pointer'));
    def.rule({
      when: (w) => w.prop('appearance').eq('default'),
      intent: (i) => i.feedback.style.use(tw('rounded-md px-3 py-2')),
    });
    def.rule({
      when: (w) => w.prop('appearance').eq('embedded'),
      intent: (i) => i.feedback.style.use(tw('w-full min-h-8 rounded-none px-2 py-1 text-sm')),
    });
    const states = behavior.stateHandles;
    if (states?.focusVisible)
      def.rule({
        when: (w) => w.state(states.focusVisible!).eq(true),
        intent: (i) =>
          i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
      });
    if (states?.disabled)
      def.rule({
        when: (w) => w.state(states.disabled!).eq(true),
        intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-default')),
      });
    if (states?.selected)
      def.rule({
        when: (w) => w.all(w.state(states.selected!).eq(true), w.prop('appearance').eq('default')),
        intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
      });
    if (states?.selected)
      def.rule({
        when: (w) => w.all(w.state(states.selected!).eq(true), w.prop('appearance').eq('embedded')),
        intent: (i) => i.feedback.style.use(tw('bg-muted-foreground/15 font-medium')),
      });
    if (states?.selected)
      def.rule({
        when: (w) => w.all(w.state(states.selected!).eq(false), w.prop('appearance').eq('embedded')),
        intent: (i) => i.feedback.style.use(tw('font-normal')),
      });
    // Family-only pointer paint; Base retains the sole activation/focus owner.
    const hovered = def.state.bool('embeddedHovered', false);
    const clearHover = () => hovered.set(false, 'embedded tree pointer paint reset');
    def.event.on('pointer.enter', (run) => {
      if (run.props.get().appearance === 'embedded' && !states?.disabled?.get())
        hovered.set(true, 'embedded tree pointer enter');
    });
    def.event.on('pointer.leave', clearHover);
    def.event.on('pointer.cancel', clearHover);
    def.lifecycle.onUnmounted(clearHover);
    def.props.watch(['appearance'], clearHover);
    states?.disabled.watch((_run, event) => {
      if (event.type === 'next' && event.next) clearHover();
    });
    if (states?.disabled && states?.selected)
      def.rule({
        when: (w) => w.all(w.prop('appearance').eq('embedded'), w.state(hovered).eq(true), w.state(states.disabled!).eq(false), w.state(states.selected!).eq(false)),
        intent: (i) => i.feedback.style.use(tw('bg-muted-foreground/15')),
      });
    if (states?.focused)
      def.rule({
        when: (w) => w.all(w.state(states.focused!).eq(true), w.prop('appearance').eq('embedded')),
        intent: (i) => i.feedback.style.use(tw('bg-muted-foreground/15')),
      });
  },
});
export { treeItem as shadcnTreeItem };
export const treeGroup = definePrototype<TreeGroupProps, TreeGroupExposes>({
  name: 'shadcn-tree-group',
  setup(def) {
    const behavior = asTreeGroup();
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground grid gap-1 pl-4'));
    const states = behavior.stateHandles as Record<string, State<boolean>> | undefined;
    if (states?.focusVisible)
      def.rule({
        when: (w) => w.state(states.focusVisible!).eq(true),
        intent: (i) =>
          i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
      });
    if (states?.disabled)
      def.rule({
        when: (w) => w.state(states.disabled!).eq(true),
        intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-default')),
      });
  },
});
export { treeGroup as shadcnTreeGroup };
export const treeToggle = definePrototype<TreeToggleProps, TreeToggleExposes>({
  name: 'shadcn-tree-toggle',
  setup(def) {
    const behavior = asTreeToggle();
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground inline-flex min-h-9 items-center justify-center rounded-md border border-border px-3 py-2 text-sm cursor-pointer'
      )
    );
    const states = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!states) throw new Error('[shadcn-tree] Required inherited state is unavailable.');
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
  },
});
export { treeToggle as shadcnTreeToggle };
