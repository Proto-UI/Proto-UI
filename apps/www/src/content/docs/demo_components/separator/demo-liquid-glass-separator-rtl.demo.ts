import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'w-full max-w-md rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'box',
        attrs: { dir: 'rtl' },
        className:
          'flex flex-col gap-4 rounded-xl bg-background/75 p-4 text-sm shadow-sm ring-1 ring-border/50 backdrop-blur-md',
        children: [
          {
            kind: 'box',
            className: 'flex flex-col gap-1.5',
            children: [
              { kind: 'box', className: 'leading-none font-semibold', children: ['Proto UI'] },
              {
                kind: 'box',
                className: 'text-muted-foreground',
                children: ['الأساس لنظام التصميم الخاص بك'],
              },
            ],
          },
          { kind: 'proto', prototypeId: 'liquid-glass-separator-root' },
          {
            kind: 'box',
            children: ['مجموعة من المكونات القابلة للتخصيص والتوسيع والبناء عليها.'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
