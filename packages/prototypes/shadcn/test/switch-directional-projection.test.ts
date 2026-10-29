import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { switchRoot, switchThumb } from '../src/switch';
import { styleContains } from '../../test-utils/style';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';

AdaptToWebComponent(switchRoot as any);
AdaptToWebComponent(switchThumb as any);
const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await settle();
});

// Real WC runtime, synthetic geometry/contact; NOT native layout or capture evidence.
async function fixture(
  styleProfile: string,
  direction = 'ltr',
  props: Record<string, unknown> = {}
) {
  const root = document.createElement('shadcn-switch-root') as HTMLElement & { getExposes(): any };
  const thumb = document.createElement('shadcn-switch-thumb') as HTMLElement & {
    getExposes(): any;
  };
  const border = styleProfile === 'rhea' ? 2 : 1;
  root.style.cssText =
    'display:inline-flex;position:relative;box-sizing:border-box;width:32px;height:20px;border:' +
    border +
    'px solid;padding:0';
  root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 32, height: 20 }) as DOMRect;
  thumb.style.cssText = 'width:16px;height:16px';
  thumb.getBoundingClientRect = () => ({ left: border, top: 2, width: 16, height: 16 }) as DOMRect;
  setElementProps(root, { styleProfile, direction, draggable: true, ...props });
  root.append(thumb);
  const changes: boolean[] = [];
  root.addEventListener('checkedChange', (e) => changes.push((e as CustomEvent).detail.checked));
  document.body.append(root);
  await settle();
  const send = (type: string, x: number) =>
    root.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 31,
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
        clientX: x,
        clientY: 10,
        detail: 1,
      })
    );
  return { root, thumb, changes, send, travel: 16 - border * 2 };
}
const token = (profile: string, rtl = false) => {
  const inset = profile === 'rhea' ? 4 : 2;
  return rtl
    ? 'translate-x-[calc((' + inset + 'px_-_100%)*var(--pui-percentage)/100)]'
    : 'translate-x-[calc((100%_-_' + inset + 'px)*var(--pui-percentage)/100)]';
};
describe('Shadcn Switch existing Base preview projection', () => {
  it.each(
    ['new-york-v4', 'rhea'].flatMap((profile) =>
      ['ltr', 'rtl'].map((direction) => ({ profile, direction }))
    )
  )(
    'projects interior preview without committing $profile/$direction',
    async ({ profile, direction }) => {
      const f = await fixture(profile, direction);
      const start = direction === 'rtl' ? 23 : 9;
      const mid = start + ((direction === 'rtl' ? -1 : 1) * f.travel) / 2;
      expect(styleContains(f.thumb, token(profile, direction === 'rtl'))).toBe(true);
      expect(styleContains(f.root, 'direction-rtl')).toBe(direction === 'rtl');
      expect(styleContains(f.root, 'direction-ltr')).toBe(direction === 'ltr');
      f.send('pointerdown', start);
      f.send('pointermove', mid);
      await settle();
      expect(f.root.getExposes().dragging.get()).toBe(true);
      expect(f.thumb.getExposes().percentage.get()).toBe(50);
      expect(f.thumb.style.getPropertyValue('--pui-percentage')).toBe('50');
      expect(styleContains(f.thumb, 'data-[dragging]:transition-none')).toBe(true);
      expect(f.thumb.hasAttribute('data-dragging')).toBe(true);
      expect(f.root.getAttribute('aria-checked')).toBe('false');
      expect(f.changes).toEqual([]);
      f.send('pointercancel', mid);
      await settle();
      expect(f.thumb.getExposes().percentage.get()).toBe(0);
      expect(f.thumb.hasAttribute('data-dragging')).toBe(false);
      expect(styleContains(f.thumb, 'transition-transform')).toBe(true);
      expect(f.changes).toEqual([]);
    }
  );
  it.each(['new-york-v4', 'rhea'])(
    'preserves controlled refusal and opt-out %s',
    async (profile) => {
      const f = await fixture(profile, 'ltr', { checked: false });
      f.send('pointerdown', 9);
      f.send('pointermove', 9 + f.travel);
      expect(f.thumb.getExposes().percentage.get()).toBe(100);
      f.send('pointerup', 9 + f.travel);
      f.send('click', 9 + f.travel);
      expect(f.changes).toEqual([true]);
      expect(f.thumb.getExposes().percentage.get()).toBe(0);
      expect(f.root.getExposes().checked.get()).toBe(false);
      setElementProps(f.root, { styleProfile: profile, draggable: false, checked: true });
      await settle();
      expect(styleContains(f.thumb, token(profile))).toBe(false);
      expect(
        styleContains(
          f.thumb,
          profile === 'rhea' ? 'translate-x-[calc(100%_-_4px)]' : 'translate-x-[calc(100%_-_2px)]'
        )
      ).toBe(true);
    }
  );
  it.each(['new-york-v4', 'rhea'])('keeps own-reference affine recipes in CSS %s', (profile) => {
    const css = renderProtoStyleTokenCss([token(profile), token(profile, true)]);
    const inset = profile === 'rhea' ? 4 : 2;
    expect(css).toContain(
      '--pui-translate-x: calc((100% - ' + inset + 'px)*var(--pui-percentage)/100);'
    );
    expect(css).toContain(
      '--pui-translate-x: calc((' + inset + 'px - 100%)*var(--pui-percentage)/100);'
    );
  });
});
