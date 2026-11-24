import { createContextKey, definePrototype, tw, type RunHandle } from '@proto.ui/core';
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
import { setupCollectionHover } from '../toolbar/action-visual';
export type * from '@proto.ui/prototypes-base/tree';
export type ShadcnTreeAppearance = 'default' | 'embedded';
export type ShadcnTreeItemAppearance = 'inherit' | ShadcnTreeAppearance;
export type ShadcnTreeToggleSize = 'default' | 'icon';
export interface ShadcnTreeRootProps extends TreeRootProps, ShadcnStyleProps {
  appearance?: ShadcnTreeAppearance;
}
export interface ShadcnTreeItemProps extends TreeItemProps, ShadcnStyleProps {
  appearance?: ShadcnTreeItemAppearance;
}
export type ShadcnTreeGroupProps = TreeGroupProps;
export interface ShadcnTreeToggleProps extends TreeToggleProps, ShadcnStyleProps {
  size?: ShadcnTreeToggleSize;
}

const SHADCN_TREE_APPEARANCE_CONTEXT = createContextKey<{ appearance: ShadcnTreeAppearance }>(
  'shadcn-tree-appearance'
);

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
const ITEM_FOCUS = {
  vega: 'ring-3 ring-ring/50',
  nova: 'ring-3 ring-ring/50',
  maia: 'ring-3 ring-ring/50',
  lyra: 'ring-1 ring-ring/50',
  mira: 'ring-2 ring-ring/30',
  luma: 'ring-3 ring-ring/30',
  sera: 'ring-2 ring-ring/30',
  rhea: 'ring-3 ring-ring/30',
  'new-york-v4': 'ring-3 ring-ring/50',
} as const satisfies Record<ShadcnStyleId, string>;
const TOGGLE_PROFILE = {
  vega: 'rounded-md border border-transparent bg-clip-padding text-sm font-medium',
  nova: 'rounded-lg border border-transparent bg-clip-padding text-sm font-medium',
  maia: 'rounded-[var(--pui-radius-4xl)] border border-transparent bg-clip-padding text-sm font-medium',
  lyra: 'rounded-none border border-transparent bg-clip-padding text-xs font-medium',
  mira: 'rounded-md border border-transparent bg-clip-padding text-xs leading-relaxed font-medium',
  luma: 'rounded-[var(--pui-radius-4xl)] border border-transparent bg-clip-padding text-sm font-medium',
  sera: 'rounded-none border border-transparent bg-clip-padding text-xs font-semibold uppercase tracking-widest',
  rhea: 'rounded-[var(--pui-radius-2xl)] border border-transparent bg-clip-padding text-sm font-medium',
  'new-york-v4': 'rounded-md text-sm font-medium',
} as const satisfies Record<ShadcnStyleId, string>;
const TOGGLE_SIZE_DEFAULT = {
  vega: 'h-9 gap-1.5 px-2.5',
  nova: 'h-8 gap-1.5 px-2.5',
  maia: 'h-9 gap-1.5 px-3',
  lyra: 'h-8 gap-1.5 px-2.5',
  mira: 'h-7 gap-1 px-2',
  luma: 'h-9 gap-1.5 px-3',
  sera: 'h-10 gap-1.5 px-6',
  rhea: 'h-8 gap-1.5 px-3',
  'new-york-v4': 'h-9 gap-2 px-4 py-2',
} as const satisfies Record<ShadcnStyleId, string>;
const TOGGLE_SIZE_ICON = {
  vega: 'h-7 w-7 p-0',
  nova: 'h-6 w-6 p-0',
  maia: 'h-7 w-7 p-0',
  lyra: 'h-6 w-6 p-0',
  mira: 'h-6 w-6 p-0',
  luma: 'h-7 w-7 p-0',
  sera: 'h-7 w-7 p-0',
  rhea: 'h-6 w-6 p-0',
  'new-york-v4': 'h-7 w-7 p-0',
} as const satisfies Record<ShadcnStyleId, string>;
const TOGGLE_FOCUS = {
  vega: 'border-ring ring-3 ring-ring/50',
  nova: 'border-ring ring-3 ring-ring/50',
  maia: 'border-ring ring-3 ring-ring/50',
  lyra: 'border-ring ring-1 ring-ring/50',
  mira: 'border-ring ring-2 ring-ring/30',
  luma: 'border-ring ring-3 ring-ring/30',
  sera: 'border-ring ring-2 ring-ring/30',
  rhea: 'border-ring ring-3 ring-ring/30',
  'new-york-v4': 'border-ring ring-3 ring-ring/50',
} as const satisfies Record<ShadcnStyleId, string>;

export const treeRoot = definePrototype<ShadcnTreeRootProps, TreeRootExposes>({
  name: 'shadcn-tree-root',
  modules: asTreeRoot.modules,
  setup(def) {
    def.props.define({
      appearance: { type: 'enum', options: ['default', 'embedded'], empty: 'fallback' },
    });
    def.props.setDefaults({ appearance: 'default' });
    def.context.provide(SHADCN_TREE_APPEARANCE_CONTEXT, { appearance: 'default' });
    const syncAppearance = (run: RunHandle<ShadcnTreeRootProps>) => {
      run.context.update(SHADCN_TREE_APPEARANCE_CONTEXT, {
        appearance: run.props.get().appearance ?? 'default',
      });
    };
    def.lifecycle.onCreated(syncAppearance);
    def.lifecycle.onMounted(syncAppearance);
    def.props.watch(['appearance'], syncAppearance);
    const behavior = asTreeRoot();
    setupShadcnStyleScope(def);
    const style = setupShadcnStyleSelection(def, 'nova');
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground'));
    def.rule({
      when: (w) => w.prop('appearance').eq('default'),
      intent: (i) =>
        i.feedback.style.use(
          tw('flex flex-col border border-border bg-background shadow-sm p-3 gap-2')
        ),
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
      appearance: { type: 'enum', options: ['inherit', 'default', 'embedded'], empty: 'fallback' },
    });
    def.props.setDefaults({ appearance: 'inherit' });
    const behavior = asTreeItem();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[shadcn-tree] Item state unavailable.');
    const style = setupShadcnStyleSelection(def, 'nova');
    const hovered = setupCollectionHover(def, state.disabled);
    const resolvedAppearance = def.state.string('resolvedAppearance', 'default');
    const syncAppearance = (run: RunHandle<ShadcnTreeItemProps>) => {
      const own = run.props.get().appearance;
      const inherited = run.context.read(SHADCN_TREE_APPEARANCE_CONTEXT)?.appearance;
      const next: ShadcnTreeAppearance = own && own !== 'inherit' ? own : (inherited ?? 'default');
      if (resolvedAppearance.get() !== next) hovered.set(false, 'tree appearance pointer reset');
      resolvedAppearance.set(next, 'shadcn tree appearance');
    };
    def.context.subscribe(SHADCN_TREE_APPEARANCE_CONTEXT, syncAppearance);
    def.lifecycle.onCreated(syncAppearance);
    def.lifecycle.onMounted(syncAppearance);
    def.props.watch(['appearance'], (run) => {
      hovered.set(false, 'tree appearance pointer reset');
      syncAppearance(run);
    });
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground flex items-center gap-2 cursor-pointer select-none outline-none transition-colors'
      )
    );
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.state(resolvedAppearance).eq('default')),
        intent: (i) => i.feedback.style.use(tw(ITEM_PROFILE[profile])),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.state(resolvedAppearance).eq('default'),
            w.state(hovered).eq(true),
            w.state(state.disabled).eq(false),
            w.state(state.selected).eq(false)
          ),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              profile === 'new-york-v4'
                ? 'bg-accent text-accent-foreground'
                : 'bg-muted text-foreground'
            )
          ),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.state(resolvedAppearance).eq('default'),
            w.state(hovered).eq(true),
            w.state(state.disabled).eq(false),
            w.state(state.selected).eq(false),
            w.meta('colorScheme').eq('dark')
          ),
        intent: (i) =>
          i.feedback.style.use(tw(profile === 'new-york-v4' ? 'bg-accent/50' : 'bg-muted/50')),
      });
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.state(state.focusVisible).eq(true)),
        intent: (i) => i.feedback.style.use(tw(ITEM_FOCUS[profile])),
      });
    }
    def.rule({
      when: (w) =>
        w.all(w.state(state.selected).eq(true), w.state(resolvedAppearance).eq('default')),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground font-medium')),
    });
    def.rule({
      when: (w) => w.state(resolvedAppearance).eq('embedded'),
      intent: (i) => i.feedback.style.use(tw('w-full min-h-8 rounded-none px-2 py-1')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(resolvedAppearance).eq('embedded'),
          w.any(w.state(style).eq('lyra'), w.state(style).eq('mira'), w.state(style).eq('sera'))
        ),
      intent: (i) => i.feedback.style.use(tw('text-xs')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(resolvedAppearance).eq('embedded'),
          w.not(
            w.any(w.state(style).eq('lyra'), w.state(style).eq('mira'), w.state(style).eq('sera'))
          )
        ),
      intent: (i) => i.feedback.style.use(tw('text-sm')),
    });
    def.rule({
      when: (w) => w.all(w.state(resolvedAppearance).eq('embedded'), w.state(style).eq('sera')),
      intent: (i) => i.feedback.style.use(tw('uppercase tracking-widest')),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(state.selected).eq(true), w.state(resolvedAppearance).eq('embedded')),
      intent: (i) => i.feedback.style.use(tw('bg-muted-foreground/15 font-medium')),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(state.selected).eq(false), w.state(resolvedAppearance).eq('embedded')),
      intent: (i) => i.feedback.style.use(tw('font-normal')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(resolvedAppearance).eq('embedded'),
          w.state(hovered).eq(true),
          w.state(state.disabled).eq(false),
          w.state(state.selected).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted-foreground/10')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.focused).eq(true),
          w.state(state.selected).eq(false),
          w.state(state.disabled).eq(false),
          w.state(resolvedAppearance).eq('embedded')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted-foreground/10')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('outline-none forced-colors-focus-outline')),
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
    const state = behavior.stateHandles;
    if (!state) throw new Error('[shadcn-tree] Group state unavailable.');
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground grid gap-1'));
    def.rule({
      when: (w) => w.state(state.direction).eq('ltr'),
      intent: (i) => i.feedback.style.use(tw('ml-2.5 border-l border-border pl-3')),
    });
    def.rule({
      when: (w) => w.state(state.direction).eq('rtl'),
      intent: (i) => i.feedback.style.use(tw('mr-2.5 border-r border-border pr-3')),
    });
    return behavior.render;
  },
});
export { treeGroup as shadcnTreeGroup };

export const treeToggle = definePrototype<ShadcnTreeToggleProps, TreeToggleExposes>({
  name: 'shadcn-tree-toggle',
  modules: asTreeToggle.modules,
  setup(def) {
    def.props.define({
      size: { type: 'enum', options: ['default', 'icon'], empty: 'fallback' },
    });
    def.props.setDefaults({ size: 'default' });
    const behavior = asTreeToggle();
    const state = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!state) throw new Error('[shadcn-tree] Toggle state unavailable.');
    const style = setupShadcnStyleSelection(def, 'nova');
    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all outline-none select-none text-foreground bg-transparent cursor-pointer'
      )
    );
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) => i.feedback.style.use(tw(TOGGLE_PROFILE[profile])),
      });
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.prop('size').eq('default')),
        intent: (i) => i.feedback.style.use(tw(TOGGLE_SIZE_DEFAULT[profile])),
      });
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.prop('size').eq('icon')),
        intent: (i) => i.feedback.style.use(tw(TOGGLE_SIZE_ICON[profile])),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.state(state.hovered).eq(true),
            w.state(state.disabled).eq(false)
          ),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              profile === 'new-york-v4'
                ? 'bg-accent text-accent-foreground'
                : 'bg-muted text-foreground'
            )
          ),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.state(state.hovered).eq(true),
            w.state(state.disabled).eq(false),
            w.meta('colorScheme').eq('dark')
          ),
        intent: (i) =>
          i.feedback.style.use(tw(profile === 'new-york-v4' ? 'bg-accent/50' : 'bg-muted/50')),
      });
      if (profile !== 'new-york-v4') {
        def.rule({
          when: (w) =>
            w.all(
              w.state(style).eq(profile),
              w.state(state.pressed).eq(true),
              w.state(state.disabled).eq(false)
            ),
          intent: (i) => i.feedback.style.use(tw('translate-y-px')),
        });
      }
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.state(state.focusVisible).eq(true)),
        intent: (i) => i.feedback.style.use(tw(TOGGLE_FOCUS[profile])),
      });
    }
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50 cursor-default')),
    });
    return behavior.render;
  },
});
export { treeToggle as shadcnTreeToggle };
