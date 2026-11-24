import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

function makeSideMenu(side: 'top' | 'right' | 'bottom' | 'left') {
  return {
    kind: 'proto' as const,
    prototypeId: 'bootstrap-2-3-2-context-menu-root',
    children: [
      {
        kind: 'proto' as const,
        prototypeId: 'bootstrap-2-3-2-context-menu-trigger',
        className:
          'flex h-28 w-full items-center justify-center rounded border border-dashed border-border bg-secondary px-3 text-sm text-foreground',
        children: [`Right click (${side})`],
      },
      {
        kind: 'proto' as const,
        prototypeId: 'bootstrap-2-3-2-context-menu-content',
        props: { side, sideOffset: 4 },
        children: [
          {
            kind: 'proto' as const,
            prototypeId: 'bootstrap-2-3-2-context-menu-item',
            props: { value: 'back', textValue: 'Back' },
            children: ['Back'],
          },
          {
            kind: 'proto' as const,
            prototypeId: 'bootstrap-2-3-2-context-menu-item',
            props: { value: 'forward', textValue: 'Forward' },
            children: ['Forward'],
          },
          {
            kind: 'proto' as const,
            prototypeId: 'bootstrap-2-3-2-context-menu-item',
            props: { value: 'reload', textValue: 'Reload' },
            children: ['Reload'],
          },
        ],
      },
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full max-w-md grid-cols-2 gap-4 p-4',
    children: [
      makeSideMenu('top'),
      makeSideMenu('right'),
      makeSideMenu('bottom'),
      makeSideMenu('left'),
    ],
  },
} satisfies DemoSpec;
