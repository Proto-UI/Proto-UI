import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import demo from '../../content/docs/zh-cn/demo-shadcn-select.demo';
import { assertDemoSpec, type DemoChild, type DemoNode } from './demo-types';
const nodes = (node: DemoChild): DemoNode[] =>
  typeof node === 'string'
    ? []
    : [node, ...(node.kind === 'text' ? [] : (node.children ?? []).flatMap(nodes))];
it('feeds real grouped parts and mixed Items back into the source-pinned public demo', () => {
  assertDemoSpec(demo);
  const all = nodes(demo.root).filter((node) => node.kind === 'proto');
  const groups = all.filter((node) => node.prototypeId === 'shadcn-select-group');
  expect(groups).toHaveLength(2);
  for (const group of groups)
    expect((group.children?.[0] as any).prototypeId).toBe('shadcn-select-label');
  expect(all.filter((node) => node.prototypeId === 'shadcn-select-label')).toHaveLength(2);
  expect(all.filter((node) => node.prototypeId === 'shadcn-select-separator')).toHaveLength(1);
  expect(
    all.filter((node) => node.prototypeId === 'shadcn-select-item').map((node) => node.props?.value)
  ).toEqual(['react', 'vue', 'wc', 'solid']);
  const loaders = readFileSync(
    'apps/www/src/components/PrototypePreviewer/prototype-modules.ts',
    'utf8'
  );
  for (const family of ['base', 'shadcn'])
    for (const name of ['group', 'label', 'separator'])
      expect(loaders).toContain(`'${family}-select-${name}': async`);
});
