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
        props: {
          invalid: true,
          errors: ['Please enter a valid message.'],
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-field-label',
            children: ['Message'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-field-textarea',
            props: {
              placeholder: 'Type your message here.',
              rows: 3,
            },
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-field-error',
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
