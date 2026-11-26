import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full max-w-lg gap-4 rounded-3xl',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-textarea-root',
        props: {
          placeholder: 'Type your message here.',
          ariaLabel: 'Message',
          rows: 3,
        },
      },
      {
        kind: 'box',
        className: 'flex flex-wrap items-center justify-end gap-3',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-button',
            props: { variant: 'regular' },
            children: ['Cancel'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-button',
            props: { variant: 'prominent' },
            children: ['Send message'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
