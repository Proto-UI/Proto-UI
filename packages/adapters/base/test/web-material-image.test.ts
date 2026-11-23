import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareOpticalImage, inspectOpticalImageResources } from '../src/material/image-prepare';
afterEach(() => vi.restoreAllMocks());
describe('GPU-image decoding and retirement (host resource unit evidence)', () => {
  it('waits for successful decode and a nonempty image before readiness', async () => {
    let done = () => {};
    const image = {
      src: '',
      complete: true,
      naturalWidth: 100,
      decode: () =>
        new Promise<void>((resolve) => {
          done = resolve;
        }),
    };
    vi.spyOn(window, 'Image').mockImplementation(() => image as unknown as HTMLImageElement);
    const ready = vi.fn(),
      failed = vi.fn(),
      retire = prepareOpticalImage(document, 'data:image/png;base64,AA==', ready, failed);
    expect(ready).not.toHaveBeenCalled();
    expect(inspectOpticalImageResources(document).pendingImages).toBe(1);
    done();
    await Promise.resolve();
    expect(ready).toHaveBeenCalledOnce();
    expect(failed).not.toHaveBeenCalled();
    retire();
    expect(image.src).toBe('');
    expect(inspectOpticalImageResources(document)).toMatchObject({
      pendingImages: 0,
      decodedImages: 0,
    });
  });
  it('retirement cancels a late decode before it can announce readiness', async () => {
    let done = () => {};
    const image = {
      src: '',
      complete: true,
      naturalWidth: 100,
      decode: () =>
        new Promise<void>((resolve) => {
          done = resolve;
        }),
    };
    vi.spyOn(window, 'Image').mockImplementation(() => image as unknown as HTMLImageElement);
    const ready = vi.fn(),
      failed = vi.fn(),
      retire = prepareOpticalImage(document, 'data:image/png;base64,AA==', ready, failed);
    retire();
    done();
    await Promise.resolve();
    expect(ready).not.toHaveBeenCalled();
    expect(failed).not.toHaveBeenCalled();
    expect(image.src).toBe('');
  });
  it('decode rejection or empty pixels cannot announce a prepared image', async () => {
    const ready = vi.fn(),
      failed = vi.fn();
    vi.spyOn(window, 'Image').mockImplementation(
      () =>
        ({
          src: '',
          complete: true,
          naturalWidth: 0,
          decode: () => Promise.resolve(),
        }) as unknown as HTMLImageElement
    );
    const retire = prepareOpticalImage(document, 'data:image/png;base64,AA==', ready, failed);
    await Promise.resolve();
    expect(ready).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledOnce();
    retire();
  });
});

describe('image preparation stage observations (controlled clock, not native latency)', () => {
  it('accounts for success, rejection and cancellation once while separating publication work', async () => {
    let now = 0;
    vi.spyOn(window.performance, 'now').mockImplementation(() => now);
    const decodes: { ready(): void; reject(): void }[] = [];
    vi.spyOn(window, 'Image').mockImplementation(
      () =>
        ({
          src: '',
          complete: true,
          naturalWidth: 1,
          decode: () =>
            new Promise<void>((resolve, reject) => {
              decodes.push({ ready: resolve, reject: () => reject(new Error('decode failed')) });
            }),
        }) as unknown as HTMLImageElement
    );
    const before = inspectOpticalImageResources(document);
    const ready = vi.fn(() => {
      now += 2;
    });
    const failed = vi.fn();
    const retire = [
      prepareOpticalImage(document, 'data:image/png;base64,AA==', ready, failed),
      prepareOpticalImage(document, 'data:image/png;base64,BB==', ready, failed),
      prepareOpticalImage(document, 'data:image/png;base64,CC==', ready, failed),
    ];
    now = 5;
    decodes[0].ready();
    await Promise.resolve();
    now = 10;
    decodes[1].reject();
    await Promise.resolve();
    now = 12;
    retire[2]();
    now = 15;
    decodes[2].ready();
    await Promise.resolve();
    for (const release of retire) {
      release();
      release();
    }
    const after = inspectOpticalImageResources(document);
    const delta = Object.fromEntries(
      Object.entries(after).map(([key, value]) => [key, value - before[key as keyof typeof before]])
    );
    expect(ready).toHaveBeenCalledOnce();
    expect(failed).toHaveBeenCalledOnce();
    expect(delta).toMatchObject({
      pendingImages: 0,
      decodedImages: 0,
      imagePreparations: 3,
      imageDecodes: 1,
      imageDecodeMilliseconds: 5,
      imageDecodeFailures: 1,
      imageDecodeFailureMilliseconds: 10,
      imageDecodeCancellations: 1,
      imageDecodeCancellationMilliseconds: 12,
      imageReadyCallbacks: 1,
      imageReadyCallbackMilliseconds: 2,
      imageReadyCallbackFailures: 0,
    });
  });

  it('records a synchronous startup failure without relabeling it as cancellation', () => {
    let now = 0;
    vi.spyOn(window.performance, 'now').mockImplementation(() => now);
    vi.spyOn(window, 'Image').mockImplementation(
      () =>
        ({
          set src(value: string) {
            if (value) {
              now = 3;
              throw new Error('source assignment failed');
            }
          },
        }) as HTMLImageElement
    );
    const before = inspectOpticalImageResources(document);
    const ready = vi.fn(),
      failed = vi.fn();
    expect(() =>
      prepareOpticalImage(document, 'data:image/png;base64,AA==', ready, failed)
    ).toThrow('source assignment failed');
    const after = inspectOpticalImageResources(document);
    expect(after.pendingImages).toBe(before.pendingImages);
    expect(after.decodedImages).toBe(before.decodedImages);
    expect(after.imagePreparations - before.imagePreparations).toBe(1);
    expect(after.imageDecodeFailures - before.imageDecodeFailures).toBe(1);
    expect(after.imageDecodeFailureMilliseconds - before.imageDecodeFailureMilliseconds).toBe(3);
    expect(after.imageDecodeCancellations).toBe(before.imageDecodeCancellations);
    expect(ready).not.toHaveBeenCalled();
    expect(failed).not.toHaveBeenCalled();
  });

  it('does not misattribute a throwing ready callback to the already successful decoder', async () => {
    let now = 0;
    vi.spyOn(window.performance, 'now').mockImplementation(() => now);
    vi.spyOn(window, 'Image').mockImplementation(
      () =>
        ({
          src: '',
          complete: true,
          naturalWidth: 1,
          decode: () => Promise.resolve(),
        }) as unknown as HTMLImageElement
    );
    const before = inspectOpticalImageResources(document);
    const failed = vi.fn(() => {
      now += 10;
    });
    const retire = prepareOpticalImage(
      document,
      'data:image/png;base64,AA==',
      () => {
        now = 6;
        throw new Error('publication failed');
      },
      failed
    );
    now = 4;
    await Promise.resolve();
    retire();
    const after = inspectOpticalImageResources(document);
    expect(after.pendingImages).toBe(before.pendingImages);
    expect(after.decodedImages).toBe(before.decodedImages);
    expect(after.imageDecodes - before.imageDecodes).toBe(1);
    expect(after.imageDecodeMilliseconds - before.imageDecodeMilliseconds).toBe(4);
    expect(after.imageDecodeFailures).toBe(before.imageDecodeFailures);
    expect(after.imageDecodeCancellations).toBe(before.imageDecodeCancellations);
    expect(after.imageReadyCallbackMilliseconds - before.imageReadyCallbackMilliseconds).toBe(2);
    expect(after.imageReadyCallbackFailures - before.imageReadyCallbackFailures).toBe(1);
    expect(failed).toHaveBeenCalledOnce();
  });
});
