// @vitest-environment happy-dom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { imageRoot } from '@proto.ui/prototypes-base/image';
import { button } from '@proto.ui/prototypes-base';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import { assertDemoSpec, type DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-image.demo.ts', { eager: true });
const docs = (locale: string) =>
  resolve(process.cwd(), 'apps/www/src/content/docs', locale, 'ui-libraries/base/image.mdx');

describe('Base Image documentation registration', () => {
  it('loads the actual public Base Image root and Button prototypes lazily', async () => {
    for (const protoId of ['base-image-root', 'base-button']) {
      expect(prototypeModules[protoId]).toBeTypeOf('function');
      await loadPrototype(protoId);
    }
    expect(getPrototype('base-image-root')).toBe(imageRoot);
    expect(getPrototype('base-button')).toBe(button);
  });
  it.each(['en', 'zh-cn'])(
    'registers the image demo on the %s page with the four-runtime scope',
    (locale) => {
      const path = docs(locale);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text).toContain('demo-base-image');
      expect(text).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
    }
  );
  it('makes Base Image discoverable in the sidebar', () => {
    const config = readFileSync(resolve(process.cwd(), 'apps/www/astro.config.mjs'), 'utf8');
    expect(config).toContain("slug: 'ui-libraries/base/image'");
  });
  it('admits a Base-only image recipe exercising five image roots and four actions', () => {
    const recipe = (recipes['./demo-base-image.demo.ts'] as { default?: DemoSpec } | undefined)
      ?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Image recipe is missing.');
    assertDemoSpec(recipe);
    let imageCount = 0;
    let buttonCount = 0;
    const collect = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.kind === 'proto' && node.prototypeId === 'base-image-root') imageCount += 1;
      if (node.kind === 'proto' && node.prototypeId === 'base-button') buttonCount += 1;
      for (const child of node.children ?? []) collect(child);
    };
    collect((recipe as any).root);
    expect(imageCount).toBe(5);
    expect(buttonCount).toBe(4);
  });
});
