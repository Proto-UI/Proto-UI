// @vitest-environment happy-dom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  dialogRoot,
  dialogTrigger,
  dialogMask,
  dialogContent,
  dialogTitle,
  dialogDescription,
  dialogClose,
} from '@proto.ui/prototypes-base/dialog';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import { assertDemoSpec, type DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-dialog.demo.ts', { eager: true });
const docs = (locale: string) =>
  resolve(process.cwd(), 'apps/www/src/content/docs', locale, 'ui-libraries/base/dialog.mdx');

describe('Base Dialog documentation registration', () => {
  it('loads the actual public Base Dialog family prototypes lazily', async () => {
    expect(prototypeModules['base-dialog-root']).toBeTypeOf('function');
    await loadPrototype('base-dialog-root');
    expect(getPrototype('base-dialog-root')).toBe(dialogRoot);
    await loadPrototype('base-dialog-trigger');
    expect(getPrototype('base-dialog-trigger')).toBe(dialogTrigger);
    await loadPrototype('base-dialog-mask');
    expect(getPrototype('base-dialog-mask')).toBe(dialogMask);
    await loadPrototype('base-dialog-content');
    expect(getPrototype('base-dialog-content')).toBe(dialogContent);
    await loadPrototype('base-dialog-title');
    expect(getPrototype('base-dialog-title')).toBe(dialogTitle);
    await loadPrototype('base-dialog-description');
    expect(getPrototype('base-dialog-description')).toBe(dialogDescription);
    await loadPrototype('base-dialog-close');
    expect(getPrototype('base-dialog-close')).toBe(dialogClose);
  });
  it.each(['en', 'zh-cn'])(
    'registers the dialog demo on the %s page with the three-runtime scope',
    (locale) => {
      const path = docs(locale);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text).toContain('demo-base-dialog');
      expect(text).toContain('initialRuntime="wc"');
      expect(text).toContain("runtimes={['wc', 'react', 'vue']}");
    }
  );
  it('makes Base Dialog discoverable in the sidebar', () => {
    const config = readFileSync(resolve(process.cwd(), 'apps/www/astro.config.mjs'), 'utf8');
    expect(config).toContain("slug: 'ui-libraries/base/dialog'");
  });
  it('admits a Base-only declarative recipe with one trigger, one mask, and two close actions', () => {
    const recipe = (recipes['./demo-base-dialog.demo.ts'] as { default?: DemoSpec } | undefined)
      ?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Dialog recipe is missing.');
    assertDemoSpec(recipe);
    const root = (recipe as any).root;
    expect(root.kind).toBe('proto');
    expect(root.prototypeId).toBe('base-dialog-root');
    const countChildrenIn = (node: any, prototypeId: string): number => {
      if (!node || typeof node !== 'object') return 0;
      let count = node.kind === 'proto' && node.prototypeId === prototypeId ? 1 : 0;
      for (const child of node.children ?? []) count += countChildrenIn(child, prototypeId);
      return count;
    };
    const triggerCounts: number[] = [];
    const maskCounts: number[] = [];
    const contentCounts: number[] = [];
    const titleCounts: number[] = [];
    const descriptionCounts: number[] = [];
    const closeCounts: number[] = [];
    const collectRoots = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.kind === 'proto' && node.prototypeId === 'base-dialog-root') {
        triggerCounts.push(countChildrenIn(node, 'base-dialog-trigger'));
        maskCounts.push(countChildrenIn(node, 'base-dialog-mask'));
        contentCounts.push(countChildrenIn(node, 'base-dialog-content'));
        titleCounts.push(countChildrenIn(node, 'base-dialog-title'));
        descriptionCounts.push(countChildrenIn(node, 'base-dialog-description'));
        closeCounts.push(countChildrenIn(node, 'base-dialog-close'));
      }
      for (const child of node.children ?? []) collectRoots(child);
    };
    collectRoots(root);
    expect(triggerCounts).toEqual([1]);
    expect(maskCounts).toEqual([1]);
    expect(contentCounts).toEqual([1]);
    expect(titleCounts).toEqual([1]);
    expect(descriptionCounts).toEqual([1]);
    expect(closeCounts).toEqual([2]);
  });
});
