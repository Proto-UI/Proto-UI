export default {
  'type': 'demo',
  'root': {
    'kind': 'proto',
    'prototypeId': 'shadcn-dropdown-root',
    'ref': 'menu',
    'children': [
      {
        'kind': 'proto',
        'prototypeId': 'shadcn-dropdown-trigger',
        'ref': 'trigger',
        'children': ['Inset actions'],
      },
      {
        'kind': 'proto',
        'prototypeId': 'shadcn-dropdown-content',
        'ref': 'content',
        'props': {
          'align': 'start',
        },
        'children': [
          {
            'kind': 'proto',
            'prototypeId': 'shadcn-dropdown-group',
            'ref': 'actions-group',
            'children': [
              {
                'kind': 'proto',
                'prototypeId': 'shadcn-dropdown-label',
                'ref': 'actions-label',
                'props': {
                  'inset': false,
                },
                'children': ['Actions'],
              },
              {
                'kind': 'proto',
                'prototypeId': 'shadcn-dropdown-item',
                'ref': 'copy',
                'props': {
                  'value': 'copy',
                  'textValue': 'Copy',
                  'inset': false,
                },
                'children': [
                  {
                    'kind': 'proto',
                    'prototypeId': 'lucide-copy-icon',
                    'props': {
                      'size': 16,
                    },
                  },
                  'Copy',
                ],
              },
              {
                'kind': 'proto',
                'prototypeId': 'shadcn-dropdown-item',
                'ref': 'cut',
                'props': {
                  'value': 'cut',
                  'textValue': 'Cut',
                  'inset': false,
                },
                'children': [
                  {
                    'kind': 'proto',
                    'prototypeId': 'lucide-scissors-icon',
                    'props': {
                      'size': 16,
                    },
                  },
                  'Cut',
                ],
              },
              {
                'kind': 'proto',
                'prototypeId': 'shadcn-dropdown-item',
                'ref': 'paste',
                'props': {
                  'value': 'paste',
                  'textValue': 'Paste',
                  'inset': true,
                },
                'children': ['Paste'],
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
            'ref': 'more-group',
            'children': [
              {
                'kind': 'proto',
                'prototypeId': 'shadcn-dropdown-label',
                'ref': 'more-label',
                'props': {
                  'inset': true,
                },
                'children': ['More actions'],
              },
              {
                'kind': 'proto',
                'prototypeId': 'shadcn-dropdown-item',
                'ref': 'rename',
                'props': {
                  'value': 'rename',
                  'textValue': 'Rename',
                  'inset': true,
                },
                'children': ['Rename'],
              },
            ],
          },
        ],
        'surfaceStyle': 'w-44',
      },
    ],
  },
};
