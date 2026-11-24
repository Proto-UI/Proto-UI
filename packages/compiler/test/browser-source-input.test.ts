// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../../apps/www/src/components/PrototypePreviewer/browser-compiler-panel';

const mocks = vi.hoisted(() => ({ compile: vi.fn(), dispose: vi.fn() }));
vi.mock('../src/browser/client', () => ({
  createBrowserCompilerClient: async () => ({
    build: { compilerSha256: 'a'.repeat(64) },
    compile: mocks.compile,
    dispose: mocks.dispose,
  }),
}));

// DOM/session controls only. The compiler transport is a diagnostic fixture;
// the unchanged canonical browser journey supplies actual WASM/iframe evidence.
const original = 'export default "original";';
let panel: HTMLElement;
let editor: HTMLTextAreaElement;

function input(value: string) {
  editor.value = value;
  editor.dispatchEvent(new Event('input', { bubbles: true }));
}
async function settled() {
  await vi.waitFor(() => expect(panel.dataset.compilerPhase).toBe('failed'));
}
beforeEach(async () => {
  vi.useFakeTimers();
  // Happy DOM 15 lacks the browser's Option constructor; keep real option nodes.
  vi.stubGlobal('Option', function (text: string, value = text) {
    const option = document.createElement('option');
    option.text = text;
    option.value = value;
    return option;
  });
  mocks.compile.mockReset();
  mocks.dispose.mockReset();
  mocks.compile.mockImplementation(async (request) => ({
    result: {
      ok: false,
      revision: request.revision,
      phase: 'compile',
      diagnostics: [{ code: 'PUI1004', message: 'Controlled compiler diagnostic.' }],
    },
  }));
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      text: async () => 'fixture compiler',
      json: async () =>
        url.includes('/source/')
          ? {
              format: 1,
              id: 'base-button',
              entry: 'entry.ts',
              exportName: 'default',
              files: { 'entry.ts': original, 'support.ts': 'export const value = 1;' },
              sourceImports: {},
            }
          : {},
    }))
  );
  panel = document.createElement('pui-browser-compiler');
  panel.dataset.prototypeId = 'base-button';
  panel.innerHTML = `<details data-compiler-panel>
    <select data-compiler-target><option value="web-component-source-v1">WC</option></select>
    <button data-compiler-run></button><button data-compiler-cancel></button>
    <select data-source-file></select><textarea data-source-text></textarea>
    <span data-compiler-status></span><span data-compiler-events></span>
    <pre data-compiler-diagnostics></pre><div data-compiled-preview></div>
    <select data-generated-file></select><pre data-generated-text></pre>
  </details>`;
  document.body.append(panel);
  editor = panel.querySelector('[data-source-text]')!;
  const details = panel.querySelector('details')!;
  details.open = true;
  details.dispatchEvent(new Event('toggle'));
  await settled();
  expect(
    mocks.compile,
    panel.querySelector('[data-compiler-diagnostics]')!.textContent
  ).toHaveBeenCalledTimes(1);
});
afterEach(async () => {
  panel?.remove();
  await Promise.resolve();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('browser compiler source input ownership', () => {
  it('keeps an unchanged source and its visible diagnostic stable under repeated input', async () => {
    const revision = panel.dataset.compilerRevision;
    const diagnostic = panel.querySelector('[data-compiler-diagnostics]')!.textContent;
    for (let count = 0; count < 350; count++) input(original);
    expect(panel.dataset.compilerRevision).toBe(revision);
    expect(panel.dataset.compilerPhase).toBe('failed');
    expect(panel.querySelector('[data-compiler-diagnostics]')!.textContent).toBe(diagnostic);
    await vi.advanceTimersByTimeAsync(300);
    expect(mocks.compile).toHaveBeenCalledTimes(1);
  });

  it('compiles one real edit on its original deadline despite duplicate input notifications', async () => {
    const before = Number(panel.dataset.compilerRevision);
    const changed = 'export default "changed";';
    input(changed);
    const revision = panel.dataset.compilerRevision;
    expect(Number(revision)).toBe(before + 1);
    expect(panel.dataset.compilerPhase).toBe('idle');
    for (let count = 0; count < 350; count++) input(changed);
    expect(panel.dataset.compilerRevision).toBe(revision);
    await vi.advanceTimersByTimeAsync(249);
    input(changed);
    expect(mocks.compile).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await settled();
    expect(mocks.compile).toHaveBeenCalledTimes(2);
    expect(mocks.compile.mock.calls[1][0].source).toBe(changed);
    expect(mocks.compile.mock.calls[1][0].options.files['entry.ts']).toBe(changed);
  });

  it('retains real undo changes and explicit retry after a compiler diagnostic', async () => {
    input('export default "changed";');
    await vi.advanceTimersByTimeAsync(250);
    await settled();
    input(original);
    await vi.advanceTimersByTimeAsync(250);
    await settled();
    expect(mocks.compile).toHaveBeenCalledTimes(3);
    expect(mocks.compile.mock.calls[2][0].source).toBe(original);
    panel.querySelector<HTMLButtonElement>('[data-compiler-run]')!.click();
    await settled();
    expect(mocks.compile).toHaveBeenCalledTimes(4);
    expect(mocks.compile.mock.calls[3][0].source).toBe(original);
  });

  it('compares the selected source file and retains supporting-file edits', async () => {
    const select = panel.querySelector<HTMLSelectElement>('[data-source-file]')!;
    select.value = 'support.ts';
    select.dispatchEvent(new Event('change'));
    const revision = panel.dataset.compilerRevision;
    input('export const value = 1;');
    expect(panel.dataset.compilerRevision).toBe(revision);
    input('export const value = 2;');
    await vi.advanceTimersByTimeAsync(250);
    await settled();
    expect(mocks.compile).toHaveBeenCalledTimes(2);
    const request = mocks.compile.mock.calls[1][0];
    expect(request.source).toBe(original);
    expect(request.options.files['support.ts']).toBe('export const value = 2;');
  });
});
