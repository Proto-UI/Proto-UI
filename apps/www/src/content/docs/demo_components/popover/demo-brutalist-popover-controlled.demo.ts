import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-3 p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-popover-root',
        ref: 'root',
        props: {
          open: false,
          a11yLabel: 'Controlled popover',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-popover-trigger',
            children: ['Quick settings'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-popover-content',
            previewTheme: 'portal',
            className: 'w-72',
            children: [
              {
                kind: 'box',
                className: 'grid gap-1',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-popover-title',
                    children: ['Notifications'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-popover-description',
                    children: ['Controlled by parent state via open and openChange.'],
                  },
                ],
              },
              {
                kind: 'box',
                className: 'flex justify-end',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-popover-close',
                    children: ['Dismiss'],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        ref: 'openBtn',
        children: ['Open externally'],
      },
      {
        kind: 'box',
        tag: 'span',
        ref: 'badge',
        className: 'rounded-[5px] border-2 border-black px-2.5 py-1 text-xs font-medium',
        children: ['State: closed'],
      },
    ],
  },
  setup({ refs, api }) {
    const sync = (nextOpen: boolean) => {
      api.setProps('root', {
        open: nextOpen,
        onOpenChange: (detail: { open: boolean }) => sync(detail.open),
      });
      if (refs.badge) refs.badge.textContent = nextOpen ? 'State: open' : 'State: closed';
    };
    sync(false);
    const onOpenClick = () => sync(true);
    refs.openBtn?.addEventListener('click', onOpenClick);
    return () => {
      refs.openBtn?.removeEventListener('click', onOpenClick);
    };
  },
} satisfies DemoSpec;
