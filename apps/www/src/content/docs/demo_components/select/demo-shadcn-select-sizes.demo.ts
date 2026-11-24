import type { DemoNode, DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

function sizeSelect(size: 'sm' | 'default', placeholder: string): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'shadcn-select-root',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-select-trigger',
        className: 'w-44',
        props: { size, accessibleLabel: `${size} size selector` },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-select-value',
            props: { placeholder },
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
                        prototypeId: 'shadcn-select-item',
                        props: { value: 'light', textValue: 'Light' },
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: 'shadcn-select-item-text',
                            children: ['Light'],
                          },
                        ],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-select-item',
                        props: { value: 'dark', textValue: 'Dark' },
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: 'shadcn-select-item-text',
                            children: ['Dark'],
                          },
                        ],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-select-item',
                        props: { value: 'system', textValue: 'System' },
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: 'shadcn-select-item-text',
                            children: ['System'],
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
    ],
  };
}

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-4',
    children: [sizeSelect('sm', 'Small (sm)'), sizeSelect('default', 'Default')],
  },
} satisfies DemoSpec);
