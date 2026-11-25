// Exact static import edges in the browser AST compiler's source and type graph.
// The React emitter calls a pure Core semantic-token helper at compile time;
// generated components import only React. Core declaration edges retain their
// existing exact review. Deleted legacy source emitters grant no admission.
// Every edge binds its full source bytes and the reviewed compiler panel body.
// No path prefix, import category, surrounding UI or other target is exempted.
const BROWSER_COMPILER_OWNER = Object.freeze({
  path: 'apps/www/src/components/PrototypePreviewer/browser-compiler-panel.ts',
  sha256: '89f222e764fa8f535bc554a533ebb9519de55a764a695ff823867ba03bcec7d9',
});

export const BROWSER_COMPILER_IMPORT_ALLOWLIST = Object.freeze({
  'packages/compiler/src/targets/react.ts': Object.freeze({
    sourceSha256: 'd2e8ad3a197007646cfb1d18eaaf5483ce29bf4bd7acaeb94043399770f8d12f',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['@proto.ui/core']),
  }),
  'packages/core/src/control-label.ts': Object.freeze({
    sourceSha256: '5ef3f317bdadf74070622efc1ea7dbaa0a1aa3079b7f9ea669468c05c6c4a8c6',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['./anatomy', './handles']),
  }),
  'packages/core/src/handles.ts': Object.freeze({
    sourceSha256: '25b7d940e4fbe8c12d9ae1f244c0346cc9a1adfc06af05c7cbcc8e53c8ef1032',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze([
      './anatomy',
      './material',
      './material-paint-reservation',
      './presence-presentation',
      './resident-motion',
      './shader-presentation',
      './spec',
      './state',
    ]),
  }),
  // Opaque declaration types only; the compiler owner gains no physical host.
  'packages/core/src/material-paint-reservation.ts': Object.freeze({
    sourceSha256: '288d506b2df7d30f54ccac480a70136533abfa037475072e46ce7080af20d95e',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['./anatomy']),
  }),
  'packages/core/src/internal.ts': Object.freeze({
    sourceSha256: '2b16d692f539b0addc652c8fb9cc03b51064d3eba8424fbf836161b289a9eda7',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze([
      './handles',
      './prototype',
      './spec/feedback/application-role',
      './spec/feedback/root-effect',
    ]),
  }),
  'packages/core/src/presence-presentation.ts': Object.freeze({
    sourceSha256: 'edb67aa4b338842825d2640db1b1754f79e692596ea7ec15885a38153f5fc473',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['./handles', './state']),
  }),
  'packages/core/src/prototype.ts': Object.freeze({
    sourceSha256: 'a947c979836fcd7c4bece4bc27d614de3d541ea09826f70e908bd45de58e10bc',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['./handles', './internal', './spec', './state']),
  }),
  'packages/core/src/spec/feedback/application-role.ts': Object.freeze({
    sourceSha256: '2f95669717b5b7e5521cfdd8eb0711f2615f2afeb001b62b8b6fea993a548cab',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['./placeholder']),
  }),
  'packages/core/src/spec/feedback/index.ts': Object.freeze({
    sourceSha256: '5615a1d8614eafa79cd3c245317d433208f81262bc2bf19d153e460f5d1105a3',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['./recorder', './semantic-merge', './style', './tokens']),
  }),
  'packages/core/src/spec/feedback/recorder.ts': Object.freeze({
    sourceSha256: 'd0622791924858f06da45c936bf847752ab1451a2adf2f9539cafef4f8229edb',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['./root-effect', './semantic-merge', './style', './tokens']),
  }),
  'packages/core/src/spec/feedback/root-effect.ts': Object.freeze({
    sourceSha256: '38c07aca4122c82f2cb0ac5dac470e52c784a1f2553d99f036a5684d5601cdbb',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['./application-role', './semantic-merge', './style', './tokens']),
  }),
  'packages/core/src/spec/feedback/semantic-merge.ts': Object.freeze({
    sourceSha256: '85d3221a8c55b985aa416771658c4b0594d181b62028d021d93e809eca54de58',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['./placeholder']),
  }),
  'packages/core/src/spec/feedback/tokens.ts': Object.freeze({
    sourceSha256: '250e9fba631156de890dac800447ac636b3c1d07eb66b0052a6d76f05cfe7db3',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['./placeholder']),
  }),
  'packages/core/src/spec/index.ts': Object.freeze({
    sourceSha256: '24f03a4f1c9ea9b526a2defa35239fc920e34d2b48e41c106f409f1167694bb3',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['./feedback', './owned-template-blueprint', './template']),
  }),
  'packages/core/src/spec/owned-template-blueprint.ts': Object.freeze({
    sourceSha256: 'fcfe513cdb1a6533c164fdedc25ae3e085d97f209953c149e8c867df899cb3b2',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze([
      '../material-paint-reservation',
      './feedback/style',
      './svg-tags',
      './template',
    ]),
  }),
  'packages/core/src/spec/svg-tags.ts': Object.freeze({
    sourceSha256: '816196bcb9d6899d9185a4dfd11ebe07398a7717afccdb9b5e56e46f95e30bf0',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['./template']),
  }),
  'packages/core/src/spec/template.ts': Object.freeze({
    sourceSha256: '6e63757bad33a6b6a23ea94b95fb34b44e5a4f78d97aca8d8938d9089bb42c6f',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze([
      '../handles',
      '../material-paint-reservation',
      '../prototype',
      './feedback/style',
      './svg-tags',
    ]),
  }),
  'packages/core/src/state.ts': Object.freeze({
    sourceSha256: '234bd9923e31a60d9872c46fda137b49d63de9e9df1dca6225ed28ebee53978f',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['./handles']),
  }),
});

// These two already-inventoried Worker lifecycle files have an exact source-scan
// owner. This admits neither adjacent compiler files nor the panel's blocked UI.
export const BROWSER_COMPILER_INTERACTIVE_SOURCES = Object.freeze({
  'packages/compiler/src/browser/client.ts':
    '593fa1f10d257ee49550f9e2d7f9848b0fc17024e3397e6c3ae917031c8befa8',
  'packages/compiler/src/browser/worker.ts':
    '9cab00c603d841645f5c3819edb5a8d9328b17e2f727a128336eecbc478256ca',
});

// Three finite executable edges of the native React browser compiler. The
// first constructs the SHA-verified bundle in one Blob Worker. The preview
// admits only its fixed import-map names and one generated module. Expected
// compiler/target identities come from the bound build producers and caller,
// never an unreviewed category or a user-supplied arbitrary module URL.
export const BROWSER_COMPILER_EXECUTION_BOUNDARIES = Object.freeze([
  {
    'source': {
      'path': 'packages/compiler/src/browser/client.ts',
      'sha256': '593fa1f10d257ee49550f9e2d7f9848b0fc17024e3397e6c3ae917031c8befa8',
    },
    'specifier': '<unresolved Worker entry>',
    'category': 'unresolved-worker-entry',
    'site': "new Worker(url!, { name: 'proto-ui-compiler' })",
    'companions': [
      {
        'path': 'apps/www/src/components/PrototypePreviewer/browser-compiler-panel.ts',
        'sha256': '89f222e764fa8f535bc554a533ebb9519de55a764a695ff823867ba03bcec7d9',
      },
      {
        'path': 'packages/compiler/src/browser/worker.ts',
        'sha256': '9cab00c603d841645f5c3819edb5a8d9328b17e2f727a128336eecbc478256ca',
      },
      {
        'path': 'packages/compiler/src/browser/hash.ts',
        'sha256': '2b9f88aa16e1397ca628ec011eaf9956bb46b2e5106c6b8d6fbf9c59389e2be5',
      },
      {
        'path': 'scripts/compiler/build-browser.mjs',
        'sha256': '64b20eafc92acd144e5136ce1f1ad0fc0f56bfe5bcd76ae6537b2769b58546e1',
      },
    ],
  },
  {
    'specifier': '<dynamic executable script src>',
    'category': 'dynamic-executable-script',
    'site': 'map.textContent = JSON.stringify({ imports });',
    'source': {
      'path': 'apps/www/src/components/PrototypePreviewer/compiled-preview-runtime.ts',
      'sha256': '6c0d536f39f1a13218f8ea6f88e59836453a04f139141188a304425696f8a652',
    },
    'companions': [
      {
        'path': 'apps/www/src/components/PrototypePreviewer/browser-compiler-panel.ts',
        'sha256': '89f222e764fa8f535bc554a533ebb9519de55a764a695ff823867ba03bcec7d9',
      },
      {
        'path': 'packages/compiler/src/browser/engine.ts',
        'sha256': 'f49d8f8f0306ea80a4c12f1bd14d779727d68dca9376b9ce8358ea4cdd3ccf7b',
      },
      {
        'path': 'packages/compiler/src/browser/protocol.ts',
        'sha256': 'a7e8621b978463695e83d5ece75c3bcbadf4d4265492b6b6eb322641077789e0',
      },
      {
        'path': 'scripts/compiler/browser-assets.ts',
        'sha256': 'de92b71cb8946c36df16e8c1cfd7fe637fadad75938dc734ed1357930c3c393f',
      },
      {
        'path': 'apps/www/src/components/PrototypePreviewer/compiled-preview-sandbox.ts',
        'sha256': 'fc47db5c3ba74cd82a4f98df0f150713ff72689fef685a6ae492d1431c7f2c0a',
      },
    ],
  },
  {
    'specifier': 'pui:compiled/component',
    'category': 'external-executable-script',
    'site': "import('pui:compiled/component')",
    'source': {
      'path': 'apps/www/src/components/PrototypePreviewer/compiled-preview-runtime.ts',
      'sha256': '6c0d536f39f1a13218f8ea6f88e59836453a04f139141188a304425696f8a652',
    },
    'companions': [
      {
        'path': 'apps/www/src/components/PrototypePreviewer/browser-compiler-panel.ts',
        'sha256': '89f222e764fa8f535bc554a533ebb9519de55a764a695ff823867ba03bcec7d9',
      },
      {
        'path': 'packages/compiler/src/browser/engine.ts',
        'sha256': 'f49d8f8f0306ea80a4c12f1bd14d779727d68dca9376b9ce8358ea4cdd3ccf7b',
      },
      {
        'path': 'packages/compiler/src/browser/protocol.ts',
        'sha256': 'a7e8621b978463695e83d5ece75c3bcbadf4d4265492b6b6eb322641077789e0',
      },
      {
        'path': 'scripts/compiler/browser-assets.ts',
        'sha256': 'de92b71cb8946c36df16e8c1cfd7fe637fadad75938dc734ed1357930c3c393f',
      },
      {
        'path': 'apps/www/src/components/PrototypePreviewer/compiled-preview-sandbox.ts',
        'sha256': 'fc47db5c3ba74cd82a4f98df0f150713ff72689fef685a6ae492d1431c7f2c0a',
      },
    ],
  },
]);
