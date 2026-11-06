import { afterEach, describe, expect, it } from 'vitest';
import { definePrototype, type ExposeState } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { selectRoot as baseRoot, SELECT_CONTEXT } from '@proto.ui/prototypes-base/select';
import { selectRoot as shadcnRoot } from '@proto.ui/prototypes-shadcn/select';
import demo from '../../content/docs/zh-cn/demo-shadcn-select.demo';
import { createHomepageLocaleSelect } from '../Homepage/homepage-locale-select';
import { assertDemoSpec, type DemoChild, type DemoNode } from './demo-types';

type ProtoNode = Extract<DemoNode, { kind: 'proto' }>;
function nodes(node: DemoChild): DemoNode[] {
  return typeof node === 'string'
    ? []
    : [node, ...(node.kind === 'text' ? [] : (node.children ?? []).flatMap(nodes))];
}
function part(id: string): ProtoNode {
  const matches = nodes(demo.root).filter(
    (node): node is ProtoNode => node.kind === 'proto' && node.prototypeId === id
  );
  expect(matches).toHaveLength(1);
  return matches[0];
}
const probe = definePrototype<{}, { observedSizing: ExposeState<string> }>({
  name: 'website-select-sizing-context-probe',
  setup(def) {
    const policy = def.state.string('observedSizing', 'unobserved');
    def.context.subscribe(SELECT_CONTEXT, (_run, next) => policy.set(String(next.itemSizing)));
    def.lifecycle.onCreated((run) =>
      policy.set(String(run.context.read(SELECT_CONTEXT).itemSizing))
    );
    def.expose.state('observedSizing', policy);
  },
});
const Probe = AdaptToWebComponent(probe, { registerAs: 'website-select-sizing-context-probe' });
const BaseRoot = AdaptToWebComponent(baseRoot, { registerAs: 'website-sizing-base-root' });
const ShadcnRoot = AdaptToWebComponent(shadcnRoot, { registerAs: 'website-sizing-shadcn-root' });
async function observedPolicy(Root: typeof BaseRoot, props: Record<string, unknown>) {
  const root = new Root();
  const observer = new Probe();
  setElementProps(root, props);
  root.append(observer);
  document.body.append(root);
  await Promise.resolve();
  await Promise.resolve();
  return observer.getExposes().observedSizing.get();
}
afterEach(() => document.body.replaceChildren());

describe('public Shadcn Select sizing opt-in consumer', () => {
  it.each(['wc', 'react', 'vue', 'vue2'] as const)(
    'passes the %s homepage locale recipe through the public Shadcn Root context',
    async (runtime) => {
      const { demo: localeDemo } = createHomepageLocaleSelect(
        {
          value: 'en',
          label: 'Language',
          options: [{ value: 'en', label: 'English', path: '/en/' }],
        },
        'shadcn',
        runtime,
        () => true
      );
      const root = nodes(localeDemo.root).find(
        (node): node is ProtoNode => node.kind === 'proto' && node.ref === 'home-locale-root'
      );
      expect(root).toBeDefined();
      expect(await observedPolicy(ShadcnRoot, root!.props ?? {})).toBe('match-trigger');
      const withoutOptIn = { ...root!.props };
      delete withoutOptIn.itemSizing;
      expect(await observedPolicy(ShadcnRoot, withoutOptIn)).toBe('intrinsic');
    }
  );

  it('authors only explicit Root sizing while retaining the existing positioning and anatomy', () => {
    assertDemoSpec(demo);
    expect(part('shadcn-select-root').props?.itemSizing).toBe('match-trigger');
    const content = part('shadcn-select-content');
    expect(content.props?.position).toBeUndefined();
    expect(content.surfaceStyle).toBeUndefined();
    expect(part('shadcn-select-trigger').className).toBe('w-56');
    expect(part('shadcn-select-trigger').props?.appearance).toBeUndefined();
    const items = nodes(demo.root).filter(
      (node): node is ProtoNode =>
        node.kind === 'proto' && node.prototypeId === 'shadcn-select-item'
    );
    expect(items.map((item) => [item.props?.value, !!item.props?.disabled])).toEqual([
      ['react', false],
      ['vue', false],
      ['wc', false],
      ['solid', true],
    ]);
    expect(items.every((item) => item.props?.itemSizing === undefined)).toBe(true);
    expect(part('shadcn-select-surface').children?.[0]).toBe(part('shadcn-select-viewport'));
  });
  it('passes the authored demo opt-in through the real public Shadcn Root context', async () => {
    expect(await observedPolicy(ShadcnRoot, part('shadcn-select-root').props ?? {})).toBe(
      'match-trigger'
    );
  });
  for (const [name, Root] of [
    ['Base', BaseRoot],
    ['Shadcn', ShadcnRoot],
  ] as const)
    it(`keeps the public ${name} Root default intrinsic when no consumer opts in`, async () => {
      expect(await observedPolicy(Root, {})).toBe('intrinsic');
    });
  it('observes intrinsic again when only the demo sizing opt-in is removed', async () => {
    const props = { ...part('shadcn-select-root').props };
    delete props.itemSizing;
    expect(await observedPolicy(ShadcnRoot, props)).toBe('intrinsic');
  });
});
