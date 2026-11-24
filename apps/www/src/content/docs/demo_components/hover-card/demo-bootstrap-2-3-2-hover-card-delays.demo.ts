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
        props: { openDelay: 50, closeDelay: 100 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-hover-card-trigger',
            children: ['Quick preview (50ms)'],
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
                  { kind: 'box', className: 'font-bold text-sm', children: ['Short Delay'] },
                  {
                    kind: 'box',
                    className: 'text-sm',
                    children: ['Appears after 50ms with the classic 150ms linear fade.'],
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
        props: { openDelay: 450, closeDelay: 300 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-hover-card-trigger',
            children: ['Standard preview (450ms)'],
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
                  { kind: 'box', className: 'font-bold text-sm', children: ['Intentional Delay'] },
                  {
                    kind: 'box',
                    className: 'text-sm',
                    children: ['Waits 450ms before opening and stays open while hovered.'],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
