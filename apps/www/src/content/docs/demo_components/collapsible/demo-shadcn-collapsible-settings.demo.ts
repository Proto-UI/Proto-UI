import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

type OpenRequest = { open: boolean; reason: 'pointer' | 'keyboard' | 'programmatic' };

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'mx-auto grid w-full max-w-xs gap-3 rounded-xl border border-border bg-card p-4 shadow-xs',
    children: [
      {
        kind: 'box',
        className: 'grid gap-0.5',
        children: [
          {
            kind: 'box',
            className: 'text-sm font-semibold text-foreground',
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
        prototypeId: 'shadcn-collapsible-root',
        ref: 'settings',
        props: { open: false },
        children: [
          {
            kind: 'box',
            className: 'flex items-center justify-between gap-2',
            children: [
              {
                kind: 'box',
                className: 'grid flex-1 grid-cols-2 gap-2',
                children: [
                  {
                    kind: 'box',
                    className:
                      'rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground',
                    children: ['TL: 8px'],
                  },
                  {
                    kind: 'box',
                    className:
                      'rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground',
                    children: ['TR: 8px'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-collapsible-trigger',
                ref: 'settingsTrigger',
                props: { variant: 'outline', size: 'icon' },
                children: ['+'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-collapsible-content',
            props: { variant: 'plain' },
            children: [
              {
                kind: 'box',
                className: 'grid grid-cols-2 gap-2',
                children: [
                  {
                    kind: 'box',
                    className:
                      'rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground',
                    children: ['BL: 8px'],
                  },
                  {
                    kind: 'box',
                    className:
                      'rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground',
                    children: ['BR: 8px'],
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
      refs.settingsTrigger.textContent = open ? '−' : '+';
    };
    sync(false);
  },
} satisfies DemoSpec);
