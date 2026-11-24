import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-button',
        props: { disabled: true },
        children: ['Default disabled'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-button',
        props: { variant: 'primary', disabled: true },
        children: ['Primary disabled'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-button',
        props: { variant: 'danger', disabled: true },
        children: ['Danger disabled'],
      },
    ],
  },
} satisfies DemoSpec;
