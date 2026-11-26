// Exact static import edges reached by the optional browser compiler's source
// and type graph. This includes Core declarations and native source emitters;
// it is not a claim that a browser preview hosts GPUI/Qt/Flutter components.
// Every entry binds its full source and the reviewed browser compiler owner.
// No path prefixes, import categories or surrounding UI exemptions are admitted.
// Current-main renewal binds eleven changed importer bodies. Their exact
// import strings and reviewed browser compiler companion remain unchanged.
// See internal/records/2026-11-23-seven-sprint-website-source-inventory.md.
// Owner review renewal 2026-11-24: the reviewed owner body now retires its
// compiler session asynchronously before a new Worker or session starts. The
// renewal changes no importer, specifier or import edge.
// Import-edge review renewal 2026-11-24: seven changed importer bodies are
// re-pinned to their reviewed bytes, and the new Core SVG tag schema module
// is recorded with its single Core edge. Every added edge stays inside the
// reviewed compiler and Core source graph. No new website consumer, path
// prefix or import category is admitted.
// Main 248f8270d reconciliation is backed by recovered previous bodies and
// complete diffs in internal/records/2026-11-24-main-website-boundary-repair.json.
// The compiler owner's fingerprint and UI owner set are independent gates.
const BROWSER_COMPILER_OWNER = Object.freeze({
  path: 'apps/www/src/components/PrototypePreviewer/browser-compiler-panel.ts',
  sha256: '13b9bbdffefe45434ce733f652d0600023651cc474d352daf26b9427710706c9',
});

export const BROWSER_COMPILER_IMPORT_ALLOWLIST = Object.freeze({
  'packages/compiler/src/core-value-types.ts': Object.freeze({
    sourceSha256: '94d2e70c10ab0b4f10536682ea2c42e971419a597ba0ea5034e90011382b65e4',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['../../core/src/control-label']),
  }),
  'packages/compiler/src/flutter-source.ts': Object.freeze({
    sourceSha256: 'c01bb42e8dd1becbd1ce5a565388a5420a4e88f13862e335aca98a77765d6ddd',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['../../core/src/spec/feedback/semantic-merge']),
  }),
  'packages/compiler/src/gpui-source.ts': Object.freeze({
    sourceSha256: '99f3d5fb720a685846b2deb32af5ab0ae54193a098be79ac1e5fb9cf96b34195',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['../../core/src/spec/feedback/semantic-merge']),
  }),
  'packages/compiler/src/ir-validation.ts': Object.freeze({
    sourceSha256: '5ac930b76ee1e7275ff39950fd4639f7351e5f8672479a0efe7d632b814c4b09',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['../../core/src/spec/feedback/tokens']),
  }),
  'packages/compiler/src/native-async.ts': Object.freeze({
    sourceSha256: '3aacca4fef0ba3c6e3eff973c2fe29e46e704014f1d81bf674302719343a11bf',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['../../core/src/shader-presentation']),
  }),
  'packages/compiler/src/native-shader-specialization.ts': Object.freeze({
    sourceSha256: '22a5a5b43fcccd6e13533e22f21e3d50e606d11a78f5930a4082a18e5c4dbd38',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['../../core/src/shader-presentation']),
  }),
  'packages/compiler/src/native-shader.ts': Object.freeze({
    sourceSha256: '2504c8cafcbc1a99a4cedac3c230d52318d5b944eb2e4f031496544795a3490f',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['../../core/src/shader-presentation']),
  }),
  'packages/compiler/src/native-style.ts': Object.freeze({
    sourceSha256: '0e2f301a1109446b51954e05ab9a5d8dd376d109adb4ef03c16564b86799a007',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['../../core/src/spec/feedback/semantic-merge']),
  }),
  'packages/compiler/src/qt-native-style.ts': Object.freeze({
    sourceSha256: 'b030490ebb75ef806a58cbaa28e0cfaf42303d137f5f276f70855c2e00f486e0',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['../../core/src/spec/feedback/semantic-merge']),
  }),
  'packages/compiler/src/rule-declarations.ts': Object.freeze({
    sourceSha256: 'aab4b30c7f13f53d06d01a7d6b9c3d0ac0dfbf74d3d67a1d975fb944f0499a25',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze([
      '../../core/src/handles',
      '../../core/src/spec/feedback/style',
      '../../core/src/spec/feedback/tokens',
    ]),
  }),
  'packages/compiler/src/rule-plan.ts': Object.freeze({
    sourceSha256: 'b728641be54fc2a329a177c037a8f828ee55019de2e7e0500c1e71f36ec4540d',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze([
      '../../core/src/spec/feedback/semantic-merge',
      '../../core/src/spec/feedback/tokens',
    ]),
  }),
  'packages/compiler/src/shader-plan.ts': Object.freeze({
    sourceSha256: '625b890c12d1a1fcd2a96a3930ba0f2e0a7d241d442133c1ce60dda55250f0bd',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['../../core/src/shader-presentation']),
  }),
  'packages/compiler/src/static-declarations.ts': Object.freeze({
    sourceSha256: '304f4b27ac6b701547a8b4683ab70a230b5953f85a3de9a64efde989b429654f',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['../../core/src/control-label']),
  }),
  'packages/compiler/src/style-plan.ts': Object.freeze({
    sourceSha256: '1095f92194f6dd9cc573cb5958d7a519a0254fa2840355008da3edb4f7a6a1e9',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze([
      '../../core/src/spec/feedback/semantic-merge',
      '../../core/src/spec/feedback/tokens',
    ]),
  }),
  'packages/compiler/src/targets.ts': Object.freeze({
    // The 0.3.0 release stamp updates the six React runtime dependency and helper versions.
    sourceSha256: 'f4d2699fdfe005c9f1781250651f6f06bc4af3383750cf228ab219de9e849b15',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['../../core/src/shader-presentation']),
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
    sourceSha256: '0f0900c247310fd34d0d59028a2ac00f09e4ddf235e299a69378c23c1258d0d2',
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
    sourceSha256: '591004dd057dd4b8dcf3d6a6b10879c933b0de746f894d74ad4a9bdb2559f94d',
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
    'f6af8985c52edbfdbd0e1796fc680e0f54e3c889769d099459abe0f23bc58be7',
  'packages/compiler/src/browser/worker.ts':
    'd373263fa25d9f77fe22603b89523461d43a007cdc40e21f53b4a55f39036078',
});
