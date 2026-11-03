// @vitest-environment happy-dom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  datePickerRoot,
  datePickerTrigger,
  datePickerValue,
  datePickerContent,
  datePickerDay,
} from '@proto.ui/prototypes-base/date-picker';
import { calendarHeading, calendarGrid, calendarRow } from '@proto.ui/prototypes-base/calendar';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import { assertDemoSpec, type DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-date-picker.demo.ts', { eager: true });
const docs = (locale: string) =>
  resolve(process.cwd(), 'apps/www/src/content/docs', locale, 'ui-libraries/base/date-picker.mdx');

describe('Base Date Picker documentation registration', () => {
  it('loads the actual public Base Date Picker and Calendar prototypes the recipe uses lazily', async () => {
    for (const protoId of [
      'base-date-picker-root',
      'base-date-picker-trigger',
      'base-date-picker-value',
      'base-date-picker-content',
      'base-date-picker-day',
      'base-calendar-heading',
      'base-calendar-grid',
      'base-calendar-row',
    ]) {
      expect(prototypeModules[protoId]).toBeTypeOf('function');
      await loadPrototype(protoId);
    }
    expect(getPrototype('base-date-picker-root')).toBe(datePickerRoot);
    expect(getPrototype('base-date-picker-trigger')).toBe(datePickerTrigger);
    expect(getPrototype('base-date-picker-value')).toBe(datePickerValue);
    expect(getPrototype('base-date-picker-content')).toBe(datePickerContent);
    expect(getPrototype('base-date-picker-day')).toBe(datePickerDay);
    expect(getPrototype('base-calendar-heading')).toBe(calendarHeading);
    expect(getPrototype('base-calendar-grid')).toBe(calendarGrid);
    expect(getPrototype('base-calendar-row')).toBe(calendarRow);
  });
  it.each(['en', 'zh-cn'])(
    'registers the date-picker demo on the %s page with the four-runtime scope',
    (locale) => {
      const path = docs(locale);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text).toContain('demo-base-date-picker');
      expect(text).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
    }
  );
  it('makes Base Date Picker discoverable in the sidebar', () => {
    const config = readFileSync(resolve(process.cwd(), 'apps/www/astro.config.mjs'), 'utf8');
    expect(config).toContain("slug: 'ui-libraries/base/date-picker'");
  });
  it('admits a Base-only declarative recipe with one root holding a trigger and a content', () => {
    const recipe = (
      recipes['./demo-base-date-picker.demo.ts'] as { default?: DemoSpec } | undefined
    )?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Date Picker recipe is missing.');
    assertDemoSpec(recipe);
    const directProtoChildren = (node: any) =>
      (node?.children ?? []).filter(
        (child: any) => child && typeof child === 'object' && child.kind === 'proto'
      );
    let rootCount = 0;
    const collectRoots = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.kind === 'proto' && node.prototypeId === 'base-date-picker-root') {
        rootCount += 1;
        const children = directProtoChildren(node);
        const triggers = children.filter(
          (child: any) => child.prototypeId === 'base-date-picker-trigger'
        );
        const contents = children.filter(
          (child: any) => child.prototypeId === 'base-date-picker-content'
        );
        expect(triggers.length).toBe(1);
        expect(contents.length).toBe(1);
        // The trigger carries the value; the content carries the calendar heading and grid.
        const triggerValue = directProtoChildren(triggers[0]).filter(
          (child: any) => child.prototypeId === 'base-date-picker-value'
        );
        expect(triggerValue.length).toBe(1);
        const contentCalendar = directProtoChildren(contents[0]);
        expect(
          contentCalendar.filter((child: any) => child.prototypeId === 'base-calendar-heading')
            .length
        ).toBe(1);
        expect(
          contentCalendar.filter((child: any) => child.prototypeId === 'base-calendar-grid').length
        ).toBe(1);
      }
      for (const child of node.children ?? []) collectRoots(child);
    };
    collectRoots((recipe as any).root);
    expect(rootCount).toBe(1);
  });
});
