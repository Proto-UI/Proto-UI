import type { DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const row = (variant: string, label: string, value: number): DemoNode => ({
  kind: 'proto',
  prototypeId: 'bootstrap-2-3-2-progress-root',
  props: { variant, value, min: 0, max: 100, valueText: `${value}%` },
  children: [
    { kind: 'proto', prototypeId: 'bootstrap-2-3-2-progress-label', children: [label] },
    { kind: 'proto', prototypeId: 'bootstrap-2-3-2-progress-value' },
    {
      kind: 'proto',
      prototypeId: 'bootstrap-2-3-2-progress-track',
      children: [{ kind: 'proto', prototypeId: 'bootstrap-2-3-2-progress-indicator' }],
    },
  ],
});

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full min-w-0 items-center justify-center p-6',
    children: [
      {
        kind: 'box',
        className: 'w-full max-w-md min-w-0',
        children: [
          row('default', 'Default', 40),
          row('info', 'Info', 20),
          row('success', 'Success', 60),
          row('warning', 'Warning', 80),
          row('danger', 'Danger', 90),
        ],
      },
    ],
  },
} satisfies DemoSpec;
