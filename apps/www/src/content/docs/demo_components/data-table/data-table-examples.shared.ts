import type {
  DemoChild,
  DemoNode,
  DemoSpec,
} from '../../../../components/PrototypePreviewer/demo-types';

export type DataTableDemoFamily = 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass';

const PAYMENTS = [
  { id: 'm5gr84i9', status: 'Success', email: 'ken99@example.com', amount: 316 },
  { id: '3u1reuv4', status: 'Success', email: 'abe45@example.com', amount: 242 },
  { id: 'derv1ws0', status: 'Processing', email: 'monserrat44@example.com', amount: 837 },
  { id: '5kma53ae', status: 'Success', email: 'silas22@example.com', amount: 874 },
  { id: 'bhqecj4p', status: 'Failed', email: 'carmella@example.com', amount: 721 },
];

const INVOICES = [
  { id: 'inv-001', invoice: 'INV001', status: 'Paid', method: 'Credit Card', amount: 250 },
  { id: 'inv-002', invoice: 'INV002', status: 'Pending', method: 'PayPal', amount: 150 },
  { id: 'inv-003', invoice: 'INV003', status: 'Unpaid', method: 'Bank Transfer', amount: 350 },
  { id: 'inv-004', invoice: 'INV004', status: 'Paid', method: 'Credit Card', amount: 450 },
  { id: 'inv-005', invoice: 'INV005', status: 'Paid', method: 'PayPal', amount: 550 },
  { id: 'inv-006', invoice: 'INV006', status: 'Pending', method: 'Bank Transfer', amount: 200 },
];

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function proto(
  family: DataTableDemoFamily,
  part: string,
  options: {
    ref?: string;
    props?: Record<string, unknown>;
    className?: string;
    children?: DemoChild[];
  } = {}
): DemoNode {
  return {
    kind: 'proto',
    prototypeId: `${family}-${part}`,
    ...(options.ref ? { ref: options.ref } : {}),
    ...(options.className ? { className: options.className } : {}),
    ...(options.props ? { props: options.props } : {}),
    ...(options.children ? { children: options.children } : {}),
  };
}

function tableClassFor(family: DataTableDemoFamily): string | undefined {
  if (family === 'shadcn') return 'rounded-md border border-border';
  return undefined;
}

function buttonPropsFor(
  family: DataTableDemoFamily,
  emphasis: 'outline' | 'prominent' = 'outline'
): Record<string, unknown> {
  if (family === 'shadcn') {
    return emphasis === 'prominent' ? { size: 'sm' } : { variant: 'outline', size: 'sm' };
  }
  if (family === 'liquid-glass') {
    return { variant: emphasis === 'prominent' ? 'prominent' : 'regular' };
  }
  return {};
}

function wrapStage(family: DataTableDemoFamily, children: DemoChild[]): DemoNode {
  if (family === 'liquid-glass') {
    return {
      kind: 'box',
      className: 'w-full max-w-2xl',
      children: [
        {
          kind: 'box',
          className: 'grid w-full gap-4',
          children,
        },
      ],
    };
  }
  return {
    kind: 'box',
    className: 'grid w-full max-w-2xl gap-4',
    children,
  };
}

function formatUsd(raw: string): string {
  if (!raw) return '';
  const num = Number(raw);
  return Number.isFinite(num) ? usd.format(num) : raw;
}

/** Hero showcase modeled on upstream Payments DataTable (filter, visibility, sorting, USD formatting, selection, pagination). */
export function createDataTableHeroDemo(family: DataTableDemoFamily): DemoSpec {
  const slots = [0, 1, 2, 3];
  const headerRow = proto(family, 'data-table-header-row', {
    children: [
      proto(family, 'data-table-header', {
        props: { headerKey: 'status', headerKind: 'column' },
        children: ['Status'],
      }),
      proto(family, 'data-table-header', {
        props: { headerKey: 'email', headerKind: 'column' },
        children: ['Email'],
      }),
      proto(family, 'data-table-header', {
        props: { headerKey: 'amount', headerKind: 'column' },
        className: 'text-right',
        children: ['Amount'],
      }),
    ],
  });

  const bodyRows = slots.map((index) =>
    proto(family, 'data-table-row', {
      ref: `row-${index}`,
      props: { index },
      children: [
        proto(family, 'data-table-cell', {
          props: { columnKey: 'status', headers: ['status'] },
        }),
        proto(family, 'data-table-cell', {
          props: { columnKey: 'email', headers: ['email'] },
          className: 'lowercase',
        }),
        proto(family, 'data-table-cell', {
          ref: `amount-${index}`,
          props: { columnKey: 'amount', headers: ['amount'], renderValue: false },
          className: 'text-right font-medium',
          children: [
            {
              kind: 'box',
              tag: 'span',
              ref: `amount-text-${index}`,
              dynamicChildren: { prototypeIds: [] },
            },
          ],
        }),
      ],
    })
  );

  return {
    type: 'demo',
    root: wrapStage(family, [
      {
        kind: 'box',
        className: 'flex flex-wrap items-center justify-between gap-2',
        children: [
          proto(family, 'input-root', {
            ref: 'email-filter',
            className: 'w-full max-w-xs',
            props: {
              ariaLabel: 'Filter emails',
              placeholder: 'Filter emails...',
            },
          }),
          {
            kind: 'box',
            className: 'flex flex-wrap items-center gap-2',
            children: [
              proto(family, 'button', {
                ref: 'toggle-status',
                props: buttonPropsFor(family, 'outline'),
                children: ['Toggle Status'],
              }),
              proto(family, 'button', {
                ref: 'select-page',
                props: buttonPropsFor(family, 'outline'),
                children: ['Select page'],
              }),
            ],
          },
        ],
      },
      proto(family, 'data-table-root', {
        ref: 'table',
        className: tableClassFor(family),
        props: {
          rows: PAYMENTS,
          pageSize: 4,
        },
        children: [
          proto(family, 'data-table-caption', {
            children: ['Recent payments. Click a header to sort or a row to select.'],
          }),
          headerRow,
          ...bodyRows,
          {
            kind: 'box',
            className: 'table-caption caption-bottom',
            children: [
              {
                kind: 'box',
                className: 'flex flex-wrap items-center justify-between gap-3 pt-3',
                children: [
                  {
                    kind: 'box',
                    ref: 'selection-summary',
                    className: 'text-sm text-muted-foreground',
                    attrs: { 'aria-live': 'polite' },
                    children: ['0 of 5 row(s) selected.'],
                  },
                  {
                    kind: 'box',
                    className: 'flex items-center gap-2',
                    children: [
                      proto(family, 'data-table-previous', {
                        ref: 'previous',
                        children: ['Previous'],
                      }),
                      proto(family, 'data-table-next', {
                        ref: 'next',
                        props: family === 'liquid-glass' ? { variant: 'prominent' } : {},
                        children: ['Next'],
                      }),
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ]),
    setup({ api, refs }) {
      let active = true;
      let showStatus = true;
      let bindingRevision = 0;
      let summaryQueued = false;
      const disposers: Array<() => void> = [];

      const updateSummary = () => {
        if (!active || summaryQueued) return;
        summaryQueued = true;
        queueMicrotask(() => {
          summaryQueued = false;
          if (!active || !refs['selection-summary']) return;
          const selected = (api.call('table', 'getSelectedKeys') as string[] | undefined) ?? [];
          const filtered = Number(api.call('table', 'filteredCount.get') ?? PAYMENTS.length);
          refs['selection-summary'].textContent =
            filtered === 0
              ? 'No results. 0 of 0 row(s) selected.'
              : `${selected.length} of ${filtered} row(s) selected.`;
        });
      };

      api.setProps('email-filter', {
        onValueChange(detail: { value: string }) {
          if (active) api.setProps('table', { columnFilters: { email: detail.value } });
        },
      });
      api.setProps('toggle-status', {
        onClick() {
          if (!active) return;
          showStatus = !showStatus;
          api.setProps('table', { columnVisibility: { status: showStatus } });
        },
      });
      api.setProps('select-page', {
        onClick() {
          if (active) api.call('table', 'requestPageSelection');
        },
      });
      api.setProps('table', {
        onSelectionChange: updateSummary,
        onPageChange: updateSummary,
      });

      const unbind = api.subscribePublicInstances?.(
        ['table', ...slots.map((i) => `amount-${i}`)],
        (instances) => {
          const revision = ++bindingRevision;
          disposers.splice(0).forEach((dispose) => dispose());
          if (!active) return;

          for (const index of slots) {
            const instance = instances[`amount-${index}`];
            const state = instance?.getExposes()?.displayValue as
              | { get(): string; subscribe(listener: () => void): () => void }
              | undefined;
            if (!state) continue;
            let sequence = 0;
            const syncCell = () => {
              if (
                !active ||
                revision !== bindingRevision ||
                api.getPublicInstance?.(`amount-${index}`) !== instance
              )
                return;
              const raw = state.get();
              const request = ++sequence;
              queueMicrotask(() => {
                if (
                  !active ||
                  revision !== bindingRevision ||
                  request !== sequence ||
                  api.getPublicInstance?.(`amount-${index}`) !== instance
                )
                  return;
                void api
                  .setChildren?.(`amount-text-${index}`, [
                    { key: 'amount', node: { kind: 'text', text: formatUsd(raw) } },
                  ])
                  .catch(() => {});
              });
            };
            disposers.push(state.subscribe(syncCell));
            syncCell();
          }

          const table = instances.table?.getExposes();
          for (const name of ['pageSelection', 'filteredCount']) {
            const state = table?.[name] as
              | { subscribe(listener: () => void): () => void }
              | undefined;
            if (state) disposers.push(state.subscribe(updateSummary));
          }
          updateSummary();
        }
      );

      return () => {
        active = false;
        bindingRevision++;
        unbind?.();
        disposers.splice(0).forEach((dispose) => dispose());
      };
    },
  };
}

/** Basic Table & Sorting example (sortable vs non-sortable headers + defaultSortKey). */
export function createDataTableBasicDemo(family: DataTableDemoFamily): DemoSpec {
  const rows = INVOICES.slice(0, 4);
  return {
    type: 'demo',
    root: wrapStage(family, [
      proto(family, 'data-table-root', {
        className: tableClassFor(family),
        props: {
          rows,
          pageSize: 4,
          defaultSortKey: 'invoice',
          defaultSortDirection: 'ascending',
        },
        children: [
          proto(family, 'data-table-caption', {
            children: ['A list of your recent invoices. Click Invoice or Amount to sort.'],
          }),
          proto(family, 'data-table-header-row', {
            children: [
              proto(family, 'data-table-header', {
                props: { headerKey: 'invoice', headerKind: 'column', sortable: true },
                children: ['Invoice'],
              }),
              proto(family, 'data-table-header', {
                props: { headerKey: 'status', headerKind: 'column', sortable: false },
                children: ['Status'],
              }),
              proto(family, 'data-table-header', {
                props: { headerKey: 'method', headerKind: 'column', sortable: true },
                children: ['Method'],
              }),
              proto(family, 'data-table-header', {
                props: { headerKey: 'amount', headerKind: 'column', sortable: true },
                className: 'text-right',
                children: ['Amount (USD)'],
              }),
            ],
          }),
          ...[0, 1, 2, 3].map((index) =>
            proto(family, 'data-table-row', {
              props: { index },
              children: [
                proto(family, 'data-table-cell', {
                  props: { columnKey: 'invoice', headers: ['invoice'] },
                  className: 'font-medium',
                }),
                proto(family, 'data-table-cell', {
                  props: { columnKey: 'status', headers: ['status'] },
                }),
                proto(family, 'data-table-cell', {
                  props: { columnKey: 'method', headers: ['method'] },
                }),
                proto(family, 'data-table-cell', {
                  props: { columnKey: 'amount', headers: ['amount'] },
                  className: 'text-right font-medium',
                }),
              ],
            })
          ),
        ],
      }),
    ]),
  };
}

/** Filtering & Column Visibility example (global filter + columnFilters + columnVisibility). */
export function createDataTableFilteringDemo(family: DataTableDemoFamily): DemoSpec {
  return {
    type: 'demo',
    root: wrapStage(family, [
      {
        kind: 'box',
        className: 'flex flex-wrap items-center justify-between gap-2',
        children: [
          {
            kind: 'box',
            className: 'flex flex-wrap items-center gap-2',
            children: [
              proto(family, 'input-root', {
                ref: 'global-filter',
                className: 'w-44',
                props: {
                  ariaLabel: 'Search all columns',
                  placeholder: 'Search all...',
                },
              }),
              proto(family, 'input-root', {
                ref: 'status-filter',
                className: 'w-40',
                props: {
                  ariaLabel: 'Filter by status',
                  placeholder: 'Status (e.g. Paid)...',
                },
              }),
            ],
          },
          {
            kind: 'box',
            className: 'flex flex-wrap items-center gap-2',
            children: [
              proto(family, 'button', {
                ref: 'toggle-method',
                props: buttonPropsFor(family, 'outline'),
                children: ['Toggle Method'],
              }),
              proto(family, 'button', {
                ref: 'toggle-amount',
                props: buttonPropsFor(family, 'outline'),
                children: ['Toggle Amount'],
              }),
            ],
          },
        ],
      },
      proto(family, 'data-table-root', {
        ref: 'table',
        className: tableClassFor(family),
        props: {
          rows: INVOICES,
          pageSize: 6,
        },
        children: [
          proto(family, 'data-table-header-row', {
            children: [
              proto(family, 'data-table-header', {
                props: { headerKey: 'invoice', headerKind: 'column' },
                children: ['Invoice'],
              }),
              proto(family, 'data-table-header', {
                props: { headerKey: 'status', headerKind: 'column' },
                children: ['Status'],
              }),
              proto(family, 'data-table-header', {
                props: { headerKey: 'method', headerKind: 'column' },
                children: ['Method'],
              }),
              proto(family, 'data-table-header', {
                props: { headerKey: 'amount', headerKind: 'column' },
                className: 'text-right',
                children: ['Amount (USD)'],
              }),
            ],
          }),
          ...[0, 1, 2, 3, 4, 5].map((index) =>
            proto(family, 'data-table-row', {
              props: { index },
              children: [
                proto(family, 'data-table-cell', {
                  props: { columnKey: 'invoice', headers: ['invoice'] },
                  className: 'font-medium',
                }),
                proto(family, 'data-table-cell', {
                  props: { columnKey: 'status', headers: ['status'] },
                }),
                proto(family, 'data-table-cell', {
                  props: { columnKey: 'method', headers: ['method'] },
                }),
                proto(family, 'data-table-cell', {
                  props: { columnKey: 'amount', headers: ['amount'] },
                  className: 'text-right font-medium',
                }),
              ],
            })
          ),
          {
            kind: 'box',
            className: 'table-caption caption-bottom',
            children: [
              {
                kind: 'box',
                ref: 'filter-summary',
                className: 'pt-3 text-sm text-muted-foreground',
                attrs: { 'aria-live': 'polite' },
                children: ['Showing 6 matching invoice(s).'],
              },
            ],
          },
        ],
      }),
    ]),
    setup({ api, refs }) {
      let active = true;
      let showMethod = true;
      let showAmount = true;
      const disposers: Array<() => void> = [];

      const updateCount = () => {
        if (!active || !refs['filter-summary']) return;
        const count = Number(api.call('table', 'filteredCount.get') ?? INVOICES.length);
        refs['filter-summary'].textContent =
          count === 0 ? 'No matching invoices.' : `Showing ${count} matching invoice(s).`;
      };

      api.setProps('global-filter', {
        onValueChange(detail: { value: string }) {
          if (active) api.setProps('table', { filter: detail.value });
        },
      });
      api.setProps('status-filter', {
        onValueChange(detail: { value: string }) {
          if (active) api.setProps('table', { columnFilters: { status: detail.value } });
        },
      });
      api.setProps('toggle-method', {
        onClick() {
          if (!active) return;
          showMethod = !showMethod;
          api.setProps('table', {
            columnVisibility: { method: showMethod, amount: showAmount },
          });
        },
      });
      api.setProps('toggle-amount', {
        onClick() {
          if (!active) return;
          showAmount = !showAmount;
          api.setProps('table', {
            columnVisibility: { method: showMethod, amount: showAmount },
          });
        },
      });

      const unbind = api.subscribePublicInstances?.(['table'], (instances) => {
        disposers.splice(0).forEach((dispose) => dispose());
        if (!active) return;
        const filtered = instances.table?.getExposes()?.filteredCount as
          | { subscribe(listener: () => void): () => void }
          | undefined;
        if (filtered) disposers.push(filtered.subscribe(updateCount));
        updateCount();
      });

      return () => {
        active = false;
        unbind?.();
        disposers.splice(0).forEach((dispose) => dispose());
      };
    },
  };
}

/** Pagination & Row Selection example (pageSize=3 across 6 invoices, preserved cross-page selection). */
export function createDataTablePaginationDemo(family: DataTableDemoFamily): DemoSpec {
  return {
    type: 'demo',
    root: wrapStage(family, [
      {
        kind: 'box',
        className: 'flex flex-wrap items-center justify-between gap-2',
        children: [
          {
            kind: 'box',
            ref: 'page-indicator',
            className: 'text-sm font-medium text-foreground',
            children: ['Page 1 of 2'],
          },
          proto(family, 'button', {
            ref: 'toggle-page-selection',
            props: buttonPropsFor(family, 'outline'),
            children: ['Select / clear current page'],
          }),
        ],
      },
      proto(family, 'data-table-root', {
        ref: 'table',
        className: tableClassFor(family),
        props: {
          rows: INVOICES,
          pageSize: 3,
          defaultSelectedKeys: ['inv-001'],
        },
        children: [
          proto(family, 'data-table-header-row', {
            children: [
              proto(family, 'data-table-header', {
                props: { headerKey: 'invoice', headerKind: 'column' },
                children: ['Invoice'],
              }),
              proto(family, 'data-table-header', {
                props: { headerKey: 'status', headerKind: 'column' },
                children: ['Status'],
              }),
              proto(family, 'data-table-header', {
                props: { headerKey: 'method', headerKind: 'column' },
                children: ['Method'],
              }),
            ],
          }),
          ...[0, 1, 2].map((index) =>
            proto(family, 'data-table-row', {
              props: { index },
              children: [
                proto(family, 'data-table-cell', {
                  props: { columnKey: 'invoice', headers: ['invoice'] },
                  className: 'font-medium',
                }),
                proto(family, 'data-table-cell', {
                  props: { columnKey: 'status', headers: ['status'] },
                }),
                proto(family, 'data-table-cell', {
                  props: { columnKey: 'method', headers: ['method'] },
                }),
              ],
            })
          ),
          {
            kind: 'box',
            className: 'table-caption caption-bottom',
            children: [
              {
                kind: 'box',
                className: 'flex flex-wrap items-center justify-between gap-3 pt-3',
                children: [
                  {
                    kind: 'box',
                    ref: 'selection-count',
                    className: 'text-sm text-muted-foreground',
                    attrs: { 'aria-live': 'polite' },
                    children: ['1 of 6 row(s) selected.'],
                  },
                  {
                    kind: 'box',
                    className: 'flex items-center gap-2',
                    children: [
                      proto(family, 'data-table-previous', {
                        children: ['Previous'],
                      }),
                      proto(family, 'data-table-next', {
                        props: family === 'liquid-glass' ? { variant: 'prominent' } : {},
                        children: ['Next'],
                      }),
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ]),
    setup({ api, refs }) {
      let active = true;
      let currentPage = 0;

      const syncSummary = () => {
        queueMicrotask(() => {
          if (!active) return;
          const selected = (api.call('table', 'getSelectedKeys') as string[] | undefined) ?? [];
          if (refs['selection-count']) {
            refs['selection-count'].textContent =
              `${selected.length} of ${INVOICES.length} row(s) selected.`;
          }
          if (refs['page-indicator']) {
            refs['page-indicator'].textContent = `Page ${currentPage + 1} of 2`;
          }
        });
      };

      api.setProps('toggle-page-selection', {
        onClick() {
          if (active) api.call('table', 'requestPageSelection');
        },
      });
      api.setProps('table', {
        onSelectionChange: syncSummary,
        onPageChange(detail: { page: number }) {
          currentPage = detail.page;
          syncSummary();
        },
      });

      syncSummary();
      return () => {
        active = false;
      };
    },
  };
}

/** Read-only and Disabled states example (plus Liquid Glass opaque fallback comparison). */
export function createDataTableStatesDemo(family: DataTableDemoFamily): DemoSpec {
  const sampleRows = PAYMENTS.slice(0, 3);
  const buildMiniTable = (options: {
    label: string;
    props: Record<string, unknown>;
    controlProps?: Record<string, unknown>;
  }): DemoNode => ({
    kind: 'box',
    className: 'grid gap-2',
    children: [
      {
        kind: 'box',
        className: 'text-xs font-medium text-muted-foreground',
        children: [options.label],
      },
      proto(family, 'data-table-root', {
        className: tableClassFor(family),
        props: {
          rows: sampleRows,
          pageSize: 2,
          defaultSelectedKeys: ['m5gr84i9'],
          ...options.props,
        },
        children: [
          proto(family, 'data-table-header-row', {
            children: [
              proto(family, 'data-table-header', {
                props: { headerKey: 'status', headerKind: 'column' },
                children: ['Status'],
              }),
              proto(family, 'data-table-header', {
                props: { headerKey: 'email', headerKind: 'column' },
                children: ['Email'],
              }),
            ],
          }),
          ...[0, 1].map((index) =>
            proto(family, 'data-table-row', {
              props: { index },
              children: [
                proto(family, 'data-table-cell', {
                  props: { columnKey: 'status', headers: ['status'] },
                }),
                proto(family, 'data-table-cell', {
                  props: { columnKey: 'email', headers: ['email'] },
                }),
              ],
            })
          ),
          {
            kind: 'box',
            className: 'table-caption caption-bottom',
            children: [
              {
                kind: 'box',
                className: 'flex items-center justify-end gap-2 pt-2',
                children: [
                  proto(family, 'data-table-previous', {
                    props: options.controlProps,
                    children: ['Previous'],
                  }),
                  proto(family, 'data-table-next', {
                    props: options.controlProps,
                    children: ['Next'],
                  }),
                ],
              },
            ],
          },
        ],
      }),
    ],
  });

  return {
    type: 'demo',
    root: wrapStage(family, [
      buildMiniTable({
        label:
          family === 'liquid-glass'
            ? 'Read-only (sorting and paging remain active; glass controls in auto mode)'
            : 'Read-only (sorting and paging remain active; row selection is locked)',
        props: { readOnly: true },
        controlProps: family === 'liquid-glass' ? { material: 'auto' } : undefined,
      }),
      buildMiniTable({
        label:
          family === 'liquid-glass'
            ? 'Disabled (all interaction blocked; opaque control fallback)'
            : 'Disabled (all sorting, paging, and row selection disabled)',
        props: { disabled: true },
        controlProps: family === 'liquid-glass' ? { material: 'opaque' } : undefined,
      }),
    ]),
  };
}
