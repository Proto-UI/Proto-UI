import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-toggle',
        props: { variant: 'outline', size: 'sm' },
        children: ['Small'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-toggle',
        props: { variant: 'outline', size: 'default' },
        children: ['Default'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-toggle',
        props: { variant: 'outline', size: 'lg' },
        children: ['Large'],
      },
    ],
  },
} satisfies DemoSpec;
