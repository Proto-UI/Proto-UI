import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'brutalist-field-root',
    className: 'flex w-full max-w-sm flex-row items-center justify-between gap-4',
    children: [
      {
        kind: 'box',
        className: 'flex min-w-0 flex-1 flex-col gap-1',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-field-label',
            children: ['Share across devices'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-field-description',
            children: ['Focus is shared across devices, and turns off when you leave the app.'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-field-switch',
        props: { defaultChecked: false },
        children: [{ kind: 'proto', prototypeId: 'brutalist-switch-thumb' }],
      },
    ],
  },
} satisfies DemoSpec;
