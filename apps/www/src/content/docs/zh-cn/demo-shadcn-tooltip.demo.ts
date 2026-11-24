import { withShadcnRheaDemo } from '../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'shadcn-tooltip-group',
    className: 'flex items-center justify-center gap-3 py-8',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-tooltip-root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-tooltip-trigger',
            ref: 'accountTrigger',
            className:
              'inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground shadow-xs hover:bg-muted',
            children: ['Account'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-tooltip-content',
            ref: 'accountContent',
            props: { side: 'top', align: 'center' },
            children: ['View account settings'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-tooltip-root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-tooltip-trigger',
            ref: 'notificationsTrigger',
            className:
              'inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground shadow-xs hover:bg-muted',
            children: ['Notifications'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-tooltip-content',
            ref: 'notificationsContent',
            props: { side: 'top', align: 'center' },
            children: ['Manage notification preferences'],
          },
        ],
      },
    ],
  },
});
