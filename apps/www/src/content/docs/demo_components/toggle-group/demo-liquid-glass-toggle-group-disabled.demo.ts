import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 flex flex-col items-center gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-toggle-group-root',
        props: {
          material: 'opaque',
          defaultValue: ['day'],
          a11yLabel: 'Opaque surface fallback',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle-group-item',
            props: { value: 'day' },
            children: ['Day'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle-group-item',
            props: { value: 'week' },
            children: ['Week'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle-group-item',
            props: { value: 'month' },
            children: ['Month'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-toggle-group-root',
        props: {
          disabled: true,
          defaultValue: ['day'],
          a11yLabel: 'Disabled toggle group',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle-group-item',
            props: { value: 'day' },
            children: ['Day'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle-group-item',
            props: { value: 'week' },
            children: ['Week'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle-group-item',
            props: { value: 'month' },
            children: ['Month'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
