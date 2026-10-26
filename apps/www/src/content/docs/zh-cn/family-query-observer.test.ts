// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { settleFamilyQueryBatch } from './family-query-observer';

afterEach(() => vi.useRealTimers());

describe('family query post-verdict observation budget', () => {
  it('returns incomplete for an unsettled query without cancelling its later result', async () => {
    vi.useFakeTimers();
    let resolve!: (value: string) => void;
    const request = new Promise<string>((done) => {
      resolve = done;
    });
    const observation = settleFamilyQueryBatch([request], 1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await observation).toEqual({ complete: false });
    resolve('late-original-result');
    expect(await request).toBe('late-original-result');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not wait forever for a permanently unsettled Promise', async () => {
    vi.useFakeTimers();
    const request = new Promise<string>(() => {});
    const observation = settleFamilyQueryBatch([request], 1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await observation).toEqual({ complete: false });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retains fulfilled values and the exact original rejection objects', async () => {
    vi.useFakeTimers();
    const value = { original: true };
    const error = new Error('original query failure');
    const result = await settleFamilyQueryBatch<unknown>(
      [Promise.resolve(value), Promise.reject(error), Promise.reject(0)],
      1000
    );
    expect(result.complete).toBe(true);
    if (!result.complete) throw new Error('Expected all original requests to settle');
    expect(result.outcomes[0]).toEqual({ status: 'fulfilled', value });
    expect(result.outcomes[0].status === 'fulfilled' && result.outcomes[0].value).toBe(value);
    expect(result.outcomes[1].status === 'rejected' && result.outcomes[1].reason).toBe(error);
    expect(result.outcomes[2].status === 'rejected' && result.outcomes[2].reason).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not renew an already exhausted observation budget', async () => {
    const request = Promise.resolve('already-ready');
    expect(await settleFamilyQueryBatch([request], 0)).toEqual({ complete: false });
    expect(await request).toBe('already-ready');
  });
});
