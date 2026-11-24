import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full max-w-xl grid-cols-1 gap-3 p-2 sm:grid-cols-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-surface-root',
        props: { variant: 'outline' },
        children: [
          { kind: 'box', className: 'p-3 text-sm', children: ['outline — Default 4px border box'] },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-surface-root',
        props: { variant: 'outline', elevation: 'raised' },
        children: [
          {
            kind: 'box',
            className: 'p-3 text-sm',
            children: ['outline + raised — Thumbnail recipe'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-surface-root',
        props: { variant: 'secondary' },
        children: [
          { kind: 'box', className: 'p-3 text-sm', children: ['secondary — Light gray panel'] },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-surface-root',
        props: { variant: 'muted' },
        children: [
          { kind: 'box', className: 'p-3 text-sm', children: ['muted — Classic well fill'] },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-surface-root',
        props: { variant: 'accent' },
        children: [
          { kind: 'box', className: 'p-3 text-sm', children: ['accent — Info callout tint'] },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-surface-root',
        props: { variant: 'solid', elevation: 'raised' },
        children: [
          { kind: 'box', className: 'p-3 text-sm', children: ['solid — Primary bevel gradient'] },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-surface-root',
        className: 'sm:col-span-2',
        props: { variant: 'scrim', border: 'none' },
        children: [
          {
            kind: 'box',
            className: 'p-3 text-xs text-white',
            children: ['scrim — 80% modal overlay backdrop'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
