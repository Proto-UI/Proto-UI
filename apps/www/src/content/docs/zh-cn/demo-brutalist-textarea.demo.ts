import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-md',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-textarea-root',
        props: {
          placeholder: 'Type your message here.',
          ariaLabel: 'Message',
          rows: 4,
        },
      },
    ],
  },
} satisfies DemoSpec;
