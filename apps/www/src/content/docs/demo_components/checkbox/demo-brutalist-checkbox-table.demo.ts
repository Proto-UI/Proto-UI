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

function setupBrutalistTable({ refs, api }: DemoSetupContext) {
  let active = true;
  const selected = new Set<string>(['1']);

  const sync = () => {
    const all = selected.size === rows.length;
    const some = selected.size > 0 && !all;
    api.setProps('bSelectAll', {
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
      const checked = selected.has(row.id);
      api.setProps(`bRowCheck-${row.id}`, {
        checked,
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
    if (refs.bTableSummary) {
      refs.bTableSummary.textContent = `${selected.size} of ${rows.length} row(s) selected.`;
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
      'grid grid-cols-[2.25rem_1fr_1.4fr_4.5rem] items-center gap-3 border-t-2 border-border px-3 py-2.5 font-sans text-sm font-medium',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-checkbox-root',
        ref: `bRowCheck-${row.id}`,
        props: { checked: row.id === '1', indeterminate: false },
        children: [
          { kind: 'proto', prototypeId: 'brutalist-checkbox-indicator', ref: `bRowInd-${row.id}` },
          { kind: 'box', className: 'sr-only', children: [`Select ${row.name}`] },
        ],
      },
      { kind: 'box', children: [row.name] },
      { kind: 'box', className: 'truncate opacity-80', children: [row.email] },
      { kind: 'box', children: [row.role] },
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
        className:
          'overflow-hidden rounded-base border-2 border-border bg-secondary-background shadow-[4px_4px_0_0_#000]',
        children: [
          {
            kind: 'box',
            className:
              'grid grid-cols-[2.25rem_1fr_1.4fr_4.5rem] items-center gap-3 bg-background px-3 py-2.5 font-heading text-xs font-bold',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-checkbox-root',
                ref: 'bSelectAll',
                props: { checked: false, indeterminate: true },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-checkbox-indicator',
                    ref: 'bSelectAllInd',
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
        ref: 'bTableSummary',
        className: 'font-sans text-xs font-medium opacity-75',
        children: ['1 of 4 row(s) selected.'],
      },
    ],
  },
  setup: setupBrutalistTable,
} satisfies DemoSpec;
