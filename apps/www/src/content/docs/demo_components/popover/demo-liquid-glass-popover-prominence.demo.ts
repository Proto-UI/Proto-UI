import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 flex min-w-0 flex-wrap items-center justify-center gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-popover-root',
        props: { a11yLabel: 'Regular glass popover' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-popover-trigger',
            props: { prominence: 'regular' },
            children: ['Regular glass'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-popover-content',
            props: { material: 'auto', prominence: 'regular' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-popover-title',
                children: ['Regular prominence'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-popover-description',
                children: ['Default floating Liquid Glass layer over dynamic backgrounds.'],
              },
              {
                kind: 'box',
                className: 'flex justify-end',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-popover-close',
                    children: ['Close'],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-popover-root',
        props: { a11yLabel: 'Prominent glass popover' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-popover-trigger',
            props: { prominence: 'prominent' },
            children: ['Prominent glass'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-popover-content',
            props: { material: 'auto', prominence: 'prominent' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-popover-title',
                children: ['Prominent emphasis'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-popover-description',
                children: ['Stronger elevation and edge definition for primary actions.'],
              },
              {
                kind: 'box',
                className: 'flex justify-end',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-popover-close',
                    props: { prominence: 'prominent' },
                    children: ['Done'],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-popover-root',
        props: { a11yLabel: 'Opaque fallback popover' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-popover-trigger',
            children: ['Opaque surface'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-popover-content',
            props: { material: 'opaque' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-popover-title',
                children: ['Opaque opt-out'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-popover-description',
                children: ['Explicitly opts out of translucency for dense reading surfaces.'],
              },
              {
                kind: 'box',
                className: 'flex justify-end',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-popover-close',
                    children: ['Close'],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
