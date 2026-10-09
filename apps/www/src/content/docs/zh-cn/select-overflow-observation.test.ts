import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  collectSelectOverflowObservation,
  readSelectSourceBinding,
} from './select-overflow-observation';
import { withLiquidCardFailureObservation } from './library-liquid-card-observation';

const rect = (left: number, width: number) => ({
  left,
  right: left + width,
  top: 0,
  bottom: 40,
  width,
  height: 40,
  x: left,
  y: 0,
  toJSON() {
    return {};
  },
});
afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function viewport() {
  vi.stubGlobal('innerWidth', 320);
  vi.stubGlobal('innerHeight', 900);
  vi.stubGlobal('scrollX', 27);
  vi.stubGlobal('scrollY', 800);
  vi.stubGlobal('visualViewport', {
    width: 320,
    height: 900,
    offsetLeft: 0,
    offsetTop: 0,
    scale: 1,
  });
}
describe('Select document overflow failure observation', () => {
  it('retains viewport/page scroll, offending bounds and ancestor layout without mutating layout or focus', () => {
    viewport();
    const outer = document.createElement('section'),
      input = document.createElement('input');
    outer.className = 'test-toolbar';
    outer.style.cssText = 'display:flex; white-space:nowrap; min-width:350px; direction:rtl';
    input.value = 'PRIVATE_INPUT';
    input.setAttribute('value', 'PRIVATE_ATTRIBUTE');
    const text = document.createElement('span');
    text.textContent = 'PRIVATE_BODY';
    outer.append(input, text);
    document.body.append(outer);
    vi.spyOn(outer, 'getBoundingClientRect').mockReturnValue(rect(-27, 400));
    input.focus();
    const html = document.body.outerHTML,
      active = document.activeElement;
    const result = collectSelectOverflowObservation();
    const candidate = result.candidates.find((item) => item.className === 'test-toolbar')!;
    expect(candidate.rect).toMatchObject({ left: -27, right: 373, width: 400 });
    expect(candidate).toMatchObject({
      whiteSpace: 'nowrap',
      minWidth: '350px',
      display: 'flex',
      direction: 'rtl',
    });
    expect(candidate.ancestors.map((item) => item.tag)).toEqual(['body', 'html']);
    expect(result.viewport).toMatchObject({ width: 320, scrollX: 27, scrollY: 800 });
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_INPUT|PRIVATE_ATTRIBUTE|PRIVATE_BODY/);
    expect(document.body.outerHTML).toBe(html);
    expect(document.activeElement).toBe(active);
    expect(scrollX).toBe(27);
    expect(scrollY).toBe(800);
  });
  it('distinguishes internal scroll overflow and traverses open shadow ancestry without claiming causality', () => {
    viewport();
    const host = document.createElement('div'),
      child = document.createElement('div');
    child.id = 'inside-shadow';
    host.attachShadow({ mode: 'open' }).append(child);
    document.body.append(host);
    vi.spyOn(child, 'getBoundingClientRect').mockReturnValue(rect(12, 200));
    Object.defineProperty(child, 'clientWidth', { value: 200 });
    Object.defineProperty(child, 'scrollWidth', { value: 400 });
    const result = collectSelectOverflowObservation();
    const found = result.candidates.find((item) => item.id === 'inside-shadow')!;
    expect(found.rect.right).toBe(212);
    expect(found.scrollWidth).toBe(400);
    expect(found.ancestors.map((item) => item.tag)).toEqual(['div', 'body', 'html']);
    expect(result.meaning).toContain('not necessarily causal');
  });
  it('excludes zero-size boxes and in-viewport nonoverflow boxes', () => {
    viewport();
    const node = document.createElement('div');
    document.body.append(node);
    vi.spyOn(node, 'getBoundingClientRect').mockReturnValue(rect(0, 200));
    expect(collectSelectOverflowObservation().candidates).toEqual([]);
  });
  it('reports candidate truncation instead of pretending a complete offender inventory', () => {
    viewport();
    for (let i = 0; i < 82; i++) {
      const node = document.createElement('div');
      document.body.append(node);
      vi.spyOn(node, 'getBoundingClientRect').mockReturnValue(rect(0, 400));
    }
    const result = collectSelectOverflowObservation();
    expect(result.matched).toBe(82);
    expect(result.candidates).toHaveLength(80);
    expect(result.candidatesTruncated).toBe(true);
    expect(result.traversalTruncated).toBe(false);
  });
  it('caps traversal and explicitly retains incompleteness', () => {
    viewport();
    for (let i = 0; i < 5001; i++) document.body.append(document.createElement('div'));
    const result = collectSelectOverflowObservation();
    expect(result.visited).toBe(5000);
    expect(result.traversalTruncated).toBe(true);
  });
  for (const primary of [undefined, null, false, 0, ''])
    it(`preserves the primary rejection ${String(primary)}`, async () => {
      let caught: unknown = Symbol('unset');
      await withLiquidCardFailureObservation(
        () => Promise.reject(primary),
        async () => ({}),
        async () => {
          throw Error('IO');
        },
        () => {
          throw Error('report');
        }
      ).catch((error) => {
        caught = error;
      });
      expect(caught).toBe(primary);
    });
  it('never observes or persists a passing assertion', async () => {
    const observe = vi.fn(),
      retain = vi.fn();
    expect(
      await withLiquidCardFailureObservation(
        async () => 42,
        observe,
        retain,
        () => {}
      )
    ).toBe(42);
    expect(observe).not.toHaveBeenCalled();
    expect(retain).not.toHaveBeenCalled();
  });
  it('does not persist a late observation after the bounded read expired', async () => {
    vi.useFakeTimers();
    let finish!: (v: unknown) => void;
    const retain = vi.fn(),
      primary = Error('overflow');
    const promise = withLiquidCardFailureObservation(
      () => Promise.reject(primary),
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      retain,
      () => {},
      1000
    ).catch((error) => expect(error).toBe(primary));
    await vi.advanceTimersByTimeAsync(1000);
    await promise;
    finish({ late: true });
    await Promise.resolve();
    expect(retain).not.toHaveBeenCalled();
  });
  it('never overwrites earlier evidence', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'select-overflow-observation-')),
      file = path.join(dir, 'facts.json'),
      primary = Error('overflow');
    try {
      for (const n of [1, 2])
        await withLiquidCardFailureObservation(
          () => Promise.reject(primary),
          async () => ({ n }),
          (facts) => writeFile(file, JSON.stringify(facts), { flag: 'wx' }),
          () => {}
        ).catch((error) => expect(error).toBe(primary));
      expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ n: 1 });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it('keeps original overflow and popup assertions in the native integration', async () => {
    const source = await readFile(
      path.resolve('apps/www/src/content/docs/zh-cn/demo-select-draft-projections.browser.test.ts'),
      'utf8'
    );
    expect(source).toContain('document.documentElement.scrollWidth <= innerWidth + 1');
    expect(source).toContain(
      'expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1)'
    );
    expect(source).toContain('expect(geometry.right).toBeLessThanOrEqual(321)');
    expect(source).toContain('() => page.evaluate(collectSelectOverflowObservation)');
    expect(source).toContain("{ flag: 'wx' }");
    expect(source).toContain('120_000');
  });
  it('cannot produce a falsely clean binding when git status fails', () => {
    expect(() =>
      readSelectSourceBinding((args) => {
        if (args[0] === 'status') throw Error('status failed');
        return 'revision';
      })
    ).toThrow('status failed');
  });
  it('retains the native failure if the browser observation itself fails', async () => {
    const primary = Error('overflow'),
      retain = vi.fn();
    await withLiquidCardFailureObservation(
      () => Promise.reject(primary),
      () => Promise.reject(Error('closed page')),
      retain,
      () => {}
    ).catch((error) => expect(error).toBe(primary));
    expect(retain).not.toHaveBeenCalled();
  });
  for (const dirty of ['', ' M tracked.ts\n', '?? untracked.ts\n'])
    it(`binds HEAD/tree and actual porcelain ${JSON.stringify(dirty)}`, () => {
      const git = vi.fn((args: string[]) =>
        args[0] === 'status' ? dirty : args[1] === 'HEAD' ? 'sha\n' : 'tree\n'
      );
      expect(readSelectSourceBinding(git)).toEqual({
        sourceSha: 'sha',
        sourceTree: 'tree',
        sourceDirty: dirty !== '',
      });
      expect(git).toHaveBeenCalledWith(['status', '--porcelain']);
    });
});

describe('bounded Select demo intrinsic layout samples', () => {
  it('retains in-viewport known owners and their child sizing without exposing text or mutating DOM', () => {
    viewport();
    const layout = document.createElement('div');
    layout.setAttribute('data-demo-ref', 'selectLayout');
    layout.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr);padding:16px';
    const button = document.createElement('button');
    button.setAttribute('data-demo-ref', 'accept');
    button.style.cssText =
      'white-space:nowrap;padding-left:40px;padding-right:40px;border:1px solid';
    const label = document.createElement('span');
    label.setAttribute('data-demo-ref', 'acceptLabel');
    label.textContent = 'PRIVATE_DEMO_LABEL';
    button.append(label);
    layout.append(button);
    document.body.append(layout);
    for (const node of [layout, button, label])
      vi.spyOn(node, 'getBoundingClientRect').mockReturnValue(rect(0, 100));
    const before = document.body.outerHTML;
    const result = collectSelectOverflowObservation();
    expect(result.candidates).toEqual([]);
    expect(result.layoutBoxes.map((box) => box.demoRef)).toEqual([
      'selectLayout',
      'accept',
      'acceptLabel',
    ]);
    const owner = result.layoutBoxes.find((box) => box.demoRef === 'accept')!;
    expect(owner).toMatchObject({
      whiteSpace: 'nowrap',
      paddingLeft: '40px',
      paddingRight: '40px',
    });
    expect(owner.children[0].demoRef).toBe('acceptLabel');
    expect(JSON.stringify(result)).not.toContain('PRIVATE_DEMO_LABEL');
    expect(document.body.outerHTML).toBe(before);
    expect(scrollX).toBe(27);
  });
  it('bounds repeated owner samples and direct children independently of the general offender cap', () => {
    viewport();
    for (let i = 0; i < 26; i++) {
      const layout = document.createElement('div');
      layout.setAttribute('data-demo-ref', 'selectLayout');
      for (let child = 0; child < 18; child++) layout.append(document.createElement('span'));
      document.body.append(layout);
    }
    const result = collectSelectOverflowObservation();
    expect(result.layoutBoxes).toHaveLength(24);
    expect(result.layoutBoxesTruncated).toBe(true);
    expect(result.layoutBoxes[0].children).toHaveLength(16);
    expect(result.layoutBoxes[0].childrenTruncated).toBe(true);
  });
});
