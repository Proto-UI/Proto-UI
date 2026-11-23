// @vitest-environment node
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBrowserCompilerClient } from '../src/browser/client';
import type { BrowserCompileRequest, BrowserCompilerBuild } from '../src/browser/protocol';

const build: BrowserCompilerBuild = {
  format: 1,
  compilerSha256: 'a'.repeat(64),
  typescriptVersion: '5.9.3',
  execution: 'quickjs-wasm',
};
const request = (revision: string): BrowserCompileRequest => ({
  format: 1,
  revision,
  source: 'original',
  options: {
    profile: 'web-component-source-v1',
    fileName: 'entry.proto.ts',
    files: { 'hook.ts': 'original hook' },
  },
});
class Transport {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { message: string }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  sent: any[] = [];
  terminate = vi.fn();
  postMessage(data: unknown) {
    this.sent.push(structuredClone(data));
  }
  receive(data: unknown) {
    this.onmessage?.({ data });
  }
  complete(index: number, overrides: Record<string, unknown> = {}) {
    const sent = this.sent[index];
    const digest = createHash('sha256').update(JSON.stringify(sent.request)).digest('hex');
    this.receive({
      type: 'compiled',
      id: sent.id,
      requestSha256: digest,
      build,
      elapsedMs: 1,
      result: {
        ok: false,
        revision: sent.request.revision,
        requestSha256: digest,
        phase: 'compile',
        diagnostics: [],
      },
      ...overrides,
    });
  }
}
const transports: Transport[] = [];
async function initialize(signal?: AbortSignal) {
  const worker = new Transport();
  transports.push(worker);
  const ready = createBrowserCompilerClient('bundle', build, {
    signal,
    workerFactory: () => worker as unknown as Worker,
  });
  worker.receive({ type: 'ready', build });
  return { worker, client: await ready };
}
afterEach(() => {
  vi.useRealTimers();
  transports.splice(0).forEach((worker) => worker.terminate());
});

describe('browser compiler revision ownership', () => {
  it('snapshots queued source/dependencies/target and ignores superseded results', async () => {
    const { worker, client } = await initialize();
    const first = client.compile(request('same')).catch((error) => error.name);
    const secondInput = request('same');
    const second = client.compile(secondInput);
    secondInput.source = 'mutated';
    (secondInput.options.files as Record<string, string>)['hook.ts'] = 'mutated hook';
    secondInput.options.profile = 'vue-source-v1';
    expect(await first).toBe('AbortError');
    worker.complete(1);
    expect(worker.sent[2].request).toEqual(request('same'));
    worker.complete(2);
    expect((await second).result.revision).toBe('same');
    client.dispose();
  });
  it('keeps only the newest queued edit, even with duplicate revisions', async () => {
    const { worker, client } = await initialize();
    const a = client.compile(request('duplicate')).catch((error) => error.name);
    const b = client.compile(request('duplicate')).catch((error) => error.name);
    const last = request('duplicate');
    last.options.profile = 'vue-source-v1';
    const c = client.compile(last);
    expect(await a).toBe('AbortError');
    expect(await b).toBe('AbortError');
    worker.complete(1);
    expect(worker.sent).toHaveLength(3);
    expect(worker.sent[2].request.options.profile).toBe('vue-source-v1');
    worker.complete(1); // Duplicate old message must not settle the newest request.
    worker.complete(2);
    expect((await c).result.revision).toBe('duplicate');
    client.dispose();
  });
  it.each([
    { requestSha256: 'b'.repeat(64) },
    { build: { ...build, typescriptVersion: 'another' } },
    { result: { ok: 'true', revision: 'current' } },
    { result: { ok: false, revision: 'current', phase: 'compile', diagnostics: {} } },
    { result: { ok: false, revision: 'wrong', phase: 'host', error: { code: 'disposed' } } },
  ])('fails closed on mismatched transport content %j', async (overrides) => {
    const { worker, client } = await initialize();
    const pending = client.compile(request('current'));
    worker.complete(1, overrides);
    await expect(pending).rejects.toThrow('does not match');
    expect(worker.terminate).toHaveBeenCalledOnce();
    await expect(client.compile(request('later'))).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('rejects malformed ready and aborts before initialization completes', async () => {
    for (const abortFirst of [false, true]) {
      const worker = new Transport();
      const controller = new AbortController();
      const ready = createBrowserCompilerClient('bundle', build, {
        signal: controller.signal,
        workerFactory: () => worker as unknown as Worker,
      });
      if (abortFirst) controller.abort();
      else worker.receive({ type: 'ready', build: { ...build, execution: 'node' } });
      await expect(ready).rejects.toBeInstanceOf(Error);
      expect(worker.terminate).toHaveBeenCalledOnce();
    }
  });
  it('terminates running and queued work on disposal or transport failure', async () => {
    const { worker, client } = await initialize();
    const a = client.compile(request('a')).catch((error) => error.name);
    const b = client.compile(request('b')).catch((error) => error.message);
    worker.onerror?.({ message: 'worker lost' });
    expect(await a).toBe('AbortError');
    expect(await b).toBe('worker lost');
    expect(worker.terminate).toHaveBeenCalledOnce();
    client.dispose();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
