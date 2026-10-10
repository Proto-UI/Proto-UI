import type { DemoSpec } from '../../../components/PrototypePreviewer/demo-types';
import { attachWebVirtualList } from '@proto.ui/prototypes-base/virtual-list/web';
import type { WindowedCollection } from '@proto.ui/prototypes-base/virtual-list';
export default {
  'type': 'demo',
  'root': {
    'kind': 'proto',
    'prototypeId': 'brutalist-virtual-list-root',
    'children': [
      {
        'kind': 'proto',
        'prototypeId': 'brutalist-virtual-list-viewport',
        'children': [
          {
            'kind': 'proto',
            'prototypeId': 'brutalist-virtual-list-content',
            'ref': 'content',
          },
        ],
        'className': 'h-64 overflow-auto border border-slate-300',
        'ref': 'viewport',
      },
    ],
    'props': {
      'itemKeys': Array.from({ length: 1000 }, (_, index) => `row-${index + 1}`),
      'overscanItems': 3,
      'maxMaterializedItems': 60,
    },
    'className': 'w-full max-w-lg',
    'ref': 'list',
  },
  setup({ refs, api }) {
    const collection = api.call('list', 'getCollection') as WindowedCollection;
    const host = attachWebVirtualList({
      viewport: refs.viewport!,
      content: refs.content!,
      collection,
      estimateSize: 40,
      renderItem(key) {
        const row = document.createElement('div');
        row.textContent = key;
        row.style.padding = '10px 12px';
        return row;
      },
    });
    return () => host.dispose();
  },
} satisfies DemoSpec;
