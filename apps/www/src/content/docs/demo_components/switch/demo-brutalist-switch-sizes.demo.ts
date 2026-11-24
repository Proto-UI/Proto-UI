import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-[10rem] flex-col gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-field-root',
        className: 'flex flex-row items-center gap-3',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-field-switch',
            props: { size: 'sm', defaultChecked: false },
            children: [{ kind: 'proto', prototypeId: 'brutalist-switch-thumb' }],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-field-label',
            children: ['Small'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-field-root',
        className: 'flex flex-row items-center gap-3',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-field-switch',
            props: { size: 'default', defaultChecked: true },
            children: [{ kind: 'proto', prototypeId: 'brutalist-switch-thumb' }],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-field-label',
            children: ['Default'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
