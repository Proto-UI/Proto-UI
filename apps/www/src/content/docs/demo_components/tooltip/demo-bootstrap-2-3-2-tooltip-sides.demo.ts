import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const triggerClass =
  'inline-flex items-center justify-center rounded-[4px] border border-[#ccc] bg-[#f5f5f5] px-3 py-1 text-[14px] leading-[20px] text-[#333] shadow-xs hover:bg-[#e6e6e6]';

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
    className: 'flex min-w-0 items-center justify-center p-8',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-tooltip-group',
        ref: 'bsSidesGroup',
        props: { openDelay: 0, closeDelay: 100, skipDelay: 300 },
        children: [
          {
            kind: 'box',
            className: 'flex flex-wrap items-center justify-center gap-3',
            children: sides.map(([side, label]) => ({
              kind: 'proto' as const,
              prototypeId: 'bootstrap-2-3-2-tooltip-root',
              ref: `bsSideRoot-${side}`,
              children: [
                {
                  kind: 'proto' as const,
                  prototypeId: 'bootstrap-2-3-2-tooltip-trigger',
                  ref: `bsSideTrigger-${side}`,
                  className: triggerClass,
                  children: [label],
                },
                {
                  kind: 'proto' as const,
                  prototypeId: 'bootstrap-2-3-2-tooltip-content',
                  ref: `bsSideContent-${side}`,
                  previewTheme: 'portal',
                  props: { side, align: 'center' },
                  children: ['Tooltip on ' + side],
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
