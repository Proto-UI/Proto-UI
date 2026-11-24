import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoNode, DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

type ChannelEntry =
  | { kind: 'marker'; label: string }
  | { kind: 'message'; initials: string; author: string; time: string; body: string };

const ENTRIES: readonly ChannelEntry[] = [
  { kind: 'marker', label: 'Today · #release-engineering' },
  {
    kind: 'message',
    initials: 'MY',
    author: 'Maya',
    time: '10:02',
    body: 'Staging build is green. Ready to verify the docs preview before cutting the tag.',
  },
  {
    kind: 'message',
    initials: 'LC',
    author: 'Leo',
    time: '10:04',
    body: 'Checking keyboard focus order on the transcript viewport and jump button now.',
  },
  { kind: 'marker', label: 'Marcus joined the channel' },
  {
    kind: 'message',
    initials: 'MK',
    author: 'Marcus',
    time: '10:05',
    body: 'Just tested scrolling up mid-stream — position holds steady even when rapid log rows append.',
  },
  {
    kind: 'message',
    initials: 'AR',
    author: 'Aria',
    time: '10:07',
    body: 'Confirmed screen reader label reads "Release channel messages" on the scrollable region.',
  },
  { kind: 'marker', label: 'Deployment v2.4 completed' },
  {
    kind: 'message',
    initials: 'MY',
    author: 'Maya',
    time: '10:09',
    body: 'Published and verified across all four runtimes. Thanks everyone!',
  },
];

function renderEntry(entry: ChannelEntry): DemoNode {
  if (entry.kind === 'marker') {
    return {
      kind: 'box',
      className: 'flex items-center gap-3 py-1 text-[11px] font-medium text-muted-foreground',
      children: [
        { kind: 'box', className: 'h-px flex-1 bg-border' },
        { kind: 'box', tag: 'span', children: [entry.label] },
        { kind: 'box', className: 'h-px flex-1 bg-border' },
      ],
    };
  }
  return {
    kind: 'box',
    className: 'flex items-start gap-2.5',
    children: [
      {
        kind: 'box',
        className:
          'flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground',
        children: [entry.initials],
      },
      {
        kind: 'box',
        className: 'flex min-w-0 flex-1 flex-col gap-0.5',
        children: [
          {
            kind: 'box',
            className: 'flex items-baseline gap-2',
            children: [
              {
                kind: 'box',
                tag: 'span',
                className: 'text-xs font-semibold',
                children: [entry.author],
              },
              {
                kind: 'box',
                tag: 'span',
                className: 'text-[11px] text-muted-foreground',
                children: [entry.time],
              },
            ],
          },
          {
            kind: 'box',
            className: 'text-sm leading-relaxed text-foreground',
            children: [entry.body],
          },
        ],
      },
    ],
  };
}

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'mx-auto flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-sm',
    children: [
      {
        kind: 'box',
        className: 'border-b border-border px-4 py-3',
        children: [
          { kind: 'box', className: 'text-sm font-semibold', children: ['#release-engineering'] },
          {
            kind: 'box',
            className: 'text-xs text-muted-foreground',
            children: ['Mixed teammate messages and system markers inside one transcript.'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'h-72 w-full',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-message-scroller-root',
            props: { a11yLabel: 'Release channel messages', newContentCount: 2 },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-message-scroller-viewport',
                children: [
                  {
                    kind: 'box',
                    className: 'flex flex-col gap-3 p-4 pb-14',
                    children: ENTRIES.map(renderEntry),
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-message-scroller-jump',
                props: { size: 'pill' },
                children: ['2 new messages ↓'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
