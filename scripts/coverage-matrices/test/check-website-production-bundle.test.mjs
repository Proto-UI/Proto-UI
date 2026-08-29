import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  collectWebsiteProductionBundleIssues,
  validateWebsiteProductionBundle,
} from '../check-website-production-bundle.mjs';

const HOME_DEMO_FACADE =
  'apps/www/src/components/PrototypePreviewer/HomeDemoPreviewer.astro?astro&type=script&index=0&lang.ts';
const PREVIEWER_FACADE =
  'apps/www/src/components/PrototypePreviewer/PrototypePreviewer.astro?astro&type=script&index=0&lang.ts';
const PREVIEWER_CLIENT_FACADE = 'apps/www/src/components/PrototypePreviewer/previewer-client.ts';

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

function graphFixture() {
  return {
    version: 1,
    chunks: [
      chunk('_astro/search.js', {
        isEntry: true,
        facadeModuleId:
          'apps/www/src/components/override/Search.astro?astro&type=script&index=0&lang.ts',
        moduleIds: ['apps/www/src/components/override/Search.astro'],
      }),
      chunk('_astro/home-demo.js', {
        isEntry: true,
        facadeModuleId: HOME_DEMO_FACADE,
        imports: ['_astro/wc-host.js', '_astro/react.js', '_astro/vue.js', '_astro/vue2.js'],
        moduleIds: ['apps/www/src/components/PrototypePreviewer/home-demo-client.ts'],
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
    shellRuntime: 'native/static',
    primaryDemonstrationHost: 'web-component',
    isolatedDemonstrationRuntimes: 3,
  });
});

test('rejects a graph without route-owned Web Component host provenance', () => {
  const graph = graphFixture();
  graph.chunks.find((candidate) => candidate.fileName === '_astro/home-demo.js').imports =
    graph.chunks
      .find((candidate) => candidate.fileName === '_astro/home-demo.js')
      .imports.filter((fileName) => fileName !== '_astro/wc-host.js');

  assert.ok(
    collectWebsiteProductionBundleIssues({ graph }).includes(
      'production bundle graph has no route-owned demonstration entry with static module-level evidence for both the reviewed Web Component facade registry and Web Component Adapter'
    )
  );
});

test('does not mistake an orphaned WC runtime for primary host provenance', () => {
  const graph = graphFixture();
  graph.chunks.find((candidate) => candidate.fileName === '_astro/home-demo.js').imports =
    graph.chunks
      .find((candidate) => candidate.fileName === '_astro/home-demo.js')
      .imports.filter((fileName) => fileName !== '_astro/wc-host.js');
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
    issues.includes(
      'forbidden framework chunk `_astro/innocent-helper.js` is not statically owned by an approved demonstration entry'
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

test('allows the reviewed site Shadcn Web Component adapter in an approved shell closure', () => {
  const graph = graphFixture();
  graph.chunks[0].moduleIds.push('apps/www/src/components/site-shadcn-controls.ts');
  graph.chunks[0].imports.push('_astro/site-shadcn-controls.js');
  graph.chunks.push(
    chunk('_astro/site-shadcn-controls.js', {
      moduleIds: [
        'apps/www/src/components/site-shadcn-controls.ts',
        'packages/adapters/web-component/src/adapt.ts?used',
      ],
    })
  );

  assert.deepEqual(collectWebsiteProductionBundleIssues({ graph }), []);
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
  graph.chunks.push(
    chunk('_astro/previewer-client.js', {
      isDynamicEntry: true,
      facadeModuleId: PREVIEWER_CLIENT_FACADE,
      imports: ['_astro/react.js'],
      moduleIds: ['apps/www/src/components/PrototypePreviewer/previewer-client.ts'],
    })
  );

  assert.ok(
    collectWebsiteProductionBundleIssues({ graph }).includes(
      `approved demonstration entry \`${PREVIEWER_CLIENT_FACADE}\` is orphaned from shell or route-owned entry reachability`
    )
  );
});

test('accepts a dynamic demonstration entry reached from an explicit route-owned demo', () => {
  const graph = graphFixture();
  graph.chunks.push(
    chunk('_astro/previewer.js', {
      isEntry: true,
      facadeModuleId: PREVIEWER_FACADE,
      dynamicImports: ['_astro/previewer-client.js'],
      moduleIds: ['apps/www/src/components/PrototypePreviewer/PrototypePreviewer.astro'],
    }),
    chunk('_astro/previewer-client.js', {
      isDynamicEntry: true,
      facadeModuleId: PREVIEWER_CLIENT_FACADE,
      imports: ['_astro/react.js', '_astro/vue.js', '_astro/vue2.js'],
      moduleIds: ['apps/www/src/components/PrototypePreviewer/previewer-client.ts'],
    })
  );

  assert.deepEqual(collectWebsiteProductionBundleIssues({ graph }), []);
});
