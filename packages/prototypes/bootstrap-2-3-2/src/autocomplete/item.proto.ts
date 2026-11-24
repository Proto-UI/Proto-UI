import { definePrototype, delay, type DelayTask, tw } from '@proto.ui/core';
import {
  asAutocompleteItem,
  type AutocompleteItemProps,
  type AutocompleteItemExposes,
} from '@proto.ui/prototypes-base/autocomplete';

export default definePrototype<AutocompleteItemProps, AutocompleteItemExposes>({
  name: 'bootstrap-2-3-2-autocomplete-item',
  modules: asAutocompleteItem.modules,
  setup(def) {
    const behavior = asAutocompleteItem();
    const disabled = behavior.getState!('disabled')!;
    const active = behavior.getState!('active')!;
    const selected = behavior.getState!('selected')!;

    def.feedback.style.use(
      tw(
        'flex min-w-0 w-full cursor-pointer select-none items-center justify-between gap-2 px-[20px] py-[3px] text-[14px] font-normal leading-[20px] text-foreground whitespace-nowrap'
      )
    );
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-[#999] cursor-default')),
    });
    def.rule({
      when: (w) => w.all(w.state(active).eq(true), w.state(disabled).eq(false)),
      intent: (i) =>
        i.feedback.style.use(tw('bg-[linear-gradient(#08c,#0077b3)] text-primary-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.state(selected).eq(true), w.state(disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('font-bold')),
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
      renderer.el('span', { style: tw('min-w-0 flex-1') }, renderer.r.slot()),
      renderer.el(
        'span',
        { style: tw('pointer-events-none flex size-3.5 shrink-0 items-center justify-center') },
        selected.get()
          ? renderer.svg.root(
              {
                viewBox: '0 0 24 24',
                'aria-hidden': 'true',
                width: 12,
                height: 12,
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: 2.5,
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
