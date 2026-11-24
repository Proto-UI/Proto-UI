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
        props: { variant: 'default' },
        children: ['Default'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-toggle',
        props: { variant: 'primary', defaultActive: true },
        children: ['Primary'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-toggle',
        props: { variant: 'success' },
        children: ['Success'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-toggle',
        props: { variant: 'info' },
        children: ['Info'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-toggle',
        props: { variant: 'warning' },
        children: ['Warning'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-toggle',
        props: { variant: 'danger' },
        children: ['Danger'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-toggle',
        props: { variant: 'inverse' },
        children: ['Inverse'],
      },
    ],
  },
} satisfies DemoSpec;
