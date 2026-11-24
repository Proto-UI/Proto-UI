import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-md flex-col items-start gap-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-textarea-root',
        props: {
          placeholder: 'Type your message here.',
          ariaLabel: 'Message',
          rows: 3,
        },
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-button',
        children: ['Send message'],
      },
    ],
  },
} satisfies DemoSpec;
