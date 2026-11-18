// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nativeOwnerProfiles } from './native-owner-consumer';
import { cleanupScrollConsumers, mountScrollFamily } from './scroll-reveal-consumer';

afterEach(async () => {
  await cleanupScrollConsumers();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

/** Explicit geometry injection exercises emitted host behavior, not browser layout. */
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
  const state = {
    start: 150,
    height: 20,
    rendered: true,
    onMeasure: undefined as (() => void) | undefined,
  };
  const surfaceBox = () => new DOMRect(20, 100, 104, 104);
  const targetBox = () => {
    const callback = state.onMeasure;
    state.onMeasure = undefined;
    callback?.();
    return new DOMRect(22, 102 + state.start - surface.scrollTop, 80, state.height);
  };
  vi.spyOn(surface, 'getBoundingClientRect').mockImplementation(surfaceBox);
  vi.spyOn(surface, 'getClientRects').mockImplementation(
    () => [surfaceBox()] as unknown as DOMRectList
  );
  vi.spyOn(target, 'getBoundingClientRect').mockImplementation(targetBox);
  vi.spyOn(target, 'getClientRects').mockImplementation(
    () => (state.rendered ? [targetBox()] : []) as unknown as DOMRectList
  );
  return state;
}
const unavailable = { kind: 'rejected', reason: 'unavailable' };

for (const profile of nativeOwnerProfiles)
  describe(`C-SCROLL-TARGET-REVEAL-0001 ordinary ${profile}`, () => {
    it('reveals a real current part with minimal vertical movement and preserves unrelated host state', async () => {
      const owner = await mountScrollFamily(profile);
      const surface = owner.physical('surface'),
        target = owner.physical('direct');
      geometry(surface, target);
      const editor = document.createElement('input');
      owner.host.prepend(editor);
      editor.focus();
      owner.host.scrollTop = 43;
      owner.host.scrollLeft = 11;
      expect(await owner.act(() => owner.handles.surface.getExposes().reveal(0))).toEqual({
        kind: 'dispatched',
      });
      expect(surface.scrollTop).toBe(70);
      expect(surface.scrollLeft).toBe(17);
      expect(owner.host.scrollTop).toBe(43);
      expect(owner.host.scrollLeft).toBe(11);
      expect(document.activeElement).toBe(editor);
      expect(owner.handles.surface.getExposes().read().vertical.position).toBeCloseTo(70 / 300);
    });

    it('uses resolved insets, native clamping and no movement for a covering target', async () => {
      const owner = await mountScrollFamily(profile);
      const surface = owner.physical('surface'),
        target = owner.physical('direct');
      const state = geometry(surface, target);
      surface.style.scrollPaddingTop = '10px';
      surface.style.scrollPaddingBottom = '15%';
      target.style.scrollMarginTop = '5px';
      target.style.scrollMarginBottom = '7px';
      surface.style.setProperty('scroll-behavior', 'smooth', 'important');
      const reveal = () => owner.handles.surface.getExposes().reveal(0);
      expect(await owner.act(reveal)).toEqual({ kind: 'dispatched' });
      expect(surface.scrollTop).toBe(92);
      expect(surface.style.getPropertyValue('scroll-behavior')).toBe('smooth');
      expect(surface.style.getPropertyPriority('scroll-behavior')).toBe('important');
      state.start = 1000;
      expect(await owner.act(reveal)).toEqual({ kind: 'dispatched' });
      expect(surface.scrollTop).toBe(300);
      state.start = 250;
      state.height = 200;
      expect(await owner.act(reveal)).toEqual({ kind: 'dispatched' });
      expect(surface.scrollTop).toBe(300);
    });

    it('reveals a descendant surface part whose nearest strict same-role ancestor is this surface', async () => {
      const owner = await mountScrollFamily(profile);
      const surface = owner.physical('surface'),
        target = owner.physical('nested');
      geometry(surface, target);
      target.scrollTop = 23;
      const before = surface.scrollTop;
      const outcome = await owner.act(() => owner.handles.surface.getExposes().revealSurface(1));
      expect({ outcome, before, after: surface.scrollTop, nestedOffset: target.scrollTop }).toEqual(
        {
          outcome: { kind: 'dispatched' },
          before: 50,
          after: 70,
          nestedOffset: 23,
        }
      );
    });

    it('rejects an item owned by another surface, a sibling, self and another family before physical movement', async () => {
      const owner = await mountScrollFamily(profile);
      const surface = owner.physical('surface');
      geometry(surface, owner.physical('direct'));
      const exposed = owner.handles.surface.getExposes();
      expect(await owner.act(() => exposed.reveal(1))).toEqual(unavailable);
      expect(await owner.act(() => exposed.reveal(2))).toEqual(unavailable);
      expect(await owner.act(() => exposed.revealSelf())).toEqual(unavailable);
      expect(await owner.act(() => exposed.revealOther(0))).toEqual(unavailable);
      expect(surface.scrollTop).toBe(50);
      expect(await owner.act(() => exposed.reveal(0))).toEqual({ kind: 'dispatched' });
      expect(surface.scrollTop).toBe(70);
    });

    it('rejects a retained part after that logical owner retires', async () => {
      const owner = await mountScrollFamily(profile);
      const surface = owner.physical('surface');
      geometry(surface, owner.physical('direct'));
      const exposed = owner.handles.surface.getExposes();
      await owner.act(() => exposed.capture(0));
      await owner.remove('direct');
      let beforeRequest = -1,
        afterSynchronousRequest = -1;
      const outcome = await owner.act(() => {
        beforeRequest = surface.scrollTop;
        const value = exposed.revealSaved();
        afterSynchronousRequest = surface.scrollTop;
        return value;
      });
      expect(outcome).toEqual(unavailable);
      // Flush may run an earlier end-follow frame; compare the request's own
      // synchronous effect. Pending-end ownership has a separate host case.
      expect(afterSynchronousRequest).toBe(beforeRequest);
    });

    it('does not replay a reveal from a detached surface into a later view', async () => {
      const owner = await mountScrollFamily(profile);
      const surface = owner.physical('surface');
      geometry(surface, owner.physical('direct'));
      const exposed = owner.handles.surface.getExposes();
      await owner.act(() => exposed.capture(0));
      await owner.act(() => exposed.hide());
      expect(await owner.act(() => exposed.revealSaved())).toEqual({
        kind: 'rejected',
        reason: 'not-mounted',
      });
      await owner.act(() => exposed.show());
      const current = owner.physical('surface');
      expect(current.scrollTop).toBe(profile === 'web-component-source-v1' ? 50 : 0);
    });

    it('rechecks target availability after geometry getters synchronously detach the physical target', async () => {
      const owner = await mountScrollFamily(profile);
      const surface = owner.physical('surface');
      const target = owner.physical('direct'),
        parent = target.parentNode!,
        next = target.nextSibling;
      const state = geometry(surface, target);
      state.onMeasure = () => target.remove();
      let outcome: unknown;
      try {
        outcome = await owner.act(() => owner.handles.surface.getExposes().reveal(0));
      } finally {
        parent.insertBefore(target, next);
      }
      expect(outcome).toEqual(unavailable);
      expect(surface.scrollTop).toBe(50);
    });
  });
