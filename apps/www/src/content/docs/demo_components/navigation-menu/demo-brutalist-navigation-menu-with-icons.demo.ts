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
          {
            kind: 'box',
            tag: 'span',
            className: 'inline-block w-4 text-center',
            attrs: { 'aria-hidden': 'true' },
            children: [icon],
          },
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
              {
                kind: 'box',
                tag: 'span',
                className: 'text-[10px] leading-none',
                attrs: { 'aria-hidden': 'true' },
                children: ['▾'],
              },
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
                  iconLink('#backlog', '○', 'Backlog'),
                  iconLink('#todo', '◔', 'To Do', true),
                  iconLink('#done', '●', 'Done'),
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
              {
                kind: 'box',
                tag: 'span',
                className: 'text-[10px] leading-none',
                attrs: { 'aria-hidden': 'true' },
                children: ['▾'],
              },
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
                  iconLink('#board', '▦', 'Board'),
                  iconLink('#timeline', '═', 'Timeline'),
                  iconLink('#metrics', '▲', 'Metrics'),
                ],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
