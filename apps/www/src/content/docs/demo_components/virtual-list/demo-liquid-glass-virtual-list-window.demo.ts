import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';
import { attachWebVirtualList } from '@proto.ui/prototypes-base/virtual-list/web';
import type { WindowedCollection } from '@proto.ui/prototypes-base/virtual-list';

const KEYS = Array.from(
  { length: 2000 },
  (_, index) => `row-${String(index + 1).padStart(4, '0')}`
);

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-xl flex-col gap-3',
    children: [
      {
        kind: 'box',
        className: 'flex flex-wrap items-center justify-between gap-2',
        children: [
          {
            kind: 'box',
            className: 'flex items-center gap-2',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-button',
                props: { variant: 'prominent' },
                ref: 'overscanLow',
                children: ['overscan: 1'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-button',
                props: { variant: 'regular' },
                ref: 'overscanHigh',
                children: ['overscan: 6'],
              },
            ],
          },
          {
            kind: 'box',
            className: 'text-xs tabular-nums text-foreground/80',
            attrs: { role: 'status', 'aria-live': 'polite' },
            ref: 'metrics',
            children: ['Logical: 2,000 · Mounted: 0 · Cap: 40'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-virtual-list-root',
        props: {
          itemKeys: KEYS,
          overscanItems: 1,
          maxMaterializedItems: 40,
          a11yLabel: 'Bounded window telemetry list',
        },
        className: 'w-full',
        ref: 'list',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-virtual-list-viewport',
            className: 'h-60',
            ref: 'viewport',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-virtual-list-content',
                ref: 'content',
              },
            ],
          },
        ],
      },
    ],
  },
  setup({ refs, api }) {
    const viewport = refs.viewport!;
    const content = refs.content!;
    const metrics = refs.metrics!;
    const doc = viewport.ownerDocument;
    const collection = api.call('list', 'getCollection') as WindowedCollection;

    const updateMetrics = () => {
      const snap = collection.snapshot();
      const range = snap.committed ? `${snap.committed.start + 1}–${snap.committed.end}` : '—';
      metrics.textContent = `Logical: ${snap.keys.length.toLocaleString()} · Mounted: ${snap.materializedKeys.length} · Range: ${range} · Cap: 40`;
    };

    const host = attachWebVirtualList({
      viewport,
      content,
      collection,
      estimateSize: 44,
      renderItem(key) {
        const num = Number(key.slice(4));
        const row = doc.createElement('div');
        row.className =
          'flex items-center justify-between border-b border-border/50 px-4 py-2.5 text-sm';

        const label = doc.createElement('span');
        label.className = 'font-medium';
        label.textContent = `Metric stream #${num}`;

        const detail = doc.createElement('span');
        detail.className = 'text-xs tabular-nums';
        detail.style.color = 'var(--pui-muted-foreground, #626267)';
        detail.textContent = `${12 + (num % 48)} ms`;

        row.append(label, detail);
        return row;
      },
    });

    const onScroll = () => updateMetrics();
    viewport.addEventListener('scroll', onScroll, { passive: true });
    const unsubscribe = collection.subscribe(() => queueMicrotask(updateMetrics));
    updateMetrics();

    let currentOverscan = 1;
    const setOverscan = (next: 1 | 6) => {
      if (currentOverscan === next) return;
      currentOverscan = next;
      api.setProps('list', { overscanItems: next });
      api.setProps('overscanLow', { variant: next === 1 ? 'prominent' : 'regular' });
      api.setProps('overscanHigh', { variant: next === 6 ? 'prominent' : 'regular' });
      queueMicrotask(updateMetrics);
    };

    const onLow = () => setOverscan(1);
    const onHigh = () => setOverscan(6);
    refs.overscanLow?.addEventListener('click', onLow);
    refs.overscanHigh?.addEventListener('click', onHigh);

    return () => {
      viewport.removeEventListener('scroll', onScroll);
      refs.overscanLow?.removeEventListener('click', onLow);
      refs.overscanHigh?.removeEventListener('click', onHigh);
      unsubscribe();
      host.dispose();
    };
  },
} satisfies DemoSpec;
