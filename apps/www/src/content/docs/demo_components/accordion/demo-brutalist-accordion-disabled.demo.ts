import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-lg mx-auto min-w-0 p-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-accordion-root',
        props: {},
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-accordion-item',
            props: { value: 'item-1' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-accordion-heading',
                props: { level: 3 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-accordion-trigger',
                    children: ['Can I access my account history?'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-accordion-content',
                children: [
                  'Yes, view your complete account history including transactions, plan changes, and support tickets.',
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-accordion-item',
            props: { value: 'item-2', disabled: true },
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-accordion-heading',
                props: { level: 3 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-accordion-trigger',
                    children: ['Premium feature information'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-accordion-content',
                children: ['Upgrade your plan to unlock enterprise audit exports.'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-accordion-item',
            props: { value: 'item-3' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-accordion-heading',
                props: { level: 3 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-accordion-trigger',
                    children: ['How do I update my email address?'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-accordion-content',
                children: [
                  'Update your email address in account settings and verify via the confirmation link we send.',
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

export default demo;
