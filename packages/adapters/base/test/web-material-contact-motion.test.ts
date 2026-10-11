import { describe, expect, it } from 'vitest';
import { createContactMotion } from '../src/material/contact-motion';
import type { WebPointerContact } from '../src/events/pointer-contact';
const sample: WebPointerContact = {
  active: true,
  session: 1,
  x: 0.7,
  y: 0.4,
  deltaX: 0.5,
  deltaY: 0.3,
  reason: 'down',
};
describe('bounded optical contact envelope, no browser paint claim', () => {
  it('uses the newest sample and finite release with a small reversal', () => {
    const motion = createContactMotion();
    motion.update(sample, 0);
    motion.update({ ...sample, x: 0.9, reason: 'move' }, 10);
    expect(motion.frame(10, true).contact?.x).toBe(0.9);
    motion.update({ ...sample, active: false, reason: 'up' }, 20);
    expect(motion.frame(20, true).animating).toBe(true);
    expect(motion.frame(180, true).contact!.deltaX).toBeLessThan(0);
    expect(motion.frame(260, true)).toMatchObject({ animating: false, contact: { strength: 0 } });
  });
  it.each(['cancel', 'lostcapture', 'blur', 'replaced', 'unmount'] as const)(
    'settles %s immediately',
    (reason) => {
      const motion = createContactMotion();
      motion.update(sample, 0);
      expect(motion.update({ ...sample, active: false, reason }, 10)).toBe(true);
      expect(motion.frame(10, true)).toMatchObject({ animating: false, contact: { strength: 0 } });
    }
  );
  it('withdrawal rejects the old session until a new down and disabled motion has no animation', () => {
    const motion = createContactMotion();
    motion.update(sample, 0);
    motion.stop();
    motion.update({ ...sample, reason: 'move' }, 20);
    expect(motion.frame(20, true).contact?.strength).toBe(0);
    motion.update({ ...sample, session: 2 }, 30);
    expect(motion.frame(30, true).contact?.strength).toBe(1);
    expect(motion.frame(30, false)).toMatchObject({ animating: false, contact: { strength: 0 } });
  });
});
