import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-md',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-field-root',
        props: {
          disabled: true,
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-field-label',
            children: ['Message'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-field-textarea',
            props: {
              placeholder: 'Type your message here.',
              rows: 3,
            },
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
