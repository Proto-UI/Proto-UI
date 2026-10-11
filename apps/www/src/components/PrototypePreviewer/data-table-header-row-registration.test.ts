import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProtoAdapterExposes } from '@proto.ui/adapter-base';
import * as baseRoot from '@proto.ui/prototypes-base';
import * as base from '@proto.ui/prototypes-base/data-table';
import * as shadcnRoot from '@proto.ui/prototypes-shadcn';
import * as shadcn from '@proto.ui/prototypes-shadcn/data-table';
import * as brutalistRoot from '@proto.ui/prototypes-brutalist';
import * as brutalist from '@proto.ui/prototypes-brutalist/data-table';
import * as bootstrapRoot from '@proto.ui/prototypes-bootstrap-2-3-2';
import * as bootstrap from '@proto.ui/prototypes-bootstrap-2-3-2/data-table';
import * as liquidRoot from '@proto.ui/prototypes-liquid-glass';
import * as liquid from '@proto.ui/prototypes-liquid-glass/data-table';
import {
  COMPONENT_REGISTRY,
  WORKSPACE_COMPONENT_REGISTRY,
} from '../../../../../packages/cli/src/registry/components';
import headerRowIntegration from '../../../../../internal/records/2026-10-10-data-table-header-row-manifest.json';
import { collectPrototypeIds } from './demo-types';
import { getDemoSourcePath, loadDemo } from './demo-modules';
import { renderDemo } from './demo-renderer';
import { loadPrototype } from './prototype-modules';
import { getPrototype } from './registry';

const families = [
  ['base', baseRoot, base],
  ['shadcn', shadcnRoot, shadcn],
  ['brutalist', brutalistRoot, brutalist],
  ['bootstrap-2-3-2', bootstrapRoot, bootstrap],
  ['liquid-glass', liquidRoot, liquid],
] as const;
const cleanup: Array<() => void | Promise<void>> = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});
type TableElement = HTMLElement & {
  getExposes(): ProtoAdapterExposes<typeof base.dataTableRoot>;
};

describe('DataTable HeaderRow actual website and static entry closure', () => {
  for (const [family, packageRoot, subpath] of families) {
    it(`${family}: root/subpath, source-only CLI and actual loader resolve one identity`, async () => {
      const id = `${family}-data-table-header-row`;
      expect(packageRoot.dataTableHeaderRow).toBe(subpath.dataTableHeaderRow);
      expect(subpath.dataTableHeaderRow.name).toBe(id);
      const entry = WORKSPACE_COMPONENT_REGISTRY[`${family}-data-table`];
      expect(entry?.sourceOnly).toBe(true);
      expect(COMPONENT_REGISTRY[`${family}-data-table`]).toBeUndefined();
      expect(entry?.importPath).toBe(`@proto.ui/prototypes-${family}/data-table`);
      expect(
        entry?.items.filter((part) => part.prototypeImport === 'dataTableHeaderRow')
      ).toHaveLength(1);
      expect(
        entry?.items.find((part) => part.prototypeImport === 'dataTableHeaderRow')?.elementName
      ).toBe(`proto-ui-${id}`);
      await loadPrototype(id);
      expect(getPrototype(id)).toBe(subpath.dataTableHeaderRow);
    });

    it(`${family}: real DemoSpec loads two sorting headers, retains table structure and remounts`, async () => {
      const demoId = `demo-${family}-data-table`;
      const declared = headerRowIntegration.families.find((item) => item.family === family);
      expect(declared).toBeDefined();
      expect(getDemoSourcePath(demoId)).toBe(declared!.demo);
      const demo = await loadDemo(demoId);
      const ids = new Set<string>();
      collectPrototypeIds(demo.root, ids);
      expect(ids.has(`${family}-data-table-header-row`)).toBe(true);
      for (const id of ids) {
        await loadPrototype(id);
        expect(getPrototype(id).name).toBe(id);
      }
      const host = document.createElement('div');
      document.body.append(host);
      for (let mount = 0; mount < 2; mount++) {
        const view = await renderDemo({ runtime: 'wc', host, demo });
        cleanup.push(() => view.destroy());
        await vi.waitFor(() =>
          expect(host.querySelectorAll('[role="columnheader"]')).toHaveLength(2)
        );
        const table = host.querySelector<TableElement>('[role="table"]')!;
        const headers = [...table.querySelectorAll<HTMLElement>('[role="columnheader"]')];
        const row = headers[0]!.parentElement!;
        expect(headers[1]!.parentElement).toBe(row);
        expect(row.getAttribute('role')).toBe('row');
        expect(row.tabIndex).toBe(-1);
        expect(row.getAttribute('aria-selected')).toBeNull();
        expect(table.getExposes().getStructure()).toMatchObject({
          valid: true,
          rowCount: 4,
          columnCount: 2,
        });
        expect(table.getExposes().count.get()).toBe(3);
        const sorts: unknown[] = [];
        const selections: unknown[] = [];
        table.addEventListener('sortChange', (event) => sorts.push((event as CustomEvent).detail));
        table.addEventListener('selectionChange', (event) =>
          selections.push((event as CustomEvent).detail)
        );
        headers[0]!.click();
        await vi.waitFor(() =>
          expect(sorts).toEqual([{ sortKey: 'name', sortDirection: 'ascending' }])
        );
        expect(
          table
            .getExposes()
            .getRows()
            .map((record) => record.id)
        ).toEqual(['api', 'docs', 'web']);
        headers[1]!.focus();
        headers[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        headers[1]!.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
        await vi.waitFor(() => expect(sorts).toHaveLength(2));
        expect(sorts[1]).toEqual({ sortKey: 'requests', sortDirection: 'ascending' });
        expect(
          table
            .getExposes()
            .getRows()
            .map((record) => record.id)
        ).toEqual(['docs', 'api', 'web']);
        expect(selections).toEqual([]);
        await view.destroy();
        cleanup.pop();
        expect(host.childElementCount).toBe(0);
      }
    });
  }
});
