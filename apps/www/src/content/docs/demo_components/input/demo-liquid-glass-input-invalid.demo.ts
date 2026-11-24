import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'w-full max-w-md rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'box',
        className: 'rounded-2xl bg-background/95 p-5 shadow-sm',
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
