import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 w-full grid justify-items-center gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-toolbar-root',
        props: { a11yLabel: 'Glass prominence toolbar' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toolbar-button',
            props: { value: 'reply', variant: 'regular' },
            children: ['Reply'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toolbar-button',
            props: { value: 'archive', variant: 'regular', size: 'sm' },
            children: ['Archive'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toolbar-separator',
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toolbar-button',
            props: { value: 'send', variant: 'prominent' },
            children: ['Send'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toolbar-button',
            props: { value: 'trash', variant: 'destructive' },
            children: ['Delete'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-toolbar-root',
        props: { material: 'opaque', a11yLabel: 'Opaque fallback toolbar' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toolbar-button',
            props: { value: 'opaque-regular', variant: 'regular' },
            children: ['Opaque Surface'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toolbar-separator',
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toolbar-button',
            props: { value: 'opaque-prominent', variant: 'prominent' },
            children: ['Confirm'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
