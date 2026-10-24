import { createContextKey, tw, type DefHandle } from '@proto.ui/core';
import { setupSelectStyle } from './style';
import type { ShadcnStyleProps } from '../style-scope';

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
  def.rule({
    when: (w) => w.state(style).eq('rhea'),
    intent: (i) => i.feedback.style.use(RHEA_SELECT_SURFACE),
  });
  def.rule({
    when: (w) => w.all(w.state(style).eq('rhea'), w.meta('colorScheme').eq('dark')),
    intent: (i) => i.feedback.style.use(tw('ring-foreground/10')),
  });
  def.rule({
    when: (w) => w.all(w.state(style).eq('rhea'), w.not(w.meta('colorScheme').eq('dark'))),
    intent: (i) => i.feedback.style.use(tw('ring-foreground/5')),
  });
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
export const RHEA_SELECT_SURFACE = tw(
  'relative isolate z-50 flex flex-col box-border min-w-36 max-h-full overflow-x-hidden overflow-y-auto rounded-[var(--pui-radius-2xl)] bg-popover/70 text-popover-foreground shadow-lg ring-1 outline-none duration-100 animate-none'
);
function setupSelectBackdrop(
  def: DefHandle<ShadcnStyleProps>,
  style: ReturnType<typeof setupSelectStyle>
) {
  const target = def.feedback.style.declareDecoration();
  def.rule({
    when: (w) => w.state(style).eq('rhea'),
    intent: (i) =>
      i.feedback.style
        .to(target)
        .use(
          tw('absolute inset-0 -z-1 rounded-[inherit] backdrop-filter-[blur(40px)_saturate(1.5)]')
        ),
  });
  return target;
}
