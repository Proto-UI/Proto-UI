import type { DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const triggerClass =
  'inline-flex items-center justify-center rounded-full border border-border bg-secondary px-4 py-1.5 text-sm font-medium text-secondary-foreground shadow-sm';

function tooltip(ref: string, label: string, description: string): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'liquid-glass-tooltip-root',
    ref,
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-tooltip-trigger',
        ref: `${ref}Trigger`,
        className: triggerClass,
        children: [label],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-tooltip-content',
        ref: `${ref}Content`,
        previewTheme: 'portal',
        props: { side: 'top', align: 'center' },
        children: [description],
      },
    ],
  };
}

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'flex w-full min-w-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-8',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-tooltip-group',
        ref: 'group',
        props: { openDelay: 700, closeDelay: 100, skipDelay: 300 },
        children: [
          {
            kind: 'box',
            className: 'flex flex-wrap items-center justify-center gap-4',
            children: [
              tooltip('account', 'Account', 'View account settings'),
              tooltip('notifications', 'Notifications', 'Manage notification preferences'),
            ],
          },
        ],
      },
    ],
  },
};

export default demo;
