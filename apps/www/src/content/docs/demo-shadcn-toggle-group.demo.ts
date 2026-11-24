import { withShadcnRheaDemo } from './shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex items-center justify-center p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-toggle-group-root',
        props: {
          variant: 'outline',
          multiple: true,
          defaultValue: ['bold'],
          a11yLabel: 'Text formatting',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-toggle-group-item',
            props: { value: 'bold' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'lucide-bold-icon',
                className: 'inline-flex size-4 shrink-0 pointer-events-none',
                props: { size: 16 },
              },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Toggle bold'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-toggle-group-item',
            props: { value: 'italic' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'lucide-italic-icon',
                className: 'inline-flex size-4 shrink-0 pointer-events-none',
                props: { size: 16 },
              },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Toggle italic'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-toggle-group-item',
            props: { value: 'underline' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'lucide-underline-icon',
                className: 'inline-flex size-4 shrink-0 pointer-events-none',
                props: { size: 16 },
              },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Toggle underline'] },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
