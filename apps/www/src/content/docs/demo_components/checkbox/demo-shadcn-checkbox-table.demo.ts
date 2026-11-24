import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type {
  DemoNode,
  DemoSetupContext,
  DemoSpec,
} from '../../../../components/PrototypePreviewer/demo-types';

const tableRows = [
  { id: '1', name: 'Sarah Chen', email: 'sarah.chen@example.com', role: 'Admin' },
  { id: '2', name: 'Marcus Rodriguez', email: 'marcus.rodriguez@example.com', role: 'User' },
  { id: '3', name: 'Priya Patel', email: 'priya.patel@example.com', role: 'User' },
  { id: '4', name: 'David Kim', email: 'david.kim@example.com', role: 'Editor' },
] as const;

function setupCheckboxTable({ refs, api }: DemoSetupContext) {
  let active = true;
  const selected = new Set<string>(['1']);

  const syncAll = () => {
    const allSelected = selected.size === tableRows.length;
    const someSelected = selected.size > 0 && !allSelected;

    api.setProps('selectAll', {
      checked: allSelected,
      indeterminate: someSelected,
      onCheckedChange: handleSelectAll,
      onIndeterminateChange: handleSelectAllIndeterminate,
    });

    for (const row of tableRows) {
      const isChecked = selected.has(row.id);
      api.setProps(`rowCheck-${row.id}`, {
        checked: isChecked,
        indeterminate: false,
        onCheckedChange: (detail: unknown) => handleRowChange(row.id, detail),
      });
      const rowEl = refs[`rowBox-${row.id}`];
      if (rowEl) {
        rowEl.dataset.state = isChecked ? 'selected' : '';
      }
    }

    if (refs.selectionSummary) {
      refs.selectionSummary.textContent = `${selected.size} of ${tableRows.length} row(s) selected.`;
    }
  };

  function handleSelectAllIndeterminate() {
    if (!active) return;
  }

  function handleSelectAll(detail: unknown) {
    if (!active || !detail || typeof detail !== 'object') return;
    const next = detail as { checked?: unknown };
    if (next.checked === true) {
      for (const row of tableRows) selected.add(row.id);
    } else {
      selected.clear();
    }
    syncAll();
  }

  function handleRowChange(id: string, detail: unknown) {
    if (!active || !detail || typeof detail !== 'object') return;
    const next = detail as { checked?: unknown };
    if (next.checked === true) selected.add(id);
    else selected.delete(id);
    syncAll();
  }

  syncAll();
  return () => {
    active = false;
  };
}

function rowNode(row: (typeof tableRows)[number]): DemoNode {
  return {
    kind: 'box',
    ref: `rowBox-${row.id}`,
    className:
      'grid grid-cols-[2rem_1fr_1.4fr_4.5rem] items-center gap-3 border-t border-border px-3 py-2.5 text-sm data-[state=selected]:bg-muted/50',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-checkbox-root',
        ref: `rowCheck-${row.id}`,
        props: { checked: row.id === '1', indeterminate: false },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-checkbox-indicator',
            ref: `rowInd-${row.id}`,
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

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-lg flex-col gap-2',
    children: [
      {
        kind: 'box',
        className: 'overflow-hidden rounded-lg border border-border',
        children: [
          {
            kind: 'box',
            className:
              'grid grid-cols-[2rem_1fr_1.4fr_4.5rem] items-center gap-3 bg-muted/40 px-3 py-2.5 text-xs font-medium text-muted-foreground',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-checkbox-root',
                ref: 'selectAll',
                props: { checked: false, indeterminate: true },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-checkbox-indicator',
                    ref: 'selectAllInd',
                  },
                  { kind: 'box', className: 'sr-only', children: ['Select all rows'] },
                ],
              },
              { kind: 'box', children: ['Name'] },
              { kind: 'box', children: ['Email'] },
              { kind: 'box', children: ['Role'] },
            ],
          },
          ...tableRows.map(rowNode),
        ],
      },
      {
        kind: 'box',
        ref: 'selectionSummary',
        className: 'text-xs text-muted-foreground',
        children: ['1 of 4 row(s) selected.'],
      },
    ],
  },
  setup: setupCheckboxTable,
} satisfies DemoSpec);
