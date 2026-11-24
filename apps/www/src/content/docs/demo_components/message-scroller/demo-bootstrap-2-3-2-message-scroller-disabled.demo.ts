import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const ROWS = [
  '14:01 · Worker pool scaled to 6 instances',
  '14:03 · Cache warmup completed in 1.8s',
  '14:05 · TLS certificate verified for edge proxy',
  '14:07 · Health check passed on eu-west-1',
  '14:09 · Health check passed on us-east-1',
  '14:11 · Metrics export resumed normally',
];

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'mx-auto flex w-full max-w-lg flex-col gap-3',
    children: [
      {
        kind: 'box',
        className: 'h-56 w-full',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-message-scroller-root',
            props: { a11yLabel: 'Audit log', newContentCount: 3 },
            children: [
              {
                kind: 'box',
                className:
                  'flex items-center justify-between border-b border-[var(--pui-border,#cccccc)] bg-[var(--pui-secondary,#f5f5f5)] px-3 py-2 text-[var(--pui-secondary-foreground,#333333)]',
                children: [
                  { kind: 'box', tag: 'span', className: 'font-bold', children: ['Audit Log'] },
                  {
                    kind: 'box',
                    tag: 'span',
                    ref: 'bsDisabledStatus',
                    className: 'text-xs text-[var(--pui-muted-foreground,#666666)]',
                    attrs: { role: 'status', 'aria-live': 'polite' },
                    children: ['Jump disabled'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-message-scroller-viewport',
                children: [
                  {
                    kind: 'box',
                    className: 'flex flex-col pb-12',
                    children: ROWS.map((row) => ({
                      kind: 'box' as const,
                      className:
                        'border-b border-[var(--pui-border,#cccccc)] px-3 py-2 text-[14px] leading-[20px]',
                      children: [row],
                    })),
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-message-scroller-jump',
                ref: 'bsDisabledJump',
                props: { disabled: true },
                children: ['3 new entries ↓'],
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
            ref: 'bsToggleDisabledBtn',
            children: ['Enable Jump'],
          },
        ],
      },
    ],
  },
  setup({ refs, api }) {
    let disabled = true;
    api.setProps('bsToggleDisabledBtn', {
      onClick: () => {
        disabled = !disabled;
        api.setProps('bsDisabledJump', { disabled });
        refs.bsDisabledStatus.textContent = disabled ? 'Jump disabled' : 'Jump enabled';
        refs.bsToggleDisabledBtn.textContent = disabled ? 'Enable Jump' : 'Disable Jump';
      },
    });
  },
} satisfies DemoSpec;
