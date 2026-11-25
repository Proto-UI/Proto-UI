import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { loadDemo } from './demo-modules';
import { loadPrototype } from './prototype-modules';
import { getPrototype } from './registry';
import {
  assertDemoSpec,
  collectPrototypeIds,
  type DemoChild,
  type DemoNode,
  type DemoSpec,
} from './demo-types';

// Toast is published for base, shadcn, brutalist, bootstrap-2-3-2, and
// liquid-glass. Every family declares initialRuntime="wc" and a four-runtime
// selector (including vue2). None of the families has a projection manifest
// entry, so each demo's authored atom set is asserted exactly. Independently
// load every published role, including optional parts absent from that demo.
const TOAST_FAMILIES = [
  {
    family: 'base',
    mdxPath: 'toast.mdx',
    slug: 'ui-libraries/base/toast',
  },
  {
    family: 'shadcn',
    mdxPath: 'toast.mdx',
    slug: 'ui-libraries/shadcn/toast',
  },
  {
    family: 'brutalist',
    mdxPath: 'components/toast.mdx',
    slug: 'ui-libraries/brutalist/components/toast',
  },
  {
    family: 'bootstrap-2-3-2',
    mdxPath: 'toast.mdx',
    slug: 'ui-libraries/bootstrap-2-3-2/toast',
  },
  {
    family: 'liquid-glass',
    mdxPath: 'toast.mdx',
    slug: 'ui-libraries/liquid-glass/toast',
  },
] as const;

const TOAST_ROLES = [
  'button',
  'toast-action',
  'toast-close',
  'toast-description',
  'toast-root',
  'toast-title',
  'toast-viewport',
] as const;

const TOAST_DEMOS = import.meta.glob<{ default: DemoSpec }>([
  '../../content/docs/demo-*-toast.demo.ts',
  '../../content/docs/demo_components/toast/*.demo.ts',
]);

function toastViewports(root: DemoChild) {
  const viewports: Extract<DemoNode, { kind: 'proto' }>[] = [];
  const visit = (node: DemoChild) => {
    if (typeof node === 'string' || node.kind === 'text') return;
    if (node.kind === 'proto' && node.prototypeId.endsWith('-toast-viewport')) viewports.push(node);
    node.children?.forEach(visit);
  };
  visit(root);
  return viewports;
}

describe('Toast actual DemoSpec registration', () => {
  for (const [path, load] of Object.entries(TOAST_DEMOS)) {
    it(`${path} carries the preview theme on its actual portal viewport`, async () => {
      const { default: demo } = await load();
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const viewports = toastViewports(demo.root);
      expect(viewports).toHaveLength(1);
      expect(viewports[0]?.previewTheme).toBe('portal');
      expect(viewports[0]?.ref).toBeTruthy();
    });
  }

  for (const { family, mdxPath, slug } of TOAST_FAMILIES) {
    it(`${family} loads only real family toast atoms`, async () => {
      const recipeId = `demo-${family}-toast`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const declaredIds = new Set<string>();
      collectPrototypeIds(demo.root, declaredIds);
      const ids = [...declaredIds].sort();
      const published = TOAST_ROLES.map((role) => `${family}-${role}`);
      // Keyed notifications declare their future atoms, including Close,
      // before the first notification is mounted.
      const expected = [...published];
      if (family === 'shadcn') expected.push('shadcn-style-scope');
      expect(ids).toEqual(expected.sort());
      for (const id of new Set([...ids, ...published])) {
        await loadPrototype(id);
        expect(getPrototype(id)?.name).toBe(id);
      }
    }, 30000);

    for (const locale of ['en', 'zh-cn'] as const) {
      it(`${locale}/${family} exposes the toast demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-toast"`);
        expect(source).toContain('initialRuntime="wc"');
        expect(source).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
      });
    }

    it(`lists ${family} toast in the sidebar`, () => {
      const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
      expect(config).toContain(`slug: '${slug}'`);
    });
  }
});
