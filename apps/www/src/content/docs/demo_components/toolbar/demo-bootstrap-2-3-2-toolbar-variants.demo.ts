import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 grid justify-items-center gap-3 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-toolbar-root',
        props: { a11yLabel: 'Classic Bootstrap variants' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toolbar-button',
            props: { value: 'default', variant: 'default' },
            children: ['Default'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toolbar-button',
            props: { value: 'primary', variant: 'primary' },
            children: ['Primary'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toolbar-button',
            props: { value: 'success', variant: 'success' },
            children: ['Success'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toolbar-separator',
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toolbar-button',
            props: { value: 'warning', variant: 'warning' },
            children: ['Warning'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toolbar-button',
            props: { value: 'danger', variant: 'danger' },
            children: ['Danger'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toolbar-button',
            props: { value: 'inverse', variant: 'inverse', size: 'small' },
            children: ['Small'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
