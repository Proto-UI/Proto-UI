import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-md',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-field-root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-field-label',
            children: ['Message'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-field-textarea',
            props: {
              placeholder: 'Type your message here.',
              rows: 4,
            },
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-field-description',
            children: ['Enter your message below.'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
