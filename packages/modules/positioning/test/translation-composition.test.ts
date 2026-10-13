import { expect, it } from 'vitest';
import { acquireWebTranslation } from '../src/web/translation-composition';
const zero = { px: 0, rootText: 0, ownBox: 0 };
it('live layout displacement composes with presentation and survives its withdrawal', () => {
  const el = document.createElement('div');
  document.body.append(el);
  const layout = acquireWebTranslation(el, 'layout');
  const motion = acquireWebTranslation(el, 'presentation');
  layout.set([zero, { ...zero, ownBox: -1 }]);
  motion.set([zero, { ...zero, px: 120 }]);
  expect(el.style.getPropertyValue('translate')).toContain('-100% + 120px');
  layout.set([zero, { ...zero, ownBox: -0.75 }]);
  expect(el.style.getPropertyValue('translate')).toContain('-75% + 120px');
  motion.release();
  expect(el.style.getPropertyValue('translate')).toBe('0px -75%');
  layout.release();
  expect(el.style.getPropertyValue('translate')).toBe('');
  el.remove();
});
it('unregistered external translation is rejected without parsing or overwriting', () => {
  const el = document.createElement('div');
  el.style.setProperty('translate', '10px 20px');
  const motion = acquireWebTranslation(el, 'presentation');
  expect(motion.canWrite()).toBe(false);
  expect(motion.set([zero, zero])).toBe(false);
  motion.release();
  expect(el.style.getPropertyValue('translate')).toBe('10px 20px');
});
it('external takeover survives either lease release', () => {
  const el = document.createElement('div');
  const layout = acquireWebTranslation(el, 'layout');
  layout.set([zero, { ...zero, ownBox: -1 }]);
  const motion = acquireWebTranslation(el, 'presentation');
  motion.set([zero, { ...zero, px: 50 }]);
  el.style.setProperty('translate', '7px 8px');
  expect(motion.canWrite()).toBe(false);
  motion.release();
  layout.release();
  expect(el.style.getPropertyValue('translate')).toBe('7px 8px');
});
it('each semantic role has at most one writer', () => {
  const el = document.createElement('div');
  const first = acquireWebTranslation(el, 'presentation');
  expect(() => acquireWebTranslation(el, 'presentation')).toThrow(/already owned/);
  first.release();
  expect(() => acquireWebTranslation(el, 'presentation')).not.toThrow();
});
