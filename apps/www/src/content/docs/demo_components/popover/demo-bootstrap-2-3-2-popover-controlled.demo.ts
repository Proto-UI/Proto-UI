import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-3 p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-popover-root',
        ref: 'root',
        props: {
          open: false,
          a11yLabel: 'Controlled popover',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-popover-trigger',
            children: ['Quick info'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-popover-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-popover-title',
                children: ['Controlled state'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-popover-description',
                children: ['Open and close state is owned by parent props.'],
              },
              {
                kind: 'box',
                className: 'flex justify-end px-[14px] pb-[10px]',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-popover-close',
                    children: ['Close'],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-button',
        ref: 'openBtn',
        children: ['Open externally'],
      },
      {
        kind: 'box',
        tag: 'span',
        ref: 'badge',
        className: 'rounded-[4px] border border-[#ccc] px-2 py-1 text-xs text-muted-foreground',
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
