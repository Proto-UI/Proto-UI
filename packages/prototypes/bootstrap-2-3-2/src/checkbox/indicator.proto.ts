import { definePrototype, delay, type TemplateChild, tw } from '@proto.ui/core';
import {
  asCheckboxIndicator,
  type CheckboxIndicatorProps,
  type CheckboxIndicatorExposes,
} from '@proto.ui/prototypes-base/checkbox';

// Independently expressed Bootstrap 2.3.2 design-language projection.
// Base retains all semantics; source attribution: ../../THIRD_PARTY_NOTICES.md.
// Custom parts and glyph; not the upstream browser-native checkbox skin.
export default definePrototype<CheckboxIndicatorProps, CheckboxIndicatorExposes>({
  name: 'bootstrap-2-3-2-checkbox-indicator',
  setup(def) {
    const inherited = asCheckboxIndicator();
    const state = inherited.stateHandles;
    if (!state)
      throw new Error('[bootstrap-2-3-2-checkbox-indicator] Base context state required.');
    def.feedback.style.use(
      tw(
        'inline-flex w-[14px] h-[14px] items-center justify-center text-current pointer-events-none'
      )
    );
    let update: { cancel(): void } | null = null;
    const refresh = (run: { update(): void }, event: { type: string }) => {
      if (event.type !== 'next') return;
      update?.cancel();
      update = delay(0, () => {
        update = null;
        run.update();
      });
    };
    state.checked.watch(refresh);
    state.indeterminate.watch(refresh);
    def.lifecycle.onUnmounted(() => {
      update?.cancel();
      update = null;
    });
    return (renderer) => {
      const d = state.indeterminate.get()
        ? 'M5 12H19'
        : state.checked.get()
          ? 'M5 12L10 17L19 7'
          : null;
      return [
        inherited.render ? (inherited.render(renderer) as TemplateChild) : renderer.r.slot(),
        d
          ? renderer.svg.root(
              {
                viewBox: '0 0 24 24',
                'aria-hidden': 'true',
                width: '100%',
                height: '100%',
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: 2,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
              },
              renderer.svg.path({ d })
            )
          : null,
      ];
    };
  },
});
