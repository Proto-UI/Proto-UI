import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-3',
    children: [
      { kind: 'proto', prototypeId: 'bootstrap-2-3-2-button', children: ['Default'] },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-button',
        props: { variant: 'primary' },
        children: ['Primary'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-button',
        props: { variant: 'info' },
        children: ['Info'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-button',
        props: { variant: 'success' },
        children: ['Success'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-button',
        props: { variant: 'warning' },
        children: ['Warning'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-button',
        props: { variant: 'danger' },
        children: ['Danger'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-button',
        props: { variant: 'inverse' },
        children: ['Inverse'],
      },
    ],
  },
} satisfies DemoSpec;
