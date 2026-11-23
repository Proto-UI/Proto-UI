// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DIAGNOSTIC_REGISTRY,
  diagnosticCategory,
  diagnosticCategories,
  isDiagnosticCode,
} from '../src/diagnostic-registry';

const SRC = path.resolve(__dirname, '../src');

/**
 * PUI literals that are not diagnostic codes and must never be registered.
 * `PUI_CONTEXT_KEY_` is a Rust binding prefix emitted into GPUI source;
 * `PUI_WC_HYDRATION_MISMATCH` is a runtime error-class code inside the
 * generated WC SSR support class (never constructed as a CompilerDiagnostic).
 * The word-boundary extraction already excludes `GPUI_`-prefixed constant
 * names and `__PUI_SSR_ARTIFACT_BINDING__` (their P is preceded by a word char).
 */
const NON_DIAGNOSTIC_PUI_LITERALS = new Set(['PUI_CONTEXT_KEY_', 'PUI_WC_HYDRATION_MISMATCH']);

/** Diagnostic categories declared on CompilerDiagnostic (ir.ts). */
const CATEGORIES = [
  'invalid-input',
  'unsupported-input',
  'invalid-ir',
  'compiler-defect',
  'output-conflict',
  'output-write',
] as const;
const CATEGORY_LITERAL = new RegExp(`'(${CATEGORIES.join('|')})'`, 'g');

const CODE = /(?<![A-Za-z0-9_])PUI(?:[0-9]{4}|_[A-Z][A-Z0-9_]*)/g;

/**
 * Category resolution for call-site scanning.
 *
 * `reject(code,message,span,category?)` defaults to 'unsupported-input'
 * (diagnostics.ts:11); `rejectNode(node,code,message)` wraps reject and has NO
 * category parameter (source-syntax.ts:113). `libraryRejection(code,message,
 * file?,category?)` defaults to 'invalid-input' (artifact-library.ts:82).
 * `diagnostic` has two unrelated overloads: targets.ts:690 fixes
 * 'unsupported-input' (3-arg) and watch.ts:74 takes an explicit category
 * (3-arg). `cliDiagnostic(code,category,…)` requires an explicit category
 * (cli.ts:259). `unsupported(code,…)` fixes 'unsupported-input' (targets.ts:562).
 *
 * Argument windows are bounded by the next emitter call or newline so that
 * parentheses inside argument expressions (e.g. `sourceSpan(node)`) do not
 * truncate the window the way a `[^)]` character class does.
 */
/**
 * Window bound for call-argument scanning: the next emitter call or
 * object-literal token, so the scan stops before another emission's
 * `category: 'x'` can be misattributed. A call whose first line already
 * contains `)` is treated as single-line and cut at the newline (its category
 * argument must precede the close paren); multi-line calls get a bounded
 * window. Parentheses inside argument expressions (`sourceSpan(node)`) no
 * longer truncate the window the way a `[^)]` class did.
 */
const WINDOW_BOUNDARY =
  /\breject\(|\brejectNode\(|\bdiagnostic\(|\bcliDiagnostic\(|\blibraryRejection\(|\bunsupported\(|\bcode\s*:|\bcategory\s*:/g;
const WINDOW_MAX = 800;

/** First PUI code literal inside the call's argument window, if literal. */
const ARG_CODE = /'(?<code>PUI\d{4}|PUI_[A-Z0-9_]+)'/;
const ARG_CODE_ALL = /'(?<code>PUI\d{4}|PUI_[A-Z0-9_]+)'/g;

function* callSites(text: string, name: string): Generator<string> {
  const re = new RegExp(`\\b${name}\\(\\s*`, 'g');
  for (const match of text.matchAll(re)) {
    const start = match.index + match[0].length;
    WINDOW_BOUNDARY.lastIndex = start;
    const next = WINDOW_BOUNDARY.exec(text);
    let end = Math.min(start + WINDOW_MAX, next ? next.index : text.length);
    const newline = text.indexOf('\n', start);
    if (newline !== -1 && newline < end && text.slice(start, newline).includes(')')) end = newline;
    yield text.slice(start, end);
  }
}

/** Last category literal in the window, else the fallback. */
function windowCategory(args: string, fallback: string): string {
  const matches = [...args.matchAll(CATEGORY_LITERAL)];
  return matches.length ? matches[matches.length - 1][1] : fallback;
}

/**
 * Dynamic `code:` object sites whose emitted category is resolvable only
 * against their declared union/flow. Keyed by `file|first-code|second-code`;
 * a new dynamic site not listed here fails the structural guard below so the
 * map is extended instead of silently unobserved.
 */
const DYNAMIC_CODE_SITES: ReadonlyMap<string, readonly string[]> = new Map([
  // artifact-output.ts:570 — primary.category:'output-conflict'|'output-write';
  // the PUI3003 arm is exactly the non-conflict member of that union.
  ['artifact-output.ts|PUI3002|PUI3003', ['output-conflict', 'output-write']],
  // project-output.ts:44 — local category:'invalid-input'|'output-conflict';
  // the PUI3004 arm is the non-conflict member.
  ['project-output.ts|PUI3002|PUI3004', ['output-conflict', 'invalid-input']],
  // style-plan.ts:98 — both arms are literal categories in the same literal.
  ['style-plan.ts|PUI4202|PUI4201', ['unsupported-input', 'invalid-ir']],
]);

/**
 * Structural probe for `code: … ? 'PUInnnn' : 'PUInnnn'` sites. The condition
 * may itself contain quoted literals (e.g. `primary.category ===
 * 'output-conflict'`), so the pre-`?` span excludes only `;` and newline —
 * code values never contain a literal `?` in this codebase.
 */
const DYNAMIC_CODE_PROBE =
  /code\s*:\s*[^;\n]*\?\s*'(PUI\d{4}|PUI_[A-Z0-9_]+)'\s*:\s*'(PUI\d{4}|PUI_[A-Z0-9_]+)'/g;

function* sources(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) yield* sources(full);
    else if (full.endsWith('.ts') && !full.endsWith('.test.ts')) yield full;
  }
}

function* sourceTexts(): Generator<{ file: string; text: string }> {
  for (const file of sources(SRC)) yield { file, text: readFileSync(file, 'utf8') };
}

function observedCategories(
  inputs: Iterable<{ file: string; text: string }> = sourceTexts()
): Map<string, Set<string>> {
  const observed = new Map<string, Set<string>>();
  const note = (code: string, category: string) => {
    const set = observed.get(code) ?? new Set<string>();
    set.add(category);
    observed.set(code, set);
  };
  for (const { file, text } of inputs) {
    const filename = path.basename(file);

    // reject/rejectNode/diagnostic: first PUI literal in the window is the
    // code; the last category literal is the category (falls back to the
    // documented default). rejectNode never takes a category.
    for (const args of callSites(text, 'reject'))
      for (const m of args.matchAll(ARG_CODE_ALL))
        note(m.groups!.code, windowCategory(args, 'unsupported-input'));
    for (const args of callSites(text, 'rejectNode'))
      for (const m of args.matchAll(ARG_CODE_ALL)) note(m.groups!.code, 'unsupported-input');
    for (const args of callSites(text, 'diagnostic'))
      for (const m of args.matchAll(ARG_CODE_ALL))
        note(m.groups!.code, windowCategory(args, 'unsupported-input'));
    for (const args of callSites(text, 'cliDiagnostic')) {
      const code = ARG_CODE.exec(args)?.groups?.code;
      if (code) {
        const matches = [...args.matchAll(CATEGORY_LITERAL)];
        note(code, matches.length ? matches[matches.length - 1][1] : 'unresolved');
      }
    }
    for (const args of callSites(text, 'libraryRejection'))
      for (const m of args.matchAll(ARG_CODE_ALL))
        note(m.groups!.code, windowCategory(args, 'invalid-input'));
    for (const args of callSites(text, 'unsupported'))
      for (const m of args.matchAll(ARG_CODE_ALL)) note(m.groups!.code, 'unsupported-input');

    // Object literals: `code: 'PUInnnn', category: 'x'` in either order.
    for (const m of text.matchAll(
      /code\s*:\s*'(?<code>PUI\d{4}|PUI_[A-Z0-9_]+)'(?:\s+as\s+const)?\s*,\s*category\s*:\s*'(?<cat>[a-z-]+)'/g
    ))
      note(m.groups!.code, m.groups!.cat);
    for (const m of text.matchAll(
      /category\s*:\s*'(?<cat>[a-z-]+)'(?:\s+as\s+const)?\s*,\s*code\s*:\s*'(?<code>PUI\d{4}|PUI_[A-Z0-9_]+)'/g
    ))
      note(m.groups!.code, m.groups!.cat);

    // Dynamic `code: … ? 'A' : 'B'` sites: each pair must already be mapped.
    for (const m of text.matchAll(DYNAMIC_CODE_PROBE)) {
      const key = `${filename}|${m[1]}|${m[2]}`;
      const categories = DYNAMIC_CODE_SITES.get(key);
      if (!categories)
        throw new Error(`unmapped dynamic code site: ${key} — extend DYNAMIC_CODE_SITES`);
      note(m[1], categories[0]);
      note(m[2], categories[1]);
    }
  }
  return observed;
}

function categoryMismatches(observed: Map<string, Set<string>>): string[] {
  const mismatches: string[] = [];
  for (const [code, categories] of observed) {
    if (NON_DIAGNOSTIC_PUI_LITERALS.has(code)) continue;
    if (!isDiagnosticCode(code)) {
      mismatches.push(`${code} observed (${[...categories].join('/')}) but not registered`);
      continue;
    }
    const allowed = diagnosticCategories(code);
    for (const category of categories)
      if (!allowed.some((registered) => registered === category))
        mismatches.push(
          `${code} observed unregistered category ${category}; allowed ${allowed.join('/')}`
        );
  }
  return mismatches;
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
    expect(categoryMismatches(observedCategories())).toEqual([]);
  });

  it('observes the actual public file boundary as-const diagnostics', () => {
    const file = path.join(SRC, 'compile.ts');
    const observed = observedCategories([{ file, text: readFileSync(file, 'utf8') }]);
    expect(observed.get('PUI1003')).toEqual(new Set(['invalid-input']));
    expect(observed.get('PUI1999')).toEqual(new Set(['compiler-defect']));
    expect(categoryMismatches(observed)).toEqual([]);
  });

  it.each(['literal', 'as-const', 'category-first', 'category-first-as-const'])(
    'rejects an added wrong category beside a correct emission: %s',
    (shape) => {
      const suffix = shape.includes('as-const') ? ' as const' : '';
      const site = (category: string) =>
        shape.startsWith('category-first')
          ? `{ category: '${category}'${suffix}, code: 'PUI1999'${suffix} }`
          : `{ code: 'PUI1999'${suffix}, category: '${category}'${suffix} }`;
      // Keep the real allowed category present. Merely finding one correct
      // emission must not hide an additional invalid-input emission.
      const observed = observedCategories([
        {
          file: 'mixed-category-control.ts',
          text: `${site('compiler-defect')};\n${site('invalid-input')};`,
        },
      ]);
      expect(observed.get('PUI1999')).toEqual(new Set(['compiler-defect', 'invalid-input']));
      expect(categoryMismatches(observed)).toEqual([expect.stringContaining('invalid-input')]);
    }
  );

  it('rejects a third wrong category while retaining both legitimate PUI1003 emissions', () => {
    const observed = observedCategories([
      {
        file: 'mixed-boundary-control.ts',
        text: `reject('PUI1003', 'known file failure', span, 'invalid-input');
rejectNode(node, 'PUI1003', 'unsupported import');
reject('PUI1003', 'wrongly classified defect', span, 'compiler-defect');`,
      },
    ]);
    expect(observed.get('PUI1003')).toEqual(
      new Set(['invalid-input', 'compiler-defect', 'unsupported-input'])
    );
    expect(categoryMismatches(observed)).toEqual([expect.stringContaining('compiler-defect')]);
  });

  it('keeps a stable registered code set and category table', () => {
    const table = Object.keys(DIAGNOSTIC_REGISTRY)
      .sort()
      .map((code) => `${code}:${DIAGNOSTIC_REGISTRY[code].category}`);
    expect(table).toMatchSnapshot();
  });

  it('keeps stable complete allowed categories and meanings', () => {
    const table = Object.keys(DIAGNOSTIC_REGISTRY)
      .sort()
      .map((code) => {
        const categories = diagnosticCategories(code);
        expect(new Set(categories).size, `${code} repeats a category`).toBe(categories.length);
        expect(categories[0], `${code} changed its primary lookup`).toBe(diagnosticCategory(code));
        return `${code}:${categories.join('/')} — ${DIAGNOSTIC_REGISTRY[code].meaning}`;
      });
    expect(table).toMatchSnapshot();
  });

  it('accepts each registered meaning-specific category without requiring its primary beside it', () => {
    for (const code of Object.keys(DIAGNOSTIC_REGISTRY)) {
      for (const category of diagnosticCategories(code)) {
        const observed = observedCategories([
          {
            file: 'single-meaning-control.ts',
            text: `{ code: '${code}', category: '${category}' }`,
          },
        ]);
        expect(categoryMismatches(observed), `${code}/${category}`).toEqual([]);
      }
    }
    expect(diagnosticCategories('PUI_UNREGISTERED_CONTROL')).toEqual([]);
    expect(diagnosticCategories('toString')).toEqual([]);
  });

  it('declares a non-empty meaning for every registered code', () => {
    const empty = Object.entries(DIAGNOSTIC_REGISTRY)
      .filter(([, { meaning }]) => typeof meaning !== 'string' || meaning.length < 8)
      .map(([code]) => code);
    expect(empty).toEqual([]);
  });
});
