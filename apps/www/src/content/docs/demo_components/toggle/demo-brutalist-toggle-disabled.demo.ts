import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-toggle',
        props: { disabled: true },
        children: ['Disabled'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-toggle',
        props: { variant: 'outline', disabled: true },
        children: ['Disabled'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-toggle',
        props: { disabled: true, defaultActive: true },
        children: ['Active Disabled'],
      },
    ],
  },
} satisfies DemoSpec;
