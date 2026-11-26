import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-popover-root',
        ref: 'root',
        props: {
          open: false,
          a11yLabel: 'Controlled popover',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-popover-trigger',
            children: ['Quick settings'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-popover-content',
            className: 'w-72',
            children: [
              {
                kind: 'box',
                className: 'grid gap-1',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-popover-title',
                    children: ['Focus mode'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-popover-description',
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
                    prototypeId: 'liquid-glass-popover-close',
                    children: ['Done'],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-button',
        ref: 'openBtn',
        children: ['Open externally'],
      },
      {
        kind: 'box',
        tag: 'span',
        ref: 'badge',
        className:
          'rounded-full border border-border bg-secondary/80 px-3 py-1 text-xs text-secondary-foreground',
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
