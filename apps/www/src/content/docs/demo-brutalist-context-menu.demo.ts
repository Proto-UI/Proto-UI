import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';
export default {
  'type': 'demo',
  'root': {
    'kind': 'box',
    'className': 'min-w-0 grid gap-4 p-4',
    'children': [
      {
        'kind': 'proto',
        'prototypeId': 'brutalist-context-menu-root',
        'children': [
          {
            'kind': 'proto',
            'prototypeId': 'brutalist-context-menu-trigger',
            'children': ['Right-click, hold with touch/pen, or focus and press Shift+F10.'],
          },
          {
            'kind': 'proto',
            'prototypeId': 'brutalist-context-menu-content',
            'children': [
              {
                'kind': 'proto',
                'prototypeId': 'brutalist-context-menu-item',
                'children': ['Copy'],
                'props': {
                  'value': 'copy',
                  'textValue': 'Copy',
                },
                'ref': 'copy',
              },
              {
                'kind': 'proto',
                'prototypeId': 'brutalist-context-menu-item',
                'children': ['Paste'],
                'props': {
                  'value': 'paste',
                  'textValue': 'Paste',
                },
                'ref': 'paste',
              },
              {
                'kind': 'proto',
                'prototypeId': 'brutalist-context-menu-item',
                'children': ['Unavailable'],
                'props': {
                  'value': 'disabled',
                  'disabled': true,
                },
              },
            ],
          },
        ],
        'ref': 'root',
      },
      {
        'kind': 'box',
        'ref': 'status',
        'attrs': {
          'aria-live': 'polite',
        },
        'children': ['Select a command.'],
      },
    ],
  },
  setup({ refs, api }) {
    api.setProps('root', {
      onOpenChange: (detail: { open: boolean; reason: string }) => {
        if (detail.open) refs.status.textContent = `Context menu opened: ${detail.reason}`;
      },
    });
    for (const ref of ['copy', 'paste'])
      api.setProps(ref, {
        onSelect: (detail: { value: string }) => {
          refs.status.textContent = detail.value + ' selected';
        },
      });
  },
} satisfies DemoSpec;
