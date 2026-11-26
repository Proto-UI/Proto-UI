import type { DemoNode, DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

function option(
  prefix: string,
  value: string,
  label: string,
  itemDisabled = false,
  groupDisabled = false
): DemoNode {
  const key = `lg-dis-${prefix}-${value}`;
  const muted = itemDisabled || groupDisabled;
  return {
    kind: 'box',
    className: 'flex items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-radio-group-item',
        ref: key,
        props: { value, disabled: itemDisabled },
        associations: { controlLabel: key },
        children: [{ kind: 'proto', prototypeId: 'liquid-glass-radio-group-indicator' }],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-label-root',
        ref: `${key}-label`,
        associations: { controlLabel: key },
        props: { naming: true, activation: true },
        className: muted
          ? 'text-sm font-medium leading-none text-muted-foreground cursor-not-allowed'
          : 'text-sm font-medium leading-none',
        children: [label],
      },
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full max-w-lg gap-8 sm:grid-cols-2',
    children: [
      {
        kind: 'box',
        className: 'grid gap-3',
        children: [
          { kind: 'box', className: 'text-sm font-semibold', children: ['Disabled item'] },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-radio-group-root',
            ref: 'liquidDisabledItemGroup',
            className: 'w-fit',
            props: { a11yLabel: 'Single disabled option', defaultValue: 'option2' },
            children: [
              option('single', 'option1', 'Disabled', true),
              option('single', 'option2', 'Option 2'),
              option('single', 'option3', 'Option 3'),
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'grid gap-3',
        children: [
          { kind: 'box', className: 'text-sm font-semibold', children: ['Disabled group'] },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-radio-group-root',
            ref: 'liquidDisabledAllGroup',
            className: 'w-fit',
            props: { a11yLabel: 'Disabled radio group', defaultValue: 'option2', disabled: true },
            children: [
              option('all', 'option1', 'Option 1', false, true),
              option('all', 'option2', 'Option 2', false, true),
              option('all', 'option3', 'Option 3', false, true),
            ],
          },
        ],
      },
    ],
  },
} as unknown as DemoSpec;
