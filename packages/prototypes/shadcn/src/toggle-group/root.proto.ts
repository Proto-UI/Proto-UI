import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { asToggleGroupRoot } from '@proto.ui/prototypes-base/toggle-group';
import {
  SHADCN_STYLE_SCOPE,
  setupShadcnStyleScope,
  setupShadcnStyleSelection,
} from '../style-scope';
import type { ShadcnToggleGroupRootProps, ShadcnToggleGroupRootExposes } from './types';
import { TOGGLE_GROUP_VISUAL_AXIS } from './visual';

/** MIT shadcn-ui/ui@3d98900e: bases/base/ui/toggle-group.tsx, style-*.css
 * .cn-toggle-group, and independent new-york-v4/ui/toggle-group.tsx.
 * Modern default spacing is 2 (0.5rem); New York's separate default is 0.
 * Base alone owns orientation, keyboard navigation and group selection.
 */
export default definePrototype<ShadcnToggleGroupRootProps, ShadcnToggleGroupRootExposes>({
  name: 'shadcn-toggle-group-root',
  modules: asToggleGroupRoot.modules,
  setup(def) {
    def.props.define({
      variant: { type: 'enum', empty: 'fallback', options: ['default', 'outline'] },
      size: { type: 'enum', empty: 'fallback', options: ['default', 'sm', 'lg'] },
      spacing: { type: 'number', empty: 'fallback' },
    });
    def.props.setDefaults({ variant: 'default', size: 'default' });
    const behavior = asToggleGroupRoot();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[shadcn-toggle-group] Root state unavailable.');
    setupShadcnStyleScope(def);
    const style = setupShadcnStyleSelection(def, 'nova');
    const spacingState = def.state.string('toggleGroupVisualSpacing', '2');
    const resolveSpacing = (run: RunHandle<ShadcnToggleGroupRootProps>): 0 | 1 | 2 => {
      const raw = run.props.get().spacing;
      if (raw === 0 || raw === 1 || raw === 2) return raw;
      return style.get() === 'new-york-v4' ? 0 : 2;
    };
    def.context.provide(TOGGLE_GROUP_VISUAL_AXIS, {
      orientation: 'horizontal',
      variant: 'default',
      size: 'default',
      spacing: 2,
    });
    def.context.subscribe(TOGGLE_GROUP_VISUAL_AXIS);
    const syncVisual = (run: RunHandle<ShadcnToggleGroupRootProps>) => {
      const props = run.props.get();
      const orientation = state.orientation.get();
      const variant = props.variant === 'outline' ? 'outline' : 'default';
      const size = props.size === 'sm' || props.size === 'lg' ? props.size : 'default';
      const spacing = resolveSpacing(run);
      spacingState.set(String(spacing), 'toggle group spacing sync');
      const cur = run.context.read(TOGGLE_GROUP_VISUAL_AXIS);
      if (
        cur.orientation !== orientation ||
        cur.variant !== variant ||
        cur.size !== size ||
        cur.spacing !== spacing
      ) {
        run.context.update(TOGGLE_GROUP_VISUAL_AXIS, { orientation, variant, size, spacing });
      }
    };
    def.lifecycle.onCreated(syncVisual);
    def.lifecycle.onMounted(syncVisual);
    def.lifecycle.onUpdated(syncVisual);
    def.props.watch(['orientation', 'variant', 'size', 'spacing'], syncVisual);
    def.props.watchRaw(['styleProfile'], syncVisual);
    def.context.trySubscribe(SHADCN_STYLE_SCOPE, syncVisual);
    def.feedback.style.use(tw('flex w-fit min-w-0 text-foreground'));
    def.rule({
      when: (w) => w.state(state.orientation).eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('flex-row items-center')),
    });
    def.rule({
      when: (w) => w.state(state.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('flex-col items-stretch')),
    });
    def.rule({
      when: (w) => w.state(spacingState).eq('0'),
      intent: (i) => i.feedback.style.use(tw('gap-0')),
    });
    def.rule({
      when: (w) => w.state(spacingState).eq('1'),
      intent: (i) => i.feedback.style.use(tw('gap-1')),
    });
    def.rule({
      when: (w) => w.state(spacingState).eq('2'),
      intent: (i) => i.feedback.style.use(tw('gap-2')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(spacingState).eq('0'),
          w.prop('variant').eq('outline'),
          w.any(w.state(style).eq('vega'), w.state(style).eq('new-york-v4'))
        ),
      intent: (i) => i.feedback.style.use(tw('shadow-xs')),
    });
    def.rule({
      when: (w) =>
        w.any(
          w.state(style).eq('new-york-v4'),
          w.state(style).eq('vega'),
          w.state(style).eq('mira')
        ),
      intent: (i) => i.feedback.style.use(tw('rounded-md')),
    });
    def.rule({
      when: (w) => w.state(style).eq('nova'),
      intent: (i) => i.feedback.style.use(tw('rounded-lg')),
    });
    def.rule({
      when: (w) => w.state(style).eq('rhea'),
      intent: (i) => i.feedback.style.use(tw('rounded-[var(--pui-radius-2xl)]')),
    });
    def.rule({
      when: (w) => w.state(style).eq('luma'),
      intent: (i) => i.feedback.style.use(tw('rounded-[var(--pui-radius-3xl)]')),
    });
    def.rule({
      when: (w) => w.state(style).eq('maia'),
      intent: (i) => i.feedback.style.use(tw('rounded-[var(--pui-radius-4xl)]')),
    });
    def.rule({
      when: (w) => w.any(w.state(style).eq('lyra'), w.state(style).eq('sera')),
      intent: (i) => i.feedback.style.use(tw('rounded-none')),
    });
    return behavior.render;
  },
});
