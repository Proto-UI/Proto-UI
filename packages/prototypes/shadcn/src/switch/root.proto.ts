import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { asSwitchRoot } from '@proto.ui/prototypes-base/switch';
import { SWITCH_VISUAL, normalizeSwitchSize } from './visual';
import type { ShadcnSwitchRootExposes, ShadcnSwitchRootProps } from './types';

// Fixed New York 02cad611: preserve upstream rem units at every root font size.
// Size coordination is family-owned; full transition-all parity remains separate.
const ROOT_BASE_TOKENS = [
  'peer',
  'inline-flex',
  'shrink-0',
  'items-center',
  'rounded-full',
  'border',
  'border-transparent',
  'p-0',
  'shadow-xs',

  'outline-none',
  'bg-input',
  'select-none',
].join(' ');

const switchRoot = definePrototype<ShadcnSwitchRootProps, ShadcnSwitchRootExposes>({
  name: 'shadcn-switch-root',
  setup(def) {
    // P-SHADCN-SWITCH-BASE-INHERITANCE,
    // P-SHADCN-SWITCH-CURRENT-BASE-DEVIATIONS
    const switchState = asSwitchRoot().stateHandles;
    if (!switchState) {
      throw new Error('[shadcn-switch-root] asSwitchRoot must project Switch root state handles.');
    }
    const { checked, disabled, focusVisible } = switchState;
    // P-SHADCN-SWITCH-VISUAL-SIZE-PROP, P-SHADCN-SWITCH-VISUAL-SIZE-LIFECYCLE
    def.props.define({ size: { type: 'enum', options: ['default', 'sm'], empty: 'fallback' } });
    def.props.setDefaults({ size: 'default' });
    const size = def.state.enum('switchVisualSize', 'default', { options: ['default', 'sm'] });
    def.expose.method('getVisualSize', () => size.get());
    def.context.provide(SWITCH_VISUAL, { size: 'default' });
    const syncSize = (run: RunHandle<ShadcnSwitchRootProps>) => {
      const next = normalizeSwitchSize(run.props.get().size);
      size.set(next, 'reason: shadcn switch Root visual size');
      run.context.update(SWITCH_VISUAL, { size: next });
    };
    def.lifecycle.onCreated(syncSize);
    def.lifecycle.onMounted(syncSize);
    def.props.watch(['size'], syncSize);
    def.rule({
      when: (w) => w.state(size).eq('default'),
      intent: (i) => i.feedback.style.use(tw('h-[1.15rem] w-8')),
    });
    def.rule({
      when: (w) => w.state(size).eq('sm'),
      intent: (i) => i.feedback.style.use(tw('h-3.5 w-6')),
    });
    // P-SHADCN-SWITCH-CURRENT-VISUAL-SURFACE
    def.feedback.style.transition({
      properties: ['background-color'],
      durationMs: 150,
      easing: [0.4, 0, 0.2, 1],
    });
    def.feedback.style.use(tw(ROOT_BASE_TOKENS));

    // P-SHADCN-SWITCH-STATE-DRIVEN-STYLES
    def.rule({
      when: (w) => w.state(checked).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-primary')),
    });

    def.rule({
      // Use the Switch-root focusVisible handle so web style projection can emit
      // data-[focus-visible] tokens for custom-element focus.
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-ring ring-3 ring-ring/50')),
    });

    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50 cursor-not-allowed')),
    });

    def.rule({
      when: (w) => w.all(w.meta('colorScheme').eq('dark'), w.state(checked).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-input/80')),
    });

    def.rule({
      when: (w) => w.all(w.meta('colorScheme').eq('dark'), w.state(checked).eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-primary')),
    });
  },
});

/**
 * P-SHADCN-SWITCH-DIRECT-ENTRY exposes the current Root projection.
 * P-SHADCN-SWITCH-COMPATIBILITY-SUBSET and P-SHADCN-SWITCH-AS-CHILD-OMISSION
 * keep upstream parity outside the passing claim unless it is implemented and tested.
 */

export default switchRoot;
