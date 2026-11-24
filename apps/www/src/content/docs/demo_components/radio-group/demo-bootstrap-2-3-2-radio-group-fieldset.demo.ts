import type { DemoNode, DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

function option(value: string, label: string): DemoNode {
  const key = `bs-fs-${value}`;
  return {
    kind: 'box',
    className: 'flex items-center gap-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-radio-group-item',
        ref: key,
        props: { value },
        associations: { controlLabel: key },
        children: [{ kind: 'proto', prototypeId: 'bootstrap-2-3-2-radio-group-indicator' }],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-label-root',
        ref: `${key}-label`,
        associations: { controlLabel: key },
        props: { naming: true, activation: true },
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
        prototypeId: 'bootstrap-2-3-2-field-root',
        ref: 'bootstrapPlanField',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-field-label',
            ref: 'bootstrapPlanLabel',
            children: ['Subscription Plan'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-field-description',
            ref: 'bootstrapPlanDescription',
            children: ['Yearly and lifetime plans offer significant savings.'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-radio-group-root',
            ref: 'bootstrapPlanGroup',
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
