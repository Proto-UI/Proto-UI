import type {
  DemoKeyedChild,
  DemoNode,
  DemoSpec,
} from '../../../../components/PrototypePreviewer/demo-types';

type GlassMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

const INITIAL: readonly GlassMessage[] = [
  {
    id: 'lg1',
    role: 'user',
    text: 'Can the floating Jump pill highlight when new messages arrive?',
  },
  {
    id: 'lg2',
    role: 'assistant',
    text: 'Yes. Keep variant="regular" while caught up, and switch to variant="prominent" when unread messages arrive while scrolled up.',
  },
  { id: 'lg3', role: 'user', text: 'Let me scroll up and test that right now.' },
  {
    id: 'lg4',
    role: 'assistant',
    text: 'Scroll up slightly, then tap Send reply below to promote the floating capsule.',
  },
];

const QUEUED: readonly GlassMessage[] = [
  {
    id: 'lg5',
    role: 'assistant',
    text: 'New reply 1: Jump switched to prominent accent styling because newContentCount > 0.',
  },
  {
    id: 'lg6',
    role: 'assistant',
    text: 'New reply 2: Tap the floating capsule to jump back to the bottom and return to regular prominence.',
  },
  {
    id: 'lg7',
    role: 'assistant',
    text: 'New reply 3: Caught up — end-follow is active again.',
  },
];

function toItem(msg: GlassMessage): DemoKeyedChild {
  const isUser = msg.role === 'user';
  const node: DemoNode = {
    kind: 'box',
    className: isUser ? 'flex justify-end' : 'flex justify-start',
    children: [
      {
        kind: 'box',
        className: isUser
          ? 'max-w-[82%] rounded-2xl bg-[var(--pui-primary,#0061cc)] px-3.5 py-2 text-sm leading-relaxed text-[var(--pui-primary-foreground,#ffffff)]'
          : 'max-w-[86%] rounded-2xl bg-[var(--pui-secondary,#ffffff)] px-3.5 py-2 text-sm leading-relaxed text-[var(--pui-secondary-foreground,#1d1d1f)] shadow-xs',
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
    className:
      'mx-auto flex w-full max-w-lg flex-col gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'box',
        className: 'h-72 w-full',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-message-scroller-root',
            ref: 'lgLiveRoot',
            props: { newContentCount: 0, a11yLabel: 'Live messages' },
            children: [
              {
                kind: 'box',
                className:
                  'flex items-center justify-between border-b border-[var(--pui-border,#c7c7cc)] px-4 py-2.5',
                children: [
                  {
                    kind: 'box',
                    className: 'text-sm font-semibold',
                    children: ['Live Prominence'],
                  },
                  {
                    kind: 'box',
                    ref: 'lgLiveStatus',
                    className: 'text-xs text-[var(--pui-muted-foreground,#626267)]',
                    attrs: { role: 'status', 'aria-live': 'polite' },
                    children: ['4 messages · regular'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-message-scroller-viewport',
                ref: 'lgLiveViewport',
                children: [
                  {
                    kind: 'box',
                    ref: 'lgLiveSlot',
                    className: 'flex flex-col gap-3 p-4 pb-16',
                    dynamicChildren: { prototypeIds: [] },
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-message-scroller-jump',
                ref: 'lgLiveJump',
                props: { variant: 'regular' },
                children: [
                  {
                    kind: 'box',
                    tag: 'span',
                    ref: 'lgLiveJumpLabel',
                    children: ['Jump to latest ↓'],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-button',
            ref: 'lgSendBtn',
            props: { variant: 'prominent' },
            children: ['Send reply'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-button',
            ref: 'lgResetBtn',
            props: { variant: 'regular' },
            children: ['Reset'],
          },
        ],
      },
    ],
  },
  setup({ refs, api }) {
    let items: GlassMessage[] = [...INITIAL];
    let index = 0;
    let unread = 0;

    const sync = () => {
      const variant = unread > 0 ? 'prominent' : 'regular';
      api.setProps('lgLiveRoot', { newContentCount: unread });
      api.setProps('lgLiveJump', { variant });
      refs.lgLiveStatus.textContent = `${items.length} messages · ${variant}`;
      refs.lgLiveJumpLabel.textContent =
        unread > 0
          ? `${unread} new ${unread === 1 ? 'message' : 'messages'} ↓`
          : 'Jump to latest ↓';
      api.setProps('lgSendBtn', { disabled: index >= QUEUED.length });
    };

    const render = () => {
      void api.setChildren?.('lgLiveSlot', items.map(toItem));
    };

    render();
    sync();

    api.setProps('lgSendBtn', {
      onClick: () => {
        const next = QUEUED[index];
        if (!next) return;
        const exposes = api.getExposes('lgLiveViewport');
        const atEndState = exposes?.atEnd as { get?: () => boolean } | undefined;
        const isAtEnd = typeof atEndState?.get === 'function' ? Boolean(atEndState.get()) : true;
        items = [...items, next];
        index += 1;
        if (!isAtEnd) unread += 1;
        render();
        sync();
      },
    });

    api.setProps('lgLiveJump', {
      onClick: () => {
        unread = 0;
        sync();
      },
    });

    api.setProps('lgResetBtn', {
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
