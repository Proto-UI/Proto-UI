import type { WebPointerContact } from '../events/pointer-contact';
import type { OpticalFrame } from './program';

/** Bounded host-private release envelope. No persistent animation clock, input
 * ownership, activation, or semantic state is created here. */
export function createContactMotion() {
  let sample: WebPointerContact | null = null;
  let releasedAt: number | null = null;
  let rejectedSession = -1;
  return {
    update(next: WebPointerContact, now: number) {
      const replaced = sample?.session !== next.session;
      sample = next;
      releasedAt = !next.active && next.reason === 'up' ? now : null;
      if (!next.active && next.reason !== 'up') rejectedSession = next.session;
      return replaced || (!next.active && next.reason !== 'up');
    },
    stop() {
      if (sample) rejectedSession = sample.session;
      releasedAt = null;
    },
    frame(
      now: number,
      enabled: boolean
    ): { contact: OpticalFrame['contact']; animating: boolean; session: number } {
      const neutral = {
        contact: { x: 0.5, y: 0.5, deltaX: 0, deltaY: 0, strength: 0 },
        animating: false,
        session: sample?.session ?? 0,
      };
      if (!enabled || !sample || rejectedSession === sample.session) return neutral;
      let strength = sample.active ? 1 : 0;
      let deltaScale = 1;
      if (!sample.active && releasedAt !== null) {
        const progress = Math.max(0, (now - releasedAt) / 240);
        if (progress >= 1) {
          releasedAt = null;
          return neutral;
        }
        // Finite damped return; one small reversal without a perpetual spring.
        strength = (1 - progress) ** 2;
        deltaScale = Math.cos(progress * Math.PI * 1.5);
      }
      return {
        contact: {
          x: sample.x,
          y: sample.y,
          deltaX: sample.deltaX * deltaScale,
          deltaY: sample.deltaY * deltaScale,
          strength,
        },
        animating: releasedAt !== null,
        session: sample.session,
      };
    },
  };
}
