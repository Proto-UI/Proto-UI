import { describe, expect, it } from 'vitest';
import { createRootStyleEffect, resolveRootStyleEntry } from '@proto.ui/core/internal';
import { renderProtoShadowSplitStyleArtifact } from '../../../cli/src/services/proto-style-css';
import { createShadowSplitEffectsPort } from '../src/shadow-split-effects';
import { rewriteSplitBaseDeclarations } from './shadow-split-test-utils';

const marker = '--pui-split-dialog-motion-recipe: k1;';
const tokens = [
  'grid',
  '-translate-x-1/2',
  '-translate-y-1/2',
  'animate-in',
  'animate-out',
  'fade-in-0',
  'fade-out-0',
  'zoom-in-95',
  'zoom-out-95',
  'duration-200',
];
const effect = (ts: string[]) =>
  createRootStyleEffect(ts.map((t) => resolveRootStyleEntry(t, 'runtime')));
// D-ROLE S/T/K and D-SHADOW-STYLE Q; native midpoint/geometry in browser runner.
describe('K1 projection and compiled recipe', () => {
  it('rejects unsupported slide combinations before changing either target', () => {
    const host = document.createElement('x-k1-slide');
    const surface = document.createElement('div');
    host.attachShadow({ mode: 'open' }).append(surface);
    const artifact = renderProtoShadowSplitStyleArtifact([...tokens, 'slide-in-from-left-2']);
    const port = createShadowSplitEffectsPort({
      host,
      surface,
      artifact,
      prototypeName: 'k1-slide',
    });
    port.queueStyle(effect(['grid']));
    port.flushNow!();
    const before = [host.outerHTML, surface.outerHTML];
    expect(() => port.queueStyle(effect(['grid', 'animate-in', 'slide-in-from-left-2']))).toThrow(
      /K1 slide/
    );
    port.flushNow!();
    expect([host.outerHTML, surface.outerHTML]).toEqual(before);
    port.dispose();
  });
  it('coordinates boundary geometry and surface paint with distinct keyframes', () => {
    const { cssText } = renderProtoShadowSplitStyleArtifact(tokens);
    expect(cssText).toContain(marker);
    expect(cssText).toContain('animation-name: pui-split-geometry-enter;');
    expect(cssText).toContain('animation-name: pui-split-paint-enter;');
    expect(cssText).toContain('@keyframes pui-split-geometry-exit');
    expect(cssText).toMatch(/@keyframes pui-split-paint-enter \{\s*from \{\s*opacity:/);
    expect(cssText).toContain('--pui-enter-scale: initial;');
  });
  it.each([false, true])('retains complete projection with old companion=%s', (old) => {
    const host = document.createElement('x-k1');
    const surface = document.createElement('div');
    host.attachShadow({ mode: 'open' }).append(surface);
    surface.setAttribute('data-pui-style', 'consumer');
    const generated = renderProtoShadowSplitStyleArtifact(tokens);
    const artifact = {
      ...generated,
      cssText: old
        ? rewriteSplitBaseDeclarations(generated.cssText, (declarations) =>
            declarations.replace(marker, '')
          )
        : generated.cssText,
    };
    const port = createShadowSplitEffectsPort({ host, surface, artifact, prototypeName: 'k1' });
    port.queueStyle(effect(['grid']));
    port.flushNow!();
    const before = [host.outerHTML, surface.outerHTML];
    for (const token of ['-translate-x-1/2', '-translate-y-1/2', 'animate-in', 'animate-out']) {
      if (old) {
        expect(() => port.queueStyle(effect(['grid', token]))).toThrow(/K1 recipe/);
        port.flushNow!();
        expect([host.outerHTML, surface.outerHTML]).toEqual(before);
      } else {
        port.queueStyle(effect(['grid', token]));
        port.flushNow!();
        expect(host.getAttribute('data-pui-split-root-style')).toContain(token);
        if (token.startsWith('-translate'))
          expect(surface.getAttribute('data-pui-style')).not.toContain(token);
      }
    }
    port.dispose();
    expect(surface.getAttribute('data-pui-style')).toBe('consumer');
    expect(host.hasAttribute('data-pui-split-root-style')).toBe(false);
  });
});
