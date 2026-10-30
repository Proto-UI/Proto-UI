import { tw, type DefHandle, type State } from '@proto.ui/core';

type PopupMotionProps = { side?: 'top' | 'right' | 'bottom' | 'left' };

/** Finite common popup CSS recipes at shadcn-ui/ui 3d98900e9b73.
 * Borrows the caller's actual open State. Installs no hook, timer, Transition,
 * positioning or focus owner, and never mutates the borrowed State.
 * Duration stays in the profile recipe and inherited Transition policy.
 * Requested-side paint is not proof of collision-resolved side/origin parity.
 */
export function setupPopupMotion(def: DefHandle<PopupMotionProps>, open: State<boolean>) {
  def.rule({
    when: (w) => w.state(open).eq(true),
    intent: (i) => i.feedback.style.use(tw('animate-in fade-in-0 zoom-in-95')),
  });
  def.rule({
    when: (w) => w.state(open).eq(false),
    intent: (i) => i.feedback.style.use(tw('animate-out fade-out-0 zoom-out-95')),
  });
  for (const [side, animation] of [
    ['top', tw('slide-in-from-bottom-2')],
    ['bottom', tw('slide-in-from-top-2')],
    ['left', tw('slide-in-from-right-2')],
    ['right', tw('slide-in-from-left-2')],
  ] as const) {
    def.rule({
      when: (w) => w.prop('side').eq(side),
      intent: (i) => i.feedback.style.use(animation),
    });
  }
}
