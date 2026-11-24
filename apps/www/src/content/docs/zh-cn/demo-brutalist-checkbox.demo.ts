import type { DemoNode, DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

function checkboxRow({
  ref,
  label,
  description,
  props,
  card = false,
}: {
  ref: string;
  label: string;
  description?: string;
  props: Record<string, unknown>;
  card?: boolean;
}): DemoNode {
  return {
    kind: 'box',
    className: card
      ? 'flex items-start gap-3 rounded-base border-2 border-border bg-secondary-background p-3 shadow-[4px_4px_0_0_#000]'
      : 'flex items-start gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-checkbox-root',
        ref,
        props,
        children: [
          { kind: 'proto', prototypeId: 'brutalist-checkbox-indicator' },
          { kind: 'box', className: 'sr-only', children: [label] },
        ],
      },
      {
        kind: 'box',
        className: 'grid gap-1 leading-snug',
        children: [
          {
            kind: 'box',
            className: 'font-sans text-sm font-medium',
            children: [label],
          },
          ...(description
            ? [
                {
                  kind: 'box' as const,
                  className: 'font-sans text-xs font-medium opacity-75',
                  children: [description],
                },
              ]
            : []),
        ],
      },
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-sm flex-col gap-4',
    children: [
      checkboxRow({
        ref: 'termsCheckbox',
        label: 'Accept terms and conditions',
        props: { defaultChecked: false },
      }),
      checkboxRow({
        ref: 'updatesCheckbox',
        label: 'Subscribe to release updates',
        description: 'Receive concise monthly summaries of new primitives.',
        props: { defaultChecked: true },
      }),
      checkboxRow({
        ref: 'channelsCheckbox',
        label: 'Select all notification channels',
        description: 'Email is enabled; push alerts are paused.',
        props: { defaultIndeterminate: true },
      }),
      checkboxRow({
        ref: 'disabledCheckbox',
        label: 'Enable notifications',
        props: { disabled: true, defaultChecked: true },
      }),
      checkboxRow({
        ref: 'cardCheckbox',
        label: 'Enable desktop alerts',
        description: 'You can enable or disable alerts at any time.',
        props: { defaultChecked: true },
        card: true,
      }),
    ],
  },
} satisfies DemoSpec;
