import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'mx-auto grid w-full max-w-md gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-5',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-collapsible-root',
        props: { defaultOpen: false },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-collapsible-trigger',
            props: { variant: 'regular', material: 'auto' },
            children: ['Regular glass trigger'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-collapsible-content',
            children: ['Default neutral liquid-glass control paired with an opaque reading panel.'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-collapsible-root',
        props: { defaultOpen: false },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-collapsible-trigger',
            props: { variant: 'prominent', material: 'auto' },
            children: ['Prominent glass trigger'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-collapsible-content',
            children: ['Primary tinted emphasis for high-priority disclosure actions.'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-collapsible-root',
        props: { defaultOpen: false },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-collapsible-trigger',
            props: { variant: 'regular', material: 'opaque' },
            children: ['Opaque opt-out trigger (material="opaque")'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-collapsible-content',
            children: [
              'Withdraws optical material intent while keeping the complete opaque surface.',
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
