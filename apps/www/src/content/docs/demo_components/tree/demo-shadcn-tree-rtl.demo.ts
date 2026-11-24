import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'shadcn-tree-root',
    ref: 'tree',
    className: 'w-full max-w-sm',
    props: {
      direction: 'rtl',
      defaultValue: 'components',
      defaultExpandedKeys: ['project'],
      a11yLabel: 'شجرة المشروع',
    },
    children: [
      {
        kind: 'box',
        className: 'flex items-center gap-1',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-tree-toggle',
            props: { nodeKey: 'project', size: 'icon' },
            children: [
              {
                kind: 'box',
                tag: 'span',
                ref: 'icon-project',
                attrs: { 'aria-hidden': 'true' },
                children: ['▾'],
              },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['تبديل مجلد المشروع'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-tree-item',
            className: 'flex-1',
            props: { nodeKey: 'project', textValue: 'المشروع' },
            children: ['المشروع'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-tree-group',
        props: { nodeKey: 'project' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-tree-item',
            props: { nodeKey: 'components', parentKey: 'project', textValue: 'المكونات' },
            children: ['المكونات'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-tree-item',
            props: { nodeKey: 'styles', parentKey: 'project', textValue: 'الأنماط' },
            children: ['الأنماط'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-tree-item',
        props: { nodeKey: 'readme', textValue: 'الدليل' },
        children: ['الدليل'],
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
} satisfies DemoSpec);
