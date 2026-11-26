import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full max-w-lg min-w-0 gap-3 rounded-3xl',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-label-root',
        props: { naming: true, activation: true },
        associations: { controlLabel: 'liquid-textarea-hero' },
        children: ['Message'],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-textarea-root',
        props: {
          placeholder: 'Type your message here.',
          rows: 4,
        },
        associations: { controlLabel: 'liquid-textarea-hero' },
      },
    ],
  },
} satisfies DemoSpec;
