import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { toggleGroupRoot, toggleGroupItem } from '../src/toggle-group';
import shadcnRoot from '../../shadcn/src/toggle-group/root.proto';
import brutalistRoot from '../../brutalist/src/toggle-group/root.proto';
import bootstrapRoot from '../../bootstrap-2-3-2/src/toggle-group/root.proto';
import glassRoot from '../../liquid-glass/src/toggle-group/root.proto';

const roots = [shadcnRoot, brutalistRoot, bootstrapRoot, glassRoot];
for (const proto of [toggleGroupRoot, toggleGroupItem, ...roots]) AdaptToWebComponent(proto);
const owned: HTMLElement[] = [];
function element(name: string, props: Record<string, unknown> = {}) {
  const node = document.createElement(name) as HTMLElement & {
    getExposes(): { getValue(): string[]; count: { get(): number } };
  };
  setElementProps(node, props);
  owned.push(node);
  return node;
}
async function flush() {
  for (let i = 0; i < 16; i++) await Promise.resolve();
}
afterEach(async () => {
  for (const node of owned.splice(0)) node.remove();
  await flush();
});
const tokens = (node: HTMLElement) => (node.getAttribute('data-pui-style') ?? '').split(' ');
function expectAxis(node: HTMLElement, orientation: string) {
  expect(node.getAttribute('aria-orientation')).toBe(orientation);
  expect(tokens(node)).toContain('flex');
  expect(tokens(node).includes('flex-col')).toBe(orientation === 'vertical');
}
async function mount(name: string, props: Record<string, unknown> = {}) {
  const root = element(name, props);
  const a = element(toggleGroupItem.name, { value: 'a' });
  const b = element(toggleGroupItem.name, { value: 'b' });
  root.append(a, b);
  document.body.append(root);
  await flush();
  return { root, a, b };
}
for (const proto of roots)
  describe(proto.name, () => {
    it.each([{}, { orientation: 'horizontal' }, { orientation: 'vertical' }])(
      'projects the initial effective axis %j',
      async (props) => {
        const { root } = await mount(proto.name, props);
        expectAxis(root, props.orientation ?? 'horizontal');
      }
    );
    it('withdraws vertical contribution and preserves the exact horizontal paint and selection', async () => {
      const { root, b } = await mount(proto.name);
      b.click();
      await flush();
      const horizontal = root.getAttribute('data-pui-style');
      for (const orientation of ['vertical', 'horizontal', 'vertical', 'horizontal']) {
        setElementProps(root, { orientation });
        await flush();
        expectAxis(root, orientation);
        expect(root.getExposes().getValue()).toEqual(['b']);
        expect(root.getExposes().count.get()).toBe(2);
        if (orientation === 'horizontal')
          expect(root.getAttribute('data-pui-style')).toBe(horizontal);
      }
    });
    it.each(['diagonal', 123, null, undefined])(
      'preserves Base normalization for provided %s',
      async (orientation) => {
        const { root } = await mount(proto.name, { orientation });
        const { root: base } = await mount(toggleGroupRoot.name, { orientation });
        expectAxis(root, 'horizontal');
        expect(root.getAttribute('aria-orientation')).toBe(base.getAttribute('aria-orientation'));
        for (const next of ['vertical', orientation]) {
          setElementProps(root, { orientation: next });
          setElementProps(base, { orientation: next });
          await flush();
          expectAxis(root, 'vertical');
          expect(root.getAttribute('aria-orientation')).toBe(base.getAttribute('aria-orientation'));
        }
        setElementProps(root, {});
        setElementProps(base, {});
        await flush();
        expectAxis(root, 'horizontal');
        expect(root.getAttribute('aria-orientation')).toBe(base.getAttribute('aria-orientation'));
      }
    );
    it('keeps the keyboard axis with one tab stop and no navigation selection', async () => {
      const { root, a, b } = await mount(proto.name);
      for (const [orientation, wrong, correct] of [
        ['horizontal', 'ArrowDown', 'ArrowRight'],
        ['vertical', 'ArrowRight', 'ArrowDown'],
        ['horizontal', 'ArrowDown', 'ArrowRight'],
      ]) {
        setElementProps(root, { orientation });
        await flush();
        a.focus();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: wrong, bubbles: true }));
        await flush();
        expect(document.activeElement).toBe(a);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: correct, bubbles: true }));
        await flush();
        expect(document.activeElement).toBe(b);
        expect([a.tabIndex, b.tabIndex].filter((value) => value === 0)).toHaveLength(1);
        expect(root.getExposes().getValue()).toEqual([]);
        expectAxis(root, orientation);
      }
    });
  });
