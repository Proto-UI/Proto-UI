import type { DemoSpec } from '../../../components/PrototypePreviewer/demo-types';
export default {
  'type': 'demo',
  'root': {
    'kind': 'proto',
    'prototypeId': 'brutalist-resizable-root',
    'children': [
      {
        'kind': 'proto',
        'prototypeId': 'brutalist-resizable-panel',
        'children': ['Navigation panel'],
        'props': {
          'index': 0,
        },
        'className': 'min-w-0 p-4',
      },
      {
        'kind': 'proto',
        'prototypeId': 'brutalist-resizable-handle',
        'className': 'basis-2 shrink-0 bg-slate-300',
      },
      {
        'kind': 'proto',
        'prototypeId': 'brutalist-resizable-panel',
        'children': ['Resize with the separator, arrow keys, or pointer.'],
        'props': {
          'index': 1,
        },
        'className': 'min-w-0 p-4',
      },
    ],
    'props': {
      'defaultValue': 35,
      'min': 15,
      'max': 75,
    },
    'className': 'flex min-h-40 w-full max-w-xl border border-slate-300',
  },
} satisfies DemoSpec;
