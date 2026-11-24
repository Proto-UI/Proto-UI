import type { DemoNode, DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

function option(value: string, label: string, description: string): DemoNode {
  const key = `bs-desc-${value}`;
  return {
    kind: 'box',
    className: 'flex items-start gap-2.5',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-radio-group-item',
        ref: key,
        className: 'mt-0.5',
        props: { value },
        associations: { controlLabel: key },
        children: [{ kind: 'proto', prototypeId: 'bootstrap-2-3-2-radio-group-indicator' }],
      },
      {
        kind: 'box',
        className: 'grid gap-0.5',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-label-root',
            ref: `${key}-label`,
            associations: { controlLabel: key },
            props: { naming: true, activation: true },
            children: [label],
          },
          {
            kind: 'box',
            className: 'text-[12px] leading-[18px] text-muted-foreground',
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
        prototypeId: 'bootstrap-2-3-2-radio-group-root',
        ref: 'bootstrapDescriptionGroup',
        className: 'w-fit max-w-sm gap-3',
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
