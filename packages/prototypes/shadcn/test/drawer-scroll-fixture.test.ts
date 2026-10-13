import { afterEach, expect, it } from 'vitest';
import { createDrawerScrollFixture } from './fixtures/drawer-presence';

const flush = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

it('uses accepted public side changes for clipping and restores bottom Scroll', async () => {
  const fixture = createDrawerScrollFixture({
    getMeta: (key) => (key === 'reducedMotion' ? 'reduce' : undefined),
  });
  // The old native fixture guessed an inline width that AvailableLayout overwrote.
  expect(fixture.content.style.width).not.toBe('320px');
  fixture.open();
  await flush();
  expect(fixture.sample().acceptedSide).toBe('bottom');
  fixture.side('left');
  await flush();
  expect(fixture.sample().acceptedSide).toBe('left');
  fixture.side('bottom');
  await flush();
  expect(fixture.sample().acceptedSide).toBe('bottom');
  expect(fixture.sample().facts.projection).toBe('system');
});
