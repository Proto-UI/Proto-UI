import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full max-w-2xl gap-4 sm:grid-cols-2',
    children: [
      {
        kind: 'box',
        className: 'grid gap-1.5',
        children: [
          {
            kind: 'box',
            className: 'text-xs font-medium text-muted-foreground',
            children: ['Disabled branch & item'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-tree-root',
            ref: 'disabled-tree',
            props: {
              defaultValue: 'active',
              defaultExpandedKeys: ['packages'],
              a11yLabel: 'Disabled items tree',
            },
            children: [
              {
                kind: 'box',
                className: 'flex items-center gap-1',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-tree-toggle',
                    props: { nodeKey: 'packages', size: 'icon' },
                    children: [
                      {
                        kind: 'box',
                        tag: 'span',
                        ref: 'icon-packages',
                        attrs: { 'aria-hidden': 'true' },
                        children: ['▾'],
                      },
                      {
                        kind: 'box',
                        tag: 'span',
                        className: 'sr-only',
                        children: ['Toggle packages'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-tree-item',
                    className: 'flex-1',
                    props: { nodeKey: 'packages', textValue: 'packages' },
                    children: ['packages/'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-tree-group',
                props: { nodeKey: 'packages' },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-tree-item',
                    props: { nodeKey: 'active', parentKey: 'packages', textValue: 'core' },
                    children: ['core'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-tree-item',
                    props: {
                      nodeKey: 'deprecated',
                      parentKey: 'packages',
                      textValue: 'legacy (disabled)',
                      disabled: true,
                    },
                    children: ['legacy (disabled)'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-tree-item',
                props: { nodeKey: 'license', textValue: 'LICENSE' },
                children: ['LICENSE'],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'grid gap-1.5',
        children: [
          {
            kind: 'box',
            className: 'text-xs font-medium text-muted-foreground',
            children: ['Read-only (expandable, locked selection)'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-tree-root',
            ref: 'readonly-tree',
            props: {
              readOnly: true,
              defaultValue: 'overview',
              defaultExpandedKeys: ['docs'],
              a11yLabel: 'Read-only tree',
            },
            children: [
              {
                kind: 'box',
                className: 'flex items-center gap-1',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-tree-toggle',
                    props: { nodeKey: 'docs', size: 'icon' },
                    children: [
                      {
                        kind: 'box',
                        tag: 'span',
                        ref: 'icon-docs',
                        attrs: { 'aria-hidden': 'true' },
                        children: ['▾'],
                      },
                      { kind: 'box', tag: 'span', className: 'sr-only', children: ['Toggle docs'] },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-tree-item',
                    className: 'flex-1',
                    props: { nodeKey: 'docs', textValue: 'docs' },
                    children: ['docs/'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-tree-group',
                props: { nodeKey: 'docs' },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-tree-item',
                    props: { nodeKey: 'overview', parentKey: 'docs', textValue: 'overview.mdx' },
                    children: ['overview.mdx'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-tree-item',
                    props: { nodeKey: 'api', parentKey: 'docs', textValue: 'api.mdx' },
                    children: ['api.mdx'],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  setup(ctx) {
    const bind = (refName: string, iconRef: string, key: string) => {
      const icon = ctx.refs[iconRef];
      if (icon) icon.textContent = '▾';
      ctx.api.setProps(refName, {
        onExpandedChange: (payload: unknown) => {
          const data =
            payload && typeof payload === 'object' && 'detail' in payload
              ? (payload as { detail?: { expandedKeys?: string[] } }).detail
              : (payload as { expandedKeys?: string[] } | undefined);
          if (Array.isArray(data?.expandedKeys) && ctx.refs[iconRef]) {
            ctx.refs[iconRef].textContent = data.expandedKeys.includes(key) ? '▾' : '▸';
          }
        },
      });
    };
    bind('disabled-tree', 'icon-packages', 'packages');
    bind('readonly-tree', 'icon-docs', 'docs');
    return () => {
      ctx.api.setProps('disabled-tree', { onExpandedChange: null });
      ctx.api.setProps('readonly-tree', { onExpandedChange: null });
    };
  },
} satisfies DemoSpec);
