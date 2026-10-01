/**
 * Emits the token-to-declaration fixture that keeps the Rust style compiler
 * honest against the TypeScript one.
 *
 * The fixture is produced by *running* `renderProtoStyleTokenCss`, the same
 * function the CLI uses to emit the website stylesheet, rather than by
 * re-reading its tables. A table transcription can drift silently; a recorded
 * result of the real compiler cannot.
 *
 * Only un-varianted tokens are recorded. State variants (`data-[hovered]:`,
 * `dark:`, ...) are a Web lowering performed by `rule-expose-state-web`; a
 * host without CSS selectors never receives them, because its Rules stay on
 * the default plan and evaluate to a flat token list.
 *
 * Scope is the Prototype token set only. Website demo `className`s are a
 * different system: they go through the site's real Tailwind, and this
 * compiler does not implement them (`sr-only`, for one, produces nothing
 * here). They are out of scope for the native lane, which has no demos, and
 * in the browser lane the demo wrapper nodes stay ordinary DOM.
 *
 *   pnpm gpui:style-fixture            # write
 *   pnpm check:gpui-style-fixture      # verify it is current
 *
 * `--fixture <path>` targets a different file, which lets a test prove that a
 * stale fixture actually fails the check instead of asserting that it would.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  renderPrefixedThemeCss,
  renderProtoStyleTokenCss,
} from '../../packages/cli/src/services/proto-style-css';
import { BRUTALIST_THEME_CSS } from '../../packages/cli/src/generated/brutalist-theme';
import { SHADCN_THEME_CSS } from '../../packages/cli/src/legacy/type';
import { BRUTALIST_STYLE_TOKENS } from '../../packages/cli/src/generated/brutalist-style-tokens';
import { SHADCN_STYLE_TOKENS } from '../../packages/cli/src/generated/shadcn-style-tokens';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'native/gpui/fixtures/style-tokens.json');
const THEME_OUT = path.join(ROOT, 'native/gpui/fixtures/theme-tokens.json');

/** Base prototypes carry only structural tokens; they are collected from source. */
function collectBaseTokens(): string[] {
  const dir = path.join(ROOT, 'packages/prototypes/base/src');
  const tokens = new Set<string>();
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.ts') || entry.name.includes('.test.')) continue;
      const source = readFileSync(full, 'utf8');
      for (const match of source.matchAll(/\btw\(\s*('([^']*)'|"([^"]*)")/g)) {
        const literal = match[2] ?? match[3] ?? '';
        for (const token of literal.split(/\s+/).filter(Boolean)) tokens.add(token);
      }
    }
  };
  walk(dir);
  return [...tokens];
}

/** A token that carries a `:` variant is a Web lowering and is out of scope. */
function isUnvarianted(token: string): boolean {
  let depth = 0;
  for (const character of token) {
    if (character === '[') depth += 1;
    else if (character === ']') depth -= 1;
    else if (character === ':' && depth === 0) return false;
  }
  return true;
}

type TokenRule = { token: string; declarations: Record<string, string> };

/**
 * Extracts the `:where([data-pui-style~="<token>"]) { ... }` rule for each
 * token. The preamble the compiler always emits (box-sizing, the custom
 * property reset, native control normalization) is deliberately not recorded:
 * a host without CSS inheritance needs none of it, and recording it would make
 * every token's fixture entry identical noise.
 */
function extractRules(css: string, tokens: string[]): { rules: TokenRule[]; order: string[] } {
  const wanted = new Map(tokens.map((token) => [token, [] as string[]]));
  const order: string[] = [];
  const rulePattern = /:where\(\[data-pui-style~="((?:[^"\\]|\\.)*)"\]\)\s*\{([^}]*)\}/g;
  for (const match of css.matchAll(rulePattern)) {
    const token = match[1]!.replace(/\\(.)/g, '$1');
    const body = match[2]!;
    if (!wanted.has(token)) continue;
    // Emission order is cascade order. The compiler stable-sorts its rules so
    // that `duration-*`, `ease-*`, `delay-*` and `leading-*` land after the
    // composite utilities they override, which is how an explicit
    // `leading-none` beats the line-height inside `text-sm` regardless of the
    // order an author wrote them in. Recording the order carries that
    // precedence without restating the rule.
    if (!order.includes(token)) order.push(token);
    wanted.get(token)!.push(body);
  }

  const rules: TokenRule[] = [];
  for (const token of tokens) {
    const bodies = wanted.get(token) ?? [];
    const declarations: Record<string, string> = {};
    for (const body of bodies) {
      for (const entry of body.split(';')) {
        const index = entry.indexOf(':');
        if (index < 0) continue;
        const property = entry.slice(0, index).trim();
        const value = entry.slice(index + 1).trim();
        if (property && value) declarations[property] = value;
      }
    }
    rules.push({ token, declarations });
  }
  return { rules, order };
}

/**
 * Splits one prefixed theme stylesheet into a complete variable map per mode.
 *
 * Only two blocks are read: `:root` is the light mode, and the explicit dark
 * selector overrides it. The `@media (prefers-color-scheme: dark)` block the
 * compiler also emits carries the same values behind a system-preference
 * fallback, so recording it would duplicate the dark map; a host resolves the
 * mode itself through `RULE_META_GET_CAP('colorScheme')`.
 *
 * Declarations are recorded verbatim, including `lab(...)` colours and
 * `calc()`/`max()` expressions. Converting them here would put colour-space
 * and arithmetic logic in this generator, where it is not Proto UI semantics;
 * a consumer resolves them with ordinary, well-specified rules.
 */
function extractTheme(css: string): {
  light: Record<string, string>;
  dark: Record<string, string>;
} {
  const blocks = new Map<string, string>();
  const blockPattern = /([^{}]+)\{([^{}]*)\}/g;
  for (const match of css.matchAll(blockPattern)) {
    const selector = match[1]!.trim().replace(/\s+/g, ' ');
    blocks.set(selector, (blocks.get(selector) ?? '') + match[2]!);
  }

  const read = (selector: string): Record<string, string> => {
    const declarations: Record<string, string> = {};
    for (const entry of (blocks.get(selector) ?? '').split(';')) {
      const index = entry.indexOf(':');
      if (index < 0) continue;
      const property = entry.slice(0, index).trim();
      const value = entry.slice(index + 1).trim();
      // Later wins: a theme may redefine a ramp value, as Brutalist does for
      // `--pui-radius-sm`.
      if (property.startsWith('--')) declarations[property] = value;
    }
    return declarations;
  };

  const light = read(':root');
  const dark = { ...light, ...read(":root.dark, :root[data-theme='dark']") };
  return { light, dark };
}

function fixturePath(argv: readonly string[]): string {
  const index = argv.indexOf('--fixture');
  if (index < 0) return OUT;
  const value = argv[index + 1];
  if (!value) throw new Error('[gpui:style-fixture] --fixture needs a path');
  return path.resolve(value);
}

function themePath(argv: readonly string[]): string {
  const index = argv.indexOf('--theme-fixture');
  if (index < 0) return THEME_OUT;
  const value = argv[index + 1];
  if (!value) throw new Error('[gpui:style-fixture] --theme-fixture needs a path');
  return path.resolve(value);
}

function buildThemeFixture(): string {
  const themes = {
    shadcn: extractTheme(renderPrefixedThemeCss(SHADCN_THEME_CSS)),
    brutalist: extractTheme(renderPrefixedThemeCss(BRUTALIST_THEME_CSS)),
  };
  const fixture = {
    note: 'Generated by scripts/gpui/generate-style-fixture.mts from the TypeScript compiler. Do not edit by hand.',
    sources: {
      shadcn: 'packages/cli/src/legacy/type.ts (SHADCN_THEME_CSS)',
      brutalist: 'packages/cli/src/generated/brutalist-theme.ts (BRUTALIST_THEME_CSS)',
      renderer: 'packages/cli/src/services/proto-style-css.ts (renderPrefixedThemeCss)',
    },
    counts: Object.fromEntries(
      Object.entries(themes).map(([name, modes]) => [
        name,
        { light: Object.keys(modes.light).length, dark: Object.keys(modes.dark).length },
      ])
    ),
    themes,
  };
  return `${JSON.stringify(fixture, null, 2)}\n`;
}

function compare(label: string, target: string, serialized: string): boolean {
  let current: string;
  try {
    current = readFileSync(target, 'utf8');
  } catch {
    console.error(
      `[gpui:style-fixture] missing ${path.relative(ROOT, target)}; run pnpm gpui:style-fixture`
    );
    return false;
  }
  if (current !== serialized) {
    console.error(
      `[gpui:style-fixture] ${path.relative(ROOT, target)} is stale; run pnpm gpui:style-fixture`
    );
    return false;
  }
  console.log(`[gpui:style-fixture] ${label} current`);
  return true;
}

export function main(argv: readonly string[] = process.argv.slice(2)): void {
  const check = argv.includes('--check');
  const out = fixturePath(argv);

  const union = new Set<string>([
    ...collectBaseTokens(),
    ...SHADCN_STYLE_TOKENS,
    ...BRUTALIST_STYLE_TOKENS,
  ]);
  const tokens = [...union].filter(isUnvarianted).sort();
  const css = renderProtoStyleTokenCss(tokens);
  const { rules, order } = extractRules(css, tokens);

  const compiled = rules.filter((rule) => Object.keys(rule.declarations).length > 0);
  const marker = rules.filter((rule) => Object.keys(rule.declarations).length === 0);

  const fixture = {
    note: 'Generated by scripts/gpui/generate-style-fixture.mts from the TypeScript compiler. Do not edit by hand.',
    source: 'packages/cli/src/services/proto-style-css.ts',
    counts: {
      tokens: tokens.length,
      compiled: compiled.length,
      noDeclarations: marker.length,
    },
    /** Tokens the compiler resolves to declarations. */
    tokens: Object.fromEntries(compiled.map((rule) => [rule.token, rule.declarations])),
    /**
     * Tokens in the order the compiler emits their rules, which is the order
     * the cascade applies them in. A consumer composing several tokens must
     * follow this rather than the order they arrived in, or an explicit
     * override utility loses to the composite it is meant to beat.
     */
    order,
    /**
     * Tokens from the Prototype set that this compiler emits nothing for.
     * `peer` and `group/*` are deliberate: they exist only so the site's real
     * Tailwind can target them, and a host without selectors ignores them.
     *
     * The compiler cannot distinguish a deliberate marker from a token it has
     * never heard of, so a consumer must treat this as an explicit allowlist
     * and reject any *other* token that resolves to nothing, rather than
     * silently rendering it unstyled.
     */
    noDeclarations: marker.map((rule) => rule.token),
  };

  const serialized = `${JSON.stringify(fixture, null, 2)}\n`;
  const digest = createHash('sha256').update(serialized).digest('hex').slice(0, 12);
  const themeSerialized = buildThemeFixture();
  const theme = themePath(argv);

  if (check) {
    const tokensOk = compare(
      `${fixture.counts.compiled} compiled, ${fixture.counts.noDeclarations} without declarations (sha256:${digest})`,
      out,
      serialized
    );
    const themeOk = compare('themes', theme, themeSerialized);
    if (!tokensOk || !themeOk) process.exitCode = 1;
    return;
  }

  writeFileSync(out, serialized);
  writeFileSync(theme, themeSerialized);
  console.log(
    `[gpui:style-fixture] wrote ${path.relative(ROOT, out)}: ${fixture.counts.compiled} compiled, ${fixture.counts.noDeclarations} without declarations (sha256:${digest})`
  );
  console.log(`[gpui:style-fixture] wrote ${path.relative(ROOT, theme)}`);
}

// Only run when executed directly; a test imports `main` instead.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
