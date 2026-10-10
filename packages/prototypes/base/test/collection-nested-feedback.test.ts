import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as shadcn0 from '../../shadcn/src/carousel';
import * as shadcn1 from '../../shadcn/src/tree';
import * as shadcn2 from '../../shadcn/src/message-scroller';
import * as shadcn3 from '../../shadcn/src/data-table';
import * as shadcn4 from '../../shadcn/src/date-picker';
import * as brutalist0 from '../../brutalist/src/carousel';
import * as brutalist1 from '../../brutalist/src/tree';
import * as brutalist2 from '../../brutalist/src/message-scroller';
import * as brutalist3 from '../../brutalist/src/data-table';
import * as brutalist4 from '../../brutalist/src/date-picker';
import * as bootstrap0 from '../../bootstrap-2-3-2/src/carousel';
import * as bootstrap1 from '../../bootstrap-2-3-2/src/tree';
import * as bootstrap2 from '../../bootstrap-2-3-2/src/message-scroller';
import * as bootstrap3 from '../../bootstrap-2-3-2/src/data-table';
import * as bootstrap4 from '../../bootstrap-2-3-2/src/date-picker';
import * as liquid0 from '../../liquid-glass/src/carousel';
import * as liquid1 from '../../liquid-glass/src/tree';
import * as liquid2 from '../../liquid-glass/src/message-scroller';
import * as liquid3 from '../../liquid-glass/src/data-table';
import * as liquid4 from '../../liquid-glass/src/date-picker';
const families = {
  'shadcn': [shadcn0, shadcn1, shadcn2, shadcn3, shadcn4],
  'brutalist': [brutalist0, brutalist1, brutalist2, brutalist3, brutalist4],
  'bootstrap-2-3-2': [bootstrap0, bootstrap1, bootstrap2, bootstrap3, bootstrap4],
  'liquid-glass': [liquid0, liquid1, liquid2, liquid3, liquid4],
};
const roots: HTMLElement[] = [];
const flush = async () => {
  for (let i = 0; i < 24; i++) await Promise.resolve();
};
afterEach(async () => {
  roots.splice(0).forEach((root) => root.remove());
  await flush();
});
const node = (family: string, name: string, props: Record<string, unknown> = {}) => {
  const el = document.createElement(`nested-${family}-${name}`) as any;
  setElementProps(el, props);
  return el;
};
const controls = [
  ['carousel', 'previous'],
  ['carousel', 'next'],
  ['tree', 'toggle'],
  ['message-scroller', 'jump'],
  ['data-table', 'previous'],
  ['data-table', 'next'],
  ['date-picker', 'trigger'],
  ['date-picker', 'day'],
] as const;
const pressToken = {
  shadcn: 'translate-y-px',
  brutalist: 'translate-x-1',
  'bootstrap-2-3-2': 'shadow-[inset_0_2px_4px_rgb(0_0_0/15%),0_1px_2px_rgb(0_0_0/5%)]',
  'liquid-glass': 'shadow-xs',
};
for (const [family, modules] of Object.entries(families)) {
  for (const module of modules)
    for (const proto of new Set(Object.values(module)))
      if (proto && typeof proto === 'object' && 'setup' in proto)
        AdaptToWebComponent(proto, { registerAs: `nested-${proto.name}` });
  for (const [component, part] of controls)
    it(`${family}/${component}-${part} consumes real disabled, focus and pressed state without flattening`, async () => {
      const root = node(
        family,
        `${component}-root`,
        component === 'carousel'
          ? { defaultIndex: 1, disabled: true }
          : component === 'date-picker'
            ? { defaultMonth: '2026-10', defaultValue: '2026-10-01' }
            : {}
      );
      if (component === 'carousel') {
        const viewport = node(family, 'carousel-viewport');
        for (let index = 0; index < 3; index++)
          viewport.append(node(family, 'carousel-slide', { index }));
        root.append(viewport);
      }
      const ownProps =
        part === 'day' ? { date: '2026-10-12' } : part === 'toggle' ? { nodeKey: 'a' } : {};
      const control = node(family, `${component}-${part}`, { ...ownProps, disabled: true });
      root.append(control);
      roots.push(root);
      document.body.append(root);
      await flush();
      const exposed = control.getExposes();
      expect(exposed.disabled.get()).toBe(true);
      expect(control.getAttribute('aria-disabled')).toBe('true');
      const tokens = () => (control.getAttribute('data-pui-style') ?? '').split(/\s+/);
      expect(tokens()).toContain('data-[disabled]:opacity-50');
      expect(tokens()).toContain('data-[focus-visible]:ring-2');
      expect(tokens()).toContain(
        `data-[pressed]:not-[data-disabled]:${pressToken[family as keyof typeof pressToken]}`
      );
      control.dispatchEvent(new Event('pointerdown'));
      await flush();
      expect(exposed.pressed.get()).toBe(false);
      setElementProps(control, { ...ownProps, disabled: false });
      if (component === 'carousel') setElementProps(root, { disabled: false });
      await flush();
      expect(exposed.disabled.get()).toBe(false);
      exposed.focusSelf({ reason: 'keyboard' });
      await flush();
      expect(exposed.focusVisible.get()).toBe(true);
      expect(control.hasAttribute('data-focus-visible')).toBe(true);
      control.dispatchEvent(new Event('pointerdown'));
      await flush();
      expect(exposed.pressed.get()).toBe(true);
      expect(control.hasAttribute('data-pressed')).toBe(true);
      control.dispatchEvent(new Event('pointercancel'));
      await flush();
      expect(exposed.pressed.get()).toBe(false);
      expect(control.hasAttribute('data-pressed')).toBe(false);
      control.dispatchEvent(new Event('pointerdown'));
      await flush();
      setElementProps(control, { ...ownProps, disabled: true });
      await flush();
      expect(exposed.disabled.get()).toBe(true);
      expect(exposed.pressed.get()).toBe(false);
      expect(control.tabIndex).toBe(-1);
      if (component === 'date-picker' && part === 'day') {
        setElementProps(control, { ...ownProps, disabled: false });
        await flush();
        root.getExposes().openPopover();
        await flush();
        control.click();
        await flush();
        expect(root.getExposes().value.get()).toBe('2026-10-12');
        expect(root.getExposes().open.get()).toBe(false);
        expect(exposed.selected.get()).toBe(true);
        expect(tokens().some((token: string) => token.startsWith('data-[selected]:bg-'))).toBe(
          true
        );
      }
    });
}

for (const family of Object.keys(families))
  it(`${family}/message-scroller-viewport consumes its real nested ScrollArea focus`, async () => {
    const root = node(family, 'message-scroller-root');
    const viewport = node(family, 'message-scroller-viewport');
    root.append(viewport);
    roots.push(root);
    document.body.append(root);
    await flush();
    expect(viewport.getAttribute('data-pui-style')).toContain('data-[focus-visible]:ring-2');
    viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    viewport.focus();
    await flush();
    expect(viewport.getExposes().focused.get()).toBe(true);
    expect(viewport.getExposes().focusVisible.get()).toBe(true);
    expect(viewport.hasAttribute('data-focus-visible')).toBe(true);
  });
