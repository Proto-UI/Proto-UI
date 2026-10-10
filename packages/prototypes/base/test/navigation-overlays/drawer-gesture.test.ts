import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as drawer from '../../src/drawer';

const owned = new Set<HTMLElement>();
const lives = { created: 0, disposed: 0 };
for (const proto of [
  drawer.drawerRoot,
  drawer.drawerContent,
  drawer.drawerHandle,
  drawer.drawerTitle,
  drawer.drawerClose,
]) {
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
  rootProps: Record<string, unknown> = {}
) {
  const root = document.createElement(drawer.drawerRoot.name) as any;
  const content = document.createElement(drawer.drawerContent.name) as any;
  const handle = document.createElement(drawer.drawerHandle.name) as any;
  const close = document.createElement(drawer.drawerClose.name) as any;
  const title = document.createElement(drawer.drawerTitle.name) as any;
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
      'translate-y-[calc(var(--pui-offset-percentage)*1%)]'
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
it('collects and lowers fixed continuous translation recipes, rather than enumerating positions', async () => {
  const tokens = await collectProtoStyleTokens(
    path.resolve(process.cwd(), 'packages/prototypes/base/src/drawer')
  );
  const recipes = [
    'translate-x-[calc(var(--pui-offset-percentage)*1%)]',
    'translate-x-[calc(var(--pui-offset-percentage)*-1%)]',
    'translate-y-[calc(var(--pui-offset-percentage)*1%)]',
    'translate-y-[calc(var(--pui-offset-percentage)*-1%)]',
  ];
  for (const recipe of recipes) expect(tokens).toContain(recipe);
  for (const css of [renderProtoStyleTokenCss(recipes), renderProtoShadowStyleTokenCss(recipes)]) {
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(css).toContain('--pui-translate-x: calc(var(--pui-offset-percentage)*1%);');
    expect(css).toContain('--pui-translate-y: calc(var(--pui-offset-percentage)*-1%);');
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
