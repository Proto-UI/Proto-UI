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
