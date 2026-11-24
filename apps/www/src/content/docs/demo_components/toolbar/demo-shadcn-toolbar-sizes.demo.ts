import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 grid justify-items-center gap-3 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-toolbar-root',
        props: { a11yLabel: 'Compact formatting toolbar' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-toolbar-button',
            props: { value: 'bold', size: 'icon' },
            children: [
              { kind: 'box', tag: 'span', attrs: { 'aria-hidden': 'true' }, children: ['B'] },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Bold'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-toolbar-button',
            props: { value: 'italic', size: 'icon' },
            children: [
              { kind: 'box', tag: 'span', attrs: { 'aria-hidden': 'true' }, children: ['I'] },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Italic'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-toolbar-separator',
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-toolbar-button',
            props: { value: 'comment', size: 'sm' },
            children: ['Small'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-toolbar-button',
            props: { value: 'share', size: 'default', variant: 'outline' },
            children: ['Default'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-toolbar-button',
            props: { value: 'export', size: 'lg', variant: 'secondary' },
            children: ['Large'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
