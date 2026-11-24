import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'w-full max-w-lg rounded-3xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
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
