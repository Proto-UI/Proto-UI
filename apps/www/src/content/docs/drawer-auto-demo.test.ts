// @vitest-environment node
import { expect, it } from 'vitest';
import {
  assertDemoSpec,
  type DemoNode,
  type DemoSpec,
} from '../../components/PrototypePreviewer/demo-types';
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
      (child): child is Extract<DemoNode, { kind: 'box' }> =>
        child.kind === 'box' &&
        (child.children ?? []).some(
          (part) =>
            typeof part !== 'string' &&
            part.kind === 'proto' &&
            part.prototypeId === 'shadcn-drawer-header'
        )
    );
    const children =
      column && 'children' in column
        ? column.children!.filter((child): child is DemoNode => typeof child !== 'string')
        : direct;
    if (!_path.includes('-scroll.')) {
      expect(column).toBeDefined();
      expect(column!.className?.split(/\s+/)).toEqual(
        expect.arrayContaining(['mx-auto', 'w-full', 'max-w-sm'])
      );
    }
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
    ).toEqual(
      _path === './demo-shadcn-drawer.demo.ts'
        ? ['shadcn-button', 'shadcn-drawer-close']
        : ['shadcn-drawer-close']
    );
    expect(parts.map((part) => part.prototypeId)).not.toContain('shadcn-drawer-title');
    // C-DRAWER-STRUCTURE-0001-INTERIOR gives Header/Footer their own
    // padding and the authored body its spacing; it does not require every
    // body child to be another p-4 box or restrict the Footer to one command.
    const bodies = children.filter((child) => child.kind === 'box');
    expect(bodies).toHaveLength(1);
    const body = bodies[0];
    expect(children.indexOf(header!)).toBeLessThan(children.indexOf(body));
    expect(children.indexOf(body)).toBeLessThan(children.indexOf(footer!));
    expect(body.className?.split(/\s+/)).toEqual(
      expect.arrayContaining(['px-4', _path === './demo-shadcn-drawer.demo.ts' ? 'py-3' : 'py-2'])
    );
    expect(body.children!.length).toBeGreaterThan(0);
    if (_path !== './demo-shadcn-drawer.demo.ts') {
      expect(body.className?.split(/\s+/)).toEqual(
        expect.arrayContaining(['flex-1', 'overflow-y-auto'])
      );
    }
    expect(header!.className ?? '').not.toMatch(/(?:^|\s)p[xytrblse]?-\S+/);
    expect(footer!.className ?? '').not.toMatch(/(?:^|\s)p[xytrblse]?-\S+/);
  }
);

// These examples share the public Drawer route, so an invalid portal blocks
// unrelated native fixtures on that page before their own geometry is sampled.
const portalExamples = import.meta.glob<DemoSpec>(
  './demo_components/drawer/demo-brutalist-drawer-*.demo.ts',
  { eager: true, import: 'default' }
);
it.each(Object.entries(portalExamples))(
  'keeps every public Brutalist Drawer portal mountable in %s',
  (_path, demo) => {
    expect(() => assertDemoSpec(demo)).not.toThrow();
    const content = panels(demo.root);
    expect(content.length).toBeGreaterThan(0);
    for (const panel of content) expect(panel.previewTheme).toBe('portal');
    expect(new Set(content.map((panel) => panel.ref)).size).toBe(content.length);

    const missingRef = structuredClone(demo);
    delete panels(missingRef.root)[0].ref;
    expect(() => assertDemoSpec(missingRef)).toThrow(
      'previewTheme requires portal and a nonempty ref'
    );
  }
);
