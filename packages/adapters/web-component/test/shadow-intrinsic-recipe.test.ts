import { describe, expect, it } from 'vitest';
import {
  createRootStyleEffect,
  lowerRootStyleTokens,
  resolveRootStyleEntry,
} from '@proto.ui/core/internal';
import { renderProtoShadowSplitStyleArtifact } from '../../../cli/src/services/proto-style-css';
import { createShadowSplitEffectsPort } from '../src/shadow-split-effects';

const base = ['inline-flex', 'flex-1', 'whitespace-nowrap'];
const marker = '--pui-split-intrinsic-nowrap-recipe: v1;';
const effect = (tokens: string[]) =>
  createRootStyleEffect(tokens.map((t) => resolveRootStyleEntry(t, 'runtime')));
const generated = renderProtoShadowSplitStyleArtifact([
  ...base,
  'hidden',
  'block',
  'w-full',
  'min-w-0',
  'max-w-lg',
  'size-4',
  ...base.map((t) => `data-[ready]:${t}`),
]);

describe('bounded split intrinsic nowrap recipe', () => {
  it('uses a flex shell without changing the external automatic minimum or zero basis', () => {
    expect(generated.cssText).toContain(marker);
    expect(generated.cssText).toContain('--pui-split-inline-display: inline-flex;');
    expect(generated.cssText).toContain('display: var(--pui-split-inline-display, inline-grid);');
    expect(generated.cssText).toContain('flex: 1 1 auto;');
    expect(generated.cssText).not.toContain('min-width: max-content;');
    expect(generated.cssText).toMatch(/root-style~="hidden"\]\) \{\s*display: none;/);
  });
  it.each(['old', 'conditional', 'w-full', 'min-w-0', 'max-w-lg', 'size-4'])(
    'rejects %s before either target changes',
    (kind) => {
      const host = document.createElement('x-intrinsic'),
        surface = document.createElement('div');
      host.attachShadow({ mode: 'open' }).append(surface);
      const artifact = {
        ...generated,
        cssText: kind === 'old' ? generated.cssText.replace(marker, '') : generated.cssText,
      };
      const port = createShadowSplitEffectsPort({
        host,
        surface,
        artifact,
        prototypeName: 'intrinsic-test',
      });
      port.queueStyle(effect(['block']));
      port.flushNow!();
      const before = [host.outerHTML, surface.outerHTML];
      const next =
        kind === 'conditional'
          ? lowerRootStyleTokens(base, 'data-[ready]')
          : effect([...base, ...(kind === 'old' ? [] : [kind])]);
      expect(() => port.queueStyle(next)).toThrow(/intrinsic/);
      port.flushNow!();
      expect([host.outerHTML, surface.outerHTML]).toEqual(before);
      port.dispose();
    }
  );
  it('replaces and clears the complete effect while preserving consumer contribution', () => {
    const host = document.createElement('x-intrinsic'),
      surface = document.createElement('div');
    host.attachShadow({ mode: 'open' }).append(surface);
    surface.setAttribute('data-pui-style', 'consumer');
    const port = createShadowSplitEffectsPort({
      host,
      surface,
      artifact: generated,
      prototypeName: 'intrinsic-test',
    });
    for (const tokens of [base, [...base, 'hidden'], ['block'], base]) {
      port.queueStyle(effect(tokens));
      port.flushNow!();
      expect(host.getAttribute('data-pui-split-root-style')).toBe(tokens.join(' '));
      expect(surface.getAttribute('data-pui-style')).toContain('consumer');
    }
    port.dispose();
    expect(host.hasAttribute('data-pui-split-root-style')).toBe(false);
    expect(surface.getAttribute('data-pui-style')).toBe('consumer');
  });
});
