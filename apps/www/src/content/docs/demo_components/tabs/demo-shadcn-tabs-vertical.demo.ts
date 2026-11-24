import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'shadcn-tabs-root',
    className: 'w-[460px] max-w-full',
    props: { defaultValue: 'account', orientation: 'vertical' },
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-tabs-list',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-tabs-trigger',
            props: { value: 'account' },
            children: ['Account'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-tabs-trigger',
            props: { value: 'password' },
            children: ['Password'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-tabs-trigger',
            props: { value: 'notifications' },
            children: ['Notifications'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-tabs-content',
        props: { value: 'account' },
        children: [
          {
            kind: 'box',
            className: 'rounded-xl border border-border bg-card p-4 text-sm text-card-foreground',
            children: ['Update your display name, workspace email, and profile avatar.'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-tabs-content',
        props: { value: 'password' },
        children: [
          {
            kind: 'box',
            className: 'rounded-xl border border-border bg-card p-4 text-sm text-card-foreground',
            children: ['Rotate your password regularly and manage passkey sign-in.'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-tabs-content',
        props: { value: 'notifications' },
        children: [
          {
            kind: 'box',
            className: 'rounded-xl border border-border bg-card p-4 text-sm text-card-foreground',
            children: ['Choose which project updates trigger email or desktop alerts.'],
          },
        ],
      },
    ],
  },
});
