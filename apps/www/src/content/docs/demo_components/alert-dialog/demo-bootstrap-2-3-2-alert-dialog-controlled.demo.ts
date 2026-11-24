import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-4 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-alert-dialog-root',
        ref: 'root',
        props: {
          open: false,
          a11yLabel: 'Archive workspace confirmation',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-alert-dialog-trigger',
            children: ['Archive Workspace'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-alert-dialog-mask',
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-alert-dialog-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-alert-dialog-title',
                children: ['Archive this workspace?'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-alert-dialog-description',
                children: [
                  'Members will keep read-only access until an administrator restores the workspace.',
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-alert-dialog-footer',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-alert-dialog-cancel',
                    children: ['Cancel'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-alert-dialog-action',
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
} satisfies DemoSpec;
