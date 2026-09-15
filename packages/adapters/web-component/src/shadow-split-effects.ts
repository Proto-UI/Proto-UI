import type { EffectsPort, StyleHandle } from '@proto.ui/core';
import {
  mergeRootStyleEntries,
  readRootStyleEntries,
  resolveRootStyleEntry,
  type RootStyleEntry,
} from '@proto.ui/core/internal';
import { createOwnedTwTokenApplier } from './feedback-style';
import type { ShadowStyleArtifactV1 } from './shadow-style-artifact';

export const SHADOW_SPLIT_ROOT_STYLE_ATTR = 'data-pui-split-root-style';
export const SHADOW_SPLIT_SURFACE_ATTR = 'data-pui-split-surface';
const activeBindings = new WeakSet<HTMLElement>();
const COMPOSITES = new Set(['block', 'flex', 'grid', 'inline-flex']);
const NATIVE_TEXT_ATTR = 'data-pui-split-text-control';

type Projection = { root: string; surface: string[]; borderWidths: string };

// Fixed border widths are supported by H1. CSS rounds animated border widths
// to device pixels but interpolates compensating margins continuously. Until
// a recipe preserves that used-value rounding, reject such transitions under K.
function borderWidthCandidates(entries: readonly RootStyleEntry[]): number[][] {
  const base = [0, 0, 0, 0]; // top, right, bottom, left
  const conditional: Array<{ sides: number[]; width: number }> = [];
  for (const entry of entries) {
    const match = /^border(?:-([trbl]))?(?:-(\d+))?$/.exec(entry.authorToken);
    if (!match) continue;
    const sides = match[1] ? ['trbl'.indexOf(match[1])] : [0, 1, 2, 3];
    const width = Number(match[2] ?? 1);
    if (entry.token !== entry.authorToken) conditional.push({ sides, width });
    else for (const side of sides) base[side] = width;
  }
  return base.map((width, side) =>
    [
      ...new Set([width, ...conditional.filter((c) => c.sides.includes(side)).map((c) => c.width)]),
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
  const nativeText = surface.localName === 'input' || surface.localName === 'textarea';
  if (!host.shadowRoot || surface.parentNode !== host.shadowRoot) {
    throw new Error(
      `[WC split:${prototypeName}] surface must be a direct child of the host ShadowRoot`
    );
  }
  if (
    activeBindings.has(host) ||
    host.hasAttribute(SHADOW_SPLIT_ROOT_STYLE_ATTR) ||
    surface.hasAttribute(SHADOW_SPLIT_SURFACE_ATTR) ||
    (nativeText && host.hasAttribute(NATIVE_TEXT_ATTR))
  ) {
    throw new Error(`[WC split:${prototypeName}] sizing projection is already owned`);
  }
  if (!artifact.cssText.includes(`:host([${SHADOW_SPLIT_ROOT_STYLE_ATTR}])`)) {
    throw new Error(`[WC split:${prototypeName}] requires the private generated sizing recipe`);
  }
  if (nativeText && !artifact.cssText.includes('--pui-split-native-text-recipe: l1;'))
    throw new Error(
      `[WC split:${prototypeName}] native text recipe is absent; regenerate the CLI companion`
    );
  activeBindings.add(host);
  const applier = createOwnedTwTokenApplier(surface);
  let latest: Projection | null = null;
  let applied: Projection | null = null;
  let disposed = false;
  let flushing = false;
  let flushRequested = false;

  const fail = (entry: RootStyleEntry, reason: string): never => {
    throw new Error(
      `[WC split:${prototypeName}] ${entry.origin} token ${JSON.stringify(entry.authorToken)}: ${reason}. Supply a supported recipe or use the existing collapsed profile; no target was changed.`
    );
  };
  const prepare = (handle: StyleHandle): Projection => {
    if (!('entries' in handle)) {
      throw new Error(
        `[WC split:${prototypeName}] requires Root effect provenance before selector lowering`
      );
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
      if (slide) fail(slide, 'K1 does not support slide animation operands');
    }
    const intrinsicTokens = ['inline-flex', 'flex-1', 'whitespace-nowrap'];
    if (intrinsicTokens.every((token) => entries.some((entry) => entry.authorToken === token))) {
      const flex = entries.find((entry) => entry.authorToken === 'flex-1')!;
      if (!artifact.cssText.includes('--pui-split-intrinsic-nowrap-recipe: v1;'))
        fail(flex, 'nowrap flex intrinsic recipe is absent; regenerate the CLI companion');
      if (
        intrinsicTokens.some((token) =>
          entries.some((entry) => entry.authorToken === token && entry.token !== token)
        ) ||
        entries.some((entry) => /^(?:w-|min-w-|max-w-|size-)/.test(entry.authorToken))
      )
        fail(
          flex,
          'nowrap flex intrinsic recipe does not support conditional bases or explicit width constraints'
        );
    }
    for (const entry of entries) {
      if (
        nativeText &&
        /^(?:(?:min-|max-)?[wh]-|size-|aspect-)/.test(entry.authorToken) &&
        !['w-full', 'min-h-16'].includes(entry.authorToken)
      )
        fail(entry, 'S5 native sizing admits only w-full and min-h-16');
      if (
        !['setup', 'rule', 'runtime'].includes(entry.origin) ||
        !entry.authorToken ||
        /\s|:/.test(entry.authorToken)
      ) {
        fail(entry, 'invalid author provenance');
      }
      const canonical = resolveRootStyleEntry(entry.authorToken, entry.origin);
      if (
        entry.role !== canonical.role ||
        entry.roleSource !== canonical.roleSource ||
        (entry.token !== entry.authorToken && !entry.token.endsWith(`:${entry.authorToken}`))
      ) {
        fail(entry, 'inconsistent canonical provenance');
      }
      if (entry.role === 'unresolved') fail(entry, 'application role is unresolved');
      const needsK1 = [
        '-translate-x-1/2',
        '-translate-y-1/2',
        'animate-in',
        'animate-out',
      ].includes(entry.authorToken);
      if (needsK1 && !artifact.cssText.includes('--pui-split-dialog-motion-recipe: k1;'))
        fail(entry, 'K1 physical recipe is absent; regenerate the CLI companion');
      const needsI1 = entry.authorToken === 'hidden' || entry.authorToken === 'relative';
      if (needsI1 && !artifact.cssText.includes('--pui-split-participation-coordinate-recipe: i1;'))
        fail(entry, 'I1 physical recipe is absent; regenerate the CLI companion');
      if (
        ((entry.role === 'root-geometry' && !needsI1 && !needsK1) ||
          entry.role === 'hit-testing' ||
          entry.authorToken === 'transition-all') &&
        !artifact.cssText.includes('--pui-split-motion-recipe: h1;')
      )
        fail(entry, 'H1 physical recipe is absent; regenerate the CLI companion');
      if (entry.role === 'composite' && !COMPOSITES.has(entry.authorToken))
        fail(entry, 'composite recipe is not implemented');
      const escaped = entry.token.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
      if (
        entry.roleSource !== 'fallback' &&
        !artifact.cssText.includes(`[${SHADOW_SPLIT_ROOT_STYLE_ATTR}~="${escaped}"]`)
      ) {
        fail(entry, 'physical token is absent from the compiled split closure');
      }
    }
    const widths = borderWidthCandidates(entries);
    const borderWidths = JSON.stringify(widths);
    const animated = entries.find((e) => e.authorToken === 'transition-all');
    if (
      animated &&
      (widths.some((values) => values.length > 1) ||
        (applied && applied.borderWidths !== borderWidths))
    ) {
      fail(
        animated,
        'animated border-width changes require an unsupported used-value rounding recipe'
      );
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
    if (disposed) throw new Error(`[WC split:${prototypeName}] effects binding is disposed`);
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
