import type {
  DemoKeyedChild,
  DemoNode,
  DemoSpec,
} from '../../../../components/PrototypePreviewer/demo-types';

type BrutalistMessage = {
  id: string;
  initials: string;
  role: 'user' | 'assistant';
  text: string;
};

const INITIAL: readonly BrutalistMessage[] = [
  { id: 'b1', initials: 'BF', role: 'user', text: 'Hey, are you around?' },
  { id: 'b2', initials: 'NK', role: 'assistant', text: 'Yes, what is up?' },
  {
    id: 'b3',
    initials: 'BF',
    role: 'user',
    text: 'I need a review on the message scroller.',
  },
];

const EXTRA: readonly BrutalistMessage[] = [
  {
    id: 'b4',
    initials: 'NK',
    role: 'assistant',
    text: 'Checking it now — love the 4px hard shadow on the floating Jump button.',
  },
  {
    id: 'b5',
    initials: 'BF',
    role: 'user',
    text: 'Try scrolling up and clicking Add message again.',
  },
  {
    id: 'b6',
    initials: 'NK',
    role: 'assistant',
    text: 'Position stayed put and the unread counter bumped cleanly. LGTM!',
  },
];

function toItem(msg: BrutalistMessage): DemoKeyedChild {
  const isUser = msg.role === 'user';
  const node: DemoNode = {
    kind: 'box',
    className: isUser ? 'flex items-end justify-end gap-2' : 'flex items-end justify-start gap-2',
    children: [
      {
        kind: 'box',
        className: isUser
          ? 'max-w-[78%] rounded-[5px] border-2 border-black bg-[var(--pui-main,#5294ff)] px-3 py-2 text-sm font-medium text-black'
          : 'max-w-[78%] rounded-[5px] border-2 border-black bg-[var(--pui-background,#dcebfe)] px-3 py-2 text-sm font-medium text-[var(--pui-foreground,#000)]',
        children: [msg.text],
      },
    ],
  };
  return { key: msg.id, node };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'mx-auto flex w-full max-w-md flex-col gap-3',
    children: [
      {
        kind: 'box',
        className: 'h-72 w-full',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-message-scroller-root',
            ref: 'brutalistRoot',
            props: { newContentCount: 0, a11yLabel: 'Add messages demo' },
            children: [
              {
                kind: 'box',
                className:
                  'flex items-center justify-between border-b-2 border-black bg-[var(--pui-main,#5294ff)] px-4 py-2.5 text-black',
                children: [
                  { kind: 'box', className: 'text-sm font-bold', children: ['New Chat'] },
                  {
                    kind: 'box',
                    ref: 'brutalistStatus',
                    className: 'text-xs font-bold',
                    attrs: { role: 'status', 'aria-live': 'polite' },
                    children: ['3 messages · 0 unread'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-message-scroller-viewport',
                ref: 'brutalistViewport',
                children: [
                  {
                    kind: 'box',
                    ref: 'brutalistMessagesSlot',
                    className: 'flex flex-col gap-3 p-4 pb-16',
                    dynamicChildren: { prototypeIds: [] },
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-message-scroller-jump',
                ref: 'brutalistJump',
                children: [
                  {
                    kind: 'box',
                    tag: 'span',
                    ref: 'brutalistJumpLabel',
                    children: ['Scroll to end ↓'],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex items-center justify-between gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-button',
            ref: 'brutalistAddBtn',
            children: ['Add message'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-button',
            ref: 'brutalistResetBtn',
            props: { variant: 'neutral' },
            children: ['Reset'],
          },
        ],
      },
    ],
  },
  setup({ refs, api }) {
    let items: BrutalistMessage[] = [...INITIAL];
    let index = 0;
    let unread = 0;

    const sync = () => {
      api.setProps('brutalistRoot', { newContentCount: unread });
      refs.brutalistStatus.textContent = `${items.length} messages · ${unread} unread`;
      refs.brutalistJumpLabel.textContent = unread > 0 ? `${unread} new ↓` : 'Scroll to end ↓';
      api.setProps('brutalistAddBtn', { disabled: index >= EXTRA.length });
    };

    const render = () => {
      void api.setChildren?.('brutalistMessagesSlot', items.map(toItem));
    };

    render();
    sync();

    api.setProps('brutalistAddBtn', {
      onClick: () => {
        const next = EXTRA[index];
        if (!next) return;
        const exposes = api.getExposes('brutalistViewport');
        const atEndState = exposes?.atEnd as { get?: () => boolean } | undefined;
        const isAtEnd = typeof atEndState?.get === 'function' ? Boolean(atEndState.get()) : true;
        items = [...items, next];
        index += 1;
        if (!isAtEnd) unread += 1;
        render();
        sync();
      },
    });

    api.setProps('brutalistJump', {
      onClick: () => {
        unread = 0;
        sync();
      },
    });

    api.setProps('brutalistResetBtn', {
      onClick: () => {
        items = [...INITIAL];
        index = 0;
        unread = 0;
        render();
        sync();
      },
    });
  },
} satisfies DemoSpec;
