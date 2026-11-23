// @vitest-environment happy-dom
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserCompileRequest } from '../src/browser/protocol';

const doubles = vi.hoisted(() => ({ client: vi.fn(), mount: vi.fn() }));
vi.mock('../src/browser/client', () => ({ createBrowserCompilerClient: doubles.client }));
vi.mock('../../../apps/www/src/components/PrototypePreviewer/compiled-preview-sandbox', () => ({
  mountCompiledPreview: doubles.mount,
}));
import '../../../apps/www/src/components/PrototypePreviewer/browser-compiler-panel';

const pending = new Set<ReturnType<typeof Promise.withResolvers<void>>>();
const deferred = () => {
  const value = Promise.withResolvers<void>();
  pending.add(value);
  return value;
};
let retirements: ReturnType<typeof deferred>[];
let owners: { dispose: ReturnType<typeof vi.fn>; fail(error: Error): void }[];
let request: ReturnType<typeof vi.fn>;

/** Real panel and revision coordinator; only compiler/iframe transport are controlled. */
function panel() {
  const element = document.createElement('pui-browser-compiler');
  element.dataset.prototypeId = 'retirement-fixture';
  element.innerHTML = `
    <details data-compiler-panel><summary>Compiler</summary></details>
    <select data-compiler-target><option>web-component-source-v1</option></select>
    <button data-compiler-run>Compile</button><button data-compiler-cancel>Cancel</button>
    <p data-compiler-status></p><div data-compiled-preview></div>
    <output data-compiler-events></output><pre data-compiler-diagnostics hidden></pre>
    <select data-source-file></select><textarea data-source-text></textarea>
    <select data-generated-file></select><pre data-generated-text></pre>`;
  document.body.append(element);
  const details = element.querySelector('details')!;
  const toggle = (open: boolean) => {
    details.open = open;
    details.dispatchEvent(new Event('toggle'));
  };
  const run = () => element.querySelector<HTMLButtonElement>('[data-compiler-run]')!.click();
  const diagnostics = () => element.querySelector('[data-compiler-diagnostics]')!.textContent;
  const ready = () =>
    expect
      .poll(() =>
        element.dataset.compilerPhase === 'failed'
          ? `failed: ${diagnostics()}`
          : element.dataset.compilerPhase
      )
      .toBe('ready');
  return { element, toggle, run, diagnostics, ready };
}

beforeEach(() => {
  retirements = [];
  owners = [];
  doubles.client.mockReset();
  doubles.mount.mockReset();
  // This DOM host lacks the native Option constructor used by the actual panel.
  vi.stubGlobal('Option', function (text = '', value = text) {
    const option = document.createElement('option');
    option.text = text;
    option.value = value;
    return option;
  });
  doubles.client.mockImplementation(async () => ({
    build: { compilerSha256: 'c'.repeat(64) },
    dispose: vi.fn(),
    compile: async (input: BrowserCompileRequest) => ({
      result: {
        ok: true,
        revision: input.revision,
        requestSha256: 'd'.repeat(64),
        output: { profile: input.options.profile, dependencies: [], code: 'compiled fixture' },
      },
    }),
  }));
  doubles.mount.mockImplementation((_host, _result, _target, _items, fail) => {
    const retirement = retirements.shift();
    const owner = {
      ready: Promise.resolve(),
      dispose: vi.fn(() => retirement?.promise ?? Promise.resolve()),
      fail,
    };
    owners.push(owner);
    return owner;
  });
  request = vi.fn(async (url: string) => {
    if (url.endsWith('compiler.js')) return new Response('compiler transport fixture');
    const value = url.endsWith('build.json')
      ? { compilerSha256: 'c'.repeat(64) }
      : url.includes('/source/')
        ? {
            format: 1,
            id: 'retirement-fixture',
            entry: 'fixture.proto.ts',
            files: { 'fixture.proto.ts': 'fixture source' },
          }
        : {
            format: 1,
            profile: 'web-component-source-v1',
            modules: {},
            versions: {},
            modulesSha256: createHash('sha256').update('{}').digest('hex'),
          };
    return new Response(JSON.stringify(value));
  });
  vi.stubGlobal('fetch', request);
});

afterEach(async () => {
  document.body.replaceChildren();
  for (const retirement of pending) retirement.resolve();
  pending.clear();
  await Promise.resolve();
  vi.unstubAllGlobals();
});

describe('browser compiler panel retirement across sessions', () => {
  it('waits for the preceding session before reopening and mounting a fresh owner', async () => {
    const retirement = deferred();
    retirements.push(retirement);
    const view = panel();
    view.toggle(true);
    await view.ready();
    const before = request.mock.calls.length;
    view.toggle(false);
    view.toggle(true);
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(before);
    expect(view.element.dataset.compilerPhase).not.toBe('ready');
    expect(owners).toHaveLength(1);
    expect(owners[0].dispose).toHaveBeenCalledOnce();
    retirement.resolve();
    await view.ready();
    expect(owners).toHaveLength(2);
  });

  it('serializes repeated close/reopen requests and starts only the latest session', async () => {
    const retirement = deferred();
    retirements.push(retirement);
    const view = panel();
    view.toggle(true);
    await view.ready();
    const before = request.mock.calls.length;
    for (let count = 0; count < 3; count++) {
      view.toggle(false);
      view.toggle(true);
    }
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(before);
    expect(owners[0].dispose).toHaveBeenCalledOnce();
    retirement.resolve();
    await view.ready();
    expect(owners).toHaveLength(2);
    expect(doubles.client).toHaveBeenCalledTimes(2);
  });

  it('invalidates a waiting reopen when disconnected and can reconnect after cleanup', async () => {
    const retirement = deferred();
    retirements.push(retirement);
    const view = panel();
    view.toggle(true);
    await view.ready();
    const before = request.mock.calls.length;
    view.toggle(false);
    view.toggle(true);
    view.element.remove();
    retirement.resolve();
    await expect.poll(() => view.element.dataset.compilerPhase).toBe('disposed');
    expect(request).toHaveBeenCalledTimes(before);
    expect(owners).toHaveLength(1);
    document.body.append(view.element);
    await view.ready();
    expect(owners).toHaveLength(2);
  });

  it('retains a failed retirement across reopen and explicit compile attempts', async () => {
    const retirement = deferred();
    retirements.push(retirement);
    const view = panel();
    view.toggle(true);
    await view.ready();
    const before = request.mock.calls.length;
    view.toggle(false);
    view.toggle(true);
    retirement.reject(new Error('preceding owner did not acknowledge cleanup'));
    await expect.poll(() => view.element.dataset.compilerPhase).toBe('failed');
    expect(view.diagnostics()).toContain('preceding owner did not acknowledge cleanup');
    expect(request).toHaveBeenCalledTimes(before);
    view.run();
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(before);
    expect(owners).toHaveLength(1);
    expect(owners[0].dispose).toHaveBeenCalledOnce();
  });

  it('also waits for retirement after an active preview reports a failure', async () => {
    const retirement = deferred();
    retirements.push(retirement);
    const view = panel();
    view.toggle(true);
    await view.ready();
    owners[0].fail(new Error('preview execution failed'));
    expect(view.element.dataset.compilerPhase).toBe('failed');
    expect(view.diagnostics()).toContain('preview execution failed');
    const before = request.mock.calls.length;
    view.run();
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(before);
    retirement.resolve();
    await view.ready();
    expect(owners).toHaveLength(2);
  });
});
