import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center justify-center gap-6 p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-hover-card-root',
        props: { openDelay: 100, closeDelay: 150 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-hover-card-trigger',
            children: ['Active link'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-hover-card-content',
            props: { side: 'bottom', align: 'center', sideOffset: 6 },
            children: [
              {
                kind: 'box',
                className: 'flex flex-col gap-1',
                children: [
                  { kind: 'box', className: 'font-bold text-sm', children: ['Enabled Preview'] },
                  {
                    kind: 'box',
                    className: 'text-sm',
                    children: ['Hover or focus the link to show the Bootstrap 2.3.2 popover.'],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-hover-card-root',
        props: { disabled: true, openDelay: 100, closeDelay: 150 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-hover-card-trigger',
            children: ['Disabled link'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-hover-card-content',
            props: { side: 'bottom', align: 'center', sideOffset: 6 },
            children: ['Disabled links do not open a hover card.'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
