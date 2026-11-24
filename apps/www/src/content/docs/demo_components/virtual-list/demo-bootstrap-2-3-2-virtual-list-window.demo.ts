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
    className: 'flex w-full max-w-lg flex-col gap-3',
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
                prototypeId: 'bootstrap-2-3-2-button',
                props: { variant: 'primary', size: 'small' },
                ref: 'overscanLow',
                children: ['overscan: 1'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-button',
                props: { variant: 'default', size: 'small' },
                ref: 'overscanHigh',
                children: ['overscan: 6'],
              },
            ],
          },
          {
            kind: 'box',
            className: 'text-[12px] tabular-nums text-muted-foreground',
            attrs: { role: 'status', 'aria-live': 'polite' },
            ref: 'metrics',
            children: ['Logical: 2,000 · Mounted: 0 · Cap: 40'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-virtual-list-root',
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
            prototypeId: 'bootstrap-2-3-2-virtual-list-viewport',
            className: 'h-60',
            ref: 'viewport',
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-virtual-list-content',
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
      estimateSize: 40,
      renderItem(key) {
        const num = Number(key.slice(4));
        const row = doc.createElement('div');
        row.className =
          'flex items-center justify-between border-b border-border px-3 py-2 text-[14px] leading-[20px]';
        if (num % 2 === 0) {
          row.style.backgroundColor = 'var(--pui-secondary, #f5f5f5)';
        }

        const label = doc.createElement('span');
        label.className = 'font-bold';
        label.textContent = `Metric stream #${num}`;

        const detail = doc.createElement('span');
        detail.className = 'text-[12px] tabular-nums';
        detail.style.color = 'var(--pui-muted-foreground, #666666)';
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
      api.setProps('overscanLow', { variant: next === 1 ? 'primary' : 'default' });
      api.setProps('overscanHigh', { variant: next === 6 ? 'primary' : 'default' });
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
