import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-md flex-col gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-field-root',
        props: { disabled: true },
        className: 'flex w-fit flex-row items-center gap-3',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-field-switch',
            props: { defaultChecked: false },
            children: [{ kind: 'proto', prototypeId: 'liquid-glass-switch-thumb' }],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-field-label',
            children: ['Disabled (off)'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-field-root',
        props: { disabled: true },
        className: 'flex w-fit flex-row items-center gap-3',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-field-switch',
            props: { defaultChecked: true },
            children: [{ kind: 'proto', prototypeId: 'liquid-glass-switch-thumb' }],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-field-label',
            children: ['Disabled (on)'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
