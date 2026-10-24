import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { treeRoot, treeItem } from '../src/tree';
import { styleContains } from '../../test-utils/style';

const Root = AdaptToWebComponent(treeRoot, { registerAs: 'test-embedded-shadcn-tree-root' });
const Item = AdaptToWebComponent(treeItem, { registerAs: 'test-embedded-shadcn-tree-item' });
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
afterEach(() => document.body.replaceChildren());
function fixture(appearance?: 'default' | 'embedded') {
  const root = new Root(), folder = new Item(), file = new Item();
  setElementProps(root, { appearance, value: 'src/app.tsx', expandedKeys: ['src'] });
  setElementProps(folder, { appearance, nodeKey: 'src', textValue: 'src' });
  setElementProps(file, { appearance, nodeKey: 'src/app.tsx', parentKey: 'src', textValue: 'app.tsx' });
  root.append(folder, file); document.body.append(root);
  return { root, folder, file };
}
it('preserves default recipes and toggles embedded presentation without replacing Tree ownership', async () => {
  const { root, file } = fixture(); await flush();
  for (const token of ['rounded-lg', 'border', 'bg-background', 'shadow-sm', 'p-3']) expect(styleContains(root, token)).toBe(true);
  for (const token of ['rounded-md', 'px-3', 'py-2', 'bg-primary', 'text-primary-foreground']) expect(styleContains(file, token)).toBe(true);
  setElementProps(root, { appearance: 'embedded', value: 'src/app.tsx', expandedKeys: ['src'] }); setElementProps(file, { appearance: 'embedded', nodeKey: 'src/app.tsx', parentKey: 'src', textValue: 'app.tsx' }); await flush();
  for (const token of ['border-0', 'rounded-none', 'bg-transparent', 'shadow-none', 'p-0']) expect(styleContains(root, token)).toBe(true);
  for (const token of ['min-h-8', 'text-sm', 'rounded-none', 'bg-muted-foreground/15', 'font-medium']) expect(styleContains(file, token)).toBe(true);
  expect(styleContains(file, 'bg-primary')).toBe(false);
  expect(file.getAttribute('role')).toBe('treeitem'); expect(file.getAttribute('aria-selected')).toBe('true');
  expect(file.getAttribute('aria-level')).toBe('2');
  setElementProps(root, { appearance: 'default', value: 'src/app.tsx', expandedKeys: ['src'] }); setElementProps(file, { appearance: 'default', nodeKey: 'src/app.tsx', parentKey: 'src', textValue: 'app.tsx' }); await flush();
  expect(styleContains(root, 'shadow-sm')).toBe(true); expect(styleContains(file, 'bg-primary')).toBe(true);
  expect(styleContains(file, 'bg-muted-foreground/15')).toBe(false);
});
it('paints hover without changing selection, and clears on disabled, cancellation and detach', async () => {
  const { root, folder, file } = fixture('embedded'); await flush();
  folder.dispatchEvent(new PointerEvent('pointerenter')); await flush();
  expect(styleContains(folder, 'bg-muted-foreground/15')).toBe(true);
  expect(root.getExposes().value.get()).toBe('src/app.tsx');
  file.dispatchEvent(new PointerEvent('pointerenter')); file.dispatchEvent(new PointerEvent('pointerleave')); await flush();
  expect(styleContains(file, 'font-medium')).toBe(true); expect(styleContains(file, 'bg-muted-foreground/15')).toBe(true);
  setElementProps(folder, { appearance: 'embedded', nodeKey: 'src', textValue: 'src', disabled: true }); await flush();
  expect(styleContains(folder, 'bg-muted-foreground/15')).toBe(false); expect(styleContains(folder, 'data-[disabled]:opacity-50')).toBe(true); expect(folder.hasAttribute('data-disabled')).toBe(true); expect(folder.getAttribute('aria-disabled')).toBe('true');
  setElementProps(folder, { appearance: 'embedded', nodeKey: 'src', textValue: 'src', disabled: false }); await flush();
  expect(styleContains(folder, 'bg-muted-foreground/15')).toBe(false);
  folder.dispatchEvent(new PointerEvent('pointerenter')); folder.dispatchEvent(new PointerEvent('pointercancel')); await flush();
  expect(styleContains(folder, 'bg-muted-foreground/15')).toBe(false);
  folder.dispatchEvent(new PointerEvent('pointerenter')); await flush();
  setElementProps(folder, { appearance: 'default', nodeKey: 'src', textValue: 'src' }); await flush();
  expect(styleContains(folder, 'bg-muted-foreground/15')).toBe(false);
  expect(styleContains(folder, 'rounded-md')).toBe(true);
  setElementProps(folder, { appearance: 'embedded', nodeKey: 'src', textValue: 'src' }); await flush();
  expect(styleContains(folder, 'bg-muted-foreground/15')).toBe(false);
  expect(root.getExposes().value.get()).toBe('src/app.tsx');
  folder.dispatchEvent(new PointerEvent('pointerenter')); await flush(); folder.remove(); await flush(); root.prepend(folder); await flush();
  expect(styleContains(folder, 'bg-muted-foreground/15')).toBe(false);
});

it('collects embedded tokens through the existing public style compiler without seeded tokens', async () => {
  const { collectProtoStyleTokens } = await import('../../../cli/src/services/prototype-style-tokens');
  const { renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss } = await import('../../../cli/src/services/proto-style-css');
  const path = await import('node:path');
  const tokens = (await collectProtoStyleTokens(path.resolve('packages/prototypes/shadcn/src/tree'))).map((token) => {
    if (typeof token !== 'string') throw new TypeError('Expected a collected style token string');
    return token;
  });
  expect(tokens).toContain('bg-muted-foreground/15');
  expect(tokens).toContain('forced-colors-focus-outline');
  for (const css of [renderProtoStyleTokenCss(tokens), renderProtoShadowStyleTokenCss(tokens)]) {
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(css).toContain('color-mix(in oklab, var(--pui-muted-foreground) 15%, transparent)');
  }
});

it('keeps selected weight and square row geometry in generated CSS, not token names alone', async () => {
  const { collectProtoStyleTokens } = await import('../../../cli/src/services/prototype-style-tokens');
  const { renderProtoStyleTokenCss } = await import('../../../cli/src/services/proto-style-css');
  const { unwrapGeneratedTokenLayer } = await import('../../../../scripts/release/consumer-smoke-css.mjs');
  const path = await import('node:path');
  const tokens = (await collectProtoStyleTokens(path.resolve('packages/prototypes/shadcn/src/tree'))).map((token) => {
    if (typeof token !== 'string') throw new TypeError('Expected a collected style token string');
    return token;
  });
  const style = document.createElement('style');
  style.textContent = unwrapGeneratedTokenLayer(renderProtoStyleTokenCss(tokens));
  document.head.append(style);
  try {
    const { root, folder, file } = fixture('embedded'); await flush();
    expect(getComputedStyle(root).display).toBe('flex');
    expect(getComputedStyle(file).fontWeight).toBe('500');
    expect(getComputedStyle(folder).fontWeight).toBe('400');
    expect(getComputedStyle(file).borderRadius).toBe('0px');
  } finally { style.remove(); }
});
