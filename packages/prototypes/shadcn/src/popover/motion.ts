import { tw, type DefHandle, type State } from '@proto.ui/core';

// Pure paint shared with concrete authors that add their own public conditions.
// No hook, timer, state subscription or borrowed-state mutation is introduced.
export const POPUP_OPEN_MOTION = tw('animate-in fade-in-0 zoom-in-95');
export const POPUP_CLOSE_MOTION = tw('animate-out fade-out-0 zoom-out-95');
export const POPUP_SIDE_MOTION = [
  ['top', tw('slide-in-from-bottom-2')],
  ['bottom', tw('slide-in-from-top-2')],
  ['left', tw('slide-in-from-right-2')],
  ['right', tw('slide-in-from-left-2')],
] as const;

/** Finite common popup CSS recipes at shadcn-ui/ui 3d98900e9b73.
 * Borrows the caller's actual open State. Installs no hook, timer, Transition,
 * positioning or focus owner, and never mutates the borrowed State.
 * Duration stays in the profile recipe and inherited Transition policy.
 * Requested-side paint is not proof of collision-resolved side/origin parity.
 */
export function setupPopupMotion(
  def: DefHandle<{ side?: 'top' | 'right' | 'bottom' | 'left' }>,
  open: State<boolean>
) {
  def.rule({
    when: (w) => w.state(open).eq(true),
    intent: (i) => i.feedback.style.use(POPUP_OPEN_MOTION),
  });
  def.rule({
    when: (w) => w.state(open).eq(false),
    intent: (i) => i.feedback.style.use(POPUP_CLOSE_MOTION),
  });
  for (const [side, animation] of POPUP_SIDE_MOTION) {
    def.rule({
      when: (w) => w.prop('side').eq(side),
      intent: (i) => i.feedback.style.use(animation),
    });
  }
}
