import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as shadcn from '../../shadcn/src/checkbox-group';
import * as neo from '../../brutalist/src/checkbox-group';
import * as bootstrap from '../../bootstrap-2-3-2/src/checkbox-group';
for (const group of [shadcn, neo, bootstrap])
  for (const proto of Object.values(group))
    if (typeof proto === 'object' && proto && 'setup' in proto) AdaptToWebComponent(proto as any);
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 5));
};
const tokens = (el: Element) => (el.getAttribute('data-pui-style') ?? '').split(/\s+/);
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
for (const family of ['shadcn', 'brutalist', 'bootstrap-2-3-2']) {
  it(`${family} paints a passive box beside normal text, not a selected card`, async () => {
    const root = document.createElement(`${family}-checkbox-group-root`) as any;
    const all = document.createElement(`${family}-checkbox-group-all`) as any;
    const a = document.createElement(`${family}-checkbox-group-item`) as any;
    const b = document.createElement(`${family}-checkbox-group-item`) as any;
    setElementProps(root, { value: ['a'] });
    setElementProps(a, { value: 'a' });
    setElementProps(b, { value: 'b' });
    a.textContent = 'Email notifications';
    b.textContent = 'SMS notifications';
    all.textContent = 'All notifications';
    root.append(all, a, b);
    document.body.append(root);
    await flush();
    const svg = (el: Element) => el.shadowRoot?.querySelector('svg') ?? el.querySelector('svg');
    const box = (el: Element) => svg(el)!.parentElement!;
    for (const el of [a, b, all]) {
      expect(tokens(el).some((x) => /^(?:bg-|border(?:-|$)|shadow-|px-3|py-2)/.test(x))).toBe(
        false
      );
      expect(tokens(box(el))).toContain('shrink-0');
      expect(box(el).hasAttribute('role')).toBe(false);
      expect(box(el).hasAttribute('tabindex')).toBe(false);
      expect(svg(el)!.getAttribute('aria-hidden')).toBe('true');
      expect(el.getAttribute('role')).toBe('checkbox');
    }
    const selected = family === 'brutalist' ? 'bg-main' : 'bg-primary';
    expect(tokens(box(a))).toContain(selected);
    expect(tokens(box(all))).toContain(selected);
    expect(tokens(box(b))).not.toContain(selected);
    expect(svg(a)!.querySelector('path')).not.toBeNull();
    expect(svg(all)!.querySelector('path')!.getAttribute('d')).toBe(
      family === 'bootstrap-2-3-2' ? 'M5 12H19' : 'M5 12h14'
    );
    expect(svg(b)!.querySelector('path')).toBeNull();
    let proposals = 0;
    root.addEventListener('valueChange', () => proposals++);
    b.click();
    await flush();
    expect(proposals).toBe(1);
    expect(tokens(box(b))).not.toContain(selected);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    b.getExposes().focusSelf({ reason: 'keyboard' });
    await flush();
    expect(b.getExposes().focusVisible.get()).toBe(true);
    b.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    b.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
    await flush();
    expect(proposals).toBe(2);
    expect(tokens(box(b))).not.toContain(selected);
    setElementProps(root, { value: ['a', 'b'] });
    await flush();
    expect(tokens(box(b))).toContain(selected);
    expect(all.getAttribute('aria-checked')).toBe('true');
    setElementProps(root, { value: [], disabled: true });
    await flush();
    b.click();
    expect(proposals).toBe(2);
    expect(tokens(box(b))).not.toContain(selected);
    expect(b.getAttribute('aria-disabled')).toBe('true');
    expect(tokens(b)).toContain('data-[disabled]:cursor-not-allowed');
    expect(tokens(b)).toContain('data-[focus-visible]:forced-colors-focus-outline');
    expect(a.textContent).toContain('Email notifications');
  });
}
