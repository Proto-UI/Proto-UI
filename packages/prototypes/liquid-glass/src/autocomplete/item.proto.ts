import { definePrototype, delay, type DelayTask, tw } from '@proto.ui/core';
import {
  asAutocompleteItem,
  type AutocompleteItemProps,
  type AutocompleteItemExposes,
} from '@proto.ui/prototypes-base/autocomplete';

export default definePrototype<AutocompleteItemProps, AutocompleteItemExposes>({
  name: 'liquid-glass-autocomplete-item',
  modules: asAutocompleteItem.modules,
  setup(def) {
    const behavior = asAutocompleteItem();
    const disabled = behavior.getState!('disabled')!;
    const active = behavior.getState!('active')!;
    const selected = behavior.getState!('selected')!;

    // Concentric with rounded-2xl (16px) content + p-1 (4px) padding -> rounded-xl (12px).
    def.feedback.style.use(
      tw(
        'relative flex min-w-0 w-full cursor-default select-none items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm text-start break-words outline-none'
      )
    );
    def.rule({
      when: (w) => w.all(w.state(selected).eq(true), w.state(disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground font-medium')),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(active).eq(true), w.state(selected).eq(false), w.state(disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('text-muted-foreground pointer-events-none cursor-not-allowed')),
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
        { style: tw('pointer-events-none flex size-4 shrink-0 items-center justify-center') },
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
