import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-xl flex-col gap-3 p-2',
    children: [
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-2 rounded-[4px] bg-[#0044cc] px-4 py-2.5',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-surface-root',
            props: { variant: 'transparent', colorContext: 'navbar', border: 'none' },
            children: [{ kind: 'box', className: 'px-3 py-1.5 text-sm', children: ['Rest'] }],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-surface-root',
            props: {
              variant: 'transparent',
              colorContext: 'navbar',
              border: 'none',
              hovered: true,
            },
            children: [{ kind: 'box', className: 'px-3 py-1.5 text-sm', children: ['Hovered'] }],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-surface-root',
            props: {
              variant: 'transparent',
              colorContext: 'navbar',
              border: 'none',
              current: true,
            },
            children: [
              { kind: 'box', className: 'px-3 py-1.5 text-sm font-medium', children: ['Current'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-surface-root',
            props: {
              variant: 'transparent',
              colorContext: 'navbar',
              border: 'none',
              pressed: true,
            },
            children: [{ kind: 'box', className: 'px-3 py-1.5 text-sm', children: ['Pressed'] }],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-surface-root',
            props: {
              variant: 'transparent',
              colorContext: 'navbar',
              border: 'none',
              focusVisible: true,
            },
            children: [{ kind: 'box', className: 'px-3 py-1.5 text-sm', children: ['Focused'] }],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
