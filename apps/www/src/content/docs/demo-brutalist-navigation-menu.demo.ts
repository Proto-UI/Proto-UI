import type { DemoSpec, DemoNode } from '@/components/PrototypePreviewer/demo-types';

function linkCard(href: string, title: string, description: string, current = false): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'brutalist-navigation-menu-link',
    props: current ? { href, current: true } : { href },
    children: [
      {
        kind: 'box',
        tag: 'span',
        className: 'grid gap-1 text-left',
        children: [
          {
            kind: 'box',
            tag: 'span',
            className: 'block text-sm font-bold leading-none',
            children: [title],
          },
          {
            kind: 'box',
            tag: 'span',
            className: 'block text-xs leading-snug opacity-80',
            children: [description],
          },
        ],
      },
    ],
  };
}

function triggerLabel(label: string) {
  return [label, { kind: 'proto', prototypeId: 'lucide-chevron-down-icon', props: { size: 12 } }];
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 flex items-center justify-center p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-navigation-menu-root',
        props: { a11yLabel: 'Main navigation' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-navigation-menu-trigger',
            props: { value: 'getting-started' },
            children: triggerLabel('Getting started'),
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-navigation-menu-content',
            props: { value: 'getting-started', a11yLabel: 'Getting started links' },
            children: [
              {
                kind: 'box',
                className: 'grid gap-2 sm:grid-cols-[0.8fr_1fr] w-[320px] sm:w-[480px] p-1',
                children: [
                  {
                    kind: 'box',
                    className:
                      'flex flex-col justify-end rounded-base border-2 border-black bg-main p-4 text-main-foreground',
                    children: [
                      {
                        kind: 'box',
                        tag: 'span',
                        className: 'text-base font-bold leading-tight',
                        children: ['Brutalist UI'],
                      },
                      {
                        kind: 'box',
                        tag: 'span',
                        className: 'mt-1 text-xs leading-snug',
                        children: [
                          'Bold borders, hard shadows, and accessible Proto UI components.',
                        ],
                      },
                    ],
                  },
                  {
                    kind: 'box',
                    className: 'grid gap-1',
                    children: [
                      linkCard(
                        '#introduction',
                        'Introduction',
                        'Re-usable components built with Proto UI and bold tokens.',
                        true
                      ),
                      linkCard(
                        '#installation',
                        'Installation',
                        'How to configure adapters and load DM Sans typography.'
                      ),
                      linkCard(
                        '#typography',
                        'Typography',
                        'Scale and contrast rules for headings and controls.'
                      ),
                    ],
                  },
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-navigation-menu-trigger',
            props: { value: 'components' },
            children: triggerLabel('Components'),
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-navigation-menu-content',
            props: { value: 'components', a11yLabel: 'Component links' },
            children: [
              {
                kind: 'box',
                className: 'grid gap-1 sm:grid-cols-2 w-[320px] sm:w-[500px] p-1',
                children: [
                  linkCard(
                    '#alert-dialog',
                    'Alert Dialog',
                    'A modal dialog that interrupts the user with important content.'
                  ),
                  linkCard(
                    '#hover-card',
                    'Hover Card',
                    'Preview rich content behind a link on pointer hover.'
                  ),
                  linkCard(
                    '#progress',
                    'Progress',
                    'Displays an indicator showing task completion progress.'
                  ),
                  linkCard(
                    '#scroll-area',
                    'Scroll Area',
                    'Visually separates scrollable content with clipped corners.'
                  ),
                  linkCard(
                    '#tabs',
                    'Tabs',
                    'Layered content panels displayed one active section at a time.'
                  ),
                  linkCard(
                    '#tooltip',
                    'Tooltip',
                    'Brief contextual label displayed on focus or pointer hover.'
                  ),
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-navigation-menu-trigger',
            props: { value: 'documentation' },
            children: triggerLabel('Documentation'),
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-navigation-menu-content',
            props: { value: 'documentation', a11yLabel: 'Documentation links' },
            children: [
              {
                kind: 'box',
                className: 'grid gap-1 w-[220px] p-1',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-navigation-menu-link',
                    props: { href: '#design-contract' },
                    children: ['Design contract'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-navigation-menu-item',
                    props: { value: 'copy-theme', textValue: 'Copy theme CSS' },
                    children: ['Copy theme CSS'],
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
