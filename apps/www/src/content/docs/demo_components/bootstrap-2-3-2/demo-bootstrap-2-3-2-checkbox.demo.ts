import type { DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';

function checkboxRow(
  label: string,
  props: Record<string, unknown>,
  description?: string
): DemoNode {
  return {
    kind: 'box',
    className: 'flex items-start gap-2.5',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-checkbox-root',
        props,
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-checkbox-indicator',
          },
          { kind: 'box', className: 'sr-only', children: [label] },
        ],
      },
      {
        kind: 'box',
        className: 'grid gap-0.5 leading-snug',
        children: [
          {
            kind: 'box',
            className: 'text-sm',
            children: [label],
          },
          ...(description
            ? [
                {
                  kind: 'box' as const,
                  className: 'text-xs text-muted-foreground',
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
    className: 'flex w-full max-w-sm flex-col gap-3.5',
    children: [
      checkboxRow('Accept terms and conditions', { defaultChecked: false }),
      checkboxRow(
        'Subscribe to release notes',
        { defaultChecked: true },
        'By checking this box, you agree to receive release summaries.'
      ),
      checkboxRow(
        'Select all notification channels',
        { defaultIndeterminate: true },
        'Email is active; digest alerts are currently unchecked.'
      ),
      checkboxRow('Enable notifications', { disabled: true, defaultChecked: true }),
    ],
  },
} satisfies DemoSpec;
