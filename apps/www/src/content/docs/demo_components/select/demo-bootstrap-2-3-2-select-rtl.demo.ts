import type { DemoNode, DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

function rtlItem(value: string, label: string): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'bootstrap-2-3-2-select-item',
    props: { value, textValue: label },
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-select-item-text',
        children: [label],
      },
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    attrs: { dir: 'rtl' },
    className: 'flex items-center',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-select-root',
        props: { defaultValue: 'apple' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-select-trigger',
            className: 'w-48',
            props: { accessibleLabel: 'اختر فاكهة' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-select-value',
                props: { placeholder: 'اختر فاكهة' },
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
                            children: ['الفواكه'],
                          },
                          rtlItem('apple', 'تفاح'),
                          rtlItem('banana', 'موز'),
                          rtlItem('blueberry', 'توت أزرق'),
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
                            children: ['الخضروات'],
                          },
                          rtlItem('carrot', 'جزر'),
                          rtlItem('broccoli', 'بروكلي'),
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
    ],
  },
} satisfies DemoSpec;
