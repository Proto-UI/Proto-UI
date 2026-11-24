import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createOpticalImageCache,
  inspectOpticalImageResources,
} from '../src/material/image-prepare';

// Host-unit evidence: decoder completion, image dimensions, and clocks below
// are injected. Actual PNG equality and latency require the native paired run.
const owners: ReturnType<typeof createOpticalImageCache>[] = [];
afterEach(() => {
  for (const owner of owners.splice(0)) owner.dispose();
  vi.restoreAllMocks();
});
function fixture(width = 100, height = 40) {
  const images: Array<{
    src: string;
    complete: boolean;
    naturalWidth: number;
    naturalHeight: number;
    ready(): void;
    reject(): void;
    decode(): Promise<void>;
  }> = [];
  vi.spyOn(window, 'Image').mockImplementation(() => {
    let resolve = () => {};
    let reject = () => {};
    const decoded = new Promise<void>((done, fail) => {
      resolve = done;
      reject = () => fail(new Error('decode failed'));
    });
    const image = {
      src: '',
      complete: true,
      naturalWidth: width,
      naturalHeight: height,
      ready: resolve,
      reject,
      decode: () => decoded,
    };
    images.push(image);
    return image as unknown as HTMLImageElement;
  });
  const cache = createOpticalImageCache(document);
  owners.push(cache);
  const prepare = (source: string, retain = true, ready = vi.fn(), failed = vi.fn()) => ({
    release: cache.prepare(source, ready, failed, retain),
    ready,
    failed,
  });
  return { cache, images, prepare };
}
const png = (value: string) => 'data:image/png;base64,' + value;
function onImageRetire(image: { src: string }, callback: () => void) {
  let source = image.src;
  Object.defineProperty(image, 'src', {
    configurable: true,
    get: () => source,
    set(value: string) {
      source = value;
      if (value === '') callback();
    },
  });
}
describe('bounded decoded held-image ownership', () => {
  it('reuses exactly decoded held bytes after uncached release frames without synchronous publication', async () => {
    const before = inspectOpticalImageResources(document);
    const f = fixture();
    const held = f.prepare(png('held'));
    expect(held.ready).not.toHaveBeenCalled();
    f.images[0].ready();
    await Promise.resolve();
    expect(held.ready).toHaveBeenCalledOnce();
    held.release();
    for (let index = 0; index < 6; index++) {
      const tail = f.prepare(png('tail-' + index), false);
      f.images.at(-1)!.ready();
      await Promise.resolve();
      tail.release();
    }
    const reused = f.prepare(png('held'));
    expect(f.images).toHaveLength(7);
    expect(reused.ready).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(reused.ready).toHaveBeenCalledOnce();
    expect(reused.failed).not.toHaveBeenCalled();
    reused.release();
    const after = inspectOpticalImageResources(document);
    expect(after.imagePreparations - before.imagePreparations).toBe(7);
    expect(after.imageDecodes - before.imageDecodes).toBe(7);
    expect(after.imageReuseHits - before.imageReuseHits).toBe(1);
    f.cache.dispose();
    expect(f.images.every((image) => image.src === '')).toBe(true);
    expect(inspectOpticalImageResources(document)).toMatchObject({
      pendingImages: 0,
      decodedImages: 0,
    });
  });

  it('does not reuse changed bytes or a different material binding', async () => {
    const f = fixture();
    const a = f.prepare(png('A'));
    f.images[0].ready();
    await Promise.resolve();
    a.release();
    const changed = f.prepare(png('B'));
    expect(changed.ready).not.toHaveBeenCalled();
    const other = createOpticalImageCache(document);
    owners.push(other);
    const ready = vi.fn();
    const releaseOther = other.prepare(png('A'), ready, vi.fn(), true);
    expect(f.images).toHaveLength(3);
    expect(ready).not.toHaveBeenCalled();
    f.images[1].ready();
    f.images[2].ready();
    await Promise.resolve();
    expect(changed.ready).toHaveBeenCalledOnce();
    expect(ready).toHaveBeenCalledOnce();
    changed.release();
    releaseOther();
  });

  it('keeps equal-byte pending and active leases independent of one another', async () => {
    const f = fixture();
    const cancelled = f.prepare(png('A'));
    const active = f.prepare(png('A'));
    expect(f.images).toHaveLength(2);
    cancelled.release();
    f.images[0].ready();
    f.images[1].ready();
    await Promise.resolve();
    expect(cancelled.ready).not.toHaveBeenCalled();
    expect(active.ready).toHaveBeenCalledOnce();
    const pending = f.prepare(png('A'));
    expect(f.images).toHaveLength(3);
    expect(pending.ready).not.toHaveBeenCalled();
    active.release();
    const reused = f.prepare(png('A'));
    active.release();
    await Promise.resolve();
    expect(reused.ready).toHaveBeenCalledOnce();
    expect(pending.ready).not.toHaveBeenCalled();
    expect(f.images[1].src).toBe(png('A'));
    f.images[2].ready();
    await Promise.resolve();
    expect(pending.ready).toHaveBeenCalledOnce();
    pending.release();
    reused.release();
    f.cache.clear();
    expect(f.images.every((image) => image.src === '')).toBe(true);
  });

  it('counts reuse lookup separately from decode and only times a live ready callback', async () => {
    let now = 0;
    vi.spyOn(window.performance, 'now').mockImplementation(() => now);
    const f = fixture();
    const first = f.prepare(png('A'));
    now = 5;
    f.images[0].ready();
    await Promise.resolve();
    first.release();
    const before = inspectOpticalImageResources(document);
    const reused = f.prepare(
      png('A'),
      true,
      vi.fn(() => {
        now += 2;
      })
    );
    expect(reused.ready).not.toHaveBeenCalled();
    now = 20;
    await Promise.resolve();
    reused.release();
    const cancelled = f.prepare(png('A'));
    cancelled.release();
    now = 30;
    await Promise.resolve();
    const after = inspectOpticalImageResources(document);
    expect(cancelled.ready).not.toHaveBeenCalled();
    expect(after.imagePreparations).toBe(before.imagePreparations);
    expect(after.imageDecodes).toBe(before.imageDecodes);
    expect(after.imageDecodeMilliseconds).toBe(before.imageDecodeMilliseconds);
    expect(after.imageReuseHits - before.imageReuseHits).toBe(2);
    expect(after.imageReadyCallbacks - before.imageReadyCallbacks).toBe(1);
    expect(after.imageReadyCallbackMilliseconds - before.imageReadyCallbackMilliseconds).toBe(2);
    expect(after.imageDecodeFailures).toBe(before.imageDecodeFailures);
  });

  it('retires every owned lease even when one host image throws during cleanup', async () => {
    const f = fixture();
    const pending = f.prepare(png('pending'));
    const active = f.prepare(png('active'));
    const idle = f.prepare(png('idle'));
    f.images[1].ready();
    f.images[2].ready();
    await Promise.resolve();
    idle.release();
    const failure = new Error('host image cleanup failed');
    Object.defineProperty(f.images[0], 'src', {
      get: () => png('pending'),
      set: () => {
        throw failure;
      },
    });
    expect(() => f.cache.clear()).toThrow(failure);
    expect(f.images.slice(1).map((image) => image.src)).toEqual(['', '']);
    expect(inspectOpticalImageResources(document)).toMatchObject({
      pendingImages: 0,
      decodedImages: 0,
    });
    f.images[0].ready();
    await Promise.resolve();
    expect(pending.ready).not.toHaveBeenCalled();
    pending.release();
    active.release();
    idle.release();
    const replacement = f.prepare(png('active'));
    expect(f.images).toHaveLength(4);
    f.images[3].ready();
    await Promise.resolve();
    expect(replacement.ready).toHaveBeenCalledOnce();
    replacement.release();
  });

  it('clears only the starting cohort when host cleanup acquires successor leases', async () => {
    const f = fixture();
    const successors: ReturnType<typeof f.prepare>[] = [];
    // Bound the bad live-Set iteration so the counterexample cannot hang Vitest.
    let remainingReentries = 3;
    const arm = (image: { src: string }) =>
      onImageRetire(image, () => {
        if (remainingReentries-- <= 0) return;
        successors.push(f.prepare(png('successor-' + successors.length)));
        arm(f.images.at(-1)!);
      });
    const initial = f.prepare(png('initial'));
    arm(f.images[0]);
    try {
      f.cache.clear();
      expect(f.images).toHaveLength(2);
      expect(successors).toHaveLength(1);
      for (const image of f.images) image.ready();
      await Promise.resolve();
      expect(initial.ready).not.toHaveBeenCalled();
      expect(successors[0].ready).toHaveBeenCalledOnce();
      initial.release();
      expect(f.images[1].src).toBe(png('successor-0'));
    } finally {
      remainingReentries = 0;
      f.cache.dispose();
    }
  });

  it('invalidates the whole starting cohort before a cleanup can reacquire another idle PNG', async () => {
    const f = fixture();
    const active = f.prepare(png('active'));
    const idle = f.prepare(png('idle'));
    for (const image of f.images) image.ready();
    await Promise.resolve();
    idle.release();
    let successor: ReturnType<typeof f.prepare> | undefined;
    onImageRetire(f.images[0], () => {
      successor = f.prepare(png('idle'));
    });
    f.cache.clear();
    expect(f.images).toHaveLength(3);
    expect(f.images.slice(0, 2).map((image) => image.src)).toEqual(['', '']);
    expect(successor!.ready).not.toHaveBeenCalled();
    active.release();
    idle.release();
    f.images[2].ready();
    await Promise.resolve();
    expect(successor!.ready).toHaveBeenCalledOnce();
    successor!.release();
  });

  it('rejects a successor acquired reentrantly after disposal starts', () => {
    const f = fixture();
    const initial = f.prepare(png('initial'));
    let refusal: unknown;
    onImageRetire(f.images[0], () => {
      try {
        f.prepare(png('successor'));
      } catch (error) {
        refusal = error;
      }
    });
    f.cache.dispose();
    expect(refusal).toEqual(new Error('image-owner-retired'));
    expect(f.images).toHaveLength(1);
    expect(inspectOpticalImageResources(document)).toMatchObject({
      pendingImages: 0,
      decodedImages: 0,
    });
    initial.release();
  });

  it('keeps released equal-byte leases within budget when replaced idle cleanup throws', async () => {
    const f = fixture(400, 400);
    let throwing = true;
    let failures = 0;
    const armed = new Set<unknown>();
    try {
      for (let round = 0; round < 4; round++) {
        const first = f.prepare(png('same'));
        const second = f.prepare(png('same'));
        for (const image of f.images) {
          if (!armed.has(image)) {
            armed.add(image);
            onImageRetire(image, () => {
              if (throwing) throw new Error('host image cleanup failed');
            });
          }
          image.ready();
        }
        await Promise.resolve();
        for (const lease of [first, second]) {
          try {
            lease.release();
          } catch (error) {
            expect(error).toEqual(new Error('host image cleanup failed'));
            failures++;
          }
          lease.release();
        }
      }
      expect(failures).toBeGreaterThan(0);
      // A 400x400 decoded image occupies at least 640,000 bytes, so only one
      // can remain idle under the unchanged 1 MiB pixel/string budget.
      expect(inspectOpticalImageResources(document).decodedImages).toBeLessThanOrEqual(1);
      expect(inspectOpticalImageResources(document).pendingImages).toBe(0);
    } finally {
      throwing = false;
      f.cache.dispose();
    }
  });

  it('finishes all budget evictions and propagates their first cleanup error', async () => {
    const f = fixture(400, 400);
    const requests: ReturnType<typeof f.prepare>[] = [];
    for (const name of ['small', 'large', 'replacement']) {
      requests.push(f.prepare(png(name)));
      const image = f.images.at(-1)!;
      if (name === 'small') image.naturalWidth = image.naturalHeight = 100;
      image.ready();
      await Promise.resolve();
      if (name !== 'replacement') requests.at(-1)!.release();
    }
    const retired: string[] = [];
    let throwing = true;
    const firstError = new Error('first eviction failed');
    onImageRetire(f.images[0], () => {
      retired.push('small');
      if (throwing) throw firstError;
    });
    onImageRetire(f.images[1], () => {
      retired.push('large');
      if (throwing) throw new Error('second eviction failed');
    });
    try {
      expect(() => requests[2].release()).toThrow(firstError);
      expect(retired).toEqual(['small', 'large']);
      expect(inspectOpticalImageResources(document)).toMatchObject({
        pendingImages: 0,
        decodedImages: 1,
      });
      const reused = f.prepare(png('replacement'));
      expect(f.images).toHaveLength(3);
      await Promise.resolve();
      expect(reused.ready).toHaveBeenCalledOnce();
      reused.release();
    } finally {
      throwing = false;
      f.cache.dispose();
    }
  });

  it.each(['clear', 'dispose'] as const)(
    'honors reentrant %s while retiring a replaced idle image',
    async (operation) => {
      const f = fixture();
      const first = f.prepare(png('same'));
      const second = f.prepare(png('same'));
      for (const image of f.images) image.ready();
      await Promise.resolve();
      first.release();
      onImageRetire(f.images[0], () => f.cache[operation]());
      second.release();
      expect(f.images.map((image) => image.src)).toEqual(['', '']);
      expect(inspectOpticalImageResources(document)).toMatchObject({
        pendingImages: 0,
        decodedImages: 0,
      });
      first.release();
      second.release();
      if (operation === 'dispose') {
        expect(() => f.prepare(png('same'))).toThrow('image-owner-retired');
      } else {
        const replacement = f.prepare(png('same'));
        expect(f.images).toHaveLength(3);
        expect(replacement.ready).not.toHaveBeenCalled();
        f.images[2].ready();
        await Promise.resolve();
        expect(replacement.ready).toHaveBeenCalledOnce();
        replacement.release();
      }
    }
  );

  it.each(['cold', 'cached'] as const)(
    'delivers %s publication failure once even when host cleanup also fails',
    async (kind) => {
      const f = fixture();
      if (kind === 'cached') {
        const seed = f.prepare(png('same'));
        f.images[0].ready();
        await Promise.resolve();
        seed.release();
      }
      // Expose the exact queued callback to assert it cannot throw. The
      // independent Node probe additionally runs the real queueMicrotask.
      const queued: VoidFunction[] = [];
      vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((callback) => {
        queued.push(callback);
      });
      const before = inspectOpticalImageResources(document);
      const failed = vi.fn();
      const request = f.prepare(
        png('same'),
        true,
        vi.fn(() => {
          throw new Error('publication failed');
        }),
        failed
      );
      onImageRetire(f.images[0], () => {
        throw new Error('host image cleanup failed');
      });
      if (kind === 'cached') {
        expect(queued).toHaveLength(1);
        expect(() => queued.shift()!()).not.toThrow();
      } else {
        f.images[0].ready();
        await Promise.resolve();
        await Promise.resolve();
      }
      expect(failed).toHaveBeenCalledOnce();
      const after = inspectOpticalImageResources(document);
      expect(after.imageReadyCallbackFailures - before.imageReadyCallbackFailures).toBe(1);
      expect(after.imageDecodeFailures).toBe(before.imageDecodeFailures);
      expect(after.pendingImages).toBe(0);
      expect(after.decodedImages).toBe(0);
      request.release();
      const replacement = f.prepare(png('same'));
      expect(f.images).toHaveLength(2);
      expect(replacement.ready).not.toHaveBeenCalled();
      f.images[1].ready();
      await Promise.resolve();
      expect(replacement.ready).toHaveBeenCalledOnce();
      replacement.release();
    }
  );

  it('evicts the oldest idle image after two retained outputs and ignores late releases after disposal', async () => {
    const f = fixture();
    const releases: Array<() => void> = [];
    for (const value of ['A', 'B', 'C']) {
      const request = f.prepare(png(value));
      releases.push(request.release);
      f.images.at(-1)!.ready();
      await Promise.resolve();
      request.release();
    }
    expect(f.images.map((image) => image.src !== '')).toEqual([false, true, true]);
    const reused = f.prepare(png('B'));
    await Promise.resolve();
    expect(f.images).toHaveLength(3);
    f.cache.dispose();
    for (const release of [...releases, reused.release]) {
      release();
      release();
    }
    expect(f.images.every((image) => image.src === '')).toBe(true);
    expect(() => f.prepare(png('A'))).toThrow('image-owner-retired');
  });

  it('bounds retained pixels and strings together, and never retains oversized decoded images', async () => {
    const f = fixture(400, 400);
    for (const value of ['A', 'B']) {
      const request = f.prepare(png(value));
      f.images.at(-1)!.ready();
      await Promise.resolve();
      request.release();
    }
    expect(f.images.map((image) => image.src !== '')).toEqual([false, true]);
    const largeString = f.prepare(png('C'.repeat(220000)));
    f.images.at(-1)!.ready();
    await Promise.resolve();
    largeString.release();
    expect(f.images.at(-1)!.src).toBe('');
    const largePixels = f.prepare(png('D'));
    f.images.at(-1)!.naturalWidth = 600;
    f.images.at(-1)!.naturalHeight = 600;
    f.images.at(-1)!.ready();
    await Promise.resolve();
    largePixels.release();
    expect(f.images.at(-1)!.src).toBe('');
  });

  it('cancels cold decode and ignores its late success or failure without seeding reuse', async () => {
    const f = fixture();
    const first = f.prepare(png('A'));
    first.release();
    f.images[0].ready();
    await Promise.resolve();
    expect(first.ready).not.toHaveBeenCalled();
    const second = f.prepare(png('A'));
    second.release();
    f.images[1].reject();
    await Promise.resolve();
    expect(second.ready).not.toHaveBeenCalled();
    expect(second.failed).not.toHaveBeenCalled();
    const third = f.prepare(png('A'));
    expect(f.images).toHaveLength(3);
    f.images[2].ready();
    await Promise.resolve();
    expect(third.ready).toHaveBeenCalledOnce();
    third.release();
  });

  it('cancels queued reuse and clears active, idle and pending resources on owner invalidation', async () => {
    const f = fixture();
    const first = f.prepare(png('A'));
    f.images[0].ready();
    await Promise.resolve();
    first.release();
    const cancelled = f.prepare(png('A'));
    cancelled.release();
    await Promise.resolve();
    expect(cancelled.ready).not.toHaveBeenCalled();
    const reused = f.prepare(png('A'));
    const pending = f.prepare(png('B'));
    f.cache.clear();
    f.images[1].ready();
    await Promise.resolve();
    expect(reused.ready).not.toHaveBeenCalled();
    expect(pending.ready).not.toHaveBeenCalled();
    reused.release();
    pending.release();
    expect(inspectOpticalImageResources(document)).toMatchObject({
      pendingImages: 0,
      decodedImages: 0,
    });
    const replacement = f.prepare(png('A'));
    expect(f.images).toHaveLength(3);
    f.images[2].ready();
    await Promise.resolve();
    expect(replacement.ready).toHaveBeenCalledOnce();
    replacement.release();
  });

  it('retires rejected decodes and failed cached publication without misreporting another decoder failure', async () => {
    const f = fixture();
    const rejected = f.prepare(png('A'));
    f.images[0].reject();
    await Promise.resolve();
    expect(rejected.failed).toHaveBeenCalledOnce();
    const accepted = f.prepare(png('A'));
    f.images[1].ready();
    await Promise.resolve();
    accepted.release();
    const before = inspectOpticalImageResources(document);
    const failed = vi.fn();
    const reused = f.prepare(
      png('A'),
      true,
      vi.fn(() => {
        throw new Error('publication failed');
      }),
      failed
    );
    await Promise.resolve();
    expect(failed).toHaveBeenCalledOnce();
    expect(f.images[1].src).toBe('');
    const after = inspectOpticalImageResources(document);
    expect(after.imageDecodeFailures).toBe(before.imageDecodeFailures);
    expect(after.imageReadyCallbackFailures - before.imageReadyCallbackFailures).toBe(1);
    reused.release();
    const retry = f.prepare(png('A'));
    expect(f.images).toHaveLength(3);
    f.images[2].ready();
    await Promise.resolve();
    expect(retry.ready).toHaveBeenCalledOnce();
    retry.release();
  });

  it('cannot revive an old entry when publication invalidates and reacquires the same bytes', async () => {
    const f = fixture();
    let replacement: ReturnType<typeof f.prepare> | undefined;
    const initial = f.prepare(
      png('A'),
      true,
      vi.fn(() => {
        f.cache.clear();
        replacement = f.prepare(png('A'));
      })
    );
    f.images[0].ready();
    await Promise.resolve();
    expect(f.images).toHaveLength(2);
    expect(f.images[0].src).toBe('');
    expect(replacement!.ready).not.toHaveBeenCalled();
    initial.release();
    f.images[1].ready();
    await Promise.resolve();
    expect(replacement!.ready).toHaveBeenCalledOnce();
    replacement!.release();
  });
});
