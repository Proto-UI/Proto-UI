import { definePrototype, tw } from '@proto.ui/core';
import {
  asSwitchThumb,
  type SwitchThumbProps,
  type SwitchThumbExposes,
} from '@proto.ui/prototypes-base/switch';

// Independently expressed Bootstrap 2.3.2 design-language projection.
// Base retains all semantics; source attribution: ../../THIRD_PARTY_NOTICES.md.
// Extension: core Bootstrap 2.3.2 does not supply a Switch component.
export default definePrototype<SwitchThumbProps, SwitchThumbExposes>({
  name: 'bootstrap-2-3-2-switch-thumb',
  setup(def) {
    const state = asSwitchThumb().stateHandles;
    if (!state) throw new Error('[bootstrap-2-3-2-switch-thumb] Base state handles required.');
    // The Thumb is anchored to the root's padding box rather than to the root
    // flex order, so an inherited document direction cannot move it out of the
    // track. Travel is the root's 44px border-box minus 2px borders, minus
    // 2*2px padding, minus the 20px thumb: 18px. A percentage transform
    // resolves against the thumb's own border box, so `100% - 2px` is that
    // 18px.
    def.feedback.style.use(
      tw(
        'absolute left-[0.125rem] top-1/2 block size-5 -translate-y-1/2 shrink-0 bg-secondary border border-border pointer-events-none rounded-[4px] shadow-[inset_0_1px_0_rgb(255_255_255/20%),0_1px_2px_rgb(0_0_0/5%)] transition-transform duration-150 ease-in-out translate-x-[calc((100%_-_2px)_*_var(--pui-percentage)/100)]'
      )
    );
    // An explicit RTL direction mirrors the whole thumb: it rests against the
    // right padding edge and travels towards the left.
    def.rule({
      when: (w) => w.state(state.direction).eq('rtl'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'left-auto right-[0.125rem] translate-x-[calc((2px_-_100%)_*_var(--pui-percentage)/100)]'
          )
        ),
    });
    // Direct manipulation follows its owner without a trailing CSS animation.
    def.rule({
      when: (w) => w.state(state.dragging).eq(true),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });
  },
});
