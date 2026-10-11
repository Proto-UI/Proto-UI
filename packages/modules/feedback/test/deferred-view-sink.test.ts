import { describe, expect, it, vi } from 'vitest';
import { createDeferredViewVisualSink } from '../src/material/deferred-view-sink';
import type { VisualFeedbackFrame } from '../src/material/shared-sink';
const frame = (revision = 1, view = 1): VisualFeedbackFrame => ({
  view,
  revision,
  style: { kind: 'tw', tokens: ['bg-background'] },
  material: { slot: null, candidates: [] },
});
describe('deferred physical-view visual provider', () => {
  it('does not allocate resources for a mount that never commits', () => {
    const factory = vi.fn();
    const sink = createDeferredViewVisualSink(factory, vi.fn());
    sink.release(1);
    sink.commit(frame());
    expect(factory).not.toHaveBeenCalled();
  });
  it('allocates once, forwards final frames, ignores stale frames and rejects cross-view reuse', () => {
    const provider = { commit: vi.fn(), release: vi.fn() };
    const factory = vi.fn(() => provider);
    const sink = createDeferredViewVisualSink(factory, vi.fn());
    sink.commit(frame(2));
    sink.commit(frame(1));
    sink.commit(frame(3));
    expect(factory).toHaveBeenCalledTimes(1);
    expect(provider.commit).toHaveBeenCalledTimes(2);
    expect(() => sink.commit(frame(4, 2))).toThrow('view lease');
    sink.release(2);
    expect(provider.release).not.toHaveBeenCalled();
    sink.release(1);
    sink.release(1);
    sink.commit(frame(5));
    expect(provider.release).toHaveBeenCalledTimes(1);
    expect(provider.commit).toHaveBeenCalledTimes(2);
  });
  it('restores ordinary style for a missing provider without manufacturing optical support', () => {
    const fallback = vi.fn();
    const sink = createDeferredViewVisualSink(() => null, fallback);
    sink.commit(frame());
    expect(fallback).toHaveBeenCalledWith(frame());
  });
  it('retries allocation failure without swallowing the exact error', () => {
    const failure = new Error('allocate');
    const provider = { commit: vi.fn(), release: vi.fn() };
    const factory = vi
      .fn()
      .mockImplementationOnce(() => {
        throw failure;
      })
      .mockReturnValue(provider);
    const sink = createDeferredViewVisualSink(factory, vi.fn());
    expect(() => sink.commit(frame())).toThrow(failure);
    sink.commit(frame());
    expect(provider.commit).toHaveBeenCalledOnce();
  });
  it('releases a provider returned after reentrant view retirement before any paint', () => {
    const provider = { commit: vi.fn(), release: vi.fn() };
    const sink = createDeferredViewVisualSink(() => {
      sink.release(1);
      return provider;
    }, vi.fn());
    sink.commit(frame());
    expect(provider.commit).not.toHaveBeenCalled();
    expect(provider.release).toHaveBeenCalledTimes(1);
    expect(provider.release).toHaveBeenCalledWith(1);
  });
  it('keeps a newer frame published during allocation and never paints the older one', () => {
    const provider = { commit: vi.fn(), release: vi.fn() };
    const sink = createDeferredViewVisualSink(() => {
      sink.commit(frame(2));
      return provider;
    }, vi.fn());
    sink.commit(frame());
    expect(provider.commit).toHaveBeenCalledTimes(1);
    expect(provider.commit).toHaveBeenCalledWith(frame(2));
  });
});
