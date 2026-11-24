import type { DemoNode, DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

// Preserves exact BRUTALIST_MANIFEST recipePrototypeIds closure while matching
// neobrutalism.dev's crisp 3-option hero preview and DM Sans medium labels.
function option(value: string, label: string): DemoNode {
  return {
    kind: 'box',
    className: 'flex items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-radio-group-item',
        ref: `hero-${value}`,
        props: { value },
        children: [
          { kind: 'proto', prototypeId: 'brutalist-radio-group-indicator' },
          { kind: 'box', className: 'sr-only', children: [label] },
        ],
      },
      { kind: 'box', className: 'font-sans text-sm font-medium leading-none', children: [label] },
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
        ref: 'brutalistHeroGroup',
        className: 'w-fit',
        props: { a11yLabel: 'Display density', defaultValue: 'comfortable' },
        children: [
          option('default', 'Default'),
          option('comfortable', 'Comfortable'),
          option('compact', 'Compact'),
        ],
      },
    ],
  },
} as unknown as DemoSpec;
