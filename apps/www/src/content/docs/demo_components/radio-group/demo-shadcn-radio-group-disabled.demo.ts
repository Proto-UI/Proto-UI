import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoNode } from '../../../../components/PrototypePreviewer/demo-types';

function option(
  prefix: string,
  value: string,
  label: string,
  itemDisabled = false,
  groupDisabled = false
): DemoNode {
  const key = `${prefix}-${value}`;
  const dimmed = itemDisabled || groupDisabled;
  return {
    kind: 'box',
    className: 'flex items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-radio-group-item',
        ref: key,
        props: { value, disabled: itemDisabled },
        associations: { controlLabel: key },
        children: [{ kind: 'proto', prototypeId: 'shadcn-radio-group-indicator' }],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-label-root',
        ref: `${key}-label`,
        associations: { controlLabel: key },
        className: dimmed
          ? 'text-sm font-normal leading-none opacity-50 cursor-not-allowed'
          : 'text-sm font-normal leading-none',
        children: [label],
      },
    ],
  };
}

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full max-w-md gap-8 p-2 sm:grid-cols-2',
    children: [
      {
        kind: 'box',
        className: 'grid gap-3',
        children: [
          { kind: 'box', className: 'text-sm font-medium', children: ['Disabled item'] },
          {
            kind: 'proto',
            prototypeId: 'shadcn-radio-group-root',
            ref: 'disabledItemGroup',
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
          { kind: 'box', className: 'text-sm font-medium', children: ['Disabled group'] },
          {
            kind: 'proto',
            prototypeId: 'shadcn-radio-group-root',
            ref: 'disabledAllGroup',
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
});
