import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    attrs: { dir: 'rtl' },
    className: 'flex w-full max-w-sm flex-col gap-4 text-sm',
    children: [
      {
        kind: 'box',
        className: 'flex flex-col gap-1.5',
        children: [
          { kind: 'box', className: 'leading-none font-bold', children: ['Proto UI'] },
          {
            kind: 'box',
            className: 'text-muted-foreground',
            children: ['الأساس لنظام التصميم الخاص بك'],
          },
        ],
      },
      { kind: 'proto', prototypeId: 'brutalist-separator-root' },
      {
        kind: 'box',
        children: ['مجموعة من المكونات القابلة للتخصيص والتوسيع والبناء عليها.'],
      },
    ],
  },
} satisfies DemoSpec;
