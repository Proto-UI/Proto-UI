import type { EffectsPort, StyleHandle } from '@proto.ui/core';
import {
  mergeRootStyleEntries,
  readRootStyleEntries,
  resolveRootStyleEntry,
  type RootStyleEntry,
} from '@proto.ui/core/internal';
import { createOwnedTwTokenApplier } from './feedback-style';
import { stripShadowCssComments, type ShadowStyleArtifactV1 } from './shadow-style-artifact';

export const SHADOW_SPLIT_ROOT_STYLE_ATTR = 'data-pui-split-root-style';
export const SHADOW_SPLIT_SURFACE_ATTR = 'data-pui-split-surface';
const activeBindings = new WeakSet<HTMLElement>();
const COMPOSITES = new Set(['block', 'flex', 'grid', 'inline-flex']);
const NATIVE_TEXT_ATTR = 'data-pui-split-text-control';
const SPLIT_COMPILED_RECEIPT = '--pui-split-compiled-receipt';

type Projection = { root: string; surface: string[]; borderWidths: string };
type CompiledStyleRule = { selector: string; declarations: string };

function splitCompiledReceipt(selector: string, declarations: string): string {
  const input = `${selector.replace(/\s/g, '')}{${declarations.replace(/\s/g, '')}}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(hash ^ input.charCodeAt(index), 16777619);
  }
  return (hash >>> 0).toString(36);
}

// The v1 artifact is a plain value, so this is an integrity receipt for the
// generated companion rather than authentication of adversarial CSS.
function hasValidDeclarationReceipt(rule: CompiledStyleRule): boolean {
  const marker = new RegExp(
    `(?:^|;)\\s*${SPLIT_COMPILED_RECEIPT}\\s*:\\s*([a-z0-9]+)\\s*;\\s*$`
  ).exec(rule.declarations);
  if (!marker || marker.index === undefined) return false;
  const declarations = rule.declarations.slice(
    0,
    marker.index + (marker[0]!.startsWith(';') ? 1 : 0)
  );
  return (
    !declarations.includes(SPLIT_COMPILED_RECEIPT) &&
    marker[1] === splitCompiledReceipt(rule.selector, declarations)
  );
}

function declarationsBeforeReceipt(rule: CompiledStyleRule): string | null {
  const marker = new RegExp(
    `(?:^|;)\\s*${SPLIT_COMPILED_RECEIPT}\\s*:\\s*[a-z0-9]+\\s*;\\s*$`
  ).exec(rule.declarations);
  if (!marker || marker.index === undefined) return null;
  return rule.declarations
    .slice(0, marker.index + (marker[0]!.startsWith(';') ? 1 : 0))
    .replace(/\s/g, '');
}

// Canonical host-sizing recipes are Adapter trust anchors rather than values
// supplied by the plain artifact. Keep this bounded list explicit: accepting a
// new generated sizing spelling requires an Adapter update and parity evidence.
function hasCanonicalSizingRecipe(rule: CompiledStyleRule, entry: RootStyleEntry): boolean {
  const expected =
    entry.authorToken === 'w-full'
      ? 'width:100%;'
      : entry.authorToken === 'min-h-16'
        ? 'min-height:4rem;'
        : null;
  if (!expected) return true;
  return declarationsBeforeReceipt(rule) === expected;
}

function nextCssBoundary(
  cssText: string,
  start: number
): { index: number; character: '{' | ';' } | null {
  let quote = '';
  let parenDepth = 0;
  let bracketDepth = 0;
  for (let index = start; index < cssText.length; index += 1) {
    const character = cssText[index]!;
    if (character === '\\') {
      index += 1;
      continue;
    }
    if (quote) {
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '(') parenDepth += 1;
    else if (character === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (character === '[') bracketDepth += 1;
    else if (character === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    else if (!parenDepth && !bracketDepth && (character === '{' || character === ';')) {
      return { index, character };
    }
  }
  return null;
}

function cssBlockEnd(cssText: string, open: number): number {
  let depth = 1;
  let quote = '';
  for (let index = open + 1; index < cssText.length; index += 1) {
    const character = cssText[index]!;
    if (character === '\\') {
      index += 1;
      continue;
    }
    if (quote) {
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '{') depth += 1;
    else if (character === '}' && --depth === 0) return index;
  }
  return -1;
}

function directCssDeclarations(cssText: string): string {
  let cursor = 0;
  let declarations = '';
  while (cursor < cssText.length) {
    const boundary = nextCssBoundary(cssText, cursor);
    if (!boundary) return declarations + cssText.slice(cursor);
    if (boundary.character === ';') {
      declarations += cssText.slice(cursor, boundary.index + 1);
      cursor = boundary.index + 1;
      continue;
    }
    const close = cssBlockEnd(cssText, boundary.index);
    if (close < 0) return declarations;
    cursor = close + 1;
  }
  return declarations;
}

function collectUnconditionallyAvailableRules(cssText: string): CompiledStyleRule[] {
  const rules: CompiledStyleRule[] = [];
  let cursor = 0;
  while (cursor < cssText.length) {
    const boundary = nextCssBoundary(cssText, cursor);
    if (!boundary) break;
    if (boundary.character === ';') {
      cursor = boundary.index + 1;
      continue;
    }
    const close = cssBlockEnd(cssText, boundary.index);
    if (close < 0) break;
    const prelude = cssText.slice(cursor, boundary.index).trim();
    const body = cssText.slice(boundary.index + 1, close);
    // A layer-name list is valid only in statement form. Recursing into an
    // invalid list-form block would treat rules the browser discards as usable
    // preflight evidence. Generated companions use one simple named layer;
    // anonymous blocks are accepted as well.
    if (/^@layer(?:\s+[-_a-zA-Z][-_a-zA-Z0-9]*(?:\.[-_a-zA-Z][-_a-zA-Z0-9]*)*)?$/i.test(prelude)) {
      rules.push(...collectUnconditionallyAvailableRules(body));
    } else if (prelude && !prelude.startsWith('@')) {
      rules.push({ selector: prelude, declarations: directCssDeclarations(body) });
    }
    cursor = close + 1;
  }
  return rules;
}

function verifiedShadowSplitBaseRule(artifact: ShadowStyleArtifactV1): CompiledStyleRule | null {
  const rules = collectUnconditionallyAvailableRules(stripShadowCssComments(artifact.cssText));
  const baseSelector = `:host([${SHADOW_SPLIT_ROOT_STYLE_ATTR}])`;
  const baseRule = rules.find(({ selector }) => selector.replace(/\s/g, '') === baseSelector);
  return baseRule && hasValidDeclarationReceipt(baseRule) ? baseRule : null;
}

/** Private registration preflight shared with the connection-time effects owner. */
export function hasVerifiedShadowSplitBaseRecipe(
  artifact: ShadowStyleArtifactV1,
  recipe: string,
  version: string
): boolean {
  const baseRule = verifiedShadowSplitBaseRule(artifact);
  return (
    !!baseRule &&
    baseRule.declarations.replace(/\s/g, '').includes(`--pui-split-${recipe}-recipe:${version};`)
  );
}

function splitReceiptVariants(token: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  for (const character of token) {
    if (character === '[') depth += 1;
    else if (character === ']') depth = Math.max(0, depth - 1);
    if (character === ':' && depth === 0) {
      parts.push(current);
      current = '';
    } else current += character;
  }
  parts.push(current);
  return parts.filter(Boolean);
}

function compiledReceiptSelector(token: string): string | null {
  const escaped = token.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  let selector = `[${SHADOW_SPLIT_ROOT_STYLE_ATTR}~="${escaped}"]`;
  let dark = false;
  for (const variant of splitReceiptVariants(token).slice(0, -1)) {
    if (variant === 'dark') dark = true;
    else if (['hover', 'active', 'disabled', 'focus-visible'].includes(variant))
      selector += `:${variant}`;
    else {
      const notData = /^not-\[data-([a-zA-Z0-9-]+)\]$/.exec(variant);
      const data = /^data-\[(.+)\]$/.exec(variant);
      if (notData) selector += `:not([data-${notData[1]}])`;
      else if (variant.startsWith('aria-')) selector += `[${variant}='true']`;
      else if (data) {
        const body = data[1]!;
        const equal = body.indexOf('=');
        if (equal < 0) selector += `[data-${body}]`;
        else {
          const name = body.slice(0, equal);
          const value = body
            .slice(equal + 1)
            .replace(/^['"]|['"]$/g, '')
            .replaceAll('\\', '\\\\')
            .replaceAll('"', '\\"');
          selector += `[data-${name}='${value}']`;
        }
      } else return null;
    }
  }
  return `${dark ? ":where(:host([data-pui-color-scheme='dark']))" : ''}:host(${selector})`;
}

function splitSelectorBranches(selector: string): string[] {
  const branches: string[] = [];
  let start = 0;
  let parenDepth = 0;
  let bracketDepth = 0;
  let quote = '';
  for (let index = 0; index < selector.length; index += 1) {
    const character = selector[index]!;
    if (character === '\\') {
      index += 1;
      continue;
    }
    if (quote) {
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '[') bracketDepth += 1;
    else if (character === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    else if (!bracketDepth && character === '(') parenDepth += 1;
    else if (!bracketDepth && character === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (!parenDepth && !bracketDepth && character === ',') {
      branches.push(selector.slice(start, index).trim());
      start = index + 1;
    }
  }
  branches.push(selector.slice(start).trim());
  return branches;
}

function hasExactCompiledReceipt(
  rules: readonly CompiledStyleRule[],
  entry: RootStyleEntry
): boolean {
  const token = entry.token;
  const receipt = compiledReceiptSelector(token);
  if (!receipt) return false;
  const escaped = token.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  const allowed = new Set([
    receipt,
    `${receipt}:host([data-pui-split-text-control])`,
    `${receipt}>[${SHADOW_SPLIT_SURFACE_ATTR}]:not(input,textarea)`,
    `${receipt}>[${SHADOW_SPLIT_SURFACE_ATTR}][data-pui-style~="${escaped}"]`,
  ]);
  const candidates = rules.filter(({ selector }) => selector.replace(/\s/g, '').includes(receipt));
  const matching = candidates.filter(({ selector }) => {
    const branches = splitSelectorBranches(selector.replace(/\s/g, ''));
    return branches.length === 1 && allowed.has(branches[0]!);
  });
  return (
    matching.length === candidates.length &&
    matching.length > 0 &&
    (entry.roleSource === 'fallback' ||
      matching.every(
        (rule) => hasValidDeclarationReceipt(rule) && hasCanonicalSizingRecipe(rule, entry)
      ))
  );
}

// Fixed border widths are supported by H1. CSS rounds animated border widths
// to device pixels but interpolates compensating margins continuously. Until
// a recipe preserves that used-value rounding, reject such transitions under K.
function borderWidthCandidates(entries: readonly RootStyleEntry[]): number[][] {
  const base = Array.from({ length: 4 }, () => new Set<number>()); // top, right, bottom, left
  const conditional: Array<{ sides: number[]; width: number }> = [];
  for (const entry of entries) {
    const match = /^border(?:-([trbl]))?(?:-(\d+))?$/.exec(entry.authorToken);
    if (!match) continue;
    const sides = match[1] ? ['trbl'.indexOf(match[1])] : [0, 1, 2, 3];
    const width = Number(match[2] ?? 1);
    if (entry.token !== entry.authorToken) conditional.push({ sides, width });
    else for (const side of sides) base[side]!.add(width);
  }
  return base.map((widths, side) =>
    [
      ...new Set([
        ...(widths.size ? widths : [0]),
        ...conditional.filter((c) => c.sides.includes(side)).map((c) => c.width),
      ]),
    ].sort()
  );
}

/** Private E1 binding. Validation precedes all DOM writes; no layout measurement. */
export function createShadowSplitEffectsPort({
  host,
  surface,
  artifact,
  prototypeName,
}: {
  host: HTMLElement;
  surface: HTMLElement;
  artifact: ShadowStyleArtifactV1;
  prototypeName: string;
}): EffectsPort & { dispose(): void } {
  const invalid = (reason: string) => new Error(`[${prototypeName}]${reason}`);
  const nativeText = surface.localName === 'input' || surface.localName === 'textarea';
  if (!host.shadowRoot || surface.parentNode !== host.shadowRoot) {
    throw invalid('surface-parent');
  }
  if (
    activeBindings.has(host) ||
    host.hasAttribute(SHADOW_SPLIT_ROOT_STYLE_ATTR) ||
    surface.hasAttribute(SHADOW_SPLIT_SURFACE_ATTR) ||
    (nativeText && host.hasAttribute(NATIVE_TEXT_ATTR))
  ) {
    throw invalid('projection-owned');
  }
  const rules = collectUnconditionallyAvailableRules(stripShadowCssComments(artifact.cssText));
  const baseRule = verifiedShadowSplitBaseRule(artifact);
  if (!baseRule) {
    throw invalid('sizing-recipe');
  }
  const baseDeclarations = baseRule.declarations.replace(/\s/g, '');
  const hasRecipe = (name: string, version: string) =>
    baseDeclarations.includes(`--pui-split-${name}-recipe:${version};`);
  if (nativeText && !hasRecipe('native-text', 'l1')) throw invalid('native-text-recipe');
  activeBindings.add(host);
  const applier = createOwnedTwTokenApplier(surface);
  let latest: Projection | null = null;
  let applied: Projection | null = null;
  let disposed = false;
  let flushing = false;
  let flushRequested = false;

  const fail = (entry: RootStyleEntry, reason: string): never => {
    throw invalid(
      `${entry.origin} token ${JSON.stringify(entry.authorToken)}:${reason}; fix: companion or change/remove token`
    );
  };
  const prepare = (handle: StyleHandle): Projection => {
    if (!('entries' in handle)) {
      throw invalid('root-provenance');
    }
    const entries = mergeRootStyleEntries(readRootStyleEntries(handle, 'setup'));
    if (
      entries.some((entry) =>
        ['animate-in', 'animate-out', '-translate-x-1/2', '-translate-y-1/2'].includes(
          entry.authorToken
        )
      )
    ) {
      const slide = entries.find((entry) => /^slide-(in|out)-/.test(entry.authorToken));
      if (slide) fail(slide, 'K1 slide');
    }
    const intrinsicTokens = ['inline-flex', 'flex-1', 'whitespace-nowrap'];
    if (intrinsicTokens.every((token) => entries.some((entry) => entry.authorToken === token))) {
      const flex = entries.find((entry) => entry.authorToken === 'flex-1')!;
      if (!hasRecipe('intrinsic-nowrap', 'v1')) fail(flex, 'intrinsic recipe');
      if (
        intrinsicTokens.some((token) =>
          entries.some((entry) => entry.authorToken === token && entry.token !== token)
        ) ||
        entries.some((entry) => /^(?:w-|min-w-|max-w-|size-)/.test(entry.authorToken))
      )
        fail(flex, 'intrinsic operands');
    }
    for (const entry of entries) {
      if (
        nativeText &&
        /^(?:(?:min-|max-)?[wh]-|size-|aspect-)/.test(entry.authorToken) &&
        !['w-full', 'min-h-16'].includes(entry.authorToken)
      )
        fail(entry, 'native-size');
      if (
        !['setup', 'rule', 'runtime'].includes(entry.origin) ||
        !entry.authorToken ||
        /\s|:/.test(entry.authorToken)
      ) {
        fail(entry, 'author-origin');
      }
      const canonical = resolveRootStyleEntry(entry.authorToken, entry.origin);
      if (
        entry.role !== canonical.role ||
        entry.roleSource !== canonical.roleSource ||
        (entry.token !== entry.authorToken && !entry.token.endsWith(`:${entry.authorToken}`))
      ) {
        fail(entry, 'canonical-origin');
      }
      if (entry.role === 'unresolved') fail(entry, 'unresolved-role');
      const needsK1 = [
        '-translate-x-1/2',
        '-translate-y-1/2',
        'animate-in',
        'animate-out',
      ].includes(entry.authorToken);
      if (needsK1 && !hasRecipe('dialog-motion', 'k1')) fail(entry, 'K1 recipe');
      const needsI1 = entry.authorToken === 'hidden' || entry.authorToken === 'relative';
      if (needsI1 && !hasRecipe('participation-coordinate', 'i1')) fail(entry, 'I1 recipe');
      if (
        ((entry.role === 'root-geometry' && !needsI1 && !needsK1) ||
          entry.role === 'hit-testing' ||
          entry.authorToken === 'transition-all') &&
        !hasRecipe('motion', 'h1')
      )
        fail(entry, 'H1 recipe');
      if (entry.role === 'composite' && !COMPOSITES.has(entry.authorToken))
        fail(entry, 'composite');
      if (entry.role === 'composite' && entry.token !== entry.authorToken)
        fail(entry, 'conditional-composite');
      if (!hasExactCompiledReceipt(rules, entry)) {
        fail(entry, 'missing token');
      }
    }
    const logicalPadding = entries.find((entry) => /^(?:px|py)-/.test(entry.authorToken));
    if (logicalPadding) {
      const unsupported = entries.find(
        (entry) =>
          /^(?:p[trbl])-/.test(entry.authorToken) || /^border-[trbl](?:-|$)/.test(entry.authorToken)
      );
      if (unsupported)
        fail(logicalPadding, `directional:${JSON.stringify(unsupported.authorToken)}`);
    }
    const widths = borderWidthCandidates(entries);
    const borderWidths = JSON.stringify(widths);
    const animated = entries.find((e) => e.authorToken === 'transition-all');
    if (
      animated &&
      (widths.some((values) => values.length > 1) ||
        (applied && applied.borderWidths !== borderWidths))
    ) {
      fail(animated, 'used-value-rounding');
    }
    return {
      borderWidths,
      root: entries.map((e) => e.token).join(' '),
      surface: entries
        .filter(
          (e) =>
            e.role === 'surface' ||
            e.role === 'composite' ||
            (nativeText && ['w-full', 'min-h-16'].includes(e.authorToken))
        )
        .map((e) => e.token),
    };
  };
  const assertActive = () => {
    if (disposed) throw invalid('disposed');
  };
  const flush = () => {
    assertActive();
    if (!latest) return;
    if (flushing) {
      flushRequested = true;
      return;
    }
    flushing = true;
    const previous = applied;
    const next = latest;
    try {
      host.setAttribute(SHADOW_SPLIT_ROOT_STYLE_ATTR, next.root);
      if (nativeText) host.setAttribute(NATIVE_TEXT_ATTR, '');
      surface.setAttribute(SHADOW_SPLIT_SURFACE_ATTR, '');
      applier.apply(next.surface);
      applied = next;
    } catch (error) {
      // Restore both owned projections even when the failing target mutated before throwing.
      // DOM rollback itself may fail on a broken host; retain the original failure.
      try {
        applier.apply(previous?.surface ?? []);
      } catch {}
      try {
        if (previous) host.setAttribute(SHADOW_SPLIT_ROOT_STYLE_ATTR, previous.root);
        else host.removeAttribute(SHADOW_SPLIT_ROOT_STYLE_ATTR);
      } catch {}
      try {
        if (!previous) surface.removeAttribute(SHADOW_SPLIT_SURFACE_ATTR);
        if (!previous && nativeText) host.removeAttribute(NATIVE_TEXT_ATTR);
      } catch {}
      latest = previous;
      flushRequested = false;
      throw error;
    } finally {
      flushing = false;
    }
    if (flushRequested) {
      flushRequested = false;
      // A same-projection request raised by a DOM callback needs no replay.
      if (!disposed && latest !== applied) flush();
    }
  };
  return {
    queueStyle(handle) {
      assertActive();
      latest = prepare(handle);
    },
    requestFlush: flush,
    flushNow: flush,
    dispose() {
      if (disposed) return;
      disposed = true;
      activeBindings.delete(host);
      const errors: unknown[] = [];
      const cleanup = (action: () => void) => {
        try {
          action();
        } catch (error) {
          errors.push(error);
        }
      };
      cleanup(() => applier.clear());
      cleanup(() => {
        if (applied && host.getAttribute(SHADOW_SPLIT_ROOT_STYLE_ATTR) === applied.root)
          host.removeAttribute(SHADOW_SPLIT_ROOT_STYLE_ATTR);
      });
      cleanup(() => {
        if (applied && surface.getAttribute(SHADOW_SPLIT_SURFACE_ATTR) === '')
          surface.removeAttribute(SHADOW_SPLIT_SURFACE_ATTR);
      });
      cleanup(() => {
        if (nativeText && applied && host.getAttribute(NATIVE_TEXT_ATTR) === '')
          host.removeAttribute(NATIVE_TEXT_ATTR);
      });
      applied = latest = null;
      if (errors.length) throw errors[0];
    },
  };
}
