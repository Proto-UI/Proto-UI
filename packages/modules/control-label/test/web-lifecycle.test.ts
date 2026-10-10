import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebControlLabelHost } from '../src/web';

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
const mutations = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
function shadow(mode: ShadowRootMode = 'open') {
  const host = document.createElement('div');
  document.body.append(host);
  return host.attachShadow({ mode });
}
function frames() {
  let next = 0;
  const queued = new Map<number, FrameRequestCallback>();
  const request = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = ++next;
    queued.set(id, callback);
    return id;
  });
  const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    queued.delete(id);
  });
  return {
    queued,
    request,
    cancel,
    flush() {
      const current = [...queued];
      for (const [id, callback] of current) {
        if (!queued.delete(id)) continue;
        callback(performance.now());
      }
    },
  };
}
function fixture(parent: HTMLElement | ShadowRoot | null = document.body) {
  const el = document.createElement('span');
  parent?.append(el);
  const change = vi.fn();
  let notify = () => {};
  let current: HTMLElement | null = el;
  const lease = createWebControlLabelHost(
    () => current,
    (listener) => {
      notify = listener;
      return () => {
        notify = () => {};
      };
    }
  ).attach({
    kind: 'label',
    activation: false,
    onActivate: vi.fn(),
    onViewChange: change,
  });
  cleanups.push(() => lease.dispose());
  return {
    el,
    change,
    lease,
    sync: () => notify(),
    replace(next: HTMLElement | null) {
      current = next;
      notify();
    },
  };
}

describe('Control Label detached view discovery', () => {
  it.each(['open', 'closed'] as const)(
    'finds delayed reinsertion into another %s ShadowRoot and rebinds its observer',
    async (mode) => {
      const clock = frames();
      const first = shadow(mode);
      const second = shadow(mode);
      const f = fixture(first);
      await mutations();
      f.change.mockClear();
      f.el.remove();
      await mutations();
      expect(f.lease.view()).toBeNull();
      expect(f.change).toHaveBeenCalledOnce();
      f.change.mockClear();
      second.append(f.el);
      await mutations();
      clock.flush();
      expect(f.change).toHaveBeenCalledOnce();
      expect(f.lease.view()?.scope).toBe(second);
      expect(clock.queued.size).toBe(0);
      // A later removal must reach the new scope's observer, not the old one.
      f.change.mockClear();
      f.el.remove();
      await mutations();
      expect(f.change).toHaveBeenCalledOnce();
      expect(f.lease.view()).toBeNull();
      expect(clock.queued.size).toBe(1);
    }
  );

  it('shares one frame across 30 live detached participants and stops after reconnection', async () => {
    const clock = frames();
    const destination = shadow('closed');
    const labels = Array.from({ length: 30 }, () => fixture());
    await mutations();
    expect(clock.request).not.toHaveBeenCalled();
    for (const f of labels) f.el.remove();
    await mutations();
    expect(clock.request).toHaveBeenCalledOnce();
    expect(clock.queued.size).toBe(1);
    for (const f of labels) f.change.mockClear();
    clock.flush();
    expect(clock.queued.size).toBe(1);
    expect(clock.request).toHaveBeenCalledTimes(2);
    expect(labels.every((f) => f.change.mock.calls.length === 0)).toBe(true);
    const scan = vi.spyOn(document, 'querySelectorAll');
    for (const f of labels) destination.append(f.el);
    clock.flush();
    expect(labels.every((f) => f.change.mock.calls.length === 1)).toBe(true);
    expect(labels.every((f) => f.lease.view()?.scope === destination)).toBe(true);
    expect(scan).not.toHaveBeenCalled();
    expect(clock.queued.size).toBe(0);
  });

  it('does not poll a never-connected view or a connected replacement', async () => {
    const clock = frames();
    const f = fixture(null);
    f.sync();
    await mutations();
    expect(clock.request).not.toHaveBeenCalled();
    document.body.append(f.el);
    f.sync();
    f.el.remove();
    await mutations();
    expect(clock.queued.size).toBe(1);
    const replacement = document.createElement('span');
    document.body.append(replacement);
    f.replace(replacement);
    expect(clock.queued.size).toBe(0);
    expect(f.lease.view()?.identity).toBe(replacement);
    expect(clock.cancel).toHaveBeenCalledOnce();
  });

  it('stops when the live target disappears or is replaced by a never-connected node', async () => {
    const clock = frames();
    const f = fixture();
    f.el.remove();
    await mutations();
    expect(clock.queued.size).toBe(1);
    f.replace(document.createElement('span'));
    expect(clock.queued.size).toBe(0);
    f.replace(null);
    expect(clock.queued.size).toBe(0);
    clock.flush();
    expect(clock.request).toHaveBeenCalledOnce();
  });

  it('releases a disposed participant without cancelling another detached owner', async () => {
    const clock = frames();
    const first = fixture();
    const second = fixture();
    first.el.remove();
    second.el.remove();
    await mutations();
    first.lease.dispose();
    expect(clock.queued.size).toBe(1);
    const destination = shadow('closed');
    second.change.mockClear();
    destination.append(second.el);
    clock.flush();
    expect(second.change).toHaveBeenCalledOnce();
    expect(clock.queued.size).toBe(0);
    expect(first.lease.view()).toBeNull();
  });

  it('a retired late frame cannot delete or run a newer tracker', async () => {
    const clock = frames();
    const old = fixture();
    old.el.remove();
    await mutations();
    const late = [...clock.queued.values()][0]!;
    old.lease.dispose();
    const current = fixture();
    current.el.remove();
    await mutations();
    const destination = shadow('closed');
    destination.append(current.el);
    current.change.mockClear();
    // Inject a cancelled callback delivery to check stale-owner guards.
    late(performance.now());
    expect(current.change).not.toHaveBeenCalled();
    expect(clock.queued.size).toBe(1);
    clock.flush();
    expect(current.change).toHaveBeenCalledOnce();
    expect(clock.queued.size).toBe(0);
  });

  it('keeps exactly one new frame when a reconnection callback detaches again', async () => {
    const clock = frames();
    const destination = shadow('closed');
    const f = fixture();
    f.el.remove();
    await mutations();
    let reenter = true;
    f.change.mockImplementation(() => {
      if (!reenter || !f.el.isConnected) return;
      reenter = false;
      f.el.remove();
      f.sync();
    });
    destination.append(f.el);
    clock.flush();
    expect(f.lease.view()).toBeNull();
    expect(clock.queued.size).toBe(1);
    expect(clock.request).toHaveBeenCalledTimes(2);
    destination.append(f.el);
    clock.flush();
    expect(f.lease.view()?.scope).toBe(destination);
    expect(clock.queued.size).toBe(0);
  });

  it('does not strand another participant when a reconnection notification throws', async () => {
    const clock = frames();
    const first = fixture();
    const second = fixture();
    first.el.remove();
    second.el.remove();
    await mutations();
    const destination = shadow('closed');
    destination.append(first.el, second.el);
    first.change.mockImplementationOnce(() => {
      throw new Error('injected view failure');
    });
    second.change.mockClear();
    expect(() => clock.flush()).toThrow('injected view failure');
    expect(second.change).not.toHaveBeenCalled();
    expect(clock.queued.size).toBe(1);
    clock.flush();
    expect(second.change).toHaveBeenCalledOnce();
    expect(clock.queued.size).toBe(0);
  });
});
