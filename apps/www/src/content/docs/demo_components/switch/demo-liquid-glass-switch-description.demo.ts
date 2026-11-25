import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-md',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-field-root',
        className: 'flex flex-row items-center justify-between gap-4',
        children: [
          {
            kind: 'box',
            className: 'flex min-w-0 flex-1 flex-col gap-1',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-field-label',
                children: ['Share across devices'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-field-description',
                children: ['Focus is shared across devices, and turns off when you leave the app.'],
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
