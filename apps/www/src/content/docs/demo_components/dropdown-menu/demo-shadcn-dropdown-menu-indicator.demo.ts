import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-dropdown-root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-dropdown-trigger',
            props: {
              indicator: true,
              indicatorIcon: 'chevron-down',
            },
            children: ['Options'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-dropdown-content',
            props: { align: 'end' },
            surfaceStyle: 'w-40',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-dropdown-item',
                props: { value: 'duplicate', textValue: 'Duplicate' },
                children: ['Duplicate'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-dropdown-item',
                props: { value: 'export', textValue: 'Export' },
                children: ['Export'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-dropdown-separator',
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-dropdown-item',
                props: { value: 'delete', textValue: 'Delete', variant: 'destructive' },
                children: ['Delete'],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-dropdown-root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-dropdown-trigger',
            props: {
              indicator: true,
              indicatorIcon: 'chevrons-up-down',
            },
            children: ['Workspace'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-dropdown-content',
            props: { side: 'right', align: 'start', sideOffset: 6 },
            surfaceStyle: 'w-40',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-dropdown-group',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-dropdown-label',
                    children: ['Switch workspace'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-dropdown-item',
                    props: { value: 'personal', textValue: 'Personal' },
                    children: ['Personal'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-dropdown-item',
                    props: { value: 'studio', textValue: 'Design Studio' },
                    children: ['Design Studio'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-dropdown-item',
                    props: { value: 'acme', textValue: 'Acme Inc.' },
                    children: ['Acme Inc.'],
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
