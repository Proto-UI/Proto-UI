// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mountCompiledPreview,
  type BrowserTargetAssets,
} from '../../../apps/www/src/components/PrototypePreviewer/compiled-preview-sandbox';
import type { BrowserCompileResult } from '../src/browser/protocol';
import { IR_VERSION } from '../src/ir';

/** Host protocol tests inject messages/time, not executed iframe or WASM evidence. */
function preview() {
  const host = document.createElement('div');
  document.body.append(host);
  const result = {
    ok: true,
    revision: 'retirement-revision',
    requestSha256: '0'.repeat(64),
    source: { file: 'preview.ts', exportName: 'default', sha256: '0'.repeat(64) },
    output: {
      profile: 'web-component-source-v1',
      code: '',
      dependencies: [],
      provenance: {
        source: { file: 'preview.ts', exportName: 'default', sha256: '0'.repeat(64) },
        irVersion: IR_VERSION,
        backend: 'web-component-source-v1',
      },
    },
    preview: {
      format: 1,
      entry: 'preview',
      modules: {},
      events: [],
      styles: [],
      executionBudget: '100000-checkpoints-per-task-v1',
    },
  } as Extract<BrowserCompileResult, { ok: true }>;
  const target: BrowserTargetAssets = {
    format: 1,
    profile: 'web-component-source-v1',
    modules: {},
    versions: {},
    modulesSha256: '0'.repeat(64),
  };
  const mounted = mountCompiledPreview(host, result, target, [], vi.fn());
  void mounted.ready.catch(() => {});
  const source = mounted.frame.contentWindow!;
  const send = vi.spyOn(source, 'postMessage').mockImplementation(() => {});
  const token = mounted.frame.srcdoc.match(/nonce="([a-f0-9]+)"/)![1];
  const message = (type: string, options: MessageEventInit = {}) => {
    window.dispatchEvent(
      new MessageEvent('message', {
        source,
        origin: 'null',
        ...options,
        data: { type, token, revision: result.revision, ...options.data },
      })
    );
  };
  message('preview-ready', { data: { profile: target.profile } });
  return { host, mounted, message, send };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  document.body.replaceChildren();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('compiled preview retirement acknowledgement', () => {
  it('rejects a missing acknowledgement while reclaiming the iframe and listeners', async () => {
    const { host, mounted, send, message } = preview();
    const remove = vi.spyOn(window, 'removeEventListener');
    const retirement = mounted.dispose();
    expect(mounted.dispose()).toBe(retirement);
    const rejected = expect(retirement).rejects.toThrow(/cleanup.*acknowledg/i);
    void rejected.catch(() => {});
    expect(mounted.frame.hidden).toBe(true);
    expect(send).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(250);
    await rejected;
    expect(host.children).toHaveLength(0);
    expect(remove).toHaveBeenCalledWith('message', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
    message('disposed');
    await expect(mounted.dispose()).rejects.toThrow(/cleanup.*acknowledg/i);
  });

  it('resolves only the current opaque frame acknowledgement and cancels its deadline', async () => {
    const { host, mounted, message } = preview();
    const retirement = mounted.dispose();
    await vi.advanceTimersByTimeAsync(249);
    expect(host.children).toHaveLength(1);
    message('disposed');
    await expect(retirement).resolves.toBeUndefined();
    expect(host.children).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    ['source', () => ({ source: window })],
    ['origin', () => ({ origin: 'https://unrelated.invalid' })],
    ['token', () => ({ data: { token: 'wrong-token' } })],
    ['revision', () => ({ data: { revision: 'old-revision' } })],
  ] as const)('does not accept an acknowledgement with a different %s', async (_, options) => {
    const { host, mounted, message } = preview();
    const retirement = mounted.dispose();
    const rejected = expect(retirement).rejects.toThrow(/cleanup.*acknowledg/i);
    void rejected.catch(() => {});
    message('disposed', options());
    expect(host.children).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(250);
    await rejected;
    expect(host.children).toHaveLength(0);
  });

  it('does not reuse an unsolicited acknowledgement from before disposal', async () => {
    const { mounted, message } = preview();
    message('disposed');
    const rejected = expect(mounted.dispose()).rejects.toThrow(/cleanup.*acknowledg/i);
    void rejected.catch(() => {});
    await vi.advanceTimersByTimeAsync(250);
    await rejected;
  });

  it('retains an actual cleanup failure even when disposal is acknowledged', async () => {
    const { host, mounted, message } = preview();
    const rejected = expect(mounted.dispose()).rejects.toThrow('authored cleanup failed');
    message('cleanup-error', { data: { message: 'authored cleanup failed' } });
    message('disposed');
    await rejected;
    expect(host.children).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
