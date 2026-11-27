import type { DemoChild, DemoSpec, DemoNode } from '@/components/PrototypePreviewer/demo-types';

function linkCard(href: string, title: string, description: string, current = false): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'liquid-glass-navigation-menu-link',
    props: current ? { href, current: true } : { href },
    children: [
      {
        kind: 'box',
        tag: 'span',
        className: 'grid gap-0.5 text-left',
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
            className: 'block text-xs leading-snug opacity-80',
            children: [description],
          },
        ],
      },
    ],
  };
}

function triggerLabel(label: string): DemoChild[] {
  return [label, { kind: 'proto', prototypeId: 'lucide-chevron-down-icon', props: { size: 12 } }];
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 w-full flex items-center justify-center',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-navigation-menu-root',
        props: { a11yLabel: 'Main navigation' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-navigation-menu-trigger',
            props: { value: 'getting-started' },
            children: triggerLabel('Getting started'),
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-navigation-menu-content',
            props: { value: 'getting-started', a11yLabel: 'Getting started links' },
            children: [
              {
                kind: 'box',
                className: 'grid gap-1 w-[300px] sm:w-[360px] p-1',
                children: [
                  linkCard(
                    '#introduction',
                    'Introduction',
                    'Translucent floating navigation surfaces with concentric geometry.',
                    true
                  ),
                  linkCard(
                    '#materials',
                    'Materials',
                    'V2 liquid-glass material intent with opaque accessibility fallback.'
                  ),
                  linkCard(
                    '#typography',
                    'Typography',
                    'Vibrant foreground hierarchy across light and dark backdrops.'
                  ),
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-navigation-menu-trigger',
            props: { value: 'components' },
            children: triggerLabel('Components'),
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-navigation-menu-content',
            props: { value: 'components', a11yLabel: 'Component links' },
            children: [
              {
                kind: 'box',
                className: 'grid gap-1 sm:grid-cols-2 w-[300px] sm:w-[480px] p-1',
                children: [
                  linkCard(
                    '#alert-dialog',
                    'Alert Dialog',
                    'Modal interruption elevated on a liquid-glass sheet.'
                  ),
                  linkCard(
                    '#popover',
                    'Popover',
                    'Anchored floating glass card for contextual controls.'
                  ),
                  linkCard('#tabs', 'Tabs', 'Segmented glass navigation switching active panels.'),
                  linkCard(
                    '#tooltip',
                    'Tooltip',
                    'Compact contextual hint floating above controls.'
                  ),
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-navigation-menu-trigger',
            props: { value: 'resources' },
            children: triggerLabel('Resources'),
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-navigation-menu-content',
            props: { value: 'resources', a11yLabel: 'Documentation resources' },
            children: [
              {
                kind: 'box',
                className: 'grid gap-0.5 w-[220px] p-1',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-navigation-menu-link',
                    props: { href: '#changelog' },
                    children: ['Changelog'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-navigation-menu-item',
                    props: { value: 'quick-search', textValue: 'Quick search' },
                    children: ['Quick search'],
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
