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
          multiple: true,
          defaultValue: ['bold'],
          a11yLabel: 'Text formatting',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toggle-group-item',
            props: { value: 'bold' },
            children: ['Bold'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toggle-group-item',
            props: { value: 'italic' },
            children: ['Italic'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toggle-group-item',
            props: { value: 'underline' },
            children: ['Underline'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
