import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex items-center justify-center',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-toggle-group-root',
        props: {
          multiple: true,
          orientation: 'vertical',
          defaultValue: ['bold', 'italic'],
          a11yLabel: 'Vertical text formatting',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle-group-item',
            props: { value: 'bold' },
            children: ['Bold'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle-group-item',
            props: { value: 'italic' },
            children: ['Italic'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle-group-item',
            props: { value: 'underline' },
            children: ['Underline'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
