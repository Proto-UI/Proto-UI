import { readFileSync } from 'node:fs';
import { docsSchema } from '@astrojs/starlight/schema';
import { z } from 'astro/zod';
import YAML from 'yaml';
import { describe, expect, it } from 'vitest';
import { appendHomeActionGlyph, homeActionIcon, HOME_ACTION_ICONS } from './home-action-icons';

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
    const paths = [...slot.querySelectorAll('path')];
    expect(paths).toHaveLength(2);
    expect(paths.map((path) => path.getAttribute('d'))).toEqual(['M5 12h14', 'm12 5 7 7-7 7']);
    for (const path of paths) {
      expect(path.getAttribute('fill')).toBe('none');
      expect(path.getAttribute('stroke')).toBe('currentColor');
    }
    const ssr = readFileSync('apps/www/src/components/Homepage/HomeActions.astro', 'utf8');
    expect(ssr).toContain('.paths.map((d) => (');
    expect(ssr).toContain('d={d}');
    expect(slot.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps relative arrowhead moves at their own origin and rejects concatenated-path geometry', () => {
    // Minimal line-path interpreter for this exact Lucide M/m/h artwork.
    // Unknown commands fail closed; repeated pairs after m are relative lines.
    const vertices = (d: string) => {
      const tokens = d.match(/[a-zA-Z]|-?\d+(?:\.\d+)?/g)!;
      const points: number[][] = [];
      let x = 0,
        y = 0,
        command = '';
      while (tokens.length) {
        if (/^[a-zA-Z]$/.test(tokens[0]!)) command = tokens.shift()!;
        if (command === 'M' || command === 'm' || command === 'l') {
          const dx = Number(tokens.shift()),
            dy = Number(tokens.shift());
          x = command === 'M' ? dx : x + dx;
          y = command === 'M' ? dy : y + dy;
          if (command === 'm') command = 'l';
        } else if (command === 'h') x += Number(tokens.shift());
        else throw new Error(`Unexpected command ${command}`);
        points.push([x, y]);
      }
      return points;
    };
    expect(HOME_ACTION_ICONS['arrow-right'].paths.map(vertices)).toEqual([
      [
        [5, 12],
        [19, 12],
      ],
      [
        [12, 5],
        [19, 12],
        [12, 19],
      ],
    ]);
    const joined = vertices(HOME_ACTION_ICONS['arrow-right'].paths.join(' '));
    expect(joined[2]).toEqual([31, 17]);
    expect(joined.some(([x, y]) => x! > 24 || y! > 24)).toBe(true);
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
