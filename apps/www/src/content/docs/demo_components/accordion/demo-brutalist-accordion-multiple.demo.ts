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
        props: { mode: 'multiple', defaultOpenItems: ['notifications'] },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-accordion-item',
            props: { value: 'notifications' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-accordion-heading',
                props: { level: 3 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-accordion-trigger',
                    children: ['Notification Settings'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-accordion-content',
                children: [
                  'Manage how you receive notifications. Enable email alerts for updates or push notifications for mobile devices.',
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-accordion-item',
            props: { value: 'privacy' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-accordion-heading',
                props: { level: 3 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-accordion-trigger',
                    children: ['Privacy & Security'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-accordion-content',
                children: [
                  'Control your privacy settings and security preferences, including two-factor authentication and connected devices.',
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-accordion-item',
            props: { value: 'billing' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-accordion-heading',
                props: { level: 3 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-accordion-trigger',
                    children: ['Billing & Subscription'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-accordion-content',
                children: [
                  'View your current plan, payment history, and upcoming invoices directly from your workspace.',
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
