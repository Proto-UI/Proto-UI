import type { DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const BRANCH_KEYS = ['src', 'components'] as const;

export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'bootstrap-2-3-2-tree-root',
    ref: 'tree',
    className: 'w-full max-w-sm',
    props: {
      defaultValue: 'button',
      defaultExpandedKeys: ['src', 'components'],
      a11yLabel: 'Project explorer',
    },
    children: [
      {
        kind: 'box',
        className: 'flex items-center gap-1.5',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-tree-toggle',
            ref: 'toggle-src',
            props: { nodeKey: 'src' },
            children: [
              {
                kind: 'box',
                tag: 'span',
                ref: 'icon-src',
                attrs: { 'aria-hidden': 'true' },
                children: ['▾'],
              },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Toggle src folder'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-tree-item',
            ref: 'src',
            className: 'flex-1',
            props: { nodeKey: 'src', textValue: 'src' },
            children: ['src/'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-tree-group',
        ref: 'group-src',
        props: { nodeKey: 'src' },
        children: [
          {
            kind: 'box',
            className: 'flex items-center gap-1.5',
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-tree-toggle',
                ref: 'toggle-components',
                props: { nodeKey: 'components' },
                children: [
                  {
                    kind: 'box',
                    tag: 'span',
                    ref: 'icon-components',
                    attrs: { 'aria-hidden': 'true' },
                    children: ['▾'],
                  },
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'sr-only',
                    children: ['Toggle components folder'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-tree-item',
                ref: 'components',
                className: 'flex-1',
                props: { nodeKey: 'components', parentKey: 'src', textValue: 'components' },
                children: ['components/'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-tree-group',
            ref: 'group-components',
            props: { nodeKey: 'components' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-tree-item',
                ref: 'button',
                props: { nodeKey: 'button', parentKey: 'components', textValue: 'button.tsx' },
                children: ['button.tsx'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-tree-item',
                ref: 'tree-file',
                props: { nodeKey: 'tree', parentKey: 'components', textValue: 'tree.tsx' },
                children: ['tree.tsx'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-tree-item',
            ref: 'index',
            props: { nodeKey: 'index', parentKey: 'src', textValue: 'index.ts' },
            children: ['index.ts'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-tree-item',
        ref: 'package',
        props: { nodeKey: 'package', textValue: 'package.json' },
        children: ['package.json'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-tree-item',
        ref: 'readme',
        props: { nodeKey: 'readme', textValue: 'README.md' },
        children: ['README.md'],
      },
    ],
  },
  setup(ctx) {
    const syncChevrons = (keys: readonly string[]) => {
      const expanded = new Set(keys);
      for (const key of BRANCH_KEYS) {
        const icon = ctx.refs[`icon-${key}`];
        if (icon) icon.textContent = expanded.has(key) ? '▾' : '▸';
      }
    };
    syncChevrons(['src', 'components']);
    ctx.api.setProps('tree', {
      onExpandedChange: (payload: unknown) => {
        const data =
          payload && typeof payload === 'object' && 'detail' in payload
            ? (payload as { detail?: { expandedKeys?: string[] } }).detail
            : (payload as { expandedKeys?: string[] } | undefined);
        if (Array.isArray(data?.expandedKeys)) syncChevrons(data.expandedKeys);
      },
    });
    return () => {
      ctx.api.setProps('tree', { onExpandedChange: null });
    };
  },
} satisfies DemoSpec;
