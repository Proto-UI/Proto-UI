import { withShadcnRheaDemo } from '../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'shadcn-hover-card-root',
    className: 'relative inline-flex items-start',
    props: { openDelay: 150, closeDelay: 200 },
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-hover-card-trigger',
        children: ['@proto-ui'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-hover-card-content',
        props: { side: 'bottom', align: 'center' },
        children: [
          {
            kind: 'box',
            className: 'flex items-start gap-3',
            children: [
              {
                kind: 'box',
                className:
                  'flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground',
                children: ['PU'],
              },
              {
                kind: 'box',
                className: 'flex flex-col gap-1',
                children: [
                  {
                    kind: 'box',
                    className: 'text-sm font-semibold leading-none',
                    children: ['@proto-ui'],
                  },
                  {
                    kind: 'box',
                    className: 'text-sm text-muted-foreground',
                    children: [
                      'Host-neutral interaction protocols for building adaptable UI components across frameworks.',
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
});
