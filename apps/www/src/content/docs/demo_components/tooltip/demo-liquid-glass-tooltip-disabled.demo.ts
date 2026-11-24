import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'flex w-full min-w-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-8',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-tooltip-root',
        ref: 'lgDisabledRoot',
        props: { openDelay: 0, closeDelay: 100 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-tooltip-trigger',
            ref: 'lgDisabledTrigger',
            className: 'inline-block w-fit',
            children: [
              {
                kind: 'box',
                tag: 'span',
                attrs: { 'aria-disabled': 'true' },
                className:
                  'inline-flex items-center justify-center rounded-full border border-border bg-muted px-4 py-1.5 text-sm font-medium text-muted-foreground cursor-not-allowed',
                children: ['Disabled'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-tooltip-content',
            ref: 'lgDisabledContent',
            previewTheme: 'portal',
            props: { side: 'top', align: 'center' },
            children: ['This feature is currently unavailable'],
          },
        ],
      },
    ],
  },
};

export default demo;
