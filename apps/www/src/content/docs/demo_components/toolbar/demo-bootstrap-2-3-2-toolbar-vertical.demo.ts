import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 flex items-center justify-center p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-toolbar-root',
        props: { orientation: 'vertical', a11yLabel: 'Vertical command bar' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toolbar-button',
            props: { value: 'align-left' },
            children: ['Align Left'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toolbar-button',
            props: { value: 'align-center' },
            children: ['Align Center'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toolbar-separator',
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toolbar-button',
            props: { value: 'indent' },
            children: ['Indent'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toolbar-button',
            props: { value: 'outdent' },
            children: ['Outdent'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
