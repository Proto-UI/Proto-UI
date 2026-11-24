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
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-field-label',
            children: ['Username'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-field-control',
            props: {
              placeholder: 'Enter your username',
              autoComplete: 'username',
            },
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-field-description',
            children: ['Choose a unique username for your account.'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
