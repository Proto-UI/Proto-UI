import type { DemoNode, DemoSpec } from '../../components/PrototypePreviewer/demo-types';

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

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-select-root',
        ref: 'fruitSelect',
        props: { value: 'apple' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-select-trigger',
            className: 'w-48',
            props: { accessibleLabel: 'Produce selector' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-select-value',
                props: { placeholder: 'Select a fruit' },
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
                      {
                        kind: 'proto',
                        prototypeId: 'bootstrap-2-3-2-select-group',
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: 'bootstrap-2-3-2-select-label',
                            children: ['Fruits'],
                          },
                          item('apple', 'Apple'),
                          item('banana', 'Banana'),
                          item('blueberry', 'Blueberry'),
                        ],
                      },
                      { kind: 'proto', prototypeId: 'bootstrap-2-3-2-select-separator' },
                      {
                        kind: 'proto',
                        prototypeId: 'bootstrap-2-3-2-select-group',
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: 'bootstrap-2-3-2-select-label',
                            children: ['Vegetables'],
                          },
                          item('carrot', 'Carrot'),
                          item('broccoli', 'Broccoli'),
                          item('spinach', 'Spinach'),
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-button',
        ref: 'resetProduce',
        children: ['Reset'],
      },
    ],
  },
  setup({ api }) {
    let alive = true;
    const sync = (next: string) => {
      if (!alive) return;
      api.setProps('fruitSelect', {
        value: next,
        onValueChange: (event: { value: string }) => sync(event.value),
      });
    };
    sync('apple');
    api.setProps('resetProduce', {
      onClick: () => sync('apple'),
    });
    return () => {
      alive = false;
    };
  },
} satisfies DemoSpec;
