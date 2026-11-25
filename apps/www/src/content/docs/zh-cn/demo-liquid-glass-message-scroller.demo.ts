import type { DemoNode, DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

type GlassTurn = {
  role: 'user' | 'assistant';
  author: string;
  body: string;
};

const TURNS: readonly GlassTurn[] = [
  {
    role: 'user',
    author: 'You',
    body: 'Why does the transcript frame stay clean and neutral while the Jump control floats above it?',
  },
  {
    role: 'assistant',
    author: 'Design Assistant',
    body: 'Apple HIG separates scrolling content surfaces from floating navigation controls so messages retain high contrast and never stack translucent surfaces on top of each other.',
  },
  {
    role: 'user',
    author: 'You',
    body: 'And how do the container corners align?',
  },
  {
    role: 'assistant',
    author: 'Design Assistant',
    body: 'Root uses a rounded-2xl frame with 4px inset padding around a concentric rounded-xl Viewport, while the floating Jump pill uses a full capsule silhouette.',
  },
  {
    role: 'user',
    author: 'You',
    body: 'How should unread messages be highlighted when a reader is scrolled up?',
  },
  {
    role: 'assistant',
    author: 'Design Assistant',
    body: 'Switch Jump from variant="regular" to variant="prominent" so the floating capsule shifts to the primary accent pair without losing legibility.',
  },
  {
    role: 'user',
    author: 'You',
    body: 'Does scrolling up pause automatic bottom-following?',
  },
  {
    role: 'assistant',
    author: 'Design Assistant',
    body: 'Yes. Scroll back up through the thread — messages glide smoothly beneath the floating capsule until you tap Jump to latest.',
  },
];

function renderTurn(turn: GlassTurn): DemoNode {
  const isUser = turn.role === 'user';
  return {
    kind: 'box',
    className: isUser ? 'flex flex-col items-end gap-1' : 'flex flex-col items-start gap-1',
    children: [
      {
        kind: 'box',
        className: 'px-1 text-[11px] text-[var(--pui-muted-foreground,#626267)]',
        children: [turn.author],
      },
      {
        kind: 'box',
        className: isUser
          ? 'max-w-[82%] rounded-2xl bg-[var(--pui-primary,#0061cc)] px-3.5 py-2 text-sm leading-relaxed text-[var(--pui-primary-foreground,#ffffff)]'
          : 'max-w-[86%] rounded-2xl bg-[var(--pui-secondary,#ffffff)] px-3.5 py-2 text-sm leading-relaxed text-[var(--pui-secondary-foreground,#1d1d1f)] shadow-xs',
        children: [turn.body],
      },
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'mx-auto w-full max-w-lg',
    children: [
      {
        kind: 'box',
        className: 'h-80 w-full',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-message-scroller-root',
            props: { a11yLabel: 'Design conversation' },
            children: [
              {
                kind: 'box',
                className:
                  'flex items-center justify-between border-b border-[var(--pui-border,#c7c7cc)] px-4 py-2.5',
                children: [
                  {
                    kind: 'box',
                    className: 'text-sm font-semibold',
                    children: ['Messages'],
                  },
                  {
                    kind: 'box',
                    className: 'text-xs text-[var(--pui-muted-foreground,#626267)]',
                    children: ['Floating capsule control'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-message-scroller-viewport',
                children: [
                  {
                    kind: 'box',
                    className: 'flex flex-col gap-3 p-4 pb-16',
                    children: TURNS.map(renderTurn),
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-message-scroller-jump',
                children: ['Jump to latest ↓'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
