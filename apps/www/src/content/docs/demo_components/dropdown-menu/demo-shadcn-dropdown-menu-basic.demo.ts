import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'shadcn-dropdown-root',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-dropdown-trigger',
        children: ['Open'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-dropdown-content',
        props: { align: 'start' },
        surfaceStyle: 'w-40',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-dropdown-group',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-dropdown-label',
                children: ['My Account'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-dropdown-item',
                props: { value: 'profile', textValue: 'Profile' },
                children: ['Profile'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-dropdown-item',
                props: { value: 'billing', textValue: 'Billing' },
                children: ['Billing'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-dropdown-item',
                props: { value: 'settings', textValue: 'Settings' },
                children: ['Settings'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-dropdown-separator',
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-dropdown-item',
            props: { value: 'github', textValue: 'GitHub' },
            children: ['GitHub'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-dropdown-item',
            props: { value: 'support', textValue: 'Support' },
            children: ['Support'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-dropdown-item',
            props: { value: 'api', textValue: 'API', disabled: true },
            children: ['API'],
          },
        ],
      },
    ],
  },
});
