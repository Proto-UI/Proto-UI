import { withShadcnRheaDemo } from '../shadcn-demo-style';
import type { DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'shadcn-select-root',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-select-trigger',
        className: 'w-48',
        props: { accessibleLabel: 'Fruit selector' },
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
                        children: ['Fruits'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-select-item',
                        props: { value: 'apple', textValue: 'Apple' },
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: 'shadcn-select-item-text',
                            children: ['Apple'],
                          },
                        ],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-select-item',
                        props: { value: 'banana', textValue: 'Banana' },
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: 'shadcn-select-item-text',
                            children: ['Banana'],
                          },
                        ],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-select-item',
                        props: { value: 'blueberry', textValue: 'Blueberry' },
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: 'shadcn-select-item-text',
                            children: ['Blueberry'],
                          },
                        ],
                      },
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
                        children: ['Vegetables'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-select-item',
                        props: { value: 'carrot', textValue: 'Carrot' },
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: 'shadcn-select-item-text',
                            children: ['Carrot'],
                          },
                        ],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-select-item',
                        props: { value: 'broccoli', textValue: 'Broccoli' },
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: 'shadcn-select-item-text',
                            children: ['Broccoli'],
                          },
                        ],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-select-item',
                        props: { value: 'spinach', textValue: 'Spinach' },
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: 'shadcn-select-item-text',
                            children: ['Spinach'],
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
  },
} satisfies DemoSpec);
