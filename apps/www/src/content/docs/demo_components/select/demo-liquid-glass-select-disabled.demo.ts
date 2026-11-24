import type { DemoNode, DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

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

function selectDemo(disabled: boolean, placeholder: string, label: string): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'liquid-glass-select-root',
    props: disabled ? { disabled: true } : {},
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-select-trigger',
        className: 'w-48',
        props: { accessibleLabel: label },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-select-value',
            props: { placeholder },
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
    ref: 'disabledStage',
    className:
      'min-w-0 w-full rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    materialStage: { mountRef: 'disabledFlow', overlayRef: 'disabledOverlay' },
    children: [
      {
        kind: 'box',
        ref: 'disabledFlow',
        className: 'flex flex-wrap items-center gap-4',
        children: [
          selectDemo(true, 'Disabled select', 'Disabled fruit selector'),
          selectDemo(false, 'Disabled item inside', 'Fruit selector with disabled item'),
        ],
      },
      { kind: 'box', ref: 'disabledOverlay', children: [] },
    ],
  },
} satisfies DemoSpec;
