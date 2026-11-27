import type { DemoSpec, DemoNode } from '@/components/PrototypePreviewer/demo-types';

function iconLink(href: string, icon: string, label: string, current = false): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'brutalist-navigation-menu-link',
    props: current ? { href, current: true } : { href },
    children: [
      {
        kind: 'box',
        tag: 'span',
        className: 'inline-flex items-center gap-2 text-sm',
        children: [
          { kind: 'proto', prototypeId: icon, props: { size: 14 } },
          { kind: 'box', tag: 'span', children: [label] },
        ],
      },
    ],
  };
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
        props: { a11yLabel: 'Project status navigation' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-navigation-menu-trigger',
            props: { value: 'status' },
            children: [
              'With Icon',
              { kind: 'proto', prototypeId: 'lucide-chevron-down-icon', props: { size: 12 } },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-navigation-menu-content',
            props: { value: 'status', a11yLabel: 'Task status links' },
            children: [
              {
                kind: 'box',
                className: 'grid gap-1 w-[200px] p-1',
                children: [
                  iconLink('#backlog', 'lucide-circle-icon', 'Backlog'),
                  iconLink('#todo', 'lucide-circle-dot-icon', 'To Do', true),
                  iconLink('#done', 'lucide-circle-check-icon', 'Done'),
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-navigation-menu-trigger',
            props: { value: 'views' },
            children: [
              'Views',
              { kind: 'proto', prototypeId: 'lucide-chevron-down-icon', props: { size: 12 } },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-navigation-menu-content',
            props: { value: 'views', a11yLabel: 'Workspace views' },
            children: [
              {
                kind: 'box',
                className: 'grid gap-1 w-[200px] p-1',
                children: [
                  iconLink('#board', 'lucide-layout-grid-icon', 'Board'),
                  iconLink('#timeline', 'lucide-calendar-icon', 'Timeline'),
                  iconLink('#metrics', 'lucide-chart-bar-icon', 'Metrics'),
                ],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
