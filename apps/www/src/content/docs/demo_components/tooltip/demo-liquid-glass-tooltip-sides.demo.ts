import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const triggerClass =
  'inline-flex items-center justify-center rounded-full border border-border bg-secondary px-4 py-1.5 text-sm font-medium text-secondary-foreground shadow-sm';

const sides = [
  ['left', 'Left'],
  ['top', 'Top'],
  ['bottom', 'Bottom'],
  ['right', 'Right'],
] as const;

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'flex w-full min-w-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-8',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-tooltip-group',
        ref: 'lgSidesGroup',
        props: { openDelay: 0, closeDelay: 100, skipDelay: 300 },
        children: [
          {
            kind: 'box',
            className: 'flex flex-wrap items-center justify-center gap-3',
            children: sides.map(([side, label]) => ({
              kind: 'proto' as const,
              prototypeId: 'liquid-glass-tooltip-root',
              ref: `lgSideRoot-${side}`,
              children: [
                {
                  kind: 'proto' as const,
                  prototypeId: 'liquid-glass-tooltip-trigger',
                  ref: `lgSideTrigger-${side}`,
                  className: triggerClass,
                  children: [label],
                },
                {
                  kind: 'proto' as const,
                  prototypeId: 'liquid-glass-tooltip-content',
                  ref: `lgSideContent-${side}`,
                  previewTheme: 'portal',
                  props: { side, align: 'center' },
                  children: ['Add to library'],
                },
              ],
            })),
          },
        ],
      },
    ],
  },
};

export default demo;
