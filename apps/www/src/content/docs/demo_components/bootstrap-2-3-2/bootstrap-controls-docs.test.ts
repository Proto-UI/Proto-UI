import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertDemoSpec,
  collectPrototypeIds,
  type DemoChild,
} from '../../../../components/PrototypePreviewer/demo-types';
import { loadDemo } from '../../../../components/PrototypePreviewer/demo-modules';
import { createProjectionComposition } from '../../../../components/PrototypePreviewer/projection-composition';
import { resolveProjectionRecipe } from '../../../../components/PrototypePreviewer/projection-families';

const family = 'bootstrap-2-3-2';
const cases = {
  button: ['button'],
  checkbox: ['checkbox-root', 'checkbox-indicator'],
  switch: ['switch-root', 'switch-thumb'],
  toggle: ['toggle'],
  input: ['input-root'],
  textarea: ['textarea-root'],
  separator: ['separator-root'],
} as const;

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

function walk(node: DemoChild, visit: (node: Exclude<DemoChild, string>) => void): void {
  if (typeof node === 'string') return;
  visit(node);
  if (node.kind !== 'text') for (const child of node.children ?? []) walk(child, visit);
}

describe('Bootstrap 2.3.2 partial-family public recipes', () => {
  for (const [kind, parts] of Object.entries(cases)) {
    it(`${kind} resolves only its real family parts in each toolbar-free Web composition`, async () => {
      const recipe = resolveProjectionRecipe(`demo-${family}-${kind}`);
      expect(recipe).toEqual({ projectionFamilyId: family, familyId: kind });
      const demo = await loadDemo(`demo-${family}-${kind}`);
      assertDemoSpec(demo);
      const expected = parts.map((part) => `${family}-${part}`);
      const ids = new Set<string>();
      collectPrototypeIds(demo.root, ids);
      expect([...ids].sort()).toEqual(expected.sort());

      for (const runtimeId of ['wc', 'react', 'vue', 'vue2'] as const) {
        const composition = createProjectionComposition({
          ownerId: `test-${kind}-${runtimeId}`,
          runtimeId,
          projectionFamilyId: family,
          generation: 1,
          componentId: recipe.familyId,
          childDemo: demo,
          controlIds: [],
          controls: {
            runtime: { label: 'Runtime', options: [], onValueChange() {} },
            family: { label: 'Family', options: [], onValueChange() {} },
            component: { label: 'Component', options: [], onValueChange() {} },
          },
        });
        const mountedIds = new Set<string>();
        collectPrototypeIds(composition.demo.root, mountedIds);
        expect([...mountedIds].sort()).toEqual(expected.sort());
        expect([...mountedIds].some((id) => id.includes('select'))).toBe(false);
      }
    });

    it(`${kind} has bilingual global-runtime pages and a sidebar entry`, () => {
      for (const locale of ['en', 'zh-cn']) {
        const page = read(`apps/www/src/content/docs/${locale}/ui-libraries/${family}/${kind}.mdx`);
        expect(page).toContain(`demoId="demo-${family}-${kind}"`);
        expect(page).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
        expect(page).toContain('toolbar={false}');
        expect(page).not.toContain('data-adapter-panel');
        expect(page).toContain('private');
        expect(page).toContain('draft');
        expect(page).toContain('GPUI');
      }
      expect(read('apps/www/astro.config.mjs')).toContain(`slug: 'ui-libraries/${family}/${kind}'`);
      const overview = read('apps/www/src/components/PrototypeLibraryOverview.astro');
      expect(overview).toContain(`demoId: 'demo-${family}-${kind}'`);
    });
  }

  it('gives every text editor an accessible name, without children or a second value owner', async () => {
    for (const kind of ['input', 'textarea']) {
      const demo = await loadDemo(`demo-${family}-${kind}`);
      expect(demo.setup).toBeUndefined();
      let count = 0;
      walk(demo.root, (node) => {
        if (node.kind !== 'proto') return;
        count++;
        expect(node.children).toBeUndefined();
        expect(node.props?.ariaLabel).toBeTruthy();
        expect(node.props?.defaultValue).toBeTypeOf('string');
      });
      expect(count).toBe(3);
    }
  });

  it('keeps custom checkbox and design-language extensions explicit in both locales', () => {
    for (const locale of ['en', 'zh-cn']) {
      for (const kind of ['switch', 'toggle']) {
        const page = read(`apps/www/src/content/docs/${locale}/ui-libraries/${family}/${kind}.mdx`);
        expect(page).toContain('design-language extension');
        expect(page).toContain(locale === 'en' ? 'not an original Bootstrap' : '不是 Bootstrap');
      }
      const checkbox = read(
        `apps/www/src/content/docs/${locale}/ui-libraries/${family}/checkbox.mdx`
      );
      expect(checkbox).toContain(
        locale === 'en' ? 'not the archived native checkbox' : '不是归档版本原生 checkbox'
      );
      const index = read(`apps/www/src/content/docs/${locale}/ui-libraries/${family}/index.mdx`);
      expect(index).toContain('partial family');
      expect(index).toContain(
        locale === 'en'
          ? 'not offered by the homepage full-family selector'
          : '不接入首页的完整族选择器'
      );
    }
  });
});
