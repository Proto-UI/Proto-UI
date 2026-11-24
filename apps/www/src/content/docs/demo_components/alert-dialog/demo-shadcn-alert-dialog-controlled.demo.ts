import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-4 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-alert-dialog-root',
        ref: 'root',
        props: {
          open: false,
          a11yLabel: 'Archive workspace confirmation',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-alert-dialog-trigger',
            props: { variant: 'outline' },
            children: ['Archive Workspace'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-alert-dialog-mask',
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-alert-dialog-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-alert-dialog-header',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-alert-dialog-title',
                    children: ['Archive this workspace?'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-alert-dialog-description',
                    children: [
                      'Members will keep read-only access until an administrator restores the workspace.',
                    ],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-alert-dialog-footer',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-alert-dialog-cancel',
                    children: ['Cancel'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-alert-dialog-action',
                    ref: 'action',
                    children: ['Archive'],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        tag: 'span',
        ref: 'status',
        className: 'text-xs text-muted-foreground',
        attrs: { role: 'status', 'aria-live': 'polite' },
        children: ['Status: Active'],
      },
    ],
  },
  setup({ refs, api }) {
    let archived = false;
    api.setProps('action', {
      onAction: () => {
        archived = true;
        refs.status.textContent = 'Status: Archived';
      },
    });
    api.setProps('root', {
      onOpenChange: (detail: { open: boolean }) => {
        api.setProps('root', { open: detail.open });
        if (!detail.open && !archived) {
          refs.status.textContent = 'Status: Active';
        }
      },
    });
  },
} satisfies DemoSpec);
