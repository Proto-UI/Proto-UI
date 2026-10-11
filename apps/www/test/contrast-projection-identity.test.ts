import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import { transformSync } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { initDocumentationHeaderSurface } from '../src/components/site-header-surface';
import {
  establishContrastPopupEscapeBaseline,
  readContrastPopupEscapeBefore,
  readContrastPopupEscapeAfter,
} from '../scripts/contrast-popup-escape.mjs';
import { discoverContrastSources } from '../scripts/contrast-audit-plan.mjs';
import { compileContrastAnatomy, compareContrastAnatomy } from '../scripts/contrast-anatomy.mjs';
import {
  KnownUnsupportedContrastDomain,
  isKnownUnsupportedContrastCase,
  isUnresolvedContrastCase,
} from '../scripts/contrast-known-unsupported.mjs';
import {
  assertDemoSpec,
  collectPrototypeIds,
} from '../src/components/PrototypePreviewer/demo-types';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import { initProjectedPreviewer } from '../src/components/PrototypePreviewer/projected-previewer-client';
import {
  PROJECTION_FAMILY_MANIFESTS,
  resolveProjectionRecipe,
  type ProjectionComponentId,
} from '../src/components/PrototypePreviewer/projection-families';
import { runtimePreviewRecipe } from '../src/components/PrototypePreviewer/runtime-preview-surface';
import { surfacePrototypeId } from '../src/components/surface-recipes';
import {
  AdapterIds,
  selectRuntimeIds,
} from '../src/components/PrototypePreviewer/runtimes/registry';
import {
  createContrastReportJournal,
  readContrastReportJournal,
} from '../scripts/contrast-report-journal.mjs';

// Real production initialization and installed frameworks. Only CDN acquisition
// is replaced; these tests do not launch a browser or establish native evidence.
vi.mock('../src/components/PrototypePreviewer/runtimes/react-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/react/package.json');
  return {
    loadReact: async () => ({
      React: require('react'),
      ReactDOM: { ...require('react-dom'), ...require('react-dom/client') },
    }),
  };
});
vi.mock('../src/components/PrototypePreviewer/runtimes/vue-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/apps/www/package.json');
  return { loadVue: async () => require('vue') };
});
vi.mock('../src/components/PrototypePreviewer/runtimes/vue2-runtime', async (original) => {
  const current =
    await original<typeof import('../src/components/PrototypePreviewer/runtimes/vue2-runtime')>();
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/vue2/package.json');
  return { ...current, loadVue2: async () => require('vue') };
});

// Delay only delivery of the real independently rendered shell's completion in
// startup-order controls. No DOM identity/readiness value is fabricated.
const startupBarrier = vi.hoisted(() => ({ wait: null as Promise<void> | null }));
vi.mock('../src/components/PrototypePreviewer/runtime-preview-surface', async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import('../src/components/PrototypePreviewer/runtime-preview-surface')
    >();
  return {
    ...original,
    createRuntimePreviewSurface(...args: Parameters<typeof original.createRuntimePreviewSurface>) {
      const surface = original.createRuntimePreviewSurface(...args);
      const wait = startupBarrier.wait;
      return {
        ...surface,
        get ready() {
          return wait ? surface.ready.then(() => wait) : surface.ready;
        },
      };
    },
  };
});

// Use the same bounded source discovery as the CLI. Every admitted family
// must resolve to one real recipe and one actual public MDX route.
const authoredSources = await discoverContrastSources({
  contentRoot: resolve(process.cwd(), 'apps/www/src/content'),
  manifest: PROJECTION_FAMILY_MANIFESTS.brutalist,
  families: Object.keys(PROJECTION_FAMILY_MANIFESTS.brutalist.families),
});
const runtimes = AdapterIds;
type Runtime = (typeof runtimes)[number];
function pageDeclaration(family: string): {
  family: string;
  recipeId: string;
  runtimes: Runtime[];
  component: { projectionFamilyId: 'brutalist'; familyId: ProjectionComponentId };
} {
  const document = unified()
    .use(remarkParse)
    .use(remarkMdx)
    .parse(readFileSync(resolve(process.cwd(), authoredSources[family].pagePath), 'utf8'));
  const previewers: any[] = [];
  const visit = (node: any): void => {
    if (node.type === 'mdxJsxFlowElement' && node.name === 'PrototypePreviewer')
      previewers.push(node);
    for (const child of node.children ?? []) visit(child);
  };
  visit(document);
  const declaration = previewers[0];
  if (!declaration) throw new Error(`No declared primary preview: ${family}`);
  const attributes = new Map<string, any>(
    declaration.attributes.map((attribute: any) => [attribute.name, attribute.value])
  );
  const recipeId = attributes.get('demoId');
  if (typeof recipeId !== 'string') throw new Error(`Nonliteral primary recipe: ${family}`);
  let requested: Runtime[] | undefined;
  const runtimeAttribute = attributes.get('runtimes');
  if (runtimeAttribute !== undefined) {
    if (runtimeAttribute?.type !== 'mdxJsxAttributeValueExpression')
      throw new Error(`Unknown runtime declaration: ${family}`);
    const expression = ts.createSourceFile(
      'runtimes.ts',
      runtimeAttribute.value,
      ts.ScriptTarget.Latest,
      true
    ).statements[0];
    if (
      !expression ||
      !ts.isExpressionStatement(expression) ||
      !ts.isArrayLiteralExpression(expression.expression)
    )
      throw new Error(`Nonliteral runtime list: ${family}`);
    requested = expression.expression.elements.map((element) => {
      if (!ts.isStringLiteral(element) || !runtimes.includes(element.text as Runtime))
        throw new Error(`Unknown declared runtime: ${family}`);
      return element.text as Runtime;
    });
  }
  const component = resolveProjectionRecipe(recipeId);
  if (component.projectionFamilyId !== 'brutalist' || component.familyId !== family) {
    throw new Error(`Primary page recipe belongs to another component: ${family}`);
  }
  return {
    family,
    recipeId,
    runtimes: selectRuntimeIds(requested),
    component: { projectionFamilyId: component.projectionFamilyId, familyId: component.familyId },
  };
}
const declarations = Object.keys(PROJECTION_FAMILY_MANIFESTS.brutalist.families).map(
  pageDeclaration
);
type IdentityObservation = {
  achieved: boolean;
  owner: string | null;
  generation: string | null;
  shellGeneration: string | null;
  expected: Record<string, unknown>;
  observed: Record<string, unknown>;
};
type AuditCase = {
  family: string;
  runtime: Runtime;
  theme: string;
  status: string;
  plannedStates: string[];
  achievedTargets: string[];
  errors: { phase: string; error: string }[];
  projectionReadinessFailure?: IdentityObservation;
};
const runnerSource = readFileSync(
  resolve(process.cwd(), 'apps/www/scripts/audit-brutalist-contrast.mts'),
  'utf8'
);
const runnerAst = ts.createSourceFile('audit.mts', runnerSource, ts.ScriptTarget.Latest, true);

function declaration(name: string): string {
  const node = runnerAst.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name
  );
  if (!node) throw new Error(`Missing actual auditor function: ${name}`);
  return node.getText(runnerAst);
}

function javascript(source: string): string {
  return ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
}

// Importing the CLI runner would execute top-level server/browser setup. Compile
// its actual private functions instead; no copied predicate can drift from it.
const subjectFunctions = ['bindCaseSubject', 'caseSubject', 'casePreviewer', 'releaseCaseSubject'];
function bindTestReaders(raw: any, subjects: WeakMap<object, unknown>) {
  const invoke = (name: string, page: any, auditCase: AuditCase, args: unknown[]) =>
    subjects.has(page)
      ? raw[name](...args)
      : raw
          .bindCaseSubject(page, page.locator('[data-previewer-id]').first(), auditCase)
          .then(() => raw[name](...args));
  return {
    ...raw,
    raw,
    projectionObservation: (page: any, auditCase: AuditCase) =>
      invoke('projectionObservation', page, auditCase, [page, auditCase]),
    assertProjectionReadiness: (page: any, auditCase: AuditCase) =>
      invoke('assertProjectionReadiness', page, auditCase, [page, auditCase]),
    anatomyObservation: (page: any, auditCase: AuditCase, state: string) =>
      invoke('anatomyObservation', page, auditCase, [page, auditCase, state]),
    passiveSurfaceObservation: (page: any, family: string, runtime: Runtime) =>
      invoke('passiveSurfaceObservation', page, item(runtime, family), [page, family, runtime]),
  };
}
function auditor(withReadiness = false) {
  const names = [
    'projectionExpectation',
    ...subjectFunctions,
    'projectionObservation',
    ...(withReadiness ? ['assertProjectionReadiness'] : []),
  ];
  const availability = Object.fromEntries(
    declarations.map((entry) => [entry.family, { serialized: JSON.stringify(entry.runtimes) }])
  );
  const caseSubjects = new WeakMap<object, unknown>();
  const raw = new Function(
    'PROJECTION_FAMILY_MANIFESTS',
    'runtimeAvailability',
    'surfacePrototypeId',
    'caseSubjects',
    transformSync(names.map(declaration).join('\n'), {
      loader: 'ts',
      target: 'es2022',
      keepNames: true,
      minifyWhitespace: true,
    }).code + `\nreturn {${names.join(',')}};`
  )(PROJECTION_FAMILY_MANIFESTS, availability, surfacePrototypeId, caseSubjects);
  return bindTestReaders(raw, caseSubjects);
}

function item(runtime: Runtime = 'wc', family = 'button'): AuditCase {
  return {
    family,
    runtime,
    theme: 'light',
    status: 'running',
    plannedStates: ['rest'],
    achievedTargets: [],
    errors: [],
  };
}

function pageFor(root: HTMLElement) {
  return pipelinePage(root);
}

let fixtureId = 0;
const unexpectedErrors: unknown[][] = [];
const originalConsoleError = console.error;
beforeAll(() => {
  installActualProbe();
  console.error = (...args: unknown[]) => unexpectedErrors.push(args);
});
afterAll(() => {
  console.error = originalConsoleError;
  delete (globalThis as any).puiContrastProbe;
  expect(unexpectedErrors, 'unexpected producer errors after full cleanup').toEqual([]);
});

function elements(root: HTMLElement) {
  const content = root.querySelector<HTMLElement>('[data-projection-content]')!;
  const retained = content.querySelector<HTMLElement>(
    '[data-demo-ref="__website_runtime_preview_surface__-content"]'
  )!;
  const shellMount = content.querySelector<HTMLElement>(
    '[data-demo-ref="__website_runtime_preview_surface__-mount"]'
  )!;
  const shell = content.querySelector<HTMLElement>(
    '[data-demo-ref="__website_runtime_preview_surface__"]'
  )!;
  return {
    root,
    scope: root.querySelector<HTMLElement>('[data-projection-scope]')!,
    content,
    retained,
    shellMount,
    shell,
    slot: shell.querySelector<HTMLElement>('[data-passive-shell-slot]')!,
    rendererHost: shellMount.firstElementChild as HTMLElement,
    physical: retained.querySelector<HTMLElement>('[data-pui-root]')!,
    page: pageFor(root),
  };
}
async function preview(
  runtime: Runtime = 'wc',
  family = 'button',
  atStartup?: (root: HTMLElement) => Promise<void>
) {
  localStorage.clear();
  const declaration = declarations.find((entry) => entry.family === family)!;
  expect(declaration.runtimes).toContain(runtime);
  const root = document.createElement('section');
  root.dataset.previewerId = `contrast-identity-${++fixtureId}`;
  // Authored Astro inputs; the actual producer commits component, content,
  // scope, ownership and physical Prototype markers, rather than this fixture.
  root.dataset.demoId = declaration.recipeId;
  root.dataset.runtimes = JSON.stringify(declaration.runtimes);
  root.innerHTML = '<div class="host"></div>';
  document.body.append(root);
  initProjectedPreviewer({
    root,
    initialRuntime: runtime,
    runtimeList: declaration.runtimes,
    projectionFamilyId: declaration.component.projectionFamilyId,
    componentId: declaration.component.familyId,
    toolbar: true,
  });
  const destroy = async () => {
    await (
      root as HTMLElement & { __previewer__: { destroy(): Promise<void> } }
    ).__previewer__.destroy();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(root.querySelector('.host')!.childNodes).toHaveLength(0);
    root.remove();
    localStorage.clear();
  };
  try {
    await atStartup?.(root);
    await vi.waitFor(() => expect(root.dataset.projectionState).toBe('ready'), { timeout: 5000 });
    return {
      ...elements(root),
      destroy,
    };
  } catch (error) {
    await destroy();
    throw error;
  }
}
type Preview = Awaited<ReturnType<typeof preview>>;

for (const declaration of declarations)
  for (const runtime of declaration.runtimes) {
    const family = declaration.family;
    it(`${family}/${runtime}: admits the real production preview without relabeling its content recipe`, async () => {
      const mounted = await preview(runtime, family);
      try {
        expect(mounted.root.dataset.projectionComponent).toBe(family);
        expect(mounted.content.dataset.projectionId).toBe(
          runtimePreviewRecipe('brutalist', family as ProjectionComponentId).id
        );
        const observed = await auditor().projectionObservation(mounted.page, item(runtime, family));
        expect(observed.achieved, JSON.stringify(observed)).toBe(true);
        expect(observed.observed).toMatchObject({
          componentId: family,
          contentRecipeId: runtimePreviewRecipe('brutalist', family as ProjectionComponentId).id,
          rootPresent: true,
          invalidRoots: [],
        });
      } finally {
        await mounted.destroy();
      }
    });
  }

it('preserves every declared primary recipe and page/runtime/theme case, including explicit Tooltip limits', () => {
  expect(declarations.map(({ family }) => family)).toEqual(Object.keys(authoredSources));
  for (const declaration of declarations) {
    expect(declaration.recipeId).toBe(
      (PROJECTION_FAMILY_MANIFESTS.brutalist.families as any)[declaration.family].recipeId
    );
    expect(declaration.component).toEqual({
      projectionFamilyId: 'brutalist',
      familyId: declaration.family,
    });
  }
  expect(
    declarations.reduce((count, declaration) => count + declaration.runtimes.length * 2, 0)
  ).toBe(declarations.length * 8 - 2);
  expect(declarations.find((declaration) => declaration.family === 'tooltip')?.runtimes).toEqual([
    'wc',
    'react',
    'vue',
  ]);
  expect(declarations.find((declaration) => declaration.family === 'dropdown-menu')?.recipeId).toBe(
    'demo-brutalist-dropdown-menu'
  );
  expect(declarations.find((declaration) => declaration.family === 'scroll-area')?.recipeId).toBe(
    'demo-brutalist-scroll-area'
  );
});

it('binds every admitted family to the actual producer recipe without importing its renderer into the CLI', async () => {
  const { projectionExpectation } = auditor();
  const families = Object.keys(PROJECTION_FAMILY_MANIFESTS.brutalist.families);
  expect(families).toEqual(Object.keys(authoredSources));
  for (const family of families) {
    const expected = projectionExpectation(item('wc', family));
    const production = runtimePreviewRecipe('brutalist', family as ProjectionComponentId);
    expect(expected.contentRecipeId, family).toBe(production.id);
    expect(expected.prototypeIds, family).toEqual(production.prototypeIds);
    expect(expected.rootPrototypeId, family).toBe(production.rootPrototypeId);
  }
});

type Mutation = readonly [string, (mounted: Preview) => () => void];
function attribute(
  target:
    | 'root'
    | 'scope'
    | 'content'
    | 'physical'
    | 'shellMount'
    | 'retained'
    | 'shell'
    | 'slot'
    | 'rendererHost',
  name: string,
  value: string | null
): Mutation[1] {
  return (mounted) => {
    const element = mounted[target];
    const previous = element.getAttribute(name);
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
    return () => {
      if (previous === null) element.removeAttribute(name);
      else element.setAttribute(name, previous);
    };
  };
}
const mutations: Mutation[] = [
  ['wrong authored demo', attribute('root', 'data-demo-id', 'demo-brutalist-switch')],
  ['missing authored demo', attribute('root', 'data-demo-id', null)],
  ['different runtime declaration', attribute('root', 'data-runtimes', '["wc"]')],
  ['missing runtime declaration', attribute('root', 'data-runtimes', null)],
  ['wrong component coordinate', attribute('root', 'data-projection-component', 'switch')],
  ['missing component coordinate', attribute('root', 'data-projection-component', null)],
  ['unpublished previewer', attribute('root', 'data-projection-state', 'loading')],
  ['wrong published runtime', attribute('root', 'data-projection-runtime', 'react')],
  ['wrong published family', attribute('root', 'data-projection-family', 'shadcn')],
  ['loading scope', attribute('scope', 'data-projection-state', 'preparing')],
  ['error scope', attribute('scope', 'data-projection-state', 'error')],
  ['wrong scope family', attribute('scope', 'data-projection-family', 'shadcn')],
  ['wrong scope runtime', attribute('scope', 'data-projection-runtime', 'react')],
  ['missing scope owner', attribute('scope', 'data-projection-scope', '')],
  ['foreign explicit scope owner', attribute('scope', 'data-projection-owner', 'foreign')],
  ['empty explicit scope owner', attribute('scope', 'data-projection-owner', '')],
  ['missing scope generation', attribute('scope', 'data-projection-generation', null)],
  ['changed scope generation', attribute('scope', 'data-projection-generation', '999')],
  ['missing content owner', attribute('content', 'data-projection-owner', null)],
  ['foreign content owner', attribute('content', 'data-projection-owner', 'foreign')],
  ['missing content generation', attribute('content', 'data-projection-generation', null)],
  ['changed content generation', attribute('content', 'data-projection-generation', '999')],
  ['wrong content family', attribute('content', 'data-projection-family', 'shadcn')],
  ['wrong content runtime', attribute('content', 'data-projection-runtime', 'react')],
  ['missing content recipe', attribute('content', 'data-projection-id', null)],
  ['legacy component-as-recipe value', attribute('content', 'data-projection-id', 'button')],
  [
    'another valid content recipe',
    attribute('content', 'data-projection-id', 'website-runtime-preview:demo-brutalist-switch'),
  ],
  [
    'prefixed recipe near-match',
    attribute('content', 'data-projection-id', 'xwebsite-runtime-preview:demo-brutalist-button'),
  ],
  [
    'suffixed recipe near-match',
    attribute('content', 'data-projection-id', 'website-runtime-preview:demo-brutalist-button:x'),
  ],
  [
    'wrong content root',
    attribute('content', 'data-projection-prototype', 'brutalist-switch-root'),
  ],
  ['missing content root', attribute('content', 'data-projection-prototype', null)],
  ['outer content falsely claims to be a physical root', attribute('content', 'data-pui-root', '')],
  ['one physical root lacks owner', attribute('physical', 'data-projection-owner', null)],
  [
    'one physical root has foreign owner',
    attribute('physical', 'data-projection-owner', 'foreign'),
  ],
  ['one physical root lacks generation', attribute('physical', 'data-projection-generation', null)],
  [
    'one physical root has old generation',
    attribute('physical', 'data-projection-generation', '0'),
  ],
  ['one physical root lacks identity', attribute('physical', 'data-projection-prototype', null)],
  [
    'one physical root is unadmitted',
    attribute('physical', 'data-projection-prototype', 'unknown'),
  ],
  ['missing scope marker', attribute('scope', 'data-projection-scope', null)],
  ['missing content marker', attribute('content', 'data-projection-content', null)],
  [
    'duplicate scope',
    ({ root }) => {
      const duplicate = document.createElement('div');
      duplicate.setAttribute('data-projection-scope', 'duplicate');
      root.append(duplicate);
      return () => duplicate.remove();
    },
  ],
  [
    'duplicate content',
    ({ scope }) => {
      const duplicate = document.createElement('div');
      duplicate.setAttribute('data-projection-content', '');
      scope.append(duplicate);
      return () => duplicate.remove();
    },
  ],
  [
    'no physical authored root',
    ({ retained }) => {
      const roots = [...retained.querySelectorAll('[data-pui-root]')];
      roots.forEach((root) => root.removeAttribute('data-pui-root'));
      return () => roots.forEach((root) => root.setAttribute('data-pui-root', ''));
    },
  ],
  [
    'unstamped extra physical root beside valid roots',
    ({ retained }) => {
      const extra = document.createElement('div');
      extra.setAttribute('data-pui-root', '');
      retained.append(extra);
      return () => extra.remove();
    },
  ],
];

function moveNode(node: HTMLElement, destination: HTMLElement): () => void {
  const parent = node.parentNode!;
  const next = node.nextSibling;
  destination.append(node);
  return () => parent.insertBefore(node, next?.parentNode === parent ? next : null);
}

const shellMutations: Mutation[] = [
  ['missing reserved shell ref', attribute('shell', 'data-demo-ref', null)],
  ['wrong reserved shell ref', attribute('shell', 'data-demo-ref', 'ordinary-surface')],
  ['fake non-Prototype shell', attribute('shell', 'data-pui-root', null)],
  ['shell advertises a foreign owner', attribute('shell', 'data-projection-owner', 'foreign')],
  ['shell advertises an empty owner', attribute('shell', 'data-projection-owner', '')],
  [
    'shell copies its component owner',
    (mounted) =>
      attribute(
        'shell',
        'data-projection-owner',
        mounted.content.dataset.projectionOwner!
      )(mounted),
  ],
  ['missing shell class', attribute('shell', 'class', '')],
  ['wrong shell Prototype', attribute('shell', 'data-projection-prototype', 'brutalist-button')],
  ['missing shell Prototype', attribute('shell', 'data-projection-prototype', null)],
  ['wrong shell family', attribute('shell', 'data-projection-family', 'shadcn')],
  ['wrong shell runtime', attribute('shell', 'data-projection-runtime', 'vue')],
  ['missing independent generation', attribute('shell', 'data-projection-generation', null)],
  ['empty independent generation', attribute('shell', 'data-projection-generation', '')],
  ['non-generation shell value', attribute('shell', 'data-projection-generation', 'unknown')],
  ['zero shell generation', attribute('shell', 'data-projection-generation', '0')],
  ['hidden renderer host', attribute('rendererHost', 'hidden', '')],
  ['missing reserved mount ref', attribute('shellMount', 'data-demo-ref', null)],
  ['missing mount boundary', attribute('shellMount', 'data-passive-shell-mount', null)],
  ['foreign mount owner', attribute('shellMount', 'data-projection-owner', 'foreign')],
  ['old mount generation', attribute('shellMount', 'data-projection-generation', '0')],
  ['wrong mount family', attribute('shellMount', 'data-projection-family', 'shadcn')],
  ['wrong mount runtime', attribute('shellMount', 'data-projection-runtime', 'react')],
  ['missing retained-content ref', attribute('retained', 'data-demo-ref', null)],
  ['foreign retained-content owner', attribute('retained', 'data-projection-owner', 'foreign')],
  ['old retained-content generation', attribute('retained', 'data-projection-generation', '0')],
  ['wrong retained-content family', attribute('retained', 'data-projection-family', 'shadcn')],
  ['wrong retained-content runtime', attribute('retained', 'data-projection-runtime', 'react')],
  ['missing shell slot', attribute('slot', 'data-passive-shell-slot', null)],
  ['shell moved outside its reserved mount', ({ shell, content }) => moveNode(shell, content)],
  ['slot moved outside its shell', ({ slot, content }) => moveNode(slot, content)],
  [
    'retained content moved outside its slot',
    ({ retained, content }) => moveNode(retained, content),
  ],
  ...(['shell', 'shellMount', 'retained', 'slot'] as const).map(
    (target): Mutation => [
      `duplicate ${target} boundary`,
      (mounted) => {
        // A marker-only duplicate avoids invoking custom-element constructors.
        const duplicate = document.createElement('div');
        for (const { name, value } of mounted[target].attributes)
          duplicate.setAttribute(name, value);
        mounted[target].parentElement!.append(duplicate);
        return () => duplicate.remove();
      },
    ]
  ),
  ...(['content', 'slot', 'retained'] as const).map(
    (target): Mutation => [
      `additional valid-looking Surface under ${target}`,
      (mounted) => {
        const extra = document.createElement('div');
        extra.setAttribute('data-pui-root', '');
        extra.dataset.projectionPrototype = surfacePrototypeId('brutalist');
        extra.dataset.projectionOwner = mounted.content.dataset.projectionOwner;
        extra.dataset.projectionGeneration = mounted.content.dataset.projectionGeneration;
        extra.dataset.projectionFamily = 'brutalist';
        extra.dataset.projectionRuntime = 'wc';
        mounted[target].append(extra);
        return () => extra.remove();
      },
    ]
  ),
  [
    'otherwise valid authored root outside retained content',
    (mounted) => {
      const extra = document.createElement('div');
      for (const { name, value } of mounted.physical.attributes) {
        if (name.startsWith('data-projection-') || name === 'data-pui-root')
          extra.setAttribute(name, value);
      }
      mounted.slot.append(extra);
      return () => extra.remove();
    },
  ],
];

describe('one-field mutations of an actual committed production preview', () => {
  let mounted: Preview;
  beforeAll(async () => {
    mounted = await preview();
  });
  afterAll(async () => {
    await mounted?.destroy();
  });
  it.each([...mutations, ...shellMutations])(
    'rejects %s without relaxing another identity gate',
    async (_name, mutate) => {
      const { projectionObservation } = auditor();
      expect((await projectionObservation(mounted.page, item())).achieved).toBe(true);
      const restore = mutate(mounted);
      let observation: Promise<IdentityObservation>;
      try {
        observation = projectionObservation(mounted.page, item());
      } finally {
        // The real predicate snapshots DOM synchronously. Restore before queued
        // framework removal callbacks so a topology mutation cannot retire the fixture.
        restore();
      }
      expect((await observation!).achieved).toBe(false);
      expect((await projectionObservation(mounted.page, item())).achieved).toBe(true);
    }
  );
  it('retains the existing explicit-owner and scope-owner fallback', async () => {
    const { projectionObservation } = auditor();
    expect(mounted.scope.dataset.projectionOwner).toBeUndefined();
    expect((await projectionObservation(mounted.page, item())).achieved).toBe(true);
    const restore = attribute(
      'scope',
      'data-projection-owner',
      mounted.content.dataset.projectionOwner!
    )(mounted);
    try {
      expect((await projectionObservation(mounted.page, item())).achieved).toBe(true);
    } finally {
      restore();
    }
  });
});

function leaseComparator() {
  let expression: ts.Expression | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && node.name.getText(runnerAst) === 'sameProjectionLease')
      expression = node.initializer;
    ts.forEachChild(node, visit);
  };
  visit(runnerAst);
  if (!expression) throw new Error('Missing actual capture lease comparison');
  return new Function(
    'projectionBefore',
    'projectionAfter',
    `return (${expression.getText(runnerAst)});`
  ) as (before: IdentityObservation, after: IdentityObservation) => boolean;
}

it('accepts real runtime rebuilds with distinct outer/shell generations and rejects a shell epoch change during capture', async () => {
  const mounted = await preview();
  const { projectionObservation } = auditor();
  const sameLease = leaseComparator();
  try {
    let previous = await projectionObservation(mounted.page, item('wc'));
    expect(previous.achieved).toBe(true);
    for (const runtime of ['react', 'vue', 'vue2', 'wc'] as const) {
      await (
        mounted.root as HTMLElement & {
          __previewer__: { switchRuntime(runtime: Runtime): Promise<unknown> };
        }
      ).__previewer__.switchRuntime(runtime);
      await vi.waitFor(() => expect(mounted.root.dataset.projectionRuntime).toBe(runtime));
      const currentElements = elements(mounted.root);
      const current = await projectionObservation(currentElements.page, item(runtime));
      expect(current.achieved, JSON.stringify(current)).toBe(true);
      const downstream = await pipeline('button').anatomyObservation(
        pipelinePage(mounted.root),
        item(runtime),
        'rest'
      );
      expect(downstream.achieved, JSON.stringify(downstream)).toBe(true);
      expect(Number(current.generation)).toBeGreaterThan(Number(previous.generation));
      expect(current.shellGeneration).not.toBe(current.generation);
      expect(sameLease(previous, current)).toBe(false);
      expect(
        sameLease(current, await projectionObservation(currentElements.page, item(runtime)))
      ).toBe(true);
      previous = current;
    }
    const currentElements = elements(mounted.root);
    const before = await projectionObservation(currentElements.page, item());
    const restore = attribute(
      'shell',
      'data-projection-generation',
      String(Number(before.shellGeneration) + 1)
    )({ ...currentElements, destroy: mounted.destroy });
    let after: IdentityObservation;
    try {
      after = await projectionObservation(currentElements.page, item());
      expect(after.achieved).toBe(true);
      expect(sameLease(before, after)).toBe(false);
    } finally {
      restore();
    }
  } finally {
    await mounted.destroy();
  }
});

it('stores failed coordinates through the actual readiness call site, case catch and immutable journal', async () => {
  const mounted = await preview();
  const output = await mkdtemp(join(tmpdir(), 'contrast-identity-failure-'));
  const restore = attribute('root', 'data-projection-component', 'switch')(mounted);
  try {
    let caseTry!: ts.TryStatement;
    const visit = (node: ts.Node): void => {
      if (
        ts.isTryStatement(node) &&
        node.tryBlock.getText(runnerAst).includes("phase = 'runtime-theme-readiness'")
      )
        caseTry = node;
      ts.forEachChild(node, visit);
    };
    visit(runnerAst);
    expect(caseTry?.catchClause).toBeDefined();
    const readiness = caseTry.tryBlock.statements.filter(
      (statement) =>
        ts.isExpressionStatement(statement) &&
        ts.isAwaitExpression(statement.expression) &&
        ts.isCallExpression(statement.expression.expression) &&
        statement.expression.expression.expression.getText(runnerAst) ===
          'assertProjectionReadiness'
    );
    expect(readiness).toHaveLength(1);
    const beforeTheme = caseTry.tryBlock.getText(runnerAst);
    expect(beforeTheme.indexOf('assertProjectionReadiness')).toBeLessThan(
      beforeTheme.indexOf('await applyColorScheme')
    );
    const auditCase = item();
    const journal = await createContrastReportJournal(output);
    const report = {
      schemaVersion: 3,
      cases: [auditCase],
      frames: journal.frames,
      failedCases: [],
      summary: {},
    };
    const { assertProjectionReadiness } = auditor(true);
    const run = new Function(
      'page',
      'item',
      'assertProjectionReadiness',
      'journal',
      'report',
      'console',
      'KnownUnsupportedContrastDomain',
      'isKnownUnsupportedContrastCase',
      'isUnresolvedContrastCase',
      javascript(`
        const cases = report.cases;
        const frames = journal.frames;
        const failures = report.failedCases;
        const {family, runtime, theme} = item;
        const phase = 'runtime-theme-readiness';
        const message = (error) => error instanceof Error ? error.name + ': ' + error.message : String(error);
        ${declaration('persist')}
        return async function() {
          await persist('initial');
          try { ${readiness[0]!.getText(runnerAst)} }
          ${caseTry.catchClause!.getText(runnerAst)}
          await persist('final');
        };
      `)
    )(
      mounted.page,
      auditCase,
      assertProjectionReadiness,
      journal,
      report,
      { error: vi.fn() },
      KnownUnsupportedContrastDomain,
      isKnownUnsupportedContrastCase,
      isUnresolvedContrastCase
    );
    await run();
    expect(auditCase.status).toBe('failed');
    expect(auditCase.projectionReadinessFailure?.achieved).toBe(false);
    expect(auditCase.projectionReadinessFailure?.expected).toMatchObject({ family: 'button' });
    expect(auditCase.projectionReadinessFailure?.observed).toMatchObject({ componentId: 'switch' });
    expect(auditCase.errors).toEqual([
      expect.objectContaining({
        phase: 'runtime-theme-readiness',
        error: expect.stringContaining('Ready previewer'),
      }),
    ]);
    const final = JSON.parse(await readFile(join(output, 'report-final.json'), 'utf8'));
    const recovered = await readContrastReportJournal(output);
    for (const saved of [final, recovered]) {
      expect(saved.frames).toEqual([]);
      expect(saved.cases[0].status).toBe('failed');
      expect(saved.cases[0].achievedTargets).toEqual([]);
      expect(saved.cases[0].projectionReadinessFailure).toEqual(
        auditCase.projectionReadinessFailure
      );
      expect(saved.failedCases).toHaveLength(1);
      expect(saved.summary).toMatchObject({
        collectedFrames: 0,
        pngFactMatchedFrames: 0,
        achievedTargetPredicates: 0,
        unresolvedRuntimeThemeCases: 1,
        conformance: expect.stringContaining('not evaluated'),
      });
    }
  } finally {
    restore();
    await mounted.destroy();
    await rm(output, { recursive: true, force: true });
  }
});

// Replay the actual serialized audit probe and actual downstream Node functions.
// Only local module acquisition and geometry/style inputs are controlled. These
// tests establish identity/topology and measurement traversal, not native paint.
function installActualProbe() {
  const source = readFileSync(
    resolve(process.cwd(), 'apps/www/scripts/contrast-probe.browser.ts'),
    'utf8'
  );
  const compiled = transformSync(source, {
    loader: 'ts',
    format: 'iife',
    globalName: 'puiContrastProbe',
    keepNames: false,
  }).code;
  (globalThis as any).puiContrastProbe = new Function(compiled + ';return puiContrastProbe;')();
}
const productionDemos = import.meta.glob('../src/content/**/demo-brutalist-*.demo.ts', {
  eager: true,
  import: 'default',
});
function pipeline(family: string) {
  const recipe =
    productionDemos[
      '../src/content/' + authoredSources[family].recipePath.slice('apps/www/src/content/'.length)
    ];
  expect(recipe, family).toBeDefined();
  const names = [
    ...subjectFunctions,
    'fingerprint',
    'settle',
    'owned',
    'projectionObservation',
    'primary',
    'anatomyObservation',
    'passiveSurfaceObservation',
  ];
  if (
    runnerAst.statements.some(
      (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'projectionExpectation'
    )
  )
    names.unshift('projectionExpectation');
  const source = names
    .map(declaration)
    .join('\n')
    .replaceAll(
      'import.meta.url',
      JSON.stringify(
        pathToFileURL(resolve(process.cwd(), 'apps/www/scripts/audit-brutalist-contrast.mts')).href
      )
    );
  const input = ts.createSourceFile('functions.ts', source, ts.ScriptTarget.Latest, true);
  const transformed = ts.transform(input, [
    (context) => {
      const visit = (node: ts.Node): ts.Node => {
        if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          return ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
              ts.factory.createIdentifier('Promise'),
              'resolve'
            ),
            undefined,
            [
              ts.factory.createObjectLiteralExpression([
                ts.factory.createPropertyAssignment(
                  'default',
                  ts.factory.createIdentifier('__recipe')
                ),
              ]),
            ]
          );
        }
        return ts.visitEachChild(node, visit, context);
      };
      return (root) => ts.visitNode(root, visit) as ts.SourceFile;
    },
  ]);
  const replay = ts.createPrinter().printFile(transformed.transformed[0]);
  transformed.dispose();
  const namesAndValues = {
    authoredSources,
    PROJECTION_FAMILY_MANIFESTS,
    runtimeAvailability: Object.fromEntries(
      declarations.map((entry) => [entry.family, { serialized: JSON.stringify(entry.runtimes) }])
    ),
    surfacePrototypeId,
    passiveFamilies: new Set(['badge', 'card', 'skeleton', 'separator', 'spinner']),
    resolveProjectionRecipe,
    assertDemoSpec,
    collectPrototypeIds,
    compileContrastAnatomy,
    compareContrastAnatomy,
    anatomyPlans: new Map(),
    caseSubjects: new WeakMap<object, unknown>(),
    __recipe: recipe,
  };
  const raw = new Function(
    ...Object.keys(namesAndValues),
    transformSync(replay, { loader: 'ts', target: 'es2022', keepNames: true }).code +
      `;return {${names.join(',')}};`
  )(...Object.values(namesAndValues));
  return bindTestReaders(raw, namesAndValues.caseSubjects);
}
function pipelinePage(root: HTMLElement, beforeRead?: () => () => void) {
  const evaluate = (fn: Function, ...args: unknown[]) => {
    const restore = beforeRead?.();
    try {
      return new Function('args', `return (${fn.toString()})(...args);`)(args);
    } finally {
      restore?.();
    }
  };
  const locator = (select: () => Element[]): any => ({
    first: () => locator(() => select().slice(0, 1)),
    last: () => locator(() => select().slice(-1)),
    elementHandle: async () => {
      if (select().length !== 1) throw new Error('Ambiguous/missing test bridge locator.');
      return Object.assign(select()[0], { dispose: vi.fn() });
    },
    getAttribute: async (name: string) => select()[0]?.getAttribute(name) ?? null,
    locator: (selector: string) =>
      locator(() => select().flatMap((element) => [...element.querySelectorAll(selector)])),
    getByRole: (role: string, options: { name: string }) =>
      locator(() =>
        select()
          .flatMap((element) => [...element.querySelectorAll(`[role="${role}"]`)])
          .filter((node) => node.textContent?.trim() === options.name)
      ),
    evaluate: (fn: Function, expected?: unknown) => {
      if (select().length !== 1) throw new Error('Actual audit selector is missing or ambiguous.');
      return evaluate(fn, select()[0], expected);
    },
    evaluateAll: (fn: Function) => evaluate(fn, select()),
  });
  return {
    locator: (selector: string) =>
      locator(() =>
        selector === '[data-previewer-id]' ? [root] : [...document.querySelectorAll(selector)]
      ),
    evaluate: (fn: Function, expected?: unknown) => evaluate(fn, expected),
    waitForFunction: async (fn: Function, expected: unknown, options: { timeout: number }) => {
      expect([10_000, 20_000]).toContain(options.timeout);
      if (!evaluate(fn, expected)) throw new Error('Controlled observation is not ready.');
    },
  };
}

function controlledMeasurementInputs() {
  const bounds = {
    x: 20,
    y: 20,
    left: 20,
    top: 20,
    right: 120,
    bottom: 60,
    width: 100,
    height: 40,
    toJSON() {
      return this;
    },
  };
  const defaults: Record<string, string> = {
    visibility: 'visible',
    display: 'block',
    contentVisibility: 'visible',
    opacity: '1',
    clip: 'auto',
    clipPath: 'none',
    maskImage: 'none',
    filter: 'none',
    backdropFilter: 'none',
    mixBlendMode: 'normal',
    transform: 'none',
    translate: 'none',
    rotate: 'none',
    scale: 'none',
    contain: 'none',
    overflowX: 'visible',
    overflowY: 'visible',
    perspective: 'none',
    transformStyle: 'flat',
    backgroundColor: 'rgb(255, 255, 255)',
    backgroundImage: 'none',
    backgroundBlendMode: 'normal',
    backgroundClip: 'border-box',
    color: 'rgb(0, 0, 0)',
  };
  const rect = vi
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockImplementation(() => bounds as DOMRect);
  const rects = vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (
    this: Element
  ) {
    return (this.hasAttribute('hidden') || (this as HTMLElement).style.display === 'none'
      ? []
      : [bounds]) as unknown as DOMRectList;
  });
  const styles = vi.spyOn(globalThis, 'getComputedStyle').mockImplementation(
    (element) =>
      new Proxy({} as CSSStyleDeclaration, {
        get(_target, property) {
          if (property === 'getPropertyValue')
            return (key: string) => (element as HTMLElement).style.getPropertyValue(key) || '';
          // Model the real Adapter-installed visibility rule, not the expected
          // anatomy: retained detached owner shells have no painted layout.
          if (
            property === 'display' &&
            (element.hasAttribute('hidden') || element.hasAttribute('data-pui-view-detached'))
          )
            return 'none';
          if (property === 'visibility' && element.hasAttribute('data-pui-view-pending'))
            return 'hidden';
          return (
            (element as HTMLElement).style[property as any] || defaults[String(property)] || ''
          );
        },
      })
  );
  return () => {
    styles.mockRestore();
    rects.mockRestore();
    rect.mockRestore();
  };
}
for (const runtime of runtimes) {
  it(`${runtime}: actual Button pipeline admits authored anatomy after the identity gate`, async () => {
    const mounted = await preview(runtime, 'button');
    const restore = controlledMeasurementInputs();
    try {
      const readers = pipeline('button');
      const page = pipelinePage(mounted.root);
      expect((await readers.projectionObservation(page, item(runtime))).achieved).toBe(true);
      const anatomy = await readers.anatomyObservation(page, item(runtime), 'rest');
      expect(anatomy.achieved, JSON.stringify(anatomy)).toBe(true);
      expect(anatomy.observed.currentLease).toBe(true);
      expect(anatomy.observed.surfaces).toHaveLength(10);
      expect(anatomy.observed.surfaces.every((surface: any) => surface.parent === null)).toBe(true);
    } finally {
      restore();
      await mounted.destroy();
    }
  });
  it(`${runtime}: actual Badge pipeline admits passive instance ancestry after the identity gate`, async () => {
    const mounted = await preview(runtime, 'badge');
    const restore = controlledMeasurementInputs();
    try {
      const readers = pipeline('badge');
      const page = pipelinePage(mounted.root);
      expect((await readers.projectionObservation(page, item(runtime, 'badge'))).achieved).toBe(
        true
      );
      const passive = await readers.passiveSurfaceObservation(page, 'badge', runtime);
      expect(passive.achieved, JSON.stringify(passive)).toBe(true);
      expect(passive.ready).toBe(true);
      expect(passive.missingInstances).toEqual([]);
      expect(passive.unsupportedCoverage).toEqual([]);
      expect(passive.surfaces).toHaveLength(3);
      expect(
        passive.surfaces.every((surface: any) => surface.ancestorPrototypeIds.length === 0)
      ).toBe(true);
    } finally {
      restore();
      await mounted.destroy();
    }
  });
}

for (const declaration of declarations)
  for (const runtime of declaration.runtimes) {
    it(`${declaration.family}/${runtime}: actual downstream readers preserve all authored instances and parents`, async () => {
      const family = declaration.family;
      const mounted = await preview(runtime, family);
      const restore = controlledMeasurementInputs();
      try {
        const readers = pipeline(family);
        const page = pipelinePage(mounted.root);
        const identity = await readers.projectionObservation(page, item(runtime, family));
        expect(identity.achieved).toBe(true);
        if (['badge', 'card', 'skeleton', 'separator', 'spinner'].includes(family)) {
          const result = await readers.passiveSurfaceObservation(page, family, runtime);
          expect(result.ready, JSON.stringify(result)).toBe(true);
          for (const field of [
            'missing',
            'extra',
            'unexpectedIdentities',
            'missingInstances',
            'extraInstances',
          ])
            expect(result[field], `${family}/${runtime}: ${field}`).toEqual([]);
          expect(
            result.surfaces.every((surface: any) => surface.currentLease && surface.withinContent)
          ).toBe(true);
          expect(
            result.surfaces.some(
              (surface: any) => surface.ref === '__website_runtime_preview_surface__'
            )
          ).toBe(false);
          // Spinner motion/CSS, actual paint and visibility need native evidence.
          // This finite matrix establishes the real producer's complete identity
          // and authored topology, not a fake measured-pass for those conditions.
        } else {
          const result = await readers.anatomyObservation(page, item(runtime, family), 'rest');
          expect(result.achieved, JSON.stringify(result)).toBe(true);
          expect(result.observed.currentLease).toBe(true);
          expect(
            result.observed.surfaces.some(
              (surface: any) => surface.ref === '__website_runtime_preview_surface__'
            )
          ).toBe(false);
        }
      } finally {
        restore();
        await mounted.destroy();
      }
    });
  }

for (const family of ['button', 'badge']) {
  describe(`${family}: downstream consumers revalidate every identity field and boundary`, () => {
    let mounted: Preview;
    let restoreGeometry: () => void;
    let readers: ReturnType<typeof pipeline>;
    beforeAll(async () => {
      mounted = await preview('wc', family);
      readers = pipeline(family);
      restoreGeometry = controlledMeasurementInputs();
    });
    afterAll(async () => {
      restoreGeometry?.();
      await mounted?.destroy();
    });
    it.each([...mutations, ...shellMutations])(
      'rejects %s at the actual downstream gate',
      async (_name, mutate) => {
        const page = pipelinePage(mounted.root);
        const observe = (targetPage = page) =>
          family === 'button'
            ? readers.anatomyObservation(targetPage, item('wc', family), 'rest')
            : readers.passiveSurfaceObservation(targetPage, family, 'wc');
        expect((await observe()).achieved).toBe(true);
        // Mutate at the synchronous browser-evaluation boundary, after the Node
        // recipe import; restore before framework teardown microtasks run.
        const observed = await observe(pipelinePage(mounted.root, () => mutate(mounted)));
        expect(observed.achieved, JSON.stringify(observed)).toBe(false);
        expect(family === 'button' ? observed.observed.currentLease : observed.ready).toBe(false);
        expect((await observe()).achieved).toBe(true);
      }
    );
  });
}

it('keeps same-lease body roots visible to anatomy instead of hiding unexpected portals', async () => {
  const mounted = await preview();
  const restoreGeometry = controlledMeasurementInputs();
  try {
    const readers = pipeline('button');
    const page = pipelinePage(mounted.root, () => moveNode(mounted.physical, document.body));
    const result = await readers.anatomyObservation(page, item(), 'rest');
    expect(result.achieved).toBe(false);
    expect(result.observed.surfaces).toContainEqual(
      expect.objectContaining({
        prototypeId: 'brutalist-button',
        ref: 'solidMain',
        withinContent: false,
        currentLease: true,
      })
    );
    expect(
      result.failures.some(
        (failure: any) => failure.reason === 'Missing authored materialized instance.'
      )
    ).toBe(true);
  } finally {
    restoreGeometry();
    await mounted.destroy();
  }
});

for (const family of ['button', 'badge']) {
  it(`${family}: keeps an extra current-owner body root as failed downstream evidence`, async () => {
    const mounted = await preview('wc', family);
    const restoreGeometry = controlledMeasurementInputs();
    try {
      const readers = pipeline(family);
      const page = pipelinePage(mounted.root, () => {
        const extra = document.createElement('div');
        for (const { name, value } of mounted.physical.attributes) extra.setAttribute(name, value);
        document.body.append(extra);
        return () => extra.remove();
      });
      const result =
        family === 'button'
          ? await readers.anatomyObservation(page, item('wc', family), 'rest')
          : await readers.passiveSurfaceObservation(page, family, 'wc');
      expect(result.achieved).toBe(false);
      if (family === 'button')
        expect(result.extras).toContainEqual(
          expect.objectContaining({ currentLease: true, withinContent: false })
        );
      else
        expect(result.unsupportedCoverage).toContainEqual(
          expect.objectContaining({ reason: 'Physical root outside current content lease.' })
        );
    } finally {
      restoreGeometry();
      await mounted.destroy();
    }
  });
}

it('measures shell opacity/filter/clip even though shell is excluded from authored topology', async () => {
  const mounted = await preview('wc', 'badge');
  const restoreGeometry = controlledMeasurementInputs();
  try {
    const readers = pipeline('badge');
    const observe = () =>
      readers.passiveSurfaceObservation(pipelinePage(mounted.root), 'badge', 'wc');
    const probe = (globalThis as any).puiContrastProbe;
    expect((await observe()).achieved).toBe(true);
    for (const [property, value, limit] of [
      ['filter', 'blur(1px)', 'unsupported-filter-or-blend'],
      ['clipPath', 'circle(10%)', 'unsupported-clip-or-mask'],
    ]) {
      mounted.shell.style[property as any] = value;
      const result = await observe();
      expect(result.ready).toBe(true);
      expect(result.achieved).toBe(false);
      expect(
        result.surfaces.every((surface: any) => surface.visibilityLimits.includes(limit))
      ).toBe(true);
      expect(probe.readContrastPaintedVisibility(mounted.physical).classification).toBe(
        'unsupported'
      );
      mounted.shell.style[property as any] = '';
    }
    mounted.shell.style.opacity = '0';
    const hidden = await observe();
    expect(hidden.ready).toBe(true);
    expect(hidden.achieved).toBe(false);
    expect(hidden.notVisible).toHaveLength(3);
    expect(probe.readContrastPaintedVisibility(mounted.physical)).toMatchObject({
      visible: false,
      limits: ['ancestor-or-target-hidden'],
    });
    mounted.shell.style.opacity = '';
    expect((await observe()).achieved).toBe(true);
  } finally {
    mounted.shell.style.opacity = '';
    mounted.shell.style.filter = '';
    mounted.shell.style.clipPath = '';
    restoreGeometry();
    await mounted.destroy();
  }
});

it('retains the independent shell and its physical identity in full state fingerprints', async () => {
  vi.stubGlobal('visualViewport', null);
  const mounted = await preview();
  const restoreGeometry = controlledMeasurementInputs();
  try {
    const probe = (globalThis as any).puiContrastProbe;
    const before = probe.readContrastState();
    const snapshot = JSON.parse(before);
    expect(
      snapshot.surfaces.every(
        (surface: any) =>
          !surface.host.attributes.some(
            ([name, value]: string[]) =>
              name === 'data-demo-ref' && value === '__website_runtime_preview_surface__'
          )
      )
    ).toBe(true);
    expect(
      snapshot.surfaces.every((surface: any) =>
        surface.ancestry.some((ancestor: any) =>
          ancestor.attributes.some(
            ([name, value]: string[]) =>
              name === 'data-demo-ref' && value === '__website_runtime_preview_surface__'
          )
        )
      )
    ).toBe(true);
    mounted.shell.style.backgroundColor = 'rgb(1, 2, 3)';
    expect(probe.readContrastState()).not.toBe(before);
    mounted.shell.style.backgroundColor = '';
    expect(probe.readContrastState()).toBe(before);
  } finally {
    mounted.shell.style.backgroundColor = '';
    vi.unstubAllGlobals();
    restoreGeometry();
    await mounted.destroy();
  }
});

it('loads the serialized shared probe before the production readiness call and supplies strict anatomy expectations', () => {
  expect(runnerSource.indexOf('await page.addScriptTag({ content: browserProbe })')).toBeLessThan(
    runnerSource.indexOf('await assertProjectionReadiness(page, item)')
  );
  const anatomy = declaration('anatomyObservation');
  expect(anatomy).toContain('readSubjectContrastAnatomy(element, subject)');
  expect(anatomy).toContain('caseSubject(page)');
  expect(declaration('passiveSurfaceObservation')).toContain('subject: caseSubject(page)');
});

// Execute the real case-entry statements from selector wait through injection
// and readiness. Accessible native runtime selection is outside this no-browser
// test: the real producer has already been given the requested initial runtime.
function actualReadinessEntry() {
  const start = runnerSource.lastIndexOf('      let previewer = page.locator(');
  const end = runnerSource.indexOf('      await applyColorScheme(page, theme', start);
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  return new Function(
    'page',
    'runtime',
    'item',
    'audit',
    'choosePreviewRuntime',
    'browserProbe',
    'authoredSources',
    javascript(
      `return async function() { const {family} = item; const {assertProjectionReadiness,bindCaseSubject,casePreviewer} = audit; let phase; ${runnerSource.slice(start, end)} return phase; }`
    )
  );
}
function startupPage(root: HTMLElement, events: string[], beforeGuard?: () => () => void) {
  const observations: { scope: string | undefined; root: string | undefined }[] = [];
  const pending: (() => void)[] = [];
  const observer = new MutationObserver(() => {
    for (const poll of pending) poll();
  });
  observer.observe(root, { subtree: true, childList: true, attributes: true });
  const locator = (select: () => Element[]): any => ({
    select,
    elementHandle: async () =>
      select()[0] ? Object.assign(select()[0], { dispose: vi.fn() }) : null,
    first: () => locator(() => select().slice(0, 1)),
    and: (other: { select: () => Element[] }) =>
      locator(() => select().filter((element) => other.select().includes(element))),
    locator: (selector: string) =>
      locator(() => select().flatMap((element) => [...element.querySelectorAll(selector)])),
    waitFor: ({ state }: { state: string }) =>
      new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () =>
            reject(new Error('Controlled DOM wait did not reach the actual production selector.')),
          1500
        );
        const poll = () => {
          observations.push({
            scope:
              root.querySelector<HTMLElement>('[data-projection-scope]')?.dataset.projectionState,
            root: root.dataset.projectionState,
          });
          if (select().length) {
            clearTimeout(timeout);
            events.push(`wait:${state}`);
            const index = pending.indexOf(poll);
            if (index >= 0) pending.splice(index, 1);
            resolve();
          }
        };
        pending.push(poll);
        poll();
      }),
    evaluate: (fn: Function, expected: unknown) => {
      events.push('guard');
      expect(events).toContain('inject');
      const restore = beforeGuard?.();
      try {
        return new Function('element', 'expected', `return (${fn.toString()})(element, expected);`)(
          select()[0],
          expected
        );
      } finally {
        restore?.();
      }
    },
  });
  return {
    observations,
    dispose: () => observer.disconnect(),
    evaluate: (fn: Function, subject: unknown) => {
      events.push('guard');
      expect(events).toContain('inject');
      const restore = beforeGuard?.();
      try {
        return new Function('subject', `return (${fn.toString()})(subject);`)(subject);
      } finally {
        restore?.();
      }
    },
    locator: (selector: string) => locator(() => [...document.querySelectorAll(selector)]),
    addScriptTag: async ({ content }: { content: string }) => {
      expect(content).toBe('actual-probe');
      expect(root.dataset.projectionState).toBe('ready');
      expect(
        root.querySelector('[data-demo-ref="__website_runtime_preview_surface__"]')
      ).not.toBeNull();
      installActualProbe();
      events.push('inject');
    },
  };
}
for (const runtime of runtimes) {
  it(`${runtime}: actual case entry waits for published ready before probe injection and strict guard`, async () => {
    const events: string[] = [];
    let release!: () => void;
    startupBarrier.wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    let seen: ReturnType<typeof startupPage>['observations'] = [];
    const mounted = await preview(runtime, 'button', async (root) => {
      const page = startupPage(root, events);
      try {
        const run = actualReadinessEntry()(
          page,
          runtime,
          item(runtime),
          auditor(true),
          async () => {
            events.push('requested-runtime-already-selected');
          },
          'actual-probe',
          authoredSources
        );
        const pending = run();
        await vi.waitFor(() =>
          expect(
            root.querySelector<HTMLElement>('[data-projection-scope]')?.dataset.projectionState
          ).toBe('ready')
        );
        expect(root.dataset.projectionState).toBe('loading');
        expect(events).not.toContain('inject');
        expect(events).not.toContain('guard');
        release();
        startupBarrier.wait = null;
        expect(await pending).toBe('runtime-theme-readiness');
        seen = page.observations;
      } finally {
        release();
        startupBarrier.wait = null;
        page.dispose();
      }
    });
    try {
      expect(seen.some((state) => state.root !== 'ready')).toBe(true);
      expect(
        seen.some((state) => state.scope === 'ready' && state.root !== 'ready'),
        JSON.stringify(seen)
      ).toBe(true);
      expect(events).toEqual([
        'wait:visible',
        'requested-runtime-already-selected',
        'wait:attached',
        'inject',
        'guard',
      ]);
      expect(mounted.root.dataset.projectionState).toBe('ready');
      expect((await auditor().projectionObservation(mounted.page, item(runtime))).achieved).toBe(
        true
      );
    } finally {
      await mounted.destroy();
    }
  });
}
it('actual production entry fails a missing shell without entering generic calibration', async () => {
  const events: string[] = [];
  const auditCase = item();
  const mounted = await preview('wc', 'button', async (root) => {
    const page = startupPage(root, events, () =>
      attribute('shell', 'data-demo-ref', null)(elements(root) as Preview)
    );
    try {
      const run = actualReadinessEntry()(
        page,
        'wc',
        auditCase,
        auditor(true),
        async () => {},
        'actual-probe',
        authoredSources
      );
      await expect(run()).rejects.toThrow('Ready previewer');
      expect(auditCase.projectionReadinessFailure?.achieved).toBe(false);
      expect(auditCase.projectionReadinessFailure?.observed).toMatchObject({
        shell: { boundaryValid: false, count: 0 },
      });
    } finally {
      page.dispose();
    }
  });
  await mounted.destroy();
});

async function productionHeader() {
  history.replaceState({}, '', '/en/ui-libraries/brutalist/components/button/');
  const header = document.createElement('header');
  header.dataset.siteHeader = '';
  header.innerHTML =
    '<div data-site-header-panel><div data-site-header-surface-mount></div><div data-site-header-panel-content><nav><a href="/en/start-here/">Docs</a></nav><input aria-label="Setting draft" value="unchanged"></div></div>';
  document.body.prepend(header);
  const controller = initDocumentationHeaderSurface(header)!;
  await vi.waitFor(() =>
    expect(
      header.querySelector<HTMLElement>('[data-site-header-panel]')?.dataset.headerSurfaceGeneration
    ).toBeTruthy()
  );
  return {
    header,
    surface: header.querySelector<HTMLElement>('[data-pui-root]')!,
    destroy: async () => {
      await controller.destroy();
      header.remove();
    },
  };
}
for (const runtime of runtimes) {
  it(`${runtime}: an earlier real Header cannot own subject anatomy, fingerprint or settling`, async () => {
    localStorage.clear();
    vi.stubGlobal('visualViewport', null);
    const header = await productionHeader();
    const mounted = await preview(runtime, 'button');
    const restore = controlledMeasurementInputs();
    const animations = Object.getOwnPropertyDescriptor(Element.prototype, 'getAnimations');
    Object.defineProperty(Element.prototype, 'getAnimations', {
      configurable: true,
      value: () => [],
    });
    try {
      const readers = pipeline('button'),
        page = pipelinePage(mounted.root);
      const identity = await readers.projectionObservation(page, item(runtime));
      expect(identity.achieved).toBe(true);
      const anatomy = await readers.anatomyObservation(page, item(runtime), 'rest');
      expect(anatomy.achieved).toBe(true);
      expect(anatomy.owner).toBe(identity.owner);
      const before = await readers.fingerprint(page);
      expect(JSON.parse(before).owner).toBe(identity.owner);
      mounted.physical.style.color = 'rgb(12, 34, 56)';
      expect(await readers.fingerprint(page)).not.toBe(before);
      mounted.physical.style.color = '';
      header.surface.style.backgroundColor = 'rgb(90, 80, 70)';
      expect(await readers.fingerprint(page)).toBe(before);
      header.surface.setAttribute('data-transition-state', 'entering');
      await expect(readers.settle(page)).resolves.toBeUndefined();
      mounted.physical.setAttribute('data-transition-state', 'entering');
      await expect(readers.settle(page)).rejects.toThrow('not ready');
      mounted.physical.removeAttribute('data-transition-state');
      document.body.append(header.header);
      expect((await readers.anatomyObservation(page, item(runtime), 'rest')).owner).toBe(
        identity.owner
      );
      expect(await readers.fingerprint(page)).toBe(before);
      await readers.releaseCaseSubject(page);
      expect((mounted.root as any).dispose).toHaveBeenCalledOnce();
      await expect(readers.raw.fingerprint(page)).rejects.toThrow('has not been bound');
    } finally {
      mounted.physical.removeAttribute('data-transition-state');
      if (animations) Object.defineProperty(Element.prototype, 'getAnimations', animations);
      else delete (Element.prototype as any).getAnimations;
      restore();
      await mounted.destroy();
      await header.destroy();
      vi.unstubAllGlobals();
    }
  });
}
it('a frozen subject survives sibling order/rebuild and owns its body roots, then fails on replacement', async () => {
  vi.stubGlobal('visualViewport', null);
  const header = await productionHeader();
  const first = await preview('wc', 'button');
  const subject = await preview('wc', 'button');
  const restore = controlledMeasurementInputs();
  try {
    const readers = pipeline('button'),
      page = pipelinePage(subject.root);
    await readers.bindCaseSubject(
      page,
      page.locator(`[data-previewer-id="${subject.root.dataset.previewerId}"]`),
      item()
    );
    const owner = (await readers.raw.projectionObservation(page, item())).owner;
    expect(owner).toBe(subject.scope.dataset.projectionScope);
    document.body.prepend(first.root);
    await (first.root as any).__previewer__.switchRuntime('react');
    expect(JSON.parse(await readers.fingerprint(page)).owner).toBe(owner);
    const undo = moveNode(subject.physical, document.body);
    try {
      const owned = await readers.owned(page, 'brutalist-button');
      const nodes = await owned.evaluateAll((elements: Element[]) => elements);
      expect(nodes).toContain(subject.physical);
      expect(nodes.some((node: Element) => first.root.contains(node))).toBe(false);
      expect(nodes).toHaveLength(10);
    } finally {
      undo();
    }
    const duplicate = document.createElement('section');
    duplicate.dataset.previewerId = subject.root.dataset.previewerId;
    document.body.prepend(duplicate);
    try {
      await expect(readers.fingerprint(page)).rejects.toThrow('subject lease is invalid');
    } finally {
      duplicate.remove();
    }
    const replacement = document.createElement('section');
    replacement.dataset.previewerId = subject.root.dataset.previewerId;
    subject.root.replaceWith(replacement);
    let rejected: Promise<unknown>;
    try {
      rejected = readers.fingerprint(page);
    } finally {
      replacement.replaceWith(subject.root);
    }
    await expect(rejected!).rejects.toThrow('subject lease is invalid');
    expect(JSON.parse(await readers.fingerprint(page)).owner).toBe(owner);
  } finally {
    restore();
    await subject.destroy();
    await first.destroy();
    await header.destroy();
    vi.unstubAllGlobals();
  }
});
it('production measurement entries require an explicit subject and never use calibration fallback', async () => {
  const mounted = await preview();
  try {
    const probe = (globalThis as any).puiContrastProbe;
    expect(() => probe.readSubjectContrastState()).toThrow('Explicit audit');
    expect(() => probe.readSubjectContrastAnatomy(mounted.physical)).toThrow('Explicit audit');
    expect(() => probe.collectSubjectContrastFrame({ image: '', family: 'button' })).toThrow(
      'Explicit audit'
    );
    const readers = pipeline('button'),
      page = pipelinePage(mounted.root);
    await expect(readers.raw.projectionObservation(page, item())).rejects.toThrow(
      'has not been bound'
    );
    await readers.bindCaseSubject(page, page.locator('[data-previewer-id]').first(), item());
    await expect(
      readers.bindCaseSubject(page, page.locator('[data-previewer-id]').first(), item())
    ).rejects.toThrow('already has');
    const subject = readers.caseSubject(page);
    expect(() => probe.readSubjectContrastState({ ...subject, expected: undefined })).toThrow(
      'Explicit audit'
    );
    expect(() => probe.readSubjectContrastState({ ...subject, previewer: document.body })).toThrow(
      'subject lease is invalid'
    );
  } finally {
    await mounted.destroy();
  }
});

function measurementComparator() {
  return new Function(
    javascript(declaration('measurementLeaseMatches')) + ';return measurementLeaseMatches;'
  )() as (projection: unknown, observations: unknown[]) => boolean;
}
it('rejects the real 1aadd Header-owned facts even when all fingerprint digests matched', () => {
  // Official run37398687310/binary first Button journal and facts. No synthetic
  // paint is substituted for this archived wrong-subject measurement.
  const projection = { owner: 'pp-s2ix5ion289', generation: '1' };
  const headerFacts = { owner: 'site-header-surface-1', generation: '1' };
  const matches = measurementComparator();
  expect(matches(projection, [headerFacts, headerFacts, headerFacts])).toBe(false);
  expect(matches(projection, [projection, projection, null])).toBe(true);
  for (const bad of [
    undefined,
    {},
    { owner: projection.owner, generation: '2' },
    { owner: 'other', generation: '1' },
  ])
    expect(matches(projection, [projection, bad])).toBe(false);
  expect(matches({}, [{}, null])).toBe(false);
});
it('capture cross-binds anatomy, facts and all three raw fingerprint leases to the selected projection', () => {
  const capture = declaration('capture');
  for (const expression of [
    'measurementLeaseMatches(projectionBefore',
    'facts,',
    'anatomyBefore,',
    'anatomyAfter,',
    'JSON.parse(before)',
    'JSON.parse(facts.stateFingerprint)',
    'JSON.parse(after)',
    '!sameMeasurementLease',
  ])
    expect(capture).toContain(expression);
});

// Controlled white raster only tests actual fact-collector routing and complete
// producer surfaces. It is not a native PNG, CSS or contrast acceptance result.
for (const runtime of runtimes) {
  it(`${runtime}: actual facts collector samples the selected previewer with a real Header before it`, async () => {
    vi.stubGlobal('visualViewport', null);
    const header = await productionHeader();
    const mounted = await preview(runtime, 'button');
    const restoreGeometry = controlledMeasurementInputs();
    vi.stubGlobal(
      'Image',
      class {
        src = '';
        naturalWidth = 100;
        naturalHeight = 100;
        async decode() {}
      }
    );
    const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () =>
        ({
          drawImage() {},
          getImageData() {
            return { data: new Uint8ClampedArray([255, 255, 255, 255]) };
          },
        }) as any
    );
    try {
      const readers = pipeline('button'),
        page = pipelinePage(mounted.root);
      const expected = await readers.projectionObservation(page, item(runtime));
      const facts = await (globalThis as any).puiContrastProbe.collectSubjectContrastFrame({
        image: 'controlled-white-raster',
        family: 'button',
        subject: readers.caseSubject(page),
      });
      expect(facts.owner).toBe(expected.owner);
      expect(facts.generation).toBe(expected.generation);
      expect(JSON.parse(facts.stateFingerprint).owner).toBe(expected.owner);
      expect(facts.surfaces).toHaveLength(10);
      expect(facts.surfaces.every((surface: any) => surface.prototype === 'brutalist-button')).toBe(
        true
      );
      expect(facts.surfaces.some((surface: any) => surface.ref === 'header-surface')).toBe(false);
      expect(measurementComparator()(expected, [facts, JSON.parse(facts.stateFingerprint)])).toBe(
        true
      );
    } finally {
      context.mockRestore();
      restoreGeometry();
      await mounted.destroy();
      await header.destroy();
      vi.unstubAllGlobals();
    }
  });
}

it('all production ownership consumers use the frozen case subject; global Focus diagnostics are labeled', () => {
  for (const name of [
    'settle',
    'fingerprint',
    'projectionObservation',
    'anatomyObservation',
    'passiveSurfaceObservation',
    'owned',
    'tooltipPortal',
  ]) {
    const source = declaration(name);
    expect(source, name).not.toMatch(/document\.querySelector[^\n]*data-projection-scope/);
    expect(source, name).not.toContain("locator('[data-previewer-id]').first()");
    expect(source, name).toMatch(/caseSubject\(page\)|casePreviewer\(page\)/);
  }
  expect(declaration('capture')).toContain('collectSubjectContrastFrame(input)');
  expect(declaration('fingerprint')).toContain('readSubjectContrastState(subject)');
  expect(declaration('failedKeyboardDiagnostics')).toContain('requestedSubject:');
  expect(declaration('failedKeyboardDiagnostics')).toContain('Global Focus center diagnostics');
  expect(runnerSource).toContain('finally {\n            await context.close();');
  expect(runnerSource).toContain('await releaseCaseSubject(casePage)');
});

// Actual CLI transition statements, with controlled observations to isolate
// orchestration. The separate Escape suite supplies real producer/Adapter facts.
function escapeRunnerBlock(source = runnerSource) {
  const start = source.indexOf(
    "      // Dismiss open menus before testing the trigger's native keyboard route."
  );
  const end = source.indexOf("      if (family === 'hover-card')", start);
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  return new Function(
    'page',
    'item',
    'target',
    'auditedPopupEscape',
    'owned',
    javascript(
      `return async function() { const {family}=item; let phase; ${source.slice(start, end)} return phase; };`
    )
  );
}
for (const family of ['tooltip', 'dropdown-menu', 'select', 'dialog']) {
  for (const closes of [true, false]) {
    it(`${family}: actual runner ${closes ? 'continues only after verified Escape' : 'does not let pointer/focus reset mask swallowed Escape'}`, async () => {
      const calls: string[] = [];
      const page = {
        keyboard: {
          press: async (key: string) => {
            calls.push(key);
          },
        },
        mouse: {
          move: async () => {
            calls.push('pointer-reset');
          },
        },
      };
      const target = {
        focus: async () => {
          calls.push('focus-reset');
        },
      };
      const auditCase = item('wc', family) as AuditCase & {
        escapeTransition?: Record<string, unknown>;
      };
      const audited = async (_page: unknown, actualCase: typeof auditCase, _target: unknown) => {
        expect(actualCase).toBe(auditCase);
        const record = (actualCase.escapeTransition = {});
        await establishContrastPopupEscapeBaseline({
          family,
          record,
          readBefore: async () => ({ achieved: true, family }),
          pressEscape: () => page.keyboard.press('Escape'),
          waitForClosed: async () => {
            calls.push('closed-check');
            if (!closes) throw new Error('Exact popup stayed open.');
          },
          waitForFocus: async () => {
            calls.push('focus-check');
          },
          readAfter: async () => ({
            sameOwnedPopup: true,
            closed: true,
            focusPreserved: true,
            descriptionRemoved: true,
            triggerFocused: true,
            ariaExpanded: 'false',
            selectionUnchanged: true,
          }),
        });
      };
      const run = escapeRunnerBlock()(page, auditCase, target, audited, () => {
        throw new Error('Wrong family branch');
      });
      if (closes) {
        await run();
        expect(auditCase.escapeTransition?.achieved).toBe(true);
        expect(calls).toEqual([
          'Escape',
          'closed-check',
          ...(family === 'tooltip' ? [] : ['focus-check']),
          'pointer-reset',
          'focus-reset',
          'Tab',
        ]);
      } else {
        await expect(run()).rejects.toThrow('Exact popup stayed open');
        expect(calls).toEqual(['Escape', 'closed-check']);
        expect(auditCase.escapeTransition?.achieved).toBe(false);
      }
    });
  }
}
it('Escape integration retains exact handles, current subject leases, helper provenance and bounded Tooltip claims', () => {
  const source = declaration('auditedPopupEscape');
  for (const required of [
    'caseSubject(page)',
    'tooltipPortal(page, target)',
    'controlledId',
    'evaluateHandle(readContrastPopupEscapeBefore',
    "waitForElementState('hidden')",
    'readContrastPopupEscapeAfter',
    'afterLease.owner !== beforeLease.owner',
    'afterLease.generation !== beforeLease.generation',
    'await baseline?.dispose()',
    'await popup?.dispose()',
    'await trigger.dispose()',
  ])
    expect(source).toContain(required);
  expect(source).not.toMatch(/\.focus\(|\.click\(|mouse\.move/);
  expect(runnerSource).toContain(
    "['popup-escape', new URL('./contrast-popup-escape.mjs', import.meta.url)]"
  );
  expect(runnerSource).toContain('not a sibling warm-window timing or Group handoff journey');
});

for (const outcome of ['restored', 'focus-refused', 'changed-lease'] as const) {
  it(`Dialog exact caller and acquisition: ${outcome} ${outcome === 'restored' ? 'allows' : 'blocks'} the later manual reset`, async () => {
    // Execute both the real CLI branch and real auditedPopupEscape function.
    // Only observations/transport are controlled here; the separate suite
    // drives the actual authored Dialog through all four installed Adapters.
    const calls: string[] = [];
    const subject = {};
    const trigger = {
      dispose: async () => {
        calls.push('dispose-trigger');
      },
    };
    const popup = {
      waitForElementState: async (state: string) => {
        expect(state).toBe('hidden');
        calls.push('hidden');
      },
      dispose: async () => {
        calls.push('dispose-popup');
      },
    };
    const before = { observation: { achieved: true, family: 'dialog' }, trigger };
    const baseline = {
      evaluate: async (fn: (value: typeof before) => unknown) => fn(before),
      dispose: async () => {
        calls.push('dispose-baseline');
      },
    };
    const after = {
      sameOwnedPopup: true,
      closed: true,
      triggerFocused: true,
      ariaExpanded: 'false',
    };
    const controlled = {};
    let leases = 0;
    const page = {
      keyboard: {
        press: async (key: string) => {
          calls.push(key);
        },
      },
      mouse: {
        move: async () => {
          calls.push('pointer-reset');
        },
      },
      locator: (selector: string) => {
        expect(selector).toBe('[id="dialog-owned"]');
        return controlled;
      },
      evaluate: async (fn: Function, value: unknown) => {
        if (fn === readContrastPopupEscapeAfter) {
          expect(value).toBe(baseline);
          calls.push('after');
          return after;
        }
        expect(value).toBe(subject);
        expect(fn.toString()).toContain('readContrastAuditSubject');
        calls.push('lease');
        return {
          achieved: true,
          owner: 'current',
          generation: ++leases === 2 && outcome === 'changed-lease' ? '2' : '1',
        };
      },
      evaluateHandle: async (fn: unknown, input: Record<string, unknown>) => {
        expect(fn).toBe(readContrastPopupEscapeBefore);
        expect(input).toEqual({
          family: 'dialog',
          trigger,
          popup,
          owner: 'current',
          generation: '1',
        });
        calls.push('snapshot');
        return baseline;
      },
      waitForFunction: async (fn: Function, value: unknown) => {
        expect(value).toBe(baseline);
        expect(fn.toString()).toContain('document.activeElement === value.trigger');
        calls.push('focus-check');
        if (outcome === 'focus-refused') throw new Error('Dialog Trigger focus missing.');
      },
    };
    const target = {
      elementHandle: async () => trigger,
      getAttribute: async (name: string) => {
        expect(name).toBe('aria-controls');
        return 'dialog-owned';
      },
      focus: async () => {
        calls.push('focus-reset');
      },
    };
    const popupLocator = { count: async () => 1, elementHandle: async () => popup };
    const owned = async (_page: unknown, prototype: string) => {
      expect(_page).toBe(page);
      expect(prototype).toBe('brutalist-dialog-content');
      return {
        and: (identity: unknown) => {
          expect(identity).toBe(controlled);
          return popupLocator;
        },
      };
    };
    const audited = new Function(
      'caseSubject',
      'tooltipPortal',
      'owned',
      'readContrastPopupEscapeBefore',
      'readContrastPopupEscapeAfter',
      'establishContrastPopupEscapeBaseline',
      javascript(`${declaration('auditedPopupEscape')};return auditedPopupEscape;`)
    )(
      () => subject,
      () => {
        throw new Error('Wrong Tooltip path');
      },
      owned,
      readContrastPopupEscapeBefore,
      readContrastPopupEscapeAfter,
      establishContrastPopupEscapeBaseline
    );
    const auditCase = item('wc', 'dialog') as AuditCase & {
      escapeTransition?: Record<string, unknown>;
    };
    const run = escapeRunnerBlock()(page, auditCase, target, audited, () => {
      throw new Error('Dialog bypassed the Escape barrier');
    });
    if (outcome === 'restored') {
      await run();
      expect(auditCase.escapeTransition?.achieved).toBe(true);
      expect(auditCase.escapeTransition?.criterion).toContain('P-BASE-DIALOG-CONTENT-FOCUS');
      expect(calls.slice(-3)).toEqual(['pointer-reset', 'focus-reset', 'Tab']);
    } else {
      await expect(run()).rejects.toThrow(
        outcome === 'focus-refused'
          ? 'Dialog Trigger focus missing'
          : 'subject changed during Escape'
      );
      expect(auditCase.escapeTransition?.achieved).toBe(false);
      expect(calls).not.toContain('pointer-reset');
      expect(calls).not.toContain('focus-reset');
      expect(calls).not.toContain('Tab');
    }
    expect(calls.indexOf('hidden')).toBeLessThan(calls.indexOf('focus-check'));
    expect(calls.filter((call) => call.startsWith('dispose-'))).toEqual([
      'dispose-baseline',
      'dispose-popup',
      'dispose-trigger',
    ]);
  });
}

for (const outcome of ['retained', 'dismissed', 'changed-lease'] as const) {
  it(`Hover Card actual Escape caller ${outcome} is checked before reset`, async () => {
    const calls: string[] = [];
    const subject = {};
    const trigger = { dispose: async () => {} };
    const popup = {
      dispose: async () => {},
      waitForElementState: async () => {
        throw new Error('Hover Card must not wait for dismissal');
      },
    };
    const observation = { achieved: true, family: 'hover-card' };
    const baseline = {
      evaluate: async (fn: Function) => fn({ observation }),
      dispose: async () => {},
    };
    let leases = 0;
    const page = {
      keyboard: {
        press: async (key: string) => {
          calls.push(key);
        },
      },
      mouse: {
        move: async () => {
          calls.push('pointer-reset');
        },
      },
      evaluate: async (fn: Function, value: unknown) => {
        if (fn === readContrastPopupEscapeAfter) {
          calls.push('retention-check');
          return {
            sameOwnedPopup: true,
            closed: outcome === 'dismissed',
            visibility: {
              visible: outcome !== 'dismissed',
              classification: 'source-model-visible',
            },
            focusPreserved: true,
          };
        }
        expect(value).toBe(subject);
        return {
          achieved: true,
          owner: 'current',
          generation: ++leases === 2 && outcome === 'changed-lease' ? '2' : '1',
        };
      },
      evaluateHandle: async (fn: Function, input: Record<string, unknown>) => {
        expect(fn).toBe(readContrastPopupEscapeBefore);
        expect(input).toEqual({
          family: 'hover-card',
          trigger,
          popup,
          owner: 'current',
          generation: '1',
        });
        return baseline;
      },
    };
    const target = {
      elementHandle: async () => trigger,
      getAttribute: async () => null,
      focus: async () => {
        calls.push('focus-reset');
      },
    };
    const owned = async (_page: unknown, prototype: string) => {
      expect(prototype).toBe('brutalist-hover-card-content');
      return { count: async () => 1, elementHandle: async () => popup };
    };
    const audited = new Function(
      'caseSubject',
      'tooltipPortal',
      'owned',
      'readContrastPopupEscapeBefore',
      'readContrastPopupEscapeAfter',
      'establishContrastPopupEscapeBaseline',
      'settle',
      javascript(`${declaration('auditedPopupEscape')};return auditedPopupEscape;`)
    )(
      () => subject,
      () => {
        throw new Error('Wrong Tooltip path');
      },
      owned,
      readContrastPopupEscapeBefore,
      readContrastPopupEscapeAfter,
      establishContrastPopupEscapeBaseline,
      async () => {
        calls.push('settle-input-effects');
      }
    );
    const auditCase = item('wc', 'hover-card') as AuditCase & {
      escapeTransition?: Record<string, unknown>;
    };
    const run = escapeRunnerBlock()(page, auditCase, target, audited, owned);
    if (outcome === 'retained') {
      await run();
      expect(auditCase.escapeTransition?.achieved).toBe(true);
      expect(auditCase.escapeTransition?.criterion).toContain('P-BASE-HOVER-CARD-CONTENT-OVERLAY');
      expect(calls).toEqual([
        'Escape',
        'settle-input-effects',
        'retention-check',
        'pointer-reset',
        'focus-reset',
        'Tab',
      ]);
    } else {
      await expect(run()).rejects.toThrow(
        outcome === 'dismissed'
          ? 'Escape changed the exact painted owned popup or focus'
          : 'subject changed during Escape'
      );
      expect(auditCase.escapeTransition?.achieved).toBe(false);
      expect(calls).not.toContain('pointer-reset');
      expect(calls).not.toContain('focus-reset');
    }
  });
}

for (const runtime of runtimes) {
  it(`field/${runtime}: error anatomy follows actual public validation and reset`, async () => {
    const mounted = await preview(runtime, 'field');
    const restore = controlledMeasurementInputs();
    try {
      const readers = pipeline('field');
      const page = pipelinePage(mounted.root);
      const observe = () => readers.anatomyObservation(page, item(runtime, 'field'), 'validation');
      const requiredError = (result: any) =>
        result.expectations.find((entry: any) => entry.path === 'root.children.0.children.3');
      expect(requiredError(await observe()).required).toBe(false);
      mounted.root.querySelector<HTMLElement>('[data-demo-ref="validate"]')!.click();
      await vi.waitFor(
        async () => {
          const result = await observe();
          expect(requiredError(result).required).toBe(true);
          expect(result.achieved, JSON.stringify(result.failures)).toBe(true);
        },
        { timeout: 5000 }
      );
      mounted.root.querySelector<HTMLElement>('[data-demo-ref="reset"]')!.click();
      await vi.waitFor(
        async () => {
          const result = await observe();
          expect(requiredError(result).required).toBe(false);
          expect(result.achieved, JSON.stringify(result.failures)).toBe(true);
        },
        { timeout: 5000 }
      );
    } finally {
      restore();
      await mounted.destroy();
    }
  });
}

it('WC Field validity cannot borrow an ambiguous or foreign native editor witness', async () => {
  const mounted = await preview('wc', 'field');
  const restore = controlledMeasurementInputs();
  const host = mounted.root.querySelector<HTMLElement>('[data-demo-ref="requiredControl"]')!;
  const ownerRoot = host.shadowRoot ?? host;
  const editor = [...ownerRoot.children].find(
    (node) => node instanceof HTMLInputElement && node.getAttribute('part') === 'control'
  )!;
  const duplicate = document.createElement('input');
  duplicate.setAttribute('part', 'control');
  duplicate.setAttribute('aria-invalid', 'false');
  const readers = pipeline('field'),
    page = pipelinePage(mounted.root);
  const observe = () => readers.anatomyObservation(page, item('wc', 'field'), 'rest');
  try {
    expect((await observe()).achieved).toBe(true);
    ownerRoot.append(duplicate);
    await expect(observe()).rejects.toThrow('Actual audit selector is missing or ambiguous');
    duplicate.remove();
    editor.setAttribute('data-projection-owner', 'foreign-owner');
    expect((await observe()).achieved).toBe(false);
    editor.removeAttribute('data-projection-owner');
    expect((await observe()).achieved).toBe(true);
  } finally {
    duplicate.remove();
    editor.removeAttribute('data-projection-owner');
    restore();
    await mounted.destroy();
  }
});

for (const runtime of runtimes) {
  it(`field/${runtime}: audit primary is the unique actual editor and observes its real focus`, async () => {
    const mounted = await preview(runtime, 'field');
    const restore = controlledMeasurementInputs();
    try {
      const readers = pipeline('field'),
        page = pipelinePage(mounted.root);
      const target = readers.primary(page.locator('[data-previewer-id]'), 'field');
      const result = await target.evaluate((element: HTMLElement) => {
        element.focus();
        return {
          tag: element.tagName,
          observation: (globalThis as any).puiContrastProbe.readContrastTargetObservation(element),
        };
      });
      expect(result.tag).toBe('INPUT');
      expect(result.observation.focused).toBe(true);
      const anatomy = await readers.anatomyObservation(
        page,
        item(runtime, 'field'),
        'keyboard-focus'
      );
      expect(anatomy.achieved, JSON.stringify(anatomy.failures)).toBe(true);
      expect(anatomy.observed.primary).not.toBeNull();
      expect(
        anatomy.observed.surfaces.find((part: any) => part.uid === anatomy.observed.primary)?.ref
      ).toBe('requiredControl');
    } finally {
      restore();
      await mounted.destroy();
    }
  });
}
