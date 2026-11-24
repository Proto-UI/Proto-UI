import type { DemoNode, DemoSpec } from '../../components/PrototypePreviewer/demo-types';

function item(value: string, textValue: string, disabled = false): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'liquid-glass-select-item',
    props: { value, textValue, disabled },
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-select-item-text',
        children: [textValue],
      },
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    ref: 'heroStage',
    className:
      'min-w-0 w-full rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    materialStage: { mountRef: 'heroFlow', overlayRef: 'heroOverlay' },
    children: [
      {
        kind: 'box',
        ref: 'heroFlow',
        className: 'flex flex-wrap items-center gap-3',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-select-root',
            ref: 'fruitSelect',
            props: { value: 'apple' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-select-trigger',
                className: 'w-48',
                props: { accessibleLabel: 'Produce selector' },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-select-value',
                    props: { placeholder: 'Select a fruit' },
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-select-content',
                props: { align: 'start', sideOffset: 8, collisionPadding: 12 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-select-surface',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'liquid-glass-select-viewport',
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: 'liquid-glass-select-group',
                            children: [
                              {
                                kind: 'proto',
                                prototypeId: 'liquid-glass-select-label',
                                children: ['Fruits'],
                              },
                              item('apple', 'Apple'),
                              item('banana', 'Banana'),
                              item('blueberry', 'Blueberry'),
                            ],
                          },
                          { kind: 'proto', prototypeId: 'liquid-glass-select-separator' },
                          {
                            kind: 'proto',
                            prototypeId: 'liquid-glass-select-group',
                            children: [
                              {
                                kind: 'proto',
                                prototypeId: 'liquid-glass-select-label',
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
            prototypeId: 'liquid-glass-button',
            ref: 'resetProduce',
            children: ['Reset'],
          },
        ],
      },
      { kind: 'box', ref: 'heroOverlay', children: [] },
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
