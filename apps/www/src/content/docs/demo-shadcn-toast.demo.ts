import { withShadcnRheaDemo } from './shadcn-demo-style';
import type {
  DemoKeyedChild,
  DemoPublicInstance,
  DemoSpec,
} from '@/components/PrototypePreviewer/demo-types';

const TOAST_COPY = [
  ['Event has been created', 'Sunday, December 03, 2023 at 9:00 AM'],
  ['Calendar invite sent', 'Shared with 4 team members'],
  ['Reminder scheduled', '15 minutes before the event starts'],
] as const;

function notification(index: number): DemoKeyedChild {
  const [title, description] = TOAST_COPY[index % TOAST_COPY.length]!;
  return {
    key: `toast-${index}`,
    node: {
      kind: 'proto',
      prototypeId: 'shadcn-toast-root',
      ref: `root-${index}`,
      props: { defaultOpen: false, duration: 5000 },
      children: [
        {
          kind: 'box',
          className: 'flex items-center justify-between gap-3 min-w-0',
          children: [
            {
              kind: 'box',
              className: 'grid gap-0.5 min-w-0',
              children: [
                { kind: 'proto', prototypeId: 'shadcn-toast-title', children: [title] },
                {
                  kind: 'proto',
                  prototypeId: 'shadcn-toast-description',
                  children: [description],
                },
              ],
            },
            {
              kind: 'box',
              className: 'flex shrink-0 items-center gap-2',
              children: [
                {
                  kind: 'proto',
                  prototypeId: 'shadcn-toast-action',
                  ref: `action-${index}`,
                  props: { a11yLabel: `Undo ${title}` },
                  children: ['Undo'],
                },
                {
                  kind: 'proto',
                  prototypeId: 'shadcn-toast-close',
                  ref: `close-${index}`,
                  children: ['Dismiss'],
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    ref: 'toast-demo',
    className: 'min-w-0 flex items-center justify-center p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        ref: 'trigger',
        props: { variant: 'outline' },
        children: ['Show Toast'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-toast-viewport',
        ref: 'viewport',
        previewTheme: 'portal',
        props: { a11yLabel: 'Notifications', position: 'bottom-right' },
        children: [
          {
            kind: 'box',
            ref: 'notifications',
            className: 'contents',
            dynamicChildren: {
              prototypeIds: [
                'shadcn-toast-root',
                'shadcn-toast-title',
                'shadcn-toast-description',
                'shadcn-toast-action',
                'shadcn-toast-close',
              ],
            },
          },
        ],
      },
    ],
  },
  setup({ api }) {
    if (!api.setChildren) throw new Error('Toast demo requires keyed child commits.');
    let alive = true;
    let nextId = 0;
    const messages = new Map<
      string,
      {
        child: DemoKeyedChild;
        onOpenChange: (payload: { open: boolean }) => void;
        instance?: DemoPublicInstance;
      }
    >();

    const publish = () => {
      if (!alive) return;
      // Every request snapshots the entire current list. The renderer may
      // coalesce queued commits without dropping any rapid creation or removal.
      void api.setChildren!(
        'notifications',
        [...messages.values()].map((message) => message.child)
      )
        .then((result) => {
          if (!alive || result !== 'committed') return;
          // Dynamic nodes are JSON-like data. Bind callbacks through the public
          // imperative channel only after their actual instance/ref commit.
          for (const [ref, message] of messages) {
            const instance = api.getPublicInstance?.(ref);
            if (!instance || message.instance === instance) continue;
            api.setProps(ref, { onOpenChange: message.onOpenChange });
            message.instance = instance;
            // Host insertion order differs across adapters. Open each fresh
            // message in creation order, independent of its DOM mount order.
            api.call(ref, 'openToast');
          }
        })
        .catch((error) => {
          console.error('[Toast demo] Notification commit failed.', error);
        });
    };

    api.setProps('trigger', {
      onClick: () => {
        if (!alive) return;
        const index = nextId++;
        const ref = `root-${index}`;
        messages.set(ref, {
          child: notification(index),
          onOpenChange: ({ open }) => {
            if (!alive || open || !messages.delete(ref)) return;
            publish();
          },
        });
        publish();
      },
    });
    return () => {
      alive = false;
      messages.clear();
    };
  },
} satisfies DemoSpec);
