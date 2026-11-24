import type { DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const triggerClass =
  'inline-flex items-center justify-center rounded-[4px] border border-[#ccc] bg-[#f5f5f5] px-3 py-1 text-[14px] leading-[20px] text-[#333] shadow-xs hover:bg-[#e6e6e6]';

function tooltip(ref: string, label: string, description: string): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'bootstrap-2-3-2-tooltip-root',
    ref,
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-tooltip-trigger',
        ref: `${ref}Trigger`,
        className: triggerClass,
        children: [label],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-tooltip-content',
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
    className: 'flex min-w-0 items-center justify-center p-8',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-tooltip-group',
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
