import { afterEach, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import button from '../src/button';
import { SHADCN_STYLE_TOKENS } from '../../../cli/src/generated/shadcn-style-tokens';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';

// Fixed 02cad611 direct Button, not independently pinned compound paint.ts.
if (!customElements.get(button.name)) AdaptToWebComponent(button);
const owned: HTMLElement[] = [];
const flush = async () => {
  for (let i = 0; i < 25; i++) await Promise.resolve();
};
const tokens = (el: HTMLElement) => (el.getAttribute('data-pui-style') ?? '').split(/\s+/);
afterEach(async () => {
  for (const el of owned.splice(0)) el.remove();
  document.documentElement.classList.remove('dark', 'light');
  await flush();
});
async function mount(variant = 'default') {
  const el = document.createElement(button.name);
  el.textContent = 'Command';
  owned.push(el);
  setElementProps(el, { styleProfile: 'new-york', variant });
  document.body.append(el);
  await flush();
  return el;
}
it.each([
  ['default', 'bg-primary', 'bg-primary/90'],
  ['destructive', 'bg-destructive', 'bg-destructive/90'],
  ['outline', 'bg-background', 'bg-accent'],
  ['secondary', 'bg-secondary', 'bg-secondary/80'],
  ['ghost', 'bg-transparent', 'bg-accent'],
  ['link', 'bg-transparent', 'underline'],
])('projects legacy %s rest/hover and removes modern tokens', async (variant, rest, hover) => {
  document.documentElement.classList.add('light');
  const el = await mount(variant);
  expect(tokens(el)).toContain(rest);
  expect(tokens(el)).toContain('rounded-md');
  expect(tokens(el)).not.toContain('border-transparent');
  el.dispatchEvent(new PointerEvent('pointerenter'));
  await flush();
  expect(tokens(el)).toContain(hover);
  expect(tokens(el)).not.toContain('bg-muted');
  expect(tokens(el)).not.toContain('bg-destructive/10');
  if (variant === 'destructive') expect(tokens(el)).toContain('text-white');
  if (variant === 'outline') expect(tokens(el)).toContain('shadow-xs');
  el.dispatchEvent(new PointerEvent('pointerleave'));
  await flush();
  expect(tokens(el)).toContain(rest);
  expect(tokens(el)).not.toContain(hover);
});
it('keeps legacy dark outline/destructive branches and focus at their pinned values', async () => {
  document.documentElement.classList.add('dark');
  const el = await mount('outline');
  await vi.waitFor(() => expect(tokens(el)).toContain('bg-input/30'));
  expect(tokens(el)).toContain('border-input');
  el.dispatchEvent(new PointerEvent('pointerenter'));
  await flush();
  expect(tokens(el)).toContain('bg-input/50');
  setElementProps(el, { styleProfile: 'new-york', variant: 'destructive' });
  await flush();
  expect(tokens(el)).toContain('bg-destructive/60');
  expect(tokens(el)).toContain('text-white');
  el.dispatchEvent(new PointerEvent('pointerleave'));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  el.focus();
  await flush();
  expect(tokens(el)).toContain('ring-destructive/40');
  setElementProps(el, { styleProfile: 'new-york', variant: 'ghost' });
  await flush();
  expect(tokens(el)).toContain('ring-ring/50');
  expect(tokens(el)).not.toContain('ring-ring/30');
  setElementProps(el, { styleProfile: 'rhea', variant: 'ghost' });
  await flush();
  expect(tokens(el)).toContain('ring-ring/30');
  expect(tokens(el)).not.toContain('ring-ring/50');
});
it('closes all three explicit profiles, supported variants, sizes and wrap states through the actual official preset', async () => {
  const el = await mount();
  const heights = {
    'new-york': { default: '9', sm: '8', lg: '10', icon: '9', 'icon-compact': '7' },
    rhea: { default: '8', sm: '7', lg: '9', icon: '8', 'icon-compact': '7' },
    luma: { default: '9', sm: '8', lg: '10', icon: '9', 'icon-compact': '7' },
  } as const;
  for (const profile of ['new-york', 'rhea', 'luma'] as const)
    for (const variant of ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'])
      for (const size of ['default', 'sm', 'lg', 'icon', 'icon-compact'] as const)
        for (const wrap of [false, true]) {
          setElementProps(el, { styleProfile: profile, variant, size, wrap });
          await flush();
          const actual = tokens(el);
          const icon = size === 'icon' || size === 'icon-compact';
          expect(actual).toContain(
            `${icon ? 'size' : wrap ? 'min-h' : 'h'}-${heights[profile][size]}`
          );
          if (!icon) {
            const padding =
              profile === 'new-york'
                ? { default: '4', sm: '3', lg: '6' }
                : { default: '3', sm: '3', lg: '4' };
            expect(actual).toContain(`px-${padding[size]}`);
          }
          expect(actual.includes('h-auto')).toBe(wrap && !icon);
          expect(actual.includes('whitespace-normal')).toBe(wrap && !icon);
          expect(actual).toContain(
            profile === 'new-york' || size === 'icon-compact'
              ? 'rounded-md'
              : `rounded-[var(--pui-radius-${profile === 'rhea' ? '2xl' : '4xl'})]`
          );
          for (const token of actual) expect(SHADCN_STYLE_TOKENS, token).toContain(token);
          expect(renderProtoStyleTokenCss(actual)).not.toContain(
            'Unsupported Proto UI style tokens'
          );
        }
});

it('restores the current modern default when legacy selection is removed', async () => {
  const el = await mount('ghost');
  expect(tokens(el)).toContain('h-9');
  setElementProps(el, { variant: 'ghost' });
  await flush();
  expect(tokens(el)).toContain('h-8');
  expect(tokens(el)).not.toContain('h-9');
  el.dispatchEvent(new PointerEvent('pointerenter'));
  await flush();
  expect(tokens(el)).toContain('bg-muted');
  expect(tokens(el)).not.toContain('bg-accent');
});
