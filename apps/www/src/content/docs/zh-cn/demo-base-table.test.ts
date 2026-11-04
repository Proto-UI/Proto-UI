// @vitest-environment happy-dom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  tableRoot,
  tableCaption,
  tableRow,
  tableHeaderCell,
  tableCell,
} from '@proto.ui/prototypes-base/table';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import { assertDemoSpec, type DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-table.demo.ts', { eager: true });
const docs = (locale: string) =>
  resolve(process.cwd(), 'apps/www/src/content/docs', locale, 'ui-libraries/base/table.mdx');

describe('Base Table documentation registration', () => {
  it('loads the actual public Base Table root, caption, row, header-cell, and cell prototypes lazily', async () => {
    for (const protoId of [
      'base-table-root',
      'base-table-caption',
      'base-table-row',
      'base-table-header-cell',
      'base-table-cell',
    ]) {
      expect(prototypeModules[protoId]).toBeTypeOf('function');
      await loadPrototype(protoId);
    }
    expect(getPrototype('base-table-root')).toBe(tableRoot);
    expect(getPrototype('base-table-caption')).toBe(tableCaption);
    expect(getPrototype('base-table-row')).toBe(tableRow);
    expect(getPrototype('base-table-header-cell')).toBe(tableHeaderCell);
    expect(getPrototype('base-table-cell')).toBe(tableCell);
  });
  it.each(['en', 'zh-cn'])(
    'registers the table demo on the %s page with the four-runtime scope',
    (locale) => {
      const path = docs(locale);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text).toContain('demo-base-table');
      expect(text).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
    }
  );
  it('makes Base Table discoverable in the sidebar', () => {
    const config = readFileSync(resolve(process.cwd(), 'apps/www/astro.config.mjs'), 'utf8');
    expect(config).toContain("slug: 'ui-libraries/base/table'");
  });
  it('admits a Base-only declarative recipe with one root holding a caption and three rows', () => {
    const recipe = (recipes['./demo-base-table.demo.ts'] as { default?: DemoSpec } | undefined)
      ?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Table recipe is missing.');
    assertDemoSpec(recipe);
    const directProtoChildren = (node: any) =>
      (node?.children ?? []).filter(
        (child: any) => child && typeof child === 'object' && child.kind === 'proto'
      );
    let rootCount = 0;
    const collectRoots = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.kind === 'proto' && node.prototypeId === 'base-table-root') {
        rootCount += 1;
        const children = directProtoChildren(node);
        const captions = children.filter(
          (child: any) => child.prototypeId === 'base-table-caption'
        );
        const rows = children.filter((child: any) => child.prototypeId === 'base-table-row');
        expect(captions.length).toBe(1);
        expect(rows.length).toBe(3);
        // The first row is the header row (three header cells); the other two are data rows.
        const headerRow = rows[0];
        const headerCells = directProtoChildren(headerRow).filter(
          (child: any) => child.prototypeId === 'base-table-header-cell'
        );
        expect(headerCells.length).toBe(3);
        for (const dataRow of rows.slice(1)) {
          const rowHeaders = directProtoChildren(dataRow).filter(
            (child: any) => child.prototypeId === 'base-table-header-cell'
          );
          const valueCells = directProtoChildren(dataRow).filter(
            (child: any) => child.prototypeId === 'base-table-cell'
          );
          expect(rowHeaders.length).toBe(1);
          expect(valueCells.length).toBe(2);
        }
      }
      for (const child of node.children ?? []) collectRoots(child);
    };
    collectRoots((recipe as any).root);
    expect(rootCount).toBe(1);
  });
});
