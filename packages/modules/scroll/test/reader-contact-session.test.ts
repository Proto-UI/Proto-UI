import { describe, expect, it } from 'vitest';
import { createReaderContactSession } from '../src/web/reader-contact-session';

describe('Web reader contact session transitions', () => {
  it('requires directional movement from an owned contact, not a stationary or foreign sample', () => {
    const session = createReaderContactSession();
    session.startPointer(31, 'touch', { x: 10, y: 10 });
    session.movePointer(99, { x: 50, y: 50 });
    session.movePointer(31, { x: 10, y: 10 });
    expect(session.hasDeparture('vertical')).toBe(false);
    session.movePointer(31, { x: 50, y: 10 });
    expect(session.hasDeparture('horizontal')).toBe(true);
    expect(session.hasDeparture('vertical')).toBe(false);
    session.movePointer(31, { x: 50, y: 30 });
    expect(session.hasDeparture('vertical')).toBe(true);
    session.movePointer(31, { x: 50, y: 20 });
    expect(session.hasDeparture('vertical')).toBe(false);
  });

  it('keeps owned touch direction across native handoff until that touch completes', () => {
    const session = createReaderContactSession();
    session.startPointer(31, 'touch');
    session.startTouches([11]);
    session.movePointer(31, { x: 0, y: 50 });
    session.moveTouch(11, { x: 0, y: 50 });
    session.finishPointer(31, true);
    expect(session.phase).toBe('native-pan');
    expect(session.hasDeparture('vertical')).toBe(true);
    session.moveTouch(11, { x: 0, y: -10 });
    expect(session.hasDeparture('vertical')).toBe(false);
    session.moveTouch(11, { x: 0, y: 30 });
    expect(session.hasDeparture('vertical')).toBe(true);
    session.finishTouches([11], []);
    expect(session.hasDeparture('vertical')).toBe(false);
  });

  it('does not lend a released touch movement to a remaining stationary contact', () => {
    const session = createReaderContactSession();
    session.startTouches([11, 12]);
    session.moveTouch(11, { x: 0, y: 50 });
    session.finishTouches([11], [12]);
    expect(session.active).toBe(true);
    expect(session.hasDeparture('vertical')).toBe(false);
  });

  it('does not lend canceled pointer movement after its touch ends while another remains', () => {
    const session = createReaderContactSession();
    session.startTouches([11, 12]);
    session.startPointer(31, 'touch');
    session.movePointer(31, { x: 0, y: 50 });
    session.finishPointer(31, true);
    session.finishTouches([11], [12]);
    expect(session.active).toBe(true);
    expect(session.hasDeparture('vertical')).toBe(false);
  });

  it('tracks mouse chrome in scroll direction and clears evidence without releasing ownership', () => {
    const session = createReaderContactSession();
    session.startPointer(41, 'mouse');
    session.movePointer(41, { x: 0, y: -50 });
    expect(session.hasDeparture('vertical')).toBe(true);
    session.clearMovement();
    expect(session.active).toBe(true);
    expect(session.hasDeparture('vertical')).toBe(false);
    session.movePointer(41, { x: 0, y: -70 });
    expect(session.hasDeparture('vertical')).toBe(true);
    session.reset();
    expect(session.hasDeparture('vertical')).toBe(false);
  });

  it('keeps native pointer handoff within the lifetime of an owned touch', () => {
    const session = createReaderContactSession();
    expect(session.phase).toBe('idle');
    session.startPointer(31, 'touch');
    session.startTouches([11]);
    expect(session.phase).toBe('contact');
    expect(session.finishPointer(31, true)).toBe(true);
    expect(session.phase).toBe('native-pan');
    expect(session.finishTouches([11], [])).toBe(true);
    expect(session.phase).toBe('idle');
    expect(session.active).toBe(false);
  });

  it.each(['pointer-first', 'touch-first'] as const)(
    'terminates both input aliases in %s cancellation order without a clock',
    (order) => {
      const session = createReaderContactSession();
      session.startPointer(31, 'touch');
      session.startTouches([11]);
      if (order === 'pointer-first') session.finishPointer(31, true);
      session.finishTouches([11], []);
      if (order === 'touch-first') session.finishPointer(31, true);
      expect(session.phase).toBe('idle');
      expect(session.finishPointer(31, true)).toBe(false);
      expect(session.finishTouches([11], [])).toBe(false);
    }
  );

  it('does not borrow a foreign touch and preserves remaining owned contacts', () => {
    const session = createReaderContactSession();
    session.startTouches([11, 12]);
    expect(session.finishTouches([22], [11, 12])).toBe(false);
    expect(session.finishTouches([11], [12, 22])).toBe(true);
    expect(session.phase).toBe('contact');
    session.finishTouches([12], [22]);
    expect(session.phase).toBe('idle');
  });

  it('does not clear a separately owned mouse contact when touch completes', () => {
    const session = createReaderContactSession();
    session.startPointer(41, 'mouse');
    session.startPointer(31, 'touch');
    session.startTouches([11]);
    session.finishTouches([11], []);
    expect(session.active).toBe(true);
    session.finishPointer(41, false);
    expect(session.phase).toBe('idle');
  });

  it('does not invent native-pan evidence for a pointer-only cancellation', () => {
    const session = createReaderContactSession();
    session.startPointer(31, 'touch');
    session.finishPointer(31, true);
    expect(session.phase).toBe('idle');
  });

  it('drops all input identities at reset and ignores late completion', () => {
    const session = createReaderContactSession();
    session.startPointer(31, 'touch');
    session.startTouches([11]);
    session.finishPointer(31, true);
    session.reset();
    expect(session.phase).toBe('idle');
    expect(session.finishTouches([11], [])).toBe(false);
  });
});
