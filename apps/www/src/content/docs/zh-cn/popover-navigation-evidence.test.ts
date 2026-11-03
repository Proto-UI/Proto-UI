// @vitest-environment happy-dom
// Source and real WC consumer checks, not native-browser acceptance.
import { globSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { parse } from 'yaml';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertDemoSpec,
  collectPrototypeIds,
  type DemoChild,
  type DemoSpec,
} from '../../../components/PrototypePreviewer/demo-types';
import {
  getAvailableDemos,
  getDemoSourcePath,
  loadDemo,
} from '../../../components/PrototypePreviewer/demo-modules';
import shadcnDemo from '../demo-shadcn-popover-navigation.demo';
import brutalistDemo from '../demo-brutalist-popover-navigation.demo';
import {
  assertBrowserInventory,
  BROWSER_SUITES,
  PRODUCTION_BROWSER_SUITES,
  PRODUCTION_BROWSER_OWNERS,
  discoverBrowserSuites,
} from '../../../../../../scripts/test/runtime-test-plan.mjs';

const families = ['shadcn', 'brutalist'] as const;
const demos = { shadcn: shadcnDemo, brutalist: brutalistDemo };
const browserFile = 'apps/www/src/content/docs/zh-cn/popover-navigation.browser.test.ts';
const workflowFile = '.github/workflows/finf-representative-features-evidence.yml';
const cleanups: Array<() => void | Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function nodes(node: DemoChild): Exclude<DemoChild, string>[] {
  if (typeof node === 'string') return [];
  return node.kind === 'text' ? [node] : [node, ...(node.children ?? []).flatMap(nodes)];
}
function verifyConsumer(demo: DemoSpec, family: string) {
  assertDemoSpec(demo);
  const ids = new Set<string>();
  collectPrototypeIds(demo.root, ids);
  expect([...ids].sort()).toEqual(
    ['content', 'root', 'title', 'trigger'].map((part) => `${family}-popover-${part}`)
  );
  const authored = nodes(demo.root);
  for (const part of ['trigger', 'content']) {
    const found = authored.filter(
      (node) => node.kind === 'proto' && node.prototypeId === `${family}-popover-${part}`
    );
    expect(found).toHaveLength(1);
    const node = found[0];
    if (!node || node.kind !== 'proto') throw new Error('Expected public part');
    expect(node.props?.presentation).toBe('navigation');
  }
  const root = authored.find(
    (node) => node.kind === 'proto' && node.prototypeId === `${family}-popover-root`
  );
  if (!root || root.kind !== 'proto') throw new Error('Missing literal public Root');
  expect(root.props).not.toHaveProperty('presentation');
  if (family === 'shadcn') expect(root.props?.styleProfile).toBe('rhea');
  else expect(root.props).not.toHaveProperty('styleProfile');
  const content = authored.find(
    (node) => node.kind === 'proto' && node.prototypeId === `${family}-popover-content`
  );
  if (!content || content.kind !== 'proto') throw new Error('Missing public Content');
  expect(content.previewTheme).toBe('portal');
  const links = authored.filter((node) => node.kind === 'box' && node.tag === 'a');
  expect(links).toHaveLength(33);
  for (const link of links) {
    if (link.kind !== 'box') throw new Error('Expected native anchor');
    expect(link.attrs?.href).toMatch(/^#navigation-(section-\d\d|outside-destination)$/);
    for (const key of ['role', 'tabindex', 'onclick', 'onkeydown'])
      expect(link.attrs).not.toHaveProperty(key);
  }
  expect(demo).not.toHaveProperty('setup');
}
function verifyPage(source: string, family: string) {
  const previews = [...source.matchAll(/<PrototypePreviewer\b[\s\S]*?\/>/g)].map(
    (match) => match[0]
  );
  for (const id of [`demo-${family}-popover`, `demo-${family}-popover-navigation`]) {
    const matching = previews.filter((block) => block.includes(`demoId="${id}"`));
    expect(matching).toHaveLength(1);
    expect(matching[0]).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
  }
}
// Execute the real registry initializer with the real full filesystem glob as
// input. Only Vite's host-provided glob call is replaced; its ID algorithm and
// duplicate rejection are not reimplemented in this test.
function registryFromFiles(files: string[]) {
  const file = 'apps/www/src/components/PrototypePreviewer/demo-modules.ts';
  const source = readFileSync(file, 'utf8');
  const call = "import.meta.glob('../../content/**/*.demo.ts')";
  expect(source.split(call)).toHaveLength(2);
  const module = { exports: {} as { getAvailableDemos(): string[] } };
  const loaders = Object.fromEntries(
    files.map((file) => [
      file.replace('apps/www/src/content/', '../../content/'),
      async () => ({ default: null }),
    ])
  );
  const code = ts.transpileModule(source.replace(call, '__loaders__'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    __loaders__: loaders,
    require(id: string) {
      if (id !== './demo-types') throw new Error(`Unexpected registry dependency ${id}`);
      return { assertDemoSpec };
    },
  });
  return module.exports.getAvailableDemos();
}

describe.sequential('public navigation consumer and evidence closure', () => {
  it('uses the real complete demo glob and rejects a duplicate new basename', () => {
    const files = globSync('apps/www/src/content/**/*.demo.ts').sort();
    const actual = registryFromFiles(files);
    expect([...getAvailableDemos()].sort()).toEqual([...actual].sort());
    for (const family of families) {
      const id = `demo-${family}-popover-navigation`;
      expect(actual.filter((value) => value === id)).toHaveLength(1);
      expect(getDemoSourcePath(id)).toBe(`apps/www/src/content/docs/${id}.demo.ts`);
      expect(() =>
        registryFromFiles([...files, `apps/www/src/content/docs/countercontrol/${id}.demo.ts`])
      ).toThrow(/demo ID 冲突/);
    }
  });
  it('shadcn: removing the supported Root Rhea selection is rejected', () => {
    const demo: DemoSpec = structuredClone(shadcnDemo);
    const root = nodes(demo.root).find(
      (node) => node.kind === 'proto' && node.prototypeId === 'shadcn-popover-root'
    );
    if (!root || root.kind !== 'proto' || !root.props)
      throw new Error('Countercontrol Root absent');
    delete root.props.styleProfile;
    expect(() => verifyConsumer(demo, 'shadcn')).toThrow();
  });
  for (const family of families) {
    it(`${family}: loads the ordinary literal public consumer with exact reached parts`, async () => {
      const demo = await loadDemo(`demo-${family}-popover-navigation`);
      verifyConsumer(demo, family);
      expect(demo).toEqual(demos[family]);
    });
    for (const part of ['trigger', 'content'] as const)
      it(`${family}: removing ${part} presentation is rejected`, () => {
        const demo: DemoSpec = structuredClone(demos[family]);
        const node = nodes(demo.root).find(
          (node) => node.kind === 'proto' && node.prototypeId === `${family}-popover-${part}`
        );
        if (!node || node.kind !== 'proto' || !node.props)
          throw new Error('Countercontrol target absent');
        delete node.props.presentation;
        expect(() => verifyConsumer(demo, family)).toThrow();
      });
    it(`${family}: both ordinary public pages retain default and append navigation`, () => {
      for (const locale of ['en', 'zh-cn']) {
        const file = `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${family === 'brutalist' ? 'components/' : ''}popover.mdx`;
        const source = readFileSync(file, 'utf8');
        verifyPage(source, family);
      }
    });
    for (const fault of ['missing-navigation-id', 'missing-navigation-runtime'] as const)
      it(`${family}: ${fault} fails its real page-link oracle`, () => {
        const file = `apps/www/src/content/docs/en/ui-libraries/${family}/${family === 'brutalist' ? 'components/' : ''}popover.mdx`;
        const original = readFileSync(file, 'utf8');
        const id = `demo-${family}-popover-navigation`;
        const bad =
          fault === 'missing-navigation-id'
            ? original.replace(`demoId="${id}"`, `demoId="missing-${id}"`)
            : original.replace(
                new RegExp(
                  `(<PrototypePreviewer\\s+demoId="${id}"[\\s\\S]*?)runtimes=\\{\\['wc', 'react', 'vue', 'vue2'\\]\\}`
                ),
                "$1runtimes={['wc']}"
              );
        expect(bad).not.toBe(original);
        expect(() => verifyPage(bad, family)).toThrow();
      });
    it(`${family}: real renderer rejects the reached Root when it is not registered`, async () => {
      vi.resetModules();
      const { loadPrototypes } =
        await import('../../../components/PrototypePreviewer/prototype-modules');
      const { renderDemo } = await import('../../../components/PrototypePreviewer/demo-renderer');
      const ids = new Set<string>();
      collectPrototypeIds(demos[family].root, ids);
      await loadPrototypes([...ids].filter((id) => id !== `${family}-popover-root`));
      const host = document.createElement('div');
      document.body.append(host);
      await expect(renderDemo({ host, runtime: 'wc', demo: demos[family] })).rejects.toThrow(
        `未找到原型 "${family}-popover-root"`
      );
    });
    it(`${family}: normal exact loader and WC renderer mount the declared consumer`, async () => {
      const { getElementProps } = await import('@proto.ui/adapter-web-component');
      const { loadPrototypes } =
        await import('../../../components/PrototypePreviewer/prototype-modules');
      const { renderDemo } = await import('../../../components/PrototypePreviewer/demo-renderer');
      const ids = new Set<string>();
      collectPrototypeIds(demos[family].root, ids);
      await loadPrototypes([...ids]);
      const host = document.createElement('div');
      document.body.append(host);
      const rendered = await renderDemo({ host, runtime: 'wc', demo: demos[family] });
      cleanups.push(() => rendered.destroy());
      const root = host.querySelector<HTMLElement>('[data-demo-ref="navigation-root"]');
      const trigger = host.querySelector<HTMLElement>('[data-demo-ref="navigation-trigger"]');
      expect(root).not.toBeNull();
      expect(trigger).not.toBeNull();
      if (!root || !trigger) throw new Error('Actual consumer refs missing');
      expect(getElementProps(trigger)?.presentation).toBe('navigation');
      if (family === 'shadcn') expect(getElementProps(root)?.styleProfile).toBe('rhea');
      expect(host.querySelectorAll('a[href="#navigation-outside-destination"]')).toHaveLength(1);
    });
  }
  it('registers this exact native suite once without weakening the real whole browser inventory', () => {
    const all = discoverBrowserSuites(process.cwd());
    expect(PRODUCTION_BROWSER_SUITES.filter((file) => file === browserFile)).toHaveLength(1);
    expect(PRODUCTION_BROWSER_OWNERS[browserFile]).toBe(workflowFile);
    assertBrowserInventory(all);
    expect(() =>
      assertBrowserInventory(
        all,
        BROWSER_SUITES,
        PRODUCTION_BROWSER_SUITES.filter((file) => file !== browserFile)
      )
    ).toThrow(/unregistered=/);
    expect(() =>
      assertBrowserInventory(all, BROWSER_SUITES, [...PRODUCTION_BROWSER_SUITES, browserFile])
    ).toThrow(/Duplicate/);
    expect(() =>
      assertBrowserInventory([...all, 'apps/www/src/unclaimed.browser.test.ts'])
    ).toThrow(/unregistered=/);
  });
  it('keeps the official direct-head workflow, exact group, budgets and artifact retention', () => {
    const source = readFileSync(workflowFile, 'utf8');
    const workflow = parse(source);
    expect(
      workflow.jobs['representative-features'].strategy.matrix.group.filter(
        (group: string) => group === 'popover-navigation'
      )
    ).toHaveLength(1);
    expect(source).toContain(`TEST_FILE=${browserFile}`);
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(workflow.jobs['representative-features']['timeout-minutes']).toBe(35);
    expect(workflow.jobs['representative-features'].strategy['max-parallel']).toBe(4);
    expect(workflow.jobs['representative-features'].strategy['fail-fast']).toBe(false);
    expect(source).toContain('ref: ${{ env.CANDIDATE_SHA }}');
    expect(source).toContain('persist-credentials: false');
    expect(source).toContain('retention-days: 30');
    const browserSource = readFileSync(browserFile, 'utf8');
    expect(browserSource).toContain('chromiumSandbox: true');
    expect(browserSource).toContain('request.abort()');
    expect(browserSource).toContain('expect(candidate.cleanExactCommit).toBe(true)');
    expect(browserSource).toContain('await context?.close()');
  });
});
