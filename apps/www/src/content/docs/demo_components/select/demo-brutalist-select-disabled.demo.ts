import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-select-root',
        props: { disabled: true },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-select-trigger',
            className: 'w-48',
            props: { accessibleLabel: 'Disabled selector' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-select-value',
                props: { placeholder: 'Disabled select' },
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-select-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-select-item',
                props: { value: 'apple', textValue: 'Apple' },
                children: ['Apple'],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-select-root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-select-trigger',
            className: 'w-48',
            props: { accessibleLabel: 'Fruit selector with disabled item' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-select-value',
                props: { placeholder: 'Disabled item inside' },
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-select-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-select-item',
                props: { value: 'apple', textValue: 'Apple' },
                children: ['Apple'],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-select-item',
                props: { value: 'grapes', textValue: 'Grapes (Sold out)', disabled: true },
                children: ['Grapes (Sold out)'],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-select-item',
                props: { value: 'pineapple', textValue: 'Pineapple' },
                children: ['Pineapple'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
