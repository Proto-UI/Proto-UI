import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoNode } from '../../../../components/PrototypePreviewer/demo-types';

function option(value: string, label: string): DemoNode {
  const key = `fieldset-${value}`;
  return {
    kind: 'box',
    className: 'flex items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-radio-group-item',
        ref: key,
        props: { value },
        associations: { controlLabel: key },
        children: [{ kind: 'proto', prototypeId: 'shadcn-radio-group-indicator' }],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-label-root',
        ref: `${key}-label`,
        associations: { controlLabel: key },
        className: 'text-sm font-normal leading-none',
        children: [label],
      },
    ],
  };
}

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-xs p-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-fieldset-root',
        ref: 'subscriptionFieldset',
        className: 'grid gap-3',
        children: [
          {
            kind: 'box',
            className: 'grid gap-1',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-fieldset-legend',
                ref: 'subscriptionLegend',
                children: ['Subscription Plan'],
              },
              {
                kind: 'box',
                className: 'text-sm text-muted-foreground',
                children: ['Yearly and lifetime plans offer significant savings.'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-radio-group-root',
            ref: 'subscriptionGroup',
            props: { a11yLabel: 'Subscription Plan', defaultValue: 'monthly' },
            children: [
              option('monthly', 'Monthly ($9.99/month)'),
              option('yearly', 'Yearly ($99.99/year)'),
              option('lifetime', 'Lifetime ($299.99)'),
            ],
          },
        ],
      },
    ],
  },
});
