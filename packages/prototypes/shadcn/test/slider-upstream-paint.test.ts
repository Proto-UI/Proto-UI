import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as slider from '../src/slider';
import { fieldRoot } from '@proto.ui/prototypes-base/field';
import { styleContains } from '../../test-utils/style';
for (const p of Object.values(slider))
  if (typeof p === 'object' && p && 'setup' in p) AdaptToWebComponent(p as any);
AdaptToWebComponent(fieldRoot);
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 2));
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
async function fixture(field = false, props: Record<string, unknown> = {}) {
  const root = document.createElement('shadcn-slider-root') as any;
  const track = document.createElement('shadcn-slider-track') as any;
  const indicator = document.createElement('shadcn-slider-indicator') as any;
  const thumb = document.createElement(
    field ? 'shadcn-slider-field-thumb' : 'shadcn-slider-thumb'
  ) as any;
  setElementProps(root, { defaultValue: 25, ...props });
  track.append(indicator, thumb);
  root.append(track);
  if (field) {
    const owner = document.createElement('base-field-root');
    owner.append(root);
    document.body.append(owner);
  } else document.body.append(root);
  await flush();
  return { root, track, indicator, thumb };
}
const body = (el: HTMLElement) => (el.shadowRoot ?? el).querySelector('div')!;
for (const field of [false, true]) {
  it(`matches base-nova paint dimensions separately from hit boxes, field=${field}`, async () => {
    const f = await fixture(field);
    expect(styleContains(f.track, 'h-3')).toBe(true);
    expect(styleContains(f.track, 'bg-muted')).toBe(false);
    expect(body(f.track)).not.toBeNull();
    expect(styleContains(body(f.track), 'h-1')).toBe(true);
    expect(styleContains(body(f.track), 'bg-muted')).toBe(true);
    expect(styleContains(f.indicator, 'h-1')).toBe(true);
    expect(styleContains(f.thumb, 'size-7')).toBe(true);
    expect(styleContains(f.thumb, 'rounded-full')).toBe(false);
    expect(styleContains(f.thumb, 'bg-background')).toBe(false);
    const paint = body(f.thumb);
    for (const token of ['size-3', 'border', 'border-ring', 'bg-white', 'pointer-events-none'])
      expect(styleContains(paint, token), token).toBe(true);
    expect(paint.getAttribute('role')).toBeNull();
    expect(paint.getAttribute('tabindex')).toBeNull();
    expect(f.thumb.getAttribute('role')).toBe('slider');
    expect(f.track.querySelectorAll('shadcn-slider-thumb, shadcn-slider-field-thumb')).toHaveLength(
      1
    );
  });
  it(`uses borrowed hover/focus/pressed with one disabled control opacity, field=${field}`, async () => {
    const f = await fixture(field);
    f.thumb.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }));
    await flush();
    expect(styleContains(body(f.thumb), 'ring-3')).toBe(true);
    f.thumb.dispatchEvent(new PointerEvent('pointerleave', { bubbles: false }));
    await flush();
    expect(styleContains(body(f.thumb), 'ring-3')).toBe(false);
    f.thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    f.thumb.getExposes().focusSelf();
    await flush();
    expect(f.thumb.getExposes().focusVisible.get()).toBe(true);
    expect(styleContains(body(f.thumb), 'forced-colors-focus-outline')).toBe(true);
    expect(styleContains(f.thumb, 'forced-colors-focus-outline')).toBe(false);
    expect(styleContains(f.thumb, 'data-[focus-visible]:forced-colors-focus-outline')).toBe(false);
    expect(styleContains(body(f.thumb), 'ring-3')).toBe(true);
    setElementProps(f.root, { defaultValue: 25, disabled: true });
    await flush();
    expect(
      f.track.hasAttribute('data-disabled') && styleContains(f.track, 'data-[disabled]:opacity-50')
    ).toBe(true);
    expect(styleContains(f.thumb, 'opacity-50')).toBe(false);
    expect(styleContains(body(f.thumb), 'ring-3')).toBe(false);
    expect(f.thumb.getAttribute('aria-disabled')).toBe('true');
    expect(f.root.getExposes().requestValue(70)).toBe(false);
    setElementProps(f.root, { defaultValue: 25, readOnly: true });
    await flush();
    expect(
      f.track.hasAttribute('data-disabled') && styleContains(f.track, 'data-[disabled]:opacity-50')
    ).toBe(false);
    expect(f.thumb.getAttribute('aria-readonly')).toBe('true');
    expect(f.root.getExposes().requestValue(70)).toBe(false);
  });
  it(`changes horizontal and vertical paint without moving the input coordinate interval, field=${field}`, async () => {
    const f = await fixture(field);
    setElementProps(f.root, { defaultValue: 25, orientation: 'vertical' });
    await flush();
    expect(styleContains(f.track, 'data-[orientation=vertical]:min-h-40')).toBe(true);
    expect(styleContains(f.track, 'data-[orientation=vertical]:w-3')).toBe(true);
    expect(styleContains(body(f.track), 'w-1')).toBe(true);
    expect(styleContains(f.indicator, 'data-[orientation=vertical]:w-1')).toBe(true);
    expect(
      styleContains(f.thumb, 'data-[orientation=vertical]:bottom-[calc(var(--pui-percentage)*1%)]')
    ).toBe(true);
    setElementProps(f.root, { defaultValue: 25, orientation: 'horizontal', direction: 'rtl' });
    await flush();
    expect(styleContains(body(f.track), 'h-1')).toBe(true);
    expect(
      styleContains(
        f.thumb,
        'data-[direction=rtl]:data-[orientation=horizontal]:right-[calc(var(--pui-percentage)*1%)]'
      )
    ).toBe(true);
  });
}
