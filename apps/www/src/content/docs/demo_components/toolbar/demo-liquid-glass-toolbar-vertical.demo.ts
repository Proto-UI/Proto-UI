import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'min-w-0 w-full rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 flex items-center justify-center',
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
