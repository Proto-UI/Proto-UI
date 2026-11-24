import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-8 liquid-functional-demo',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle',
            props: { disabled: true },
            children: ['Disabled'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle',
            props: { disabled: true, defaultActive: true },
            children: ['Active Disabled'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
