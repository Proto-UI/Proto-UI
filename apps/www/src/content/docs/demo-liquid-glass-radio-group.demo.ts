import type { DemoNode, DemoSpec } from '../../components/PrototypePreviewer/demo-types';

function option(value: string, label: string): DemoNode {
  const key = `lg-hero-${value}`;
  return {
    kind: 'box',
    className: 'flex items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-radio-group-item',
        ref: key,
        props: { value },
        associations: { controlLabel: key },
        children: [{ kind: 'proto', prototypeId: 'liquid-glass-radio-group-indicator' }],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-label-root',
        ref: `${key}-label`,
        associations: { controlLabel: key },
        props: { naming: true, activation: true },
        className: 'text-sm font-medium leading-none',
        children: [label],
      },
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full justify-center',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-radio-group-root',
        ref: 'liquidGlassHeroGroup',
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
