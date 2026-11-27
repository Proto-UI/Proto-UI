import { withShadcnRheaDemo } from './shadcn-demo-style';
import type { DemoSpec, DemoNode } from '@/components/PrototypePreviewer/demo-types';

function linkCard(href: string, title: string, description: string, current = false): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'shadcn-navigation-menu-link',
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
            className: 'block text-sm font-medium leading-none',
            children: [title],
          },
          {
            kind: 'box',
            tag: 'span',
            className: 'block text-xs text-muted-foreground leading-snug',
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

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 flex items-center justify-center p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-navigation-menu-root',
        props: { a11yLabel: 'Main navigation' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-navigation-menu-trigger',
            props: { value: 'getting-started' },
            children: triggerLabel('Getting started'),
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-navigation-menu-content',
            props: { value: 'getting-started', a11yLabel: 'Getting started links' },
            children: [
              {
                kind: 'box',
                className: 'grid gap-1 w-[320px] sm:w-[380px] p-1',
                children: [
                  linkCard(
                    '#introduction',
                    'Introduction',
                    'Re-usable components built with Proto UI prototypes and Tailwind tokens.',
                    true
                  ),
                  linkCard(
                    '#installation',
                    'Installation',
                    'How to install adapters, configure styles, and structure your app.'
                  ),
                  linkCard(
                    '#typography',
                    'Typography',
                    'Styles for headings, paragraphs, inline code, and lists.'
                  ),
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-navigation-menu-trigger',
            props: { value: 'components' },
            children: triggerLabel('Components'),
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-navigation-menu-content',
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
                    'For sighted users to preview content available behind a link.'
                  ),
                  linkCard(
                    '#progress',
                    'Progress',
                    'Displays an indicator showing the completion progress of a task.'
                  ),
                  linkCard(
                    '#scroll-area',
                    'Scroll Area',
                    'Visually or semantically separates scrollable content.'
                  ),
                  linkCard(
                    '#tabs',
                    'Tabs',
                    'Layered sections of content displayed one panel at a time.'
                  ),
                  linkCard(
                    '#tooltip',
                    'Tooltip',
                    'A popup displaying brief context when an element receives focus or hover.'
                  ),
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-navigation-menu-trigger',
            props: { value: 'resources' },
            children: triggerLabel('Resources'),
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-navigation-menu-content',
            props: { value: 'resources', a11yLabel: 'Documentation resources' },
            children: [
              {
                kind: 'box',
                className: 'grid gap-0.5 w-[220px] p-1',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-navigation-menu-link',
                    props: { href: '#changelog' },
                    children: ['Changelog'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-navigation-menu-link',
                    props: { href: '#examples', target: '_blank' },
                    children: [
                      {
                        kind: 'box',
                        tag: 'span',
                        className: 'inline-flex items-center gap-1.5',
                        children: [
                          'Examples',
                          {
                            kind: 'proto',
                            prototypeId: 'lucide-external-link-icon',
                            props: { size: 12 },
                          },
                        ],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-navigation-menu-item',
                    props: { value: 'search', textValue: 'Search documentation' },
                    children: ['Search documentation'],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
