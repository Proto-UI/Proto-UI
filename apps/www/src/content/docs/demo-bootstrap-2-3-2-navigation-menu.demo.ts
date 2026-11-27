import type { DemoChild, DemoSpec, DemoNode } from '@/components/PrototypePreviewer/demo-types';

function linkItem(href: string, title: string, description: string, current = false): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'bootstrap-2-3-2-navigation-menu-link',
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
            className: 'block text-[14px] font-semibold leading-tight',
            children: [title],
          },
          {
            kind: 'box',
            tag: 'span',
            className: 'block text-[12px] leading-snug opacity-80',
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
    className: 'min-w-0 flex items-center justify-center p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-navigation-menu-root',
        props: { a11yLabel: 'Main navigation' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-navigation-menu-trigger',
            props: { value: 'getting-started' },
            children: triggerLabel('Getting started'),
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-navigation-menu-content',
            props: { value: 'getting-started', a11yLabel: 'Getting started links' },
            children: [
              {
                kind: 'box',
                className: 'grid w-[280px]',
                children: [
                  linkItem(
                    '#introduction',
                    'Introduction',
                    'Classic Bootstrap 2.3.2 navigation pills and dropdown menus.',
                    true
                  ),
                  linkItem(
                    '#scaffolding',
                    'Scaffolding',
                    'Grid layout, typography, and responsive defaults.'
                  ),
                  linkItem(
                    '#base-css',
                    'Base CSS',
                    'Buttons, forms, tables, and classic gradient styles.'
                  ),
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-navigation-menu-trigger',
            props: { value: 'components' },
            children: triggerLabel('Components'),
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-navigation-menu-content',
            props: { value: 'components', a11yLabel: 'Component links' },
            children: [
              {
                kind: 'box',
                className: 'grid sm:grid-cols-2 w-[300px] sm:w-[440px]',
                children: [
                  linkItem('#alert-dialog', 'Alert Dialog', 'Modal confirmation dialogs.'),
                  linkItem('#progress', 'Progress', 'Classic striped progress indicators.'),
                  linkItem('#tabs', 'Tabs', 'Togglable tabbed navigation panes.'),
                  linkItem('#tooltip', 'Tooltip', 'Contextual pop-up descriptions.'),
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-navigation-menu-trigger',
            props: { value: 'resources' },
            children: triggerLabel('Resources'),
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-navigation-menu-content',
            props: { value: 'resources', a11yLabel: 'Resource actions' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-navigation-menu-link',
                props: { href: '#changelog' },
                children: ['Release notes'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-navigation-menu-item',
                props: { value: 'download-css', textValue: 'Download CSS bundle' },
                children: ['Download CSS bundle'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
