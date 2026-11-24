import type { DemoNode, DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

type ClassicMessage = {
  sender: string;
  time: string;
  text: string;
};

const MESSAGES: readonly ClassicMessage[] = [
  {
    sender: 'Alice',
    time: '09:10',
    text: 'Database migration 042 finished on staging without locking the orders table.',
  },
  {
    sender: 'Bob',
    time: '09:12',
    text: 'Verified the read replicas caught up within two seconds.',
  },
  {
    sender: 'Carol',
    time: '09:14',
    text: 'Running the smoke test suite against the billing endpoints now.',
  },
  {
    sender: 'Alice',
    time: '09:15',
    text: 'Remember to scroll back up if you need the checksum from the earlier deploy note.',
  },
  {
    sender: 'Bob',
    time: '09:17',
    text: 'Auto-follow paused right where I left off while checking the earlier status line.',
  },
  {
    sender: 'Carol',
    time: '09:19',
    text: 'All 18 billing checks returned HTTP 200. Logs look quiet.',
  },
  {
    sender: 'Dave',
    time: '09:21',
    text: 'Static assets and stylesheet bundles are mirrored to the CDN edge nodes.',
  },
  {
    sender: 'Alice',
    time: '09:23',
    text: 'Great work team — click Jump to latest anytime to return to the bottom of the feed.',
  },
];

function renderRow(msg: ClassicMessage, isLast: boolean): DemoNode {
  return {
    kind: 'box',
    className: isLast
      ? 'flex flex-col gap-0.5 px-3 py-2.5'
      : 'flex flex-col gap-0.5 border-b border-[var(--pui-border,#cccccc)] px-3 py-2.5',
    children: [
      {
        kind: 'box',
        className: 'flex items-baseline justify-between gap-2',
        children: [
          { kind: 'box', tag: 'span', className: 'font-bold', children: [msg.sender] },
          {
            kind: 'box',
            tag: 'span',
            className: 'text-xs text-[var(--pui-muted-foreground,#666666)]',
            children: [msg.time],
          },
        ],
      },
      { kind: 'box', children: [msg.text] },
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'mx-auto h-72 w-full max-w-lg',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-message-scroller-root',
        props: { a11yLabel: 'Release room messages' },
        children: [
          {
            kind: 'box',
            className:
              'border-b border-[var(--pui-border,#cccccc)] bg-[var(--pui-secondary,#f5f5f5)] px-3 py-2 font-bold text-[var(--pui-secondary-foreground,#333333)]',
            children: ['Release Room — Activity Stream'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-message-scroller-viewport',
            children: [
              {
                kind: 'box',
                className: 'flex flex-col pb-12',
                children: MESSAGES.map((m, i) => renderRow(m, i === MESSAGES.length - 1)),
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-message-scroller-jump',
            children: ['Jump to latest ↓'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
