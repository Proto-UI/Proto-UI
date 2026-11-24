import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 flex flex-wrap items-center justify-center gap-4 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-toolbar-root',
        props: { a11yLabel: 'Button variants' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-toolbar-button',
            props: { value: 'ghost', variant: 'ghost' },
            children: ['Ghost'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-toolbar-button',
            props: { value: 'outline', variant: 'outline' },
            children: ['Outline'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-toolbar-button',
            props: { value: 'secondary', variant: 'secondary' },
            children: ['Secondary'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-toolbar-separator',
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-toolbar-button',
            props: { value: 'default', variant: 'default' },
            children: ['Publish'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-toolbar-button',
            props: { value: 'delete', variant: 'destructive' },
            children: ['Delete'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
