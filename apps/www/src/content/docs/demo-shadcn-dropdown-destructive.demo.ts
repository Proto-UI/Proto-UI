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
        'children': ['Actions'],
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
            'prototypeId': 'shadcn-dropdown-item',
            'ref': 'edit',
            'props': {
              'value': 'edit',
              'textValue': 'Edit',
            },
            'children': [
              {
                'kind': 'proto',
                'prototypeId': 'lucide-pencil-icon',
                'props': {
                  'size': 16,
                },
              },
              'Edit',
            ],
          },
          {
            'kind': 'proto',
            'prototypeId': 'shadcn-dropdown-item',
            'ref': 'share',
            'props': {
              'value': 'share',
              'textValue': 'Share',
            },
            'children': [
              {
                'kind': 'proto',
                'prototypeId': 'lucide-share-icon',
                'props': {
                  'size': 16,
                },
              },
              'Share',
            ],
          },
          {
            'kind': 'proto',
            'prototypeId': 'shadcn-dropdown-separator',
          },
          {
            'kind': 'proto',
            'prototypeId': 'shadcn-dropdown-item',
            'ref': 'archive',
            'props': {
              'value': 'archive',
              'textValue': 'Archive',
            },
            'children': [
              {
                'kind': 'proto',
                'prototypeId': 'lucide-archive-icon',
                'props': {
                  'size': 16,
                },
              },
              'Archive',
            ],
          },
          {
            'kind': 'proto',
            'prototypeId': 'shadcn-dropdown-item',
            'ref': 'delete',
            'props': {
              'value': 'delete',
              'textValue': 'Delete',
              'variant': 'destructive',
            },
            'children': [
              {
                'kind': 'proto',
                'prototypeId': 'lucide-trash-icon',
                'props': {
                  'size': 16,
                },
              },
              'Delete',
            ],
          },
          {
            'kind': 'proto',
            'prototypeId': 'shadcn-dropdown-separator',
          },
          {
            'kind': 'proto',
            'prototypeId': 'shadcn-dropdown-item',
            'ref': 'delete-disabled',
            'props': {
              'value': 'delete-disabled',
              'textValue': 'Delete (disabled)',
              'variant': 'destructive',
              'disabled': true,
            },
            'children': [
              {
                'kind': 'proto',
                'prototypeId': 'lucide-trash-icon',
                'props': {
                  'size': 16,
                },
              },
              'Delete (disabled)',
            ],
          },
        ],
      },
    ],
  },
};
