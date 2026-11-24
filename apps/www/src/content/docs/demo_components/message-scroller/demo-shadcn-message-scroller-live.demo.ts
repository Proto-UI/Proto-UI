import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type {
  DemoKeyedChild,
  DemoNode,
  DemoSpec,
} from '../../../../components/PrototypePreviewer/demo-types';

type FeedMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

const INITIAL_MESSAGES: readonly FeedMessage[] = [
  {
    id: 'm1',
    role: 'user',
    text: 'Can you summarize what changed in the release branch?',
  },
  {
    id: 'm2',
    role: 'assistant',
    text: 'Three updates landed: scroll viewport framing, accessible live status labels, and keyboard-safe jump recovery.',
  },
  {
    id: 'm3',
    role: 'user',
    text: 'Great — keep streaming the rest of the checklist while I check the earlier summary.',
  },
  {
    id: 'm4',
    role: 'assistant',
    text: 'Sure. Stay at the bottom to auto-follow new messages, or scroll up first to see newContentCount increment without losing your place.',
  },
];

const QUEUED_MESSAGES: readonly FeedMessage[] = [
  {
    id: 'm5',
    role: 'assistant',
    text: '1. Verified end-follow remains active while the viewport is pinned to the bottom edge.',
  },
  {
    id: 'm6',
    role: 'assistant',
    text: '2. Verified wheel and keyboard scroll-up pause auto-follow immediately.',
  },
  {
    id: 'm7',
    role: 'assistant',
    text: '3. Confirmed Jump returns to the latest entry and clears the application unread badge.',
  },
  {
    id: 'm8',
    role: 'assistant',
    text: '4. All adapter builds (Web Components, React, Vue 3, Vue 2) passed clean.',
  },
];

function toKeyedItem(message: FeedMessage): DemoKeyedChild {
  const isUser = message.role === 'user';
  const node: DemoNode = {
    kind: 'box',
    className: isUser ? 'flex justify-end' : 'flex justify-start',
    children: [
      {
        kind: 'box',
        className: isUser
          ? 'max-w-[82%] rounded-2xl bg-muted px-3.5 py-2 text-sm leading-relaxed text-foreground'
          : 'max-w-[86%] rounded-2xl border border-border/70 bg-background px-3.5 py-2 text-sm leading-relaxed text-foreground',
        children: [message.text],
      },
    ],
  };
  return { key: message.id, node };
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
        className: 'flex items-center justify-between gap-2 border-b border-border px-4 py-3',
        children: [
          {
            kind: 'box',
            className: 'flex flex-col gap-0.5',
            children: [
              { kind: 'box', className: 'text-sm font-semibold', children: ['Live Release Feed'] },
              {
                kind: 'box',
                ref: 'liveStatus',
                className: 'text-xs text-muted-foreground',
                attrs: { role: 'status', 'aria-live': 'polite' },
                children: ['4 messages · 0 unread'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            ref: 'resetBtn',
            props: { variant: 'outline', size: 'sm' },
            children: ['Reset'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'h-64 w-full',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-message-scroller-root',
            ref: 'scrollerRoot',
            props: { newContentCount: 0, a11yLabel: 'Live release feed' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-message-scroller-viewport',
                ref: 'scrollerViewport',
                children: [
                  {
                    kind: 'box',
                    ref: 'messagesSlot',
                    className: 'flex flex-col gap-3 p-4 pb-14',
                    dynamicChildren: { prototypeIds: [] },
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-message-scroller-jump',
                ref: 'jumpBtn',
                props: { size: 'pill' },
                children: [
                  {
                    kind: 'box',
                    tag: 'span',
                    ref: 'jumpLabel',
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
        className: 'flex items-center justify-between gap-2 border-t border-border px-4 py-3',
        children: [
          {
            kind: 'box',
            className: 'text-xs text-muted-foreground',
            children: ['Scroll up, then append a reply to see unread tracking.'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            ref: 'appendBtn',
            props: { size: 'sm' },
            children: ['Append reply'],
          },
        ],
      },
    ],
  },
  setup({ refs, api }) {
    let items: FeedMessage[] = [...INITIAL_MESSAGES];
    let nextIndex = 0;
    let unread = 0;

    const syncUi = () => {
      api.setProps('scrollerRoot', { newContentCount: unread });
      refs.liveStatus.textContent = `${items.length} messages · ${unread} unread`;
      refs.jumpLabel.textContent =
        unread > 0
          ? `${unread} new ${unread === 1 ? 'message' : 'messages'} ↓`
          : 'Jump to latest ↓';
      api.setProps('appendBtn', { disabled: nextIndex >= QUEUED_MESSAGES.length });
    };

    const commitList = () => {
      void api.setChildren?.('messagesSlot', items.map(toKeyedItem));
    };

    commitList();
    syncUi();

    api.setProps('appendBtn', {
      onClick: () => {
        const next = QUEUED_MESSAGES[nextIndex];
        if (!next) return;
        const viewportExposes = api.getExposes('scrollerViewport');
        const atEndState = viewportExposes?.atEnd as { get?: () => boolean } | undefined;
        const isAtEnd = typeof atEndState?.get === 'function' ? Boolean(atEndState.get()) : true;
        items = [...items, next];
        nextIndex += 1;
        if (!isAtEnd) unread += 1;
        commitList();
        syncUi();
      },
    });

    api.setProps('jumpBtn', {
      onClick: () => {
        unread = 0;
        syncUi();
      },
    });

    api.setProps('resetBtn', {
      onClick: () => {
        items = [...INITIAL_MESSAGES];
        nextIndex = 0;
        unread = 0;
        commitList();
        syncUi();
      },
    });
  },
} satisfies DemoSpec);
