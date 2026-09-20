import { describe, expect, it } from 'vitest';
import {
  createRootStyleEffect,
  lowerRootStyleTokens,
  resolveRootStyleEntry,
} from '@proto.ui/core/internal';
import { renderProtoShadowSplitStyleArtifact } from '../../../cli/src/services/proto-style-css';
import { createShadowSplitEffectsPort } from '../src/shadow-split-effects';

// D-STYLE-ROLE P/Q/R/K and D-SHADOW-STYLE P. Physical behavior has separate Chrome coverage.
const marker = '--pui-split-participation-coordinate-recipe: i1;';
const tokens = ['block', 'hidden', 'relative', 'data-[inactive]:hidden', 'dark:hidden'];
const effect = (tokens: string[]) =>
  createRootStyleEffect(tokens.map((t) => resolveRootStyleEntry(t, 'runtime')));
describe('I1 recipe and atomic projection', () => {
  it('generates same-source host participation and coordinate rules with condition preservation', () => {
    const { cssText } = renderProtoShadowSplitStyleArtifact(tokens);
    expect(cssText).toContain(marker);
    expect(cssText).toMatch(/:host\(\[data-pui-split-root-style~="hidden"\]\) \{\s*display: none;/);
    expect(cssText).toMatch(
      /:host\(\[data-pui-split-root-style~="relative"\]\) \{\s*position: relative;/
    );
    expect(cssText).toContain('data-pui-split-root-style~="data-[inactive]:hidden"');
    expect(cssText).toContain(":where(:host([data-pui-color-scheme='dark']))");
  });
  it.each([false, true])(
    'keeps complete snapshots and owned cleanup with oldArtifact=%s',
    (old) => {
      const host = document.createElement('x-i1');
      const surface = document.createElement('div');
      host.attachShadow({ mode: 'open' }).append(surface);
      surface.setAttribute('data-pui-style', 'consumer');
      const generated = renderProtoShadowSplitStyleArtifact(tokens);
      const artifact = {
        ...generated,
        cssText: old ? generated.cssText.replace(marker, '') : generated.cssText,
      };
      const port = createShadowSplitEffectsPort({ host, surface, artifact, prototypeName: 'i1' });
      port.queueStyle(effect(['block']));
      port.flushNow!();
      const previous = [host.outerHTML, surface.outerHTML];
      for (const token of ['hidden', 'relative']) {
        if (old) {
          expect(() => port.queueStyle(effect([token]))).toThrow(/I1 recipe/);
          port.flushNow!();
          expect([host.outerHTML, surface.outerHTML]).toEqual(previous);
        } else {
          port.queueStyle(effect([token]));
          port.flushNow!();
          expect(host.getAttribute('data-pui-split-root-style')).toBe(token);
          expect(surface.getAttribute('data-pui-style')).toBe('consumer');
          expect(host.hasAttribute('aria-hidden')).toBe(false);
          expect(host.hasAttribute('hidden')).toBe(false);
          expect(host.hasAttribute('data-pui-view-detached')).toBe(false);
        }
      }
      if (!old) {
        port.queueStyle(lowerRootStyleTokens(['hidden'], 'data-[inactive]'));
        port.flushNow!();
        expect(surface.getAttribute('data-pui-style')).toBe('consumer');
        port.queueStyle(effect(['block']));
        port.flushNow!();
        expect(surface.getAttribute('data-pui-style')).toBe('consumer block');
      }
      port.dispose();
      expect(host.hasAttribute('data-pui-split-root-style')).toBe(false);
      expect(surface.getAttribute('data-pui-style')).toBe('consumer');
    }
  );
});
