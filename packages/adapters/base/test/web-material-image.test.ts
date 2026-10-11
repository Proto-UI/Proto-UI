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
