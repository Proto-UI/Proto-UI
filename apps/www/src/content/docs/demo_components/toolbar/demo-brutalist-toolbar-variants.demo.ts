import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 flex flex-wrap items-center justify-center gap-4 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-toolbar-root',
        props: { a11yLabel: 'Brutalist toolbar variants' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-toolbar-button',
            props: { value: 'bold', size: 'icon' },
            children: [
              { kind: 'box', tag: 'span', attrs: { 'aria-hidden': 'true' }, children: ['B'] },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Bold'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-toolbar-button',
            props: { value: 'preview', size: 'sm', variant: 'surface' },
            children: ['Small'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-toolbar-separator',
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-toolbar-button',
            props: { value: 'publish', variant: 'solid' },
            children: ['Publish'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-toolbar-button',
            props: { value: 'delete', variant: 'destructive' },
            children: ['Delete'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
