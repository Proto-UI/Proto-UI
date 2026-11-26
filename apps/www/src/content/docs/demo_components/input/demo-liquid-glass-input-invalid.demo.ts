import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-md',
    children: [
      {
        kind: 'box',
        className: 'grid min-w-0 gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-field-root',
            props: {
              invalid: true,
              errors: ['This field contains validation errors.'],
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-field-label',
                children: ['Invalid Input'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-field-control',
                props: {
                  defaultValue: 'invalid-value',
                  placeholder: 'Error',
                },
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-field-error',
                children: ['This field contains validation errors.'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
