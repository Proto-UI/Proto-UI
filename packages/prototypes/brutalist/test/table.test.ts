import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleContains } from '../../test-utils/style';
import {
  brutalistTableCaption,
  brutalistTableCell,
  brutalistTableHeaderCell,
  brutalistTableRoot,
  brutalistTableRow,
  tableCaption,
  tableCell,
  tableHeaderCell,
  tableRoot,
  tableRow,
} from '../src/table';
import * as BrutalistPackage from '../src';
import * as TableEntry from '../src/table';
import type { BrutalistTableRootProps, BrutalistTableRowProps } from '../src/table';
import type { TableStructureSnapshot } from '@proto.ui/module-table-structure';

for (const prototype of [tableRoot, tableCaption, tableRow, tableHeaderCell, tableCell]) {
  AdaptToWebComponent(prototype);
}

type ExposingElement = HTMLElement & { getExposes(): Record<string, any> };

const ROOT_SURFACE_TOKENS = [
  'table',
  'w-full',
  'border-collapse',
  'caption-bottom',
  'rounded-none',
  'border-2',
  'border-black',
  'bg-background',
  'text-foreground',
  'font-sans',
  'font-medium',
  'shadow-[4px_4px_0_0_#000]',
];

// The data-table sibling's chrome must never leak into the passive Table.
const DATA_TABLE_TOKENS = ['grid', 'items-stretch', 'shadow-md', 'cursor-pointer', 'bg-primary'];

function prototypeName(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('name' in value)) return null;
  return typeof value.name === 'string' ? value.name : null;
}

const EXPECTED_TABLE_EXPORTS = {
  tableRoot: 'brutalist-table-root',
  brutalistTableRoot: 'brutalist-table-root',
  tableCaption: 'brutalist-table-caption',
  brutalistTableCaption: 'brutalist-table-caption',
  tableRow: 'brutalist-table-row',
  brutalistTableRow: 'brutalist-table-row',
  tableHeaderCell: 'brutalist-table-header-cell',
  brutalistTableHeaderCell: 'brutalist-table-header-cell',
  tableCell: 'brutalist-table-cell',
  brutalistTableCell: 'brutalist-table-cell',
};

function tableExports(entry: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(entry)
      .filter(
        ([name, value]) =>
          name !== 'default' &&
          !name.startsWith('BrutalistTable') &&
          (prototypeName(value)?.startsWith('brutalist-table-') ?? false)
      )
      .map(([name, value]) => [name, prototypeName(value)])
  );
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function element(tag: string): ExposingElement {
  return document.createElement(tag) as ExposingElement;
}

function getStructure(root: ExposingElement): TableStructureSnapshot {
  const method = root.getExposes().getStructure;
  if (typeof method !== 'function') throw new Error('Table root did not expose getStructure.');
  return method() as TableStructureSnapshot;
}

function mountTable(options: { lastInSection?: boolean } = {}) {
  const root = element('brutalist-table-root');
  const caption = element('brutalist-table-caption');
  const headerRow = element('brutalist-table-row');
  const bodyRow = element('brutalist-table-row');
  const headerName = element('brutalist-table-header-cell');
  const headerStatus = element('brutalist-table-header-cell');
  const rowLabel = element('brutalist-table-header-cell');
  const value = element('brutalist-table-cell');
  setElementProps(headerRow, { section: 'header' });
  setElementProps(bodyRow, { section: 'body', lastInSection: options.lastInSection ?? false });
  setElementProps(headerName, { headerKey: 'name', headerKind: 'column' });
  setElementProps(headerStatus, { headerKey: 'status', headerKind: 'column' });
  setElementProps(rowLabel, { headerKey: 'service', headerKind: 'row' });
  setElementProps(value, { headers: ['name', 'service'] });
  headerRow.append(headerName, headerStatus);
  bodyRow.append(rowLabel, value);
  root.append(caption, headerRow, bodyRow);
  document.body.append(root);
  return { root, caption, headerRow, bodyRow, headerName, rowLabel, value };
}

afterEach(() => document.body.replaceChildren());

describe('prototypes/brutalist: table', () => {
  it('exports exactly the admitted five parts through family and package entries', () => {
    // T-BRUTALIST-TABLE-0001-CASE-1
    for (const [alias, canonical] of [
      [brutalistTableRoot, tableRoot],
      [brutalistTableCaption, tableCaption],
      [brutalistTableRow, tableRow],
      [brutalistTableHeaderCell, tableHeaderCell],
      [brutalistTableCell, tableCell],
    ] as const) {
      expect(alias).toBe(canonical);
    }
    expect(tableRoot.name).toBe('brutalist-table-root');
    expect(tableCaption.name).toBe('brutalist-table-caption');
    expect(tableRow.name).toBe('brutalist-table-row');
    expect(tableHeaderCell.name).toBe('brutalist-table-header-cell');
    expect(tableCell.name).toBe('brutalist-table-cell');
    expect(tableExports(TableEntry)).toEqual(EXPECTED_TABLE_EXPORTS);
    const packageValues = new Map(Object.entries(BrutalistPackage));
    for (const [name, value] of Object.entries(TableEntry)) {
      // `export *` does not forward the subpath `default` re-export.
      if (name === 'default') continue;
      expect(packageValues.get(name), name).toBe(value);
    }
    // No data-table or interaction API leaks into the passive Table props:
    // the Root keeps Base's empty prop surface.
    expectTypeOf<BrutalistTableRootProps>().toEqualTypeOf<Record<string, never>>();
    expectTypeOf<BrutalistTableRowProps>().toEqualTypeOf<{
      section?: 'header' | 'body' | 'footer';
      lastInSection?: boolean;
    }>();
  });

  it('rejects an unexpected package export', () => {
    const observed = tableExports({
      ...TableEntry,
      unexpectedTableExport: { name: 'brutalist-table-extra' },
    });
    expect(observed).toHaveProperty('unexpectedTableExport');
    expect(observed).not.toEqual(EXPECTED_TABLE_EXPORTS);
  });

  it('paints the framed container and preserves the Base structure snapshot', async () => {
    // T-BRUTALIST-TABLE-0001-CASE-2
    const { root, caption, headerRow, bodyRow, rowLabel, value } = mountTable();
    try {
      await flush();
      for (const token of ROOT_SURFACE_TOKENS) {
        expect(styleContains(root, token), token).toBe(true);
      }
      for (const rejected of DATA_TABLE_TOKENS) {
        expect(styleContains(root, rejected), rejected).toBe(false);
        expect(styleContains(headerRow, rejected), rejected).toBe(false);
        expect(styleContains(bodyRow, rejected), rejected).toBe(false);
        expect(styleContains(value, rejected), rejected).toBe(false);
      }
      // Native table semantics projected by Base, not by the family layer.
      expect(root.getAttribute('role')).toBe('table');
      expect(headerRow.getAttribute('role')).toBe('row');
      expect(bodyRow.getAttribute('role')).toBe('row');
      expect(rowLabel.getAttribute('role')).toBe('rowheader');
      expect(value.getAttribute('role')).toBe('cell');
      const snapshot = getStructure(root);
      expect(snapshot).toMatchObject({ valid: true, rowCount: 2, columnCount: 2 });
      expect(snapshot.caption).toBeDefined();
      expect(snapshot.rows[1].cells[1].orderedHeaders).toHaveLength(2);
      // Family paint on every part; nothing from the data-table grammar.
      expect(styleContains(caption, 'table-caption')).toBe(true);
      expect(styleContains(caption, 'text-foreground')).toBe(true);
      expect(styleContains(headerRow, 'table-row')).toBe(true);
      expect(styleContains(rowLabel, 'table-cell')).toBe(true);
      expect(styleContains(rowLabel, 'font-semibold')).toBe(true);
      expect(styleContains(value, 'table-cell')).toBe(true);
      expect(styleContains(value, 'px-4')).toBe(true);
      expect(styleContains(value, 'text-sm')).toBe(true);
    } finally {
      root.remove();
      await flush();
    }
  });

  it('separates rows through black borders, paints footer emphasis and owns a passive hover', async () => {
    // T-BRUTALIST-TABLE-0001-CASE-3
    const { root, headerRow, bodyRow } = mountTable();
    try {
      await flush();
      expect(styleContains(headerRow, 'border-b')).toBe(true);
      expect(styleContains(headerRow, 'border-black')).toBe(true);
      expect(styleContains(bodyRow, 'border-b')).toBe(true);
      // Section-final body row withdraws its bottom rule; the Root frame closes it.
      setElementProps(bodyRow, { section: 'body', lastInSection: true });
      await flush();
      expect(styleContains(bodyRow, 'border-b-0')).toBe(true);
      // Footer emphasis is a doubled top rule and weight, not a muted fill.
      const footer = element('brutalist-table-row');
      setElementProps(footer, { section: 'footer', lastInSection: true });
      root.append(footer);
      await flush();
      expect(styleContains(footer, 'border-t-2')).toBe(true);
      expect(styleContains(footer, 'font-semibold')).toBe(true);
      expect(styleContains(footer, 'bg-muted/50')).toBe(false);
      expect(styleContains(headerRow, 'bg-muted/50')).toBe(false);
      footer.remove();
      // Passive hover paints the family accent without an interaction owner.
      bodyRow.dispatchEvent(new PointerEvent('pointerenter'));
      await flush();
      expect(styleContains(bodyRow, 'bg-main/20')).toBe(true);
      bodyRow.dispatchEvent(new PointerEvent('pointerleave'));
      await flush();
      expect(styleContains(bodyRow, 'bg-main/20')).toBe(false);
      expect(root.hasAttribute('tabindex')).toBe(false);
      expect(styleContains(bodyRow, 'transition-colors')).toBe(false);
    } finally {
      root.remove();
      await flush();
    }
  });
});
