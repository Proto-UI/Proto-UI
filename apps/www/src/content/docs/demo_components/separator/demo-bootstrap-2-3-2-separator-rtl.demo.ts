import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    attrs: { dir: 'rtl' },
    className:
      'flex w-full max-w-sm flex-col gap-4 rounded border border-[#e3e3e3] bg-[#f5f5f5] p-4 text-sm text-[#333333]',
    children: [
      {
        kind: 'box',
        className: 'flex flex-col gap-1',
        children: [
          { kind: 'box', className: 'leading-none font-bold', children: ['Proto UI'] },
          {
            kind: 'box',
            className: 'text-[#666666]',
            children: ['الأساس لنظام التصميم الخاص بك'],
          },
        ],
      },
      { kind: 'proto', prototypeId: 'bootstrap-2-3-2-separator-root' },
      {
        kind: 'box',
        children: ['مجموعة من المكونات القابلة للتخصيص والتوسيع والبناء عليها.'],
      },
    ],
  },
} satisfies DemoSpec;
