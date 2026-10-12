import { createContextKey, tw, type DefHandle } from '@proto.ui/core';

/** Private visual projection; Base Content is the sole presence owner. */
export const SELECT_VISUAL = createContextKey<{
  phase: string;
  side: string;
  position: string;
}>('shadcn-select-visual');

export function setupSelectPaint(def: DefHandle<{}>) {
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
  def.feedback.style.use(
    tw(
      'relative z-50 flex flex-col box-border min-w-[8rem] max-h-full overflow-x-hidden overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md outline-none duration-150'
    )
  );
  def.rule({
    when: (w) => w.any(w.state(phase).eq('entering'), w.state(phase).eq('entered')),
    intent: (i) => i.feedback.style.use(tw('animate-in fade-in-0 zoom-in-95')),
  });
  for (const [value, animation, translation] of [
    ['bottom', tw('slide-in-from-top-2'), tw('translate-y-1')],
    ['top', tw('slide-in-from-bottom-2'), tw('-translate-y-1')],
    ['left', tw('slide-in-from-right-2'), tw('-translate-x-1')],
    ['right', tw('slide-in-from-left-2'), tw('translate-x-1')],
  ] as const) {
    def.rule({
      when: (w) => w.all(w.state(position).eq('popper'), w.state(side).eq(value)),
      intent: (i) => i.feedback.style.use(animation),
    });
    def.rule({
      when: (w) => w.all(w.state(side).eq(value), w.state(position).eq('popper')),
      intent: (i) => i.feedback.style.use(translation),
    });
  }
}
