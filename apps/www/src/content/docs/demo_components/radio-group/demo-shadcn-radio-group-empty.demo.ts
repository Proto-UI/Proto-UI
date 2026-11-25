import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoNode } from '../../../../components/PrototypePreviewer/demo-types';

function option(value: string, label: string): DemoNode {
  const key = `empty-${value}`;
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
    className: 'grid w-fit max-w-full gap-3 p-2',
    children: [
      {
        kind: 'box',
        ref: 'empty-heading',
        className: 'text-sm font-medium',
        children: ['No initial selection'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-radio-group-root',
        ref: 'emptyGroup',
        props: { a11yLabel: 'No initial selection' },
        children: [
          option('default', 'Default'),
          option('comfortable', 'Comfortable'),
          option('compact', 'Compact'),
        ],
      },
    ],
  },
});
