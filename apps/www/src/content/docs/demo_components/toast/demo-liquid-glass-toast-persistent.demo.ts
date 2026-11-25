import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'min-w-0 w-full rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 flex flex-wrap items-center justify-center gap-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-button',
        ref: 'openBtn',
        children: ['Show Persistent Toast'],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-button',
        ref: 'closeBtn',
        children: ['Close'],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-toast-viewport',
        previewTheme: 'portal',
        ref: 'viewport',
        props: {
          a11yLabel: 'Persistent notifications',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toast-root',
            ref: 'root',
            props: {
              open: false,
              duration: 0,
              politeness: 'assertive',
              prominence: 'destructive',
            },
            children: [
              {
                kind: 'box',
                className: 'flex items-start justify-between gap-4 min-w-0',
                children: [
                  {
                    kind: 'box',
                    className: 'grid gap-1 min-w-0',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'liquid-glass-toast-title',
                        children: ['Connection lost'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'liquid-glass-toast-description',
                        children: [
                          'Changes are paused until you reconnect or dismiss this notice.',
                        ],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-toast-close',
                    children: ['Dismiss'],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  setup({ api }) {
    const setOpen = (next: boolean) => {
      api.setProps('root', { open: next });
    };
    api.setProps('openBtn', {
      onClick: () => setOpen(true),
    });
    api.setProps('closeBtn', {
      onClick: () => setOpen(false),
    });
    api.setProps('root', {
      onOpenChange: (detail: { open?: boolean }) => {
        if (detail && typeof detail.open === 'boolean') setOpen(detail.open);
      },
    });
  },
} satisfies DemoSpec;
