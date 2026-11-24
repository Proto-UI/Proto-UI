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
        className: 'mx-auto w-full max-w-xs min-w-0',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-fieldset-root',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-fieldset-legend',
                props: { variant: 'label' },
                children: ['Subscription Plan'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-fieldset-description',
                children: ['Yearly and lifetime plans offer significant savings.'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-radio-group-root',
                props: { defaultValue: 'monthly', a11yLabel: 'Subscription Plan' },
                children: [
                  {
                    kind: 'box',
                    className: 'flex items-center gap-2',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-radio-group-item',
                        props: { value: 'monthly' },
                        associations: { controlLabel: 'plan-monthly' },
                        children: [{ kind: 'proto', prototypeId: 'shadcn-radio-group-indicator' }],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-label-root',
                        associations: { controlLabel: 'plan-monthly' },
                        children: ['Monthly ($9.99/month)'],
                      },
                    ],
                  },
                  {
                    kind: 'box',
                    className: 'flex items-center gap-2',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-radio-group-item',
                        props: { value: 'yearly' },
                        associations: { controlLabel: 'plan-yearly' },
                        children: [{ kind: 'proto', prototypeId: 'shadcn-radio-group-indicator' }],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-label-root',
                        associations: { controlLabel: 'plan-yearly' },
                        children: ['Yearly ($99.99/year)'],
                      },
                    ],
                  },
                  {
                    kind: 'box',
                    className: 'flex items-center gap-2',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-radio-group-item',
                        props: { value: 'lifetime' },
                        associations: { controlLabel: 'plan-lifetime' },
                        children: [{ kind: 'proto', prototypeId: 'shadcn-radio-group-indicator' }],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-label-root',
                        associations: { controlLabel: 'plan-lifetime' },
                        children: ['Lifetime ($299.99)'],
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
