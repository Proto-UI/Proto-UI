import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const MIX_PRESETS = [
  { name: 'Acoustic', note: 'Balanced mid-range for vocals and live instruments.' },
  { name: 'Late Night', note: 'Reduces loud peaks while keeping dialogue crisp.' },
  { name: 'Studio Reference', note: 'Flat frequency response with zero coloration.' },
  { name: 'Cinema', note: 'Expanded spatial depth with warmer low-end presence.' },
  { name: 'Podcast', note: 'Prioritizes spoken voice clarity and reduces rumble.' },
  { name: 'Electronic', note: 'Punchy sub-bass and sparkling transient highs.' },
];

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'flex min-w-0 w-full flex-wrap items-center justify-center gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-drawer-root',
        ref: 'root',
        props: {
          a11yLabel: 'Equalizer presets',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-drawer-trigger',
            children: ['Scrollable Content'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-drawer-mask',
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-drawer-content',
            ref: 'panel',
            props: {
              side: 'bottom',
              maxExtent: { unit: 'logical', value: 420 },
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-drawer-handle',
                props: { a11yLabel: 'Resize drawer' },
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-drawer-header',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-drawer-title',
                    children: ['Sound Presets'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-drawer-description',
                    children: ['Scroll through presets inside the translucent sheet.'],
                  },
                ],
              },
              {
                kind: 'box',
                className: 'flex-1 overflow-y-auto px-4 py-2 space-y-2',
                children: MIX_PRESETS.map((preset) => ({
                  kind: 'box' as const,
                  className: 'rounded-xl border border-border px-3 py-2.5 space-y-0.5',
                  children: [
                    { kind: 'box' as const, className: 'text-sm font-medium', children: [preset.name] },
                    {
                      kind: 'box' as const,
                      className: 'text-xs text-muted-foreground',
                      children: [preset.note],
                    },
                  ],
                })),
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-drawer-footer',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-drawer-close',
                    children: ['Close'],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
