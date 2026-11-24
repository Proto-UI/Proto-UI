import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 flex items-center justify-center p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-toolbar-root',
        props: { orientation: 'vertical', a11yLabel: 'Canvas tools' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-toolbar-button',
            props: { value: 'select' },
            children: ['Select'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-toolbar-button',
            props: { value: 'frame' },
            children: ['Frame'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-toolbar-separator',
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-toolbar-button',
            props: { value: 'zoom-in' },
            children: ['Zoom In'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-toolbar-button',
            props: { value: 'zoom-out' },
            children: ['Zoom Out'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
