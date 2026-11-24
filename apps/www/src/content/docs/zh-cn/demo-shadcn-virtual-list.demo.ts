import { withShadcnRheaDemo } from '../shadcn-demo-style';
import type { DemoSpec } from '../../../components/PrototypePreviewer/demo-types';
import { attachWebVirtualList } from '@proto.ui/prototypes-base/virtual-list/web';
import type { WindowedCollection } from '@proto.ui/prototypes-base/virtual-list';

type ActivityEntry = {
  key: string;
  title: string;
  tag: string;
  time: string;
  detail?: string;
  meta?: string;
};

const TAGS = ['Deploy', 'Audit', 'Billing', 'Security', 'Sync'] as const;
const TITLES = [
  'Published edge worker release',
  'Rotated API signing key',
  'Completed invoice reconciliation',
  'Verified webhook endpoint TLS',
  'Synchronized workspace permissions',
] as const;

const ENTRIES: readonly ActivityEntry[] = Array.from({ length: 1000 }, (_, index) => {
  const num = index + 1;
  const tag = TAGS[index % TAGS.length]!;
  const title = `${TITLES[index % TITLES.length]!} #${num}`;
  const minutes = String((index * 7) % 60).padStart(2, '0');
  const hours = String((index * 3) % 24).padStart(2, '0');
  const entry: ActivityEntry = {
    key: `event-${String(num).padStart(4, '0')}`,
    title,
    tag,
    time: `${hours}:${minutes}`,
  };
  if (index % 3 === 1) {
    entry.detail =
      'Triggered automatically by CI pipeline after all integration checks passed across regions.';
  } else if (index % 3 === 2) {
    entry.detail =
      'Rolled out incrementally to 25% of traffic with automatic rollback guards enabled. Latency remained within the 120ms budget across all active edge clusters.';
    entry.meta = `Actor: release-bot · Region: us-east-${(index % 4) + 1}`;
  }
  return entry;
});

const ENTRY_BY_KEY = new Map(ENTRIES.map((entry) => [entry.key, entry]));

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'shadcn-virtual-list-root',
    props: {
      itemKeys: ENTRIES.map((entry) => entry.key),
      overscanItems: 3,
      maxMaterializedItems: 60,
      a11yLabel: 'Workspace activity log',
    },
    className: 'w-full max-w-lg',
    ref: 'list',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-virtual-list-viewport',
        className: 'h-72',
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
  setup({ refs, api }) {
    const viewport = refs.viewport!;
    const content = refs.content!;
    const doc = viewport.ownerDocument;
    const collection = api.call('list', 'getCollection') as WindowedCollection;
    const host = attachWebVirtualList({
      viewport,
      content,
      collection,
      estimateSize: 64,
      renderItem(key) {
        const entry = ENTRY_BY_KEY.get(key);
        const row = doc.createElement('div');
        row.className =
          'flex flex-col gap-1 border-b border-border/60 px-4 py-3 text-sm transition-colors hover:bg-muted/50';

        const header = doc.createElement('div');
        header.className = 'flex items-center justify-between gap-2';

        const left = doc.createElement('div');
        left.className = 'flex min-w-0 items-center gap-2';

        const badge = doc.createElement('span');
        badge.className =
          'shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground';
        badge.textContent = entry?.tag ?? 'Event';

        const title = doc.createElement('span');
        title.className = 'truncate font-medium text-foreground';
        title.textContent = entry?.title ?? key;

        const time = doc.createElement('span');
        time.className = 'shrink-0 text-xs tabular-nums text-muted-foreground';
        time.textContent = entry?.time ?? '';

        left.append(badge, title);
        header.append(left, time);
        row.append(header);

        if (entry?.detail) {
          const detail = doc.createElement('p');
          detail.className = 'm-0 text-xs leading-relaxed text-muted-foreground';
          detail.textContent = entry.detail;
          row.append(detail);
        }

        if (entry?.meta) {
          const meta = doc.createElement('div');
          meta.className = 'text-xs text-muted-foreground/80';
          meta.textContent = entry.meta;
          row.append(meta);
        }

        return row;
      },
    });
    return () => host.dispose();
  },
} satisfies DemoSpec);
