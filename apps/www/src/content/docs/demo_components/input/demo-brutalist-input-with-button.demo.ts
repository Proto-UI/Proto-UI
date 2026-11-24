import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-sm items-center gap-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-input-root',
        props: {
          placeholder: 'Email',
          inputMode: 'email',
          enterKeyHint: 'send',
          ariaLabel: 'Email',
        },
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        children: ['Subscribe'],
      },
    ],
  },
} satisfies DemoSpec;
