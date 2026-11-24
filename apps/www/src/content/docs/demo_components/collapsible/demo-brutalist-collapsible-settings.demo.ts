import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

type OpenRequest = { open: boolean; reason: 'pointer' | 'keyboard' | 'programmatic' };

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'mx-auto grid w-full max-w-xs gap-3 rounded-base border-2 border-border bg-secondary-background p-4 shadow-[4px_4px_0_0_#000]',
    children: [
      {
        kind: 'box',
        className: 'grid gap-0.5',
        children: [
          {
            kind: 'box',
            className: 'text-sm font-heading font-bold text-foreground',
            children: ['Radius'],
          },
          {
            kind: 'box',
            className: 'text-xs text-muted-foreground',
            children: ['Set the corner radius of the element.'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-collapsible-root',
        ref: 'settings',
        props: { open: false },
        children: [
          {
            kind: 'box',
            className: 'grid grid-cols-2 gap-2',
            children: [
              {
                kind: 'box',
                className:
                  'rounded-base border-2 border-border bg-background px-3 py-1.5 text-xs text-foreground',
                children: ['Top left: 5px'],
              },
              {
                kind: 'box',
                className:
                  'rounded-base border-2 border-border bg-background px-3 py-1.5 text-xs text-foreground',
                children: ['Top right: 5px'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-collapsible-trigger',
            ref: 'trigger',
            props: { variant: 'neutral' },
            children: ['Show bottom corners'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-collapsible-content',
            children: [
              {
                kind: 'box',
                className: 'grid grid-cols-2 gap-2',
                children: [
                  {
                    kind: 'box',
                    className:
                      'rounded-base border-2 border-border bg-background px-3 py-1.5 text-xs text-foreground',
                    children: ['Bottom left: 5px'],
                  },
                  {
                    kind: 'box',
                    className:
                      'rounded-base border-2 border-border bg-background px-3 py-1.5 text-xs text-foreground',
                    children: ['Bottom right: 5px'],
                  },
                ],
              },
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
      api.setProps('settings', {
        open,
        onOpenChange: (request: OpenRequest) => sync(request.open),
      });
      refs.trigger.textContent = open ? 'Hide bottom corners' : 'Show bottom corners';
    };
    sync(false);
  },
} satisfies DemoSpec;
