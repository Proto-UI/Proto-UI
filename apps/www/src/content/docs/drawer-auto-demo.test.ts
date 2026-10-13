// @vitest-environment node
import { expect, it } from 'vitest';
import type { DemoNode, DemoSpec } from '../../components/PrototypePreviewer/demo-types';
import { drawerExtentModel } from '../../../../../packages/prototypes/base/src/drawer/extent-model';
const files = import.meta.glob<DemoSpec>('./demo-*-drawer*.demo.ts', {
  eager: true,
  import: 'default',
});
function panels(node: DemoNode): Extract<DemoNode, { kind: 'proto' }>[] {
  const current =
    node.kind === 'proto' && node.prototypeId.endsWith('-drawer-content') ? [node] : [];
  const children = 'children' in node ? (node.children ?? []) : [];
  return current.concat(
    children.flatMap((child) => (typeof child === 'string' ? [] : panels(child)))
  );
}
it.each(Object.entries(files))(
  'preflights legal static Drawer inputs before mounting %s',
  (path, demo) => {
    const content = panels(demo.root);
    expect(content).toHaveLength(1);
    const model = drawerExtentModel(content[0].props ?? {});
    expect(model.status).toBe('ready');
    if (model.status !== 'ready') throw new Error(model.reason);
    expect(model.mode).toBe(path.includes('-snap.') ? 'fraction' : 'intrinsic');
    if (path.includes('brutalist')) expect(content[0].previewTheme).toBe('portal');
  }
);

it.each(Object.entries(files).filter(([path]) => path.includes('shadcn')))(
  'Shadcn structural parts own spacing in the actual %s demo',
  (_path, demo) => {
    const panel = panels(demo.root)[0];
    const direct = panel.children!.filter((child): child is DemoNode => typeof child !== 'string');
    const column = direct.find(
      (child) => child.kind === 'box' && child.className === 'mx-auto w-full max-w-sm'
    );
    const children =
      column && 'children' in column
        ? column.children!.filter((child): child is DemoNode => typeof child !== 'string')
        : direct;
    if (_path === './demo-shadcn-drawer.demo.ts') expect(column).toBeDefined();
    const parts = children.filter(
      (child): child is Extract<DemoNode, { kind: 'proto' }> => child.kind === 'proto'
    );
    const header = parts.find((part) => part.prototypeId === 'shadcn-drawer-header');
    const footer = parts.find((part) => part.prototypeId === 'shadcn-drawer-footer');
    expect(header).toBeDefined();
    expect(footer).toBeDefined();
    expect(
      header!.children
        ?.filter((child) => typeof child !== 'string')
        .map((child) => (child.kind === 'proto' ? child.prototypeId : ''))
    ).toEqual(['shadcn-drawer-title', 'shadcn-drawer-description']);
    expect(
      footer!.children
        ?.filter((child) => typeof child !== 'string')
        .map((child) => (child.kind === 'proto' ? child.prototypeId : ''))
    ).toEqual(['shadcn-drawer-close']);
    expect(parts.map((part) => part.prototypeId)).not.toContain('shadcn-drawer-title');
    for (const body of children.filter((child) => child.kind === 'box')) {
      expect(
        body.children?.every(
          (child) => typeof child !== 'string' && child.kind === 'box' && child.className === 'p-4'
        )
      ).toBe(true);
    }
  }
);
