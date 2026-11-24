import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const LABEL_CLASS = 'text-sm font-medium leading-none text-foreground select-none';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-x-6 gap-y-4',
    children: [
      {
        kind: 'box',
        className: 'inline-flex items-center gap-2.5',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-switch-root',
            props: { defaultChecked: false },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-switch-thumb',
              },
              { kind: 'box', className: 'sr-only', children: ['Email alerts'] },
            ],
          },
          {
            kind: 'box',
            tag: 'span',
            className: LABEL_CLASS,
            children: ['Email alerts'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'inline-flex items-center gap-2.5',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-switch-root',
            props: { defaultChecked: true },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-switch-thumb',
              },
              { kind: 'box', className: 'sr-only', children: ['Release alerts'] },
            ],
          },
          {
            kind: 'box',
            tag: 'span',
            className: LABEL_CLASS,
            children: ['Release alerts'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'inline-flex items-center gap-2.5',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-switch-root',
            props: { disabled: true, defaultChecked: true },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-switch-thumb',
              },
              { kind: 'box', className: 'sr-only', children: ['Archived alerts'] },
            ],
          },
          {
            kind: 'box',
            tag: 'span',
            className: 'text-sm font-medium leading-none text-muted-foreground select-none',
            children: ['Archived alerts'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
