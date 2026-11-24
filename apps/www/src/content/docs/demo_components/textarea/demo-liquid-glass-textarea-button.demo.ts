import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'grid w-full max-w-lg gap-4 rounded-3xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
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
