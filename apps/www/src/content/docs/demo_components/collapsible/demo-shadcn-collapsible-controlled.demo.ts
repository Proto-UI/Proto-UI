import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

type OpenRequest = { open: boolean; reason: 'pointer' | 'keyboard' | 'programmatic' };

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'mx-auto grid w-full max-w-sm gap-3 rounded-xl border border-border bg-card p-4',
    children: [
      {
        kind: 'box',
        className: 'flex items-center justify-between gap-2',
        children: [
          {
            kind: 'box',
            ref: 'status',
            attrs: { 'aria-live': 'polite' },
            className: 'text-xs font-medium text-muted-foreground',
            children: ['Panel state: Closed'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            ref: 'externalToggle',
            props: { variant: 'outline', size: 'sm' },
            children: ['Toggle externally'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-collapsible-root',
        ref: 'root',
        props: { open: false },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-collapsible-trigger',
            props: { variant: 'ghost', size: 'default' },
            children: ['Product details'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-collapsible-content',
            children: [
              'This panel is controlled through the open prop and onOpenChange callback, keeping external triggers and the built-in trigger in sync.',
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
      refs.status.textContent = `Panel state: ${open ? 'Open' : 'Closed'}`;
    };
    sync(false);
    api.setProps('externalToggle', {
      variant: 'outline',
      size: 'sm',
      onClick: () => sync(!open),
    });
  },
} satisfies DemoSpec);
