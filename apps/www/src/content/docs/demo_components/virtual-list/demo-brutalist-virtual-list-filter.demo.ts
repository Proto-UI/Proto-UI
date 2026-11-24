import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';
import { attachWebVirtualList } from '@proto.ui/prototypes-base/virtual-list/web';
import type { WindowedCollection } from '@proto.ui/prototypes-base/virtual-list';

type FilterCategory = 'all' | 'release' | 'alert' | 'empty';

type RecordItem = {
  key: string;
  category: 'release' | 'alert';
  title: string;
  summary: string;
};

const RECORDS: readonly RecordItem[] = Array.from({ length: 500 }, (_, index) => {
  const num = index + 1;
  const isAlert = index % 4 === 0;
  return {
    key: `rec-${String(num).padStart(4, '0')}`,
    category: isAlert ? 'alert' : 'release',
    title: isAlert ? `Latency threshold notice #${num}` : `Build artifact v2.${num}.0`,
    summary: isAlert
      ? 'P95 response time briefly exceeded 220ms in eu-central-1 before recovering.'
      : 'Signed bundle published and verified against workspace checksums.',
  };
});

const RECORD_BY_KEY = new Map(RECORDS.map((item) => [item.key, item]));

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-lg flex-col gap-3',
    children: [
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-button',
            props: { variant: 'solid', size: 'sm' },
            ref: 'filterAll',
            children: ['All (500)'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-button',
            props: { variant: 'surface', size: 'sm' },
            ref: 'filterRelease',
            children: ['Releases (375)'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-button',
            props: { variant: 'surface', size: 'sm' },
            ref: 'filterAlert',
            children: ['Alerts (125)'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-button',
            props: { variant: 'surface', size: 'sm' },
            ref: 'filterEmpty',
            children: ['Empty (0)'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'relative w-full',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-virtual-list-root',
            props: {
              itemKeys: RECORDS.map((item) => item.key),
              overscanItems: 2,
              maxMaterializedItems: 50,
              a11yLabel: 'Filterable deployment records',
            },
            className: 'w-full',
            ref: 'list',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-virtual-list-viewport',
                className: 'h-60',
                ref: 'viewport',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-virtual-list-content',
                    ref: 'content',
                  },
                ],
              },
            ],
          },
          {
            kind: 'box',
            className:
              'pointer-events-none absolute inset-0 hidden items-center justify-center p-6 text-center text-sm font-medium text-foreground/80',
            ref: 'emptyState',
            children: ['No matching records. Select another filter to populate the list.'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'text-xs font-medium text-foreground/80',
        attrs: { role: 'status', 'aria-live': 'polite' },
        ref: 'status',
        children: ['Showing 500 logical items (All).'],
      },
    ],
  },
  setup({ refs, api }) {
    const viewport = refs.viewport!;
    const content = refs.content!;
    const emptyState = refs.emptyState!;
    const status = refs.status!;
    const doc = viewport.ownerDocument;
    const collection = api.call('list', 'getCollection') as WindowedCollection;

    const host = attachWebVirtualList({
      viewport,
      content,
      collection,
      estimateSize: 60,
      renderItem(key) {
        const item = RECORD_BY_KEY.get(key);
        const row = doc.createElement('div');
        row.className = 'flex flex-col gap-1 border-b-2 border-black px-4 py-3 text-sm';

        const top = doc.createElement('div');
        top.className = 'flex items-center justify-between gap-2';

        const title = doc.createElement('span');
        title.className = 'font-bold text-foreground';
        title.textContent = item?.title ?? key;

        const badge = doc.createElement('span');
        badge.className =
          item?.category === 'alert'
            ? 'rounded-[5px] border-2 border-black bg-[#ff9b85] px-1.5 py-0.5 text-xs font-bold text-black'
            : 'rounded-[5px] border-2 border-black bg-[#dcebfe] px-1.5 py-0.5 text-xs font-bold text-black';
        badge.textContent = item?.category === 'alert' ? 'ALERT' : 'RELEASE';

        top.append(title, badge);
        row.append(top);

        if (item?.summary) {
          const summary = doc.createElement('p');
          summary.className = 'm-0 text-xs font-medium text-foreground/80';
          summary.textContent = item.summary;
          row.append(summary);
        }

        return row;
      },
    });

    const buttons: Record<FilterCategory, { refName: string; label: string }> = {
      all: { refName: 'filterAll', label: 'All' },
      release: { refName: 'filterRelease', label: 'Releases' },
      alert: { refName: 'filterAlert', label: 'Alerts' },
      empty: { refName: 'filterEmpty', label: 'Empty' },
    };

    let active: FilterCategory = 'all';
    const applyFilter = (next: FilterCategory) => {
      if (active === next) return;
      active = next;
      const nextKeys =
        next === 'all'
          ? RECORDS.map((item) => item.key)
          : next === 'empty'
            ? []
            : RECORDS.filter((item) => item.category === next).map((item) => item.key);

      viewport.scrollTop = 0;
      api.setProps('list', { itemKeys: nextKeys });
      for (const [mode, config] of Object.entries(buttons) as Array<
        [FilterCategory, { refName: string; label: string }]
      >) {
        api.setProps(config.refName, { variant: mode === next ? 'solid' : 'surface' });
      }
      emptyState.classList.toggle('hidden', nextKeys.length > 0);
      emptyState.classList.toggle('flex', nextKeys.length === 0);
      status.textContent = `Showing ${nextKeys.length} logical items (${buttons[next].label}).`;
    };

    const cleanups: Array<() => void> = [];
    for (const [mode, config] of Object.entries(buttons) as Array<
      [FilterCategory, { refName: string; label: string }]
    >) {
      const button = refs[config.refName];
      if (!button) continue;
      const onClick = () => applyFilter(mode);
      button.addEventListener('click', onClick);
      cleanups.push(() => button.removeEventListener('click', onClick));
    }

    return () => {
      for (const cleanup of cleanups) cleanup();
      host.dispose();
    };
  },
} satisfies DemoSpec;
