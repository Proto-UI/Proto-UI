import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

type OpenRequest = { open: boolean; reason: 'pointer' | 'keyboard' | 'programmatic' };

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'mx-auto grid w-full max-w-md gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-5',
    children: [
      {
        kind: 'box',
        className: 'flex items-center justify-between gap-3',
        children: [
          {
            kind: 'box',
            ref: 'status',
            attrs: { 'aria-live': 'polite' },
            className: 'text-sm font-medium text-foreground',
            children: ['State: Closed'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-button',
            ref: 'externalToggle',
            props: { variant: 'regular' },
            children: ['Expand panel'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-collapsible-root',
        ref: 'root',
        props: { open: false },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-collapsible-trigger',
            children: ['Display & transparency settings'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-collapsible-content',
            children: [
              'Controlled via open and onOpenChange. Opaque reading surfaces preserve contrast over rich visual backdrops.',
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
      refs.status.textContent = `State: ${open ? 'Open' : 'Closed'}`;
      refs.externalToggle.textContent = open ? 'Collapse panel' : 'Expand panel';
    };
    sync(false);
    api.setProps('externalToggle', { variant: 'regular', onClick: () => sync(!open) });
  },
} satisfies DemoSpec;
