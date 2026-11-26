import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-lg rounded-3xl',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-field-root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-field-label',
            children: ['Message'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-field-description',
            children: ['Enter your message below.'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-field-textarea',
            props: {
              placeholder: 'Type your message here.',
              rows: 4,
            },
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
