import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-md mx-auto min-w-0 p-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-card-root',
        className: 'w-full',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-card-header',
            children: [
              {
                kind: 'box',
                className: 'text-base font-semibold leading-none tracking-tight',
                children: ['Subscription & Billing'],
              },
              {
                kind: 'box',
                className: 'text-sm text-muted-foreground mt-1.5',
                children: [
                  'Common questions about your account, plans, payments, and cancellations.',
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-card-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-accordion-root',
                props: { defaultOpenItems: ['plans'] },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-accordion-item',
                    props: { value: 'plans' },
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-accordion-heading',
                        props: { level: 3 },
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: 'shadcn-accordion-trigger',
                            children: ['What subscription plans do you offer?'],
                          },
                        ],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-accordion-content',
                        children: [
                          'We offer three subscription tiers: Starter ($9/month), Professional ($29/month), and Enterprise ($99/month).',
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
                            children: ['How does billing work?'],
                          },
                        ],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-accordion-content',
                        children: [
                          'Billing occurs automatically at the start of each billing cycle. You receive an invoice via email after each payment.',
                        ],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-accordion-item',
                    props: { value: 'cancel' },
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-accordion-heading',
                        props: { level: 3 },
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: 'shadcn-accordion-trigger',
                            children: ['How do I cancel my subscription?'],
                          },
                        ],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-accordion-content',
                        children: [
                          'You can cancel anytime from your account settings with no fees. Your access continues until the end of the billing period.',
                        ],
                      },
                    ],
                  },
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
