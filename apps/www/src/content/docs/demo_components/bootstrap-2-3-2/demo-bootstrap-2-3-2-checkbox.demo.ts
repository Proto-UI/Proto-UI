import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-col gap-3',
    children: [
      {
        kind: 'box',
        className: 'flex items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-checkbox-root',
            props: { defaultChecked: false },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-checkbox-indicator',
              },
              { kind: 'box', className: 'sr-only', children: ['Unchecked'] },
            ],
          },
          {
            kind: 'box',
            className: 'text-sm',
            children: ['Unchecked'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-checkbox-root',
            props: { defaultChecked: true },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-checkbox-indicator',
              },
              { kind: 'box', className: 'sr-only', children: ['Checked'] },
            ],
          },
          {
            kind: 'box',
            className: 'text-sm',
            children: ['Checked'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-checkbox-root',
            props: { defaultIndeterminate: true },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-checkbox-indicator',
              },
              { kind: 'box', className: 'sr-only', children: ['Mixed'] },
            ],
          },
          {
            kind: 'box',
            className: 'text-sm',
            children: ['Mixed'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-checkbox-root',
            props: { disabled: true, defaultChecked: true },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-checkbox-indicator',
              },
              { kind: 'box', className: 'sr-only', children: ['Disabled'] },
            ],
          },
          {
            kind: 'box',
            className: 'text-sm',
            children: ['Disabled'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-checkbox-root',
            props: { defaultChecked: false },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-checkbox-indicator',
              },
              { kind: 'box', className: 'sr-only', children: ['Focus ring'] },
            ],
          },
          {
            kind: 'box',
            className: 'text-sm',
            children: ['Tab here for the focus ring'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
