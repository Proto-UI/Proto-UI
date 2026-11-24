import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const LOG_ROWS = [
  '09:00 · Connected to support session #4821',
  '09:01 · Customer: Need help migrating our webhook signing secret.',
  '09:02 · Agent: Sure — rotate the secondary secret first so active deliveries stay valid.',
  '09:04 · Customer: Done, both secrets are listed in the dashboard.',
  '09:05 · Agent: Next, deploy the updated environment variable and watch the delivery log.',
  '09:07 · Customer: Seeing 200 OK responses on the new key now.',
  '09:08 · Agent: Great! You can revoke the previous secret whenever ready.',
  '09:10 · Session marked resolved.',
];

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
              { kind: 'box', className: 'text-sm font-semibold', children: ['Jump Control State'] },
              {
                kind: 'box',
                ref: 'stateLabel',
                className: 'text-xs text-muted-foreground',
                attrs: { role: 'status', 'aria-live': 'polite' },
                children: ['Jump disabled (manual scrolling still works)'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            ref: 'toggleDisabledBtn',
            props: { variant: 'outline', size: 'sm' },
            children: ['Enable Jump'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'h-56 w-full',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-message-scroller-root',
            props: { a11yLabel: 'Support transcript', newContentCount: 3 },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-message-scroller-viewport',
                children: [
                  {
                    kind: 'box',
                    className: 'flex flex-col gap-2.5 p-4 pb-14 text-sm',
                    children: LOG_ROWS.map((row) => ({
                      kind: 'box' as const,
                      className: 'rounded-lg border border-border/60 bg-muted/40 px-3 py-2',
                      children: [row],
                    })),
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-message-scroller-jump',
                ref: 'stateJumpBtn',
                props: { size: 'pill', disabled: true },
                children: ['Jump to latest ↓'],
              },
            ],
          },
        ],
      },
    ],
  },
  setup({ refs, api }) {
    let disabled = true;
    api.setProps('toggleDisabledBtn', {
      onClick: () => {
        disabled = !disabled;
        api.setProps('stateJumpBtn', { disabled });
        refs.stateLabel.textContent = disabled
          ? 'Jump disabled (manual scrolling still works)'
          : 'Jump enabled (click to scroll to bottom)';
        refs.toggleDisabledBtn.textContent = disabled ? 'Enable Jump' : 'Disable Jump';
      },
    });
  },
} satisfies DemoSpec);
