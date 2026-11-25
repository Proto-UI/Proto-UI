import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full min-w-0 items-center justify-center',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-tooltip-root',
        ref: 'lgShortcutRoot',
        props: { openDelay: 0, closeDelay: 100 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-tooltip-trigger',
            ref: 'lgShortcutTrigger',
            className:
              'inline-flex items-center justify-center rounded-full border border-border bg-secondary px-4 py-1.5 text-sm font-medium text-secondary-foreground shadow-sm',
            children: ['Save'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-tooltip-content',
            ref: 'lgShortcutContent',
            previewTheme: 'portal',
            props: { side: 'top', align: 'center' },
            children: [
              'Save Changes',
              {
                kind: 'box',
                tag: 'span',
                className:
                  'inline-flex h-4 min-w-4 items-center justify-center rounded border border-border bg-background px-1 font-mono text-[10px] leading-none text-foreground',
                children: ['S'],
              },
            ],
          },
        ],
      },
    ],
  },
};

export default demo;
