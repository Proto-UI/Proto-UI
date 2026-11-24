import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec, DemoNode } from '@/components/PrototypePreviewer/demo-types';

function iconLink(href: string, icon: string, label: string, current = false): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'shadcn-navigation-menu-link',
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
            className: 'inline-block w-4 text-center text-muted-foreground',
            attrs: { 'aria-hidden': 'true' },
            children: [icon],
          },
          { kind: 'box', tag: 'span', children: [label] },
        ],
      },
    ],
  };
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
        props: { a11yLabel: 'Project status navigation' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-navigation-menu-trigger',
            props: { value: 'status' },
            children: [
              'With Icon',
              {
                kind: 'box',
                tag: 'span',
                className: 'text-[10px] leading-none opacity-70',
                attrs: { 'aria-hidden': 'true' },
                children: ['▾'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-navigation-menu-content',
            props: { value: 'status', a11yLabel: 'Task status links' },
            children: [
              {
                kind: 'box',
                className: 'grid gap-0.5 w-[200px] p-1',
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
            prototypeId: 'shadcn-navigation-menu-trigger',
            props: { value: 'views' },
            children: [
              'Views',
              {
                kind: 'box',
                tag: 'span',
                className: 'text-[10px] leading-none opacity-70',
                attrs: { 'aria-hidden': 'true' },
                children: ['▾'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-navigation-menu-content',
            props: { value: 'views', a11yLabel: 'Workspace views' },
            children: [
              {
                kind: 'box',
                className: 'grid gap-0.5 w-[200px] p-1',
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
} satisfies DemoSpec);
