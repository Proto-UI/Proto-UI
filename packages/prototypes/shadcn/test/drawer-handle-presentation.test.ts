import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as base from '../../base/src/drawer';
import * as shadcn from '../src/drawer';
import * as brutalist from '../../brutalist/src/drawer';
import * as bootstrap from '../../bootstrap-2-3-2/src/drawer';
import * as glass from '../../liquid-glass/src/drawer';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowStyleTokenCss,
} from '../../../cli/src/services/proto-style-css';

// Independent recipe oracle: New York 02cad611 drawer.tsx:70. The fixed 100px
// indicator width is upstream-authored; height and top margin remain root-relative.
// This source-host suite does not prove native flow geometry or painted pixels.
const families = [base, shadcn, brutalist, bootstrap, glass];
const roots: HTMLElement[] = [];
for (const family of families)
  for (const proto of [family.drawerRoot, family.drawerContent, family.drawerHandle])
    AdaptToWebComponent(proto);
const flush = async () => {
  for (let index = 0; index < 25; index++) await Promise.resolve();
};
afterEach(async () => {
  roots.splice(0).forEach((root) => root.remove());
  await flush();
});
const tokensOf = (node: Element) =>
  (node.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean);
type Family = Pick<typeof shadcn, 'drawerRoot' | 'drawerContent' | 'drawerHandle'>;
async function fixture(family: Family = shadcn, side = 'bottom', points?: number[]) {
  const root = document.createElement(family.drawerRoot.name);
  const content = document.createElement(family.drawerContent.name);
  const handle = document.createElement(family.drawerHandle.name);
  setElementProps(root, { defaultOpen: true });
  setElementProps(content, { side, snapPoints: points, enterDuration: 0, leaveDuration: 0 });
  content.append(handle);
  root.append(content);
  roots.push(root);
  document.body.append(root);
  await flush();
  return { root, content, handle };
}

describe('Drawer Handle behavior and optional family presentation', () => {
  it.each([[undefined], [[0.5, 1]]])(
    'uses the bottom New York flow recipe in mode %j',
    async (points) => {
      const { handle } = await fixture(shadcn, 'bottom', points);
      const tokens = tokensOf(handle);
      expect(tokens).toEqual(
        expect.arrayContaining([
          'relative',
          'mx-[auto]',
          'mt-4',
          'h-2',
          'w-[100px]',
          'shrink-0',
          'rounded-full',
          'bg-muted',
        ])
      );
      for (const token of [
        'absolute',
        'top-1',
        'left-1/2',
        '-translate-x-1/2',
        'w-12',
        'bg-muted-foreground/50',
      ])
        expect(tokens).not.toContain(token);
      expect(handle.getAttribute('role')).toBe(points ? 'separator' : 'presentation');
      expect(handle.getAttribute('aria-hidden')).toBe(points ? 'false' : 'true');
      for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
        const css = render(tokens);
        expect(css).not.toContain('Unsupported Proto UI style tokens');
        for (const declaration of [
          'position: relative;',
          'margin-inline: auto;',
          'margin-top: 1rem;',
          'width: 100px;',
          'height: 0.5rem;',
          'flex-shrink: 0;',
        ])
          expect(css).toContain(declaration);
      }
    }
  );

  it.each(['top', 'left', 'right'])(
    'keeps the %s resize affordance until whole-Content dragging exists',
    async (side) => {
      const { content, handle } = await fixture(shadcn, side, [0.5, 1]);
      expect(tokensOf(handle)).toContain('absolute');
      expect(tokensOf(handle)).not.toContain('hidden');
      expect(handle.getAttribute('role')).toBe('separator');
      expect(tokensOf(handle)).not.toContain('w-[100px]');
      setElementProps(content, { side: 'bottom' });
      await flush();
      expect(tokensOf(handle)).toContain('relative');
      expect(tokensOf(handle)).not.toContain('absolute');
      expect(tokensOf(handle)).not.toContain('-translate-y-1/2');
      setElementProps(content, { side });
      await flush();
      expect(tokensOf(handle)).not.toContain('relative');
      expect(tokensOf(handle)).not.toContain('mt-4');
      expect(tokensOf(handle)).toContain('absolute');
    }
  );

  for (const family of [base, brutalist, bootstrap, glass])
    it(`${family.drawerHandle.name} retains its original edge placement`, async () => {
      const { handle } = await fixture(family);
      expect(tokensOf(handle)).toEqual(
        expect.arrayContaining([
          'absolute',
          'z-10',
          'top-1',
          'left-1/2',
          '-translate-x-1/2',
          'h-2',
          'w-12',
        ])
      );
      expect(tokensOf(handle)).not.toContain('w-[100px]');
      expect(tokensOf(handle)).not.toContain('mt-4');
    });
});
