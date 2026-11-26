// Reviewed build-time Runtime/style dependency closure for the bounded startup
// snapshot registry. Exact source bytes AND exact import strings are required.
// This does not authorize adjacent modules, foreign consumers, dynamic CSS,
// extra capabilities, browser controllers, or stable Prototype admission.
// Owner: www.build.style-generation; consumers stay in their blocked rows.
// 2026-11-24 reconciliation: recovered prior bytes and reviewed the finite
// Feedback/Runtime deltas at main 248f8270d. See the source-review record at
// internal/records/2026-11-24-main-website-boundary-repair.json.
export const STARTUP_PRERENDER_IMPORT_ALLOWLIST = Object.freeze({
  'apps/www/src/components/site-startup-paint.ts': Object.freeze({
    sourceSha256: '714685626c3aae0ac056e2732d3d518206ecd70d0e9d26f3d3a35dcc3bbb7c36',
    specifiers: Object.freeze([
      '@proto.ui/prototypes-bootstrap-2-3-2/button',
      '@proto.ui/prototypes-bootstrap-2-3-2/surface',
      '@proto.ui/prototypes-brutalist/button',
      '@proto.ui/prototypes-brutalist/surface',
      '@proto.ui/prototypes-shadcn/button',
      '@proto.ui/prototypes-shadcn/surface',
    ]),
  }),
  'apps/www/src/components/snapshot-prototype-style.ts': Object.freeze({
    sourceSha256: 'e75d13528751e109f129fbb10a0cc5b53ee17c8817a87434acd58b6e5703a83e',
    specifiers: Object.freeze([
      '../../../../packages/modules/as-trigger/src',
      '../../../../packages/modules/context/src',
      '../../../../packages/modules/event/src',
      '../../../../packages/modules/feedback/src',
      '../../../../packages/modules/rule-meta/src',
      '../../../../packages/runtime/src',
      '@proto.ui/core',
    ]),
  }),
  'packages/modules/as-trigger/src/caps.ts': Object.freeze({
    sourceSha256: 'ee382c6c18df35aa1e072127d1b678edbbb2d53639705275d454a56d52f1374d',
    specifiers: Object.freeze(['@proto.ui/core']),
  }),
  'packages/modules/as-trigger/src/create.ts': Object.freeze({
    sourceSha256: '3e53f07a0537a57d7e8c61bfcd4dcfb86d1cfcbc568ed4fcc44b6173f9b14506',
    specifiers: Object.freeze([
      './impl',
      './types',
      '@proto.ui/module-base',
      '@proto.ui/module-event',
    ]),
  }),
  'packages/modules/as-trigger/src/impl.ts': Object.freeze({
    sourceSha256: 'd51d08bbd493ad9c79f65474ba19e5a9d63065104e0b8a6ad8982c3e339a1a3f',
    specifiers: Object.freeze([
      './caps',
      '@proto.ui/core',
      '@proto.ui/module-base',
      '@proto.ui/module-event',
    ]),
  }),
  'packages/modules/as-trigger/src/index.ts': Object.freeze({
    sourceSha256: '211372846fcfeb3dff2ae0801dadfec2022b04021470714f5bc4fbf5b47d2692',
    specifiers: Object.freeze(['./caps', './create', './types']),
  }),
  'packages/modules/as-trigger/src/types.ts': Object.freeze({
    sourceSha256: '7fbe5abc9f5e15ac2ec899509669de03e391a11a1ba1358e4230e4dc997fb512',
    specifiers: Object.freeze(['@proto.ui/core']),
  }),
  'packages/modules/context/src/caps.ts': Object.freeze({
    sourceSha256: '8b66595545138f7b62ad4067943deebe2dc70bf678d86e5ebf2faec89a3d37f6',
    specifiers: Object.freeze(['@proto.ui/core']),
  }),
  'packages/modules/context/src/center.ts': Object.freeze({
    sourceSha256: 'a575fd7e9e6b55cd9edc6f0cf1445e125d282dab04940f3890ec38593cde4a42',
    specifiers: Object.freeze(['./caps', './types']),
  }),
  'packages/modules/context/src/create.ts': Object.freeze({
    sourceSha256: '4320f9fe60635efa72a792f019395427a7f9062a81ab06c71f09554b67907d96',
    specifiers: Object.freeze(['./impl', './types', '@proto.ui/module-base']),
  }),
  'packages/modules/context/src/impl.ts': Object.freeze({
    sourceSha256: '8c44abb7f4579e84c3931375ea0d8db15bef8965166de5ad3a2f5181e3ca0e4c',
    specifiers: Object.freeze([
      './caps',
      './center',
      './types',
      '@proto.ui/core',
      '@proto.ui/module-base',
    ]),
  }),
  'packages/modules/context/src/index.ts': Object.freeze({
    sourceSha256: 'db974e7a2f288a9f64450ba4a64c297f2c62b3e13959a49c80f85ed53295073b',
    specifiers: Object.freeze(['./caps', './create', './types']),
  }),
  'packages/modules/context/src/types.ts': Object.freeze({
    sourceSha256: '5d21011af103f05a1c35e58f064781ec7fe00078036f581169180ee4ddaae065',
    specifiers: Object.freeze(['./caps', '@proto.ui/core']),
  }),
  'packages/modules/event/src/caps.ts': Object.freeze({
    sourceSha256: 'ad4562557b557f8083a5e543c670a2815a9a7e8fa43ff694453708a4498dc95a',
    specifiers: Object.freeze(['@proto.ui/core', '@proto.ui/module-expose-event']),
  }),
  'packages/modules/event/src/create.ts': Object.freeze({
    sourceSha256: 'dfe7d953c9763325d4581f7edba433a48a17ef795be465b935c5d903b15edccd',
    specifiers: Object.freeze(['./impl', './types', '@proto.ui/module-base']),
  }),
  'packages/modules/event/src/impl.ts': Object.freeze({
    sourceSha256: '84fc4386e0cb897554179824f31c0f7b212e5603af5ec3f9642385224850d28c',
    specifiers: Object.freeze([
      './caps',
      './error',
      './kernel',
      './types',
      '@proto.ui/core',
      '@proto.ui/module-base',
    ]),
  }),
  'packages/modules/event/src/index.ts': Object.freeze({
    sourceSha256: 'a61f750766ae01f8176c61acc62b9cf04a9f0821c15eb0fb121b4934ebec132c',
    specifiers: Object.freeze(['./caps', './create', './error', './types']),
  }),
  'packages/modules/event/src/kernel.ts': Object.freeze({
    sourceSha256: 'f83c6f2673a9004604357a1516e0a8f2ed484f941dca82f730218eefec8b808b',
    specifiers: Object.freeze(['./types']),
  }),
  'packages/modules/event/src/types.ts': Object.freeze({
    sourceSha256: 'd62695f83cd5b7233a77fc8445fa0ffd871cab719b85b9d0196422eab909493e',
    specifiers: Object.freeze(['@proto.ui/core', '@proto.ui/module-expose-event']),
  }),
  'packages/modules/feedback/src/caps.ts': Object.freeze({
    sourceSha256: 'd799cf851eadf7fbf0568adaaf1cf3338edad9bfe84dcf622b1ab7746ebdc7c2',
    specifiers: Object.freeze(['@proto.ui/core']),
  }),
  // The build-time style snapshot uses this exact Feedback implementation.
  'packages/modules/feedback/src/create.ts': Object.freeze({
    sourceSha256: 'c017de5f25e061655cf497eac65d1ea0b8c7cdaaba7e8923bbdcc9a371ec49e0',
    specifiers: Object.freeze([
      './caps',
      './material/declaration-id',
      './material/final-style-sink',
      './material/paint-reservation',
      './material/runtime-cap',
      './material/shared-sink',
      './motion/numeric-sources',
      './motion/sink',
      './presence/controller',
      './presence/sink',
      './shader/sink',
      './style/owned-decoration-cap',
      './style/owned-decoration-registry',
      './types',
      '@proto.ui/core',
      '@proto.ui/module-anatomy',
      '@proto.ui/module-base',
      '@proto.ui/module-state',
    ]),
  }),
  'packages/modules/feedback/src/index.ts': Object.freeze({
    sourceSha256: '7f53f752e2f67a1e2eaacaffcb66c09fb570799d5183cd58debd6bed73304ae8',
    specifiers: Object.freeze([
      './caps',
      './create',
      './material/deferred-view-sink',
      './material/paint-reservation',
      './material/shared-sink',
      './motion/color',
      './motion/projector',
      './motion/sampler',
      './motion/sink',
      './motion/targets',
      './presence/projector',
      './presence/sink',
      './shader/sink',
      './style/owned-decoration-cap',
      './types',
    ]),
  }),
  'packages/modules/feedback/src/material/deferred-view-sink.ts': Object.freeze({
    sourceSha256: '62783dde17a56d2c15aa6ef48ec81ee7c877b2bd88cf5a3118bf8bac89cb1a30',
    specifiers: Object.freeze(['./shared-sink']),
  }),
  'packages/modules/feedback/src/material/final-style-sink.ts': Object.freeze({
    sourceSha256: 'e9002c58cce0166af9d819985a93295686c130bfec0ab4bff2182a305c863fbd',
    specifiers: Object.freeze(['./owned-slot', '@proto.ui/core', '@proto.ui/core/internal']),
  }),
  'packages/modules/feedback/src/material/owned-slot.ts': Object.freeze({
    sourceSha256: 'f274a962f3fdfa15af2515c81274068d5fdeddc13f4fd2f2b1cd68473c00911b',
    specifiers: Object.freeze(['./declaration-id', '@proto.ui/core', '@proto.ui/module-base']),
  }),
  // Instance-owned Anatomy association only; no global family or DOM lookup.
  'packages/modules/feedback/src/material/paint-reservation.ts': Object.freeze({
    sourceSha256: '80ddbe82bafed66ccce9dfb78b3a250836a5b5a57855aaaa6a68e80af9daaf92',
    specifiers: Object.freeze(['@proto.ui/core', '@proto.ui/module-anatomy']),
  }),
  'packages/modules/feedback/src/material/runtime-cap.ts': Object.freeze({
    sourceSha256: 'd1b699a04108672de6624bffcb8c4d23316e688312fe094f293764aafb96b5c4',
    specifiers: Object.freeze(['./owned-slot', '@proto.ui/core', '@proto.ui/module-base']),
  }),
  'packages/modules/feedback/src/material/shared-sink.ts': Object.freeze({
    sourceSha256: 'd1e4e725533e41f9d30209e2a0c86f32f88b09314b2c4e8008419aa9b4ca134b',
    specifiers: Object.freeze(['./final-style-sink', '@proto.ui/core']),
  }),
  // Numeric sources retain registered state identity and exact semantic keys.
  'packages/modules/feedback/src/motion/numeric-sources.ts': Object.freeze({
    sourceSha256: '8377945b473d29ed2dca61fb739370a047561a9a6062fa0188d38ffbe0809cdf',
    specifiers: Object.freeze(['./targets', '@proto.ui/core', '@proto.ui/module-state']),
  }),
  'packages/modules/feedback/src/motion/projector.ts': Object.freeze({
    sourceSha256: '2408989649ea882ad3ff9ba735e88839798312eaaf66e6ed96d5d36459702359',
    specifiers: Object.freeze([
      './color',
      './sampler',
      './sink',
      './targets',
      '@proto.ui/core',
      '@proto.ui/core/internal',
    ]),
  }),
  'packages/modules/feedback/src/motion/sampler.ts': Object.freeze({
    sourceSha256: 'df9a89d4849580aa854b850b2eb837198dd891a5459ca476069c13233b0bfc24',
    specifiers: Object.freeze(['@proto.ui/core']),
  }),
  'packages/modules/feedback/src/motion/sink.ts': Object.freeze({
    sourceSha256: '348bd4660089361305c26628b3b3f0489e977ffdd5dc4755e673e1c7074e37b8',
    specifiers: Object.freeze(['@proto.ui/core']),
  }),
  'packages/modules/feedback/src/motion/targets.ts': Object.freeze({
    sourceSha256: 'a43c7ab5a0ea83f6497884dd595de0931ca7b8c8a6691fc6385a627b4bcd2ea2',
    specifiers: Object.freeze(['@proto.ui/core']),
  }),
  'packages/modules/feedback/src/presence/controller.ts': Object.freeze({
    sourceSha256: '6b0a20182e495e2113f13aa21d74a4bcb7ef7ea358044241d7c4d20f66072ab1',
    specifiers: Object.freeze(['./sink', '@proto.ui/core']),
  }),
  'packages/modules/feedback/src/presence/projector.ts': Object.freeze({
    sourceSha256: 'd9a0ccfd12053e193e2c0a2ff0cd8a435a083c23aa04ae466ae28625ead2b2a4',
    specifiers: Object.freeze(['./sampler', './sink', './top-target', '@proto.ui/core']),
  }),
  // The projector's finite per-channel sampler and typed semantic baseline.
  'packages/modules/feedback/src/presence/sampler.ts': Object.freeze({
    sourceSha256: '180dff0c4c9df44567037abf2c1d5544bd510c76198644a9f96b1ba5c6c2b561',
    specifiers: Object.freeze(['../motion/sampler', './sink', '@proto.ui/core']),
  }),
  'packages/modules/feedback/src/presence/sink.ts': Object.freeze({
    sourceSha256: '90a4fe14536cd8c5708a19fa5a87843f35597391be7381b3d68239e36a2ce053',
    specifiers: Object.freeze(['@proto.ui/core']),
  }),
  'packages/modules/feedback/src/presence/top-target.ts': Object.freeze({
    sourceSha256: '692ade0587b30a71d4348d350881ef4e8eb8ee04c89134f032f8d7961de3993f',
    specifiers: Object.freeze(['@proto.ui/core']),
  }),
  // Token/frame declarations only; the build-time style owner installs no GPU host.
  'packages/modules/feedback/src/shader/sink.ts': Object.freeze({
    sourceSha256: '140bd9adb239d3b1da1fb27296d74b2b8d8a7831ddaf724477c15051d40dc4cb',
    specifiers: Object.freeze(['../material/final-style-sink', '@proto.ui/core']),
  }),
  'packages/modules/feedback/src/style/owned-decoration-cap.ts': Object.freeze({
    sourceSha256: '08ade8287b973f8e3f4f1456c4c3320aff523751d8fe08fe83b152174403cc93',
    specifiers: Object.freeze(['@proto.ui/core']),
  }),
  'packages/modules/feedback/src/style/owned-decoration-registry.ts': Object.freeze({
    sourceSha256: '2d20664473d59e002bd3b8383551d876f0ffc987063b5ab325aab3eee59f3d67',
    specifiers: Object.freeze(['@proto.ui/core']),
  }),
  'packages/modules/feedback/src/types.ts': Object.freeze({
    sourceSha256: '206f99186501ec20175be19041a1783f45294ee7398983444cd19efbf7f5dafe',
    specifiers: Object.freeze(['@proto.ui/core']),
  }),
  'packages/modules/rule-meta/src/caps.ts': Object.freeze({
    sourceSha256: '7ecec29ad71a7950beb7541e37663658d61896beec60667459071d63f5067e2c',
    specifiers: Object.freeze(['@proto.ui/core']),
  }),
  'packages/modules/rule-meta/src/create.ts': Object.freeze({
    sourceSha256: '633880a0f819cd108100199d8aefdca6397b2a0bfae4d3b49c9ae863e4207a7c',
    specifiers: Object.freeze([
      './caps',
      './keyed-lease',
      './types',
      '@proto.ui/core',
      '@proto.ui/module-base',
      '@proto.ui/module-rule',
    ]),
  }),
  'packages/modules/rule-meta/src/index.ts': Object.freeze({
    sourceSha256: 'cdfe80728758c31636d5bc79d50b7313e371d77b107e455104b6fa842fa54584',
    specifiers: Object.freeze(['./caps', './create', './types']),
  }),
  'packages/modules/rule-meta/src/keyed-lease.ts': Object.freeze({
    sourceSha256: '523668e8ff5ded706747dc8008d23bb6aadbffcff4f3f942f2bc186935186544',
    specifiers: Object.freeze(['./caps']),
  }),
  'packages/modules/rule-meta/src/types.ts': Object.freeze({
    sourceSha256: '69c5a8cc4f4d9f126ae0f7f6dc288fa53d2d5bcda4132b964a3b247ef528b410',
    specifiers: Object.freeze(['@proto.ui/core']),
  }),
  'packages/runtime/src/index.ts': Object.freeze({
    sourceSha256: 'ad2935929a1d467d78e03c367a67758fc2b421565892b98094b3076c47fa9e19',
    specifiers: Object.freeze(['./instance', './kernel', './orchestrator']),
  }),
  'packages/runtime/src/instance/execute/callback-scope.ts': Object.freeze({
    sourceSha256: 'aee82651cc5b2d773ab6260b7ccc081d09927e4a5aaec8d30fed135a35605c77',
    specifiers: Object.freeze([
      '../../orchestrator/module-orchestrator',
      '@proto.ui/core',
      '@proto.ui/core/internal',
      '@proto.ui/module-base',
      '@proto.ui/module-props',
    ]),
  }),
  'packages/runtime/src/instance/execute/index.ts': Object.freeze({
    sourceSha256: 'e35ce91a8e54cec527f41a4e8437786bcb2ac09bc500619efc7bbf15f1e70045',
    specifiers: Object.freeze(['./prototype', './types', './with-host']),
  }),
  'packages/runtime/src/instance/execute/prototype.ts': Object.freeze({
    sourceSha256: 'bb1513f8ecb6df6cb81998c262d3007f712c52146ac2d9a083563ec18b2bafc2',
    specifiers: Object.freeze(['../instance', './types', '@proto.ui/core']),
  }),
  'packages/runtime/src/instance/execute/types.ts': Object.freeze({
    sourceSha256: '1555687b46e2b9ae8bec0535bd08da2a84bc1d347f3f61f90f0da1e7e85f52e0',
    specifiers: Object.freeze([
      '../../kernel',
      '../../kernel/handles/def',
      '../../orchestrator/module-orchestrator',
      '../session',
      '@proto.ui/core',
    ]),
  }),
  'packages/runtime/src/instance/execute/with-host.ts': Object.freeze({
    sourceSha256: 'bab51f974ff50e0d4320561bcfc7a6390439fe365694b1bb6bac81e53bae1c25',
    specifiers: Object.freeze(['../host', '../session', './types', '@proto.ui/core']),
  }),
  'packages/runtime/src/instance/host.ts': Object.freeze({
    sourceSha256: '8fb845a5e76eb7c9b427eca5fc0c241b118b9926ad61fb921bb2194ebd633ca8',
    specifiers: Object.freeze([
      '../kernel/lifecycle-events',
      '../kernel/timeline',
      '../orchestrator/module-orchestrator',
      '@proto.ui/core',
    ]),
  }),
  'packages/runtime/src/instance/index.ts': Object.freeze({
    sourceSha256: 'bd5a14147c10794856da7d28e857ea7a11c6275bc37bb7478447d1d4614d4a47',
    specifiers: Object.freeze(['./execute', './host', './instance', './session']),
  }),
  'packages/runtime/src/instance/instance.ts': Object.freeze({
    sourceSha256: 'b4bf27ac468e1d4f1b2ba906ca29650412dea142810a5fc5eab5ecca82182c70',
    specifiers: Object.freeze([
      '../kernel',
      '../kernel/as-hook',
      '../kernel/event',
      '../orchestrator/module-orchestrator',
      './execute/callback-scope',
      '@proto.ui/core',
      '@proto.ui/core/internal',
      '@proto.ui/module-a11y',
      '@proto.ui/module-anatomy',
      '@proto.ui/module-as-trigger',
      '@proto.ui/module-axis-input',
      '@proto.ui/module-base',
      '@proto.ui/module-boundary',
      '@proto.ui/module-collection',
      '@proto.ui/module-context',
      '@proto.ui/module-control-label',
      '@proto.ui/module-event',
      '@proto.ui/module-expose',
      '@proto.ui/module-expose-event',
      '@proto.ui/module-expose-state',
      '@proto.ui/module-expose-state-web',
      '@proto.ui/module-feedback',
      '@proto.ui/module-focus',
      '@proto.ui/module-hit-participation',
      '@proto.ui/module-image-view',
      '@proto.ui/module-native-link',
      '@proto.ui/module-overlay',
      '@proto.ui/module-positioning',
      '@proto.ui/module-presence',
      '@proto.ui/module-props',
      '@proto.ui/module-rule',
      '@proto.ui/module-rule-expose-state-web',
      '@proto.ui/module-rule-meta',
      '@proto.ui/module-scroll',
      '@proto.ui/module-state',
      '@proto.ui/module-state-accessibility',
      '@proto.ui/module-state-interaction',
      '@proto.ui/module-table-structure',
      '@proto.ui/module-test-sys',
      '@proto.ui/module-text-control',
    ]),
  }),
  'packages/runtime/src/instance/session.ts': Object.freeze({
    sourceSha256: 'aa5545f7a96d7d46c9dcf652b84fbbb72da98d2d4f44de26553658e6f009a3b3',
    specifiers: Object.freeze([
      '../kernel',
      '../kernel/event',
      '../kernel/lifecycle-events',
      '../orchestrator/module-orchestrator',
      './execute/types',
      './host',
      './instance',
      '@proto.ui/core',
      '@proto.ui/module-a11y',
      '@proto.ui/module-control-label',
      '@proto.ui/module-event',
      '@proto.ui/module-presence',
      '@proto.ui/module-props',
      '@proto.ui/module-rule',
    ]),
  }),
  'packages/runtime/src/kernel/as-hook.ts': Object.freeze({
    sourceSha256: '808a8a3e295b63ed788bc1d78b74d7d0b004b8fc160f591d0c88f8f24373a063',
    specifiers: Object.freeze([
      './guard',
      '@proto.ui/core',
      '@proto.ui/core/internal',
      '@proto.ui/module-state',
    ]),
  }),
  'packages/runtime/src/kernel/event/index.ts': Object.freeze({
    sourceSha256: 'bd9a4201fde6d05cb21aa186bf2995a86e629f48e96fccb8d33cd47e301c2694',
    specifiers: Object.freeze(['./runtime-event-callbacks']),
  }),
  'packages/runtime/src/kernel/event/runtime-event-callbacks.ts': Object.freeze({
    sourceSha256: '6baaf9cf91684ecb678ac18efdceb9ebda77f01e3461df9a239284b9bbc84b39',
    specifiers: Object.freeze(['@proto.ui/core']),
  }),
  'packages/runtime/src/kernel/handles/def.ts': Object.freeze({
    sourceSha256: '1655ee15904f3f8bc11848a31b869f00d7449c61b7c0355e0d6ea91a331b8c0b',
    specifiers: Object.freeze([
      '../../orchestrator/module-orchestrator/types',
      '../event',
      '../guard',
      '@proto.ui/core',
      '@proto.ui/core/internal',
      '@proto.ui/module-anatomy',
      '@proto.ui/module-context',
      '@proto.ui/module-event',
      '@proto.ui/module-expose',
      '@proto.ui/module-expose-event',
      '@proto.ui/module-feedback',
      '@proto.ui/module-props',
      '@proto.ui/module-rule',
      '@proto.ui/module-state',
      '@proto.ui/module-state-accessibility',
      '@proto.ui/module-state-interaction',
    ]),
  }),
  'packages/runtime/src/kernel/handles/index.ts': Object.freeze({
    sourceSha256: 'ff41af2a8b6135a92a4872b65f5a9312d1db8cf63cfa440309257e96b4f3dce7',
    specifiers: Object.freeze(['./def', './run']),
  }),
  'packages/runtime/src/kernel/handles/run.ts': Object.freeze({
    sourceSha256: '05ed799675b9939eeffaf1e069c274b21898e1ce7f575972b83416911d129792',
    specifiers: Object.freeze([
      '../../orchestrator/module-orchestrator/types',
      '@proto.ui/core',
      '@proto.ui/module-anatomy',
      '@proto.ui/module-context',
      '@proto.ui/module-expose-event',
      '@proto.ui/module-feedback',
      '@proto.ui/module-props',
      '@proto.ui/module-rule-meta',
    ]),
  }),
  'packages/runtime/src/kernel/index.ts': Object.freeze({
    sourceSha256: '7f51bc2d559f077bb3dc6e83df1245d19d0b6ee41e223565489528ea069bd3d8',
    specifiers: Object.freeze([
      './event',
      './guard',
      './handles',
      './kernel',
      './lifecycle-events',
      './timeline',
      './view-intent',
    ]),
  }),
  'packages/runtime/src/kernel/kernel.ts': Object.freeze({
    sourceSha256: '4d1953ef05d507714b1d25a6a4d167d8e00e96d5816f8bc83ec79fc7757b4a39',
    specifiers: Object.freeze([
      '../orchestrator/module-orchestrator/types',
      './as-hook',
      './handles',
      './view-intent',
      './view-operation',
      '@proto.ui/core',
      '@proto.ui/module-anatomy',
      '@proto.ui/module-base',
      '@proto.ui/module-context',
      '@proto.ui/module-feedback',
      '@proto.ui/module-props',
      '@proto.ui/module-rule',
    ]),
  }),
  'packages/runtime/src/kernel/lifecycle-events.ts': Object.freeze({
    sourceSha256: 'b42be9af540da4dd0371eef254e96450e6918a29eda25e73483638bd9f6f7cf8',
    specifiers: Object.freeze(['./timeline', '@proto.ui/core']),
  }),
  'packages/runtime/src/kernel/view-intent.ts': Object.freeze({
    sourceSha256: '8e1a8521a635a195f714822403ec296bff49d4db1c3a27794201cd47e8c25c1b',
    specifiers: Object.freeze(['./guard', '@proto.ui/core']),
  }),
  'packages/runtime/src/kernel/view-operation.ts': Object.freeze({
    sourceSha256: 'd8c903194791e6c1203d7369f7cd474022979c3d11e73c0ecdf56545ebeeec72',
    specifiers: Object.freeze(['@proto.ui/core']),
  }),
  'packages/runtime/src/orchestrator/caps/index.ts': Object.freeze({
    sourceSha256: 'd5c19655468e29f60c871b21e73af8ebc653f736e7123ade916f22c4a5f80ce5',
    specifiers: Object.freeze(['./types']),
  }),
  'packages/runtime/src/orchestrator/caps/types.ts': Object.freeze({
    sourceSha256: '76fe06e4424f4b3c3526e404f9e760f1dac0a6eab49cad02bed6e42af5415944',
    specifiers: Object.freeze(['@proto.ui/core']),
  }),
  'packages/runtime/src/orchestrator/index.ts': Object.freeze({
    sourceSha256: 'e85bff4d04fd25cfd169d02c162a7b5df94d0e83eccea1e6d84f71acb1be9256',
    specifiers: Object.freeze(['./caps', './module-orchestrator']),
  }),
  'packages/runtime/src/orchestrator/module-orchestrator/graph.ts': Object.freeze({
    sourceSha256: '7e21fb940567d33f92ffbcd489b0d70dfdff0055722d0d2f346a6d1776aff580',
    specifiers: Object.freeze(['@proto.ui/module-base']),
  }),
  'packages/runtime/src/orchestrator/module-orchestrator/index.ts': Object.freeze({
    sourceSha256: '664d6c957291d9d7e7dd8bb48e25d7101f23bbfc8da9ccd6de3902ecebe48f45',
    specifiers: Object.freeze(['./runtime-module-orchestrator', './types']),
  }),
  'packages/runtime/src/orchestrator/module-orchestrator/runtime-module-orchestrator.ts':
    Object.freeze({
      sourceSha256: '8f4059cf3213c00192bbf17c0c139fee3aaeb12034666e04821bfcf77f14f0fe',
      specifiers: Object.freeze([
        '../caps',
        './graph',
        './types',
        '@proto.ui/core',
        '@proto.ui/module-base',
      ]),
    }),
  'packages/runtime/src/orchestrator/module-orchestrator/types.ts': Object.freeze({
    sourceSha256: 'bfcb6ae9d5e17c32ae4023d3407e512aaa43ef43db85952ff4b62b16a63c77c9',
    specifiers: Object.freeze(['../caps', '@proto.ui/core']),
  }),
});
