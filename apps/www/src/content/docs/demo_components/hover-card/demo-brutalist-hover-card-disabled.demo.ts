import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center justify-center gap-6 p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-hover-card-root',
        props: { openDelay: 100, closeDelay: 150 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-hover-card-trigger',
            children: ['Active trigger'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-hover-card-content',
            props: { side: 'bottom', align: 'center', sideOffset: 8 },
            children: [
              {
                kind: 'box',
                className: 'flex flex-col gap-1',
                children: [
                  { kind: 'box', className: 'font-heading font-bold', children: ['Enabled Card'] },
                  {
                    kind: 'box',
                    className: 'text-sm',
                    children: ['Hover or focus the trigger to inspect this preview panel.'],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-hover-card-root',
        props: { disabled: true, openDelay: 100, closeDelay: 150 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-hover-card-trigger',
            children: ['Disabled trigger'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-hover-card-content',
            props: { side: 'bottom', align: 'center', sideOffset: 8 },
            children: ['Disabled previews remain closed.'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
