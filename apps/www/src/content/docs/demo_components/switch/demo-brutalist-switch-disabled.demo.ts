import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-col gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-field-root',
        props: { disabled: true },
        className: 'flex w-fit flex-row items-center gap-3',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-field-switch',
            props: { defaultChecked: false },
            children: [{ kind: 'proto', prototypeId: 'brutalist-switch-thumb' }],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-field-label',
            children: ['Disabled (off)'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-field-root',
        props: { disabled: true },
        className: 'flex w-fit flex-row items-center gap-3',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-field-switch',
            props: { defaultChecked: true },
            children: [{ kind: 'proto', prototypeId: 'brutalist-switch-thumb' }],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-field-label',
            children: ['Disabled (on)'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
