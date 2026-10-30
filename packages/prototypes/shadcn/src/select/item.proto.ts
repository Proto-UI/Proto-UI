import { setupSelectStyle } from './style';
import { SHADCN_STYLE_SCOPE, type ShadcnStyleId } from '../style-scope';
import { definePrototype, delay, type RendererHandle, tw } from '@proto.ui/core';
import { asSelectItem } from '@proto.ui/prototypes-base/select';
import type { ShadcnSelectItemExposes, ShadcnSelectItemProps } from './types';
import {
  SELECT_ITEM_INDICATOR_SIZE,
  SELECT_ITEM_SURFACE,
  SELECT_TRANSLUCENT_STYLES,
} from './recipes';

function renderCheck(
  renderer: Pick<RendererHandle<ShadcnSelectItemProps>, 'svg' | 'el'>,
  selected: boolean,
  profile: ShadcnStyleId
) {
  const px = profile === 'mira' || profile === 'sera' ? 14 : 16;
  const size = profile === 'new-york-v4' ? 'size-3.5' : SELECT_ITEM_INDICATOR_SIZE[profile];
  return renderer.el(
    'span',
    {
      style: tw(
        'pointer-events-none absolute right-2 flex shrink-0 items-center justify-center',
        size ?? ''
      ),
    },
    selected
      ? renderer.svg.root(
          {
            viewBox: '0 0 24 24',
            'aria-hidden': 'true',
            width: px,
            height: px,
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          },
          renderer.svg.path({ d: 'm20 6-11 11-5-5' })
        )
      : null
  );
}

const selectItem = definePrototype<ShadcnSelectItemProps, ShadcnSelectItemExposes>({
  name: 'shadcn-select-item',
  setup(def) {
    const style = setupSelectStyle(def);
    // P-SHADCN-SELECT-ITEM-BASE-INHERITANCE,
    // P-SHADCN-SELECT-ITEM-CURRENT-BASE-DEVIATIONS
    const state = asSelectItem().stateHandles;
    if (!state) throw new Error('[shadcn-select-item] Select Item must project option states.');
    const { disabled, hovered, focused, focusVisible, pressed, active, selected } = state;

    // P-SHADCN-SELECT-ITEM-CURRENT-VISUAL-SURFACE
    def.feedback.style.use(
      tw('relative flex w-full cursor-default items-center outline-none select-none')
    );
    def.rule({
      when: (w) => w.state(style).eq('new-york-v4'),
      intent: (i) => i.feedback.style.use(tw('gap-2 rounded-sm pl-2 pr-8 py-1.5 text-sm')),
    });
    for (const profile of SELECT_TRANSLUCENT_STYLES)
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) => i.feedback.style.use(tw(SELECT_ITEM_SURFACE[profile])),
      });
    // P-SHADCN-SELECT-ITEM-STATE-DRIVEN-STYLES
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.any(
            w.state(active).eq(true),
            w.state(hovered).eq(true),
            w.state(focused).eq(true),
            w.state(focusVisible).eq(true)
          )
        ),
      intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq('new-york-v4'), w.state(pressed).eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-accent/80')),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
    });

    def.rule({
      when: (w) =>
        w.all(
          w.not(w.state(style).eq('new-york-v4')),
          w.any(
            w.state(active).eq(true),
            w.state(hovered).eq(true),
            w.state(focused).eq(true),
            w.state(focusVisible).eq(true)
          )
        ),
      intent: (i) => i.feedback.style.use(tw('bg-foreground/10 text-accent-foreground')),
    });
    let renderedStyle = style.get();
    let renderTask: { cancel(): void } | null = null;
    // P-SHADCN-SELECT-ITEM-SELECTED-INDICATOR
    selected.watch((run, event) => {
      if (event.type !== 'next') return;
      renderTask?.cancel();
      renderTask = delay(0, () => {
        renderTask = null;
        run.update();
      });
    });
    const repaint = (run: import('@proto.ui/core').RunHandle<ShadcnSelectItemProps>) => {
      if (renderedStyle === style.get()) return;
      renderTask?.cancel();
      renderTask = delay(0, () => {
        renderTask = null;
        run.update();
      });
    };
    def.context.trySubscribe(SHADCN_STYLE_SCOPE, repaint);
    def.props.watchRaw(['styleProfile'], repaint);
    def.lifecycle.onMounted(repaint);
    def.lifecycle.onUpdated(repaint);
    def.lifecycle.onBeforeDispose(() => {
      renderTask?.cancel();
      renderTask = null;
    });
    def.lifecycle.onUnmounted(() => {
      renderTask?.cancel();
      renderTask = null;
    });

    return (renderer) => {
      renderedStyle = style.get();
      return [renderer.r.slot(), renderCheck(renderer, selected.get(), renderedStyle)];
    };
  },
});

/** P-SHADCN-SELECT-ITEM-DIRECT-ENTRY; parity is bounded by P-SHADCN-SELECT-ITEM-COMPATIBILITY-SUBSET. */

export default selectItem;
