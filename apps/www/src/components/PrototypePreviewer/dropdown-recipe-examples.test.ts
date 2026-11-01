import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDemoSourcePath, loadDemo } from './demo-modules';
import { renderDemo } from './demo-renderer';
import {
  assertDemoSpec,
  collectPrototypeIds,
  type DemoNode,
  type DemoRuntimeApi,
  type DemoSpec,
} from './demo-types';
import { loadPrototypes } from './prototype-modules';
import { getPrototype } from './registry';

type ProtoNode = Extract<DemoNode, { kind: 'proto' }>;
const recipeIds = ['demo-shadcn-dropdown-destructive', 'demo-shadcn-dropdown-inset'] as const;
const upstream =
  'https://github.com/shadcn-ui/ui/blob/c2a67849be260701852b0977ba15eb5f3a0ce2a4/apps/v4/registry/bases/base/examples/dropdown-menu-example.tsx';
const recipeUrl = (path: string) => `https://github.com/Proto-UI/Proto-UI/blob/main/${path}`;

function nodes(node: DemoNode): ProtoNode[] {
  // Layout boxes may wrap the proto tree; recipes still must not simulate
  // menu parts — every descendant that is a node must be a real prototype.
  if (node.kind === 'text') return [];
  if (node.kind !== 'proto')
    return (node.children ?? []).flatMap((child) =>
      typeof child === 'string' ? [] : nodes(child)
    );
  return [
    node,
    ...(node.children ?? []).flatMap((child) => (typeof child === 'string' ? [] : nodes(child))),
  ];
}

async function recipe(id: string): Promise<DemoSpec> {
  const demo = await loadDemo(id);
  assertDemoSpec(demo);
  return demo;
}

const cleanups: Array<() => void | Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  document.body.replaceChildren();
});

describe('bounded public Shadcn Dropdown recipes', () => {
  for (const id of recipeIds) {
    it(`${id}: keeps a static literal recipe without simulated menu parts or Web behavior`, async () => {
      const demo = await recipe(id);
      const source = readFileSync(getDemoSourcePath(id), 'utf8');
      if (id === 'demo-shadcn-dropdown-inset') {
        // The inset recipe is interactive: a bounded setup toggles the real
        // `inset` prop through existing prototype APIs. Only the type-only
        // DemoSpec import is allowed.
        expect(source).toMatch(/^import type \{ DemoSpec \}/);
        expect(source).not.toMatch(/^import (?!type)/m);
        expect(demo.setup).toBeDefined();
      } else {
        expect(source).toMatch(/^export default \{/);
        expect(source).not.toMatch(/\bimport\b|\bfunction\b|=>|\bsetup\b/);
        expect(demo.setup).toBeUndefined();
      }
      const all = nodes(demo.root);
      expect(all.map((node) => node.prototypeId)).not.toContain('lucide-icon');
      for (const node of all) {
        expect(node.prototypeId).toMatch(
          id === 'demo-shadcn-dropdown-inset'
            ? /^(shadcn-button|shadcn-dropdown-(root|trigger|content|item|group|label|separator)|lucide-(pencil|share|archive|trash|copy|scissors)-icon)$/
            : /^(shadcn-dropdown-(root|trigger|content|item|group|label|separator)|lucide-(pencil|share|archive|trash|copy|scissors)-icon)$/
        );
        expect(node.className).toBeUndefined();
        if (node.prototypeId !== 'shadcn-dropdown-content')
          expect(node.surfaceStyle).toBeUndefined();
        if (node.prototypeId.startsWith('lucide-')) {
          expect(node.props).toEqual({ size: 16 });
          expect(node.children).toBeUndefined();
        }
      }
      expect(all.filter((node) => node.prototypeId === 'shadcn-dropdown-root')).toHaveLength(1);
      expect(all.filter((node) => node.prototypeId === 'shadcn-dropdown-content')).toHaveLength(1);
      expect(JSON.stringify(demo)).not.toMatch(/submenu|checkbox|radio|chevron|[→▶›]/i);
    });

    it(`${id}: resolves every real prototype through the public preview loader`, async () => {
      const demo = await recipe(id);
      const ids = new Set<string>();
      collectPrototypeIds(demo.root, ids);
      await loadPrototypes([...ids]);
      for (const prototypeId of ids) expect(getPrototype(prototypeId).name).toBe(prototypeId);
    }, 20_000);
  }

  it('preserves WithDestructive ordering and labels its single disabled local control', async () => {
    // Fixed upstream DropdownMenuWithDestructive; disabled row is explicitly local.
    const all = nodes((await recipe(recipeIds[0])).root);
    const content = all.find((node) => node.prototypeId === 'shadcn-dropdown-content')!;
    expect(content.children!.map((node) => (node as ProtoNode).prototypeId)).toEqual([
      'shadcn-dropdown-item',
      'shadcn-dropdown-item',
      'shadcn-dropdown-separator',
      'shadcn-dropdown-item',
      'shadcn-dropdown-item',
      'shadcn-dropdown-separator',
      'shadcn-dropdown-item',
    ]);
    const items = all.filter((node) => node.prototypeId === 'shadcn-dropdown-item');
    expect(items.map((node) => node.props?.textValue)).toEqual([
      'Edit',
      'Share',
      'Archive',
      'Delete',
      'Delete (disabled)',
    ]);
    expect(items.map((node) => (node.children![0] as ProtoNode).prototypeId)).toEqual([
      'lucide-pencil-icon',
      'lucide-share-icon',
      'lucide-archive-icon',
      'lucide-trash-icon',
      'lucide-trash-icon',
    ]);
    expect(items.map((node) => node.props?.variant ?? 'default')).toEqual([
      'default',
      'default',
      'default',
      'destructive',
      'destructive',
    ]);
    expect(items.filter((node) => node.props?.disabled)).toEqual([items[4]]);
    expect(items[3].props?.disabled).toBeUndefined();
  });

  it('shows false and true inset for ordinary Labels and Items without replacing omitted parts', async () => {
    const all = nodes((await recipe(recipeIds[1])).root);
    const groups = all.filter((node) => node.prototypeId === 'shadcn-dropdown-group');
    expect(groups).toHaveLength(2);
    expect(groups.map((node) => (node.children![0] as ProtoNode).prototypeId)).toEqual([
      'shadcn-dropdown-label',
      'shadcn-dropdown-label',
    ]);
    expect(
      all
        .filter((node) => node.prototypeId === 'shadcn-dropdown-label')
        .map((node) => node.props?.inset)
    ).toEqual([false, true]);
    const items = all.filter((node) => node.prototypeId === 'shadcn-dropdown-item');
    expect(items.map((node) => node.props?.textValue)).toEqual(['Copy', 'Cut', 'Paste', 'Rename']);
    expect(items.map((node) => node.props?.inset)).toEqual([false, false, true, true]);
    expect(items[0].children![0]).toMatchObject({
      prototypeId: 'lucide-copy-icon',
      props: { size: 16 },
    });
    expect(items[1].children![0]).toMatchObject({
      prototypeId: 'lucide-scissors-icon',
      props: { size: 16 },
    });
    expect(items[2].children).toEqual(['Paste']);
  });

  for (const locale of ['en', 'zh-cn']) {
    it(`${locale}: retains My Account, separate previews, readable sources and evidence boundaries`, async () => {
      const oldId = 'demo-shadcn-dropdown-menu';
      const old = await recipe(oldId);
      expect(nodes(old.root).some((node) => node.children?.includes('My Account'))).toBe(true);
      const docs = readFileSync(
        `apps/www/src/content/docs/${locale}/ui-libraries/shadcn/dropdown-menu.mdx`,
        'utf8'
      );
      for (const id of [oldId, ...recipeIds]) {
        expect(docs.match(new RegExp(`demoId="${id}"`, 'g'))).toHaveLength(1);
        const sourcePath = getDemoSourcePath(id);
        expect(readFileSync(sourcePath, 'utf8')).toMatch(/export default/);
        expect(docs).toContain(recipeUrl(sourcePath));
      }
      expect(docs).toContain(upstream);
      expect(docs).toContain('DropdownMenuWithDestructive');
      expect(docs).toContain('DropdownMenuWithInset');
      expect(docs).toContain('native/GPUI');
      expect(docs).toContain('Base');
      // Docs describe the pinned New York inset padding (physical-left 2rem).
      expect(docs).toContain('2rem');
      expect(docs).toMatch(locale === 'en' ? /local validation extension/ : /本地验证扩展/);
      expect(docs).toMatch(locale === 'en' ? /remain incomplete/ : /仍未完成/);
    });
  }
});

// Actual WC renderer + prototypes in Happy DOM: source-host evidence only.
// This does not measure browser paint/contrast, native input or native/GPUI.
describe('Dropdown recipe WC source-host rendering', () => {
  for (const id of recipeIds) {
    it(`${id}: renders fixed SVGs, live menu parts and their bounded props`, async () => {
      const demo = await recipe(id);
      const ids = new Set<string>();
      collectPrototypeIds(demo.root, ids);
      await loadPrototypes([...ids]);
      const host = document.createElement('div');
      document.body.append(host);
      let api!: DemoRuntimeApi;
      let refs!: Record<string, HTMLElement>;
      const view = await renderDemo({
        runtime: 'wc',
        host,
        demo: {
          ...demo,
          setup(context) {
            api = context.api;
            refs = context.refs;
          },
        },
      });
      cleanups.push(() => view.destroy());
      api.call('menu', 'openDropdown');
      const open = () => (api.getExposes('menu')!.open as { get(): boolean }).get();
      await vi.waitFor(() => expect(open()).toBe(true));
      const items = Array.from(refs.content.querySelectorAll<HTMLElement>('[role="menuitem"]'));
      expect(items).toHaveLength(id === recipeIds[0] ? 5 : 4);
      const icons = Array.from(refs.content.querySelectorAll('svg'));
      expect(icons).toHaveLength(id === recipeIds[0] ? 5 : 2);
      for (const icon of icons) {
        expect(icon.getAttribute('width')).toBe('16');
        expect(icon.getAttribute('height')).toBe('16');
        expect(icon.querySelector('path, rect, circle, line, polyline, polygon')).not.toBeNull();
      }
      if (id === recipeIds[0]) {
        // P-BASE-DROPDOWN-MENU-ITEM-DISABLED: focusable, no select or close.
        const disabled = refs['delete-disabled'];
        expect(disabled.getAttribute('aria-disabled')).toBe('true');
        // Observe the initial open-entry focus before requesting a later focus.
        await vi.waitFor(() => expect(document.activeElement).toBe(items[0]));
        const selected = vi.fn();
        disabled.addEventListener('select', selected);
        api.call('delete-disabled', 'focusSelf', { reason: 'keyboard' });
        await vi.waitFor(() => expect(document.activeElement).toBe(disabled));
        for (const type of ['keydown', 'keyup'])
          disabled.dispatchEvent(
            new KeyboardEvent(type, { key: 'Enter', bubbles: true, cancelable: true })
          );
        expect(selected).not.toHaveBeenCalled();
        expect(open()).toBe(true);
        // Enabled destructive is the positive control for the same activation path.
        const enabled = refs.delete;
        enabled.addEventListener('select', selected);
        api.call('delete', 'focusSelf', { reason: 'keyboard' });
        await vi.waitFor(() => expect(document.activeElement).toBe(enabled));
        for (const type of ['keydown', 'keyup'])
          enabled.dispatchEvent(
            new KeyboardEvent(type, { key: 'Enter', bubbles: true, cancelable: true })
          );
        await vi.waitFor(() => {
          expect(selected).toHaveBeenCalledTimes(1);
          expect(open()).toBe(false);
          expect(document.activeElement).toBe(refs.trigger);
        });
      } else {
        // Shadcn-only inset recipe; naming still comes from actual Base Label.
        const plain = refs['actions-label'];
        const inset = refs['more-label'];
        // Default new-york-v4 recipe: inset Label/Item gets physical-left pl-8.
        expect(plain.getAttribute('data-pui-style')?.split(/\s+/)).not.toContain('pl-8');
        expect(inset.getAttribute('data-pui-style')?.split(/\s+/)).toContain('pl-8');
        for (const [groupRef, label] of [
          ['actions-group', plain],
          ['more-group', inset],
        ] as const) {
          expect(refs[groupRef].getAttribute('aria-labelledby')).toBe(label.id);
        }
      }
      // The renderer releases its refs map on teardown, so capture the
      // element first and observe its detachment afterwards.
      const content = refs.content;
      await view.destroy();
      expect(host.childElementCount).toBe(0);
      expect(content.isConnected).toBe(false);
    }, 20_000);
  }
});
