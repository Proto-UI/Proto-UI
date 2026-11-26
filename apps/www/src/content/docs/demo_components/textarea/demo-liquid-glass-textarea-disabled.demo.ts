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
          disabled: true,
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
              defaultValue: 'This message is archived and cannot be edited.',
              rows: 3,
            },
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
