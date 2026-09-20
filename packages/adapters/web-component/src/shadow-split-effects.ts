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

type Projection = { root: string; surface: string[]; borderWidths: string };

function correctiveDirection(reason: string): string {
  if (reason === 'missing token')
    return 'include the exact token selector in the Shadow style artifact or remove the token';
  if (reason === 'unresolved-role')
    return 'replace the token with one that has an admitted canonical role or remove it';
  if (reason === 'composite')
    return 'replace the token with an admitted composite token (block, flex, grid, or inline-flex)';
  if (reason === 'conditional-composite')
    return 'use an unconditional admitted composite token or remove the conditional composite';
  if (reason === 'native-size')
    return 'replace the native-text size token with w-full or min-h-16, or remove it';
  if (reason === 'author-origin')
    return 'provide one unqualified author token from setup, rule, or runtime origin';
  if (reason === 'canonical-origin')
    return 'regenerate the Root effect from canonical author provenance';
  if (reason === 'K1 slide')
    return 'remove the slide token or use the verified dialog-motion K1 recipe without slide composition';
  if (reason === 'K1 recipe')
    return 'provide the verified dialog-motion K1 recipe or remove the motion token';
  if (reason === 'I1 recipe')
    return 'provide the verified participation-coordinate I1 recipe or remove the token';
  if (reason === 'H1 recipe')
    return 'provide the verified motion H1 recipe or remove the geometry or hit-testing token';
  if (reason === 'intrinsic recipe')
    return 'provide the verified intrinsic-nowrap v1 recipe or remove the intrinsic token combination';
  if (reason === 'intrinsic operands')
    return 'remove conditional or explicit size operands from the intrinsic-nowrap token combination';
  if (reason.startsWith('directional:'))
    return 'remove the directional padding or border token from the logical-padding combination';
  if (reason === 'used-value-rounding')
    return 'remove the animated border-width combination or provide a verified rounding recipe';
  return 'remove the unsupported token combination or provide a verified split recipe for it';
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
  const cssText = stripShadowCssComments(artifact.cssText).replace(/\s/g, '');
  const ruleSelectors = cssText.match(/[^{}]+(?=\{)/g) ?? [];
  const baseDeclarations = new RegExp(
    `(?:^|[{}]):host\\(\\[${SHADOW_SPLIT_ROOT_STYLE_ATTR}\\]\\)\\{([^{}]*)\\}`
  ).exec(cssText)?.[1];
  if (!baseDeclarations) {
    throw invalid('sizing-recipe');
  }
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
      `${entry.origin} token ${JSON.stringify(entry.authorToken)}:${reason}; corrective direction: ${correctiveDirection(reason)}`
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
      const escaped = entry.token.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
      const tokenSelector = `:host([${SHADOW_SPLIT_ROOT_STYLE_ATTR}~="${escaped}"]`;
      if (
        !ruleSelectors.some(
          (selector) =>
            selector.startsWith(tokenSelector) ||
            (selector.startsWith(':where(') && selector.includes(`)${tokenSelector}`))
        )
      ) {
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
