// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { qtControlsSource } from '../src/qt-native-controls';

// Execute the actual emitted guest module. These bounded host witnesses are
// distinct from the real Qt SDK consumer and do not claim native geometry.
function fixture() {
  let ready = false;
  let root: any = null;
  const delivered: any[] = [];
  const factory = new Function(
    `${qtControlsSource.replace('export function createControls', 'function createControls')}\nreturn createControls;`
  )();
  const controls = factory({
    declarations: [],
    alive() {},
    setup() {},
    runtime() {},
    changed() {},
    refreshFacts() {},
    active: () => true,
    ready: () => ready,
    root: () => root,
    invoke: (callback: (...args: any[]) => any, args: any[]) => callback(...args),
  });
  const scroll = controls.hooks.asScrollSurface();
  scroll.configure({
    axes: 'vertical',
    projection: 'system',
    endFollow: { mode: 'while-at-end', axis: 'vertical' },
  });
  return {
    scroll,
    controls,
    delivered,
    mount(onRequest?: (request: any) => void) {
      root = {
        syncScroll() {},
        scrollRequest(request: any) {
          delivered.push(request);
          onRequest?.(request);
        },
      };
      ready = true;
      controls.mount();
    },
    detach() {
      ready = false;
      controls.unmount();
      root = null;
    },
    retireWithRetainedRoot() {
      ready = false;
      controls.unmount();
    },
  };
}

describe('Qt Scroll request outcomes belong to the current physical view', () => {
  it('rejects unmounted and retiring views without delivering to a stale root', () => {
    const f = fixture();
    expect(f.scroll.request({ kind: 'to', axis: 'vertical', position: 0.5 })).toEqual({
      kind: 'rejected',
      reason: 'not-mounted',
    });
    f.mount();
    f.retireWithRetainedRoot();
    expect(f.scroll.request({ kind: 'to', axis: 'vertical', position: 0.5 })).toEqual({
      kind: 'rejected',
      reason: 'not-mounted',
    });
    expect(f.delivered).toEqual([]);
  });

  it.each([
    { kind: 'by', axis: 'vertical', delta: 10 },
    { kind: 'page', axis: 'vertical', direction: 'after' },
    { kind: 'to', axis: 'vertical', position: 0.5 },
    { kind: 'control-drag', axis: 'vertical', position: 0.75 },
    { kind: 'to-end', axis: 'vertical' },
  ])('returns dispatched for actual current-engine delivery: $kind', (request) => {
    const f = fixture();
    f.mount();
    expect(f.scroll.request(request)).toEqual({ kind: 'dispatched' });
    expect(f.delivered).toEqual([request]);
    expect(f.scroll.vertical.position.get()).toBe(0);
  });

  it('rejects an inactive axis and unimplemented reveal without corrupting geometry', () => {
    const f = fixture();
    f.mount();
    expect(f.scroll.request({ kind: 'to', axis: 'horizontal', position: 0.5 })).toEqual({
      kind: 'rejected',
      reason: 'unavailable',
    });
    expect(f.scroll.request({ kind: 'reveal', axis: 'vertical', family: {}, part: {} })).toEqual({
      kind: 'rejected',
      reason: 'unavailable',
    });
    expect(f.delivered).toEqual([]);
  });

  it('clamps normalized input while leaving native facts to the host', () => {
    const f = fixture();
    f.mount();
    expect(f.scroll.request({ kind: 'to', axis: 'vertical', position: 2 })).toEqual({
      kind: 'dispatched',
    });
    expect(f.delivered).toEqual([{ kind: 'to', axis: 'vertical', position: 1 }]);
    expect(f.scroll.vertical.position.get()).toBe(0);
  });

  it('reports pending before host delivery and applied only after it returns', () => {
    const f = fixture();
    const seen: string[] = [];
    f.scroll.endFollow.requestStatus.subscribe((event: any) => seen.push(event.next));
    f.mount(() => expect(f.scroll.endFollow.requestStatus.get()).toBe('pending'));
    expect(f.scroll.request({ kind: 'to-end', axis: 'vertical' })).toEqual({ kind: 'dispatched' });
    expect(seen).toEqual(['pending', 'applied']);
    expect(f.scroll.getSnapshot().endFollow).toEqual({
      state: 'following',
      requestStatus: 'applied',
    });
  });

  it('rejects an old request after a pending observer replaces the physical view', () => {
    const f = fixture();
    f.mount();
    let once = true;
    f.scroll.endFollow.requestStatus.subscribe((event: any) => {
      if (once && event.next === 'pending') {
        once = false;
        f.detach();
        f.mount();
      }
    });
    expect(f.scroll.request({ kind: 'to-end', axis: 'vertical' })).toEqual({
      kind: 'rejected',
      reason: 'unavailable',
    });
    expect(f.delivered).toEqual([]);
    expect(f.scroll.endFollow.requestStatus.get()).not.toBe('applied');
  });

  it('preserves a newer reentrant request outcome when the old request resumes', () => {
    const f = fixture();
    f.mount();
    let once = true;
    f.scroll.endFollow.requestStatus.subscribe((event: any) => {
      if (once && event.next === 'pending') {
        once = false;
        expect(f.scroll.request({ kind: 'to-end', axis: 'vertical' })).toEqual({
          kind: 'dispatched',
        });
      }
    });
    expect(f.scroll.request({ kind: 'to-end', axis: 'vertical' })).toEqual({
      kind: 'rejected',
      reason: 'unavailable',
    });
    expect(f.delivered).toHaveLength(1);
    expect(f.scroll.endFollow.requestStatus.get()).toBe('applied');
  });

  it('allows a pending observer to pause without later moving the engine', () => {
    const f = fixture();
    f.mount();
    let once = true;
    f.scroll.endFollow.requestStatus.subscribe((event: any) => {
      if (once && event.next === 'pending') {
        once = false;
        expect(f.scroll.pauseFollowing()).toEqual({ kind: 'dispatched' });
      }
    });
    expect(f.scroll.request({ kind: 'to-end', axis: 'vertical' })).toEqual({
      kind: 'rejected',
      reason: 'unavailable',
    });
    expect(f.delivered).toEqual([]);
    expect(f.scroll.endFollow.requestStatus.get()).toBe('rejected');
    expect(f.scroll.endFollow.state.get()).toBe('paused');
  });

  it('retires a failed end request while preserving the original falsy host error', () => {
    const f = fixture();
    f.mount(() => {
      throw false;
    });
    f.scroll.endFollow.requestStatus.subscribe((event: any) => {
      if (event.next === 'rejected') throw new Error('secondary observer failure');
    });
    let returned = false,
      failure: unknown = 'not caught';
    try {
      f.scroll.request({ kind: 'to-end', axis: 'vertical' });
      returned = true;
    } catch (error) {
      failure = error;
    }
    expect(returned).toBe(false);
    expect(failure).toBe(false);
    expect(f.scroll.endFollow.requestStatus.get()).toBe('rejected');
  });

  it.each(['axes', 'position'] as const)(
    'retires pending end facts after a newer %s operation',
    (kind) => {
      const f = fixture();
      f.mount();
      let once = true;
      f.scroll.endFollow.requestStatus.subscribe((event: any) => {
        if (once && event.next === 'pending') {
          once = false;
          if (kind === 'axes') f.scroll.sync({ axes: 'horizontal' });
          else
            expect(f.scroll.request({ kind: 'to', axis: 'vertical', position: 0.4 })).toEqual({
              kind: 'dispatched',
            });
        }
      });
      expect(f.scroll.request({ kind: 'to-end', axis: 'vertical' })).toEqual({
        kind: 'rejected',
        reason: 'unavailable',
      });
      expect(f.delivered).toHaveLength(kind === 'axes' ? 0 : 1);
      expect(f.scroll.endFollow.requestStatus.get()).toBe('rejected');
    }
  );

  it('retires an unapplied request after a pending observer throws undefined', () => {
    const f = fixture();
    f.mount();
    let caught = false,
      first: unknown = 'not caught';
    f.scroll.endFollow.requestStatus.subscribe((event: any) => {
      if (event.next === 'pending') throw undefined;
    });
    try {
      f.scroll.request({ kind: 'to-end', axis: 'vertical' });
    } catch (error) {
      caught = true;
      first = error;
    }
    expect(caught).toBe(true);
    expect(first).toBeUndefined();
    expect(f.delivered).toEqual([]);
    expect(f.scroll.endFollow.requestStatus.get()).toBe('rejected');
  });

  it('keeps the actual applied outcome when its completion observer throws', () => {
    const f = fixture();
    f.mount();
    let caught = false,
      first: unknown = 'not caught';
    f.scroll.endFollow.requestStatus.subscribe((event: any) => {
      if (event.next === 'applied') throw false;
    });
    try {
      f.scroll.request({ kind: 'to-end', axis: 'vertical' });
    } catch (error) {
      caught = true;
      first = error;
    }
    expect(caught).toBe(true);
    expect(first).toBe(false);
    expect(f.delivered).toHaveLength(1);
    expect(f.scroll.endFollow.requestStatus.get()).toBe('applied');
    expect(f.scroll.getSnapshot().endFollow.requestStatus).toBe('applied');
  });

  it('finishes both current follow facts when the following-state observer throws first', () => {
    const f = fixture();
    f.mount();
    let caught = false,
      first: unknown = 'not caught';
    f.scroll.endFollow.state.subscribe((event: any) => {
      if (event.next === 'following') throw false;
    });
    f.scroll.endFollow.requestStatus.subscribe((event: any) => {
      if (event.next === 'applied') throw new Error('secondary');
    });
    try {
      f.scroll.request({ kind: 'to-end', axis: 'vertical' });
    } catch (error) {
      caught = true;
      first = error;
    }
    expect(caught).toBe(true);
    expect(first).toBe(false);
    expect(f.delivered).toHaveLength(1);
    expect(f.scroll.endFollow.state.get()).toBe('following');
    expect(f.scroll.endFollow.requestStatus.get()).toBe('applied');
    expect(f.scroll.getSnapshot().endFollow.requestStatus).toBe('applied');
  });
});
