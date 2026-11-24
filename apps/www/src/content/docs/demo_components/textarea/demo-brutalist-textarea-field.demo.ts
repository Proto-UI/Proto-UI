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
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-field-label',
            children: ['Message'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-field-description',
            children: ['Enter your message below.'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-field-textarea',
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
