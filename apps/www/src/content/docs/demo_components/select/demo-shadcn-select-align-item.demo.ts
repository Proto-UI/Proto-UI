import type { DemoNode, DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const fruits = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'blueberry', label: 'Blueberry' },
  { value: 'grapes', label: 'Grapes' },
  { value: 'pineapple', label: 'Pineapple' },
] as const;

function fruitItem(value: string, label: string): DemoNode {
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
    className: 'flex flex-col gap-3',
    children: [
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-3',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            ref: 'togglePosition',
            props: { variant: 'outline', size: 'sm' },
            children: ['Position: item-aligned'],
          },
          {
            kind: 'box',
            ref: 'positionHint',
            className: 'text-xs text-muted-foreground',
            children: ['Selected item aligns over the trigger.'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-select-root',
        props: { defaultValue: 'banana' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-select-trigger',
            className: 'w-48',
            props: { accessibleLabel: 'Fruit alignment selector' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-select-value',
                props: { placeholder: 'Select a fruit' },
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-select-content',
            ref: 'alignedContent',
            props: { position: 'item-aligned' },
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
                        children: fruits.map((entry) => fruitItem(entry.value, entry.label)),
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
  setup({ api, refs }) {
    let alive = true;
    let position: 'item-aligned' | 'popper' = 'item-aligned';
    const apply = () => {
      if (!alive) return;
      api.setProps('alignedContent', { position });
      refs.togglePosition.textContent = `Position: ${position}`;
      refs.positionHint.textContent =
        position === 'item-aligned'
          ? 'Selected item aligns over the trigger.'
          : 'Popup aligns to the trigger edge.';
    };
    api.setProps('togglePosition', {
      onClick: () => {
        position = position === 'item-aligned' ? 'popper' : 'item-aligned';
        apply();
      },
    });
    return () => {
      alive = false;
    };
  },
} satisfies DemoSpec);
