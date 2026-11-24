import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

type OpenRequest = { open: boolean; reason: 'pointer' | 'keyboard' | 'programmatic' };

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'mx-auto grid w-full max-w-md gap-3 p-2',
    children: [
      {
        kind: 'box',
        className: 'flex items-center justify-between gap-3',
        children: [
          {
            kind: 'box',
            ref: 'status',
            attrs: { 'aria-live': 'polite' },
            className: 'text-sm text-muted-foreground',
            children: ['Panel state: Collapsed'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-button',
            ref: 'externalToggle',
            props: {},
            children: ['Expand panel'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-collapsible-root',
        ref: 'root',
        props: { open: false },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-collapsible-trigger',
            children: ['Release notes — Bootstrap 2.3.2 collapse'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-collapsible-content',
            children: [
              'Smooth 350ms height transition driven by the shared transition presence owner and controlled by external state.',
            ],
          },
        ],
      },
    ],
  },
  setup({ refs, api }) {
    let open = false;
    const sync = (next: boolean) => {
      open = next;
      api.setProps('root', {
        open,
        onOpenChange: (request: OpenRequest) => sync(request.open),
      });
      refs.status.textContent = `Panel state: ${open ? 'Expanded' : 'Collapsed'}`;
      refs.externalToggle.textContent = open ? 'Collapse panel' : 'Expand panel';
    };
    sync(false);
    api.setProps('externalToggle', { onClick: () => sync(!open) });
  },
} satisfies DemoSpec;
