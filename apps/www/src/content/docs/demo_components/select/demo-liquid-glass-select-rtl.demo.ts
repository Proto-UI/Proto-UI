import type { DemoNode, DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

function rtlItem(value: string, label: string): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'liquid-glass-select-item',
    props: { value, textValue: label },
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-select-item-text',
        children: [label],
      },
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    ref: 'rtlStage',
    attrs: { dir: 'rtl' },
    className:
      'min-w-0 w-full rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    materialStage: { mountRef: 'rtlFlow', overlayRef: 'rtlOverlay' },
    children: [
      {
        kind: 'box',
        ref: 'rtlFlow',
        className: 'flex items-center',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-select-root',
            props: { defaultValue: 'apple' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-select-trigger',
                className: 'w-48',
                props: { accessibleLabel: 'اختر فاكهة' },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-select-value',
                    props: { placeholder: 'اختر فاكهة' },
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
                                children: ['الفواكه'],
                              },
                              rtlItem('apple', 'تفاح'),
                              rtlItem('banana', 'موز'),
                              rtlItem('blueberry', 'توت أزرق'),
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
      { kind: 'box', ref: 'rtlOverlay', children: [] },
    ],
  },
} satisfies DemoSpec;
