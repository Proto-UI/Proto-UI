import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-lg mx-auto min-w-0 p-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-accordion-root',
        props: {},
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-accordion-item',
            props: { value: 'item-1' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-accordion-heading',
                props: { level: 3 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-accordion-trigger',
                    children: ['Can I access my account history?'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-accordion-content',
                children: [
                  'Yes, all billing statements and activity logs remain accessible from your dashboard.',
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-accordion-item',
            props: { value: 'item-2', disabled: true },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-accordion-heading',
                props: { level: 3 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-accordion-trigger',
                    children: ['Premium feature information'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-accordion-content',
                children: ['Upgrade your plan to unlock enterprise reporting.'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-accordion-item',
            props: { value: 'item-3' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-accordion-heading',
                props: { level: 3 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-accordion-trigger',
                    children: ['How do I update my email address?'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-accordion-content',
                children: [
                  'Change your primary email in account settings and verify via the confirmation email.',
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
