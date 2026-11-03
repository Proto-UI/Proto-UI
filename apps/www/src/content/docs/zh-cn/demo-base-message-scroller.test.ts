// @vitest-environment happy-dom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  messageScrollerRoot,
  messageScrollerViewport,
  messageScrollerJump,
} from '@proto.ui/prototypes-base/message-scroller';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import { assertDemoSpec, type DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-message-scroller.demo.ts', { eager: true });
const docs = (locale: string) =>
  resolve(
    process.cwd(),
    'apps/www/src/content/docs',
    locale,
    'ui-libraries/base/message-scroller.mdx'
  );

describe('Base Message Scroller documentation registration', () => {
  it('loads the actual public Base Message Scroller root, viewport, and jump prototypes lazily', async () => {
    for (const protoId of [
      'base-message-scroller-root',
      'base-message-scroller-viewport',
      'base-message-scroller-jump',
    ]) {
      expect(prototypeModules[protoId]).toBeTypeOf('function');
      await loadPrototype(protoId);
    }
    expect(getPrototype('base-message-scroller-root')).toBe(messageScrollerRoot);
    expect(getPrototype('base-message-scroller-viewport')).toBe(messageScrollerViewport);
    expect(getPrototype('base-message-scroller-jump')).toBe(messageScrollerJump);
  });
  it.each(['en', 'zh-cn'])(
    'registers the message-scroller demo on the %s page with the four-runtime scope',
    (locale) => {
      const path = docs(locale);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text).toContain('demo-base-message-scroller');
      expect(text).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
    }
  );
  it('makes Base Message Scroller discoverable in the sidebar', () => {
    const config = readFileSync(resolve(process.cwd(), 'apps/www/astro.config.mjs'), 'utf8');
    expect(config).toContain("slug: 'ui-libraries/base/message-scroller'");
  });
  it('admits a Base-only declarative recipe with one root owning one viewport and one jump', () => {
    const recipe = (
      recipes['./demo-base-message-scroller.demo.ts'] as { default?: DemoSpec } | undefined
    )?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Message Scroller recipe is missing.');
    assertDemoSpec(recipe);
    let rootCount = 0;
    const collectRoots = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.kind === 'proto' && node.prototypeId === 'base-message-scroller-root') {
        rootCount += 1;
        const directProtoChildren = (node.children ?? []).filter(
          (child: any) => child && typeof child === 'object' && child.kind === 'proto'
        );
        const viewportCount = directProtoChildren.filter(
          (child: any) => child.prototypeId === 'base-message-scroller-viewport'
        ).length;
        const jumpCount = directProtoChildren.filter(
          (child: any) => child.prototypeId === 'base-message-scroller-jump'
        ).length;
        expect(viewportCount).toBe(1);
        expect(jumpCount).toBe(1);
      }
      for (const child of node.children ?? []) collectRoots(child);
    };
    collectRoots((recipe as any).root);
    expect(rootCount).toBe(1);
  });
});
