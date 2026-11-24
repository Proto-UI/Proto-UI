import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'flex h-9 items-center gap-4 rounded border border-[#e3e3e3] bg-[#f5f5f5] px-4 py-2 text-sm text-[#333333]',
    children: [
      { kind: 'box', children: ['Blog'] },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-separator-root',
        props: { orientation: 'vertical' },
      },
      { kind: 'box', children: ['Docs'] },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-separator-root',
        props: { orientation: 'vertical' },
      },
      { kind: 'box', children: ['Source'] },
    ],
  },
} satisfies DemoSpec;
