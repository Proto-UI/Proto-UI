import type { DemoNode, DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

function option(value: string, label: string, description: string): DemoNode {
  const key = `brutalist-desc-${value}`;
  return {
    kind: 'box',
    className: 'flex items-start gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-radio-group-item',
        ref: key,
        className: 'mt-0.5',
        props: { value },
        associations: { controlLabel: key },
        children: [{ kind: 'proto', prototypeId: 'brutalist-radio-group-indicator' }],
      },
      {
        kind: 'box',
        className: 'grid gap-1',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-label-root',
            ref: `${key}-label`,
            associations: { controlLabel: key },
            className: 'font-sans text-sm font-medium leading-none',
            children: [label],
          },
          {
            kind: 'box',
            className: 'font-sans text-sm font-medium text-muted-foreground',
            children: [description],
          },
        ],
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
        prototypeId: 'brutalist-radio-group-root',
        ref: 'brutalistDescriptionGroup',
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
} as unknown as DemoSpec;
