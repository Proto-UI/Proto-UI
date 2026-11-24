import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center justify-center gap-4 p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        ref: 'toggleBtn',
        props: { variant: 'outline', size: 'sm' },
        children: ['Toggle card'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-hover-card-root',
        ref: 'hoverRoot',
        props: { open: false, openDelay: 100, closeDelay: 150 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-hover-card-trigger',
            children: ['@proto-ui'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-hover-card-content',
            props: { side: 'bottom', align: 'center' },
            children: [
              {
                kind: 'box',
                className: 'flex flex-col gap-1',
                children: [
                  { kind: 'box', className: 'font-semibold', children: ['Controlled Preview'] },
                  {
                    kind: 'box',
                    className: 'text-muted-foreground',
                    children: ['Visibility is synced with external state via open and openChange.'],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        ref: 'controlledStatus',
        attrs: { role: 'status', 'aria-live': 'polite' },
        className: 'text-xs text-muted-foreground',
        children: ['Closed'],
      },
    ],
  },
  setup({ refs, api }) {
    let isOpen = false;
    let disposed = false;

    const sync = (next: boolean) => {
      if (disposed || next === isOpen) return;
      isOpen = next;
      api.setProps('hoverRoot', { open: isOpen });
      refs.controlledStatus.textContent = isOpen ? 'Open' : 'Closed';
    };

    api.setProps('toggleBtn', { onClick: () => sync(!isOpen) });

    const onOpenChange = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail;
      if (typeof detail?.open === 'boolean') sync(detail.open);
    };
    refs.hoverRoot.addEventListener('openChange', onOpenChange);

    return () => {
      disposed = true;
      refs.hoverRoot.removeEventListener('openChange', onOpenChange);
    };
  },
} satisfies DemoSpec);
