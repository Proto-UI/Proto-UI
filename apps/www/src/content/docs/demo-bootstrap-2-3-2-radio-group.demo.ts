import type { DemoNode, DemoSpec } from '../../components/PrototypePreviewer/demo-types';

function option(value: string, label: string): DemoNode {
  const key = `bs-hero-${value}`;
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
    className: 'flex justify-center p-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-radio-group-root',
        ref: 'bootstrapHeroGroup',
        className: 'w-fit',
        props: { a11yLabel: 'Display density', defaultValue: 'comfortable' },
        children: [
          option('default', 'Default'),
          option('comfortable', 'Comfortable'),
          option('compact', 'Compact'),
        ],
      },
    ],
  },
} as unknown as DemoSpec;
