import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import button from '../src/button';
import { SHADCN_STYLE_TOKENS } from '../../../cli/src/generated/shadcn-style-tokens';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';
for (const prototype of [button]) {
  if (!customElements.get(prototype.name)) AdaptToWebComponent(prototype);
}
const owned: HTMLElement[] = [];
const flush = async () => {
  for (let i = 0; i < 25; i++) await Promise.resolve();
};
afterEach(async () => {
  for (const el of owned.splice(0)) el.remove();
  await flush();
});
describe('Independent shared Button migration regression review', () => {
  it('applies the intended sm gap while size and wrapping props change', async () => {
    // Happy DOM cannot evaluate this stylesheet's @layer. Keep the actual gap
    // selector blocks in their emitted order to test the cascade, without
    // changing any declaration or emulating native geometry.
    const emitted = renderProtoStyleTokenCss(SHADCN_STYLE_TOKENS);
    const blocks = [
      ...emitted.matchAll(/:where\(\[data-pui-style~="gap-[^"]+"\]\)\s*\{[^}]+\}/g),
    ].map((m) => m[0]);
    const style = document.createElement('style');
    style.textContent = blocks.join('\n');
    const el = document.createElement(button.name);
    el.textContent = 'Button';
    owned.push(style, el);
    document.head.append(style);
    document.body.append(el);
    await flush();
    for (const props of [
      { size: 'default' },
      { size: 'sm' },
      { size: 'sm', wrap: true },
      { size: 'icon' },
      { size: 'default', wrap: true },
      { size: 'sm' },
    ]) {
      setElementProps(el, props);
      await flush();
      const tokens = (el.getAttribute('data-pui-style') ?? '').split(/\s+/);
      const gaps = tokens.filter((token) => /^gap-/.test(token));
      expect(gaps).toEqual(
        props.size === 'icon' ? [] : [props.size === 'sm' ? 'gap-1' : 'gap-1.5']
      );
      const css = getComputedStyle(el);
      if (props.size === 'sm') expect(css.gap).toBe('0.25rem');
    }
  });
});

it('keeps icon-compact fixed through wrap and size transitions without changing defaults', async () => {
  // Preserve official emitted declarations; Happy DOM cannot apply @layer.
  const style = document.createElement('style');
  style.textContent = [
    ...renderProtoStyleTokenCss(SHADCN_STYLE_TOKENS).matchAll(
      /:where\(\[data-pui-style~="size-(?:7|8)"\]\)\s*\{[^}]+\}/g
    ),
  ]
    .map((match) => match[0])
    .join('\n');
  expect(style.textContent).toContain('1.75rem');
  owned.push(style);
  document.head.append(style);
  const el = document.createElement(button.name);
  el.textContent = 'Copy source';
  owned.push(el);
  document.body.append(el);
  await flush();
  for (const props of [
    { size: 'icon-compact', wrap: false },
    { size: 'icon-compact', wrap: true },
    { size: 'icon', wrap: true },
    { size: 'sm', wrap: true },
    {},
  ]) {
    setElementProps(el, props);
    await flush();
    const tokens = (el.getAttribute('data-pui-style') ?? '').split(/\s+/);
    if (props.size === 'icon-compact') {
      expect(tokens).toContain('size-7');
      expect(tokens).not.toContain('size-8');
      expect([getComputedStyle(el).width, getComputedStyle(el).height]).toEqual(['28px', '28px']);
      expect(tokens).not.toContain('h-auto');
      expect(tokens).not.toContain('min-h-7');
    } else if (props.size === 'icon') {
      expect(tokens).toContain('size-8');
      expect(tokens).not.toContain('size-7');
    } else if (props.size === 'sm') {
      expect(tokens).toContain('h-auto');
      expect(tokens).toContain('min-h-7');
    } else {
      expect(tokens).toContain('h-8');
      expect(tokens).not.toContain('size-7');
    }
    expect(tokens.filter((token) => token.startsWith('gap-'))).toEqual(
      props.size === 'icon'
        ? []
        : [props.size === 'sm' ? 'gap-1' : props.size === 'icon-compact' ? 'gap-2' : 'gap-1.5']
    );
    expect(el.getAttribute('role')).toBe('button');
    expect(el.textContent).toBe('Copy source');
  }
});
