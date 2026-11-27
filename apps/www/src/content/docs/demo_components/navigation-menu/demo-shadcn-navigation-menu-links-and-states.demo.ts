import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 flex items-center justify-center p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-navigation-menu-root',
        props: { a11yLabel: 'Documentation link states' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-navigation-menu-trigger',
            props: { value: 'guides' },
            children: [
              'Guides',
              { kind: 'proto', prototypeId: 'lucide-chevron-down-icon', props: { size: 12 } },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-navigation-menu-content',
            props: { value: 'guides', a11yLabel: 'Guide links' },
            children: [
              {
                kind: 'box',
                className: 'grid gap-0.5 w-[260px] p-1',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-navigation-menu-link',
                    props: { href: '#overview', current: true },
                    children: ['Overview (current page)'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-navigation-menu-link',
                    props: { href: '#api-reference', closeOnSelect: false },
                    children: ['Stay open on click'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-navigation-menu-link',
                    props: { href: '#release-notes', target: '_blank' },
                    children: ['Open in new tab ↗'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-navigation-menu-link',
                    props: { href: '#archived', disabled: true },
                    children: ['Archived guide (disabled)'],
                  },
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-navigation-menu-trigger',
            props: { value: 'billing', disabled: true },
            children: ['Enterprise (disabled)'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
