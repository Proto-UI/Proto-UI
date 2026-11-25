import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 w-full flex items-center justify-center',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-toolbar-root',
        props: { orientation: 'vertical', a11yLabel: 'Floating canvas tools' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toolbar-button',
            props: { value: 'select' },
            children: ['Select'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toolbar-button',
            props: { value: 'crop' },
            children: ['Crop'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toolbar-separator',
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toolbar-button',
            props: { value: 'adjust' },
            children: ['Adjust'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toolbar-button',
            props: { value: 'done', variant: 'prominent' },
            children: ['Done'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
