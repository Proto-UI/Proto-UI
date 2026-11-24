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
        className: 'rounded-lg border border-border',
        props: { defaultOpenItems: ['billing'] },
        children: [
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
                    children: ['How does billing work?'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-accordion-content',
                children: [
                  'We offer monthly and annual subscription plans. Billing is charged at the beginning of each cycle, and you can cancel anytime.',
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-accordion-item',
            props: { value: 'security' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-accordion-heading',
                props: { level: 3 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-accordion-trigger',
                    children: ['Is my data secure?'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-accordion-content',
                children: [
                  'Yes. We use end-to-end encryption, SOC 2 Type II compliance, and regular third-party security audits for all customer data.',
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-accordion-item',
            props: { value: 'integration' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-accordion-heading',
                props: { level: 3 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-accordion-trigger',
                    children: ['What integrations do you support?'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-accordion-content',
                children: [
                  'We integrate with 500+ popular tools including Slack, Zapier, Salesforce, and HubSpot, plus custom webhooks and REST APIs.',
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
