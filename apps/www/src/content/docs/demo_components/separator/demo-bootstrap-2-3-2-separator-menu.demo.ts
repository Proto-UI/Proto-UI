import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'flex items-center gap-3 rounded border border-[#e3e3e3] bg-[#f5f5f5] px-4 py-3 text-sm text-[#333333] md:gap-4',
    children: [
      {
        kind: 'box',
        className: 'flex flex-col gap-0.5',
        children: [
          { kind: 'box', tag: 'span', className: 'font-bold', children: ['Settings'] },
          {
            kind: 'box',
            tag: 'span',
            className: 'text-xs text-[#666666]',
            children: ['Manage preferences'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-separator-root',
        props: { orientation: 'vertical' },
      },
      {
        kind: 'box',
        className: 'flex flex-col gap-0.5',
        children: [
          { kind: 'box', tag: 'span', className: 'font-bold', children: ['Account'] },
          {
            kind: 'box',
            tag: 'span',
            className: 'text-xs text-[#666666]',
            children: ['Profile & security'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-separator-root',
        className: 'hidden md:block',
        props: { orientation: 'vertical' },
      },
      {
        kind: 'box',
        className: 'hidden flex-col gap-0.5 md:flex',
        children: [
          { kind: 'box', tag: 'span', className: 'font-bold', children: ['Help'] },
          {
            kind: 'box',
            tag: 'span',
            className: 'text-xs text-[#666666]',
            children: ['Support & docs'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
