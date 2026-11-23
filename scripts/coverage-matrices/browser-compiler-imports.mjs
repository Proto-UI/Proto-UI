// Exact static import edges reached by the optional browser compiler's source
// and type graph. This includes Core declarations and native source emitters;
// it is not a claim that a browser preview hosts GPUI/Qt/Flutter components.
// Every entry binds its full source and the reviewed browser compiler owner.
// No path prefixes, import categories or surrounding UI exemptions are admitted.
// See internal/records/2026-11-23-seven-sprint-website-source-inventory.md.
const BROWSER_COMPILER_OWNER = Object.freeze({
  path: 'apps/www/src/components/PrototypePreviewer/browser-compiler-panel.ts',
  sha256: 'f734e78b8ec62770c3432c8ffdf002c258b1378ce88ea90fbf7bdb746f7f9112',
});

export const BROWSER_COMPILER_IMPORT_ALLOWLIST = Object.freeze({
  'packages/compiler/src/core-value-types.ts': Object.freeze({
    sourceSha256: 'f861c563d82b0f06bccc5c7550f6cf043d7c78d38655ef3c42a92283f1f9ecd4',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['../../core/src/control-label']),
  }),
  'packages/compiler/src/flutter-source.ts': Object.freeze({
    sourceSha256: 'd95212b29e54d052b5583096ad2b465ea8fd77d44cac93f548afd567a1205354',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['../../core/src/spec/feedback/semantic-merge']),
  }),
  'packages/compiler/src/gpui-source.ts': Object.freeze({
    sourceSha256: '290a26176c307f7b81bec4379daef5a22926b23d8e1831eefe2fe15331a1283f',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['../../core/src/spec/feedback/semantic-merge']),
  }),
  'packages/compiler/src/ir-validation.ts': Object.freeze({
    sourceSha256: '99a5f98e932938c4371bdb630f85c222f8eb4731673a385d56e93c4bfdeeef5e',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['../../core/src/spec/feedback/tokens']),
  }),
  'packages/compiler/src/native-async.ts': Object.freeze({
    sourceSha256: '50ca38b4e9148104fb3a2ffe515b6018db51587c0030a722b1c2821da455d8fe',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['../../core/src/shader-presentation']),
  }),
  'packages/compiler/src/native-shader-specialization.ts': Object.freeze({
    sourceSha256: 'ff4e13f7837e945cf8bf052ff283d1af24739c96cc3b6d813ee5dfa4fcf76705',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['../../core/src/shader-presentation']),
  }),
  'packages/compiler/src/native-shader.ts': Object.freeze({
    sourceSha256: '6229f87913d90e603d84b02afdbb8b9ce4c489df4b5d00c139336715efacb434',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['../../core/src/shader-presentation']),
  }),
  'packages/compiler/src/native-style.ts': Object.freeze({
    sourceSha256: 'd515ebc9c56a7311cd1448ece1158f1e454ac1db0284d10c28771e74f48dde26',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['../../core/src/spec/feedback/semantic-merge']),
  }),
  'packages/compiler/src/qt-native-style.ts': Object.freeze({
    sourceSha256: 'b030490ebb75ef806a58cbaa28e0cfaf42303d137f5f276f70855c2e00f486e0',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['../../core/src/spec/feedback/semantic-merge']),
  }),
  'packages/compiler/src/rule-declarations.ts': Object.freeze({
    sourceSha256: '20b3f5c12bcbbb22b57df8d89b82da1304d46affa4c01cf2bef3ebe2a2f0c9c9',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze([
      '../../core/src/handles',
      '../../core/src/spec/feedback/style',
      '../../core/src/spec/feedback/tokens',
    ]),
  }),
  'packages/compiler/src/rule-plan.ts': Object.freeze({
    sourceSha256: 'f4d0921ed90994017d979e43181594af71896de85ca2343fe23e44ed6075b3d5',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze([
      '../../core/src/spec/feedback/semantic-merge',
      '../../core/src/spec/feedback/tokens',
    ]),
  }),
  'packages/compiler/src/shader-plan.ts': Object.freeze({
    sourceSha256: 'f514d79fa3b549e3f65778e69f4144bf4233aea761c7e0fce810a9905d25fd17',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['../../core/src/shader-presentation']),
  }),
  'packages/compiler/src/static-declarations.ts': Object.freeze({
    sourceSha256: 'e76b738d2a9f27e00cac09679052b176e7611ee7e8e0150f410ab7000ac651f2',
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
    sourceSha256: '2fd07e809c8b740303e8ea7b23a119e6d529cbf79425d2ce526488ac0b475e58',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['../../core/src/shader-presentation']),
  }),
  'packages/core/src/control-label.ts': Object.freeze({
    sourceSha256: '5ef3f317bdadf74070622efc1ea7dbaa0a1aa3079b7f9ea669468c05c6c4a8c6',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['./anatomy', './handles']),
  }),
  'packages/core/src/handles.ts': Object.freeze({
    sourceSha256: 'da54a619755e23fee1c4d4ab9b23af130f75e78510b27a96125e356896f48f14',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze([
      './anatomy',
      './material',
      './presence-presentation',
      './resident-motion',
      './shader-presentation',
      './spec',
      './state',
    ]),
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
    sourceSha256: '8ff886ee4aa10048241308b4dda81998fd9c0f954eb247e884087ead3cf25398',
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
    sourceSha256: 'bf0308e95a26d83cdc730e2a3b0e29c9557da8eaa658de9a99ac9b27a2cb332b',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['./feedback/style', './template']),
  }),
  'packages/core/src/spec/template.ts': Object.freeze({
    sourceSha256: '4e2e9f13e9a273ad42140591bfa43d4bb0204578bdc40d95b596146bc34de7f4',
    companionSource: BROWSER_COMPILER_OWNER,
    specifiers: Object.freeze(['../handles', '../prototype', './feedback/style']),
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
