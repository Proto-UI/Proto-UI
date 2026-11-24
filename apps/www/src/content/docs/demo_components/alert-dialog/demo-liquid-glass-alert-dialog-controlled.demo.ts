import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'flex min-w-0 flex-wrap items-center justify-center gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-alert-dialog-root',
        ref: 'root',
        props: {
          open: false,
          a11yLabel: 'Archive workspace confirmation',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-alert-dialog-trigger',
            children: ['Archive Workspace'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-alert-dialog-mask',
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-alert-dialog-content',
            children: [
              {
                kind: 'box',
                className: 'grid gap-1.5',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-alert-dialog-title',
                    children: ['Archive this workspace?'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-alert-dialog-description',
                    children: [
                      'Members will keep read-only access until an administrator restores the workspace.',
                    ],
                  },
                ],
              },
              {
                kind: 'box',
                className: 'flex flex-wrap-reverse items-center justify-end gap-2.5 pt-1',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-alert-dialog-cancel',
                    children: ['Cancel'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-alert-dialog-action',
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
        className: 'text-xs font-medium text-foreground',
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
