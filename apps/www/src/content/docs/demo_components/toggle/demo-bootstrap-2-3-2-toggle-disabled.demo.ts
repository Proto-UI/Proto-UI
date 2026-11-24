import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-toggle',
        props: { disabled: true },
        children: ['Disabled'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-toggle',
        props: { disabled: true, defaultActive: true },
        children: ['Active Disabled'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-toggle',
        props: { variant: 'primary', disabled: true },
        children: ['Primary Disabled'],
      },
    ],
  },
} satisfies DemoSpec;
