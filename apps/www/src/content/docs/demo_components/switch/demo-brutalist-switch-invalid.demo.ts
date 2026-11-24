import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'brutalist-field-root',
    props: { invalid: true },
    className: 'flex w-full max-w-sm flex-row items-center justify-between gap-4',
    children: [
      {
        kind: 'box',
        className: 'flex min-w-0 flex-1 flex-col gap-1',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-field-label',
            children: ['Accept terms and conditions'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-field-description',
            children: ['You must accept the terms and conditions to continue.'],
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
