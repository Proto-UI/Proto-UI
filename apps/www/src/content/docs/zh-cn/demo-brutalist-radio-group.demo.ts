import type { DemoNode, DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

// Visible captions stay inside each radio item so inherited Base
// nameFromContent derives the same accessible name across the Web runtimes.
function option(
  group: string,
  value: string,
  label: string,
  props: Record<string, unknown> = {}
): DemoNode {
  return {
    kind: 'box',
    className: 'flex items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-radio-group-item',
        ref: `${group}-${value}`,
        props: { value, ...props },
        children: [
          { kind: 'proto', prototypeId: 'brutalist-radio-group-indicator' },
          { kind: 'box', className: 'sr-only', children: [label] },
        ],
      },
      { kind: 'box', className: 'font-bold', children: [label] },
    ],
  };
}

function group(title: string, defaultValue: string, options: DemoNode[]): DemoNode {
  return {
    kind: 'box',
    className: 'flex flex-col gap-2',
    children: [
      { kind: 'box', className: 'font-bold', children: [title] },
      {
        kind: 'proto',
        prototypeId: 'brutalist-radio-group-root',
        ref: title,
        props: { a11yLabel: title, defaultValue },
        children: options,
      },
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-col gap-6',
    children: [
      group('Density preference', 'comfortable', [
        option('density', 'default', 'Default'),
        option('density', 'comfortable', 'Comfortable'),
        option('density', 'compact', 'Compact', { disabled: true }),
      ]),
      group('No initial selection', '', [
        option('empty', 'default', 'Default'),
        option('empty', 'comfortable', 'Comfortable'),
      ]),
    ],
  },
} as unknown as DemoSpec;
