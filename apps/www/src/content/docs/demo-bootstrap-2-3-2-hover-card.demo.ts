import type { DemoSpec } from '../../components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex items-center justify-center p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-hover-card-root',
        props: { openDelay: 150, closeDelay: 250 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-hover-card-trigger',
            children: ['@proto-ui'],
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
                  {
                    kind: 'box',
                    className: 'font-bold text-sm',
                    children: ['Proto UI'],
                  },
                  {
                    kind: 'box',
                    className: 'text-sm',
                    children: [
                      'Host-neutral interaction protocols rendered with classic Bootstrap 2.3.2 popover chrome.',
                    ],
                  },
                  {
                    kind: 'box',
                    className: 'pt-1 text-xs text-muted-foreground',
                    children: ['Joined December 2024'],
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
