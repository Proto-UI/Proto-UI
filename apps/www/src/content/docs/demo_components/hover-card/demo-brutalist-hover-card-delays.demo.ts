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
        props: { openDelay: 50, closeDelay: 100 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-hover-card-trigger',
            children: ['Fast (50ms / 100ms)'],
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
                  { kind: 'box', className: 'font-heading font-bold', children: ['Quick Preview'] },
                  {
                    kind: 'box',
                    className: 'text-sm',
                    children: ['Opens after 50ms and closes 100ms after leaving.'],
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
        props: { openDelay: 400, closeDelay: 300 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-hover-card-trigger',
            children: ['Standard (400ms / 300ms)'],
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
                  {
                    kind: 'box',
                    className: 'font-heading font-bold',
                    children: ['Intentional Preview'],
                  },
                  {
                    kind: 'box',
                    className: 'text-sm',
                    children: ['Waits 400ms before opening to prevent stray hover cards.'],
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
