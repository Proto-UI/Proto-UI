import type { DemoSpec } from '../../../components/PrototypePreviewer/demo-types';
export default {
  'type': 'demo',
  'root': {
    'kind': 'proto',
    'prototypeId': 'shadcn-tree-root',
    'children': [
      {
        'kind': 'proto',
        'prototypeId': 'shadcn-tree-item',
        'children': ['Project files'],
        'props': {
          'nodeKey': 'project',
          'textValue': 'Project files',
        },
      },
      {
        'kind': 'proto',
        'prototypeId': 'shadcn-tree-toggle',
        'children': ['Expand / collapse project'],
        'props': {
          'nodeKey': 'project',
        },
      },
      {
        'kind': 'proto',
        'prototypeId': 'shadcn-tree-item',
        'children': ['README.md'],
        'props': {
          'nodeKey': 'readme',
          'parentKey': 'project',
          'textValue': 'README',
        },
      },
      {
        'kind': 'proto',
        'prototypeId': 'shadcn-tree-item',
        'children': ['src'],
        'props': {
          'nodeKey': 'src',
          'parentKey': 'project',
          'textValue': 'Source',
        },
      },
      {
        'kind': 'proto',
        'prototypeId': 'shadcn-tree-item',
        'children': ['Archive'],
        'props': {
          'nodeKey': 'archive',
          'textValue': 'Archive',
        },
      },
    ],
    'props': {
      'defaultExpandedKeys': ['project'],
    },
    'className': 'grid max-w-md gap-2',
  },
} satisfies DemoSpec;
