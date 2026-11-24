import type {
  DemoNode,
  DemoSetupContext,
  DemoSpec,
} from '../../../../components/PrototypePreviewer/demo-types';

const rows = [
  { id: '1', name: 'Sarah Chen', email: 'sarah.chen@example.com', role: 'Admin' },
  { id: '2', name: 'Marcus Rodriguez', email: 'marcus.rodriguez@example.com', role: 'User' },
  { id: '3', name: 'Priya Patel', email: 'priya.patel@example.com', role: 'User' },
  { id: '4', name: 'David Kim', email: 'david.kim@example.com', role: 'Editor' },
] as const;

function setupBootstrapTable({ refs, api }: DemoSetupContext) {
  let active = true;
  const selected = new Set<string>(['1']);

  const sync = () => {
    const all = selected.size === rows.length;
    const some = selected.size > 0 && !all;
    api.setProps('bsSelectAll', {
      checked: all,
      indeterminate: some,
      onCheckedChange: (detail: unknown) => {
        if (!active || !detail || typeof detail !== 'object') return;
        const next = detail as { checked?: unknown };
        if (next.checked === true) rows.forEach((r) => selected.add(r.id));
        else selected.clear();
        sync();
      },
      onIndeterminateChange: () => {
        if (!active) return;
      },
    });
    for (const row of rows) {
      api.setProps(`bsRowCheck-${row.id}`, {
        checked: selected.has(row.id),
        indeterminate: false,
        onCheckedChange: (detail: unknown) => {
          if (!active || !detail || typeof detail !== 'object') return;
          const next = detail as { checked?: unknown };
          if (next.checked === true) selected.add(row.id);
          else selected.delete(row.id);
          sync();
        },
      });
    }
    if (refs.bsTableSummary) {
      refs.bsTableSummary.textContent = `${selected.size} of ${rows.length} row(s) selected.`;
    }
  };

  sync();
  return () => {
    active = false;
  };
}

function rowNode(row: (typeof rows)[number]): DemoNode {
  return {
    kind: 'box',
    className:
      'grid grid-cols-[1.75rem_1fr_1.4fr_4.5rem] items-center gap-3 border-t border-border px-3 py-2 text-sm',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-checkbox-root',
        ref: `bsRowCheck-${row.id}`,
        props: { checked: row.id === '1', indeterminate: false },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-checkbox-indicator',
            ref: `bsRowInd-${row.id}`,
          },
          { kind: 'box', className: 'sr-only', children: [`Select ${row.name}`] },
        ],
      },
      { kind: 'box', className: 'font-medium', children: [row.name] },
      { kind: 'box', className: 'truncate text-muted-foreground', children: [row.email] },
      { kind: 'box', className: 'text-muted-foreground', children: [row.role] },
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-lg flex-col gap-2',
    children: [
      {
        kind: 'box',
        className: 'overflow-hidden rounded border border-border',
        children: [
          {
            kind: 'box',
            className:
              'grid grid-cols-[1.75rem_1fr_1.4fr_4.5rem] items-center gap-3 bg-secondary px-3 py-2 text-xs font-medium',
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-checkbox-root',
                ref: 'bsSelectAll',
                props: { checked: false, indeterminate: true },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-checkbox-indicator',
                    ref: 'bsSelectAllInd',
                  },
                  { kind: 'box', className: 'sr-only', children: ['Select all rows'] },
                ],
              },
              { kind: 'box', children: ['Name'] },
              { kind: 'box', children: ['Email'] },
              { kind: 'box', children: ['Role'] },
            ],
          },
          ...rows.map(rowNode),
        ],
      },
      {
        kind: 'box',
        ref: 'bsTableSummary',
        className: 'text-xs text-muted-foreground',
        children: ['1 of 4 row(s) selected.'],
      },
    ],
  },
  setup: setupBootstrapTable,
} satisfies DemoSpec;
