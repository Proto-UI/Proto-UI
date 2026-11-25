import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center justify-center gap-4',
    children: [
      { kind: 'proto', prototypeId: 'liquid-glass-button', children: ['Cancel'] },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-button',
        props: { variant: 'prominent' },
        children: ['Continue'],
      },
    ],
  },
} satisfies DemoSpec;
