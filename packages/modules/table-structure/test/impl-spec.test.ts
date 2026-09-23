import { describe, expect, it } from 'vitest';
import { createA11ySemanticObjectRef, type AnatomyPartView } from '@proto.ui/core';
import type { A11yPort } from '@proto.ui/module-a11y';
import type { AnatomyPort } from '@proto.ui/module-anatomy';
import type { StateFacade, StatePort } from '@proto.ui/module-state';
import { TableStructureModuleImpl } from '../src/create';
import { projectTableStructure } from '../src/projection';

const ref = () => createA11ySemanticObjectRef();

describe('M-TABLE-STRUCTURE-0001', () => {
  it('projects monotonic range-based topology and ordered opaque headers', () => {
    const group = ref();
    const column = ref();
    const rowHeader = ref();
    const value = ref();
    const snapshot = projectTableStructure({
      root: ref(),
      captions: [ref()],
      rows: [
        {
          ref: ref(),
          cells: [
            {
              ref: group,
              kind: 'headerCell',
              headerKey: 'group',
              headerKind: 'column',
              headers: [],
              columnSpan: 2,
            },
          ],
        },
        {
          ref: ref(),
          cells: [
            {
              ref: column,
              kind: 'headerCell',
              headerKey: 'column',
              headerKind: 'column',
              headers: ['group'],
            },
          ],
        },
        {
          ref: ref(),
          cells: [
            {
              ref: rowHeader,
              kind: 'headerCell',
              headerKey: 'row',
              headerKind: 'row',
              headers: [],
            },
            { ref: value, kind: 'cell', headers: ['row', 'group', 'column'] },
          ],
        },
      ],
    });
    expect(snapshot).toMatchObject({ valid: true, rowCount: 3, columnCount: 2 });
    expect(snapshot.rows[2].cells[1]).toMatchObject({ row: 2, column: 1 });
    expect(snapshot.rows[2].cells[1].columnHeaders).toEqual([group, column]);
    expect(snapshot.rows[2].cells[1].rowHeaders).toEqual([rowHeader]);
    expect(snapshot.rows[2].cells[1].orderedHeaders).toEqual([rowHeader, group, column]);
    expect(snapshot.rows[2].cells[1].columnHeaders).not.toContain('column');
  });

  it('never expands a large safe span into per-coordinate storage', () => {
    const header = ref();
    const snapshot = projectTableStructure({
      root: ref(),
      captions: [],
      rows: [
        {
          ref: ref(),
          cells: [
            {
              ref: header,
              kind: 'headerCell',
              headerKey: 'large',
              headerKind: 'column',
              headers: [],
              columnSpan: 1_000_000_000,
            },
            { ref: ref(), kind: 'cell', headers: ['large'] },
          ],
        },
      ],
    });
    expect(snapshot.valid).toBe(true);
    expect(snapshot.columnCount).toBe(1_000_000_001);
    expect(snapshot.rows[0].cells[1].column).toBe(1_000_000_000);
  });

  it('fails closed for unsafe structure and reference ambiguity', () => {
    const duplicate = 'same';
    const snapshot = projectTableStructure({
      root: ref(),
      captions: [ref(), ref()],
      rows: [
        {
          ref: ref(),
          cells: [
            {
              ref: ref(),
              kind: 'headerCell',
              headerKey: duplicate,
              headerKind: 'column',
              headers: [],
              rowSpan: 3,
            },
            {
              ref: ref(),
              kind: 'headerCell',
              headerKey: duplicate,
              headerKind: 'row',
              headers: [],
            },
            { ref: ref(), kind: 'cell', headers: [duplicate, duplicate, ''] },
          ],
        },
      ],
    });
    expect(snapshot.valid).toBe(false);
    expect(snapshot.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        'multiple-captions',
        'row-span-out-of-range',
        'duplicate-header-key',
        'ambiguous-header-target',
        'duplicate-header-reference',
        'empty-header-reference',
      ])
    );
  });

  it('fails closed for cells outside Row ancestry and HeaderCells without an explicit kind', () => {
    const orphan = ref();
    const mismatch = ref();
    const snapshot = projectTableStructure({
      root: ref(),
      captions: [],
      unmatchedCells: [orphan],
      roleMismatches: [mismatch],
      rows: [
        {
          ref: ref(),
          cells: [
            { ref: ref(), kind: 'headerCell', headerKey: 'name', headers: [] },
            { ref: ref(), kind: 'cell', headers: ['name'] },
          ],
        },
      ],
    });

    expect(snapshot.valid).toBe(false);
    expect(snapshot.diagnostics).toEqual(
      expect.arrayContaining([
        { code: 'missing-row-parent', ref: orphan },
        { code: 'role-mismatch', ref: mismatch },
        expect.objectContaining({ code: 'missing-header-kind' }),
      ])
    );
  });

  it('rejects self and downstream HeaderCell edges', () => {
    const first = ref();
    const second = ref();
    const snapshot = projectTableStructure({
      root: ref(),
      captions: [],
      rows: [
        {
          ref: ref(),
          cells: [
            {
              ref: first,
              kind: 'headerCell',
              headerKey: 'first',
              headerKind: 'column',
              headers: ['second'],
            },
            {
              ref: second,
              kind: 'headerCell',
              headerKey: 'second',
              headerKind: 'column',
              headers: ['second'],
            },
            { ref: ref(), kind: 'cell', headers: ['first'] },
          ],
        },
      ],
    });
    expect(
      snapshot.diagnostics.filter((item) => item.code === 'non-upstream-header-target')
    ).toHaveLength(2);
  });

  it('emits generic A11y facts and clears a part that leaves its Table domain', () => {
    const domain = {};
    const tokens = { root: {}, row: {}, header: {}, cell: {}, rogue: {} };
    const roles = {
      root: 'root',
      row: 'row',
      header: 'headerCell',
      cell: 'cell',
      rogue: 'cell',
    } as const;
    const tokenByPart = new Map<AnatomyPartView, unknown>();
    const domains = new Map<unknown, unknown | null>(
      Object.values(tokens).map((token) => [token, domain])
    );
    const ordered: AnatomyPartView[] = [];
    for (const [name, token] of Object.entries(tokens)) {
      const part = { role: roles[name as keyof typeof roles] } as AnatomyPartView;
      tokenByPart.set(part, token);
      ordered.push(part);
    }

    const values = new Map<object, unknown>();
    const stateFacade = {
      string: () => ({}),
      numberDiscrete: () => ({}),
    } as unknown as StateFacade;
    const state = {
      set: (handle: object, value: unknown) => values.set(handle, value),
    } as unknown as StatePort;
    const relations = new Map<unknown, Map<string, readonly unknown[]>>();
    const refs = new Map<unknown, ReturnType<typeof ref>>(
      Object.values(tokens).map((token) => [token, ref()])
    );
    const anatomyFor = (token: unknown) =>
      ({
        resolveSelfInstance: () => token,
        resolveSelfRole: () =>
          ordered.find((part) => Object.is(tokenByPart.get(part), token))?.role ?? null,
        resolvePartInstance: (part: AnatomyPartView) => tokenByPart.get(part) ?? null,
        resolveAncestorInstance: (_family: unknown, part: AnatomyPartView, role: string) => {
          const partToken = tokenByPart.get(part);
          return role === 'row' && (partToken === tokens.header || partToken === tokens.cell)
            ? tokens.row
            : null;
        },
        resolveDomainScope: () => domains.get(token) ?? null,
        order: { parts: () => ordered },
        subscribeOrder: () => () => {},
        subscribeTargets: () => () => {},
      }) as unknown as AnatomyPort;
    const a11yFor = (token: unknown) =>
      ({
        getObjectRef: () => refs.get(token)!,
        setRelation: (key: string, spec: { target: readonly unknown[] }) => {
          const current = relations.get(token) ?? new Map<string, readonly unknown[]>();
          current.set(key, spec.target);
          relations.set(token, current);
        },
      }) as unknown as A11yPort;
    const caps = { onChange: () => () => {} } as any;
    const modules = Object.fromEntries(
      Object.entries(tokens).map(([name, token]) => [
        name,
        new TableStructureModuleImpl(caps, anatomyFor(token), a11yFor(token), state, stateFacade),
      ])
    ) as Record<keyof typeof tokens, TableStructureModuleImpl>;
    const handles = {
      root: modules.root.facade.declare('root'),
      row: modules.row.facade.declare('row'),
      header: modules.header.facade.declare('headerCell'),
      cell: modules.cell.facade.declare('cell'),
    };
    handles.header.configure({ headerKey: 'name', headerKind: 'column' });
    handles.cell.configure({ headers: ['name'] });
    for (const module of Object.values(modules)) module.onMountPhase('mounted', 1);

    expect(values.get(handles.root.states.a11yRole)).toBe('table');
    expect(values.get(handles.row.states.a11yRole)).toBe('row');
    expect(values.get(handles.header.states.a11yRole)).toBe('columnheader');
    expect(values.get(handles.cell.states.a11yRole)).toBe('cell');
    expect(values.get(handles.root.states.rowCount)).toBe(1);
    expect(values.get(handles.root.states.columnCount)).toBe(2);
    expect(values.get(handles.row.states.row)).toBe(1);
    expect(values.get(handles.cell.states.column)).toBe(2);
    expect(relations.get(tokens.cell)?.get('labelledBy')).toEqual([
      refs.get(tokens.header),
      refs.get(tokens.cell),
    ]);
    const rowPart = ordered.find((part) => tokenByPart.get(part) === tokens.row)!;
    const rogue = modules.rogue.facade.declare('root');
    rogue.configure({});
    expect(rogue.getSnapshot()).toBeNull();
    expect(handles.root.getSnapshot()?.valid).toBe(false);
    expect(handles.root.getSnapshot()?.diagnostics.map((item) => item.code)).toContain(
      'role-mismatch'
    );
    expect(values.get(handles.root.states.a11yRole)).toBe('');
    expect(values.get(handles.cell.states.a11yRole)).toBe('');
    modules.rogue.dispose();
    expect(handles.root.getSnapshot()?.valid).toBe(true);
    expect(values.get(handles.root.states.a11yRole)).toBe('table');
    // Test-only fake: mutate the captured Anatomy role to model a mismatched declaration.
    const mutableRowPart = rowPart as unknown as { role: string };
    mutableRowPart.role = 'cell';
    handles.row.configure({});
    expect(handles.root.getSnapshot()?.valid).toBe(false);
    expect(handles.root.getSnapshot()?.diagnostics.map((item) => item.code)).toContain(
      'role-mismatch'
    );
    mutableRowPart.role = 'row';
    handles.row.configure({});
    expect(handles.root.getSnapshot()?.valid).toBe(true);

    domains.set(tokens.cell, null);
    handles.cell.configure({});
    expect(values.get(handles.cell.states.row)).toBe(0);
    expect(values.get(handles.cell.states.column)).toBe(0);
    expect(relations.get(tokens.cell)?.get('labelledBy')).toEqual([]);
    expect(values.get(handles.root.states.rowCount)).toBe(0);
    expect(values.get(handles.root.states.columnCount)).toBe(0);
    expect(values.get(handles.root.states.a11yRole)).toBe('');
    expect(values.get(handles.cell.states.a11yRole)).toBe('');

    modules.cell.dispose();
    modules.header.dispose();
    modules.row.dispose();
    modules.root.dispose();
  });
});
