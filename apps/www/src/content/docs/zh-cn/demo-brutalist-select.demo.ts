import type { DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'brutalist-select-root',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-select-trigger',
        className: 'w-48',
        props: { accessibleLabel: 'Fruit selector' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-select-value',
            props: { placeholder: 'Select a fruit' },
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
            props: { value: 'banana', textValue: 'Banana' },
            children: ['Banana'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-select-item',
            props: { value: 'blueberry', textValue: 'Blueberry' },
            children: ['Blueberry'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-select-item',
            props: { value: 'grapes', textValue: 'Grapes' },
            children: ['Grapes'],
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
} satisfies DemoSpec;
