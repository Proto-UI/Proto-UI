import { withShadcnRheaDemo } from '../shadcn-demo-style';
import type { DemoNode } from '../../../components/PrototypePreviewer/demo-types';

function option(value: string, label: string): DemoNode {
  const key = `hero-${value}`;
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
        className: 'text-sm font-medium leading-none',
        children: [label],
      },
    ],
  };
}

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex justify-center p-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-radio-group-root',
        ref: 'heroGroup',
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
});
