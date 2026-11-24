import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-xs',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-input-root',
        props: {
          placeholder: 'Email',
          inputMode: 'email',
          disabled: true,
          ariaLabel: 'Disabled email',
        },
      },
    ],
  },
} satisfies DemoSpec;
