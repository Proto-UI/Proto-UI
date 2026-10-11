import { afterEach, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as base from '../../src/drawer';
import * as shadcn from '../../../shadcn/src/drawer';
import * as neo from '../../../brutalist/src/drawer';
type Family = Pick<
  typeof base,
  'drawerRoot' | 'drawerContent' | 'drawerHandle' | 'drawerClose' | 'drawerMask'
>;
const families: Family[] = [base, shadcn, neo];
const roots: HTMLElement[] = [];
const dimensionKeys = ['clientWidth', 'clientHeight', 'clientLeft'] as const;
const originalDimensions = dimensionKeys.map(
  (key) => [key, Object.getOwnPropertyDescriptor(document.documentElement, key)] as const
);
for (const family of families)
  for (const prototype of [
    family.drawerRoot,
    family.drawerContent,
    family.drawerHandle,
    family.drawerClose,
    family.drawerMask,
  ])
    AdaptToWebComponent(prototype);
const flush = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve();
};
afterEach(async () => {
  roots.splice(0).forEach((root) => root.remove());
  await flush();
  document.documentElement.style.removeProperty('font-size');
  vi.restoreAllMocks();
  for (const [key, original] of originalDimensions) {
    if (original) Object.defineProperty(document.documentElement, key, original);
    else Reflect.deleteProperty(document.documentElement, key);
  }
});
function fixture(
  family: Family = base,
  contentProps: Record<string, unknown> = {},
  rootProps: Record<string, unknown> = {},
  withMask = false
) {
  // Synthetic viewport facts, not native intrinsic-layout evidence.
  document.documentElement.style.fontSize = '16px';
  Object.defineProperties(document.documentElement, {
    clientWidth: { configurable: true, value: 390 },
    clientHeight: { configurable: true, value: 800 },
    clientLeft: { configurable: true, value: 0 },
  });
  vi.spyOn(document.documentElement, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 390,
    bottom: 800,
    width: 390,
    height: 800,
    toJSON() {},
  });
  const originalStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
    const actual = originalStyle(element, pseudo);
    return element.hasAttribute('data-pui-available-space-probe')
      ? new Proxy(actual, {
          get(target, key) {
            return ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].includes(
              String(key)
            )
              ? '0px'
              : Reflect.get(target, key, target);
          },
        })
      : actual;
  });
  const root = document.createElement(family.drawerRoot.name) as any;
  const content = document.createElement(family.drawerContent.name) as any;
  const handle = document.createElement(family.drawerHandle.name) as any;
  const close = document.createElement(family.drawerClose.name) as any;
  close.textContent = 'Close';
  setElementProps(root, { defaultOpen: true, ...rootProps });
  setElementProps(content, { enterDuration: 0, leaveDuration: 0, ...contentProps });
  content.append(handle, document.createTextNode('Short content'), close);
  if (withMask) root.append(document.createElement(family.drawerMask.name));
  root.append(content);
  roots.push(root);
  content.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200 }) as DOMRect;
  document.body.append(root);
  return { root, content, handle, close };
}
function pointer(target: HTMLElement, type: string, y: number) {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'touch',
      isPrimary: true,
      button: 0,
      clientX: 100,
      clientY: y,
    })
  );
}
it.each(families.map((family) => [family.drawerContent.name, family] as const))(
  '%s defaults to intrinsic height and decorative auto handle',
  async (_name, family) => {
    const p = fixture(family);
    await flush();
    expect(p.content.style.height).toBe('auto');
    expect(p.content.getExposes().extentValid.get()).toBe(true);
    expect(p.handle.getAttribute('aria-hidden')).toBe('true');
    expect(p.handle.getAttribute('tabindex')).not.toBe('0');
    for (const key of ['aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-orientation'])
      expect(p.handle.hasAttribute(key)).toBe(false);
    expect(p.handle.getAttribute('data-pui-a11y-actions')).toBeNull();
    p.handle.getExposes().focusSelf();
    await flush();
    expect(document.activeElement).not.toBe(p.handle);
    expect(p.root.getExposes().open.get()).toBe(true);
    p.close.click();
    await flush();
    expect(p.root.getExposes().open.get()).toBe(false);
  }
);
it.each([shadcn, neo])(
  'applies six root-text units and minimum capped by available space for %s',
  async (family) => {
    const p = fixture(family, { minExtent: { unit: 'logical', value: 10000 } });
    await flush();
    const available = Number.parseFloat(
      p.content.style.getPropertyValue('--proto-ui-available-region-height')
    );
    expect(p.content.style.maxHeight).toBe(`${available - 96}px`);
    expect(p.content.style.minHeight).toBe(`${available - 96}px`);
  }
);
it('translates intrinsic preview without resizing and rolls back a refused controlled close', async () => {
  const p = fixture(base, {}, { open: true });
  await flush();
  const requests: any[] = [];
  p.root.addEventListener('openChange', (event: CustomEvent) => requests.push(event.detail));
  pointer(p.handle, 'pointerdown', 100);
  pointer(p.handle, 'pointermove', 150);
  await flush();
  expect(p.content.style.height).toBe('auto');
  expect(p.content.getExposes().dragging.get()).toBe(true);
  expect(p.content.style.getPropertyValue('translate')).toBe('0px -75%');
  pointer(p.handle, 'pointerup', 300);
  await flush();
  expect(p.root.getExposes().open.get()).toBe(true);
  expect(p.content.style.getPropertyValue('translate')).toBe('0px -100%');
  expect(p.content.getExposes().dragging.get()).toBe(false);
  expect(
    requests.some((request) => request.open === false && request.reason === 'drag.dismiss')
  ).toBe(true);
});
it('keeps last valid visible intent and Close when a runtime extent becomes invalid', async () => {
  const p = fixture();
  await flush();
  const max = p.content.style.maxHeight;
  setElementProps(p.content, { minExtent: { unit: 'bad', value: 3 } });
  await flush();
  expect(p.content.getExposes().extentValid.get()).toBe(false);
  expect(p.content.style.height).toBe('auto');
  expect(p.content.style.maxHeight).toBe(max);
  expect(p.content.style.display).not.toBe('none');
  p.close.click();
  await flush();
  expect(p.root.getExposes().open.get()).toBe(false);
});
it('switches to explicit snap with a real range and cancels the old intrinsic contact', async () => {
  const p = fixture();
  await flush();
  pointer(p.handle, 'pointerdown', 100);
  pointer(p.handle, 'pointermove', 150);
  setElementProps(p.content, { snapPoints: [0.5, 1], snapPoint: 0.5 });
  await flush();
  expect(p.content.getExposes().dragging.get()).toBe(false);
  expect(p.handle.getAttribute('role')).toBe('separator');
  expect(p.handle.getAttribute('aria-valuenow')).toBe('50');
  expect(p.handle.getAttribute('aria-hidden')).not.toBe('true');
  const cap = Number.parseFloat(p.content.style.maxHeight);
  expect(p.content.style.height).toBe(`${cap * 0.5}px`);
  pointer(p.handle, 'pointerup', 400);
  await flush();
  expect(p.root.getExposes().open.get()).toBe(true);
});
it.each([shadcn, neo])(
  'recomputes the exact six-root-text cap at root32 for %s',
  async (family) => {
    const p = fixture(family);
    await flush();
    document.documentElement.style.fontSize = '32px';
    window.dispatchEvent(new Event('resize'));
    await flush();
    expect(p.content.style.maxHeight).toBe('608px');
    expect(p.content.style.height).toBe('auto');
  }
);
it('withdraws old snap range in the reverse snap-to-auto mode change', async () => {
  const p = fixture(base, { snapPoints: [0.5, 1], snapPoint: 0.5 });
  await flush();
  expect(p.handle.getAttribute('aria-valuenow')).toBe('50');
  setElementProps(p.content, { snapPoints: [], snapPoint: null });
  await flush();
  expect(p.content.style.height).toBe('auto');
  expect(p.handle.getAttribute('aria-hidden')).toBe('true');
  for (const key of ['aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-orientation'])
    expect(p.handle.hasAttribute(key)).toBe(false);
});
it('keeps the accepted edge on invalid mid-drag update, releases capture, and recovers', async () => {
  const p = fixture();
  await flush();
  let held = false;
  p.handle.setPointerCapture = vi.fn(() => {
    held = true;
  });
  p.handle.hasPointerCapture = () => held;
  p.handle.releasePointerCapture = vi.fn(() => {
    held = false;
  });
  pointer(p.handle, 'pointerdown', 100);
  pointer(p.handle, 'pointermove', 150);
  expect(held).toBe(true);
  setElementProps(p.content, { side: 'top', minExtent: { unit: 'bad', value: 4 } });
  await flush();
  expect(p.content.getExposes().extentValid.get()).toBe(false);
  expect(p.content.getExposes().dragging.get()).toBe(false);
  expect(p.handle.releasePointerCapture).toHaveBeenCalled();
  expect(held).toBe(false);
  expect(p.content.style.top).toBe('800px');
  expect(p.content.style.getPropertyValue('translate')).toBe('0px -100%');
  pointer(p.handle, 'pointerup', 400);
  await flush();
  expect(p.root.getExposes().open.get()).toBe(true);
  setElementProps(p.content, { side: 'top', minExtent: { unit: 'logical', value: 0 } });
  await flush();
  expect(p.content.getExposes().extentValid.get()).toBe(true);
  expect(p.content.style.top).toBe('0px');
});
it('uses top-edge outward drag without resizing and can dismiss', async () => {
  const p = fixture(base, { side: 'top' });
  await flush();
  pointer(p.handle, 'pointerdown', 100);
  pointer(p.handle, 'pointermove', 50);
  await flush();
  expect(p.content.style.height).toBe('auto');
  expect(p.content.style.getPropertyValue('translate')).toBe('0px -25%');
  pointer(p.handle, 'pointerup', -100);
  await flush();
  expect(p.root.getExposes().open.get()).toBe(false);
});
it.each(['root-disabled', 'non-dismissible'])(
  'does not start an intrinsic drag when %s',
  async (policy) => {
    const p = fixture(
      base,
      policy === 'non-dismissible' ? { dragDismissible: false } : {},
      policy === 'root-disabled' ? { disabled: true } : {}
    );
    await flush();
    pointer(p.handle, 'pointerdown', 100);
    pointer(p.handle, 'pointerup', 400);
    await flush();
    expect(p.content.getExposes().dragging.get()).toBe(false);
    expect(p.root.getExposes().open.get()).toBe(true);
  }
);
it('rejects initial invalid configuration before leaving a separately authored modal Mask open', async () => {
  const errors: unknown[] = [];
  const onError = (event: ErrorEvent) => {
    errors.push(event.error);
    event.preventDefault();
  };
  window.addEventListener('error', onError);
  try {
    try {
      fixture(base, { minExtent: { unit: 'bad', value: 4 } }, { open: true }, true);
    } catch (error) {
      errors.push(error);
    }
    await flush();
    expect(errors.some((error) => String(error).includes('Invalid initial extent'))).toBe(true);
    const mask = document.querySelector(base.drawerMask.name) as any;
    expect(mask?.getExposes?.().isPresent?.get() ?? false).toBe(false);
  } finally {
    window.removeEventListener('error', onError);
  }
});
it('does not leave focus on a Handle withdrawn from the accessibility tree', async () => {
  const p = fixture(base, { snapPoints: [0.5, 1] });
  await flush();
  p.handle.focus();
  expect(document.activeElement).toBe(p.handle);
  setElementProps(p.content, { snapPoints: [] });
  await flush();
  expect(p.handle.getAttribute('aria-hidden')).toBe('true');
  expect(document.activeElement).not.toBe(p.handle);
});
