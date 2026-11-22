/** Real public DemoSpecs and framework adapters. No injected geometry or expected state. */
import * as baseTree from '@proto.ui/prototypes-base/tree';
import * as baseTable from '@proto.ui/prototypes-base/data-table';
import * as baseList from '@proto.ui/prototypes-base/virtual-list';
import * as baseInput from '@proto.ui/prototypes-base/input';
import * as baseButton from '@proto.ui/prototypes-base/button';
import baseTreeDemo from '../../../apps/www/src/content/docs/zh-cn/demo-base-tree.demo';
import baseTableDemo from '../../../apps/www/src/content/docs/zh-cn/demo-base-data-table-recipes.demo';
import baseListDemo from '../../../apps/www/src/content/docs/zh-cn/demo-base-virtual-list.demo';
import * as shadcnTree from '@proto.ui/prototypes-shadcn/tree';
import * as shadcnTable from '@proto.ui/prototypes-shadcn/data-table';
import * as shadcnList from '@proto.ui/prototypes-shadcn/virtual-list';
import * as shadcnInput from '@proto.ui/prototypes-shadcn/input';
import * as shadcnButton from '@proto.ui/prototypes-shadcn/button';
import shadcnTreeDemo from '../../../apps/www/src/content/docs/zh-cn/demo-shadcn-tree.demo';
import shadcnTableDemo from '../../../apps/www/src/content/docs/zh-cn/demo-shadcn-data-table-recipes.demo';
import shadcnListDemo from '../../../apps/www/src/content/docs/zh-cn/demo-shadcn-virtual-list.demo';
import * as brutalistTree from '@proto.ui/prototypes-brutalist/tree';
import * as brutalistTable from '@proto.ui/prototypes-brutalist/data-table';
import * as brutalistList from '@proto.ui/prototypes-brutalist/virtual-list';
import * as brutalistInput from '@proto.ui/prototypes-brutalist/input';
import * as brutalistButton from '@proto.ui/prototypes-brutalist/button';
import brutalistTreeDemo from '../../../apps/www/src/content/docs/zh-cn/demo-brutalist-tree.demo';
import brutalistTableDemo from '../../../apps/www/src/content/docs/zh-cn/demo-brutalist-data-table-recipes.demo';
import brutalistListDemo from '../../../apps/www/src/content/docs/zh-cn/demo-brutalist-virtual-list.demo';
import { styleScope } from '@proto.ui/prototypes-shadcn/style-scope';
import type { Prototype } from '@proto.ui/core';
import { renderDemo } from '../../../apps/www/src/components/PrototypePreviewer/demo-renderer';
import { registerPrototype } from '../../../apps/www/src/components/PrototypePreviewer/registry';
import type {
  DemoRuntimeApi,
  DemoSpec,
  DemoRenderResult,
} from '../../../apps/www/src/components/PrototypePreviewer/demo-types';
import type { RuntimeId } from '../../../apps/www/src/components/PrototypePreviewer/runtimes/ids';
for (const library of [
  baseTree,
  baseTable,
  baseList,
  baseInput,
  baseButton,
  shadcnTree,
  shadcnTable,
  shadcnList,
  shadcnInput,
  shadcnButton,
  brutalistTree,
  brutalistTable,
  brutalistList,
  brutalistInput,
  brutalistButton,
  { styleScope },
]) {
  for (const value of Object.values(library)) {
    if (value && typeof value === 'object' && 'name' in value && 'setup' in value) {
      const prototype = value as Prototype<any, any>;
      registerPrototype(prototype.name, prototype);
    }
  }
}

const demos: Record<string, Record<string, DemoSpec>> = {
  base: { tree: baseTreeDemo, 'data-table': baseTableDemo, 'virtual-list': baseListDemo },
  shadcn: { tree: shadcnTreeDemo, 'data-table': shadcnTableDemo, 'virtual-list': shadcnListDemo },
  brutalist: {
    tree: brutalistTreeDemo,
    'data-table': brutalistTableDemo,
    'virtual-list': brutalistListDemo,
  },
};
let view: DemoRenderResult | undefined;
let api: DemoRuntimeApi | undefined;
let host: HTMLElement;
let ownedContent: HTMLElement | undefined;
const trusted: Array<{ type: string; trusted: boolean; key?: string }> = [];
for (const type of ['keydown', 'click', 'input', 'wheel'])
  document.addEventListener(
    type,
    (event) => {
      if (host?.contains(event.target as Node))
        trusted.push({
          type,
          trusted: event.isTrusted,
          key: 'key' in event ? String(event.key) : undefined,
        });
    },
    true
  );
export async function settle() {
  for (let frame = 0; frame < 3; frame++)
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}
export async function mount(runtime: RuntimeId, family: string, kind: string) {
  await dispose();
  host = document.querySelector<HTMLElement>('#fixture')!;
  trusted.length = 0;
  const demo = demos[family][kind];
  view = await renderDemo({
    runtime,
    host,
    demo: {
      ...demo,
      setup(context) {
        api = context.api;
        const cleanup = demo.setup?.(context);
        ownedContent = context.refs.content;
        return cleanup;
      },
    },
  });
  await settle();
}
export function read(ref: string, path: string, ...args: unknown[]) {
  return api?.call(ref, path, ...args);
}
export function setProps(ref: string, props: Record<string, unknown>) {
  api?.setProps(ref, props);
}
export function inputs() {
  return trusted.slice();
}
export async function dispose() {
  const content = ownedContent;
  await view?.destroy();
  view = undefined;
  api = undefined;
  ownedContent = undefined;
  await settle();
  return {
    hostChildren: host?.childElementCount ?? 0,
    ownedContentChildren: content?.childElementCount ?? 0,
  };
}
