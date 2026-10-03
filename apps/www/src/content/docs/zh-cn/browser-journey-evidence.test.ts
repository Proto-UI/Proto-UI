import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

function parse(file: string) {
  return ts.createSourceFile(
    file,
    readFileSync(new URL(file, import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
}
const styleSource = parse('./demo-prototype-style-closure.browser.test.ts');
const selectionSource = parse('./code-surfaces.browser.test.ts');
function actualFunctions(source: ts.SourceFile, names: string[]) {
  return source.statements
    .filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text ?? ''))
    .map((node) => node.getText(source))
    .join('\n');
}
function execute(source: string, context: Record<string, unknown>) {
  return vm.runInNewContext(
    transformSync(source, { loader: 'ts', target: 'es2022' }).code,
    context
  );
}

function themeJourney(failure?: { stage: 'navigation' | 'ready'; error: Error }) {
  let elapsed = 0;
  const frame = {};
  const response = {
    status: () => 200,
    request: () => ({ isNavigationRequest: () => true }),
    frame: () => frame,
  };
  const info = vi.fn();
  const page = {
    url: () => 'https://fixture.test/en/test/style-isolation/?theme=light',
    mainFrame: () => frame,
    on: vi.fn((_event: string, _listener: (value: typeof response) => void) => {}),
    off: vi.fn(),
    emulateMedia: vi.fn(async () => {}),
    goto: vi.fn(async (_url: string, _options: object) => {
      elapsed += 6_000;
      page.on.mock.calls[0]?.[1](response);
      if (failure?.stage === 'navigation') throw failure.error;
      return response;
    }),
    waitForFunction: vi.fn(
      async (_predicate: () => boolean, _argument: undefined, _options: object) => {
        elapsed += 1_000;
        if (failure?.stage === 'ready') throw failure.error;
      }
    ),
    evaluate: vi.fn(async () => ({ error: null, theme: 'light' })),
    waitForTimeout: vi.fn(async () => {}),
  };
  const open = execute(
    `${actualFunctions(styleSource, ['openStandaloneTheme'])}\nopenStandaloneTheme;`,
    {
      page,
      expect,
      baseUrl: 'https://fixture.test',
      ROUTE: '/en/test/style-isolation/',
      performance: { now: () => elapsed },
      console: { info },
    }
  ) as (theme: string, budget?: { navigationMs: number; readyMs: number }) => Promise<void>;
  return { open, page, events: () => info.mock.calls.map((call) => JSON.parse(call[1])) };
}

describe('source-bound endpoint journey budget (no browser or network)', () => {
  it('gives only the two-theme case 30 seconds and each navigation/ready 10 seconds', async () => {
    let target: ts.CallExpression | undefined;
    function find(node: ts.Node) {
      if (
        ts.isCallExpression(node) &&
        node.expression.getText(styleSource) === 'it' &&
        ts.isStringLiteral(node.arguments[0]) &&
        node.arguments[0].text === 'activates distinct Light and Dark token endpoints'
      )
        target = node;
      ts.forEachChild(node, find);
    }
    find(styleSource);
    let run!: () => Promise<void>;
    let timeout = 5_000;
    let color = 'light';
    const open = vi.fn(async (theme: string) => {
      color = theme;
    });
    execute(target!.getText(styleSource), {
      it: (_name: string, callback: typeof run, budget = 5_000) => {
        run = callback;
        timeout = budget;
      },
      openStandaloneTheme: open,
      readTokenPaint: async () =>
        Object.fromEntries(
          [
            'foreground',
            'background',
            'border',
            'inputBackground',
            'inputBorder',
            'popoverBackground',
            'popoverForeground',
          ].map((key) => [key, color])
        ),
      page: { evaluate: async () => ({ theme: 'dark', colorScheme: 'dark' }) },
      expect,
    });
    await run();
    expect(timeout).toBe(30_000);
    expect(open.mock.calls).toEqual([
      ['light', { navigationMs: 10_000, readyMs: 10_000 }],
      ['dark', { navigationMs: 10_000, readyMs: 10_000 }],
    ]);
  });

  it('passes bounded operations and reports stage duration, HTTP and route', async () => {
    const { open, page, events } = themeJourney();
    await open('light', { navigationMs: 10_000, readyMs: 10_000 });
    expect(page.goto).toHaveBeenCalledWith(expect.any(String), {
      waitUntil: 'networkidle',
      timeout: 10_000,
    });
    expect(page.waitForFunction.mock.calls[0][2]).toEqual({ timeout: 10_000 });
    expect(events()).toContainEqual(
      expect.objectContaining({
        stage: 'navigation',
        state: 'passed',
        stageElapsedMs: 6_000,
        httpStatus: 200,
        route: page.url(),
      })
    );
    expect(events()).toContainEqual(
      expect.objectContaining({ stage: 'ready', state: 'passed', totalElapsedMs: 7_000 })
    );
    expect(page.waitForTimeout.mock.calls).toEqual([[200]]);
    expect(page.off).toHaveBeenCalledWith('response', page.on.mock.calls[0][1]);
  });

  it.each(['navigation', 'ready'] as const)(
    'logs a %s failure without retry, sleep or masking it',
    async (stage) => {
      const error = new Error(`controlled ${stage} timeout`);
      const { open, page, events } = themeJourney({ stage, error });
      await expect(open('light', { navigationMs: 10_000, readyMs: 10_000 })).rejects.toBe(error);
      expect(page.goto).toHaveBeenCalledTimes(1);
      expect(page.waitForFunction).toHaveBeenCalledTimes(stage === 'ready' ? 1 : 0);
      expect(page.waitForTimeout).not.toHaveBeenCalled();
      expect(events()).toContainEqual(
        expect.objectContaining({ stage, state: 'failed', httpStatus: 200, error: String(error) })
      );
      expect(page.off).toHaveBeenCalledTimes(1);
    }
  );

  it('leaves other callers at their existing navigation default and 90 second ready budget', async () => {
    const { open, page, events } = themeJourney();
    await open('light');
    expect(page.goto).toHaveBeenCalledWith(expect.any(String), { waitUntil: 'networkidle' });
    expect(page.waitForFunction.mock.calls[0][2]).toEqual({ timeout: 90_000 });
    expect(page.on).not.toHaveBeenCalled();
    expect(events()).toEqual([]);
  });
});

function selectionCheck(
  selected: string,
  diagnosisFails = false,
  env: Record<string, string> = {}
) {
  const probe = vi.fn();
  const error = vi.fn();
  const writeFile = vi.fn(async (_path: string, _contents: string) => {});
  const token = {
    evaluate: vi.fn(async () => {
      if (diagnosisFails) throw new Error('controlled diagnostic failure');
      return { selectedText: selected, focus: { offset: 1 } };
    }),
  };
  const page = { evaluate: vi.fn(async () => selected) };
  const check = execute(
    `${actualFunctions(selectionSource, ['expectNativeTokenSelection'])}\nexpectNativeTokenSelection;`,
    {
      expect,
      console: { error },
      process: { env },
      execFileSync: () => 'actual-checkout-sha\n',
      mkdir: vi.fn(async () => {}),
      writeFile,
      join: (...parts: string[]) => parts.join('/'),
      readNativeSelectionDiagnostics: probe,
    }
  ) as (...args: unknown[]) => Promise<void>;
  return {
    run: () => check(page, token, { x: 20, y: 30, width: 150, height: 20 }, '320-light'),
    token,
    error,
    writeFile,
  };
}

describe('source-bound native mouse selection diagnostics', () => {
  it('retains actual-source diagnostics inside the full CI shard artifact', async () => {
    const { run, writeFile } = selectionCheck('wc-base-transition ', false, {
      PROTO_UI_RUNTIME_EVIDENCE_DIR: '/runner/runtime-ci',
      GITHUB_SHA: 'synthetic-event',
    });
    await expect(run()).rejects.toThrow(
      "expected 'wc-base-transition ' to be 'wc-base-transition'"
    );
    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(writeFile.mock.calls[0][0]).toBe(
      '/runner/runtime-ci/code-surfaces/320-light-native-selection.json'
    );
    expect(JSON.parse(writeFile.mock.calls[0][1]).source).toEqual({
      exactSHA: 'actual-checkout-sha',
      expectedSHA: null,
      eventSHA: 'synthetic-event',
    });
  });
  it('retains successful selection geometry without reporting a failure', async () => {
    const { run, token, error, writeFile } = selectionCheck('wc-base-transition', false, {
      PROTO_UI_RUNTIME_EVIDENCE_DIR: '/runner/runtime-ci',
    });
    await run();
    expect(token.evaluate).toHaveBeenCalledTimes(1);
    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(JSON.parse(writeFile.mock.calls[0][1]).observed.selectedText).toBe('wc-base-transition');
    expect(error).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'keeps trailing whitespace a failure when diagnostics fail=%s',
    async (diagnosisFails) => {
      const { run, token, error } = selectionCheck('wc-base-transition ', diagnosisFails);
      await expect(run()).rejects.toThrow(
        "expected 'wc-base-transition ' to be 'wc-base-transition'"
      );
      expect(token.evaluate).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledTimes(1);
      if (!diagnosisFails) {
        const facts = JSON.parse(error.mock.calls[0][1]);
        expect(facts.drag).toEqual({ start: { x: 21, y: 40 }, end: { x: 169, y: 40 }, steps: 8 });
        expect(facts.observed.selectedText).toBe('wc-base-transition ');
      }
    }
  );

  it('reads real text nodes and offsets without changing the existing selection', () => {
    const pre = document.createElement('pre');
    pre.innerHTML = '<code><span>wc-base-transition</span><span> open</span></code>';
    document.body.append(pre);
    const token = pre.querySelector('span')!;
    const anchor = token.firstChild!;
    const focus = token.nextSibling!.firstChild!;
    const chosen = document.createRange();
    chosen.setStart(anchor, 0);
    chosen.setEnd(focus, 1);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(chosen);
    // HappyDOM has no glyph layout. Inject rects only to verify collection, not
    // claim native hit-testing, actual pixels, or mouse selection success.
    const clientRects = vi.spyOn(Range.prototype, 'getClientRects').mockImplementation(function (
      this: Range
    ) {
      return [new DOMRect(this.startOffset * 8, 10, 8, 16)] as unknown as DOMRectList;
    });
    try {
      const read = execute(
        `${actualFunctions(selectionSource, ['readNativeSelectionDiagnostics'])}\nreadNativeSelectionDiagnostics;`,
        {
          document,
          NodeFilter,
          getSelection: () => selection,
          getComputedStyle,
          innerWidth: 320,
          innerHeight: 1000,
          scrollX: 0,
          scrollY: 0,
          devicePixelRatio: 1,
        }
      ) as (node: HTMLElement, bounds: object) => any;
      const before = {
        text: selection.toString(),
        anchor: selection.anchorOffset,
        focus: selection.focusOffset,
        range: selection.getRangeAt(0),
      };
      const observed = read(token, { x: 20, y: 30, width: 150, height: 20 });
      expect(observed.selectedText).toBe('wc-base-transition ');
      expect(observed.anchor.offset).toBe(before.anchor);
      // HappyDOM does not faithfully model native Selection direction/offsets.
      // Verify the observed offsets, not an invented Chromium expectation.
      expect(observed.focus.offset).toBe(before.focus);
      expect(observed.nextRun[0].glyphs[0]).toMatchObject({
        offset: 0,
        text: ' ',
        rects: [{ x: 0, y: 10, width: 8, height: 16 }],
      });
      expect(selection.toString()).toBe(before.text);
      expect(selection.getRangeAt(0)).toBe(before.range);
    } finally {
      clientRects.mockRestore();
      selection.removeAllRanges();
      pre.remove();
    }
  });
});
