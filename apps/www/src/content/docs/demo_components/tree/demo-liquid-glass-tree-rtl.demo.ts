import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'w-full max-w-md rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-tree-root',
        ref: 'tree',
        props: {
          direction: 'rtl',
          defaultValue: 'components',
          defaultExpandedKeys: ['project'],
          a11yLabel: 'شجرة المشروع',
        },
        children: [
          {
            kind: 'box',
            className: 'flex items-center gap-1.5',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-tree-toggle',
                props: { nodeKey: 'project', size: 'icon' },
                children: [
                  {
                    kind: 'box',
                    tag: 'span',
                    ref: 'icon-project',
                    attrs: { 'aria-hidden': 'true' },
                    children: ['▾'],
                  },
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'sr-only',
                    children: ['تبديل مجلد المشروع'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-tree-item',
                className: 'flex-1',
                props: { nodeKey: 'project', textValue: 'المشروع' },
                children: ['المشروع'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-tree-group',
            props: { nodeKey: 'project' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-tree-item',
                props: { nodeKey: 'components', parentKey: 'project', textValue: 'المكونات' },
                children: ['المكونات'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-tree-item',
                props: { nodeKey: 'styles', parentKey: 'project', textValue: 'الأنماط' },
                children: ['الأنماط'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-tree-item',
            props: { nodeKey: 'readme', textValue: 'الدليل' },
            children: ['الدليل'],
          },
        ],
      },
    ],
  },
  setup(ctx) {
    const sync = (keys: readonly string[]) => {
      const icon = ctx.refs['icon-project'];
      if (icon) icon.textContent = keys.includes('project') ? '▾' : '◂';
    };
    sync(['project']);
    ctx.api.setProps('tree', {
      onExpandedChange: (payload: unknown) => {
        const data =
          payload && typeof payload === 'object' && 'detail' in payload
            ? (payload as { detail?: { expandedKeys?: string[] } }).detail
            : (payload as { expandedKeys?: string[] } | undefined);
        if (Array.isArray(data?.expandedKeys)) sync(data.expandedKeys);
      },
    });
    return () => {
      ctx.api.setProps('tree', { onExpandedChange: null });
    };
  },
} satisfies DemoSpec;
