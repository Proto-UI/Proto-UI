import { createContextKey, tw, type DefHandle, type OwnedStateHandle } from '@proto.ui/core';
import { setupSelectStyle } from './style';
import type { ShadcnStyleId, ShadcnStyleProps } from '../style-scope';
import { SELECT_SURFACE_STYLE, SELECT_TRANSLUCENT_STYLES } from './recipes';

/** Private visual projection; Base Content is the sole presence owner. */
export const SELECT_VISUAL = createContextKey<{
  phase: string;
  side: string;
  position: string;
}>('shadcn-select-visual');

export function setupSelectPaint(def: DefHandle<ShadcnStyleProps>) {
  const style = setupSelectStyle(def);
  const backdrop = setupSelectBackdrop(def, style);
  const phase = def.state.string('selectPaintPhase', 'closed');
  const side = def.state.string('selectPaintSide', 'bottom');
  const position = def.state.string('selectPaintPosition', 'item-aligned');
  const sync = (next: { phase: string; side: string; position: string }) => {
    phase.set(next.phase, 'reason: select visual phase');
    side.set(next.side, 'reason: select visual side');
    position.set(next.position, 'reason: select visual position');
  };
  def.context.subscribe(SELECT_VISUAL, (_run, next) => sync(next));
  def.lifecycle.onCreated((run) => sync(run.context.read(SELECT_VISUAL)));
  def.rule({
    when: (w) => w.state(style).eq('new-york-v4'),
    intent: (i) =>
      i.feedback.style.use(
        tw(
          'relative z-50 flex flex-col box-border min-w-[8rem] max-h-full overflow-x-hidden overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md outline-none duration-150'
        )
      ),
  });
  // P-SHADCN-SELECT-STYLE: pinned cn-select-content + cn-menu-translucent per style.
  for (const profile of SELECT_TRANSLUCENT_STYLES) {
    def.rule({
      when: (w) => w.state(style).eq(profile),
      intent: (i) => i.feedback.style.use(SELECT_SURFACE_STYLE[profile]),
    });
  }
  for (const profile of ['luma', 'rhea'] as const) {
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.meta('colorScheme').eq('dark')),
      intent: (i) => i.feedback.style.use(tw('ring-foreground/10')),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.not(w.meta('colorScheme').eq('dark'))),
      intent: (i) => i.feedback.style.use(tw('ring-foreground/5')),
    });
  }
  def.rule({
    when: (w) =>
      w.all(
        w.state(style).eq('new-york-v4'),
        w.any(w.state(phase).eq('entering'), w.state(phase).eq('entered'))
      ),
    intent: (i) => i.feedback.style.use(tw('animate-in fade-in-0 zoom-in-95')),
  });
  for (const [value, animation, translation] of [
    ['bottom', tw('slide-in-from-top-2'), tw('translate-y-1')],
    ['top', tw('slide-in-from-bottom-2'), tw('-translate-y-1')],
    ['left', tw('slide-in-from-right-2'), tw('-translate-x-1')],
    ['right', tw('slide-in-from-left-2'), tw('translate-x-1')],
  ] as const) {
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.state(position).eq('popper'),
          w.state(side).eq(value)
        ),
      intent: (i) => i.feedback.style.use(animation),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.state(side).eq(value),
          w.state(position).eq('popper')
        ),
      intent: (i) => i.feedback.style.use(translation),
    });
  }
  return backdrop;
}

/** Translucent is part of the fixed upstream Select Content composition, not an opt-in skin. */
function setupSelectBackdrop(
  def: DefHandle<ShadcnStyleProps>,
  style: OwnedStateHandle<ShadcnStyleId>
) {
  const target = def.feedback.style.declareDecoration();
  // cn-menu-translucent before: backdrop-blur-2xl backdrop-saturate-150 on every
  // modern profile; New York v4 has no translucent decoration upstream.
  for (const profile of SELECT_TRANSLUCENT_STYLES) {
    def.rule({
      when: (w) => w.state(style).eq(profile),
      intent: (i) =>
        i.feedback.style
          .to(target)
          .use(
            tw('absolute inset-0 -z-1 rounded-[inherit] backdrop-filter-[blur(40px)_saturate(1.5)]')
          ),
    });
  }
  return target;
}
