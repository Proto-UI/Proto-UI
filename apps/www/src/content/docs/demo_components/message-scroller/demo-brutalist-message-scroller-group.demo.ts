import type { DemoNode, DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

type FeedRow =
  | { kind: 'marker'; label: string }
  | { kind: 'post'; tag: string; author: string; text: string };

const ROWS: readonly FeedRow[] = [
  { kind: 'marker', label: 'BUILD LOG · #release-v3' },
  {
    kind: 'post',
    tag: 'CI',
    author: 'Build Bot',
    text: 'Compiled 4 adapter targets with zero type warnings.',
  },
  {
    kind: 'post',
    tag: 'QA',
    author: 'Sam',
    text: 'Verified 2px borders and square viewport corners inside the rounded frame.',
  },
  { kind: 'marker', label: 'MARCUS JOINED THE FEED' },
  {
    kind: 'post',
    tag: 'DX',
    author: 'Marcus',
    text: 'Jump button now settles +4px into its black shadow cleanly on press.',
  },
  {
    kind: 'post',
    tag: 'OPS',
    author: 'Nadia',
    text: 'Ready to promote release notes and close the checklist.',
  },
];

function renderRow(row: FeedRow): DemoNode {
  if (row.kind === 'marker') {
    return {
      kind: 'box',
      className:
        'rounded-[5px] border-2 border-black bg-[var(--pui-canary,#FACC00)] px-2.5 py-1 text-center text-xs font-bold text-black',
      children: [row.label],
    };
  }
  return {
    kind: 'box',
    className:
      'flex items-start gap-2.5 rounded-[5px] border-2 border-black bg-[var(--pui-background,#dcebfe)] p-2.5 text-[var(--pui-foreground,#000)]',
    children: [
      {
        kind: 'box',
        className:
          'rounded-[3px] border-2 border-black bg-[var(--pui-mint,#05E17A)] px-1.5 py-0.5 text-[11px] font-bold text-black',
        children: [row.tag],
      },
      {
        kind: 'box',
        className: 'flex min-w-0 flex-1 flex-col gap-0.5',
        children: [
          { kind: 'box', className: 'text-xs font-bold', children: [row.author] },
          { kind: 'box', className: 'text-sm leading-snug', children: [row.text] },
        ],
      },
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'mx-auto h-72 w-full max-w-md',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-message-scroller-root',
        props: { a11yLabel: 'Release log', newContentCount: 2 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-message-scroller-viewport',
            children: [
              {
                kind: 'box',
                className: 'flex flex-col gap-2.5 p-4 pb-16',
                children: ROWS.map(renderRow),
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-message-scroller-jump',
            children: ['2 new entries ↓'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
