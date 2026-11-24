import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const BRANCH_KEYS = ['docs', 'guides'] as const;

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-xs rounded-xl border border-border bg-muted/30 p-3',
    children: [
      {
        kind: 'box',
        className: 'mb-2 px-2 text-xs font-medium text-muted-foreground',
        children: ['Workspace'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-tree-root',
        ref: 'tree',
        props: {
          appearance: 'embedded',
          defaultValue: 'getting-started',
          defaultExpandedKeys: ['docs', 'guides'],
          a11yLabel: 'Workspace sidebar',
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
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'sr-only',
                    children: ['Toggle Documentation'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-tree-item',
                className: 'flex-1',
                props: { nodeKey: 'docs', textValue: 'Documentation' },
                children: ['Documentation'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-tree-group',
            props: { nodeKey: 'docs' },
            children: [
              {
                kind: 'box',
                className: 'flex items-center gap-1',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-tree-toggle',
                    props: { nodeKey: 'guides', size: 'icon' },
                    children: [
                      {
                        kind: 'box',
                        tag: 'span',
                        ref: 'icon-guides',
                        attrs: { 'aria-hidden': 'true' },
                        children: ['▾'],
                      },
                      {
                        kind: 'box',
                        tag: 'span',
                        className: 'sr-only',
                        children: ['Toggle Guides'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-tree-item',
                    className: 'flex-1',
                    props: { nodeKey: 'guides', parentKey: 'docs', textValue: 'Guides' },
                    children: ['Guides'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-tree-group',
                props: { nodeKey: 'guides' },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-tree-item',
                    props: {
                      nodeKey: 'getting-started',
                      parentKey: 'guides',
                      textValue: 'Getting Started',
                    },
                    children: ['Getting Started'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-tree-item',
                    props: {
                      nodeKey: 'theming',
                      parentKey: 'guides',
                      textValue: 'Theming & Tokens',
                    },
                    children: ['Theming & Tokens'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-tree-item',
                props: { nodeKey: 'changelog', parentKey: 'docs', textValue: 'Changelog' },
                children: ['Changelog'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-tree-item',
            props: { nodeKey: 'settings', textValue: 'Settings' },
            children: ['Settings'],
          },
        ],
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
    syncChevrons(['docs', 'guides']);
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
} satisfies DemoSpec);
