// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DIAGNOSTIC_REGISTRY,
  diagnosticCategory,
  isDiagnosticCode,
} from '../src/diagnostic-registry';

const SRC = path.resolve(__dirname, '../src');

/**
 * PUI literals that are not diagnostic codes and must never be registered.
 * `PUI_CONTEXT_KEY_` is a Rust binding prefix emitted into GPUI source;
 * `PUI_SSR_ARTIFACT_BINDING_` is a generated WC hydration marker. The
 * word-boundary extraction already excludes `GPUI_`-prefixed constant names
 * and `__PUI_SSR_ARTIFACT_BINDING__` (their P is preceded by a word char).
 */
const NON_DIAGNOSTIC_PUI_LITERALS = new Set(['PUI_CONTEXT_KEY_']);

const CODE = /(?<![A-Za-z0-9_])PUI(?:[0-9]{4}|_[A-Z][A-Z0-9_]*)/g;

// Category constructors as actually emitted. `reject(code,…)` and
// `rejectNode(node,code,…)` default to 'unsupported-input' (diagnostics.ts:15)
// but accept an explicit trailing category ('invalid-ir' etc.); `unsupported`
// (targets.ts:562) emits 'unsupported-input'; `libraryRejection` defaults
// 'invalid-input'; object literals carry `category: 'x'`; `diagnostic`
// (watch.ts:74, targets.ts:690) emits an explicit or fixed category.
const EMITTERS: Array<{ re: RegExp; category: string }> = [
  {
    re: /\breject\(\s*'(?<code>PUI\d{4}|PUI_[A-Z0-9_]+)'\s*,[^)]*?,\s*'(?<cat>[a-z-]+)'\s*\)/g,
    category: '$cat',
  },
  { re: /\breject\(\s*'(?<code>PUI\d{4}|PUI_[A-Z0-9_]+)'/g, category: 'unsupported-input' },
  {
    re: /\brejectNode\([^,]+,\s*'(?<code>PUI\d{4}|PUI_[A-Z0-9_]+)'\s*,[^)]*?,\s*'(?<cat>[a-z-]+)'\s*\)/g,
    category: '$cat',
  },
  { re: /\brejectNode\([^,]+,\s*'(?<code>PUI\d{4}|PUI_[A-Z0-9_]+)'/g, category: 'unsupported-input' },
  { re: /\bunsupported\(\s*'(?<code>PUI\d{4}|PUI_[A-Z0-9_]+)'/g, category: 'unsupported-input' },
  { re: /\blibraryRejection\(\s*'(?<code>PUI\d{4}|PUI_[A-Z0-9_]+)'/g, category: 'invalid-input' },
  { re: /\bcliDiagnostic\(\s*'(?<code>PUI\d{4}|PUI_[A-Z0-9_]+)'\s*,\s*'(?<cat>[a-z-]+)'/g, category: '$cat' },
  {
    re: /code\s*:\s*'(?<code>PUI\d{4}|PUI_[A-Z0-9_]+)'\s*,\s*category\s*:\s*'(?<cat>[a-z-]+)'/g,
    category: '$cat',
  },
  {
    re: /category\s*:\s*'(?<cat>[a-z-]+)'\s*,\s*code\s*:\s*'(?<code>PUI\d{4}|PUI_[A-Z0-9_]+)'/g,
    category: '$cat',
  },
  {
    // targets.ts diagnostic(code,message,span) always emits unsupported-input.
    re: /\bdiagnostic\(\s*'(?<code>PUI\d{4}|PUI_[A-Z0-9_]+)'/g,
    category: 'unsupported-input',
  },
  {
    // watch.ts diagnostic(code,message,category) — explicit trailing category.
    re: /\bdiagnostic\(\s*'(?<code>PUI\d{4}|PUI_[A-Z0-9_]+)'\s*,[^)]*?,\s*'(?<cat>[a-z-]+)'\s*\)/g,
    category: '$cat',
  },
];

function* sources(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) yield* sources(full);
    else if (full.endsWith('.ts') && !full.endsWith('.test.ts')) yield full;
  }
}

function observedCategories(): Map<string, Set<string>> {
  const observed = new Map<string, Set<string>>();
  const note = (code: string, category: string) => {
    const set = observed.get(code) ?? new Set<string>();
    set.add(category);
    observed.set(code, set);
  };
  for (const file of sources(SRC)) {
    const text = readFileSync(file, 'utf8');
    for (const { re, category } of EMITTERS) {
      for (const match of text.matchAll(re)) {
        const code = match.groups?.code;
        if (!code) continue;
        note(code, category === '$cat' ? match.groups!.cat! : category);
      }
    }
  }
  return observed;
}

function literalCodes(): Set<string> {
  const codes = new Set<string>();
  for (const file of sources(SRC)) {
    if (file.endsWith('diagnostic-registry.ts')) continue;
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(CODE)) {
      const code = match[0];
      if (!NON_DIAGNOSTIC_PUI_LITERALS.has(code)) codes.add(code);
    }
  }
  return codes;
}

describe('diagnostic registry', () => {
  it('registers every diagnostic code emitted in source', () => {
    const unregistered = [...literalCodes()].filter((code) => !isDiagnosticCode(code));
    expect(unregistered).toEqual([]);
  });

  it('does not register generated-source placeholders', () => {
    for (const placeholder of NON_DIAGNOSTIC_PUI_LITERALS)
      expect(isDiagnosticCode(placeholder), `${placeholder} must not be a diagnostic`).toBe(false);
  });

  it('agrees with every observed call-site category', () => {
    const observed = observedCategories();
    const mismatches: string[] = [];
    for (const [code, categories] of observed) {
      if (NON_DIAGNOSTIC_PUI_LITERALS.has(code)) continue;
      if (!isDiagnosticCode(code)) {
        mismatches.push(`${code} observed (${[...categories].join('/')}) but not registered`);
        continue;
      }
      const registered = diagnosticCategory(code)!;
      if (!categories.has(registered))
        mismatches.push(
          `${code} registered as ${registered} but observed ${[...categories].join('/')}`
        );
    }
    expect(mismatches).toEqual([]);
  });

  it('keeps a stable registered code set and category table', () => {
    const table = Object.keys(DIAGNOSTIC_REGISTRY)
      .sort()
      .map((code) => `${code}:${DIAGNOSTIC_REGISTRY[code].category}`);
    expect(table).toMatchSnapshot();
  });

  it('declares a non-empty meaning for every registered code', () => {
    const empty = Object.entries(DIAGNOSTIC_REGISTRY)
      .filter(([, { meaning }]) => typeof meaning !== 'string' || meaning.length < 8)
      .map(([code]) => code);
    expect(empty).toEqual([]);
  });
});
