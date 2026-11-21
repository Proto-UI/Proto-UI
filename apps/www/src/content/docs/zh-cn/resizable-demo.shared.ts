import type { DemoNode, DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

/** Consumer composition only: all ownership, input and layout ratios belong to the prototypes. */
export function createResizableDemo(family: string): DemoSpec {
  const handle = (index: number, vertical = false): DemoNode => ({
    kind: 'proto',
    prototypeId: `${family}-resizable-handle`,
    props: { index, ...(family === 'shadcn' ? { withHandle: true } : {}) },
    ...(family === 'base'
      ? { className: vertical ? 'h-2 shrink-0 bg-slate-300' : 'w-2 shrink-0 bg-slate-300' }
      : {}),
  });
  const panel = (index: number, children: DemoNode[] | string[]): DemoNode => ({
    kind: 'proto',
    prototypeId: `${family}-resizable-panel`,
    props: { index },
    className: 'min-w-0 min-h-0',
    children,
  });
  const text = (label: string): DemoNode => ({
    kind: 'box',
    className: 'p-4 text-sm',
    children: [label],
  });
  const nested: DemoNode = {
    kind: 'proto',
    prototypeId: `${family}-resizable-root`,
    props: {
      defaultSizes: [60, 40],
      constraints: [{ min: 20 }, { min: 20 }],
      orientation: 'vertical',
    },
    className: 'h-full w-full min-h-0',
    children: [
      panel(0, [text('Preview')]),
      handle(0, true),
      panel(1, [text('Details · independent vertical group')]),
    ],
  };
  return {
    type: 'demo',
    root: {
      kind: 'proto',
      prototypeId: `${family}-resizable-root`,
      props: {
        defaultSizes: [25, 40, 35],
        constraints: [{ min: 15, max: 45, collapsible: true }, { min: 20 }, { min: 20 }],
      },
      className: 'h-64 w-full max-w-3xl border border-slate-300',
      children: [
        panel(0, [text('Navigation · Enter collapses')]),
        handle(0),
        panel(1, [text('Editor · drag either separator')]),
        handle(1),
        panel(2, [nested]),
      ],
    },
  };
}
