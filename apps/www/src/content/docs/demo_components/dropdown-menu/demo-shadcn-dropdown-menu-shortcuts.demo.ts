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
        surfaceStyle: 'w-44',
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
                children: [
                  'Profile',
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-dropdown-shortcut',
                    children: ['⇧⌘P'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-dropdown-item',
                props: { value: 'billing', textValue: 'Billing' },
                children: [
                  'Billing',
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-dropdown-shortcut',
                    children: ['⌘B'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-dropdown-item',
                props: { value: 'settings', textValue: 'Settings' },
                children: [
                  'Settings',
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-dropdown-shortcut',
                    children: ['⌘S'],
                  },
                ],
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
            props: { value: 'logout', textValue: 'Log out' },
            children: [
              'Log out',
              {
                kind: 'proto',
                prototypeId: 'shadcn-dropdown-shortcut',
                children: ['⇧⌘Q'],
              },
            ],
          },
        ],
      },
    ],
  },
});
