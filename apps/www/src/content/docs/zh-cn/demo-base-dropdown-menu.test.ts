// @vitest-environment happy-dom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import root from '../../../../../../packages/prototypes/base/src/dropdown/root.proto';
import trigger from '../../../../../../packages/prototypes/base/src/dropdown/trigger.proto';
import content from '../../../../../../packages/prototypes/base/src/dropdown/content.proto';
import item from '../../../../../../packages/prototypes/base/src/dropdown/item.proto';
import group from '../../../../../../packages/prototypes/base/src/dropdown/group.proto';
import label from '../../../../../../packages/prototypes/base/src/dropdown/label.proto';
import separator from '../../../../../../packages/prototypes/base/src/dropdown/separator.proto';
import shortcut from '../../../../../../packages/prototypes/base/src/dropdown/shortcut.proto';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import { assertDemoSpec, type DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-dropdown-menu.demo.ts', { eager: true });
const docs = (locale: string) =>
  resolve(
    process.cwd(),
    'apps/www/src/content/docs',
    locale,
    'ui-libraries/base/dropdown-menu.mdx'
  );

describe('Base Dropdown Menu documentation registration', () => {
  it('loads the actual public Base Dropdown root, trigger, content, item, group, label, separator, and shortcut prototypes lazily', async () => {
    for (const protoId of [
      'base-dropdown-root',
      'base-dropdown-trigger',
      'base-dropdown-content',
      'base-dropdown-item',
      'base-dropdown-group',
      'base-dropdown-label',
      'base-dropdown-separator',
      'base-dropdown-shortcut',
    ]) {
      expect(prototypeModules[protoId]).toBeTypeOf('function');
      await loadPrototype(protoId);
    }
    expect(getPrototype('base-dropdown-root')).toBe(root);
    expect(getPrototype('base-dropdown-trigger')).toBe(trigger);
    expect(getPrototype('base-dropdown-content')).toBe(content);
    expect(getPrototype('base-dropdown-item')).toBe(item);
    expect(getPrototype('base-dropdown-group')).toBe(group);
    expect(getPrototype('base-dropdown-label')).toBe(label);
    expect(getPrototype('base-dropdown-separator')).toBe(separator);
    expect(getPrototype('base-dropdown-shortcut')).toBe(shortcut);
  });
  it.each(['en', 'zh-cn'])(
    'registers the dropdown-menu demo on the %s page with the three-runtime scope',
    (locale) => {
      const path = docs(locale);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text).toContain('demo-base-dropdown-menu');
      expect(text).toContain("runtimes={['wc', 'react', 'vue']}");
    }
  );
  it('makes Base Dropdown discoverable in the sidebar', () => {
    const config = readFileSync(resolve(process.cwd(), 'apps/www/astro.config.mjs'), 'utf8');
    expect(config).toContain("slug: 'ui-libraries/base/dropdown-menu'");
  });
  it('admits a Base-only declarative recipe with one root holding a trigger and a content', () => {
    const recipe = (
      recipes['./demo-base-dropdown-menu.demo.ts'] as { default?: DemoSpec } | undefined
    )?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Dropdown Menu recipe is missing.');
    assertDemoSpec(recipe);
    const directProtoChildren = (node: any) =>
      (node?.children ?? []).filter(
        (child: any) => child && typeof child === 'object' && child.kind === 'proto'
      );
    let rootCount = 0;
    const collectRoots = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.kind === 'proto' && node.prototypeId === 'base-dropdown-root') {
        rootCount += 1;
        const children = directProtoChildren(node);
        const triggers = children.filter(
          (child: any) => child.prototypeId === 'base-dropdown-trigger'
        );
        const contents = children.filter(
          (child: any) => child.prototypeId === 'base-dropdown-content'
        );
        expect(triggers.length).toBe(1);
        expect(contents.length).toBe(1);
      }
      for (const child of node.children ?? []) collectRoots(child);
    };
    collectRoots((recipe as any).root);
    expect(rootCount).toBe(1);
  });
});
