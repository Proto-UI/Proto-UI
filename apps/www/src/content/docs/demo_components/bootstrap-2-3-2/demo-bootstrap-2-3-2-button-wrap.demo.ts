import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-48 flex-col items-start gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-button',
        props: { variant: 'primary', wrap: true },
        children: ['Save changes and return to the project dashboard'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-button',
        props: { size: 'small', wrap: true },
        children: ['Download archived release notes'],
      },
    ],
  },
} satisfies DemoSpec;
