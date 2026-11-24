import type { DemoNode, DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

type ResizableFamily = 'base' | 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass';

const supportsNestedVariant = (family: string) =>
  family === 'brutalist' || family === 'liquid-glass';

const supportsWithHandle = (family: string) => family !== 'base';

function outerFrameClass(family: string, sizeClass = 'h-56 w-full max-w-md'): string {
  if (family === 'brutalist') return sizeClass;
  if (family === 'liquid-glass') return `${sizeClass.replace(/max-w-\S+/, '')} w-full`.trim();
  if (family === 'bootstrap-2-3-2') {
    return `${sizeClass} rounded-[4px] border border-[#ccc] bg-background shadow-[0_1px_3px_rgb(0_0_0/5.5%)] overflow-hidden`;
  }
  return `${sizeClass} rounded-lg border border-border bg-background overflow-hidden`;
}

function wrapStage(family: string, node: DemoNode, maxWidthClass = 'max-w-lg'): DemoNode {
  if (family !== 'liquid-glass') return node;
  return {
    kind: 'box',
    className: `w-full ${maxWidthClass} rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6`,
    children: [node],
  };
}

function makePanel(family: string, index: number, children: DemoNode[]): DemoNode {
  return {
    kind: 'proto',
    prototypeId: `${family}-resizable-panel`,
    props: { index },
    className: 'min-w-0 min-h-0',
    children,
  };
}

function makeHandle(
  family: string,
  index: number,
  options: { vertical?: boolean; withHandle?: boolean; prominence?: 'regular' | 'prominent' } = {}
): DemoNode {
  const props: Record<string, unknown> = { index };
  if (supportsWithHandle(family) && options.withHandle) {
    props.withHandle = true;
  }
  if (family === 'liquid-glass' && options.prominence) {
    props.prominence = options.prominence;
  }
  return {
    kind: 'proto',
    prototypeId: `${family}-resizable-handle`,
    props,
    ...(family === 'base'
      ? { className: options.vertical ? 'h-2 shrink-0 bg-border' : 'w-2 shrink-0 bg-border' }
      : {}),
  };
}

function paneLabel(label: string, extraClass = 'h-full'): DemoNode {
  return {
    kind: 'box',
    className: `flex ${extraClass} items-center justify-center p-6`,
    children: [
      {
        kind: 'box',
        tag: 'span',
        className: 'font-semibold text-sm',
        children: [label],
      },
    ],
  };
}

/** Hero nested layout matching upstream One / Two / Three composition. */
export function createResizableDemo(family: ResizableFamily | string): DemoSpec {
  const nested: DemoNode = {
    kind: 'proto',
    prototypeId: `${family}-resizable-root`,
    props: {
      defaultSizes: [25, 75],
      constraints: [{ min: 20 }, { min: 25 }],
      orientation: 'vertical',
      ...(supportsNestedVariant(family) ? { variant: 'nested' } : {}),
    },
    className: 'h-full w-full min-h-0',
    children: [
      makePanel(family, 0, [paneLabel('Two')]),
      makeHandle(family, 0, { vertical: true, withHandle: true }),
      makePanel(family, 1, [paneLabel('Three')]),
    ],
  };
  const group: DemoNode = {
    kind: 'proto',
    prototypeId: `${family}-resizable-root`,
    props: {
      defaultSizes: [50, 50],
      constraints: [{ min: 20, max: 75, collapsible: true }, { min: 25 }],
    },
    className: outerFrameClass(family, 'h-56 w-full max-w-md'),
    children: [
      makePanel(family, 0, [paneLabel('One')]),
      makeHandle(family, 0, { withHandle: true }),
      makePanel(family, 1, [nested]),
    ],
  };
  return {
    type: 'demo',
    root: wrapStage(family, group, 'max-w-lg'),
  };
}

/** Standalone vertical split matching upstream Header / Content example. */
export function createResizableVerticalDemo(family: ResizableFamily | string): DemoSpec {
  const group: DemoNode = {
    kind: 'proto',
    prototypeId: `${family}-resizable-root`,
    props: {
      orientation: 'vertical',
      defaultSizes: [25, 75],
      constraints: [{ min: 20 }, { min: 25 }],
    },
    className: outerFrameClass(family, 'h-56 w-full max-w-md'),
    children: [
      makePanel(family, 0, [paneLabel('Header')]),
      makeHandle(family, 0, { vertical: true, withHandle: false }),
      makePanel(family, 1, [paneLabel('Content')]),
    ],
  };
  return {
    type: 'demo',
    root: wrapStage(family, group, 'max-w-lg'),
  };
}

/** Comparison of visible grip handles vs default hairline separators. */
export function createResizableHandleDemo(family: ResizableFamily | string): DemoSpec {
  const withGripGroup: DemoNode = {
    kind: 'proto',
    prototypeId: `${family}-resizable-root`,
    props:
      family === 'liquid-glass'
        ? {
            defaultSizes: [25, 50, 25],
            constraints: [{ min: 15 }, { min: 30 }, { min: 15 }],
          }
        : {
            defaultSizes: [25, 75],
            constraints: [{ min: 15 }, { min: 30 }],
          },
    className: outerFrameClass(family, 'h-40 w-full max-w-md'),
    children:
      family === 'liquid-glass'
        ? [
            makePanel(family, 0, [paneLabel('Sidebar')]),
            makeHandle(family, 0, { withHandle: true, prominence: 'regular' }),
            makePanel(family, 1, [paneLabel('Content')]),
            makeHandle(family, 1, { withHandle: true, prominence: 'prominent' }),
            makePanel(family, 2, [paneLabel('Details')]),
          ]
        : [
            makePanel(family, 0, [paneLabel('Sidebar')]),
            makeHandle(family, 0, { withHandle: true }),
            makePanel(family, 1, [paneLabel('Content')]),
          ],
  };
  const hairlineGroup: DemoNode = {
    kind: 'proto',
    prototypeId: `${family}-resizable-root`,
    props: {
      defaultSizes: [50, 50],
      constraints: [{ min: 20 }, { min: 20 }],
    },
    className: outerFrameClass(family, 'h-32 w-full max-w-md'),
    children: [
      makePanel(family, 0, [paneLabel('Left')]),
      makeHandle(family, 0, { withHandle: false }),
      makePanel(family, 1, [paneLabel('Right')]),
    ],
  };
  const stack: DemoNode = {
    kind: 'box',
    className: 'flex w-full max-w-md flex-col gap-4',
    children: [withGripGroup, hairlineGroup],
  };
  return {
    type: 'demo',
    root: wrapStage(family, stack, 'max-w-lg'),
  };
}

/** Right-to-left nested split matching upstream RTL example. */
export function createResizableRtlDemo(family: ResizableFamily | string): DemoSpec {
  const nested: DemoNode = {
    kind: 'proto',
    prototypeId: `${family}-resizable-root`,
    props: {
      orientation: 'vertical',
      direction: 'rtl',
      defaultSizes: [25, 75],
      constraints: [{ min: 20 }, { min: 25 }],
      ...(supportsNestedVariant(family) ? { variant: 'nested' } : {}),
    },
    className: 'h-full w-full min-h-0',
    children: [
      makePanel(family, 0, [paneLabel('اثنان')]),
      makeHandle(family, 0, { vertical: true, withHandle: true }),
      makePanel(family, 1, [paneLabel('ثلاثة')]),
    ],
  };
  const group: DemoNode = {
    kind: 'proto',
    prototypeId: `${family}-resizable-root`,
    props: {
      orientation: 'horizontal',
      direction: 'rtl',
      defaultSizes: [50, 50],
      constraints: [{ min: 20 }, { min: 20 }],
    },
    className: outerFrameClass(family, 'h-56 w-full max-w-md'),
    children: [
      makePanel(family, 0, [paneLabel('واحد')]),
      makeHandle(family, 0, { withHandle: true }),
      makePanel(family, 1, [nested]),
    ],
  };
  return {
    type: 'demo',
    root: wrapStage(family, group, 'max-w-lg'),
  };
}

/** Three-panel workspace with collapsible leading panel and per-panel constraints. */
export function createResizableCollapsibleDemo(family: ResizableFamily | string): DemoSpec {
  const group: DemoNode = {
    kind: 'proto',
    prototypeId: `${family}-resizable-root`,
    props: {
      defaultSizes: [25, 50, 25],
      constraints: [{ min: 15, max: 35, collapsible: true }, { min: 30 }, { min: 15, max: 35 }],
    },
    className: outerFrameClass(family, 'h-56 w-full max-w-2xl'),
    children: [
      makePanel(family, 0, [paneLabel('Sidebar')]),
      makeHandle(family, 0, { withHandle: true }),
      makePanel(family, 1, [paneLabel('Editor')]),
      makeHandle(family, 1, { withHandle: true }),
      makePanel(family, 2, [paneLabel('Inspector')]),
    ],
  };
  return {
    type: 'demo',
    root: wrapStage(family, group, 'max-w-2xl'),
  };
}
