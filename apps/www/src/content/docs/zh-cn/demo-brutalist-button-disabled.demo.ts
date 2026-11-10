import type { DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        props: { disabled: true },
        children: ['Disabled'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        props: { variant: 'surface', disabled: true },
        children: ['Disabled surface'],
      },
    ],
  },
} satisfies DemoSpec;
