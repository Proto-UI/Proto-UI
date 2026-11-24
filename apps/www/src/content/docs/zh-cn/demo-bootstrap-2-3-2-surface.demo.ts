import type { DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-lg flex-col gap-4 p-2',
    children: [
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-2 rounded-[4px] bg-[#0044cc] px-3 py-2',
        children: [
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
              { kind: 'box', className: 'px-3 py-1.5 text-sm font-medium', children: ['Overview'] },
            ],
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
            children: [{ kind: 'box', className: 'px-3 py-1.5 text-sm', children: ['Components'] }],
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
            children: [{ kind: 'box', className: 'px-3 py-1.5 text-sm', children: ['Docs'] }],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-surface-root',
        props: { variant: 'outline', elevation: 'raised' },
        children: [
          {
            kind: 'box',
            className: 'p-4 text-sm',
            children: ['Thumbnail frame using classic Bootstrap 2.3.2 border and subtle lift.'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-surface-root',
        props: { variant: 'muted', radius: 'md' },
        children: [
          {
            kind: 'box',
            className: 'px-4 py-3 text-sm',
            children: ['Well container for secondary notices and grouped metadata.'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-3',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-surface-root',
            props: { variant: 'solid', actionProfile: 'button' },
            children: ['Primary Action'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-surface-root',
            props: { variant: 'secondary', actionProfile: 'button' },
            children: ['Default Action'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-surface-root',
            props: { variant: 'solid', actionProfile: 'button', pressed: true },
            children: ['Pressed Primary'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
