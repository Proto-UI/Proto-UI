// @vitest-environment node
import fs from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

const source = fs.readFileSync(
  new URL('../../src/content/docs/zh-cn/demo-base-image.browser.test.ts', import.meta.url),
  'utf8'
);
const parsed = ts.createSourceFile('image.browser.test.ts', source, ts.ScriptTarget.Latest, true);
const diagnostic = parsed.statements
  .find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'selectImageRuntime')!
  .getText(parsed);

function setup(selectRuntime: ReturnType<typeof vi.fn>, evaluate = vi.fn(async () => ({}))) {
  const page = { on: vi.fn(), off: vi.fn() };
  const previewer = { evaluate, screenshot: vi.fn(async () => {}) };
  const env: Record<string, string> = {};
  const report = vi.fn();
  const select = vm.runInNewContext(
    transformSync(`${diagnostic}\nselectImageRuntime;`, { loader: 'ts', target: 'es2022' }).code,
    {
      selectRuntime,
      console: { error: report },
      process: { env },
      mkdir: vi.fn(async () => {}),
      path: { join: (...parts: string[]) => parts.join('/') },
    }
  ) as (page: unknown, previewer: unknown, runtime: string) => Promise<void>;
  return { page, previewer, report, env, run: () => select(page, previewer, 'vue2') };
}

describe('Base Image readiness failure diagnostics', () => {
  it('keeps the original runtime journey and adds no state reads before a successful selection', async () => {
    const selectRuntime = vi.fn(async () => {});
    const { page, previewer, report, run } = setup(selectRuntime);
    await run();
    expect(selectRuntime).toHaveBeenCalledTimes(1);
    expect(selectRuntime).toHaveBeenCalledWith(page, previewer, 'vue2', 'img', 5);
    expect(previewer.evaluate).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
    expect(page.off).toHaveBeenCalledWith('pageerror', page.on.mock.calls[0][1]);
  });

  it('reports observed failure state and still rejects with the original timeout', async () => {
    const failure = new Error('controlled original readiness timeout');
    const facts = { selectedValue: 'wc', hostImages: 5, roots: [{ tag: 'WC-BASE-IMAGE' }] };
    const { page, report, run } = setup(
      vi.fn(async () => {
        throw failure;
      }),
      vi.fn(async () => facts)
    );
    await expect(run()).rejects.toBe(failure);
    expect(report).toHaveBeenCalledWith(
      'Base Image runtime readiness failure',
      JSON.stringify({ runtime: 'vue2', facts, pageErrors: [] })
    );
    expect(page.off).toHaveBeenCalledWith('pageerror', page.on.mock.calls[0][1]);
  });

  it('retains the original failure if diagnostic collection also fails', async () => {
    const failure = new Error('controlled original readiness timeout');
    const diagnosticFailure = new Error('controlled page disappeared');
    const { page, report, run } = setup(
      vi.fn(async () => {
        throw failure;
      }),
      vi.fn(async () => {
        throw diagnosticFailure;
      })
    );
    await expect(run()).rejects.toBe(failure);
    expect(report).toHaveBeenCalledWith(
      'Base Image readiness diagnostic unavailable',
      diagnosticFailure
    );
    expect(page.off).toHaveBeenCalledWith('pageerror', page.on.mock.calls[0][1]);
  });

  it('bounds the optional screenshot and preserves the original failure if capture fails', async () => {
    const failure = new Error('controlled original readiness timeout');
    const { previewer, env, run } = setup(
      vi.fn(async () => {
        throw failure;
      }),
      vi.fn(async () => ({ theme: 'dark', viewport: { width: 1280 } }))
    );
    env.PROTO_UI_IMAGE_SCREENSHOT_DIR = '/controlled-output';
    previewer.screenshot.mockRejectedValue(new Error('controlled screenshot timeout'));
    await expect(run()).rejects.toBe(failure);
    expect(previewer.screenshot).toHaveBeenCalledWith({
      path: '/controlled-output/vue2-dark-1280-readiness-failed.png',
      timeout: 2_000,
    });
  });
});
