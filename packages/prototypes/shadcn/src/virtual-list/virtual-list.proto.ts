import type {
  VirtualListRootProps,
  VirtualListRootExposes,
  VirtualListViewportExposes,
  VirtualListContentExposes,
} from '@proto.ui/prototypes-base/virtual-list';
import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import {
  asVirtualListRoot,
  asVirtualListViewport,
  asVirtualListContent,
} from '@proto.ui/prototypes-base/virtual-list';
import {
  SHADCN_STYLE_IDS,
  SHADCN_STYLE_SCOPE,
  setupShadcnStyleScope,
  setupShadcnStyleSelection,
  type ShadcnStyleId,
  type ShadcnStyleProps,
} from '../style-scope';
export type * from '@proto.ui/prototypes-base/virtual-list';
export type ShadcnVirtualListRootProps = VirtualListRootProps & ShadcnStyleProps;
export type ShadcnVirtualListViewportProps = ShadcnStyleProps;
export type ShadcnVirtualListContentProps = ShadcnStyleProps;

const ROOT_PROFILE_RECIPES: Readonly<Record<ShadcnStyleId, string>> = {
  'new-york-v4': 'rounded-lg border border-border shadow-sm',
  rhea: 'rounded-[min(var(--pui-radius-4xl),24px)] ring-1 shadow-sm',
  luma: 'rounded-2xl ring-1 shadow-sm',
  vega: 'rounded-xl border border-border shadow-xs',
  nova: 'rounded-lg border border-border shadow-xs',
  maia: 'rounded-2xl border border-border shadow-sm',
  lyra: 'rounded-none border border-border text-xs',
  mira: 'rounded-lg border border-border text-xs',
  sera: 'rounded-none border border-border',
};

const RING_SURFACE_STYLES = ['luma', 'rhea'] as const;
const COMPACT_FOCUS_STYLES = ['lyra', 'mira', 'sera'] as const;
const SOFT_FOCUS_STYLES = ['vega', 'nova', 'maia', 'luma', 'rhea', 'new-york-v4'] as const;

// No Virtual List counterpart exists in shadcn-ui/ui@3d98900e's inventory.
// The neutral frame adapts its surface radius, border/ring, and focus ring
// across all Shadcn style profiles without creating a second collection or
// scroll owner.
export const virtualListRoot = definePrototype<ShadcnVirtualListRootProps, VirtualListRootExposes>({
  name: 'shadcn-virtual-list-root',
  modules: asVirtualListRoot.modules,
  setup(def) {
    const inherited = asVirtualListRoot();
    setupShadcnStyleScope(def);
    const style = def.state.enum('virtualListResolvedStyle', 'new-york-v4', {
      options: SHADCN_STYLE_IDS,
    });
    const syncStyle = (run: RunHandle<ShadcnVirtualListRootProps>) => {
      const next = run.context.tryRead(SHADCN_STYLE_SCOPE)?.style ?? 'new-york-v4';
      style.set(next, 'reason: observe resolved family VirtualList scope');
    };
    def.context.trySubscribe(SHADCN_STYLE_SCOPE, syncStyle);
    def.lifecycle.onCreated(syncStyle);
    def.lifecycle.onMounted(syncStyle);
    def.lifecycle.onUpdated(syncStyle);

    def.feedback.style.use(
      tw('min-w-0 max-w-full overflow-hidden text-foreground bg-background grid gap-0 text-sm')
    );
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) => i.feedback.style.use(tw(ROOT_PROFILE_RECIPES[profile])),
      });
    }
    for (const profile of RING_SURFACE_STYLES) {
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.not(w.meta('colorScheme').eq('dark'))),
        intent: (i) => i.feedback.style.use(tw('ring-foreground/5')),
      });
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.meta('colorScheme').eq('dark')),
        intent: (i) => i.feedback.style.use(tw('ring-foreground/10')),
      });
    }
    return inherited.render;
  },
});
export { virtualListRoot as shadcnVirtualListRoot };

export const virtualListViewport = definePrototype<
  ShadcnVirtualListViewportProps,
  VirtualListViewportExposes
>({
  name: 'shadcn-virtual-list-viewport',
  modules: asVirtualListViewport.modules,
  setup(def) {
    const inherited = asVirtualListViewport();
    const style = setupShadcnStyleSelection(def, 'new-york-v4', {
      supportedStyles: SHADCN_STYLE_IDS,
    });
    const state = inherited.getAsHookHandle?.('as-scroll-area-viewport')?.stateHandles;
    if (!state)
      throw new Error('[shadcn-virtual-list] Required viewport focus state is unavailable.');
    def.feedback.style.use(
      tw('min-w-0 max-w-full min-h-0 overflow-auto rounded-[inherit] text-foreground outline-none')
    );
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('no-preference'),
      intent: (i) => i.feedback.style.use(tw('transition-[color,box-shadow]')),
    });
    for (const profile of SOFT_FOCUS_STYLES) {
      def.rule({
        when: (w) => w.all(w.state(state.focusVisible).eq(true), w.state(style).eq(profile)),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              'outline-none ring-3 ring-ring/50 ring-inset outline-1 outline-ring forced-colors-focus-outline'
            )
          ),
      });
    }
    for (const profile of COMPACT_FOCUS_STYLES) {
      def.rule({
        when: (w) => w.all(w.state(state.focusVisible).eq(true), w.state(style).eq(profile)),
        intent: (i) =>
          i.feedback.style.use(
            tw('outline-none ring-2 ring-ring ring-inset forced-colors-focus-outline')
          ),
      });
    }
    return inherited.render;
  },
});
export { virtualListViewport as shadcnVirtualListViewport };

export const virtualListContent = definePrototype<
  ShadcnVirtualListContentProps,
  VirtualListContentExposes
>({
  name: 'shadcn-virtual-list-content',
  modules: asVirtualListContent.modules,
  setup(def) {
    const inherited = asVirtualListContent();
    setupShadcnStyleSelection(def, 'new-york-v4', {
      supportedStyles: SHADCN_STYLE_IDS,
    });
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground relative'));
    return inherited.render;
  },
});
export { virtualListContent as shadcnVirtualListContent };
