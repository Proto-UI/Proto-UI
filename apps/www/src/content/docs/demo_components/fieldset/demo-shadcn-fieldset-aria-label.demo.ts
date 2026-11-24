import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full p-4',
    children: [
      {
        kind: 'box',
        className: 'mx-auto grid w-full max-w-sm min-w-0 gap-6',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-fieldset-root',
            props: { ariaLabel: 'Delivery preferences' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-fieldset-description',
                children: ['Named via ariaLabel without rendering a visible Legend.'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-field-root',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-field-label',
                    children: ['Delivery notes'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-field-control',
                    props: { placeholder: 'Leave package at front desk' },
                  },
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-separator-root',
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-fieldset-root',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-fieldset-legend',
                children: ['Billing Contact'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-fieldset-description',
                children: ['Receipts and tax invoices are sent to this recipient.'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-field-root',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-field-label',
                    children: ['Contact email'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-field-control',
                    props: { placeholder: 'finance@example.com' },
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
