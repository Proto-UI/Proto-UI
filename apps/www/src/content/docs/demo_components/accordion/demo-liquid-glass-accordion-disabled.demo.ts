import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    ref: 'lgDisabledStage',
    className:
      'min-w-0 w-full max-w-lg mx-auto rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    materialStage: { mountRef: 'lgDisabledStageFlow', overlayRef: 'lgDisabledStageOverlay' },
    children: [
      {
        kind: 'box',
        ref: 'lgDisabledStageFlow',
        className: 'grid grid-cols-1 min-w-0 gap-4',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-accordion-root',
            props: {},
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-accordion-item',
                props: { value: 'item-1' },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-accordion-heading',
                    props: { level: 3 },
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'liquid-glass-accordion-trigger',
                        children: ['Can I access my account history?'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-accordion-content',
                    children: [
                      'Yes, your complete transaction and support history is available in the dashboard.',
                    ],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-accordion-item',
                props: { value: 'item-2', disabled: true },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-accordion-heading',
                    props: { level: 3 },
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'liquid-glass-accordion-trigger',
                        children: ['Premium feature information'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-accordion-content',
                    children: ['Upgrade your plan to access premium controls.'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-accordion-item',
                props: { value: 'item-3' },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-accordion-heading',
                    props: { level: 3 },
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'liquid-glass-accordion-trigger',
                        children: ['How do I update my email address?'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-accordion-content',
                    children: [
                      'Update your email in account settings and verify via the confirmation email.',
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      { kind: 'box', ref: 'lgDisabledStageOverlay', children: [] },
    ],
  },
};

export default demo;
