import { withShadcnRheaDemo } from '../shadcn-demo-style';
import type { DemoNode, DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

type ChatTurn = {
  role: 'user' | 'assistant';
  author: string;
  time: string;
  body: string;
};

const TURNS: readonly ChatTurn[] = [
  {
    role: 'user',
    author: 'You',
    time: '09:14',
    body: 'Every time our AI assistant streams a long reply, the whole thread jumps around while I am reading earlier context.',
  },
  {
    role: 'assistant',
    author: 'Assistant',
    time: '09:14',
    body: 'Message Scroller keeps end-following scoped to readers who are already at the bottom. As soon as you scroll up to review an earlier answer, auto-follow pauses and preserves your reading position.',
  },
  {
    role: 'user',
    author: 'You',
    time: '09:15',
    body: 'What happens if more replies arrive while I am scrolled up inspecting code or earlier notes?',
  },
  {
    role: 'assistant',
    author: 'Assistant',
    time: '09:15',
    body: 'New items append quietly below the viewport without pulling you down. Pass your application newContentCount to Root and let the reader return when ready.',
  },
  {
    role: 'user',
    author: 'You',
    time: '09:16',
    body: 'When I click the floating jump button, does it steal keyboard focus from the composer?',
  },
  {
    role: 'assistant',
    author: 'Assistant',
    time: '09:16',
    body: 'No. Activating Jump scrolls the viewport back to the latest message and resumes end-follow without moving focus away from your current control.',
  },
  {
    role: 'user',
    author: 'You',
    time: '09:17',
    body: 'How should we size the container inside a chat layout?',
  },
  {
    role: 'assistant',
    author: 'Assistant',
    time: '09:17',
    body: 'Place Message Scroller inside a height-constrained parent such as a flex column or fixed-height card body so Root fills the available space and Viewport owns vertical scrolling.',
  },
  {
    role: 'user',
    author: 'You',
    time: '09:18',
    body: 'Can we also restore reading position when reopening a long saved transcript?',
  },
  {
    role: 'assistant',
    author: 'Assistant',
    time: '09:18',
    body: 'Yes — compose the public Base asMessageScrollerReading hook after the Shadcn Viewport to capture stable-key anchors and restore both scroll offset and text selection.',
  },
];

function renderTurn(turn: ChatTurn): DemoNode {
  const isUser = turn.role === 'user';
  return {
    kind: 'box',
    className: isUser ? 'flex flex-col items-end gap-1' : 'flex flex-col items-start gap-1',
    children: [
      {
        kind: 'box',
        className: 'flex items-center gap-2 px-1 text-[11px] text-muted-foreground',
        children: [`${turn.author} · ${turn.time}`],
      },
      {
        kind: 'box',
        className: isUser
          ? 'max-w-[82%] rounded-2xl bg-muted px-3.5 py-2 text-sm leading-relaxed text-foreground'
          : 'max-w-[88%] rounded-2xl border border-border/70 bg-background px-3.5 py-2 text-sm leading-relaxed text-foreground',
        children: [turn.body],
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
        className: 'flex items-center justify-between border-b border-border px-4 py-3',
        children: [
          {
            kind: 'box',
            className: 'flex flex-col gap-0.5',
            children: [
              { kind: 'box', className: 'text-sm font-semibold', children: ['Assistant Thread'] },
              {
                kind: 'box',
                className: 'text-xs text-muted-foreground',
                children: ['Scroll up to pause auto-follow, then jump back to the latest reply.'],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'h-80 w-full',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-message-scroller-root',
            props: { a11yLabel: 'Assistant conversation' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-message-scroller-viewport',
                children: [
                  {
                    kind: 'box',
                    className: 'flex flex-col gap-3 p-4 pb-14',
                    children: TURNS.map(renderTurn),
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-message-scroller-jump',
                children: [
                  {
                    kind: 'box',
                    tag: 'span',
                    attrs: { 'aria-hidden': 'true' },
                    children: ['↓'],
                  },
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'sr-only',
                    children: ['Jump to latest'],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
