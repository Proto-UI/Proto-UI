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
        props: { mode: 'multiple', defaultOpenItems: ['notifications'] },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-accordion-item',
            props: { value: 'notifications' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-accordion-heading',
                props: { level: 3 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-accordion-trigger',
                    children: ['Notification Settings'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-accordion-content',
                children: [
                  'Configure email digests, release announcements, and real-time webhook alerts.',
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-accordion-item',
            props: { value: 'privacy' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-accordion-heading',
                props: { level: 3 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-accordion-trigger',
                    children: ['Privacy & Security'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-accordion-content',
                children: [
                  'Review active API keys, session history, and two-factor authentication policies.',
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-accordion-item',
            props: { value: 'billing' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-accordion-heading',
                props: { level: 3 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-accordion-trigger',
                    children: ['Billing & Subscription'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-accordion-content',
                children: [
                  'Download monthly invoices and manage billing contacts for your organization.',
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
