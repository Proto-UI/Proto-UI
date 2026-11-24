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
        props: { defaultOpenItems: ['item-1'] },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-accordion-item',
            props: { value: 'item-1' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-accordion-heading',
                props: { level: 3 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-accordion-trigger',
                    children: ['How do I reset my password?'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-accordion-content',
                children: [
                  "Click on 'Forgot Password' on the login page, enter your email address, and we'll send you a link to reset your password. The link will expire in 24 hours.",
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-accordion-item',
            props: { value: 'item-2' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-accordion-heading',
                props: { level: 3 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-accordion-trigger',
                    children: ['Can I change my subscription plan?'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-accordion-content',
                children: [
                  'Yes, you can upgrade or downgrade your plan at any time from your account settings. Changes will be reflected in your next billing cycle.',
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-accordion-item',
            props: { value: 'item-3' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-accordion-heading',
                props: { level: 3 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-accordion-trigger',
                    children: ['What payment methods do you accept?'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-accordion-content',
                children: [
                  'We accept all major credit cards, PayPal, and bank transfers. All payments are processed securely through our payment partners.',
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
