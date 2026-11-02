// @vitest-environment happy-dom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  calendarRoot,
  calendarCaption,
  calendarHeading,
  calendarGrid,
  calendarWeekdays,
  calendarWeekday,
  calendarRow,
  calendarDay,
  calendarPrevious,
  calendarNext,
} from '@proto.ui/prototypes-base/calendar';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import { assertDemoSpec, type DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-calendar.demo.ts', { eager: true });
const docs = (locale: string) =>
  resolve(process.cwd(), 'apps/www/src/content/docs', locale, 'ui-libraries/base/calendar.mdx');

describe('Base Calendar documentation registration', () => {
  it('loads the actual public Base Calendar prototypes lazily', async () => {
    for (const protoId of [
      'base-calendar-root',
      'base-calendar-caption',
      'base-calendar-heading',
      'base-calendar-grid',
      'base-calendar-weekdays',
      'base-calendar-weekday',
      'base-calendar-row',
      'base-calendar-day',
      'base-calendar-previous',
      'base-calendar-next',
    ]) {
      expect(prototypeModules[protoId]).toBeTypeOf('function');
      await loadPrototype(protoId);
    }
    expect(getPrototype('base-calendar-root')).toBe(calendarRoot);
    expect(getPrototype('base-calendar-caption')).toBe(calendarCaption);
    expect(getPrototype('base-calendar-heading')).toBe(calendarHeading);
    expect(getPrototype('base-calendar-grid')).toBe(calendarGrid);
    expect(getPrototype('base-calendar-weekdays')).toBe(calendarWeekdays);
    expect(getPrototype('base-calendar-weekday')).toBe(calendarWeekday);
    expect(getPrototype('base-calendar-row')).toBe(calendarRow);
    expect(getPrototype('base-calendar-day')).toBe(calendarDay);
    expect(getPrototype('base-calendar-previous')).toBe(calendarPrevious);
    expect(getPrototype('base-calendar-next')).toBe(calendarNext);
  });
  it.each(['en', 'zh-cn'])(
    'registers the calendar demo on the %s page with the four-runtime scope',
    (locale) => {
      const path = docs(locale);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text).toContain('demo-base-calendar');
      expect(text).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
    }
  );
  it('makes Base Calendar discoverable in the sidebar', () => {
    const config = readFileSync(resolve(process.cwd(), 'apps/www/astro.config.mjs'), 'utf8');
    expect(config).toContain("slug: 'ui-libraries/base/calendar'");
  });
  it('admits a Base-only calendar recipe with one root, a navigable caption, and a 6x7 grid', () => {
    const recipe = (recipes['./demo-base-calendar.demo.ts'] as { default?: DemoSpec } | undefined)
      ?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Calendar recipe is missing.');
    assertDemoSpec(recipe);
    const protoChildren = (node: any) =>
      (node?.children ?? []).filter(
        (child: any) => child && typeof child === 'object' && child.kind === 'proto'
      );
    let rootCount = 0;
    const collect = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.kind === 'proto' && node.prototypeId === 'base-calendar-root') {
        rootCount += 1;
        const children = protoChildren(node);
        expect(children.filter((c: any) => c.prototypeId === 'base-calendar-caption').length).toBe(
          1
        );
        expect(children.filter((c: any) => c.prototypeId === 'base-calendar-heading').length).toBe(
          1
        );
        expect(children.filter((c: any) => c.prototypeId === 'base-calendar-grid').length).toBe(1);
        const caption = children.find((c: any) => c.prototypeId === 'base-calendar-caption');
        const captionChildren = protoChildren(caption);
        expect(
          captionChildren.filter(
            (c: any) =>
              c.prototypeId === 'base-calendar-previous' || c.prototypeId === 'base-calendar-next'
          ).length
        ).toBe(2);
        expect(
          captionChildren.filter((c: any) => c.prototypeId === 'base-select-root').length
        ).toBe(2);
        const grid = children.find((c: any) => c.prototypeId === 'base-calendar-grid');
        const gridChildren = protoChildren(grid);
        const weekdays = gridChildren.find((c: any) => c.prototypeId === 'base-calendar-weekdays');
        expect(protoChildren(weekdays).length).toBe(7);
        const rows = gridChildren.filter((c: any) => c.prototypeId === 'base-calendar-row');
        expect(rows.length).toBe(6);
        for (const row of rows) {
          expect(
            protoChildren(row).filter((c: any) => c.prototypeId === 'base-calendar-day').length
          ).toBe(7);
        }
      }
      for (const child of node.children ?? []) collect(child);
    };
    collect((recipe as any).root);
    expect(rootCount).toBe(1);
  });
});
