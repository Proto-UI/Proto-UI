import { describe, it, expect, vi } from 'vitest';
import { withLiquidCardFailureObservation } from './library-liquid-card-observation';
import {
  collectAccordionPendingObservation,
  readAccordionSourceBinding,
} from './accordion-pending-observation';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
describe('Accordion failure-only observation', () => {
  for (const value of [undefined, null, false, 0, ''])
    it(`preserves falsy primary ${String(value)} even when retain/report fail`, async () => {
      let caught: any = Symbol('not-thrown');
      try {
        await withLiquidCardFailureObservation(
          () => Promise.reject(value),
          async () => ({}),
          async () => {
            throw Error('write failed');
          },
          () => {
            throw Error('report failed');
          }
        );
      } catch (e) {
        caught = e;
      }
      expect(caught).toBe(value);
    });
  it('deadline retires a slow read without late persistence', async () => {
    vi.useFakeTimers();
    let finish!: (v: any) => void;
    const retain = vi.fn();
    const primary = Error('native');
    let caught: any;
    const p = withLiquidCardFailureObservation(
      () => Promise.reject(primary),
      () => new Promise((r) => (finish = r)),
      retain,
      () => {},
      1000
    ).catch((e) => {
      caught = e;
    });
    await vi.advanceTimersByTimeAsync(1000);
    await p;
    expect(caught).toBe(primary);
    finish({ late: true });
    await Promise.resolve();
    expect(retain).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
  it('retains once and does not overwrite prior evidence', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'accordion-write-once-'));
    const file = path.join(dir, 'facts.json');
    const primary = Error('native');
    try {
      for (const n of [1, 2])
        await withLiquidCardFailureObservation(
          () => Promise.reject(primary),
          async () => ({ n }),
          (facts) => writeFile(file, JSON.stringify(facts), { flag: 'wx' }),
          () => {}
        ).catch((e) => expect(e).toBe(primary));
      expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ n: 1 });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it('collects ancestors without changing DOM, styles, focus or disclosure', () => {
    const outer = document.createElement('div'),
      el = document.createElement('button');
    outer.setAttribute('data-pui-view-detached', '');
    el.setAttribute('data-pui-view-pending', '');
    el.setAttribute('aria-expanded', 'false');
    outer.append(el);
    document.body.append(outer);
    const before = outer.outerHTML;
    const active = document.activeElement;
    try {
      const facts = collectAccordionPendingObservation(el);
      expect(facts.ancestors[0].pending).toBe(true);
      expect(facts.ancestors[1].detached).toBe(true);
      expect(facts.ancestors[0].vue2).toBeNull();
      expect(outer.outerHTML).toBe(before);
      expect(document.activeElement).toBe(active);
    } finally {
      outer.remove();
    }
  });
});

describe('source binding includes dirty working sources', () => {
  for (const [status, dirty] of [
    ['', false],
    [' M tracked.ts\n', true],
    ['?? untracked.ts\n', true],
  ] as const)
    it(`reports ${JSON.stringify(status)} truthfully`, () => {
      const calls: string[][] = [];
      const facts = readAccordionSourceBinding((args) => {
        calls.push(args);
        return args[0] === 'status'
          ? status
          : args[1] === 'HEAD'
            ? 'a'.repeat(40) + '\n'
            : 'b'.repeat(40) + '\n';
      });
      expect(facts).toEqual({
        sourceSha: 'a'.repeat(40),
        sourceTree: 'b'.repeat(40),
        sourceDirty: dirty,
      });
      expect(calls).toEqual([
        ['rev-parse', 'HEAD'],
        ['rev-parse', 'HEAD^{tree}'],
        ['status', '--porcelain'],
      ]);
    });
});
