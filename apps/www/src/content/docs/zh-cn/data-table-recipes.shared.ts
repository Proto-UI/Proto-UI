import type {
  DemoChild,
  DemoNode,
  DemoSpec,
} from '../../../components/PrototypePreviewer/demo-types';

/** App-owned formatting and controls; all data-view and selection policy stays in DataTable. */
export function createDataTableRecipes(family: 'base' | 'shadcn' | 'brutalist'): DemoSpec {
  const proto = (
    part: string,
    ref: string,
    props: Record<string, unknown> = {},
    children: DemoChild[] = []
  ): DemoNode => ({
    kind: 'proto',
    prototypeId: `${family}-${part}`,
    ref,
    props,
    children,
  });
  const rows = [
    { id: 'api', name: 'API', state: 'ready' },
    { id: 'web', name: 'Website', state: 'busy' },
    { id: 'docs', name: 'Docs', state: 'ready' },
  ];
  const header = proto('data-table-header-row', 'headers', {}, [
    proto('data-table-header', 'name-header', { headerKey: 'name' }, ['Service']),
    proto('data-table-header', 'state-header', { headerKey: 'state' }, ['Status']),
  ]);
  if (header.kind === 'proto') header.className = 'grid grid-flow-col auto-cols-fr';
  const body = [0, 1].map((index) => {
    const row = proto('data-table-row', `row-${index}`, { index }, [
      proto('data-table-cell', `name-${index}`, { columnKey: 'name', headers: ['name'] }),
      proto(
        'data-table-cell',
        `state-${index}`,
        { columnKey: 'state', headers: ['state'], renderValue: false },
        [
          {
            kind: 'box',
            tag: 'span',
            ref: `formatted-${index}`,
            className: 'font-mono text-xs',
            dynamicChildren: { prototypeIds: [] },
          },
        ]
      ),
    ]);
    if (row.kind === 'proto') row.className = 'grid grid-flow-col auto-cols-fr';
    return row;
  });
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'grid w-full max-w-xl gap-3',
      children: [
        proto('input-root', 'name-filter', {
          ariaLabel: 'Filter services by name',
          placeholder: 'Filter services by name',
        }),
        {
          kind: 'box',
          className: 'flex flex-wrap gap-2',
          children: [
            proto('button', 'toggle-status', {}, ['Show / hide status']),
            proto('button', 'select-page', {}, ['Select / clear current page']),
          ],
        },
        proto('data-table-root', 'table', { rows, pageSize: 2 }, [
          proto('data-table-caption', 'caption', {}, ['Service inventory']),
          header,
          ...body,
          {
            kind: 'box',
            className: 'flex gap-2',
            children: [
              proto('data-table-previous', 'previous', {}, ['Previous']),
              proto('data-table-next', 'next', {}, ['Next']),
            ],
          },
        ]),
        {
          kind: 'box',
          ref: 'selection-summary',
          attrs: { 'aria-live': 'polite' },
          children: ['No rows selected.'],
        },
      ],
    },
    setup({ api, refs }) {
      let active = true,
        showStatus = true,
        bindingRevision = 0;
      const stateDisposers: Array<() => void> = [];
      let summaryQueued = false;
      const updateSummary = () => {
        if (!active || summaryQueued) return;
        summaryQueued = true;
        queueMicrotask(() => {
          summaryQueued = false;
          if (!active) return;
          const selected = api.call('table', 'getSelectedKeys') as string[] | undefined;
          const selection = api.call('table', 'pageSelection.get');
          refs['selection-summary'].textContent =
            `${selected?.length ?? 0} selected; current page: ${selection ?? 'none'}.`;
        });
      };
      api.setProps('name-filter', {
        onValueChange(detail: { value: string }) {
          if (active) api.setProps('table', { columnFilters: { name: detail.value } });
        },
      });
      api.setProps('toggle-status', {
        onClick() {
          if (!active) return;
          showStatus = !showStatus;
          api.setProps('table', { columnVisibility: { state: showStatus } });
        },
      });
      api.setProps('select-page', {
        onClick() {
          if (active) api.call('table', 'requestPageSelection');
        },
      });
      api.setProps('table', { onSelectionChange: updateSummary, onPageChange: updateSummary });
      const unbind = api.subscribePublicInstances?.(
        ['table', 'state-0', 'state-1'],
        (instances) => {
          const revision = ++bindingRevision;
          stateDisposers.splice(0).forEach((dispose) => dispose());
          if (!active) return;
          for (const index of [0, 1]) {
            const instance = instances[`state-${index}`];
            const state = instance?.getExposes()?.displayValue as
              | { get(): string; subscribe(listener: () => void): () => void }
              | undefined;
            if (!state) continue;
            let sequence = 0;
            const format = () => {
              if (
                !active ||
                revision !== bindingRevision ||
                api.getPublicInstance?.(`state-${index}`) !== instance
              )
                return;
              const value = state.get();
              const request = ++sequence;
              // Framework commits cannot start inside a prototype's mount/update
              // callback. Coalesce formatting and verify this public owner again.
              queueMicrotask(() => {
                if (
                  !active ||
                  revision !== bindingRevision ||
                  request !== sequence ||
                  api.getPublicInstance?.(`state-${index}`) !== instance
                )
                  return;
                void api
                  .setChildren?.(`formatted-${index}`, [
                    {
                      key: 'status',
                      node: { kind: 'text', text: value ? `[${value.toUpperCase()}]` : '' },
                    },
                  ])
                  .catch((error) => {
                    if (active && revision === bindingRevision)
                      refs['selection-summary'].textContent = String(error);
                  });
              });
            };
            stateDisposers.push(state.subscribe(format));
            format();
          }
          const table = instances.table?.getExposes();
          for (const name of ['pageSelection', 'filteredCount']) {
            const state = table?.[name] as
              | { subscribe(listener: () => void): () => void }
              | undefined;
            if (state) stateDisposers.push(state.subscribe(updateSummary));
          }
          updateSummary();
        }
      );
      return () => {
        active = false;
        bindingRevision++;
        unbind?.();
        stateDisposers.splice(0).forEach((dispose) => dispose());
      };
    },
  };
}
