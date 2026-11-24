import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 flex flex-wrap items-center justify-center gap-2 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        ref: 'openBtn',
        children: ['Show Persistent Toast'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        ref: 'closeBtn',
        props: {
          variant: 'surface',
        },
        children: ['Close'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-toast-viewport',
        props: {
          a11yLabel: 'Persistent notifications',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-toast-root',
            ref: 'root',
            props: {
              open: false,
              duration: 0,
              politeness: 'assertive',
              type: 'warning',
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
                        prototypeId: 'brutalist-toast-title',
                        children: ['Connection lost'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'brutalist-toast-description',
                        children: ['Changes are paused until you reconnect or dismiss this notice.'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-toast-close',
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
