import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-sm',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-field-root',
        props: {
          invalid: true,
          errors: ['Please correct the error.'],
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-field-label',
            children: ['Input with error'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-field-control',
            props: {
              defaultValue: 'invalid-handle',
              placeholder: 'Username',
            },
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-field-error',
            children: ['Please correct the error.'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
