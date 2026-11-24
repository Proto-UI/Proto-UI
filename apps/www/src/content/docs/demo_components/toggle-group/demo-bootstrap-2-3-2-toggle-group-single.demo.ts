import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex items-center justify-center p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-toggle-group-root',
        props: {
          defaultValue: ['left'],
          a11yLabel: 'Text alignment',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toggle-group-item',
            props: { value: 'left' },
            children: ['Left'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toggle-group-item',
            props: { value: 'middle' },
            children: ['Middle'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toggle-group-item',
            props: { value: 'right' },
            children: ['Right'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
