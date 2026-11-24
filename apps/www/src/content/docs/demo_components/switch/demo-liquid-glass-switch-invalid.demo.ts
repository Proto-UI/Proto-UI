import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'w-full max-w-md rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-field-root',
        props: { invalid: true },
        className: 'flex flex-row items-center justify-between gap-4',
        children: [
          {
            kind: 'box',
            className: 'flex min-w-0 flex-1 flex-col gap-1',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-field-label',
                children: ['Accept terms and conditions'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-field-description',
                children: ['You must accept the terms and conditions to continue.'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-field-switch',
            props: { defaultChecked: false },
            children: [{ kind: 'proto', prototypeId: 'liquid-glass-switch-thumb' }],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
