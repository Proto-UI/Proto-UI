import type { DemoNode, DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

function item(value: string, textValue: string, disabled = false): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'bootstrap-2-3-2-select-item',
    props: { value, textValue, disabled },
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-select-item-text',
        children: [textValue],
      },
    ],
  };
}

function selectDemo(disabled: boolean, placeholder: string, label: string): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'bootstrap-2-3-2-select-root',
    props: disabled ? { disabled: true } : {},
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-select-trigger',
        className: 'w-48',
        props: { accessibleLabel: label },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-select-value',
            props: { placeholder },
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-select-content',
        props: { align: 'start', sideOffset: 2, collisionPadding: 12 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-select-surface',
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-select-viewport',
                children: [
                  item('apple', 'Apple'),
                  item('grapes', 'Grapes (Sold out)', true),
                  item('pineapple', 'Pineapple'),
                ],
              },
            ],
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
    className: 'flex flex-wrap items-center gap-4',
    children: [
      selectDemo(true, 'Disabled select', 'Disabled fruit selector'),
      selectDemo(false, 'Disabled item inside', 'Fruit selector with disabled item'),
    ],
  },
} satisfies DemoSpec;
