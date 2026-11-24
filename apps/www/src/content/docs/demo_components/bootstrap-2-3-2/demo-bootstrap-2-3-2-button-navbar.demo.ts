import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-2 rounded-[4px] bg-[#006dcc] px-3 py-2 shadow-sm',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-button',
        props: { colorContext: 'navbar' },
        children: ['Overview'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-button',
        props: { colorContext: 'navbar' },
        children: ['Components'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-button',
        props: { colorContext: 'navbar', disabled: true },
        children: ['Archive'],
      },
    ],
  },
} satisfies DemoSpec;
