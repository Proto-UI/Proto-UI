import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCopyController, writeClipboard } from './site-copy-controller';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});
const deferred = () => {
  let resolve!: () => void;
  let reject!: () => void;
  const promise = new Promise<void>((a, b) => {
    resolve = a;
    reject = () => b(new Error('denied'));
  });
  return { promise, resolve, reject };
};

describe('Copy operation owner', () => {
  it('writes exact payload synchronously, reserves one pending operation and resets one timer on repeat', async () => {
    vi.useFakeTimers();
    const first = deferred();
    const writeText = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    const owner = createCopyController({ readText: () => 'a\n<&\n', writeText });
    const pending = owner.copy();
    expect(writeText).toHaveBeenCalledWith('a\n<&\n', expect.any(AbortSignal));
    expect(owner.copy()).toBe(pending);
    expect(writeText).toHaveBeenCalledTimes(1);
    first.resolve();
    await pending;
    expect(owner.snapshot().state).toBe('success');
    vi.advanceTimersByTime(1000);
    await owner.copy();
    vi.advanceTimersByTime(600);
    expect(owner.snapshot().state).toBe('success');
    vi.advanceTimersByTime(900);
    expect(owner.snapshot().state).toBe('idle');
    owner.dispose();
  });
  it.each(['throw', 'reject'])('reports %s honestly and retries', async (mode) => {
    const writeText = vi
      .fn()
      .mockImplementationOnce(() => {
        if (mode === 'throw') throw Error('denied');
        return Promise.reject(Error('denied'));
      })
      .mockResolvedValue(undefined);
    const owner = createCopyController({ readText: () => 'payload', writeText });
    expect(await owner.copy()).toBe(false);
    expect(owner.snapshot().state).toBe('error');
    expect(await owner.copy()).toBe(true);
    owner.dispose();
  });
  it('invalidates A→B→A source revisions, without pretending to cancel a platform write', async () => {
    let text = 'A';
    const write = deferred();
    const writeText = vi.fn(() => write.promise);
    const owner = createCopyController({ readText: () => text, writeText });
    const pending = owner.copy();
    text = 'B';
    owner.syncSource();
    text = 'A';
    owner.syncSource();
    expect(owner.copy()).toBe(pending);
    write.resolve();
    expect(await pending).toBe(false);
    expect(owner.snapshot().state).toBe('idle');
    expect(writeText).toHaveBeenCalledTimes(1);
    owner.dispose();
  });
  it('continues feedback into a new subscribed view, never an old view, and disposal clears timers', async () => {
    vi.useFakeTimers();
    const write = deferred();
    const owner = createCopyController({ readText: () => '', writeText: () => write.promise });
    const old = vi.fn();
    const remove = owner.subscribe(old);
    const pending = owner.copy();
    remove();
    const current = vi.fn();
    owner.subscribe(current);
    const calls = old.mock.calls.length;
    write.resolve();
    await pending;
    expect(old).toHaveBeenCalledTimes(calls);
    expect(current.mock.lastCall?.[0].state).toBe('success');
    owner.dispose();
    expect(vi.getTimerCount()).toBe(0);
    expect(await owner.copy()).toBe(false);
  });
  it('late completion after disposal neither publishes nor creates timers', async () => {
    vi.useFakeTimers();
    const write = deferred();
    const owner = createCopyController({ readText: () => '', writeText: () => write.promise });
    const view = vi.fn();
    owner.subscribe(view);
    const pending = owner.copy();
    owner.dispose();
    const calls = view.mock.calls.length;
    write.reject();
    await pending;
    expect(view).toHaveBeenCalledTimes(calls);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('Clipboard platform effect', () => {
  it('does not touch a disposed page when the initial platform request rejects late', async () => {
    const write = deferred();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => write.promise },
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn(() => true),
    });
    const owner = createCopyController({
      readText: () => 'payload',
      writeText: (text, signal) => writeClipboard(document, text, signal),
    });
    const pending = owner.copy();
    owner.dispose();
    write.reject();
    await pending;
    expect(document.execCommand).not.toHaveBeenCalled();
    expect(document.querySelector('textarea')).toBeNull();
  });
  it('retains current focus and exact selection through the EC legacy fallback', async () => {
    document.body.innerHTML = '<input value="abcdef">';
    const input = document.querySelector('input')!;
    input.focus();
    input.setSelectionRange(1, 4);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(Error('denied')) },
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn(() => true),
    });
    await writeClipboard(document, 'a\n<&');
    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([1, 4]);
    expect(document.querySelector('textarea')).toBeNull();
  });
  it('does not report success when both Clipboard and legacy fallback fail', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(Error('denied')) },
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn(() => false),
    });
    await expect(writeClipboard(document, 'a')).rejects.toThrow('denied');
    expect(document.querySelector('textarea')).toBeNull();
  });
});
