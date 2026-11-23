// @vitest-environment happy-dom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { labelRoot } from '@proto.ui/prototypes-base/label';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import { assertDemoSpec, type DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-label.demo.ts', { eager: true });
const docs = (locale: string) =>
  resolve(process.cwd(), 'apps/www/src/content/docs', locale, 'ui-libraries/base/label.mdx');

describe('Base Label documentation registration', () => {
  it('loads the actual public Base Label prototype lazily', async () => {
    expect(prototypeModules['base-label-root']).toBeTypeOf('function');
    await loadPrototype('base-label-root');
    expect(getPrototype('base-label-root')).toBe(labelRoot);
  });
  it.each(['en', 'zh-cn'])(
    'registers the label demo on the %s page with the four-runtime scope',
    (locale) => {
      const path = docs(locale);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text).toContain('demo-base-label');
      expect(text).toContain('initialRuntime="wc"');
      expect(text).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
      expect(text).toContain('@proto.ui/prototypes-base/label');
    }
  );
  it('makes Base Label discoverable in the sidebar', () => {
    const config = readFileSync(resolve(process.cwd(), 'apps/www/astro.config.mjs'), 'utf8');
    expect(config).toContain("slug: 'ui-libraries/base/label'");
  });
  it('admits all eleven exact associations, including independent read-only controls', () => {
    const recipe = (recipes['./demo-base-label.demo.ts'] as { default?: DemoSpec } | undefined)
      ?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Label recipe is missing.');
    assertDemoSpec(recipe);
    const root = (recipe as any).root;
    expect(root.kind).toBe('box');
    const prototypes: any[] = [];
    const collect = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.kind === 'proto') prototypes.push(node);
      for (const child of node.children ?? []) collect(child);
    };
    collect(root);
    const labels = prototypes.filter((node) => node.prototypeId === 'base-label-root');
    expect(labels.map((node) => node.associations?.controlLabel)).toEqual([
      'checkbox',
      'switch',
      'radio-email',
      'radio-push',
      'input',
      'textarea',
      'readonly-input',
      'readonly-textarea',
      'disabled',
      'controlled',
      'passive',
    ]);
    for (const label of labels) {
      const targets = prototypes.filter(
        (node) =>
          node !== label && node.associations?.controlLabel === label.associations.controlLabel
      );
      expect(targets).toHaveLength(1);
      if (label.associations.controlLabel.startsWith('readonly-')) {
        expect(targets[0].props.readOnly).toBe(true);
        expect(targets[0].props).not.toHaveProperty('disabled');
      }
    }
    expect(
      labels.find((node) => node.associations.controlLabel === 'passive').props.activation
    ).toBe(false);
  });
});
