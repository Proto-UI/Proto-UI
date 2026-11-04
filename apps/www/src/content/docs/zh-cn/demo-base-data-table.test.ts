// @vitest-environment happy-dom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  dataTableRoot,
  dataTableRow,
  dataTableCell,
  dataTableHeader,
  dataTableCaption,
  dataTableHeaderRow,
} from '@proto.ui/prototypes-base/data-table';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import { assertDemoSpec, type DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-data-table.demo.ts', { eager: true });
const docs = (locale: string) =>
  resolve(process.cwd(), 'apps/www/src/content/docs', locale, 'ui-libraries/base/data-table.mdx');

describe('Base Data Table documentation registration', () => {
  it('loads the actual public Base Data Table root, row, cell, header, caption, and header-row prototypes lazily', async () => {
    for (const protoId of [
      'base-data-table-root',
      'base-data-table-row',
      'base-data-table-cell',
      'base-data-table-header',
      'base-data-table-caption',
      'base-data-table-header-row',
    ]) {
      expect(prototypeModules[protoId]).toBeTypeOf('function');
      await loadPrototype(protoId);
    }
    expect(getPrototype('base-data-table-root')).toBe(dataTableRoot);
    expect(getPrototype('base-data-table-row')).toBe(dataTableRow);
    expect(getPrototype('base-data-table-cell')).toBe(dataTableCell);
    expect(getPrototype('base-data-table-header')).toBe(dataTableHeader);
    expect(getPrototype('base-data-table-caption')).toBe(dataTableCaption);
    expect(getPrototype('base-data-table-header-row')).toBe(dataTableHeaderRow);
  });
  it.each(['en', 'zh-cn'])(
    'registers the data-table demo on the %s page with the four-runtime scope',
    (locale) => {
      const path = docs(locale);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text).toContain('demo-base-data-table');
      expect(text).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
    }
  );
  it('makes Base Data Table discoverable in the sidebar', () => {
    const config = readFileSync(resolve(process.cwd(), 'apps/www/astro.config.mjs'), 'utf8');
    expect(config).toContain("slug: 'ui-libraries/base/data-table'");
  });
  it('admits a Base-only declarative recipe with one root holding a caption, a header row, and three rows', () => {
    const recipe = (recipes['./demo-base-data-table.demo.ts'] as { default?: DemoSpec } | undefined)
      ?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Data Table recipe is missing.');
    assertDemoSpec(recipe);
    const directProtoChildren = (node: any) =>
      (node?.children ?? []).filter(
        (child: any) => child && typeof child === 'object' && child.kind === 'proto'
      );
    let rootCount = 0;
    const collectRoots = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.kind === 'proto' && node.prototypeId === 'base-data-table-root') {
        rootCount += 1;
        const children = directProtoChildren(node);
        const captions = children.filter(
          (child: any) => child.prototypeId === 'base-data-table-caption'
        );
        const headerRows = children.filter(
          (child: any) => child.prototypeId === 'base-data-table-header-row'
        );
        const rows = children.filter((child: any) => child.prototypeId === 'base-data-table-row');
        expect(captions.length).toBe(1);
        expect(headerRows.length).toBe(1);
        expect(rows.length).toBe(3);
        const headers = directProtoChildren(headerRows[0]).filter(
          (child: any) => child.prototypeId === 'base-data-table-header'
        );
        expect(headers.length).toBe(2);
        for (const row of rows) {
          const cells = directProtoChildren(row).filter(
            (child: any) => child.prototypeId === 'base-data-table-cell'
          );
          expect(cells.length).toBe(2);
        }
      }
      for (const child of node.children ?? []) collectRoots(child);
    };
    collectRoots((recipe as any).root);
    expect(rootCount).toBe(1);
  });
});
