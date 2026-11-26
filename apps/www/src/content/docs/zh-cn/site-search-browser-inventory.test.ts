// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { format } from 'node:util';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import { describe, expect, it } from 'vitest';
import { SEARCH_BROWSER_SUITES } from '../../../../../../scripts/test/runtime-test-plan.mjs';

const fixturePath = 'apps/www/src/content/docs/zh-cn/site-search-browser.ts';
const expected = JSON.parse(
  readFileSync('apps/www/test/fixtures/search-browser-inventory.json', 'utf8')
) as Array<{ suite: string; name: string; timeoutMs: number }>;
const sources = new Map<string, string>(
  [fixturePath, ...SEARCH_BROWSER_SUITES].map((file) => [file, readFileSync(file, 'utf8')])
);
const nodeRequire = createRequire(import.meta.url);

/** Evaluate the actual registrations, including every Cartesian loop and
 * it.each row. Test callbacks and lifecycle hooks are recorded, never invoked;
 * this inventory does not manufacture a browser pass or start a server. */
function inventory(
  files: readonly string[] = SEARCH_BROWSER_SUITES,
  currentSources: ReadonlyMap<string, string> = sources
) {
  const cases: Array<{ suite: string; name: string; timeoutMs: number }> = [];
  for (const suite of files) {
    const parents: string[] = [];
    const hooks: Array<{ kind: string; timeoutMs: number | undefined }> = [];
    const cache = new Map<string, { exports: Record<string, unknown> }>();
    const forbid = () => {
      throw new Error('Search inventory cannot skip, focus, defer, or concurrently relabel a case');
    };
    const register = (name: string, _callback: unknown, timeoutMs = 5000) => {
      cases.push({ suite, name: [...parents, name].join(' > '), timeoutMs });
    };
    const test = Object.assign(register, {
      each: (rows: readonly unknown[]) => (name: string, callback: unknown, timeoutMs?: number) => {
        for (const row of rows)
          register(format(name, ...(Array.isArray(row) ? row : [row])), callback, timeoutMs);
      },
      skip: forbid,
      only: forbid,
      todo: forbid,
      concurrent: forbid,
    });
    const describe = (name: string, callback: () => void) => {
      parents.push(name);
      callback();
      parents.pop();
    };
    const lifecycle = (kind: string) => (_callback: unknown, timeoutMs?: number) => {
      hooks.push({ kind, timeoutMs });
    };
    const vitest = {
      it: test,
      describe: Object.assign(describe, { sequential: describe, skip: forbid, only: forbid }),
      beforeAll: lifecycle('beforeAll'),
      afterAll: lifecycle('afterAll'),
      afterEach: lifecycle('afterEach'),
      expect: () => {
        throw new Error('A Search test body ran during registration inventory');
      },
    };
    const load = (file: string): Record<string, unknown> => {
      const held = cache.get(file);
      if (held) return held.exports;
      const source = currentSources.get(file);
      if (source === undefined) throw new Error(`Missing actual Search source: ${file}`);
      const module = { exports: {} as Record<string, unknown> };
      cache.set(file, module);
      const code = transformSync(source, {
        loader: 'ts',
        format: 'cjs',
        target: 'node24',
        keepNames: false,
        logLevel: 'silent',
      }).code;
      runInNewContext(code, {
        module,
        exports: module.exports,
        process: { env: {} },
        console,
        require(specifier: string) {
          if (specifier === 'vitest') return vitest;
          if (specifier.startsWith('node:')) return nodeRequire(specifier);
          if (specifier === './site-search-browser') return load(fixturePath);
          // Only this inert path function is called during registration. Every
          // browser acquisition/import lives in the unexecuted original hooks.
          if (specifier === './site-search-evidence')
            return { searchEvidenceDirectory: () => '/unexecuted-search-evidence' };
          return {};
        },
      });
      return module.exports;
    };
    load(suite);
    expect(hooks).toEqual([
      { kind: 'beforeAll', timeoutMs: 150_000 },
      { kind: 'afterAll', timeoutMs: 60_000 },
      { kind: 'afterEach', timeoutMs: undefined },
    ]);
  }
  return cases;
}

function assertComplete(cases: ReturnType<typeof inventory>) {
  expect(cases).toHaveLength(84);
  expect(new Set(cases.map((row) => row.name)).size).toBe(84);
  expect(cases).toEqual(expected);
}

describe('complete Search browser suite registration', () => {
  it('retains all 84 unique cases, original deadlines and one real fixture lifecycle per suite', () => {
    assertComplete(inventory());
  });

  it('rejects an omitted Cartesian family instead of treating the remaining cases as complete', () => {
    const changed = new Map(sources);
    const file = SEARCH_BROWSER_SUITES[0];
    const before = changed.get(file)!;
    const after = before.replace(
      "for (const family of ['shadcn', 'brutalist'] as const)",
      "for (const family of ['shadcn'] as const)"
    );
    expect(after).not.toBe(before);
    changed.set(file, after);
    expect(() => assertComplete(inventory(SEARCH_BROWSER_SUITES, changed))).toThrow();
  });

  it('rejects a duplicated suite registration', () => {
    expect(() =>
      assertComplete(inventory([...SEARCH_BROWSER_SUITES, SEARCH_BROWSER_SUITES[0]]))
    ).toThrow();
  });

  it('rejects a changed case deadline', () => {
    const changed = new Map(sources);
    const file = SEARCH_BROWSER_SUITES[0];
    const before = changed.get(file)!;
    const after = before.replace('}, 60_000);', '}, 60_001);');
    expect(after).not.toBe(before);
    changed.set(file, after);
    expect(() => assertComplete(inventory(SEARCH_BROWSER_SUITES, changed))).toThrow();
  });

  it('rejects a skipped case before accepting an inventory', () => {
    const changed = new Map(sources);
    const file = SEARCH_BROWSER_SUITES[0];
    const before = changed.get(file)!;
    const after = before.replace('it(`', 'it.skip(`');
    expect(after).not.toBe(before);
    changed.set(file, after);
    expect(() => inventory(SEARCH_BROWSER_SUITES, changed)).toThrow('cannot skip');
  });
});
