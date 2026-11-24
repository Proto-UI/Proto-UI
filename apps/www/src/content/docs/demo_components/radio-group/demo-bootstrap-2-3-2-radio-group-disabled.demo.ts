import type { DemoNode, DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

function option(
  prefix: string,
  value: string,
  label: string,
  itemDisabled = false,
  groupDisabled = false
): DemoNode {
  const key = `bs-${prefix}-${value}`;
  const dimmed = itemDisabled || groupDisabled;
  return {
    kind: 'box',
    className: 'flex items-center gap-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-radio-group-item',
        ref: key,
        props: { value, disabled: itemDisabled },
        associations: { controlLabel: key },
        children: [{ kind: 'proto', prototypeId: 'bootstrap-2-3-2-radio-group-indicator' }],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-label-root',
        ref: `${key}-label`,
        associations: { controlLabel: key },
        props: { naming: true, activation: true },
        className: dimmed ? 'opacity-65 cursor-not-allowed' : undefined,
        children: [label],
      },
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full max-w-md gap-8 p-2 sm:grid-cols-2',
    children: [
      {
        kind: 'box',
        className: 'grid gap-2.5',
        children: [
          { kind: 'box', className: 'text-[14px] font-bold', children: ['Disabled item'] },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-radio-group-root',
            ref: 'bootstrapDisabledItemGroup',
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
        className: 'grid gap-2.5',
        children: [
          { kind: 'box', className: 'text-[14px] font-bold', children: ['Disabled group'] },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-radio-group-root',
            ref: 'bootstrapDisabledAllGroup',
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
