import type { DemoNode, DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

type BrutalistTurn = {
  role: 'user' | 'assistant';
  initials: string;
  body: string;
};

const TURNS: readonly BrutalistTurn[] = [
  { role: 'user', initials: 'BF', body: 'Deploying to prod real quick.' },
  { role: 'assistant', initials: 'NK', body: "It's 4:55 PM. On a Friday." },
  { role: 'user', initials: 'BF', body: 'Ship it.' },
  { role: 'assistant', initials: 'NK', body: 'Did the registry build go through?' },
  { role: 'user', initials: 'BF', body: 'Yes, one stale route showed up though.' },
  { role: 'assistant', initials: 'NK', body: 'Which one?' },
  { role: 'user', initials: 'BF', body: 'The old toast page, still in the sidebar.' },
  { role: 'assistant', initials: 'NK', body: 'Remove it and rebuild.' },
  { role: 'user', initials: 'BF', body: 'Done. Lint and typecheck are clean.' },
  { role: 'assistant', initials: 'NK', body: 'Scrolling looks solid on long threads?' },
  { role: 'user', initials: 'BF', body: 'Yes — pauses when you scroll up, snaps back on Jump.' },
  { role: 'assistant', initials: 'NK', body: 'Perfect, that is exactly what I had in mind.' },
];

function renderTurn(turn: BrutalistTurn): DemoNode {
  const isUser = turn.role === 'user';
  return {
    kind: 'box',
    className: isUser ? 'flex items-end justify-end gap-2' : 'flex items-end justify-start gap-2',
    children: isUser
      ? [
          {
            kind: 'box',
            className:
              'max-w-[78%] rounded-[5px] border-2 border-black bg-[var(--pui-main,#5294ff)] px-3 py-2 text-sm font-medium text-black',
            children: [turn.body],
          },
          {
            kind: 'box',
            className:
              'flex size-7 shrink-0 items-center justify-center rounded-[5px] border-2 border-black bg-[var(--pui-canary,#FACC00)] text-xs font-bold text-black',
            children: [turn.initials],
          },
        ]
      : [
          {
            kind: 'box',
            className:
              'flex size-7 shrink-0 items-center justify-center rounded-[5px] border-2 border-black bg-[var(--pui-background,#dcebfe)] text-xs font-bold text-black',
            children: [turn.initials],
          },
          {
            kind: 'box',
            className:
              'max-w-[78%] rounded-[5px] border-2 border-black bg-[var(--pui-background,#dcebfe)] px-3 py-2 text-sm font-medium text-[var(--pui-foreground,#000)]',
            children: [turn.body],
          },
        ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'mx-auto h-96 w-full max-w-md',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-message-scroller-root',
        props: { a11yLabel: 'Team chat messages' },
        children: [
          {
            kind: 'box',
            className: 'border-b-2 border-black bg-[var(--pui-main,#5294ff)] px-4 py-3 text-black',
            children: [
              { kind: 'box', className: 'text-sm font-bold', children: ['New Chat'] },
              {
                kind: 'box',
                className: 'text-xs font-medium',
                children: ['How can I help you today?'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-message-scroller-viewport',
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
            prototypeId: 'brutalist-message-scroller-jump',
            children: ['Scroll to end ↓'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
