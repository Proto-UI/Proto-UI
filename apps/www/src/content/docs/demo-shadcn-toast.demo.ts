import { withShadcnRheaDemo } from './shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const STACK_ITEMS = [
  {
    ref: 'root-0',
    actionRef: 'action-0',
    title: 'Event has been created',
    description: 'Sunday, December 03, 2023 at 9:00 AM',
  },
  {
    ref: 'root-1',
    actionRef: 'action-1',
    title: 'Calendar invite sent',
    description: 'Shared with 4 team members',
  },
  {
    ref: 'root-2',
    actionRef: 'action-2',
    title: 'Reminder scheduled',
    description: '15 minutes before the event starts',
  },
] as const;

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 flex items-center justify-center p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        ref: 'trigger',
        props: {
          variant: 'outline',
        },
        children: ['Show Toast'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-toast-viewport',
        ref: 'viewport',
        props: {
          a11yLabel: 'Notifications',
          position: 'bottom-right',
        },
        children: STACK_ITEMS.map((item) => ({
          kind: 'proto' as const,
          prototypeId: 'shadcn-toast-root',
          ref: item.ref,
          props: {
            defaultOpen: false,
            duration: 5000,
          },
          children: [
            {
              kind: 'box',
              className: 'flex items-center justify-between gap-3 min-w-0',
              children: [
                {
                  kind: 'box',
                  className: 'grid gap-0.5 min-w-0',
                  children: [
                    {
                      kind: 'proto',
                      prototypeId: 'shadcn-toast-title',
                      children: [item.title],
                    },
                    {
                      kind: 'proto',
                      prototypeId: 'shadcn-toast-description',
                      children: [item.description],
                    },
                  ],
                },
                {
                  kind: 'proto',
                  prototypeId: 'shadcn-toast-action',
                  ref: item.actionRef,
                  props: {
                    a11yLabel: `Undo ${item.title}`,
                  },
                  children: ['Undo'],
                },
              ],
            },
          ],
        })),
      },
    ],
  },
  setup({ api }) {
    let cursor = 0;
    api.setProps('trigger', {
      onClick: () => {
        const item = STACK_ITEMS[cursor % STACK_ITEMS.length]!;
        cursor++;
        const openToast = api.getExposes(item.ref)?.openToast;
        if (typeof openToast === 'function') openToast();
      },
    });
    for (const item of STACK_ITEMS) {
      api.setProps(item.actionRef, {
        onAction: () => {
          const close = api.getExposes(item.ref)?.close;
          if (typeof close === 'function') close('action');
        },
      });
    }
  },
} satisfies DemoSpec);
