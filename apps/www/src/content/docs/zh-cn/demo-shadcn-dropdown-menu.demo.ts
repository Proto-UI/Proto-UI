export default {
  'type': 'demo',
  'root': {
    'kind': 'proto',
    'prototypeId': 'shadcn-dropdown-root',
    'children': [
      {
        'kind': 'proto',
        'prototypeId': 'shadcn-dropdown-trigger',
        'children': ['Open menu'],
      },
      {
        'kind': 'proto',
        'prototypeId': 'shadcn-dropdown-content',
        'props': {
          'align': 'start',
        },
        'children': [
          {
            'kind': 'proto',
            'prototypeId': 'shadcn-dropdown-group',
            'children': [
              {
                'kind': 'proto',
                'prototypeId': 'shadcn-dropdown-label',
                'children': ['My Account'],
              },
              {
                'kind': 'proto',
                'prototypeId': 'shadcn-dropdown-item',
                'props': {
                  'value': 'profile',
                  'textValue': 'Profile',
                },
                'children': [
                  'Profile',
                  {
                    'kind': 'proto',
                    'prototypeId': 'shadcn-dropdown-shortcut',
                    'children': ['⇧⌘P'],
                  },
                ],
              },
              {
                'kind': 'proto',
                'prototypeId': 'shadcn-dropdown-item',
                'props': {
                  'value': 'billing',
                  'textValue': 'Billing',
                },
                'children': [
                  'Billing',
                  {
                    'kind': 'proto',
                    'prototypeId': 'shadcn-dropdown-shortcut',
                    'children': ['⌘B'],
                  },
                ],
              },
              {
                'kind': 'proto',
                'prototypeId': 'shadcn-dropdown-item',
                'props': {
                  'value': 'settings',
                  'textValue': 'Settings',
                },
                'children': [
                  'Settings',
                  {
                    'kind': 'proto',
                    'prototypeId': 'shadcn-dropdown-shortcut',
                    'children': ['⌘S'],
                  },
                ],
              },
            ],
          },
          {
            'kind': 'proto',
            'prototypeId': 'shadcn-dropdown-separator',
          },
          {
            'kind': 'proto',
            'prototypeId': 'shadcn-dropdown-group',
            'props': {
              'a11yLabel': 'Team actions',
            },
            'children': [
              {
                'kind': 'proto',
                'prototypeId': 'shadcn-dropdown-item',
                'props': {
                  'value': 'team',
                  'textValue': 'Team',
                },
                'children': ['Team'],
              },
              {
                'kind': 'proto',
                'prototypeId': 'shadcn-dropdown-item',
                'props': {
                  'value': 'new-team',
                  'textValue': 'New Team',
                },
                'children': [
                  'New Team',
                  {
                    'kind': 'proto',
                    'prototypeId': 'shadcn-dropdown-shortcut',
                    'children': ['⌘+T'],
                  },
                ],
              },
            ],
          },
          {
            'kind': 'proto',
            'prototypeId': 'shadcn-dropdown-separator',
          },
          {
            'kind': 'proto',
            'prototypeId': 'shadcn-dropdown-group',
            'props': {
              'a11yLabel': 'Resources',
            },
            'children': [
              {
                'kind': 'proto',
                'prototypeId': 'shadcn-dropdown-item',
                'props': {
                  'value': 'github',
                  'textValue': 'GitHub',
                },
                'children': ['GitHub'],
              },
              {
                'kind': 'proto',
                'prototypeId': 'shadcn-dropdown-item',
                'props': {
                  'value': 'support',
                  'textValue': 'Support',
                },
                'children': ['Support'],
              },
              {
                'kind': 'proto',
                'prototypeId': 'shadcn-dropdown-item',
                'props': {
                  'value': 'api',
                  'textValue': 'API',
                  'disabled': true,
                },
                'children': ['API'],
              },
            ],
          },
          {
            'kind': 'proto',
            'prototypeId': 'shadcn-dropdown-separator',
          },
          {
            'kind': 'proto',
            'prototypeId': 'shadcn-dropdown-item',
            'props': {
              'value': 'logout',
              'textValue': 'Log out',
            },
            'children': [
              'Log out',
              {
                'kind': 'proto',
                'prototypeId': 'shadcn-dropdown-shortcut',
                'children': ['⇧⌘Q'],
              },
            ],
          },
        ],
        'surfaceStyle': 'w-40',
      },
    ],
  },
};
