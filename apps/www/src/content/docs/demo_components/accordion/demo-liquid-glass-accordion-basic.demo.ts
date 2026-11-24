import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    ref: 'lgBasicStage',
    className:
      'min-w-0 w-full max-w-lg mx-auto rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    materialStage: { mountRef: 'lgBasicStageFlow', overlayRef: 'lgBasicStageOverlay' },
    children: [
      {
        kind: 'box',
        ref: 'lgBasicStageFlow',
        className: 'grid grid-cols-1 min-w-0 gap-4',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-accordion-root',
            props: { defaultOpenItems: ['item-1'] },
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
                        children: ['How do I reset my password?'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-accordion-content',
                    children: [
                      "Click on 'Forgot Password' on the login page, enter your email address, and we'll send you a reset link that expires in 24 hours.",
                    ],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-accordion-item',
                props: { value: 'item-2' },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-accordion-heading',
                    props: { level: 3 },
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'liquid-glass-accordion-trigger',
                        children: ['Can I change my subscription plan?'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-accordion-content',
                    children: [
                      'Yes, upgrade or downgrade anytime from account settings. Changes apply on your next billing cycle.',
                    ],
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
                        children: ['What payment methods do you accept?'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-accordion-content',
                    children: ['We accept all major credit cards, PayPal, and bank transfers.'],
                  },
                ],
              },
            ],
          },
        ],
      },
      { kind: 'box', ref: 'lgBasicStageOverlay', children: [] },
    ],
  },
};

export default demo;
