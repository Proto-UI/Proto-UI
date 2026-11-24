import type {
  DemoKeyedChild,
  DemoNode,
  DemoSpec,
} from '../../../../components/PrototypePreviewer/demo-types';

type ClassicLog = {
  id: string;
  sender: string;
  text: string;
};

const INITIAL_LOGS: readonly ClassicLog[] = [
  { id: 'bs1', sender: 'Ops', text: 'Deployment window opened at 14:00 UTC.' },
  { id: 'bs2', sender: 'CI', text: 'Artifact checksum verified on build #914.' },
  { id: 'bs3', sender: 'QA', text: 'Regression checklist started on staging.' },
  {
    id: 'bs4',
    sender: 'Ops',
    text: 'Scroll up to inspect earlier lines, then click Append message.',
  },
];

const EXTRA_LOGS: readonly ClassicLog[] = [
  { id: 'bs5', sender: 'CI', text: 'Canary cluster health check passed (4/4 nodes).' },
  { id: 'bs6', sender: 'QA', text: 'Keyboard navigation verified across all controls.' },
  { id: 'bs7', sender: 'Ops', text: 'Traffic shifted to 100% on the new build.' },
];

function toRow(log: ClassicLog): DemoKeyedChild {
  const node: DemoNode = {
    kind: 'box',
    className:
      'flex items-baseline gap-2 border-b border-[var(--pui-border,#cccccc)] px-3 py-2 text-[14px] leading-[20px]',
    children: [
      {
        kind: 'box',
        tag: 'span',
        className: 'shrink-0 font-bold text-[var(--pui-foreground,#333333)]',
        children: [`[${log.sender}]`],
      },
      { kind: 'box', children: [log.text] },
    ],
  };
  return { key: log.id, node };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'mx-auto flex w-full max-w-lg flex-col gap-3',
    children: [
      {
        kind: 'box',
        className: 'h-64 w-full',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-message-scroller-root',
            ref: 'bsRoot',
            props: { newContentCount: 0, a11yLabel: 'Live operations log' },
            children: [
              {
                kind: 'box',
                className:
                  'flex items-center justify-between border-b border-[var(--pui-border,#cccccc)] bg-[var(--pui-secondary,#f5f5f5)] px-3 py-2 text-[var(--pui-secondary-foreground,#333333)]',
                children: [
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'font-bold',
                    children: ['Operations Log'],
                  },
                  {
                    kind: 'box',
                    tag: 'span',
                    ref: 'bsStatus',
                    className: 'text-xs text-[var(--pui-muted-foreground,#666666)]',
                    attrs: { role: 'status', 'aria-live': 'polite' },
                    children: ['4 entries · 0 unread'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-message-scroller-viewport',
                ref: 'bsViewport',
                children: [
                  {
                    kind: 'box',
                    ref: 'bsSlot',
                    className: 'flex flex-col pb-12',
                    dynamicChildren: { prototypeIds: [] },
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-message-scroller-jump',
                ref: 'bsJump',
                children: [
                  {
                    kind: 'box',
                    tag: 'span',
                    ref: 'bsJumpLabel',
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
        className: 'flex items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-button',
            ref: 'bsAppendBtn',
            props: { variant: 'primary' },
            children: ['Append message'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-button',
            ref: 'bsResetBtn',
            children: ['Reset'],
          },
        ],
      },
    ],
  },
  setup({ refs, api }) {
    let logs: ClassicLog[] = [...INITIAL_LOGS];
    let index = 0;
    let unread = 0;

    const sync = () => {
      api.setProps('bsRoot', { newContentCount: unread });
      refs.bsStatus.textContent = `${logs.length} entries · ${unread} unread`;
      refs.bsJumpLabel.textContent = unread > 0 ? `${unread} new ↓` : 'Jump to latest ↓';
      api.setProps('bsAppendBtn', { disabled: index >= EXTRA_LOGS.length });
    };

    const render = () => {
      void api.setChildren?.('bsSlot', logs.map(toRow));
    };

    render();
    sync();

    api.setProps('bsAppendBtn', {
      onClick: () => {
        const next = EXTRA_LOGS[index];
        if (!next) return;
        const exposes = api.getExposes('bsViewport');
        const atEndState = exposes?.atEnd as { get?: () => boolean } | undefined;
        const isAtEnd = typeof atEndState?.get === 'function' ? Boolean(atEndState.get()) : true;
        logs = [...logs, next];
        index += 1;
        if (!isAtEnd) unread += 1;
        render();
        sync();
      },
    });

    api.setProps('bsJump', {
      onClick: () => {
        unread = 0;
        sync();
      },
    });

    api.setProps('bsResetBtn', {
      onClick: () => {
        logs = [...INITIAL_LOGS];
        index = 0;
        unread = 0;
        render();
        sync();
      },
    });
  },
} satisfies DemoSpec;
