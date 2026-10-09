import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import {
  collectWebsiteProductionBundleIssues,
  validateWebsiteProductionBundle,
} from '../check-website-production-bundle.mjs';

const HOME_DEMO_FACADE =
  'apps/www/src/components/PrototypePreviewer/HomeDemoPreviewer.astro?astro&type=script&index=0&lang.ts';
const PREVIEWER_FACADE =
  'apps/www/src/components/PrototypePreviewer/PrototypePreviewer.astro?astro&type=script&index=0&lang.ts';
const PREVIEWER_CLIENT_FACADE = 'apps/www/src/components/PrototypePreviewer/previewer-client.ts';
const STYLE_ISOLATION_FACADE =
  'apps/www/src/pages/en/test/style-isolation.astro?astro&type=script&index=0&lang.ts';

function chunk(
  fileName,
  {
    name = fileName,
    isEntry = false,
    isDynamicEntry = false,
    facadeModuleId = null,
    imports = [],
    dynamicImports = [],
    moduleIds = [],
  } = {}
) {
  return {
    fileName,
    name,
    isEntry,
    isDynamicEntry,
    facadeModuleId,
    imports,
    dynamicImports,
    moduleIds,
  };
}

test('pointer contact is an actual router-owned leaf with no optical dependency', async () => {
  const { readFileSync } = await import('node:fs');
  const router = readFileSync(
    new URL('../../../packages/adapters/base/src/events/web-event-router.ts', import.meta.url),
    'utf8'
  );
  const contact = readFileSync(
    new URL('../../../packages/adapters/base/src/events/pointer-contact.ts', import.meta.url),
    'utf8'
  );
  assert.match(
    router,
    /import \{ createWebPointerContactWriter, type WebPointerContact \} from '\.\/pointer-contact'/
  );
  assert.doesNotMatch(contact, /^\s*import\b|\bimport\s*\(|\bfrom\s*['"]/m);
});

function graphFixture() {
  return {
    version: 1,
    chunks: [
      chunk('_astro/search.js', {
        isEntry: true,
        facadeModuleId:
          'apps/www/src/components/override/Search.astro?astro&type=script&index=0&lang.ts',
        imports: ['_astro/site-shadcn-controls.js'],
        moduleIds: ['apps/www/src/components/override/Search.astro'],
      }),
      chunk('_astro/site-shadcn-controls.js', {
        moduleIds: ['apps/www/src/components/site-shadcn-controls.ts'],
      }),
      chunk('_astro/home-demo.js', {
        isEntry: true,
        facadeModuleId: HOME_DEMO_FACADE,
        imports: ['_astro/wc-host.js'],
        dynamicImports: ['_astro/react.js', '_astro/vue.js', '_astro/vue2.js'],
        moduleIds: ['apps/www/src/components/PrototypePreviewer/home-demo-client.ts'],
      }),
      chunk('_astro/previewer.js', {
        isEntry: true,
        facadeModuleId: PREVIEWER_FACADE,
        dynamicImports: [
          '_astro/previewer-client.js',
          '_astro/react.js',
          '_astro/vue.js',
          '_astro/vue2.js',
        ],
        moduleIds: ['apps/www/src/components/PrototypePreviewer/PrototypePreviewer.astro'],
      }),
      chunk('_astro/previewer-client.js', {
        isDynamicEntry: true,
        facadeModuleId: PREVIEWER_CLIENT_FACADE,
        moduleIds: ['apps/www/src/components/PrototypePreviewer/previewer-client.ts'],
      }),
      chunk('_astro/style-isolation.js', {
        isEntry: true,
        facadeModuleId: STYLE_ISOLATION_FACADE,
        dynamicImports: ['_astro/react.js', '_astro/vue.js', '_astro/vue2.js'],
        moduleIds: ['apps/www/src/pages/en/test/style-isolation.astro'],
      }),
      chunk('_astro/new-projection-families.js', {
        isEntry: true,
        facadeModuleId:
          'apps/www/src/pages/en/test/new-projection-families.astro?astro&type=script&index=0&lang.ts',
        imports: ['_astro/wc-host.js'],
        dynamicImports: ['_astro/react.js', '_astro/vue.js', '_astro/vue2.js'],
        moduleIds: ['apps/www/src/pages/en/test/new-projection-families.astro'],
      }),
      chunk('_astro/bootstrap-state-controls.js', {
        isEntry: true,
        facadeModuleId:
          'apps/www/src/pages/en/test/bootstrap-state-controls.astro?astro&type=script&index=0&lang.ts',
        imports: ['_astro/wc-host.js'],
        dynamicImports: ['_astro/react.js', '_astro/vue.js', '_astro/vue2.js'],
        moduleIds: ['apps/www/src/pages/en/test/bootstrap-state-controls.astro'],
      }),
      chunk('_astro/liquid-library-card.js', {
        isEntry: true,
        facadeModuleId:
          'apps/www/src/pages/[locale]/test/liquid-library-card.astro?astro&type=script&index=0&lang.ts',
        imports: ['_astro/wc-host.js'],
        moduleIds: [
          'apps/www/src/components/library-liquid-card-client.ts',
          'apps/www/src/components/library-liquid-scene.ts',
        ],
      }),
      chunk('_astro/liquid-glass-material.js', {
        isEntry: true,
        facadeModuleId:
          'apps/www/src/pages/en/test/liquid-glass-material.astro?astro&type=script&index=0&lang.ts',
        imports: ['_astro/wc-host.js'],
        dynamicImports: ['_astro/react.js', '_astro/vue.js', '_astro/vue2.js'],
        moduleIds: ['apps/www/src/pages/en/test/liquid-glass-material.astro'],
      }),
      chunk('_astro/wc-host.js', {
        name: 'wc-host',
        moduleIds: [
          'apps/www/src/components/PrototypePreviewer/wc-registry.ts?used',
          'packages/adapters/web-component/src/adapt.ts?used',
        ],
      }),
      chunk('_astro/react.js', {
        name: 'react-runtime',
        isDynamicEntry: true,
        moduleIds: [
          'apps/www/src/components/PrototypePreviewer/runtimes/react-runtime.ts',
          'packages/adapters/react/src/index.ts',
          'node_modules/react/index.js',
        ],
      }),
      chunk('_astro/vue.js', {
        name: 'vue-runtime',
        isDynamicEntry: true,
        moduleIds: [
          'apps/www/src/components/PrototypePreviewer/runtimes/vue-runtime.ts',
          'packages/adapters/vue/src/index.ts',
          'node_modules/vue/dist/vue.runtime.esm.js',
        ],
      }),
      chunk('_astro/vue2.js', {
        name: 'vue2-runtime',
        isDynamicEntry: true,
        moduleIds: [
          'apps/www/src/components/PrototypePreviewer/runtimes/vue2-runtime.ts',
          'packages/adapters/vue2/src/index.ts',
        ],
      }),
    ],
  };
}

test('accepts module-proven demo runtimes isolated from shell static closures', () => {
  assert.deepEqual(validateWebsiteProductionBundle({ graph: graphFixture() }), {
    shellRuntime: 'native/static with source-owned lazy runtime consumers',
    primaryDemonstrationHost: 'web-component',
    isolatedDemonstrationRuntimes: 3,
  });
});

test('requires every approved demonstration facade in the production graph', () => {
  for (const facadeModuleId of [
    PREVIEWER_FACADE,
    PREVIEWER_CLIENT_FACADE,
    STYLE_ISOLATION_FACADE,
  ]) {
    const graph = graphFixture();
    graph.chunks = graph.chunks.filter((candidate) => candidate.facadeModuleId !== facadeModuleId);

    assert.ok(
      collectWebsiteProductionBundleIssues({ graph }).includes(
        `production bundle graph must contain exactly one approved demonstration entry for \`${facadeModuleId}\` (found 0)`
      )
    );
  }
});

test('accepts coalesced module-proven demo runtime chunks', () => {
  const graph = graphFixture();
  const runtimeFileNames = new Set(['_astro/react.js', '_astro/vue.js', '_astro/vue2.js']);
  const runtimeChunks = graph.chunks.filter((candidate) =>
    runtimeFileNames.has(candidate.fileName)
  );
  graph.chunks = graph.chunks.filter((candidate) => !runtimeFileNames.has(candidate.fileName));
  for (const routeRoot of graph.chunks.filter((candidate) => candidate.isEntry)) {
    routeRoot.dynamicImports = routeRoot.dynamicImports.map((fileName) =>
      runtimeFileNames.has(fileName) ? '_astro/coalesced-runtimes.js' : fileName
    );
  }
  graph.chunks.push(
    chunk('_astro/coalesced-runtimes.js', {
      isDynamicEntry: true,
      moduleIds: runtimeChunks.flatMap((candidate) => candidate.moduleIds),
    })
  );

  assert.deepEqual(collectWebsiteProductionBundleIssues({ graph }), []);
});

test('rejects framework Adapter modules statically owned by a route demo', () => {
  const graph = graphFixture();
  graph.chunks
    .find((candidate) => candidate.fileName === '_astro/home-demo.js')
    .imports.push('_astro/react.js');

  assert.ok(
    collectWebsiteProductionBundleIssues({ graph }).some((issue) =>
      issue.includes('statically includes the react Adapter')
    )
  );
});

test('rejects runtime chunks that are not dynamically reachable from a route demo', () => {
  const graph = graphFixture();
  graph.chunks.find((candidate) => candidate.fileName === '_astro/home-demo.js').dynamicImports =
    [];

  assert.ok(
    collectWebsiteProductionBundleIssues({ graph }).some((issue) =>
      issue.includes('does not dynamically reach a react Adapter runtime chunk')
    )
  );
});

test('rejects a graph without route-owned Web Component host provenance', () => {
  const graph = graphFixture();
  for (const route of [
    '_astro/home-demo.js',
    '_astro/new-projection-families.js',
    '_astro/liquid-glass-material.js',
    '_astro/bootstrap-state-controls.js',
  ]) {
    const entry = graph.chunks.find((candidate) => candidate.fileName === route);
    entry.imports = entry.imports.filter((fileName) => fileName !== '_astro/wc-host.js');
  }

  assert.ok(
    collectWebsiteProductionBundleIssues({ graph }).includes(
      'production bundle graph has no route-owned demonstration entry with static module-level evidence for both the reviewed Web Component facade registry and Web Component Adapter'
    )
  );
});

test('does not mistake an orphaned WC runtime for primary host provenance', () => {
  const graph = graphFixture();
  for (const route of [
    '_astro/home-demo.js',
    '_astro/new-projection-families.js',
    '_astro/liquid-glass-material.js',
    '_astro/bootstrap-state-controls.js',
  ]) {
    const entry = graph.chunks.find((candidate) => candidate.fileName === route);
    entry.imports = entry.imports.filter((fileName) => fileName !== '_astro/wc-host.js');
  }
  graph.chunks.push(
    chunk('_astro/wc-runtime.js', {
      isDynamicEntry: true,
      facadeModuleId: 'apps/www/src/components/PrototypePreviewer/runtimes/wc-runtime.ts',
      moduleIds: [
        'apps/www/src/components/PrototypePreviewer/wc-registry.ts',
        'packages/adapters/web-component/src/adapt.ts',
      ],
    })
  );

  assert.ok(
    collectWebsiteProductionBundleIssues({ graph }).some((issue) =>
      issue.includes('no route-owned demonstration entry with static module-level evidence')
    )
  );
});

test('rejects an extra orphaned Web Component runtime entry', () => {
  const graph = graphFixture();
  const facadeModuleId = 'apps/www/src/components/PrototypePreviewer/runtimes/wc-runtime.ts';
  graph.chunks.push(
    chunk('_astro/orphaned-wc-runtime.js', {
      isDynamicEntry: true,
      facadeModuleId,
      moduleIds: [
        'apps/www/src/components/PrototypePreviewer/wc-registry.ts',
        'packages/adapters/web-component/src/adapt.ts',
      ],
    })
  );

  assert.ok(
    collectWebsiteProductionBundleIssues({ graph }).includes(
      `reviewed demonstration runtime entry \`${facadeModuleId}\` is orphaned from shell or route-owned entry reachability`
    )
  );
});

test('requires registry and Adapter provenance in the same route-owned demo closure', () => {
  const graph = graphFixture();
  graph.chunks.find((candidate) => candidate.fileName === '_astro/wc-host.js').moduleIds = [
    'apps/www/src/components/PrototypePreviewer/wc-registry.ts',
  ];
  graph.chunks.push(
    chunk('_astro/second-demo.js', {
      isEntry: true,
      facadeModuleId:
        'apps/www/src/components/PrototypePreviewer/PrototypePreviewer.astro?astro&type=script&index=0&lang.ts',
      moduleIds: ['packages/adapters/web-component/src/adapt.ts'],
    })
  );

  assert.ok(
    collectWebsiteProductionBundleIssues({ graph }).some((issue) =>
      issue.includes('no route-owned demonstration entry with static module-level evidence')
    )
  );
});
test('requires the Vue Adapter in every route-owned demo closure', () => {
  const graph = graphFixture();
  const styleIsolationRoot = graph.chunks.find(
    (candidate) => candidate.facadeModuleId === STYLE_ISOLATION_FACADE
  );
  styleIsolationRoot.dynamicImports = ['_astro/vue-framework-only.js'];
  graph.chunks.push(
    chunk('_astro/vue-framework-only.js', {
      isDynamicEntry: true,
      moduleIds: ['node_modules/vue/dist/vue.runtime.esm.js'],
    })
  );

  assert.ok(
    collectWebsiteProductionBundleIssues({ graph }).some((issue) =>
      issue.includes(
        `route-owned demonstration entry \`${STYLE_ISOLATION_FACADE}\` does not dynamically reach a vue Adapter runtime chunk`
      )
    )
  );
  assert.deepEqual(collectWebsiteProductionBundleIssues({ graph: graphFixture() }), []);
});

test('rejects renamed or inlined framework modules in a shell chunk', () => {
  const graph = graphFixture();
  graph.chunks.push(
    chunk('_astro/innocent-helper.js', {
      name: 'innocent-helper',
      moduleIds: ['node_modules/.pnpm/react@19.2.0/node_modules/react/jsx-runtime.js'],
    })
  );
  graph.chunks[0].imports.push('_astro/innocent-helper.js');

  const issues = collectWebsiteProductionBundleIssues({ graph });
  assert.ok(
    issues.some((issue) => issue.includes('statically reaches forbidden React/Vue module(s)'))
  );
  assert.ok(
    issues.some((issue) =>
      issue.includes('forbidden framework chunk `_astro/innocent-helper.js` is not owned')
    )
  );
});

test('rejects Web Component Adapter evidence inside the native/static shell closure', () => {
  const graph = graphFixture();
  graph.chunks.push(
    chunk('_astro/shell-wc.js', {
      moduleIds: ['packages/adapters/web-component/src/adapt.ts?used'],
    })
  );
  graph.chunks[0].imports.push('_astro/shell-wc.js');

  assert.ok(
    collectWebsiteProductionBundleIssues({ graph }).some((issue) =>
      issue.includes('Proto UI Adapter module(s)')
    )
  );
});

test('allows Adapter modules only in the exact reviewed site-control bridge chunk', () => {
  const graph = graphFixture();
  graph.chunks
    .find((candidate) => candidate.fileName === '_astro/site-shadcn-controls.js')
    .moduleIds.push(
      'packages/adapters/base/src/host/adapter-host.ts',
      'packages/adapters/base/src/platform/focus-order.ts?used',
      'packages/adapters/base/src/platform/web-preference-source.ts?used',
      'packages/adapters/base/src/platform/web-style-support-source.ts?used',
      'packages/adapters/web-component/src/adapt.ts?used'
    );

  assert.deepEqual(collectWebsiteProductionBundleIssues({ graph }), []);
});

test('rejects unreviewed Adapter modules inside the reviewed bridge chunk', () => {
  const graph = graphFixture();
  const unreviewedModules = [
    // This helper belongs to lazy framework adapters, not the sitewide WC
    // bridge. Do not make a barrel/chunk regression pass by admitting it here.
    'packages/adapters/base/src/host/instance-associations.ts',
    'packages/adapters/base/src/host/unreviewed-extension.ts',
    'packages/adapters/web-component/src/unreviewed-extension.ts',
  ];
  graph.chunks
    .find((candidate) => candidate.fileName === '_astro/site-shadcn-controls.js')
    .moduleIds.push(...unreviewedModules);

  const issues = collectWebsiteProductionBundleIssues({ graph });
  for (const moduleId of unreviewedModules) {
    assert.ok(
      issues.some((issue) => issue.includes(moduleId)),
      `unreviewed bridge module should be rejected: ${moduleId}`
    );
  }
});

test('does not let the reviewed site-control bridge exempt a sibling Adapter chunk', () => {
  const graph = graphFixture();
  graph.chunks[0].imports.push('_astro/sibling-adapter.js');
  graph.chunks
    .find((candidate) => candidate.fileName === '_astro/site-shadcn-controls.js')
    .moduleIds.push('packages/adapters/web-component/src/adapt.ts?used');
  graph.chunks.push(
    chunk('_astro/sibling-adapter.js', {
      moduleIds: ['packages/adapters/web-component/src/runtime/session.ts'],
    })
  );

  assert.ok(
    collectWebsiteProductionBundleIssues({ graph }).some((issue) =>
      issue.includes('packages/adapters/web-component/src/runtime/session.ts')
    )
  );
});

test('does not exempt the reviewed Focus order module in a sibling chunk', () => {
  const graph = graphFixture();
  graph.chunks[0].imports.push('_astro/sibling-focus-order.js');
  graph.chunks
    .find((candidate) => candidate.fileName === '_astro/site-shadcn-controls.js')
    .moduleIds.push('packages/adapters/base/src/platform/focus-order.ts?used');
  graph.chunks.push(
    chunk('_astro/sibling-focus-order.js', {
      moduleIds: ['packages/adapters/base/src/platform/focus-order.ts?used'],
    })
  );

  assert.ok(
    collectWebsiteProductionBundleIssues({ graph }).some((issue) =>
      issue.includes('packages/adapters/base/src/platform/focus-order.ts?used')
    )
  );
});

test('rejects Adapter modules in chunks statically imported by the reviewed site-control bridge chunk', () => {
  const graph = graphFixture();
  graph.chunks.find(
    (candidate) => candidate.fileName === '_astro/site-shadcn-controls.js'
  ).imports = ['_astro/shared-adapter.js'];
  graph.chunks.push(
    chunk('_astro/shared-adapter.js', {
      moduleIds: [
        'packages/adapters/base/src/host/adapter-host.ts',
        'packages/adapters/web-component/src/adapt.ts?used',
      ],
    })
  );

  assert.ok(
    collectWebsiteProductionBundleIssues({ graph }).some((issue) =>
      issue.includes('packages/adapters/web-component/src/adapt.ts?used')
    )
  );
});

test('does not exempt a bridge dependency that the shell reaches without the bridge', () => {
  const graph = graphFixture();
  graph.chunks[0].imports.push('_astro/shared-adapter.js');
  graph.chunks.find(
    (candidate) => candidate.fileName === '_astro/site-shadcn-controls.js'
  ).imports = ['_astro/shared-adapter.js'];
  graph.chunks.push(
    chunk('_astro/shared-adapter.js', {
      moduleIds: ['packages/adapters/web-component/src/adapt.ts?used'],
    })
  );

  assert.ok(
    collectWebsiteProductionBundleIssues({ graph }).some((issue) =>
      issue.includes('packages/adapters/web-component/src/adapt.ts?used')
    )
  );
});

test('rejects framework modules even downstream of the reviewed site-control bridge chunk', () => {
  const graph = graphFixture();
  graph.chunks.find(
    (candidate) => candidate.fileName === '_astro/site-shadcn-controls.js'
  ).imports = ['_astro/shared-adapter.js'];
  graph.chunks.push(
    chunk('_astro/shared-adapter.js', {
      moduleIds: ['node_modules/.pnpm/react@19.2.0/node_modules/react/jsx-runtime.js'],
    })
  );

  assert.ok(
    collectWebsiteProductionBundleIssues({ graph }).some((issue) =>
      issue.includes('statically reaches forbidden React/Vue module(s)')
    )
  );
});

test('requires one reviewed control bridge that a Website shell statically reaches', () => {
  const missing = graphFixture();
  missing.chunks = missing.chunks.filter(
    (candidate) => candidate.fileName !== '_astro/site-shadcn-controls.js'
  );
  assert.ok(
    collectWebsiteProductionBundleIssues({ graph: missing }).some((issue) =>
      issue.includes('exactly one reviewed Website control bridge chunk (found 0)')
    )
  );

  const orphaned = graphFixture();
  orphaned.chunks[0].imports = orphaned.chunks[0].imports.filter(
    (fileName) => fileName !== '_astro/site-shadcn-controls.js'
  );
  assert.ok(
    collectWebsiteProductionBundleIssues({ graph: orphaned }).some((issue) =>
      issue.includes('no Website shell statically reaches the reviewed Website control bridge')
    )
  );
});

test('treats an unproven null-facade entry as a shell root', () => {
  const graph = graphFixture();
  graph.chunks.push(
    chunk('_astro/mystery.js', {
      name: 'mystery',
      isEntry: true,
      moduleIds: ['node_modules/.pnpm/react-dom@19.2.0/node_modules/react-dom/client.js'],
    })
  );
  graph.chunks
    .find((candidate) => candidate.fileName === '_astro/home-demo.js')
    .imports.push('_astro/mystery.js');

  assert.ok(
    collectWebsiteProductionBundleIssues({ graph }).some((issue) =>
      issue.includes(
        'Website shell entry `<null facade: _astro/mystery.js>` statically reaches forbidden React/Vue module(s)'
      )
    )
  );
});

test('does not accept benign named runtime wrappers without module-level Adapter evidence', () => {
  const graph = graphFixture();
  for (const fileName of ['_astro/react.js', '_astro/vue.js', '_astro/vue2.js']) {
    graph.chunks.find((candidate) => candidate.fileName === fileName).moduleIds = [
      'apps/www/src/components/PrototypePreviewer/safe-wrapper.ts',
    ];
  }

  const issues = collectWebsiteProductionBundleIssues({ graph });
  for (const family of ['react', 'vue', 'vue2']) {
    assert.ok(
      issues.includes(
        `production bundle graph has no module-level evidence for the ${family} Adapter`
      )
    );
  }
});

test('treats an unreviewed entry under PrototypePreviewer as an ordinary shell root', () => {
  const graph = graphFixture();
  graph.chunks.push(
    chunk('_astro/unreviewed.js', {
      isEntry: true,
      facadeModuleId:
        'apps/www/src/components/PrototypePreviewer/Unreviewed.astro?astro&type=script&index=0&lang.ts',
      moduleIds: ['node_modules/.pnpm/vue@3.5.0/node_modules/vue/dist/vue.runtime.esm.js'],
    })
  );

  assert.ok(
    collectWebsiteProductionBundleIssues({ graph }).some((issue) =>
      issue.includes(
        'Website shell entry `apps/www/src/components/PrototypePreviewer/Unreviewed.astro'
      )
    )
  );
});

test('validates dynamic import fields and references', () => {
  const malformed = graphFixture();
  malformed.chunks[0].dynamicImports = 'not-an-array';
  assert.ok(
    collectWebsiteProductionBundleIssues({ graph: malformed }).some((issue) =>
      issue.includes('must have a string-array dynamicImports field')
    )
  );

  const missing = graphFixture();
  missing.chunks[0].dynamicImports.push('_astro/missing-demo.js');
  assert.ok(
    collectWebsiteProductionBundleIssues({ graph: missing }).includes(
      'production bundle graph chunk `_astro/search.js` dynamicImports references missing chunk `_astro/missing-demo.js`'
    )
  );
});

test('rejects an orphaned dynamic demonstration entry', () => {
  const graph = graphFixture();
  const previewerRoot = graph.chunks.find(
    (candidate) => candidate.facadeModuleId === PREVIEWER_FACADE
  );
  previewerRoot.dynamicImports = previewerRoot.dynamicImports.filter(
    (fileName) => fileName !== '_astro/previewer-client.js'
  );

  assert.ok(
    collectWebsiteProductionBundleIssues({ graph }).includes(
      `approved demonstration entry \`${PREVIEWER_CLIENT_FACADE}\` is orphaned from shell or route-owned entry reachability`
    )
  );
});

test('rejects shell dynamic imports of demo-owned framework chunks', () => {
  const graph = graphFixture();
  graph.chunks[0].dynamicImports.push('_astro/react.js');

  assert.ok(
    collectWebsiteProductionBundleIssues({ graph }).some((issue) =>
      issue.includes(
        'Website shell entry `apps/www/src/components/override/Search.astro?astro&type=script&index=0&lang.ts` dynamically reaches forbidden React/Vue module(s)'
      )
    )
  );
});

test('admits only the reviewed new-family demonstration route with isolated runtimes', () => {
  const graph = graphFixture();
  assert.deepEqual(collectWebsiteProductionBundleIssues({ graph }), []);
  const fixture = graph.chunks.find(
    (chunk) => chunk.fileName === '_astro/new-projection-families.js'
  );
  fixture.facadeModuleId =
    'apps/www/src/pages/en/test/CopiedFamilies.astro?astro&type=script&index=0&lang.ts';
  assert.ok(
    collectWebsiteProductionBundleIssues({ graph }).some((issue) =>
      issue.includes('Website shell entry')
    )
  );
});

test('keeps accepted stage-zero material sources inside their exact demonstration and bridge boundaries', () => {
  const graph = graphFixture();
  assert.deepEqual(collectWebsiteProductionBundleIssues({ graph }), []);
  graph.chunks.find(
    (entry) => entry.fileName === '_astro/liquid-glass-material.js'
  ).facadeModuleId =
    'apps/www/src/pages/en/test/CopiedMaterial.astro?astro&type=script&index=0&lang.ts';
  assert.ok(
    collectWebsiteProductionBundleIssues({ graph }).some((issue) =>
      issue.includes('Website shell entry')
    )
  );
  for (const module of [
    'packages/adapters/base/src/platform/web-preference-source.ts',
    'packages/adapters/base/src/platform/web-style-support-source.ts',
  ]) {
    const outside = graphFixture();
    outside.chunks[0].imports.push('_astro/sibling-source.js');
    outside.chunks.push(chunk('_astro/sibling-source.js', { moduleIds: [module] }));
    assert.ok(
      collectWebsiteProductionBundleIssues({ graph: outside }).some((issue) =>
        issue.includes(module)
      )
    );
  }
});

for (const family of ['react', 'vue', 'vue2'])
  for (const dynamic of [false, true])
    test(`runtime entry flags: ${family} rejects direct entry with dynamic=${dynamic}`, () => {
      const graph = graphFixture();
      const runtime = graph.chunks.find((chunk) => chunk.fileName === `_astro/${family}.js`);
      runtime.isEntry = true;
      runtime.isDynamicEntry = dynamic;
      assert.ok(
        collectWebsiteProductionBundleIssues({ graph }).some((issue) =>
          /runtime chunk.*must be dynamic-only/u.test(issue)
        )
      );
    });
for (const family of ['react', 'vue', 'vue2', 'wc'])
  for (const isEntry of [false, true])
    test(`runtime entry flags: named ${family} facade ${isEntry ? 'rejects dual entry' : 'allows dynamic only'}`, () => {
      const graph = graphFixture();
      const name = `_astro/named-${family}.js`;
      graph.chunks.push(
        chunk(name, {
          isEntry,
          isDynamicEntry: true,
          facadeModuleId: `apps/www/src/components/PrototypePreviewer/runtimes/${family}-runtime.ts`,
          moduleIds: [],
        })
      );
      graph.chunks
        .find((chunk) => chunk.fileName === '_astro/home-demo.js')
        .dynamicImports.push(name);
      const issues = collectWebsiteProductionBundleIssues({ graph });
      if (isEntry)
        assert.ok(issues.some((issue) => /runtime chunk.*must be dynamic-only/u.test(issue)));
      else assert.deepEqual(issues, []);
    });

const reviewedWcHelpers = [
  'packages/adapters/base/src/platform/portal-direction.ts',
  'packages/adapters/web-component/src/focus-scope-targets.ts',
  'packages/adapters/web-component/src/keyed-meta-sources.ts',
  'packages/adapters/web-component/src/portal-conceal.ts',
  'packages/adapters/web-component/src/portal-mount.ts',
  'packages/adapters/web-component/src/shadow-color-scheme-environment.ts',
  'packages/adapters/web-component/src/shadow-inner-surface.ts',
  'packages/adapters/web-component/src/shadow-owner-shell.ts',
  'packages/adapters/web-component/src/shadow-profile.ts',
  'packages/adapters/web-component/src/shadow-split-effects.ts',
  'packages/adapters/web-component/src/shadow-split-meta.ts',
  'packages/adapters/web-component/src/shadow-split-resources.ts',
  'packages/adapters/web-component/src/shadow-style-artifact.ts',
  'packages/adapters/web-component/src/shadow-stylesheet-owner.ts',
  'packages/adapters/web-component/src/shadow-text-control-surface.ts',
];

const siteOwners = [
  ['UiLibraryGallery.astro', 'library-card-client.ts'],
  ['Homepage/HomepageRuntime.astro', 'Homepage/homepage-runtime-client.ts'],
  ['override/Header.astro', 'site-header-surface.ts'],
  ['override/Search.astro', 'site-search-commands.ts'],
  ['SiteCopyBootstrap.astro', 'site-copy-client.ts'],
  ['SiteTypographyBootstrap.astro', 'site-typography-client.ts'],
];
for (const [entry, owner] of siteOwners) {
  function siteGraph() {
    const graph = graphFixture();
    const facade = `apps/www/src/components/${entry}?astro&type=script&index=0&lang.ts`;
    const root =
      graph.chunks.find((item) => item.facadeModuleId === facade) ??
      chunk('_astro/site-owner.js', {
        isEntry: true,
        facadeModuleId: facade,
        imports: ['_astro/site-shadcn-controls.js'],
      });
    if (!graph.chunks.includes(root)) graph.chunks.push(root);
    root.moduleIds.push(`apps/www/src/components/${owner}`);
    root.imports.push('_astro/shared-renderer.js');
    graph.chunks.push(
      chunk('_astro/shared-renderer.js', {
        moduleIds: ['apps/www/src/components/PrototypePreviewer/demo-renderer.ts'],
        dynamicImports: ['_astro/react.js', '_astro/vue.js', '_astro/vue2.js'],
      })
    );
    graph.modules = graph.chunks
      .flatMap((item) => item.moduleIds)
      .map((id) => ({
        id,
        imports: [],
        dynamicImports: [],
      }));
    graph.modules.find((item) => item.id.endsWith('/demo-renderer.ts')).dynamicImports = [
      'react',
      'vue',
      'vue2',
    ].map((family) => `apps/www/src/components/PrototypePreviewer/runtimes/${family}-runtime.ts`);
    for (const family of ['react', 'vue', 'vue2']) {
      const runtime = `apps/www/src/components/PrototypePreviewer/runtimes/${family}-runtime.ts`;
      graph.modules.find((item) => item.id === runtime).imports = graph.chunks
        .find((item) => item.fileName === `_astro/${family}.js`)
        .moduleIds.filter((id) => id !== runtime);
    }
    return { graph, root };
  }
  function addReviewedBridgeTarget(graph, target) {
    const bridge = graph.chunks.find((item) => item.fileName === '_astro/site-shadcn-controls.js');
    bridge.moduleIds.push(target);
    graph.modules.push({ id: target, imports: [], dynamicImports: [] });
    graph.modules
      .find((item) => item.id === 'apps/www/src/components/site-shadcn-controls.ts')
      .imports.push(target);
    return bridge;
  }
  test(`bridge origin: ${entry} admits router-owned pointer contact transitively`, () => {
    const { graph } = siteGraph();
    const router = 'packages/adapters/base/src/events/web-event-router.ts';
    const contact = 'packages/adapters/base/src/events/pointer-contact.ts';
    const bridge = addReviewedBridgeTarget(graph, router);
    bridge.moduleIds.push(contact);
    graph.modules.push({ id: contact, imports: [], dynamicImports: [] });
    graph.modules.find((item) => item.id === router).imports.push(contact);
    assert.deepEqual(collectWebsiteProductionBundleIssues({ graph }), []);
    const unknown = 'packages/adapters/base/src/events/pointer-contact-unreviewed.ts';
    bridge.moduleIds.push(unknown);
    graph.modules.push({ id: unknown, imports: [], dynamicImports: [] });
    graph.modules.find((item) => item.id === router).imports.push(unknown);
    assert.ok(
      collectWebsiteProductionBundleIssues({ graph }).some(
        (issue) => issue.includes('unowned importer edge') && issue.includes(unknown)
      )
    );
  });
  test(`bridge origin: ${entry} admits the exact WC-owned color scheme provider transitively`, () => {
    const { graph } = siteGraph();
    const adapter = 'packages/adapters/web-component/src/adapt.ts';
    const source = 'packages/adapters/web-component/src/color-scheme-source.ts';
    const bridge = addReviewedBridgeTarget(graph, adapter);
    bridge.moduleIds.push(source);
    graph.modules.push({ id: source, imports: [], dynamicImports: [] });
    graph.modules.find((item) => item.id === adapter).imports.push(source);
    assert.deepEqual(collectWebsiteProductionBundleIssues({ graph }), []);
    // Reviewing this exact provider never admits adjacent or similarly named helpers.
    const unknown = 'packages/adapters/web-component/src/color-scheme-source-unreviewed.ts';
    bridge.moduleIds.push(unknown);
    graph.modules.push({ id: unknown, imports: [], dynamicImports: [] });
    graph.modules.find((item) => item.id === adapter).imports.push(unknown);
    assert.ok(
      collectWebsiteProductionBundleIssues({ graph }).some(
        (issue) => issue.includes('unowned importer edge') && issue.includes(unknown)
      )
    );
  });
  for (const target of [
    'packages/adapters/base/src/events/pointer-contact.ts',
    ...reviewedWcHelpers,
    'packages/adapters/web-component/src/color-scheme-source.ts',
    'packages/adapters/web-component/src/adapt.ts',
    'packages/adapters/web-component/src/material/owned-texture-sink.ts',
    'packages/adapters/web-component/src/runtime/experimental-visual-consumer.ts',
    'packages/adapters/web-component/src/visual-surface.ts',
  ]) {
    for (const placement of ['owner', 'bridge', 'renderer']) {
      for (const field of ['imports', 'dynamicImports']) {
        test(`bridge origin: ${entry} rejects ${placement} ${field} bypass to ${target}`, () => {
          const { graph, root } = siteGraph();
          const bridge = addReviewedBridgeTarget(graph, target);
          assert.deepEqual(collectWebsiteProductionBundleIssues({ graph }), []);
          const container =
            placement === 'owner'
              ? root
              : placement === 'bridge'
                ? bridge
                : graph.chunks.find((item) => item.fileName === '_astro/shared-renderer.js');
          const foreign = 'apps/www/src/components/unrelated-bridge-feature.ts';
          container.moduleIds.push(foreign);
          graph.modules.push({ id: foreign, imports: [], dynamicImports: [], [field]: [target] });
          assert.ok(
            collectWebsiteProductionBundleIssues({ graph }).some(
              (issue) =>
                issue.includes('unowned importer edge') &&
                issue.includes(foreign) &&
                issue.includes(target)
            )
          );
        });
      }
    }
  }
  for (const api of [
    'site-shadcn-controls.ts',
    'site-native-controls.ts',
    'library-card-client.ts',
  ]) {
    test(`bridge origin: ${entry} accepts exact ${api} and its helper but rejects helper bypass`, () => {
      const { graph, root } = siteGraph();
      const target = 'packages/adapters/web-component/src/adapt.ts';
      const bridge = addReviewedBridgeTarget(graph, target);
      const id = `apps/www/src/components/${api}`;
      let ownerRecord = graph.modules.find((item) => item.id === id);
      if (!ownerRecord) {
        ownerRecord = { id, imports: [], dynamicImports: [] };
        graph.modules.push(ownerRecord);
        bridge.moduleIds.push(id);
      }
      const helper = 'apps/www/src/components/reviewed-bridge-helper.ts';
      bridge.moduleIds.push(helper);
      graph.modules.push({ id: helper, imports: [target], dynamicImports: [] });
      ownerRecord.imports.push(helper);
      graph.modules.find((item) => item.id === `apps/www/src/components/${owner}`).imports.push(id);
      assert.deepEqual(collectWebsiteProductionBundleIssues({ graph }), []);
      const foreign = 'apps/www/src/components/unrelated-helper-caller.ts';
      root.moduleIds.push(foreign);
      graph.modules.push({ id: foreign, imports: [helper], dynamicImports: [] });
      assert.ok(
        collectWebsiteProductionBundleIssues({ graph }).some(
          (issue) => issue.includes(foreign) && issue.includes(target)
        )
      );
    });
    test(`bridge origin: ${entry} rejects ${api} query lookalike`, () => {
      const { graph, root } = siteGraph();
      const target = 'packages/adapters/web-component/src/adapt.ts';
      addReviewedBridgeTarget(graph, target);
      const id = `apps/www/src/components/${api}?foreign`;
      root.moduleIds.push(id);
      graph.modules.push({ id, imports: [target], dynamicImports: [] });
      assert.ok(
        collectWebsiteProductionBundleIssues({ graph }).some(
          (issue) => issue.includes(id) && issue.includes(target)
        )
      );
    });
  }
  test(`bridge origin: ${entry} does not let controls API acquire an unreviewed framework target`, () => {
    const { graph, root } = siteGraph();
    const target = 'packages/adapters/web-component/src/adapt.ts';
    addReviewedBridgeTarget(graph, target);
    const api = graph.modules.find(
      (item) => item.id === 'apps/www/src/components/site-shadcn-controls.ts'
    );
    api.dynamicImports.push('packages/adapters/react/src/index.ts');
    root.dynamicImports.push('_astro/react.js');
    assert.ok(
      collectWebsiteProductionBundleIssues({ graph }).some(
        (issue) =>
          issue.includes('site-shadcn-controls.ts') &&
          issue.includes('packages/adapters/react/src/index.ts')
      )
    );
  });
  test(`bridge origin: ${entry} permits an unemitted foreign record and inert cycle`, () => {
    const { graph } = siteGraph();
    const target = 'packages/adapters/web-component/src/adapt.ts';
    addReviewedBridgeTarget(graph, target);
    graph.modules.push(
      { id: 'unemitted-one', imports: ['unemitted-two', target], dynamicImports: [] },
      { id: 'unemitted-two', imports: ['unemitted-one'], dynamicImports: [] }
    );
    assert.deepEqual(collectWebsiteProductionBundleIssues({ graph }), []);
  });
  test(`site runtime exact owner: ${entry}`, () => {
    const { graph } = siteGraph();
    assert.doesNotThrow(() => validateWebsiteProductionBundle({ graph }));
  });
  for (const placement of ['renderer', 'runtime', 'runtime-static-helper']) {
    test(`site module ownership: ${entry} rejects shared ${placement} foreign adapter edge`, () => {
      const { graph } = siteGraph();
      const renderer = graph.chunks.find((item) => item.fileName === '_astro/shared-renderer.js');
      const runtime = graph.chunks.find((item) => item.fileName === '_astro/react.js');
      let importer = placement === 'renderer' ? renderer : runtime;
      if (placement === 'runtime-static-helper') {
        importer = chunk('_astro/shared-helper.js');
        graph.chunks.push(importer);
        runtime.imports.push(importer.fileName);
      }
      const foreign = 'apps/www/src/components/unrelated-feature.ts';
      const adapter = 'packages/adapters/react/src/unreviewed.ts';
      importer.moduleIds.push(foreign);
      importer.dynamicImports.push('_astro/unreviewed.js');
      graph.chunks.push(
        chunk('_astro/unreviewed.js', { isDynamicEntry: true, moduleIds: [adapter] })
      );
      graph.modules.push(
        { id: foreign, imports: [], dynamicImports: [adapter] },
        { id: adapter, imports: [], dynamicImports: [] }
      );
      assert.ok(
        collectWebsiteProductionBundleIssues({ graph }).some(
          (issue) => issue.includes('outside its renderer closure') && issue.includes(adapter)
        )
      );
    });
  }
  for (const placement of ['renderer', 'runtime', 'helper']) {
    for (const field of ['imports', 'dynamicImports']) {
      for (const targetKind of ['adapter', 'runtime', 'shared-barrel']) {
        test(`site importer edge: ${entry} rejects ${placement} ${field} to existing ${targetKind}`, () => {
          const { graph } = siteGraph();
          const renderer = graph.chunks.find(
            (item) => item.fileName === '_astro/shared-renderer.js'
          );
          const runtime = graph.chunks.find((item) => item.fileName === '_astro/react.js');
          let shared = placement === 'renderer' ? renderer : runtime;
          if (placement === 'helper') {
            shared = chunk('_astro/helper.js');
            graph.chunks.push(shared);
            runtime.imports.push(shared.fileName);
          }
          const foreign = 'apps/www/src/components/unrelated-feature.ts';
          const adapterId = 'packages/adapters/react/src/index.ts';
          const runtimeId = 'apps/www/src/components/PrototypePreviewer/runtimes/react-runtime.ts';
          let target = targetKind === 'runtime' ? runtimeId : adapterId;
          if (targetKind === 'shared-barrel') {
            target = 'apps/www/src/components/runtime-barrel.ts';
            runtime.moduleIds.push(target);
            graph.modules.push({ id: target, imports: [adapterId], dynamicImports: [] });
            graph.modules.find((item) => item.id === runtimeId).imports.push(target);
          }
          shared.moduleIds.push(foreign);
          shared[field].push(runtime.fileName);
          graph.modules.push({ id: foreign, imports: [], dynamicImports: [], [field]: [target] });
          assert.ok(
            collectWebsiteProductionBundleIssues({ graph }).some(
              (issue) =>
                issue.includes('unowned importer edge') &&
                issue.includes(foreign) &&
                issue.includes(adapterId)
            )
          );
        });
      }
    }
  }
  test(`site importer edge: ${entry} rejects owner bypass directly to existing Adapter`, () => {
    const { graph, root } = siteGraph();
    const ownerId = `apps/www/src/components/${owner}`;
    graph.modules
      .find((item) => item.id === ownerId)
      .dynamicImports.push('packages/adapters/react/src/index.ts');
    root.dynamicImports.push('_astro/react.js');
    assert.ok(
      collectWebsiteProductionBundleIssues({ graph }).some(
        (issue) => issue.includes('unowned importer edge') && issue.includes(ownerId)
      )
    );
  });
  test(`site importer edge: ${entry} preserves renderer API boundary and inert cycles`, () => {
    const { graph } = siteGraph();
    const renderer = graph.chunks.find((item) => item.fileName === '_astro/shared-renderer.js');
    const one = 'apps/www/src/components/inert-one.ts',
      two = 'apps/www/src/components/inert-two.ts';
    renderer.moduleIds.push(one, two);
    graph.modules.push(
      { id: one, imports: [two], dynamicImports: [] },
      {
        id: two,
        imports: [one, 'apps/www/src/components/PrototypePreviewer/demo-renderer.ts'],
        dynamicImports: [],
      }
    );
    assert.deepEqual(collectWebsiteProductionBundleIssues({ graph }), []);
  });
  test(`site importer edge: ${entry} rejects missing co-located importer provenance`, () => {
    const { graph } = siteGraph();
    graph.chunks
      .find((item) => item.fileName === '_astro/shared-renderer.js')
      .moduleIds.push('apps/www/src/components/unrecorded.ts');
    assert.ok(
      collectWebsiteProductionBundleIssues({ graph }).some((issue) =>
        issue.includes('module-edge provenance')
      )
    );
  });
  test(`site importer edge: ${entry} renderer query lookalike is not an API boundary`, () => {
    const { graph } = siteGraph();
    const id = 'apps/www/src/components/PrototypePreviewer/demo-renderer.ts?foreign';
    graph.chunks.find((item) => item.fileName === '_astro/shared-renderer.js').moduleIds.push(id);
    graph.modules.push({
      id,
      imports: [],
      dynamicImports: ['packages/adapters/react/src/index.ts'],
    });
    assert.ok(
      collectWebsiteProductionBundleIssues({ graph }).some(
        (issue) => issue.includes('unowned importer edge') && issue.includes(id)
      )
    );
  });
  for (const defect of ['missing', 'duplicate', 'dangling', 'malformed', 'missing-renderer']) {
    test(`site module provenance: ${entry} rejects ${defect}`, () => {
      const { graph } = siteGraph();
      if (defect === 'missing') delete graph.modules;
      if (defect === 'duplicate') graph.modules.push(graph.modules[0]);
      if (defect === 'dangling') graph.modules[0].imports.push('missing-module');
      if (defect === 'malformed') graph.modules[0].imports = 'not-an-array';
      if (defect === 'missing-renderer')
        graph.modules = graph.modules.filter((item) => !item.id.endsWith('/demo-renderer.ts'));
      assert.ok(
        collectWebsiteProductionBundleIssues({ graph }).some((issue) =>
          issue.includes('module-edge provenance')
        )
      );
    });
  }
  test(`site module ownership: ${entry} allows unrelated inert co-location`, () => {
    const { graph } = siteGraph();
    graph.chunks
      .find((item) => item.fileName === '_astro/shared-renderer.js')
      .moduleIds.push('apps/www/src/components/inert-feature.ts');
    graph.modules.push({
      id: 'apps/www/src/components/inert-feature.ts',
      imports: [],
      dynamicImports: [],
    });
    assert.deepEqual(collectWebsiteProductionBundleIssues({ graph }), []);
  });
  for (const defect of [
    'missing owner',
    'missing renderer',
    'copied facade',
    'static framework',
    'unowned dynamic adapter',
  ]) {
    test(`site runtime boundary: ${entry} rejects ${defect}`, () => {
      const { graph, root } = siteGraph();
      if (defect === 'missing owner') root.moduleIds = [];
      if (defect === 'missing renderer')
        graph.chunks.find((item) => item.fileName === '_astro/shared-renderer.js').moduleIds = [];
      if (defect === 'copied facade')
        root.facadeModuleId = root.facadeModuleId.replace(entry, `Copied${entry}`);
      if (defect === 'static framework') root.imports.push('_astro/react.js');
      if (defect === 'unowned dynamic adapter') {
        root.dynamicImports.push('_astro/unowned.js');
        graph.chunks.push(
          chunk('_astro/unowned.js', {
            isDynamicEntry: true,
            moduleIds: ['packages/adapters/react/src/unreviewed.ts'],
          })
        );
      }
      const issues = collectWebsiteProductionBundleIssues({ graph });
      assert.ok(
        issues.some((issue) => /Website.*(?:forbidden|outside its renderer closure)/u.test(issue)),
        issues.join('\n')
      );
    });
  }
}
test('accepts exact runtime facade identities with the same module-level evidence', () => {
  const graph = graphFixture();
  for (const runtime of ['react', 'vue', 'vue2']) {
    graph.chunks.find((item) => item.fileName === `_astro/${runtime}.js`).facadeModuleId =
      `apps/www/src/components/PrototypePreviewer/runtimes/${runtime}-runtime.ts`;
  }
  assert.doesNotThrow(() => validateWebsiteProductionBundle({ graph }));
});

test('rejects a runtime facade paired with another runtime source identity', () => {
  const graph = graphFixture();
  graph.chunks.find((item) => item.fileName === '_astro/react.js').facadeModuleId =
    'apps/www/src/components/PrototypePreviewer/runtimes/vue-runtime.ts';
  assert.ok(
    collectWebsiteProductionBundleIssues({ graph }).some(
      (issue) => issue.includes('react-runtime.ts') && issue.includes('found 0')
    )
  );
});

for (const moduleId of [
  ...reviewedWcHelpers,
  'packages/adapters/web-component/src/material/owned-texture-sink.ts',
  'packages/adapters/web-component/src/runtime/experimental-visual-consumer.ts',
  'packages/adapters/web-component/src/visual-surface.ts',
]) {
  test(`accepted WC support stays in exact bridge: ${moduleId}`, () => {
    const graph = graphFixture();
    graph.chunks
      .find((item) => item.fileName === '_astro/site-shadcn-controls.js')
      .moduleIds.push(moduleId);
    assert.deepEqual(collectWebsiteProductionBundleIssues({ graph }), []);
  });
  for (const placement of ['sibling', 'bridge-dependency', 'lookalike']) {
    test(`accepted WC support rejects ${placement}: ${moduleId}`, () => {
      const graph = graphFixture();
      const bridge = graph.chunks.find(
        (item) => item.fileName === '_astro/site-shadcn-controls.js'
      );
      if (placement === 'lookalike')
        bridge.moduleIds.push(moduleId.replace('.ts', '-unreviewed.ts'));
      else {
        graph.chunks.push(chunk('_astro/foreign-support.js', { moduleIds: [moduleId] }));
        (placement === 'sibling' ? graph.chunks[0] : bridge).imports.push(
          '_astro/foreign-support.js'
        );
      }
      assert.ok(
        collectWebsiteProductionBundleIssues({ graph }).some((issue) =>
          issue.includes('statically reaches forbidden')
        )
      );
    });
  }
}

test('Bootstrap state-controls admission is exact and keeps frameworks lazy', () => {
  const graph = graphFixture();
  const route = graph.chunks.find(
    (entry) => entry.fileName === '_astro/bootstrap-state-controls.js'
  );
  assert.deepEqual(collectWebsiteProductionBundleIssues({ graph }), []);
  route.imports.push('_astro/react.js');
  assert.ok(
    collectWebsiteProductionBundleIssues({ graph }).some((issue) =>
      issue.includes('statically includes the react Adapter')
    )
  );
  route.imports.pop();
  route.facadeModuleId =
    'apps/www/src/pages/en/test/copied-bootstrap-state-controls.astro?astro&type=script&index=0&lang.ts';
  assert.ok(
    collectWebsiteProductionBundleIssues({ graph }).some((issue) =>
      issue.includes('Website shell entry')
    )
  );
});

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const configSource = ts.createSourceFile(
  'astro.config.mjs',
  fs.readFileSync(path.join(repositoryRoot, 'apps/www/astro.config.mjs'), 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.JS
);
const chunkFunction = configSource.statements.find(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'websiteManualChunk'
);
assert.ok(chunkFunction);
const classifyChunk = vm.runInNewContext(`(${chunkFunction.getText(configSource)})`, {
  normalizedBundleModuleId: (id) => id,
});
const materialBoundary = chunkFunction.body.statements.find(
  (node) =>
    ts.isIfStatement(node) &&
    node.getText(configSource).includes('packages/adapters/base/src/material/')
);
assert.ok(materialBoundary);
const regroupMaterial = vm.runInNewContext(
  `(${chunkFunction.getText(configSource).replace(materialBoundary.getText(configSource), '')})`,
  { normalizedBundleModuleId: (id) => id }
);
const optionalMaterialSources = fs
  .readdirSync(path.join(repositoryRoot, 'packages/adapters/base/src/material'))
  .filter((name) => name.endsWith('.ts'))
  .map((name) => `packages/adapters/base/src/material/${name}`);
for (const moduleId of optionalMaterialSources) {
  test(`manual chunk preserves existing lazy material boundary: ${moduleId}`, () => {
    assert.equal(classifyChunk(moduleId), undefined);
    assert.equal(
      regroupMaterial(moduleId),
      'site-shadcn-controls',
      'Removing the precise exclusion must reproduce eager regrouping.'
    );
  });
  for (const via of ['same bridge chunk', 'static dependency chunk']) {
    test(`material remains forbidden in ordinary shells through ${via}: ${moduleId}`, () => {
      const graph = graphFixture();
      const bridge = graph.chunks.find(
        (item) => item.fileName === '_astro/site-shadcn-controls.js'
      );
      if (via === 'same bridge chunk') bridge.moduleIds.push(moduleId);
      else {
        graph.chunks.push(chunk('_astro/forbidden-material.js', { moduleIds: [moduleId] }));
        bridge.imports.push('_astro/forbidden-material.js');
      }
      assert.ok(
        collectWebsiteProductionBundleIssues({ graph }).some(
          (issue) => issue.includes('statically reaches forbidden') && issue.includes(moduleId)
        )
      );
    });
  }
}
test('manual chunk keeps reviewed WC controls grouped and framework-only associations outside', () => {
  for (const id of [
    'apps/www/src/components/site-shadcn-controls.ts',
    'packages/adapters/web-component/src/adapt.ts',
    ...reviewedWcHelpers,
  ])
    assert.equal(classifyChunk(id), 'site-shadcn-controls');
  assert.equal(
    classifyChunk('packages/adapters/base/src/host/instance-associations.ts'),
    undefined
  );
});
test('all additionally reviewed WC helpers are statically owned by the actual public entry', () => {
  const seen = new Set();
  const queue = ['packages/adapters/web-component/src/index.ts'];
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    const file = path.join(repositoryRoot, id);
    const source = ts.createSourceFile(
      id,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true
    );
    for (const node of source.statements) {
      if (
        !(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) ||
        !node.moduleSpecifier ||
        !ts.isStringLiteral(node.moduleSpecifier)
      )
        continue;
      if (node.isTypeOnly || (ts.isImportDeclaration(node) && node.importClause?.isTypeOnly))
        continue;
      const specifier = node.moduleSpecifier.text;
      let target;
      if (specifier.startsWith('.')) target = path.resolve(path.dirname(file), specifier);
      else if (specifier === '@proto.ui/adapter-base')
        target = path.join(repositoryRoot, 'packages/adapters/base/src/index');
      else continue;
      const resolved = [`${target}.ts`, path.join(target, 'index.ts')].find((candidate) =>
        fs.existsSync(candidate)
      );
      if (resolved) queue.push(path.relative(repositoryRoot, resolved));
    }
  }
  for (const id of reviewedWcHelpers)
    assert.ok(seen.has(id), `Missing actual public Adapter ownership: ${id}`);
});

for (const source of [
  'apps/www/src/components/snapshot-prototype-style.ts',
  'apps/www/src/components/site-startup-paint.ts',
  'packages/cli/src/services/proto-style-css.ts',
]) {
  for (const dynamic of [false, true]) {
    for (const [form, moduleId] of [
      ['plain', source],
      ['query', `${source}?used`],
      ['windows', source.replaceAll('/', '\\')],
      ['windows-query', `${source.replaceAll('/', '\\')}?used`],
    ]) {
      test(`startup prerender stays server-only: ${source} dynamic=${dynamic} ${form}`, () => {
        const graph = graphFixture();
        graph.chunks.push(
          chunk('_astro/prerender-leak.js', {
            isEntry: !dynamic,
            isDynamicEntry: dynamic,
            moduleIds: [moduleId],
          })
        );
        assert.ok(
          collectWebsiteProductionBundleIssues({ graph }).some(
            (issue) => issue.includes('server-only prerender module') && issue.includes(moduleId)
          )
        );
      });
    }
  }
}

// A new private route is an exact entry, never a directory-wide shell exemption.
test('Liquid Card producer requires its exact route facade and stays outside ordinary shells', () => {
  const good = graphFixture();
  assert.deepEqual(collectWebsiteProductionBundleIssues({ graph: good }), []);
  const missing = structuredClone(good);
  missing.chunks = missing.chunks.filter(
    (chunk) => chunk.fileName !== '_astro/liquid-library-card.js'
  );
  assert.ok(
    collectWebsiteProductionBundleIssues({ graph: missing }).some((issue) =>
      issue.includes('liquid-library-card.astro')
    )
  );
  const renamed = structuredClone(good);
  renamed.chunks.find(
    (chunk) => chunk.fileName === '_astro/liquid-library-card.js'
  ).facadeModuleId =
    'apps/www/src/pages/[locale]/test/foreign-card.astro?astro&type=script&index=0&lang.ts';
  assert.ok(collectWebsiteProductionBundleIssues({ graph: renamed }).length > 0);
  const missingOwner = structuredClone(good);
  missingOwner.chunks.find(
    (chunk) => chunk.fileName === '_astro/liquid-library-card.js'
  ).moduleIds = [];
  assert.ok(
    collectWebsiteProductionBundleIssues({ graph: missingOwner }).some((issue) =>
      issue.includes('exact client')
    )
  );
  const foreignRuntime = structuredClone(good);
  foreignRuntime.chunks.find(
    (chunk) => chunk.fileName === '_astro/liquid-library-card.js'
  ).dynamicImports = ['_astro/react.js'];
  assert.ok(
    collectWebsiteProductionBundleIssues({ graph: foreignRuntime }).some((issue) =>
      issue.includes('only WC')
    )
  );
});
