import { withShadcnRheaDemo } from '../shadcn-demo-style';
export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'shadcn-hover-card-root',
    className: 'relative inline-flex items-start',
    props: { openDelay: 150, closeDelay: 300 },
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
            className: 'flex gap-4',
            children: [
              {
                kind: 'box',
                className:
                  'flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold',
                children: ['P'],
              },
              {
                kind: 'box',
                className: 'space-y-1',
                children: [
                  {
                    kind: 'box',
                    className: 'text-sm font-semibold',
                    children: ['Proto UI'],
                  },
                  {
                    kind: 'box',
                    className: 'text-sm text-muted-foreground',
                    children: ['@proto-ui'],
                  },
                ],
              },
            ],
          },
          {
            kind: 'box',
            className: 'mt-3 text-sm leading-relaxed',
            children: ['Host-neutral interaction protocols for building adaptable UI components.'],
          },
        ],
      },
    ],
  },
});
