import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoNode } from '../../../../components/PrototypePreviewer/demo-types';

function option(value: string, label: string, description: string): DemoNode {
  const key = `desc-${value}`;
  return {
    kind: 'box',
    className: 'flex items-start gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-radio-group-item',
        ref: key,
        className: 'mt-0.5',
        props: { value },
        associations: { controlLabel: key },
        children: [{ kind: 'proto', prototypeId: 'shadcn-radio-group-indicator' }],
      },
      {
        kind: 'box',
        className: 'grid gap-1',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-label-root',
            ref: `${key}-label`,
            associations: { controlLabel: key },
            className: 'text-sm font-medium leading-none',
            children: [label],
          },
          {
            kind: 'box',
            className: 'text-sm text-muted-foreground',
            children: [description],
          },
        ],
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
        ref: 'descriptionGroup',
        className: 'w-fit max-w-sm',
        props: { a11yLabel: 'Layout density', defaultValue: 'comfortable' },
        children: [
          option('default', 'Default', 'Standard spacing for most use cases.'),
          option('comfortable', 'Comfortable', 'More space between elements.'),
          option('compact', 'Compact', 'Minimal spacing for dense layouts.'),
        ],
      },
    ],
  },
});
