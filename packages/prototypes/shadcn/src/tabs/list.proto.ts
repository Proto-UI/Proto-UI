import { definePrototype, type RunHandle, tw } from '@proto.ui/core';
import { asTabsList } from '@proto.ui/prototypes-base/tabs';
import { setupShadcnStyleScope } from '../style-scope';
import {
  setupTabsVisual,
  TABS_LIST_VARIANT,
  TABS_PROJECTED_STYLES,
  TAB_LIST_HEIGHT,
  TAB_LIST_LINE_ROUNDED,
  TAB_LIST_PADDED,
  TAB_LIST_ROUNDED,
  TAB_LIST_VERTICAL,
} from './visual';
import type { ShadcnTabsListExposes, ShadcnTabsListProps } from './types';
const tabsList = definePrototype<ShadcnTabsListProps, ShadcnTabsListExposes>({
  name: 'shadcn-tabs-list',
  setup(def) {
    def.props.define({
      appearance: { type: 'enum', options: ['default', 'underline'], empty: 'fallback' },
      variant: { type: 'enum', options: ['default', 'line'], empty: 'fallback' },
    });
    def.props.setDefaults({ appearance: 'default', variant: 'default' });
    asTabsList();
    setupShadcnStyleScope(def);
    const { style, orientation } = setupTabsVisual(def);

    // Upstream `variant` prop transport for descendant Trigger rules
    // (`group-data-[variant=…]/tabs-list` correspondence without prop drilling).
    def.context.provide(TABS_LIST_VARIANT, { variant: 'default' });
    const publishVariant = (run: RunHandle<ShadcnTabsListProps>) => {
      run.context.update(TABS_LIST_VARIANT, {
        variant: run.props.get().variant ?? 'default',
      });
    };
    def.props.watch(['variant'], publishVariant);
    def.lifecycle.onCreated(publishVariant);
    def.lifecycle.onMounted(publishVariant);

    // Universal list shell from apps/v4/registry/bases/base/ui/tabs.tsx.
    def.rule({
      when: (w) => w.prop('appearance').eq('default'),
      intent: (i) =>
        i.feedback.style.use(
          tw('inline-flex w-fit items-center justify-center p-[3px] text-muted-foreground')
        ),
    });
    // Per-style `.cn-tabs-list` overrides (rounding, padding, horizontal height).
    for (const id of TABS_PROJECTED_STYLES) {
      const recipe = TAB_LIST_ROUNDED[id];
      if (!recipe) continue;
      def.rule({
        when: (w) => w.all(w.prop('appearance').eq('default'), w.state(style).eq(id)),
        intent: (i) => i.feedback.style.use(recipe),
      });
    }
    for (const id of TABS_PROJECTED_STYLES) {
      const recipe = TAB_LIST_PADDED[id];
      if (!recipe) continue;
      def.rule({
        when: (w) => w.all(w.prop('appearance').eq('default'), w.state(style).eq(id)),
        intent: (i) => i.feedback.style.use(recipe),
      });
    }
    for (const id of TABS_PROJECTED_STYLES) {
      const recipe = TAB_LIST_HEIGHT[id];
      def.rule({
        when: (w) =>
          w.all(
            w.prop('appearance').eq('default'),
            w.state(orientation).eq('horizontal'),
            w.state(style).eq(id)
          ),
        intent: (i) => i.feedback.style.use(recipe),
      });
    }
    for (const id of TABS_PROJECTED_STYLES) {
      const recipe = TAB_LIST_VERTICAL[id];
      if (!recipe) continue;
      def.rule({
        when: (w) =>
          w.all(
            w.prop('appearance').eq('default'),
            w.state(orientation).eq('vertical'),
            w.state(style).eq(id)
          ),
        intent: (i) => i.feedback.style.use(recipe),
      });
    }

    // cva `default` variant shell; `line` variant gets gap-1 bg-transparent
    // (+rounded-none where the style's default list rounds).
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.prop('variant').eq('default')),
      intent: (i) => i.feedback.style.use(tw('bg-muted')),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.prop('variant').eq('line')),
      intent: (i) => i.feedback.style.use(tw('gap-1 bg-transparent')),
    });
    for (const id of TAB_LIST_LINE_ROUNDED) {
      def.rule({
        when: (w) =>
          w.all(
            w.prop('appearance').eq('default'),
            w.prop('variant').eq('line'),
            w.state(style).eq(id)
          ),
        intent: (i) => i.feedback.style.use(tw('rounded-none')),
      });
    }

    // Universal orientation rules.
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.state(orientation).eq('vertical')),
      intent: (i) => i.feedback.style.use(tw('h-fit flex-col')),
    });
    // Existing Proto underline is a separately named compatibility surface, not upstream line.
    def.rule({
      when: (w) => w.prop('appearance').eq('underline'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'flex w-full min-w-0 h-auto flex-nowrap items-center justify-start gap-6 overflow-x-auto border-0 rounded-none bg-transparent p-0 text-muted-foreground shadow-none'
          )
        ),
    });
  },
});
export default tabsList;
