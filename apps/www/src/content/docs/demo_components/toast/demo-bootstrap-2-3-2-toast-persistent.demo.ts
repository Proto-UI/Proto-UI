import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 flex flex-wrap items-center justify-center gap-2 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-button',
        ref: 'openBtn',
        children: ['Show Persistent Toast'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-button',
        ref: 'closeBtn',
        children: ['Close'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-toast-viewport',
        previewTheme: 'portal',
        ref: 'viewport',
        props: {
          a11yLabel: 'Persistent notifications',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toast-root',
            ref: 'root',
            props: {
              open: false,
              duration: 0,
              politeness: 'assertive',
              variant: 'error',
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-toast-close',
                children: ['×'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-toast-title',
                children: ['Connection lost'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-toast-description',
                children: ['Changes are paused until you reconnect or dismiss this notice.'],
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
