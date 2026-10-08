import { readFileSync } from 'node:fs';
import { docsSchema } from '@astrojs/starlight/schema';
import { z } from 'astro/zod';
import YAML from 'yaml';
import { describe, expect, it } from 'vitest';
import { appendHomeActionGlyph, homeActionIcon } from './home-action-icons';

describe('bounded hero decorative icon mapping', () => {
  it('consumes both actual homepage frontmatters through the installed Starlight schema', () => {
    // These homepage fixtures have no hero image; image admission is outside this test.
    const schema = docsSchema()({
      image: () =>
        z.object({
          src: z.string(),
          width: z.number(),
          height: z.number(),
          format: z.union([
            z.literal('png'),
            z.literal('jpg'),
            z.literal('jpeg'),
            z.literal('tiff'),
            z.literal('webp'),
            z.literal('gif'),
            z.literal('svg'),
            z.literal('avif'),
          ]),
        }),
    });
    for (const locale of ['en', 'zh-cn']) {
      const source = readFileSync(`apps/www/src/content/docs/${locale}/index.mdx`, 'utf8');
      const frontmatter = YAML.parse(source.match(/^---\n([\s\S]*?)\n---/)![1]!);
      const parsed = schema.parse(frontmatter);
      const action = parsed.hero!.actions.find(({ link }) => link === '#home-demo-previewer')!;
      expect(action.icon).toEqual({ type: 'icon', name: 'external' });
      expect(homeActionIcon(action.icon)).toBe('external');
      expect(action.text).toBe(locale === 'zh-cn' ? '试试 Demo' : 'Try the components');
    }
  });
  it('accepts the configured external icon without interpreting arbitrary inputs', () => {
    expect(homeActionIcon('external')).toBe('external');
    for (const value of [
      undefined,
      null,
      '',
      'github',
      'unknown',
      '<svg/>',
      {},
      1,
      { type: 'raw', html: '<svg/>' },
      { type: 'raw', name: 'external' },
      { type: 'icon', name: 'github' },
      { name: 'external' },
    ])
      expect(homeActionIcon(value)).toBeUndefined();
  });
  it('uses Lucide arrow geometry with matching SSR and runtime paint', () => {
    expect(homeActionIcon('arrow-right')).toBe('arrow-right');
    expect(homeActionIcon({ type: 'icon', name: 'arrow-right' })).toBe('arrow-right');
    const slot = document.createElement('span');
    appendHomeActionGlyph(slot, 'arrow-right');
    const path = slot.querySelector('path')!;
    expect(path.getAttribute('d')).toBe('M5 12h14 m12 5 7 7-7 7');
    expect(path.getAttribute('fill')).toBe('none');
    expect(path.getAttribute('stroke')).toBe('currentColor');
    expect(slot.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
  });
  it('creates passive artwork with no name or focus owner', () => {
    const slot = document.createElement('span');
    appendHomeActionGlyph(slot, 'external');
    const svg = slot.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(svg.style.marginInlineStart).toBe('0.5rem');
    expect(svg.querySelector('path')?.getAttribute('d')).toBeTruthy();
    expect(slot.textContent).toBe('');
    expect(slot.querySelector('a,button,[tabindex],[role]')).toBeNull();
  });
});
