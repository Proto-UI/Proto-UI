import { afterEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { formRoot, formSubmit } from '../src/form';
import { SHADCN_STYLE_TOKENS } from '../../../cli/src/generated/shadcn-style-tokens';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';
import { collectProtoStyleTokens } from '../../../cli/src/services/prototype-style-tokens';

for (const prototype of [formRoot, formSubmit]) {
  if (!customElements.get(prototype.name)) AdaptToWebComponent(prototype);
}
const owned: HTMLElement[] = [];
afterEach(() => {
  for (const element of owned.splice(0)) element.remove();
});

describe('shared Button paint cannot silently remove passive-consumer CSS', () => {
  it.each([
    ['new-york-v4', '90'],
    ['rhea', '80'],
  ])(
    'isolated Form consumer preserves %s hover%s and disabled restoration',
    async (styleProfile, opacity) => {
      const collected = await collectProtoStyleTokens(
        path.resolve('packages/prototypes/shadcn/src/form')
      );
      const css = renderProtoStyleTokenCss(collected);
      const root = document.createElement(formRoot.name);
      const submit = document.createElement(formSubmit.name) as HTMLElement & {
        getExposes(): { hovered: { get(): boolean } };
      };
      setElementProps(submit, { styleProfile });
      owned.push(root);
      root.append(submit);
      document.body.append(root);
      const flush = async () => {
        for (let i = 0; i < 24; i++) await Promise.resolve();
      };
      await flush();
      let count = 0;
      root.addEventListener('submit', () => count++);
      const enter = async () => {
        submit.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
        await flush();
      };
      await enter();
      const actual = (submit.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean);
      expect(actual).toContain(`bg-primary/${opacity}`);
      expect(actual).not.toContain(`bg-primary/${opacity === '90' ? '80' : '90'}`);
      for (const token of actual) expect(collected, token).toContain(token);
      expect(css).toContain(
        `background-color: color-mix(in oklab, var(--pui-primary) ${opacity}%, transparent);`
      );
      submit.click();
      await flush();
      expect(count).toBe(1);
      setElementProps(root, { disabled: true });
      await flush();
      await enter();
      expect(submit.getExposes().hovered.get()).toBe(false);
      expect(submit.getAttribute('data-pui-style')).not.toContain(`bg-primary/${opacity}`);
      submit.click();
      expect(count).toBe(1);
      setElementProps(root, { disabled: false });
      await flush();
      await enter();
      expect(submit.getAttribute('data-pui-style')).toContain(`bg-primary/${opacity}`);
      submit.click();
      await flush();
      expect(count).toBe(2);
    }
  );
  it('retains every runtime-authored Form Submit token after Button changes its own hover recipe', async () => {
    const root = document.createElement('shadcn-form-root');
    const submit = document.createElement('shadcn-form-submit');
    owned.push(root);
    root.append(submit);
    document.body.append(root);
    for (let index = 0; index < 16; index++) await Promise.resolve();
    submit.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    for (let index = 0; index < 16; index++) await Promise.resolve();
    expect(submit.hasAttribute('data-hovered')).toBe(true);
    const actual = (submit.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean);
    for (const token of actual) expect(SHADCN_STYLE_TOKENS, token).toContain(token);
    expect(renderProtoStyleTokenCss(actual)).toContain(
      'background-color: color-mix(in oklab, var(--pui-primary) 80%, transparent);'
    );
  });
});
