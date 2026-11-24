import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const BRANCH_KEYS = ['src', 'components'] as const;

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full max-w-sm gap-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-tree-root',
        ref: 'tree',
        props: {
          value: 'button',
          expandedKeys: ['src', 'components'],
          a11yLabel: 'Controlled project tree',
        },
        children: [
          {
            kind: 'box',
            className: 'flex items-center gap-1.5',
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-tree-toggle',
                props: { nodeKey: 'src' },
                children: [
                  {
                    kind: 'box',
                    tag: 'span',
                    ref: 'icon-src',
                    attrs: { 'aria-hidden': 'true' },
                    children: ['▾'],
                  },
                  { kind: 'box', tag: 'span', className: 'sr-only', children: ['Toggle src'] },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-tree-item',
                className: 'flex-1',
                props: { nodeKey: 'src', textValue: 'src' },
                children: ['src/'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-tree-group',
            props: { nodeKey: 'src' },
            children: [
              {
                kind: 'box',
                className: 'flex items-center gap-1.5',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-tree-toggle',
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
                        children: ['Toggle components'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-tree-item',
                    className: 'flex-1',
                    props: { nodeKey: 'components', parentKey: 'src', textValue: 'components' },
                    children: ['components/'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-tree-group',
                props: { nodeKey: 'components' },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-tree-item',
                    props: { nodeKey: 'button', parentKey: 'components', textValue: 'button.tsx' },
                    children: ['button.tsx'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-tree-item',
                    props: { nodeKey: 'tree', parentKey: 'components', textValue: 'tree.tsx' },
                    children: ['tree.tsx'],
                  },
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-tree-item',
            props: { nodeKey: 'readme', textValue: 'README.md' },
            children: ['README.md'],
          },
        ],
      },
      {
        kind: 'box',
        ref: 'status',
        attrs: { role: 'status', 'aria-live': 'polite' },
        className: 'rounded border border-[#e5e5e5] bg-[#f5f5f5] px-3 py-1.5 text-xs text-[#333]',
        children: ['Selected: button · Expanded: src, components'],
      },
    ],
  },
  setup(ctx) {
    let currentValue = 'button';
    let currentExpanded: string[] = ['src', 'components'];

    const renderStatus = () => {
      const status = ctx.refs.status;
      if (status) {
        status.textContent = `Selected: ${currentValue} · Expanded: ${
          currentExpanded.length ? currentExpanded.join(', ') : 'none'
        }`;
      }
      const expanded = new Set(currentExpanded);
      for (const key of BRANCH_KEYS) {
        const icon = ctx.refs[`icon-${key}`];
        if (icon) icon.textContent = expanded.has(key) ? '▾' : '▸';
      }
    };

    const commit = () => {
      ctx.api.setProps('tree', {
        value: currentValue,
        expandedKeys: [...currentExpanded],
      });
      renderStatus();
    };

    renderStatus();
    ctx.api.setProps('tree', {
      onValueChange: (payload: unknown) => {
        const data =
          payload && typeof payload === 'object' && 'detail' in payload
            ? (payload as { detail?: { value?: string } }).detail
            : (payload as { value?: string } | undefined);
        if (typeof data?.value === 'string') {
          currentValue = data.value;
          commit();
        }
      },
      onExpandedChange: (payload: unknown) => {
        const data =
          payload && typeof payload === 'object' && 'detail' in payload
            ? (payload as { detail?: { expandedKeys?: string[] } }).detail
            : (payload as { expandedKeys?: string[] } | undefined);
        if (Array.isArray(data?.expandedKeys)) {
          currentExpanded = [...data.expandedKeys];
          commit();
        }
      },
    });

    return () => {
      ctx.api.setProps('tree', { onValueChange: null, onExpandedChange: null });
    };
  },
} satisfies DemoSpec;
