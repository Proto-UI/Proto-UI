import { definePrototype, tw } from '@proto.ui/core';
import {
  asTreeRoot,
  asTreeItem,
  asTreeGroup,
  asTreeToggle,
  type TreeRootProps,
  type TreeRootExposes,
  type TreeItemProps,
  type TreeItemExposes,
  type TreeGroupProps,
  type TreeGroupExposes,
  type TreeToggleProps,
  type TreeToggleExposes,
} from '@proto.ui/prototypes-base/tree';
import {
  SHADCN_STYLE_IDS,
  setupShadcnStyleSelection,
  setupShadcnStyleScope,
  type ShadcnStyleId,
  type ShadcnStyleProps,
} from '../style-scope';
import { setupCollectionActionVisual, setupCollectionHover } from '../toolbar/action-visual';
export type * from '@proto.ui/prototypes-base/tree';
export type ShadcnTreeAppearance = 'default' | 'embedded';
export interface ShadcnTreeRootProps extends TreeRootProps, ShadcnStyleProps {
  appearance?: ShadcnTreeAppearance;
}
export interface ShadcnTreeItemProps extends TreeItemProps, ShadcnStyleProps {
  appearance?: ShadcnTreeAppearance;
}
export type ShadcnTreeGroupProps = TreeGroupProps;
export type ShadcnTreeToggleProps = TreeToggleProps & ShadcnStyleProps;

/** Proto Tree extension: no official Tree implementation in the pinned registry.
 * Vocabulary derives from MIT shadcn-ui/ui@3d98900e9b73c45f035f8109e9d41ba6a51685e7,
 * style-*.css .cn-button/.cn-toggle/.cn-table and independent New York sources.
 * The existing card-like default and square embedded appearance remain Proto
 * choices. They are not advertised as an official upstream component recipe.
 */
const ROOT_RADIUS = {
  vega: 'rounded-md',
  nova: 'rounded-lg',
  maia: 'rounded-[var(--pui-radius-4xl)]',
  lyra: 'rounded-none',
  mira: 'rounded-md',
  luma: 'rounded-[var(--pui-radius-3xl)]',
  sera: 'rounded-none',
  rhea: 'rounded-[var(--pui-radius-2xl)]',
  'new-york-v4': 'rounded-md',
} as const satisfies Record<ShadcnStyleId, string>;
const ITEM_PROFILE = {
  vega: 'min-h-9 rounded-md px-3 py-2 text-sm',
  nova: 'min-h-8 rounded-md px-3 py-2 text-sm',
  maia: 'min-h-9 rounded-[var(--pui-radius-4xl)] px-3 py-2 text-sm',
  lyra: 'min-h-8 rounded-none px-2.5 py-2 text-xs',
  mira: 'min-h-7 rounded-md px-2 py-1 text-xs',
  luma: 'min-h-9 rounded-[var(--pui-radius-3xl)] px-3 py-2 text-sm',
  sera: 'min-h-10 rounded-none px-6 py-2 text-xs uppercase tracking-widest',
  rhea: 'min-h-8 rounded-[var(--pui-radius-2xl)] px-2.5 py-2 text-sm',
  'new-york-v4': 'min-h-9 rounded-md px-3 py-2 text-sm',
} as const satisfies Record<ShadcnStyleId, string>;

export const treeRoot = definePrototype<ShadcnTreeRootProps, TreeRootExposes>({
  name: 'shadcn-tree-root',
  modules: asTreeRoot.modules,
  setup(def) {
    def.props.define({
      appearance: { type: 'enum', options: ['default', 'embedded'], empty: 'fallback' },
    });
    def.props.setDefaults({ appearance: 'default' });
    const behavior = asTreeRoot();
    setupShadcnStyleScope(def);
    const style = setupShadcnStyleSelection(def, 'nova');
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground'));
    def.rule({
      when: (w) => w.prop('appearance').eq('default'),
      intent: (i) =>
        i.feedback.style.use(tw('border border-border bg-background shadow-sm p-3 gap-2')),
    });
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.prop('appearance').eq('default')),
        intent: (i) => i.feedback.style.use(tw(ROOT_RADIUS[profile])),
      });
    }
    def.rule({
      when: (w) => w.prop('appearance').eq('embedded'),
      intent: (i) =>
        i.feedback.style.use(
          tw('flex flex-col gap-1.5 rounded-none border-0 bg-transparent shadow-none p-0')
        ),
    });
    return behavior.render;
  },
});
export { treeRoot as shadcnTreeRoot };

export const treeItem = definePrototype<ShadcnTreeItemProps, TreeItemExposes>({
  name: 'shadcn-tree-item',
  modules: asTreeItem.modules,
  setup(def) {
    def.props.define({
      appearance: { type: 'enum', options: ['default', 'embedded'], empty: 'fallback' },
    });
    def.props.setDefaults({ appearance: 'default' });
    const behavior = asTreeItem();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[shadcn-tree] Item state unavailable.');
    const style = setupShadcnStyleSelection(def, 'nova');
    const hovered = setupCollectionHover(def, state.disabled);
    def.props.watch(['appearance'], () => hovered.set(false, 'tree appearance pointer reset'));
    def.feedback.style.use(
      tw('min-w-0 max-w-full text-foreground flex items-center gap-2 cursor-pointer')
    );
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.prop('appearance').eq('default')),
        intent: (i) => i.feedback.style.use(tw(ITEM_PROFILE[profile])),
      });
    }
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(hovered).eq(true),
          w.state(state.disabled).eq(false),
          w.state(state.selected).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.selected).eq(true), w.prop('appearance').eq('default')),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
    });
    def.rule({
      when: (w) => w.prop('appearance').eq('embedded'),
      intent: (i) => i.feedback.style.use(tw('w-full min-h-8 rounded-none px-2 py-1')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('embedded'),
          w.any(w.state(style).eq('lyra'), w.state(style).eq('mira'), w.state(style).eq('sera'))
        ),
      intent: (i) => i.feedback.style.use(tw('text-xs')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('embedded'),
          w.not(
            w.any(w.state(style).eq('lyra'), w.state(style).eq('mira'), w.state(style).eq('sera'))
          )
        ),
      intent: (i) => i.feedback.style.use(tw('text-sm')),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('embedded'), w.state(style).eq('sera')),
      intent: (i) => i.feedback.style.use(tw('uppercase tracking-widest')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.selected).eq(true), w.prop('appearance').eq('embedded')),
      intent: (i) => i.feedback.style.use(tw('bg-muted-foreground/15 font-medium')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.selected).eq(false), w.prop('appearance').eq('embedded')),
      intent: (i) => i.feedback.style.use(tw('font-normal')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('embedded'),
          w.state(hovered).eq(true),
          w.state(state.disabled).eq(false),
          w.state(state.selected).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted-foreground/15')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.focused).eq(true), w.prop('appearance').eq('embedded')),
      intent: (i) => i.feedback.style.use(tw('bg-muted-foreground/15')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-default')),
    });
    return behavior.render;
  },
});
export { treeItem as shadcnTreeItem };

export const treeGroup = definePrototype<ShadcnTreeGroupProps, TreeGroupExposes>({
  name: 'shadcn-tree-group',
  modules: asTreeGroup.modules,
  setup(def) {
    const behavior = asTreeGroup();
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground grid gap-1 pl-4'));
    return behavior.render;
  },
});
export { treeGroup as shadcnTreeGroup };

export const treeToggle = definePrototype<ShadcnTreeToggleProps, TreeToggleExposes>({
  name: 'shadcn-tree-toggle',
  modules: asTreeToggle.modules,
  setup(def) {
    const behavior = asTreeToggle();
    const state = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!state) throw new Error('[shadcn-tree] Toggle state unavailable.');
    setupCollectionActionVisual(def, state, 'ghost');
    return behavior.render;
  },
});
export { treeToggle as shadcnTreeToggle };
