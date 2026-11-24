import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 flex items-center justify-center p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-toolbar-root',
        props: {
          orientation: 'vertical',
          a11yLabel: 'Canvas tools',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-toolbar-button',
            props: { value: 'select' },
            children: ['Select'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-toolbar-button',
            props: { value: 'frame' },
            children: ['Frame'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-toolbar-button',
            props: { value: 'text' },
            children: ['Text'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-toolbar-separator',
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-toolbar-button',
            props: { value: 'zoom-in' },
            children: ['Zoom In'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-toolbar-button',
            props: { value: 'zoom-out' },
            children: ['Zoom Out'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
