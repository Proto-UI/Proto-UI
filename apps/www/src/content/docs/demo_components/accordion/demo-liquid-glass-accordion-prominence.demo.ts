import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    ref: 'lgProminenceStage',
    className:
      'min-w-0 w-full max-w-lg mx-auto rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    materialStage: {
      mountRef: 'lgProminenceStageFlow',
      overlayRef: 'lgProminenceStageOverlay',
    },
    children: [
      {
        kind: 'box',
        ref: 'lgProminenceStageFlow',
        className: 'grid grid-cols-1 min-w-0 gap-4',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-accordion-root',
            props: { mode: 'multiple', defaultOpenItems: ['prominent'] },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-accordion-item',
                props: { value: 'regular' },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-accordion-heading',
                    props: { level: 3 },
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'liquid-glass-accordion-trigger',
                        props: { prominence: 'regular', material: 'auto' },
                        children: ['Regular glass trigger'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-accordion-content',
                    children: [
                      'Uses standard translucent Liquid Glass on the interactive header while keeping body copy opaque.',
                    ],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-accordion-item',
                props: { value: 'prominent' },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-accordion-heading',
                    props: { level: 3 },
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'liquid-glass-accordion-trigger',
                        props: { prominence: 'prominent', material: 'auto' },
                        children: ['Prominent glass trigger'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-accordion-content',
                    children: [
                      'Highlights a primary collapsible section with primary tint prominence while maintaining full text contrast.',
                    ],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-accordion-item',
                props: { value: 'opaque' },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-accordion-heading',
                    props: { level: 3 },
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'liquid-glass-accordion-trigger',
                        props: { material: 'opaque' },
                        children: ['Opaque fallback opt-out'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-accordion-content',
                    children: [
                      'Setting material="opaque" withdraws optical candidates for dense content layers or high-contrast needs.',
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      { kind: 'box', ref: 'lgProminenceStageOverlay', children: [] },
    ],
  },
};

export default demo;
