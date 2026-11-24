import type { DemoNode, DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

function option(value: string, label: string, description: string): DemoNode {
  const key = `lg-desc-${value}`;
  return {
    kind: 'box',
    className: 'flex items-start gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-radio-group-item',
        ref: key,
        className: 'mt-0.5',
        props: { value },
        associations: { controlLabel: key },
        children: [{ kind: 'proto', prototypeId: 'liquid-glass-radio-group-indicator' }],
      },
      {
        kind: 'box',
        className: 'grid gap-1',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-label-root',
            ref: `${key}-label`,
            associations: { controlLabel: key },
            props: { naming: true, activation: true },
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

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'flex w-full justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-radio-group-root',
        ref: 'liquidGlassDescriptionGroup',
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
