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
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-field-label',
                children: ['Username'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-field-control',
                props: {
                  placeholder: 'Enter your username',
                  autoComplete: 'username',
                },
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-field-description',
                children: ['Choose a unique username for your account.'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
