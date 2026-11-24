import type { DemoNode, DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

function option(value: string, label: string): DemoNode {
  const key = `brutalist-fs-${value}`;
  return {
    kind: 'box',
    className: 'flex items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-radio-group-item',
        ref: key,
        props: { value },
        associations: { controlLabel: key },
        children: [{ kind: 'proto', prototypeId: 'brutalist-radio-group-indicator' }],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-label-root',
        ref: `${key}-label`,
        associations: { controlLabel: key },
        className: 'font-sans text-sm font-medium leading-none',
        children: [label],
      },
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-xs p-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-field-root',
        ref: 'brutalistPlanField',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-field-label',
            ref: 'brutalistPlanLabel',
            children: ['Subscription Plan'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-field-description',
            ref: 'brutalistPlanDescription',
            children: ['Yearly and lifetime plans offer significant savings.'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-radio-group-root',
            ref: 'brutalistPlanGroup',
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
} as unknown as DemoSpec;
