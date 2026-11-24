import type { DemoNode, DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

function rtlItem(value: string, label: string): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'shadcn-select-item',
    props: { value, textValue: label },
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-select-item-text',
        children: [label],
      },
    ],
  };
}

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    attrs: { dir: 'rtl' },
    className: 'flex items-center',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-select-root',
        props: { defaultValue: 'apple' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-select-trigger',
            className: 'w-44',
            props: { accessibleLabel: 'اختر فاكهة' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-select-value',
                props: { placeholder: 'اختر فاكهة' },
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
                          {
                            kind: 'proto',
                            prototypeId: 'shadcn-select-label',
                            children: ['الفواكه'],
                          },
                          rtlItem('apple', 'تفاح'),
                          rtlItem('banana', 'موز'),
                          rtlItem('blueberry', 'توت أزرق'),
                        ],
                      },
                      { kind: 'proto', prototypeId: 'shadcn-select-separator' },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-select-group',
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: 'shadcn-select-label',
                            children: ['الخضروات'],
                          },
                          rtlItem('carrot', 'جزر'),
                          rtlItem('broccoli', 'بروكلي'),
                          rtlItem('spinach', 'سبانخ'),
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
} satisfies DemoSpec);
