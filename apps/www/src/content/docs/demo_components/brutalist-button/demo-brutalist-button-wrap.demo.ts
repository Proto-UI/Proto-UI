import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-52 flex-col items-start gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        props: { wrap: true },
        children: ['Publish changes and update workspace settings'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        props: { variant: 'surface', size: 'sm', wrap: true },
        children: ['Review pending notifications'],
      },
    ],
  },
} satisfies DemoSpec;
