import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { collectProtoStyleTokens } from '../../../cli/src/services/prototype-style-tokens';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';
import path from 'node:path';
import * as base from '../src/form';
import * as shadcn from '../../shadcn/src/form';
import * as brutalist from '../../brutalist/src/form';
import * as bootstrap from '../../bootstrap-2-3-2/src/form';
import * as liquid from '../../liquid-glass/src/form';
const groups = { base, shadcn, brutalist, 'bootstrap-2-3-2': bootstrap, 'liquid-glass': liquid };
for (const group of Object.values(groups))
  for (const proto of Object.values(group))
    if (typeof proto === 'object' && proto && 'setup' in proto) AdaptToWebComponent(proto as any);
const flush = async () => {
  for (let i = 0; i < 35; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
for (const family of Object.keys(groups))
  it(`${family} Form actions keep one activation owner, real focus and disabled policy`, async () => {
    const form = document.createElement(family + '-form-root') as any;
    const submit = document.createElement(family + '-form-submit') as any,
      reset = document.createElement(family + '-form-reset') as any;
    submit.textContent = 'Submit';
    reset.textContent = 'Reset';
    form.append(submit, reset);
    document.body.append(form);
    await flush();
    let submissions = 0,
      resets = 0;
    form.addEventListener('submit', () => submissions++);
    form.addEventListener('reset', () => resets++);
    submit.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    submit.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0 })
    );
    await flush();
    expect(submit.getExposes().hovered.get()).toBe(true);
    expect(submit.getExposes().pressed.get()).toBe(true);
    submit.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, button: 0 }));
    submit.click();
    await flush();
    expect(submissions).toBe(1);
    expect(submit.getExposes().pressed.get()).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    reset.getExposes().focusSelf({ reason: 'keyboard' });
    await flush();
    expect(reset.getExposes().focused.get()).toBe(true);
    expect(reset.getExposes().focusVisible.get()).toBe(true);
    reset.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
    );
    reset.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
    await flush();
    expect(resets).toBe(1);
    setElementProps(form, { disabled: true });
    await flush();
    expect(submit.getExposes().hovered.get()).toBe(false);
    expect(submit.getExposes().pressed.get()).toBe(false);
    expect(reset.getAttribute('aria-disabled')).toBe('true');
    submit.click();
    reset.click();
    await flush();
    expect(submissions).toBe(1);
    expect(resets).toBe(1);
    setElementProps(reset, { disabled: true });
    setElementProps(form, { disabled: false });
    await flush();
    expect(submit.getExposes().disabled.get()).toBe(false);
    expect(reset.getExposes().disabled.get()).toBe(true);
    submit.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, pointerId: 2, button: 0 })
    );
    submit.remove();
    await flush();
    form.append(submit);
    await flush();
    expect(submit.getExposes().pressed.get()).toBe(false);
    for (const action of [submit, reset]) {
      const proto = (groups as any)[family][action === submit ? 'formSubmit' : 'formReset'];
      expect((proto as any).__asHooks?.filter((x: any) => x.name === 'as-button') ?? []).toEqual(
        []
      );
    }
  });
for (const family of ['shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'])
  it(`${family} Form recipes reach the actual collector and physical CSS`, async () => {
    const tokens = (await collectProtoStyleTokens(
      path.resolve('packages/prototypes/' + family + '/src/form')
    )) as string[];
    const css = renderProtoStyleTokenCss(tokens);
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(
      tokens.some((x) => x.includes('focus-visible') && x.includes('ring-')),
      tokens.join('\n')
    ).toBe(true);
    expect(tokens.some((x) => x.includes('disabled') && x.includes('opacity-'))).toBe(true);
    expect(
      tokens.some(
        (x) => x.includes('pressed') && (x.includes('shadow-') || x.includes('translate-'))
      )
    ).toBe(true);
    expect(tokens.some((x) => x.includes('hovered'))).toBe(true);
    if (family === 'bootstrap-2-3-2') {
      expect(tokens).toContain('bg-[linear-gradient(#08c,#04c)]');
      expect(tokens).toContain('bg-[linear-gradient(#fff,#e6e6e6)]');
      expect(css).toContain('linear-gradient(#08c,#04c)');
      expect(css).toContain('inset 0 2px 4px');
    }
    if (family === 'brutalist') {
      expect(tokens).toContain('rounded-base');
      expect(tokens).toContain('border-black');
      expect(tokens).toContain('font-medium');
      expect(tokens).toContain('shadow-[4px_4px_0_0_#000]');
      expect(css).toContain('4px 4px 0 0 #000');
      expect(css).toContain('--pui-font-sans');
    }
  });
import * as shadcnCheckbox from '../../shadcn/src/checkbox-group';
import * as brutalistCheckbox from '../../brutalist/src/checkbox-group';
import * as bootstrapCheckbox from '../../bootstrap-2-3-2/src/checkbox-group';
import * as liquidCheckbox from '../../liquid-glass/src/checkbox-group';
for (const group of [shadcnCheckbox, brutalistCheckbox, bootstrapCheckbox, liquidCheckbox])
  for (const p of Object.values(group))
    if (typeof p === 'object' && p && 'setup' in p) AdaptToWebComponent(p as any);
for (const family of ['shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'])
  it(`${family} Checkbox Group has passive checked/mixed glyphs and unchanged controlled ownership`, async () => {
    const root = document.createElement(family + '-checkbox-group-root') as any;
    const a = document.createElement(family + '-checkbox-group-item') as any,
      b = document.createElement(family + '-checkbox-group-item') as any,
      all = document.createElement(family + '-checkbox-group-all') as any;
    setElementProps(root, { value: ['a'] });
    setElementProps(a, { value: 'a' });
    setElementProps(b, { value: 'b' });
    a.textContent = 'Email';
    b.textContent = 'SMS';
    all.textContent = 'All';
    root.append(all, a, b);
    document.body.append(root);
    await flush();
    await new Promise((resolve) => setTimeout(resolve, 5));
    await flush();
    const svg = (el: any) => el.shadowRoot?.querySelector('svg') ?? el.querySelector('svg');
    const glyph = (el: any) => svg(el)?.querySelector('path')?.getAttribute('d') ?? null;
    expect(glyph(a)).toBe(family === 'bootstrap-2-3-2' ? 'M5 12L10 17L19 7' : 'm20 6-11 11-5-5');
    expect(glyph(b)).toBe(null);
    expect(glyph(all)).toBe(family === 'bootstrap-2-3-2' ? 'M5 12H19' : 'M5 12h14');
    expect(svg(a).getAttribute('aria-hidden')).toBe('true');
    expect(svg(a).getAttribute('tabindex')).toBe(null);
    expect(svg(a).getAttribute('role')).toBe(null);
    expect(svg(a).getAttribute('width')).toBe('16');
    expect(svg(a).getAttribute('stroke-width')).toBe(family === 'brutalist' ? '3' : '2');
    let proposals = 0;
    root.addEventListener('valueChange', () => proposals++);
    b.click();
    await flush();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(proposals).toBe(1);
    expect(glyph(b)).toBe(null);
    expect(root.getExposes().getValue()).toEqual(['a']);
    setElementProps(root, { value: ['a', 'b'] });
    await flush();
    await new Promise((resolve) => setTimeout(resolve, 5));
    await flush();
    expect(glyph(all)).toBe(glyph(a));
    expect(all.getAttribute('aria-checked')).toBe('true');
    setElementProps(root, { value: [], disabled: true });
    await flush();
    await new Promise((resolve) => setTimeout(resolve, 5));
    await flush();
    expect(glyph(a)).toBe(null);
    expect(glyph(all)).toBe(null);
    a.click();
    expect(proposals).toBe(1);
    const tokens = (await collectProtoStyleTokens(
      path.resolve('packages/prototypes/' + family + '/src/checkbox-group')
    )) as string[];
    const css = renderProtoStyleTokenCss(tokens);
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    for (const state of ['checked', 'indeterminate', 'focus-visible', 'disabled']) {
      expect(
        tokens.some((x) => x.includes('data-[' + state + ']:')),
        tokens.join('\n')
      ).toBe(true);
    }
  });
