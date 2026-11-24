import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-toggle',
        props: { size: 'mini' },
        children: ['Mini'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-toggle',
        props: { size: 'small' },
        children: ['Small'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-toggle',
        props: { size: 'default', defaultActive: true },
        children: ['Default'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-toggle',
        props: { size: 'large' },
        children: ['Large'],
      },
    ],
  },
} satisfies DemoSpec;
