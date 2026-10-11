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
