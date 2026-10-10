import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as drawer from '../../src/drawer';
import * as shadcn from '../../../shadcn/src/drawer';
import * as brutalist from '../../../brutalist/src/drawer';
import * as bootstrap from '../../../bootstrap-2-3-2/src/drawer';
import * as liquid from '../../../liquid-glass/src/drawer';
type DrawerFixtureFamily = Record<
  'drawerRoot' | 'drawerContent' | 'drawerHandle' | 'drawerTitle' | 'drawerClose',
  { readonly name: string }
>;
const families = [drawer, shadcn, brutalist, bootstrap, liquid];

const owned = new Set<HTMLElement>();
const lives = { created: 0, disposed: 0 };
for (const proto of families.flatMap((family) => [
  family.drawerRoot,
  family.drawerContent,
  family.drawerHandle,
  family.drawerTitle,
  family.drawerClose,
])) {
  AdaptToWebComponent(proto, {
    diagnostics: {
      onLifecycleEvent(event) {
        if (event.type === 'instance.created') lives.created++;
        if (event.type === 'instance.dispose.done') lives.disposed++;
      },
    },
  });
}
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
afterEach(async () => {
  for (const node of owned) node.remove();
  await expect.poll(() => lives.disposed).toBe(lives.created);
  owned.clear();
});
function fixture(
  contentProps: Record<string, unknown> = {},
  rootProps: Record<string, unknown> = {},
  family: DrawerFixtureFamily = drawer
) {
  const root = document.createElement(family.drawerRoot.name) as any;
  const content = document.createElement(family.drawerContent.name) as any;
  const handle = document.createElement(family.drawerHandle.name) as any;
  const close = document.createElement(family.drawerClose.name) as any;
  const title = document.createElement(family.drawerTitle.name) as any;
  for (const node of [root, content, handle, title, close]) owned.add(node);
  title.textContent = 'Drawer settings';
  close.textContent = 'Close';
  setElementProps(root, { defaultOpen: true, ...rootProps });
  setElementProps(content, {
    enterDuration: 0,
    leaveDuration: 0,
    snapPoints: [0.5, 1],
    ...contentProps,
  });
  content.append(handle, title, close);
  root.append(content);
  document.body.append(root);
  content.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200 }) as DOMRect;
  return { root, content, handle, close };
}
function pointer(target: HTMLElement, type: string, x = 100, y = 100) {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'touch',
      isPrimary: true,
      button: 0,
      clientX: x,
      clientY: y,
    })
  );
}
function key(target: HTMLElement, key: string) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

describe.each(families.map((family) => [family.drawerContent.name, family] as const))(
  '%s bounded scrollport',
  (_name, family) => {
    it.each(['bottom', 'top', 'left', 'right'] as const)(
      'owns the actual %s extent and keeps Close operational at half snap',
      async (side) => {
        const p = fixture({ side, defaultSnapPoint: 0.5 }, {}, family);
        await flush();
        const styles = p.content.getAttribute('data-pui-style') ?? '';
        expect(styles).toContain('overflow-y-auto');
        expect(styles).toContain('content-start');
        expect(styles).not.toContain('translate-y-[calc(var(--pui-offset-percentage)');
        expect(styles).not.toContain('translate-x-[calc(var(--pui-offset-percentage)');
        expect(styles).toContain(
          side === 'bottom' || side === 'top'
            ? 'h-[calc(var(--proto-ui-available-region-height,100vh)*0.85*var(--pui-drag-progress))]'
            : 'w-[calc(min(20rem,var(--proto-ui-available-region-width,100vw))*var(--pui-drag-progress))]'
        );
        expect(styles).toContain('--proto-ui-available-region-center-x');
        expect(styles).toContain('--proto-ui-available-region-center-y');
        expect(p.content.style.getPropertyValue('--pui-drag-progress')).toBe('0.5');
        p.close.click();
        await flush();
        expect(p.root.getExposes().open.get()).toBe(false);
      }
    );
  }
);

describe('Drawer Handle normalized input', () => {
  it('snaps after drag while keeping committed extent separate from preview', async () => {
    const p = fixture();
    await flush();
    const changes: any[] = [];
    p.content.addEventListener('snapPointChange', (event: CustomEvent) =>
      changes.push(event.detail)
    );
    pointer(p.handle, 'pointerdown');
    pointer(p.handle, 'pointermove', 100, 190);
    await flush();
    expect(p.content.getExposes().dragging.get()).toBe(true);
    expect(p.content.getExposes().snapPoint.get()).toBe(1);
    expect(p.content.getExposes().dragProgress.get()).toBeCloseTo(0.55);
    expect(p.content.style.getPropertyValue('--pui-offset-percentage')).toBe('45');
    expect(p.content.getAttribute('data-pui-style')).toContain(
      'h-[calc(var(--proto-ui-available-region-height,100vh)*0.85*var(--pui-drag-progress))]'
    );
    pointer(p.handle, 'pointerup', 100, 190);
    await flush();
    expect(p.content.getExposes().snapPoint.get()).toBe(0.5);
    expect(p.content.getExposes().dragProgress.get()).toBe(0.5);
    expect(p.content.style.getPropertyValue('--pui-offset-percentage')).toBe('50');
    expect(p.content.getExposes().dragging.get()).toBe(false);
    expect(changes).toEqual([{ snapPoint: 0.5, reason: 'drag.snap' }]);
    expect(p.root.getExposes().open.get()).toBe(true);
  });
  it('requests controlled snap and close without replacing refused owner values', async () => {
    const p = fixture({ snapPoint: 1 }, { open: true });
    await flush();
    const snaps: any[] = [],
      opens: any[] = [];
    p.content.addEventListener('snapPointChange', (event: CustomEvent) => snaps.push(event.detail));
    p.root.addEventListener('openChange', (event: CustomEvent) => opens.push(event.detail));
    pointer(p.handle, 'pointerdown');
    pointer(p.handle, 'pointerup', 100, 200);
    await flush();
    expect(snaps).toEqual([{ snapPoint: 0.5, reason: 'drag.snap' }]);
    expect(p.content.getExposes().snapPoint.get()).toBe(1);
    expect(p.content.getExposes().dragProgress.get()).toBe(1);
    pointer(p.handle, 'pointerdown');
    pointer(p.handle, 'pointerup', 100, 280);
    await flush();
    expect(opens).toEqual([
      expect.objectContaining({ open: false, reason: 'drag.dismiss', focusReason: 'pointer' }),
    ]);
    expect(p.root.getExposes().open.get()).toBe(true);
    expect(p.content.getExposes().dragProgress.get()).toBe(1);
  });
  it('restores a refused half-snap size after drag and dismissal requests', async () => {
    const p = fixture({ snapPoint: 0.5 }, { open: true });
    await flush();
    const snaps: unknown[] = [],
      opens: unknown[] = [];
    p.content.addEventListener('snapPointChange', (event: CustomEvent) => snaps.push(event.detail));
    p.root.addEventListener('openChange', (event: CustomEvent) => opens.push(event.detail));
    pointer(p.handle, 'pointerdown');
    pointer(p.handle, 'pointerup', 100, 0);
    await flush();
    expect(snaps).toEqual([{ snapPoint: 1, reason: 'drag.snap' }]);
    expect(p.content.getExposes().snapPoint.get()).toBe(0.5);
    expect(p.content.style.getPropertyValue('--pui-drag-progress')).toBe('0.5');
    pointer(p.handle, 'pointerdown');
    pointer(p.handle, 'pointerup', 100, 400);
    await flush();
    expect(opens).toEqual([expect.objectContaining({ open: false, reason: 'drag.dismiss' })]);
    expect(p.root.getExposes().open.get()).toBe(true);
    expect(p.content.style.getPropertyValue('--pui-drag-progress')).toBe('0.5');
    expect(p.content.getExposes().dragging.get()).toBe(false);
  });
  it.each([
    ['bottom', 100, 190, 'ArrowUp', 'ArrowDown'],
    ['top', 100, 10, 'ArrowDown', 'ArrowUp'],
    ['left', 10, 100, 'ArrowRight', 'ArrowLeft'],
    ['right', 190, 100, 'ArrowLeft', 'ArrowRight'],
  ] as const)(
    'uses inward/outward directions for the %s edge',
    async (side, x, y, expand, collapse) => {
      const p = fixture({ side });
      await flush();
      pointer(p.handle, 'pointerdown');
      pointer(p.handle, 'pointerup', x, y);
      await flush();
      expect(p.content.getExposes().snapPoint.get()).toBe(0.5);
      p.handle.getExposes().focusSelf({ reason: 'keyboard' });
      key(p.handle, expand);
      await flush();
      expect(p.content.getExposes().snapPoint.get()).toBe(1);
      key(p.handle, collapse);
      await flush();
      expect(p.content.getExposes().snapPoint.get()).toBe(0.5);
      key(p.handle, collapse);
      await flush();
      expect(p.root.getExposes().open.get()).toBe(false);
    }
  );
  it.each([
    ['bottom', 100, 0],
    ['top', 100, 200],
    ['left', 200, 100],
    ['right', 0, 100],
  ] as const)(
    'converts a half-sized %s contact against the full extent once',
    async (side, x, y) => {
      const p = fixture({ side, defaultSnapPoint: 0.5 });
      await flush();
      pointer(p.handle, 'pointerdown');
      pointer(p.handle, 'pointermove', x, y);
      await flush();
      // 100px / the fixed 200px start geometry is a half-panel movement;
      // from a .5 snap it contributes .25, not .5, of full extent.
      expect(p.content.getExposes().dragProgress.get()).toBeCloseTo(0.75);
      expect(p.content.style.getPropertyValue('--pui-drag-progress')).toBe('0.75');
      p.content.getBoundingClientRect = () =>
        ({ left: 0, top: 0, width: 400, height: 400 }) as DOMRect;
      pointer(p.handle, 'pointermove', x, y);
      await flush();
      expect(p.content.getExposes().dragProgress.get()).toBeCloseTo(0.75);
      pointer(p.handle, 'pointerup', x, y);
      await flush();
      expect(p.content.getExposes().snapPoint.get()).toBe(1);
      key(p.handle, 'Home');
      await flush();
      expect(p.content.getExposes().snapPoint.get()).toBe(0.5);
      p.close.click();
      await flush();
      expect(p.root.getExposes().open.get()).toBe(false);
    }
  );
  it('cancels interrupted contact and refuses disabled and non-dismissible close gestures', async () => {
    const p = fixture({ dragDismissible: false });
    await flush();
    pointer(p.handle, 'pointerdown');
    pointer(p.handle, 'pointermove', 100, 190);
    pointer(p.handle, 'pointercancel', 100, 190);
    await flush();
    expect(p.content.getExposes().snapPoint.get()).toBe(1);
    expect(p.content.getExposes().dragProgress.get()).toBe(1);
    pointer(p.handle, 'pointerdown');
    pointer(p.handle, 'pointerup', 100, 400);
    await flush();
    expect(p.content.getExposes().snapPoint.get()).toBe(0.5);
    expect(p.root.getExposes().open.get()).toBe(true);
    p.handle.getExposes().focusSelf({ reason: 'keyboard' });
    key(p.handle, 'ArrowDown');
    await flush();
    expect(p.root.getExposes().open.get()).toBe(true);
    pointer(p.handle, 'pointerdown');
    pointer(p.handle, 'pointermove', 100, 0);
    setElementProps(p.root, { disabled: true });
    await flush();
    pointer(p.handle, 'pointerup', 100, 0);
    expect(p.content.getExposes().dragging.get()).toBe(false);
    expect(p.content.getExposes().snapPoint.get()).toBe(0.5);
  });
  it('keeps panel controls out of the grab surface and resets on side changes', async () => {
    const p = fixture();
    await flush();
    pointer(p.close, 'pointerdown');
    pointer(p.close, 'pointermove', 100, 190);
    pointer(p.close, 'pointerup', 100, 190);
    await flush();
    expect(p.content.getExposes().dragging.get()).toBe(false);
    expect(p.content.getExposes().snapPoint.get()).toBe(1);
    pointer(p.handle, 'pointerdown');
    pointer(p.handle, 'pointermove', 100, 190);
    setElementProps(p.content, { side: 'right' });
    await flush();
    pointer(p.handle, 'pointerup', 100, 190);
    expect(p.content.getExposes().dragging.get()).toBe(false);
    expect(p.content.getExposes().snapPoint.get()).toBe(1);
  });
});

import path from 'node:path';
import { collectProtoStyleTokens } from '../../../../cli/src/services/prototype-style-tokens';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowStyleTokenCss,
} from '../../../../cli/src/services/proto-style-css';
it('collects and lowers fixed scrollport extent recipes instead of hiding translated controls', async () => {
  const collected = await collectProtoStyleTokens(
    path.resolve(process.cwd(), 'packages/prototypes/base/src/drawer')
  );
  if (!collected.every((token): token is string => typeof token === 'string')) {
    throw new Error('Drawer collector returned a non-string token');
  }
  const tokens = collected;
  const recipes = [
    'h-[calc(var(--proto-ui-available-region-height,100vh)*0.85*var(--pui-drag-progress))]',
    'w-[calc(min(20rem,var(--proto-ui-available-region-width,100vw))*var(--pui-drag-progress))]',
    'w-[var(--proto-ui-available-region-width,100vw)]',
    'h-[var(--proto-ui-available-region-height,100vh)]',
    'overflow-y-auto',
    'overflow-x-hidden',
    'content-start',
    'left-[calc(var(--proto-ui-available-region-center-x,50vw)_-_var(--proto-ui-available-region-width,100vw)/2)]',
    'top-[calc(var(--proto-ui-available-region-center-y,50vh)_-_var(--proto-ui-available-region-height,100vh)/2)]',
    'top-[calc(var(--proto-ui-available-region-center-y,50vh)_+_var(--proto-ui-available-region-height,100vh)/2_-_var(--proto-ui-available-region-height,100vh)*0.85*var(--pui-drag-progress))]',
    'left-[calc(var(--proto-ui-available-region-center-x,50vw)_+_var(--proto-ui-available-region-width,100vw)/2_-_min(20rem,var(--proto-ui-available-region-width,100vw))*var(--pui-drag-progress))]',
    'bottom-1',
    'right-1',
  ];
  for (const recipe of recipes) expect(tokens).toContain(recipe);
  expect(
    tokens.some((token) => token.startsWith('translate-') && token.includes('offset-percentage'))
  ).toBe(false);
  for (const css of [renderProtoStyleTokenCss(tokens), renderProtoShadowStyleTokenCss(tokens)]) {
    expect(css.match(/Unsupported Proto UI style tokens:[\s\S]*?\*\//)?.[0]).toBeUndefined();
    expect(css).toContain(
      'height: calc(var(--proto-ui-available-region-height,100vh)*0.85*var(--pui-drag-progress));'
    );
    expect(css).toContain(
      'width: calc(min(20rem,var(--proto-ui-available-region-width,100vw))*var(--pui-drag-progress));'
    );
    expect(css).toContain('overflow-y: auto;');
    expect(css).toContain('align-content: flex-start;');
  }
});

it('releases a detached contact and removes continuous state projection on disposal', async () => {
  const p = fixture();
  await flush();
  pointer(p.handle, 'pointerdown');
  pointer(p.handle, 'pointermove', 100, 190);
  const events: any[] = [];
  p.content.addEventListener('snapPointChange', (event: CustomEvent) => events.push(event.detail));
  for (const node of [p.root, p.content, p.handle, p.close]) node.remove();
  await expect.poll(() => lives.disposed).toBe(lives.created);
  pointer(p.handle, 'pointerup', 100, 190);
  expect(events).toEqual([]);
  expect(p.content.style.getPropertyValue('--pui-offset-percentage')).toBe('');
  expect(p.handle.style.touchAction).toBe('');
});
