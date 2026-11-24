import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';
import { attachWebVirtualList } from '@proto.ui/prototypes-base/virtual-list/web';
import type { WindowedCollection } from '@proto.ui/prototypes-base/virtual-list';

const KEYS = Array.from(
  { length: 1000 },
  (_, index) => `item-${String(index + 1).padStart(4, '0')}`
);

export default withShadcnRheaDemo({
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
            prototypeId: 'shadcn-button',
            props: { variant: 'outline', size: 'sm' },
            ref: 'btnTop',
            children: ['Jump to #1'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            props: { variant: 'outline', size: 'sm' },
            ref: 'btnMid',
            children: ['Center #250'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            props: { variant: 'outline', size: 'sm' },
            ref: 'btnDeep',
            children: ['Center #750'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            props: { variant: 'outline', size: 'sm' },
            ref: 'btnEnd',
            children: ['Jump to #1000'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-virtual-list-root',
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
            prototypeId: 'shadcn-virtual-list-viewport',
            className: 'h-64',
            ref: 'viewport',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-virtual-list-content',
                ref: 'content',
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'text-xs text-muted-foreground',
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
        node.classList.toggle('bg-accent/50', key === highlightedKey);
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
          'flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3 text-sm transition-colors hover:bg-muted/50';
        if (key === highlightedKey) row.classList.add('bg-accent/50');

        const title = doc.createElement('span');
        title.className = 'font-medium text-foreground';
        title.textContent = `Release entry #${index}`;

        const tag = doc.createElement('span');
        tag.className = 'text-xs tabular-nums text-muted-foreground';
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
} satisfies DemoSpec);
