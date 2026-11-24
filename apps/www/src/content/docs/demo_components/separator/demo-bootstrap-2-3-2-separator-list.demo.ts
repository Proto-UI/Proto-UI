import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'flex w-full max-w-sm flex-col gap-2.5 rounded border border-[#e3e3e3] bg-[#f5f5f5] p-4 text-sm text-[#333333]',
    children: [
      {
        kind: 'box',
        className: 'flex items-center justify-between',
        children: [
          { kind: 'box', tag: 'span', children: ['Item 1'] },
          { kind: 'box', tag: 'span', className: 'text-[#666666]', children: ['Value 1'] },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-separator-root',
        props: { decorative: false },
      },
      {
        kind: 'box',
        className: 'flex items-center justify-between',
        children: [
          { kind: 'box', tag: 'span', children: ['Item 2'] },
          { kind: 'box', tag: 'span', className: 'text-[#666666]', children: ['Value 2'] },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-separator-root',
        props: { decorative: false },
      },
      {
        kind: 'box',
        className: 'flex items-center justify-between',
        children: [
          { kind: 'box', tag: 'span', children: ['Item 3'] },
          { kind: 'box', tag: 'span', className: 'text-[#666666]', children: ['Value 3'] },
        ],
      },
    ],
  },
} satisfies DemoSpec;
