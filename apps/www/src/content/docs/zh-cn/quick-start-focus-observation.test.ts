import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { describe, expect, it } from 'vitest';
const source = readFileSync(
  'apps/www/src/content/docs/zh-cn/quick-start-first-frame.browser.test.ts',
  'utf8'
);
const snippet = source.match(
  /\/\/ focus-method-observation-start\n([\s\S]*?)\s*\/\/ focus-method-observation-end/
)?.[1];
if (!snippet) throw new Error('The native focus observation block is missing');
const install = new Function(
  'HTMLElement',
  'observe',
  transformSync(snippet, { loader: 'ts' }).code
) as (prototype: unknown, observe: (...args: unknown[]) => void) => void;
describe('actual native focus diagnostic wrapper', () => {
  for (const method of ['focus', 'blur'] as const) {
    it.each([false, true])(
      `${method} forwards receiver, arguments and return despite observer failure=%s`,
      (observerFails) => {
        const calls: unknown[] = [];
        const answer = {};
        class Host {
          localName = 'test-host';
          id = 'target';
          focus(...args: unknown[]) {
            calls.push([this, args]);
            return answer;
          }
          blur(...args: unknown[]) {
            calls.push([this, args]);
            return answer;
          }
        }
        const events: unknown[] = [];
        install(Host, (...args) => {
          events.push(args);
          if (observerFails) throw new Error('observer failed');
        });
        const receiver = new Host();
        const args = [{ preventScroll: true }, 'sentinel'];
        expect(Reflect.apply(Host.prototype[method], receiver, args)).toBe(answer);
        expect(calls).toEqual([[receiver, args]]);
        expect(events).toHaveLength(1);
        expect((events[0] as unknown[])[0]).toBe(`${method}-call`);
      }
    );
    it(`${method} preserves the exact native throw even when observing throws`, () => {
      const failure = {};
      class Host {
        focus() {
          throw failure;
        }
        blur() {
          throw failure;
        }
      }
      install(Host, () => {
        throw new Error('observer failed');
      });
      let caught: unknown;
      try {
        Reflect.apply(Host.prototype[method], null, []);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBe(failure);
    });
  }
  it('keeps observation separate from original route, ownership and visible-paint assertions', () => {
    expect(source).toContain("const route = '/zh-cn/start-here/quick-start/#_top'");
    expect(source).toContain('`${key} remains visible`).toBe(true)');
    expect(source).toContain('focused: true');
    expect(source).toContain("['DOMContentLoaded', 'astro:page-load']");
    expect(source).toContain("['load', 'pageshow', 'hashchange']");
    expect(snippet).not.toContain('getComputedStyle');
    expect(source).toContain("describe(document.activeElement, !kind.endsWith('-call'))");
    expect(snippet).not.toContain('.focus(');
    expect(snippet).not.toContain('.blur(');
  });
});
