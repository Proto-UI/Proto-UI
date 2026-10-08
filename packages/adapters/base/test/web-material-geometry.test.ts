import { afterEach, describe, expect, it, vi } from 'vitest';
import { observeMaterialGeometry } from '../src/material/geometry-watch';
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
// Happy DOM queues observer delivery in a task; flush that delivery explicitly.
// This is observer/scheduler evidence, not a native browser paint result.
const deliverMutations = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
describe('shared material geometry observation across composed trees', () => {
  it('coalesces shadow ancestor changes, ignores exact own style, and retires all leases', async () => {
    const outer = document.createElement('div');
    document.body.append(outer);
    const root = outer.attachShadow({ mode: 'open' });
    const scope = document.createElement('section'),
      a = document.createElement('button'),
      b = document.createElement('button');
    scope.append(a, b);
    root.append(scope);
    let frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const first = vi.fn(),
      second = vi.fn();
    let ownedStyle: string | null = null;
    const releaseA = observeMaterialGeometry(a, first, () => ownedStyle);
    const releaseB = observeMaterialGeometry(b, second, () => null);
    scope.className = 'clipped';
    scope.style.overflow = 'hidden';
    await deliverMutations();
    expect(frames).toHaveLength(1);
    frames.splice(0).forEach((fn) => fn(1));
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    a.style.backgroundColor = 'red';
    ownedStyle = a.getAttribute('style');
    await deliverMutations();
    expect(frames).toHaveLength(0);
    releaseA();
    scope.className = 'visible';
    await deliverMutations();
    expect(frames).toHaveLength(1);
    frames.splice(0).forEach((fn) => fn(2));
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledTimes(2);
    releaseB();
    scope.className = 'after-release';
    await deliverMutations();
    expect(frames).toHaveLength(0);
  });
});

it('notifies adoption at mutation delivery while retaining ordinary old-document observers', async () => {
  const host = document.createElement('button');
  const sibling = document.createElement('button');
  const iframe = document.createElement('iframe');
  document.body.append(host, sibling, iframe);
  const destination = iframe.contentDocument!;
  const frames = new Map<number, FrameRequestCallback>();
  let sequence = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++sequence, callback);
    return sequence;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
  const migrated = vi.fn();
  const stationary = vi.fn();
  const releaseHost = observeMaterialGeometry(
    host,
    () => {
      migrated();
      releaseHost();
    },
    () => null
  );
  const releaseSibling = observeMaterialGeometry(sibling, stationary, () => null);
  destination.body.append(destination.adoptNode(host));
  await deliverMutations();
  expect(migrated).toHaveBeenCalledOnce();
  expect(stationary).not.toHaveBeenCalled();
  expect(frames.size).toBe(1);
  [...frames.values()].forEach((fn) => fn(1));
  frames.clear();
  expect(stationary).toHaveBeenCalledOnce();
  sibling.className = 'ordinary-change';
  await deliverMutations();
  expect(stationary).toHaveBeenCalledOnce();
  expect(frames.size).toBe(1);
  releaseSibling();
  expect(frames.size).toBe(0);
  expect(migrated).toHaveBeenCalledOnce();
});

it.each([false, true])(
  'isolates failed adoption cleanup from other consumers (stationary=%s)',
  async (stationary) => {
    const first = document.createElement('button');
    const second = document.createElement('button');
    const sibling = document.createElement('button');
    const iframe = document.createElement('iframe');
    document.body.append(first, second, sibling, iframe);
    const destination = iframe.contentDocument!;
    const frames = new Map<number, FrameRequestCallback>();
    let sequence = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.set(++sequence, callback);
      return sequence;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      frames.delete(id);
    });
    // Use actual MutationObserver delivery, recording the propagated exception
    // outside its callback instead of causing an uncaught runner error.
    const errors: unknown[] = [];
    const NativeObserver = window.MutationObserver;
    vi.spyOn(window, 'MutationObserver').mockImplementation(function (callback) {
      return new NativeObserver((records, observer) => {
        try {
          callback(records, observer);
        } catch (error) {
          errors.push(error);
        }
      });
    });
    let offFirst = () => {},
      offSecond = () => {};
    const failure = new Error('one-consumer-release-failed');
    const firstChanged = vi.fn(() => {
      offFirst();
      throw failure;
    });
    const secondChanged = vi.fn(() => offSecond());
    const siblingChanged = vi.fn();
    offFirst = observeMaterialGeometry(first, firstChanged, () => null);
    offSecond = observeMaterialGeometry(second, secondChanged, () => null);
    const offSibling = stationary
      ? observeMaterialGeometry(sibling, siblingChanged, () => null)
      : () => {};
    try {
      destination.body.append(destination.adoptNode(first), destination.adoptNode(second));
      await deliverMutations();
      expect(errors).toEqual([failure]);
      expect(firstChanged).toHaveBeenCalledOnce();
      expect(secondChanged).toHaveBeenCalledOnce();
      expect(frames.size).toBe(stationary ? 1 : 0);
      expect(siblingChanged).not.toHaveBeenCalled();
      [...frames.values()].forEach((fn) => fn(1));
      frames.clear();
      expect(siblingChanged).toHaveBeenCalledTimes(stationary ? 1 : 0);
    } finally {
      offFirst();
      offSecond();
      offSibling();
    }
    expect(frames.size).toBe(0);
  }
);
