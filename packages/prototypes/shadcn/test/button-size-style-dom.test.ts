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
      expect(gaps).toEqual([props.size === 'sm' ? 'gap-1.5' : 'gap-2']);
      const css = getComputedStyle(el);
      if (props.size === 'sm') expect(css.gap).toBe('0.375rem');
    }
  });
});
