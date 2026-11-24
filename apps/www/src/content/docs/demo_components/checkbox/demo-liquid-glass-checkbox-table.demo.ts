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

function setupLiquidTable({ refs, api }: DemoSetupContext) {
  let active = true;
  const selected = new Set<string>(['1']);

  const sync = () => {
    const all = selected.size === rows.length;
    const some = selected.size > 0 && !all;
    api.setProps('lgSelectAll', {
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
      api.setProps(`lgRowCheck-${row.id}`, {
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
    if (refs.lgTableSummary) {
      refs.lgTableSummary.textContent = `${selected.size} of ${rows.length} row(s) selected.`;
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
      'grid grid-cols-[2rem_1fr_1.4fr_4.5rem] items-center gap-3 border-t border-border/60 px-3 py-2.5 text-sm',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-checkbox-root',
        ref: `lgRowCheck-${row.id}`,
        props: { checked: row.id === '1', indeterminate: false },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-checkbox-indicator',
            ref: `lgRowInd-${row.id}`,
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
    className:
      'w-full max-w-lg rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'box',
        className: 'grid gap-2',
        children: [
          {
            kind: 'box',
            className:
              'overflow-hidden rounded-xl border border-border/60 bg-background/75 shadow-sm',
            children: [
              {
                kind: 'box',
                className:
                  'grid grid-cols-[2rem_1fr_1.4fr_4.5rem] items-center gap-3 bg-secondary/70 px-3 py-2.5 text-xs font-medium text-muted-foreground',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-checkbox-root',
                    ref: 'lgSelectAll',
                    props: { checked: false, indeterminate: true },
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'liquid-glass-checkbox-indicator',
                        ref: 'lgSelectAllInd',
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
            ref: 'lgTableSummary',
            className: 'text-xs text-muted-foreground',
            children: ['1 of 4 row(s) selected.'],
          },
        ],
      },
    ],
  },
  setup: setupLiquidTable,
} satisfies DemoSpec;
