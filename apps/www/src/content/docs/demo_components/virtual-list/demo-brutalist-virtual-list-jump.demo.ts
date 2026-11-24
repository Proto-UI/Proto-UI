import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';
import { attachWebVirtualList } from '@proto.ui/prototypes-base/virtual-list/web';
import type { WindowedCollection } from '@proto.ui/prototypes-base/virtual-list';

const KEYS = Array.from(
  { length: 1000 },
  (_, index) => `item-${String(index + 1).padStart(4, '0')}`
);

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
            props: { variant: 'surface', size: 'sm' },
            ref: 'btnTop',
            children: ['Jump to #1'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-button',
            props: { variant: 'surface', size: 'sm' },
            ref: 'btnMid',
            children: ['Center #250'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-button',
            props: { variant: 'surface', size: 'sm' },
            ref: 'btnDeep',
            children: ['Center #750'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-button',
            props: { variant: 'solid', size: 'sm' },
            ref: 'btnEnd',
            children: ['Jump to #1000'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-virtual-list-root',
        props: {
          itemKeys: KEYS,
          overscanItems: 3,
          maxMaterializedItems: 60,
          a11yLabel: 'Jumpable changelog entries',
        },
        className: 'w-full',
        ref: 'list',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-virtual-list-viewport',
            className: 'h-64',
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
        className: 'text-xs font-medium text-foreground/80',
        attrs: { role: 'status', 'aria-live': 'polite' },
        ref: 'status',
        children: ['Use the actions above to scroll to any key via ensureVisible(key, align).'],
      },
    ],
  },
  setup({ refs, api }) {
    const viewport = refs.viewport!;
    const content = refs.content!;
    const status = refs.status!;
    const doc = viewport.ownerDocument;
    let highlightedKey = '';
    const rowNodes = new Map<string, HTMLElement>();

    const updateHighlight = () => {
      for (const [key, node] of rowNodes) {
        node.style.backgroundColor = key === highlightedKey ? 'var(--pui-main, #5294ff)' : '';
        node.style.color = key === highlightedKey ? 'var(--pui-main-foreground, #000000)' : '';
      }
    };

    const collection = api.call('list', 'getCollection') as WindowedCollection;
    const host = attachWebVirtualList({
      viewport,
      content,
      collection,
      estimateSize: 48,
      renderItem(key) {
        const index = Number(key.slice(5));
        const row = doc.createElement('div');
        row.className =
          'flex items-center justify-between gap-3 border-b-2 border-black px-4 py-3 text-sm';
        if (key === highlightedKey) {
          row.style.backgroundColor = 'var(--pui-main, #5294ff)';
          row.style.color = 'var(--pui-main-foreground, #000000)';
        }

        const title = doc.createElement('span');
        title.className = 'font-bold';
        title.textContent = `Release entry #${index}`;

        const tag = doc.createElement('span');
        tag.className = 'text-xs font-medium tabular-nums';
        tag.textContent = key;

        row.append(title, tag);
        rowNodes.set(key, row);
        return row;
      },
    });

    const targets: Array<[HTMLElement | undefined, string, 'start' | 'center' | 'end', string]> = [
      [refs.btnTop, 'item-0001', 'start', '#1 (align: start)'],
      [refs.btnMid, 'item-0250', 'center', '#250 (align: center)'],
      [refs.btnDeep, 'item-0750', 'center', '#750 (align: center)'],
      [refs.btnEnd, 'item-1000', 'end', '#1000 (align: end)'],
    ];

    const cleanups: Array<() => void> = [];
    for (const [button, key, align, label] of targets) {
      if (!button) continue;
      const onClick = () => {
        highlightedKey = key;
        const ok = host.ensureVisible(key, align);
        updateHighlight();
        status.textContent = ok ? `Scrolled to ${label}.` : `Could not materialize ${label}.`;
      };
      button.addEventListener('click', onClick);
      cleanups.push(() => button.removeEventListener('click', onClick));
    }

    return () => {
      for (const cleanup of cleanups) cleanup();
      rowNodes.clear();
      host.dispose();
    };
  },
} satisfies DemoSpec;
