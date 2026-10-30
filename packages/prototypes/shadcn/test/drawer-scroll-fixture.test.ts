import { afterEach, expect, it, vi } from 'vitest';
import { createDrawerScrollFixture } from './fixtures/drawer-presence';

const flush = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
  vi.restoreAllMocks();
});

it('uses accepted public side changes for clipping and restores bottom Scroll', async () => {
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  let frameTime = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
  const commitLayout = async () => {
    await flush();
    // Adapter scheduleAfterWebLayout publishes target readiness after two
    // frames. Inject that boundary, not Scroll facts, geometry or movement.
    for (let phase = 0; phase < 2; phase++) {
      const callbacks = [...frames.values()];
      frames.clear();
      frameTime += 16;
      for (const callback of callbacks) callback(frameTime);
      await flush();
    }
  };
  const fixture = createDrawerScrollFixture({
    getMeta: (key) => (key === 'reducedMotion' ? 'reduce' : undefined),
  });
  // The old native fixture guessed an inline width that AvailableLayout overwrote.
  expect(fixture.content.style.width).not.toBe('320px');
  fixture.open();
  await commitLayout();
  expect(fixture.sample().phase).toBe('entered');
  expect(fixture.sample().acceptedSide).toBe('bottom');
  fixture.side('left');
  await commitLayout();
  expect(fixture.sample().acceptedSide).toBe('left');
  fixture.side('bottom');
  await commitLayout();
  expect(fixture.sample().acceptedSide).toBe('bottom');
  expect(fixture.sample().facts.projection).toBe('system');
});
