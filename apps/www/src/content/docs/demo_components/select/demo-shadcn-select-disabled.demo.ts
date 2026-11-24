import type { DemoNode, DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

function fruitItem(value: string, label: string, disabled = false): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'shadcn-select-item',
    props: { value, textValue: label, disabled },
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-select-item-text',
        children: [label],
      },
    ],
  };
}

function selectWithItems(options: {
  disabled?: boolean;
  accessibleLabel: string;
  placeholder: string;
}): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'shadcn-select-root',
    props: options.disabled ? { disabled: true } : {},
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-select-trigger',
        className: 'w-48',
        props: { accessibleLabel: options.accessibleLabel },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-select-value',
            props: { placeholder: options.placeholder },
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-select-content',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-select-surface',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-select-viewport',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-select-group',
                    children: [
                      fruitItem('apple', 'Apple'),
                      fruitItem('banana', 'Banana'),
                      fruitItem('blueberry', 'Blueberry'),
                      fruitItem('grapes', 'Grapes (Sold out)', true),
                      fruitItem('pineapple', 'Pineapple'),
                    ],
                  },
                ],
              },
            ],
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
    className: 'flex flex-wrap items-center gap-4',
    children: [
      selectWithItems({
        disabled: true,
        accessibleLabel: 'Disabled fruit selector',
        placeholder: 'Disabled select',
      }),
      selectWithItems({
        accessibleLabel: 'Fruit selector with disabled item',
        placeholder: 'Disabled item inside',
      }),
    ],
  },
} satisfies DemoSpec);
