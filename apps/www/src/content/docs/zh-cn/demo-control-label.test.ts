import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createControlLabelDemo } from '../../../components/PrototypePreviewer/control-label-demo';
import {
  assertDemoSpec,
  collectPrototypeIds,
} from '../../../components/PrototypePreviewer/demo-types';
import { loadPrototype } from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
const families = ['base', 'shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'];
describe('public independent Label recipes and docs', () => {
  it.each(families)(
    '%s has a real public loader, explicit association recipe and bilingual reader page',
    async (family) => {
      const id = `${family}-label-root`;
      await loadPrototype(id);
      expect(getPrototype(id).name).toBe(id);
      const demo = createControlLabelDemo(id);
      assertDemoSpec(demo);
      const ids = new Set<string>();
      collectPrototypeIds(demo.root, ids);
      expect(ids).toEqual(
        new Set([
          id,
          'base-checkbox-root',
          'base-switch-root',
          'base-radio-group-root',
          'base-radio-group-item',
          'base-input-root',
          'base-textarea-root',
        ])
      );
      for (const locale of ['en', 'zh-cn']) {
        const folder = family === 'brutalist' ? 'brutalist/components' : family;
        const page = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${folder}/label.mdx`,
          'utf8'
        );
        expect(page).toContain(`demo-${family}-label`);
        expect(page).toContain('draft');
        expect(page).toContain('instanceAssociations');
        expect(page).toContain("'wc', 'react', 'vue', 'vue2'");
      }
    }
  );
  it('homepage visible Checkbox names use the public associated Label rather than a hidden copy', () => {
    const source = readFileSync(
      'apps/www/src/components/Homepage/homepage-gallery-parts.ts',
      'utf8'
    );
    const helper = source.slice(
      source.indexOf('const checkbox ='),
      source.indexOf('const status =')
    );
    expect(helper).toContain('label-root');
    expect(helper).toContain('choice:${ref}');
    expect(helper).not.toContain('sr-only');
  });
});
