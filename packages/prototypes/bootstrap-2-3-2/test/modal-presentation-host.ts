import { fileURLToPath } from 'node:url';
import { beforeAll, vi } from 'vitest';
import { collectProtoStyleTokensFromFiles } from '../../../cli/src/services/prototype-style-tokens';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';

export async function collectModalPresentationCss() {
  const tokens = await collectProtoStyleTokensFromFiles(
    [
      '../src/dialog/content.proto.ts',
      '../src/dialog/mask.proto.ts',
      '../src/alert-dialog/content.proto.ts',
      '../src/alert-dialog/mask.proto.ts',
    ].map((path) => fileURLToPath(new URL(path, import.meta.url)))
  );
  // Happy DOM does not implement cascade layers, and its attribute-selector
  // parser needs brackets escaped even inside quoted values. CSS string escapes
  // preserve the exact token selectors; the generated declarations stay intact.
  // This is source-composition evidence, not native browser cascade evidence.
  return renderProtoStyleTokenCss(tokens)
    .replace(/@layer proto-ui \{\n([\s\S]*)\n\}\n$/, '$1')
    .replace(
      /(\[data-pui-style~=")([^"]+)("\])/g,
      (_match, prefix: string, token: string, suffix: string) =>
        prefix + token.replace(/[\[\]]/g, '\\$&') + suffix
    );
}

// These semantic consumer tests observe an in-flight presentation, so supply
// the same finite CSS and known preference as modal-presence-presentation.test.
// Real frame scheduling remains in place; this is not native geometry evidence.
export function installModalPresentationHost() {
  let tokenCss = '';
  beforeAll(async () => {
    tokenCss = await collectModalPresentationCss();
  }, 30_000);
  return () => {
    const stylesheet = document.createElement('style');
    stylesheet.textContent = tokenCss;
    document.head.append(stylesheet);
    const css = vi.spyOn(window.CSS, 'supports').mockReturnValue(true);
    const root = document.documentElement;
    const height = Object.getOwnPropertyDescriptor(root, 'clientHeight');
    Object.defineProperty(root, 'clientHeight', { configurable: true, value: 1000 });
    const matchMedia = window.matchMedia.bind(window);
    const preference = vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
      const media = matchMedia(query);
      if (query === '(prefers-reduced-motion: no-preference)') {
        Object.defineProperty(media, 'matches', { configurable: true, value: true });
      }
      return media;
    });
    return () => {
      stylesheet.remove();
      preference.mockRestore();
      if (height) Object.defineProperty(root, 'clientHeight', height);
      else Reflect.deleteProperty(root, 'clientHeight');
      css.mockRestore();
    };
  };
}
