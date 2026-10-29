import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { menubarRoot, menubarTrigger, menubarContent, menubarItem } from '../src/menubar';
import { styleContains } from '../../test-utils/style';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';
for (const p of [menubarRoot, menubarTrigger, menubarContent, menubarItem])
  AdaptToWebComponent(p as any);
const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  await settle();
});
function element(name: string, props: Record<string, unknown> = {}): any {
  const result = document.createElement(name);
  setElementProps(result, props);
  return result;
}
async function fixture(profile: string, controlled = false) {
  const root = element(menubarRoot.name, {
    styleProfile: profile,
    ...(controlled ? { value: 'file' } : {}),
  });
  const trigger = element(menubarTrigger.name, { value: 'file' });
  trigger.textContent = 'File';
  const content = element(menubarContent.name, { value: 'file' });
  const item = element(menubarItem.name, { value: 'new', textValue: 'New' });
  item.textContent = 'New';
  content.append(item);
  root.append(trigger, content);
  document.body.append(root);
  await settle();
  return { root, trigger, content, item };
}
describe('Menubar bounded New York / Rhea projection', () => {
  it.each(['new-york-v4', 'rhea'])(
    'projects root and expanded/focused facts %s',
    async (profile) => {
      const f = await fixture(profile);
      expect(styleContains(f.root, profile === 'rhea' ? 'h-8' : 'h-9')).toBe(true);
      expect(styleContains(f.trigger, profile === 'rhea' ? 'px-1.5' : 'px-2')).toBe(true);
      f.trigger.click();
      await settle();
      expect(f.root.getExposes().value.get()).toBe('file');
      expect(f.trigger.getExposes().expanded.get()).toBe(true);
      expect(styleContains(f.trigger, profile === 'rhea' ? 'bg-muted' : 'bg-accent')).toBe(true);
      expect(styleContains(f.content, profile === 'rhea' ? 'min-w-36' : 'min-w-48')).toBe(true);
      f.item.focus();
      await settle();
      expect(f.item.getExposes().focused.get()).toBe(true);
      expect(f.item.hasAttribute('data-focused')).toBe(true);
      expect(styleContains(f.item, 'data-[focused]:bg-accent')).toBe(true);
      expect(styleContains(f.item, 'data-[focused]:text-accent-foreground')).toBe(true);
      expect(styleContains(f.item, 'bg-primary')).toBe(false);
      expect(styleContains(f.item, 'data-[focused]:bg-primary')).toBe(false);
      expect(styleContains(f.item, 'px-2')).toBe(true);
      expect(styleContains(f.item, 'py-1.5')).toBe(true);
    }
  );
  it('withdraws old profile contributions without changing value or part identity', async () => {
    const f = await fixture('new-york-v4', true);
    const value = f.root.getExposes().value;
    const events: unknown[] = [];
    f.root.addEventListener('valueChange', (e: any) => events.push(e.detail));
    for (const profile of ['rhea', 'new-york-v4', 'rhea']) {
      setElementProps(f.root, { styleProfile: profile, value: 'file' });
      await settle();
      expect(f.root.getExposes().value).toBe(value);
      expect(value.get()).toBe('file');
      expect(f.trigger.isConnected).toBe(true);
      expect(f.content.isConnected).toBe(true);
      expect(styleContains(f.root, 'shadow-xs')).toBe(profile === 'new-york-v4');
      expect(styleContains(f.trigger, 'bg-muted')).toBe(profile === 'rhea');
      expect(styleContains(f.trigger, 'bg-accent')).toBe(profile === 'new-york-v4');
      expect(styleContains(f.content, 'border')).toBe(profile === 'new-york-v4');
      expect(styleContains(f.content, 'ring-1')).toBe(profile === 'rhea');
    }
    expect(events).toEqual([]);
    const selections: unknown[] = [];
    f.item.addEventListener('select', (e: any) => selections.push(e.detail));
    // Positive control: the controlled owner rejects closure, but the request must remain observable.
    f.item.click();
    await settle();
    expect(selections).toEqual([{ value: 'new', menuValue: 'file' }]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ value: '' });
    expect(value.get()).toBe('file');
    selections.length = 0;
    events.length = 0;
    setElementProps(f.item, { value: 'new', disabled: true });
    await settle();
    expect(f.item.getExposes().disabled.get()).toBe(true);
    expect(f.item.hasAttribute('data-disabled')).toBe(true);
    expect(styleContains(f.item, 'data-[disabled]:opacity-50')).toBe(true);
    expect(styleContains(f.item, 'data-[disabled]:pointer-events-none')).toBe(true);
    f.item.click();
    await settle();
    expect(selections).toEqual([]);
    expect(events).toEqual([]);
    expect(value.get()).toBe('file');
  });
  it('projects closed Rhea keyboard focus facts without opening its panel', async () => {
    const f = await fixture('rhea');
    expect(f.root.getExposes().value.get()).toBe('');
    expect(f.trigger.getExposes().expanded.get()).toBe(false);
    expect(styleContains(f.trigger, 'ring-2')).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    const matches = f.trigger.matches.bind(f.trigger);
    vi.spyOn(f.trigger, 'matches').mockImplementation((selector) =>
      selector === ':focus-visible' ? true : matches(selector)
    );
    f.trigger.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    await settle();
    expect(f.trigger.getExposes().focusVisible.get()).toBe(true);
    expect(f.root.getExposes().value.get()).toBe('');
    expect(f.trigger.getExposes().expanded.get()).toBe(false);
    expect(styleContains(f.trigger, 'bg-muted')).toBe(false);
    expect(styleContains(f.trigger, 'ring-2')).toBe(true);
    expect(styleContains(f.trigger, 'ring-inset')).toBe(true);
    expect(styleContains(f.trigger, 'ring-ring')).toBe(true);
    expect(styleContains(f.trigger, 'forced-colors-focus-outline')).toBe(true);
    f.trigger.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    await settle();
    expect(f.trigger.getExposes().focusVisible.get()).toBe(false);
    expect(styleContains(f.trigger, 'ring-2')).toBe(false);
  });
  it('keeps source units and separately lowers modern theme slots', () => {
    const css = renderProtoStyleTokenCss([
      'h-9',
      'h-8',
      'p-[3px]',
      'py-[2px]',
      'px-1.5',
      'min-w-48',
      'min-w-36',
      'min-h-7',
      'rounded-[var(--pui-radius-2xl)]',
      'ring-foreground/5',
    ]);
    expect(css).toContain('height: 2.25rem;');
    expect(css).toContain('height: 2rem;');
    expect(css).toContain('padding: 3px;');
    expect(css).toContain('padding-block: 2px;');
    expect(css).toContain('min-width: 12rem;');
    expect(css).toContain('min-width: 9rem;');
    expect(css).toContain('border-radius: var(--pui-radius-2xl);');
  });
});
