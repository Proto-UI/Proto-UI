// Reviewed build-time Runtime/style dependency closure for the bounded startup
// snapshot registry. Exact source bytes AND exact import strings are required.
// This does not authorize adjacent modules, foreign consumers, dynamic CSS,
// extra capabilities, browser controllers, or stable Prototype admission.
// Owner: www.build.style-generation; consumers stay in their blocked rows.
export const STARTUP_PRERENDER_IMPORT_ALLOWLIST = Object.freeze({
  'apps/www/src/components/site-startup-paint.ts': Object.freeze({
    sourceSha256: '4bb12512c5c079f9a78dde6003416efde751cdf255dedd47655cd51be228860b',
    specifiers: Object.freeze([
      '@proto.ui/prototypes-brutalist/button',
      '@proto.ui/prototypes-brutalist/surface',
      '@proto.ui/prototypes-shadcn/button',
      '@proto.ui/prototypes-shadcn/surface',
    ]),
  }),
  'apps/www/src/components/snapshot-prototype-style.ts': Object.freeze({
    sourceSha256: '3941b73c46c50a30e9618f6c9288e509ed4738316050bc20c1fa5c28ee1f740e',
    specifiers: Object.freeze([
      '../../../../packages/modules/as-trigger/src',
      '../../../../packages/modules/event/src',
      '../../../../packages/modules/feedback/src',
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
  'packages/modules/event/src/caps.ts': Object.freeze({
    sourceSha256: 'ad4562557b557f8083a5e543c670a2815a9a7e8fa43ff694453708a4498dc95a',
    specifiers: Object.freeze(['@proto.ui/core', '@proto.ui/module-expose-event']),
  }),
  'packages/modules/event/src/create.ts': Object.freeze({
    sourceSha256: '09ace2db7971cf8577226c77e686b00166084fbfe6daf7fe81d600a5af09df36',
    specifiers: Object.freeze(['./impl', './types', '@proto.ui/module-base']),
  }),
  'packages/modules/event/src/impl.ts': Object.freeze({
    sourceSha256: '1b7e8450457c48e0e785eb0099525ff2eecbe056f3122c6923ed50bb178b6e57',
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
    sourceSha256: 'aece802470861303b91206fcfdfecc02d337eca8368bf97a4ae2dc7ac622f518',
    specifiers: Object.freeze(['./types']),
  }),
  'packages/modules/event/src/types.ts': Object.freeze({
    sourceSha256: 'a856623826a4764b87a96bf599f81e8c06b7b2681d7d31298a3f167e113b0eab',
    specifiers: Object.freeze(['@proto.ui/core', '@proto.ui/module-expose-event']),
  }),
  'packages/modules/feedback/src/caps.ts': Object.freeze({
    sourceSha256: 'd799cf851eadf7fbf0568adaaf1cf3338edad9bfe84dcf622b1ab7746ebdc7c2',
    specifiers: Object.freeze(['@proto.ui/core']),
  }),
  'packages/modules/feedback/src/create.ts': Object.freeze({
    sourceSha256: 'ec3f90fa8ffc820198700acd44b88baa9673af3860b95d2c44e90d0a42456061',
    specifiers: Object.freeze([
      './caps',
      './material/declaration-id',
      './material/final-style-sink',
      './material/runtime-cap',
      './material/shared-sink',
      './types',
      '@proto.ui/core',
      '@proto.ui/module-base',
    ]),
  }),
  'packages/modules/feedback/src/index.ts': Object.freeze({
    sourceSha256: 'd55a1e1973038e978283216902e4de8c765cf9b7fbe32ac0556e3034a3162bca',
    specifiers: Object.freeze([
      './caps',
      './create',
      './material/deferred-view-sink',
      './material/shared-sink',
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
  'packages/modules/feedback/src/material/runtime-cap.ts': Object.freeze({
    sourceSha256: 'd1b699a04108672de6624bffcb8c4d23316e688312fe094f293764aafb96b5c4',
    specifiers: Object.freeze(['./owned-slot', '@proto.ui/core', '@proto.ui/module-base']),
  }),
  'packages/modules/feedback/src/material/shared-sink.ts': Object.freeze({
    sourceSha256: 'd1e4e725533e41f9d30209e2a0c86f32f88b09314b2c4e8008419aa9b4ca134b',
    specifiers: Object.freeze(['./final-style-sink', '@proto.ui/core']),
  }),
  'packages/modules/feedback/src/types.ts': Object.freeze({
    sourceSha256: '1f4cd43b20571473d875f863645b573b20e01a592072bd38444d86f4cde3b1a9',
    specifiers: Object.freeze(['@proto.ui/core']),
  }),
  'packages/runtime/src/index.ts': Object.freeze({
    sourceSha256: 'ad2935929a1d467d78e03c367a67758fc2b421565892b98094b3076c47fa9e19',
    specifiers: Object.freeze(['./instance', './kernel', './orchestrator']),
  }),
  'packages/runtime/src/instance/execute/callback-scope.ts': Object.freeze({
    sourceSha256: '21a83305e38eb0fbdc9da27ba36d27f13c155d1af28e3e312cf9cea661c9db1c',
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
    sourceSha256: '661081a56b61e1f628cfb074c681a41bec529461822fbe72148986028109a829',
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
    sourceSha256: '0c3dde969c3e5878f8524f5e1ee925959f597bd29957fe5b4ad7f17567132458',
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
    sourceSha256: '1e58ca39c0b5035d00bcc1a7c453a3b3beae7273e3b7b2e26536df0898790b03',
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
    sourceSha256: '15e7148ac161e938af9199b9b2ac291487d4111e20fd3d822e090e2ebf0e6648',
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
    sourceSha256: '45827b8d1c0b32ea70048ddd129d9e795ffefca5a2b45749fdb4aa4bd2f5debe',
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
    sourceSha256: '6984a630d75c8a33d02c5c517ee69f789c8a5b751eb1bd156ea267b555dd2667',
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
    sourceSha256: '433fdd18b93b09bc93f5cafff238412d324eedd70a6cdc775573abfab1f4f99d',
    specifiers: Object.freeze([
      '../orchestrator/module-orchestrator/types',
      './as-hook',
      './handles',
      './view-intent',
      '@proto.ui/core',
      '@proto.ui/module-anatomy',
      '@proto.ui/module-base',
      '@proto.ui/module-context',
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
      sourceSha256: 'fdc17a65ffa597e70384f6f6ceb0c727ff8ae648e974b52db17a87964b951611',
      specifiers: Object.freeze([
        '../caps',
        './graph',
        './types',
        '@proto.ui/core',
        '@proto.ui/module-base',
      ]),
    }),
  'packages/runtime/src/orchestrator/module-orchestrator/types.ts': Object.freeze({
    sourceSha256: 'bc412e587fa1b082b9dbd682f00ccc1c512571c813c741f5f68e69c35ddb5e7a',
    specifiers: Object.freeze(['../caps', '@proto.ui/core']),
  }),
});
