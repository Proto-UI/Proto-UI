import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  holdMediaEmulation,
  type MediaPage,
  assertMediaObservation,
  readMediaObservation,
} from '../../../../experiments/material-initial-paint/media-session';

const page = {};
function fixture() {
  const session = {
    send: vi.fn().mockResolvedValue(undefined),
    detach: vi.fn().mockResolvedValue(undefined),
  };
  const context = { newCDPSession: vi.fn().mockResolvedValue(session) };
  const report = vi.fn();
  return {
    session,
    context,
    report,
    open: () =>
      holdMediaEmulation(context, page, { 'prefers-reduced-transparency': 'reduce' }, report),
  };
}
afterEach(() => vi.useRealTimers());
describe('initial paint media session ownership', () => {
  it('keeps emulation attached until the entire case explicitly closes, exactly once', async () => {
    const { session, open } = fixture();
    const lease = await open();
    expect(session.send).toHaveBeenCalledWith('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
    });
    expect(session.detach).not.toHaveBeenCalled();
    await lease.close();
    await lease.close();
    expect(session.detach).toHaveBeenCalledTimes(1);
  });
  it('preserves send error when cleanup and its reporter reject', async () => {
    const { session, report, open } = fixture();
    const primary = new Error('media command failed');
    session.send.mockRejectedValue(primary);
    session.detach.mockRejectedValue(new Error('cleanup failed'));
    report.mockImplementation(() => {
      throw new Error('report failed');
    });
    await expect(open()).rejects.toBe(primary);
    expect(session.detach).toHaveBeenCalledOnce();
  });
  it('bounds a pending send and detach without reactivating the session after timeout', async () => {
    vi.useFakeTimers();
    const { session, report, open } = fixture();
    let finish!: () => void;
    session.send.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    session.detach.mockImplementation(() => new Promise<void>(() => {}));
    const result = open().catch((error: Error) => error);
    await vi.advanceTimersByTimeAsync(6000);
    expect(await result).toMatchObject({
      message: 'Media emulation acquisition/send exceeded 5000ms',
    });
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'media-session.detach' })
    );
    finish();
    await vi.runAllTimersAsync();
    expect(session.detach).toHaveBeenCalledOnce();
  });
  it('cleans a late acquisition and never sends an override after the deadline', async () => {
    vi.useFakeTimers();
    const { session, context, open } = fixture();
    let obtained!: (value: unknown) => void;
    context.newCDPSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          obtained = resolve;
        })
    );
    const result = open().catch((error: Error) => error);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await result).toMatchObject({
      message: 'Media emulation acquisition/send exceeded 5000ms',
    });
    obtained(session);
    await vi.runAllTimersAsync();
    expect(session.send).not.toHaveBeenCalled();
    expect(session.detach).toHaveBeenCalledOnce();
  });
  it.each([
    ['reset after detach', { reduce: false, 'no-preference': true }],
    ['unsupported media feature', { reduce: false, 'no-preference': false }],
    ['conflicting values', { reduce: true, 'no-preference': true }],
  ])('rejects actual matchMedia mismatch: %s', (_name, actual) => {
    expect(() =>
      assertMediaObservation({
        requested: { 'prefers-reduced-transparency': 'reduce' },
        actual: { 'prefers-reduced-transparency': actual },
        viewport: { width: 1000, height: 800, dpr: 1 },
        url: 'http://127.0.0.1/seed.html',
      })
    ).toThrow();
  });
  it('bounds a stuck actual media observation', async () => {
    vi.useFakeTimers();
    const actualPage = { evaluate: vi.fn().mockImplementation(() => new Promise(() => {})) };
    const result = readMediaObservation(actualPage as unknown as MediaPage, {}).catch(
      (error: Error) => error
    );
    await vi.advanceTimersByTimeAsync(5000);
    expect(await result).toMatchObject({ message: 'Media observation exceeded 5000ms' });
  });
  it('accepts only the requested actual media value', () => {
    expect(() =>
      assertMediaObservation({
        requested: { 'prefers-reduced-transparency': 'reduce' },
        actual: { 'prefers-reduced-transparency': { reduce: true, 'no-preference': false } },
        viewport: { width: 1000, height: 800, dpr: 1 },
        url: 'http://127.0.0.1/seed.html',
      })
    ).not.toThrow();
  });
});
