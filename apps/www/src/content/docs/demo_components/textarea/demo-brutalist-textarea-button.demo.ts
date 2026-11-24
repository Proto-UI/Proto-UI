import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full max-w-md gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-textarea-root',
        props: {
          placeholder: 'Type your message here.',
          ariaLabel: 'Message',
          rows: 3,
        },
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        children: ['Send message'],
      },
    ],
  },
} satisfies DemoSpec;
