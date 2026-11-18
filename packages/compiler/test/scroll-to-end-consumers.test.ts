// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { nativeOwnerProfiles } from './native-owner-consumer';
import { cleanupScrollConsumers, mountScrollFamily } from './scroll-reveal-consumer';

afterEach(async () => {
  await cleanupScrollConsumers();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

/** Controlled native work keeps the explicit request separate from mount frames. */
function holdFrames() {
  let next = 0;
  const pending = new Map<number, FrameRequestCallback>();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = ++next;
    pending.set(id, callback);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => pending.delete(id));
}

function geometry(surface: HTMLElement, target: HTMLElement) {
  Object.defineProperties(surface, {
    clientWidth: { configurable: true, value: 100 },
    scrollWidth: { configurable: true, value: 400 },
    clientHeight: { configurable: true, value: 100 },
    scrollHeight: { configurable: true, value: 400 },
    clientTop: { configurable: true, value: 2 },
    offsetHeight: { configurable: true, value: 104 },
  });
  surface.scrollTop = 50;
  surface.scrollLeft = 17;
  const surfaceBox = () => new DOMRect(20, 100, 104, 104);
  const targetBox = () => new DOMRect(22, 102 + 150 - surface.scrollTop, 80, 20);
  vi.spyOn(surface, 'getBoundingClientRect').mockImplementation(surfaceBox);
  vi.spyOn(surface, 'getClientRects').mockImplementation(
    () => [surfaceBox()] as unknown as DOMRectList
  );
  vi.spyOn(target, 'getBoundingClientRect').mockImplementation(targetBox);
  vi.spyOn(target, 'getClientRects').mockImplementation(
    () => [targetBox()] as unknown as DOMRectList
  );
}

for (const profile of nativeOwnerProfiles)
  it(`keeps a later applied-watcher reveal paused in an ordinary ${profile} owner`, async () => {
    holdFrames();
    const owner = await mountScrollFamily(profile, {
      appliedReveal: true,
      captureDirectory: process.env.PUI_SCROLL_TO_END_EVIDENCE_DIR,
    });
    const surface = owner.physical('surface'),
      target = owner.physical('direct');
    geometry(surface, target);
    const exposed = owner.handles.surface.getExposes();
    // A real reveal cancels any mount-owned end work before arming the watcher.
    // The author never receives DOM geometry or a test-only phase capability.
    expect(await owner.act(() => exposed.reveal(0))).toEqual({ kind: 'dispatched' });
    expect(exposed.read().endFollow.state).toBe('paused');
    expect(exposed.read().endFollow.requestStatus).not.toBe('applied');
    await owner.act(() => exposed.armCompletionReveal());
    let offset = surface.scrollTop;
    const writes: number[] = [];
    Object.defineProperty(surface, 'scrollTop', {
      configurable: true,
      get: () => offset,
      set: (value: number) => {
        offset = value;
        writes.push(value);
      },
    });
    let synchronousSnapshot: any;
    const outcome = await owner.act(() => {
      const value = exposed.requestEnd();
      synchronousSnapshot = exposed.read();
      return value;
    });
    const trace = exposed.readCompletionTrace();
    console.info(
      'scroll-ordinary-applied-reveal',
      JSON.stringify({
        profile,
        outcome,
        trace,
        writes,
        offset,
        endFollow: synchronousSnapshot.endFollow,
      })
    );
    expect(outcome).toEqual({ kind: 'dispatched' });
    expect(trace).toEqual({
      visits: 1,
      beforeAtEnd: true,
      beforeState: 'following',
      nestedKind: 'dispatched',
      afterAtEnd: false,
      afterState: 'paused',
    });
    expect(writes).toEqual([300, 150]);
    expect(offset).toBe(150);
    expect(synchronousSnapshot.vertical.atEnd).toBe(false);
    expect(synchronousSnapshot.endFollow).toEqual({ state: 'paused', requestStatus: 'applied' });
  });
