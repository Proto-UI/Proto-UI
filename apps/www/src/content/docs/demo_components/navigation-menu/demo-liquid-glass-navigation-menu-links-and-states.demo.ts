import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 w-full flex items-center justify-center',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-navigation-menu-root',
        props: { a11yLabel: 'Documentation link states and prominence' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-navigation-menu-trigger',
            props: { value: 'guides', prominence: 'prominent' },
            children: [
              'Guides',
              { kind: 'proto', prototypeId: 'lucide-chevron-down-icon', props: { size: 12 } },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-navigation-menu-content',
            props: { value: 'guides', a11yLabel: 'Guide links' },
            children: [
              {
                kind: 'box',
                className: 'grid gap-0.5 w-[260px] p-1',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-navigation-menu-link',
                    props: { href: '#overview', current: true },
                    children: ['Overview (current page)'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-navigation-menu-link',
                    props: { href: '#api-reference', closeOnSelect: false },
                    children: ['Stay open on click'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-navigation-menu-link',
                    props: { href: '#release-notes', target: '_blank' },
                    children: ['Open in new tab ↗'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-navigation-menu-link',
                    props: { href: '#archived', disabled: true },
                    children: ['Archived guide (disabled)'],
                  },
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-navigation-menu-trigger',
            props: { value: 'opaque-panel' },
            children: [
              'Opaque Panel',
              { kind: 'proto', prototypeId: 'lucide-chevron-down-icon', props: { size: 12 } },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-navigation-menu-content',
            props: {
              value: 'opaque-panel',
              material: 'opaque',
              a11yLabel: 'Opaque fallback links',
            },
            children: [
              {
                kind: 'box',
                className: 'grid gap-0.5 w-[240px] p-1',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-navigation-menu-link',
                    props: { href: '#contrast' },
                    children: ['High-contrast surface'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-navigation-menu-link',
                    props: { href: '#accessibility' },
                    children: ['Accessibility guide'],
                  },
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-navigation-menu-trigger',
            props: { value: 'billing', disabled: true },
            children: ['Enterprise (disabled)'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
