import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-col items-start gap-4 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-toggle-group-root',
        props: {
          size: 'mini',
          defaultValue: ['left'],
          a11yLabel: 'Mini alignment group',
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
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-toggle-group-root',
        props: {
          size: 'small',
          variant: 'primary',
          defaultValue: ['left'],
          a11yLabel: 'Small primary alignment group',
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
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-toggle-group-root',
        props: {
          size: 'large',
          variant: 'danger',
          defaultValue: ['left'],
          a11yLabel: 'Large danger alignment group',
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
