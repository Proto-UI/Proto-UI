import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-lg mx-auto min-w-0 p-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-accordion-root',
        props: { mode: 'multiple', defaultOpenItems: ['notifications'] },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-accordion-item',
            props: { value: 'notifications' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-accordion-heading',
                props: { level: 3 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-accordion-trigger',
                    children: ['Notification Settings'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-accordion-content',
                children: [
                  'Manage how you receive notifications. You can enable email alerts for updates or push notifications for mobile devices.',
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-accordion-item',
            props: { value: 'privacy' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-accordion-heading',
                props: { level: 3 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-accordion-trigger',
                    children: ['Privacy & Security'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-accordion-content',
                children: [
                  'Control your privacy settings and security preferences. Enable two-factor authentication, manage connected devices, and review active sessions.',
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-accordion-item',
            props: { value: 'billing' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-accordion-heading',
                props: { level: 3 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-accordion-trigger',
                    children: ['Billing & Subscription'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-accordion-content',
                children: [
                  'View your current plan, payment history, and upcoming invoices. Update your payment method or change your subscription tier.',
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

export default withShadcnRheaDemo(demo);
