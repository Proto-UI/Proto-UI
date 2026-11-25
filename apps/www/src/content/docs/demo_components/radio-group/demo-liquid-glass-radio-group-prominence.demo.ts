import type { DemoNode, DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

function option(
  prefix: string,
  value: string,
  label: string,
  props: { variant?: 'regular' | 'prominent'; material?: 'auto' | 'opaque' } = {}
): DemoNode {
  const key = `lg-prom-${prefix}-${value}`;
  return {
    kind: 'box',
    className: 'flex items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-radio-group-item',
        ref: key,
        props: { value, ...props },
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
    className: 'grid w-full gap-6 sm:grid-cols-3',
    children: [
      {
        kind: 'box',
        className: 'grid gap-3',
        children: [
          {
            kind: 'box',
            className: 'text-xs font-semibold uppercase tracking-wide',
            children: ['Regular'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-radio-group-root',
            ref: 'liquidRegularGroup',
            className: 'w-fit',
            props: { a11yLabel: 'Regular material choices', defaultValue: 'auto' },
            children: [
              option('regular', 'auto', 'Automatic', { variant: 'regular', material: 'auto' }),
              option('regular', 'light', 'Light', { variant: 'regular', material: 'auto' }),
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'grid gap-3',
        children: [
          {
            kind: 'box',
            className: 'text-xs font-semibold uppercase tracking-wide',
            children: ['Prominent'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-radio-group-root',
            ref: 'liquidProminentGroup',
            className: 'w-fit',
            props: { a11yLabel: 'Prominent material choices', defaultValue: 'priority' },
            children: [
              option('prominent', 'priority', 'Priority', {
                variant: 'prominent',
                material: 'auto',
              }),
              option('prominent', 'standard', 'Standard', {
                variant: 'prominent',
                material: 'auto',
              }),
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'grid gap-3',
        children: [
          {
            kind: 'box',
            className: 'text-xs font-semibold uppercase tracking-wide',
            children: ['Opaque'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-radio-group-root',
            ref: 'liquidOpaqueGroup',
            className: 'w-fit',
            props: { a11yLabel: 'Opaque fallback choices', defaultValue: 'solid' },
            children: [
              option('opaque', 'solid', 'Solid surface', { material: 'opaque' }),
              option('opaque', 'high-contrast', 'High contrast', { material: 'opaque' }),
            ],
          },
        ],
      },
    ],
  },
} as unknown as DemoSpec;
