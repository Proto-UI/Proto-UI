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
        props: {},
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
                    children: ['Can I access my account history?'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-accordion-content',
                children: [
                  'Yes, you can view your complete account history including all transactions, plan changes, and support tickets in the Account History section of your dashboard.',
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-accordion-item',
            props: { value: 'item-2', disabled: true },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-accordion-heading',
                props: { level: 3 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-accordion-trigger',
                    children: ['Premium feature information'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-accordion-content',
                children: [
                  'This section contains information about premium features. Upgrade your plan to access this content.',
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
                    children: ['How do I update my email address?'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-accordion-content',
                children: [
                  "You can update your email address in your account settings. You'll receive a verification email at your new address to confirm the change.",
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
