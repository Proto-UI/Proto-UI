import { definePrototype, delay, type DelayTask, tw } from '@proto.ui/core';
import { asAutocompleteItem } from '@proto.ui/prototypes-base/autocomplete';
import type { AutocompleteItemProps, AutocompleteItemExposes } from './types';
import { setupSearchItemPaint } from '../combobox/visual';

export default definePrototype<AutocompleteItemProps, AutocompleteItemExposes>({
  name: 'shadcn-autocomplete-item',
  modules: asAutocompleteItem.modules,
  setup(def) {
    const behavior = asAutocompleteItem();
    const disabled = behavior.getState!('disabled')!;
    const active = behavior.getState!('active')!;
    const selected = behavior.getState!('selected')!;

    setupSearchItemPaint(def, {
      disabled,
      active,
    });
    def.rule({
      when: (w) => w.state(selected).eq(true),
      intent: (i) => i.feedback.style.use(tw('font-medium')),
    });

    const watchable = selected as unknown as {
      watch?: (cb: (run: { update(): void }, event: { type?: string }) => void) => void;
    };
    let renderTask: DelayTask | null = null;
    watchable.watch?.((run, event) => {
      if (event.type !== 'next') return;
      renderTask?.cancel();
      renderTask = delay(0, () => {
        renderTask = null;
        run.update();
      });
    });
    def.lifecycle.onUnmounted(() => {
      renderTask?.cancel();
      renderTask = null;
    });

    return (renderer) => [
      renderer.el('span', { style: tw('min-w-0 flex-1 break-words') }, renderer.r.slot()),
      renderer.el(
        'span',
        {
          style: tw(
            'pointer-events-none absolute right-2 flex size-4 shrink-0 items-center justify-center'
          ),
        },
        selected.get()
          ? renderer.svg.root(
              {
                viewBox: '0 0 24 24',
                'aria-hidden': 'true',
                width: 14,
                height: 14,
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: 2,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
              },
              renderer.svg.path({ d: 'm20 6-11 11-5-5' })
            )
          : null
      ),
    ];
  },
});
