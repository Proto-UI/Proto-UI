import { describe, expect, it } from 'vitest';
import { createReaderContactSession } from '../src/web/reader-contact-session';

describe('Web reader contact session transitions', () => {
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
