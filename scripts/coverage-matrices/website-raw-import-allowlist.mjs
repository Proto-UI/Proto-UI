import { builtinModules } from 'node:module';
import { STARTUP_PRERENDER_IMPORT_ALLOWLIST } from './startup-prerender-imports.mjs';
import { DIAGNOSTIC_IMPORT_ALLOWLIST } from './diagnostic-imports.mjs';
import { LIBRARY_CARD_IMPORT_ALLOWLIST } from './library-card-imports.mjs';

export const WEBSITE_RAW_IMPORT_ALLOWLIST = Object.freeze({
  ...STARTUP_PRERENDER_IMPORT_ALLOWLIST,
  ...LIBRARY_CARD_IMPORT_ALLOWLIST,
  ...DIAGNOSTIC_IMPORT_ALLOWLIST,
  // The authored Form demo consumes only the public Field request type.
  // Its interactive controller remains owned by the existing blocked demo row.
  'apps/www/src/content/docs/form-validation-demo.shared.ts': Object.freeze({
    sourceSha256: '513109fab6b240f8bd2bb9eddb4e6cab6fac48707226ee2020efd914a7d089e0',
    specifiers: Object.freeze(['@proto.ui/prototypes-base/field']),
  }),
  // Import-edge allowances only: an inline entry without a `sourceSha256`
  // certifies the exact specifier or resolved path, never the source body.
  // Post-admission body drift is invisible to this gate and stays source-review
  // debt under #420; the affected sources and their owning rows are enumerated
  // in internal/website/self-hosting-coverage-matrix.md.
  // Exact native-input Adapter demonstration. Its file-name status and file
  // option bridge remain a blocked authored composition, not runtime infrastructure.
  'apps/www/src/components/native-file-input-preview.ts': Object.freeze({
    sourceSha256: '55496ad2bc9c90579b5017c271f3f0b60653c698dd1f12833e188410db1b0cf8',
    specifiers: Object.freeze([
      '@proto.ui/adapter-react',
      '@proto.ui/prototypes-base/native-file-input',
    ]),
  }),
  // Exact legacy runtime-selection composition; its owning row stays blocked.
  'apps/www/src/components/PrototypePreviewer/runtime-tabs.ts': Object.freeze({
    sourceSha256: '474e5be107742102059b663053f8c6d30c9482731d8d82bde40c514f4083e54b',
    specifiers: Object.freeze([
      '@proto.ui/adapter-web-component',
      '@proto.ui/prototypes-shadcn/tabs',
      '@proto.ui/prototypes-brutalist/tabs',
      '@proto.ui/prototypes-bootstrap-2-3-2/tabs',
      '@proto.ui/prototypes-liquid-glass/tabs',
    ]),
  }),
  // Exact progressive CodeExample WC bridges. Their site-composition owners
  // remain blocked; import admission does not resolve native fallback disposition
  // or provide host, keyboard, SSR/no-JS, or remount acceptance evidence.
  'apps/www/src/components/code-example-tabs.ts': Object.freeze({
    sourceSha256: '88747166dab1887b8f2a7309c6d869715958356167d6eb3743ec05bb0024a058',
    specifiers: Object.freeze([
      '@proto.ui/adapter-web-component',
      '@proto.ui/prototypes-shadcn/tabs',
      '@proto.ui/prototypes-brutalist/tabs',
    ]),
  }),
  'apps/www/src/components/code-example-tree.ts': Object.freeze({
    sourceSha256: '1420259e7f613f5cf6980615a9cec9ed2147593d074948766435a8845f9dc336',
    specifiers: Object.freeze([
      '@proto.ui/adapter-web-component',
      '@proto.ui/prototypes-shadcn/tree',
      '@proto.ui/prototypes-brutalist/tree',
      '@proto.ui/prototypes-lucide/icons/chevron-down',
      '@proto.ui/prototypes-lucide/icons/chevron-right',
      '@proto.ui/prototypes-lucide/icons/folder',
      '@proto.ui/prototypes-lucide/icons/file',
      '@proto.ui/prototypes-lucide/icons/file-code',
      '@proto.ui/prototypes-lucide/icons/file-braces',
      '@proto.ui/prototypes-lucide/icons/file-cog',
      '@proto.ui/prototypes-lucide/icons/file-text',
    ]),
  }),
  // Exact passive CSS endpoint inputs; Bootstrap remains WIP / Experimental.
  'apps/www/src/pages/styles/site-library-theme.css.ts': Object.freeze({
    sourceSha256: '6e97d6eaca3627a636340869e7c350e6596364640ffee004f3a99c5cde94e2f8',
    specifiers: Object.freeze([
      '@proto.ui/prototypes-bootstrap-2-3-2/theme',
      '@proto.ui/prototypes-brutalist/theme',
      '@proto.ui/prototypes-shadcn/text',
    ]),
  }),
  // Exact passive Homepage theme source; the homepage demo owner remains blocked.
  'apps/www/src/components/Homepage/homepage-ghost-theme.ts': Object.freeze({
    sourceSha256: '106a0a26ccbf02a304e08abf82760b5ee7209877cf77512d37627d4ffe11e7f4',
    specifiers: Object.freeze([
      '../../../../../packages/prototypes/bootstrap-2-3-2/src/theme',
      '../../../../../packages/prototypes/brutalist/src/theme',
    ]),
  }),
  // Exact #652 acceptance compositions. Their App controls remain blocked
  // consumers, not an infrastructure or stable-prototype exemption.
  'apps/www/src/components/PrototypePreviewer/shadow-split-acceptance.ts': Object.freeze({
    sourceSha256: '6ec435217573ac35458cd1ea79b27a9cc95f5137e942cf72b7118a825978cb7a',
    specifiers: Object.freeze([
      '@proto.ui/adapter-web-component',
      '@proto.ui/prototypes-brutalist/badge',
      '@proto.ui/prototypes-shadcn/checkbox',
    ]),
  }),
  'apps/www/src/components/PrototypePreviewer/shadow-split-s2.ts': Object.freeze({
    sourceSha256: '6ef1cb15c224e47045993911e1e6b7c14ad0f93f65df5014c86282118a3a83be',
    specifiers: Object.freeze([
      '@proto.ui/adapter-web-component',
      '@proto.ui/prototypes-brutalist/badge',
      '@proto.ui/prototypes-shadcn/button',
      '@proto.ui/prototypes-shadcn/checkbox',
      '@proto.ui/prototypes-shadcn/switch',
    ]),
  }),
  'apps/www/src/components/PrototypePreviewer/shadow-split-s3.ts': Object.freeze({
    sourceSha256: '85b7c3c518e6f1ef1e72f20b975d6ac4ce317c1a046a3cc0562602c899dffc46',
    specifiers: Object.freeze([
      '@proto.ui/adapter-web-component',
      '@proto.ui/prototypes-brutalist/badge',
      '@proto.ui/prototypes-shadcn/button',
      '@proto.ui/prototypes-shadcn/checkbox',
      '@proto.ui/prototypes-shadcn/switch',
      '@proto.ui/prototypes-shadcn/tabs',
    ]),
  }),
  'apps/www/src/components/PrototypePreviewer/shadow-split-s4.ts': Object.freeze({
    sourceSha256: '4492f622a7d0cd411f60ea7e3906205219cb9b4bc2d1062c0eed5703e1bfd514',
    specifiers: Object.freeze([
      '@proto.ui/adapter-web-component',
      '@proto.ui/prototypes-shadcn/dialog',
    ]),
  }),
  'apps/www/src/components/PrototypePreviewer/shadow-split-s5.ts': Object.freeze({
    sourceSha256: 'fa92aa85ff8afb7a0f0233155e485dc3363ee886068015ceb979162e2ae66cbf',
    specifiers: Object.freeze([
      '@proto.ui/adapter-web-component',
      '@proto.ui/prototypes-base/input',
      '@proto.ui/prototypes-base/textarea',
      '@proto.ui/prototypes-shadcn/tabs',
      '@proto.ui/prototypes-shadcn/textarea',
    ]),
  }),
  // Exact opt-in optical host and its owned-source diagnostics, not app controls.
  'apps/www/src/components/PrototypePreviewer/preview-material-provider.ts': Object.freeze({
    specifiers: Object.freeze([
      '@proto.ui/core',
      '@proto.ui/module-feedback',
      '@proto.ui/adapter-base',
    ]),
  }),
  'apps/www/src/components/PrototypePreviewer/preview-material-scene.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/adapter-base', '@proto.ui/adapter-base/web-material']),
    resolvedPaths: Object.freeze(['packages/prototypes/liquid-glass/src/theme']),
  }),
  'packages/adapters/base/src/material/program-pool.ts': Object.freeze({
    resolvedPaths: Object.freeze([
      'packages/adapters/base/src/material/image-prepare',
      'packages/adapters/base/src/material/program',
      'packages/adapters/base/src/material/source-refresh-task',
    ]),
  }),
  'packages/adapters/base/src/material/program.ts': Object.freeze({
    resolvedPaths: Object.freeze([
      'packages/adapters/base/src/material/contact-profile',
      'packages/adapters/base/src/material/liquidgl-kernel.generated',
      'packages/adapters/base/src/material/prefilter',
      'packages/adapters/base/src/material/program-inputs',
      'packages/adapters/base/src/material/style',
      'packages/adapters/base/src/material/style-tint-profile',
      // Profile 6 reads bounded source statistics from this pure private helper.
      'packages/adapters/base/src/material/style-tint-source',
      'packages/adapters/base/src/material/source',
    ]),
  }),
  // Pure input admission extracted by the merged material performance work.
  // Its exact body and two literal edges remain source-reviewed independently.
  'packages/adapters/base/src/material/program-inputs.ts': Object.freeze({
    sourceSha256: '5609c82ee7111411f926092e10ebe188566cbfc5e19d6e715ef85080cf4099db',
    specifiers: Object.freeze(['./program', './style-tint-profile']),
  }),
  // Continuous contact is still the exact opt-in optical host closure (#420).
  // These reviewed edges admit neither sibling modules nor foreign consumers.
  'packages/adapters/base/src/material/contact-profile.ts': Object.freeze({
    resolvedPaths: Object.freeze(['packages/adapters/base/src/material/liquidgl-kernel.generated']),
  }),
  'packages/adapters/base/src/material/contact-carrier.ts': Object.freeze({
    resolvedPaths: Object.freeze(['packages/adapters/base/src/material/paint-mutations']),
  }),
  'packages/adapters/base/src/material/style.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/core']),
  }),
  'apps/www/src/components/PrototypePreviewer/runtimes/retryable-module.ts': Object.freeze({
    viteIgnoredDynamicImports: Object.freeze(['url']),
    sourceSha256: '32011cbe30566785c4e081e32cada2780ef6a6d5349d10331aace4eead0a12f2',
  }),

  // Exact public caption binding consumed by the blocked application controller.
  'apps/www/src/content/docs/zh-cn/calendar-demo.shared.ts': Object.freeze({
    sourceSha256: 'd49eaa0a85403ab65ec73f7486d3c149afa4a38ff3dba11484dacd7ba304f480',
    specifiers: Object.freeze(['@proto.ui/prototypes-base/calendar']),
  }),
  // Reviewed Field validation request type consumed by the blocked demo controller.
  'apps/www/src/content/docs/field-demo.shared.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/prototypes-base/field']),
  }),
  'apps/www/src/content/docs/demo_components/field/field-examples.shared.ts': Object.freeze({
    sourceSha256: 'd7075d5c034cb75691d3c30656e1e442de83f3f9c2131133853d487657f915b0',
    specifiers: Object.freeze(['@proto.ui/prototypes-base/field']),
  }),
  // Exact public-fact demo compositions under the blocked authored-controller
  // owner (#420). Core is type-only; the Bootstrap helper supplies passive
  // appearance, while Drawer/Dialog retain input, focus and dismissal ownership.
  'apps/www/src/content/docs/drawer-command-disabled.shared.ts': Object.freeze({
    sourceSha256: 'b046d82b1709a4c0411d0ee26aaa7fbba4412fcc7c5b173b7d160cd151fb3dbe',
    specifiers: Object.freeze(['@proto.ui/core']),
  }),
  'apps/www/src/content/docs/overlay-control-recipes-r94.shared.ts': Object.freeze({
    sourceSha256: '02c712c674cac0201a874c1b9c34b5adba177cfeb65ce40ff94c1de0f69ccdee',
    specifiers: Object.freeze(['@proto.ui/core', '@proto.ui/prototypes-bootstrap-2-3-2/surface']),
  }),
  // Exact demo compositions delegating geometry/materialization to the public Web
  // attachment. Their authored-controller owner remains blocked. Bootstrap and
  // Liquid Glass remain WIP/Experimental. These exact edges admit preview source only.
  'apps/www/src/content/docs/zh-cn/demo-base-virtual-list.demo.ts': Object.freeze({
    sourceSha256: 'f3fff0e817ed9b28a5c7e7481ea6cb1962eac0f71564f56646ff6bf0ce2553d4',
    specifiers: Object.freeze([
      '@proto.ui/prototypes-base/virtual-list/web',
      '@proto.ui/prototypes-base/virtual-list',
    ]),
  }),
  'apps/www/src/content/docs/zh-cn/demo-shadcn-virtual-list.demo.ts': Object.freeze({
    sourceSha256: 'cb46e33e36095dd05150367f7576ee67552730265a220ef687d6cfa382b9e01a',
    specifiers: Object.freeze([
      '@proto.ui/prototypes-base/virtual-list/web',
      '@proto.ui/prototypes-base/virtual-list',
    ]),
  }),
  'apps/www/src/content/docs/zh-cn/demo-brutalist-virtual-list.demo.ts': Object.freeze({
    sourceSha256: 'faca72985d274b9298ddd79cbfd8fefbbce18c32ec7023a5d39d523c0fd3556e',
    specifiers: Object.freeze([
      '@proto.ui/prototypes-base/virtual-list/web',
      '@proto.ui/prototypes-base/virtual-list',
    ]),
  }),
  'apps/www/src/content/docs/zh-cn/demo-bootstrap-2-3-2-virtual-list.demo.ts': Object.freeze({
    sourceSha256: '094c932c7c2607a8b08bcd8e94edc7e59a8ac92e28634911aeb62a15a4a9987d',
    specifiers: Object.freeze([
      '@proto.ui/prototypes-base/virtual-list/web',
      '@proto.ui/prototypes-base/virtual-list',
    ]),
  }),
  'apps/www/src/content/docs/zh-cn/demo-liquid-glass-virtual-list.demo.ts': Object.freeze({
    sourceSha256: 'cdce7524455c85eb22ee42fbb77eea08d04b0aa3d0d1dcae454e2f03ec0e7542',
    specifiers: Object.freeze([
      '@proto.ui/prototypes-base/virtual-list/web',
      '@proto.ui/prototypes-base/virtual-list',
    ]),
  }),
  'apps/www/src/content/docs/demo_components/virtual-list/demo-bootstrap-2-3-2-virtual-list-filter.demo.ts':
    Object.freeze({
      sourceSha256: 'adde61f6ee9055e4acfd7606971f78c3b3bf67b2a6b2c2030465de1b8765f4b4',
      specifiers: Object.freeze([
        '@proto.ui/prototypes-base/virtual-list/web',
        '@proto.ui/prototypes-base/virtual-list',
      ]),
    }),
  'apps/www/src/content/docs/demo_components/virtual-list/demo-bootstrap-2-3-2-virtual-list-jump.demo.ts':
    Object.freeze({
      sourceSha256: '757c24e39695b5834e131536d900df6e8b0bbf2e8740bfc92d84cb37dee6441b',
      specifiers: Object.freeze([
        '@proto.ui/prototypes-base/virtual-list/web',
        '@proto.ui/prototypes-base/virtual-list',
      ]),
    }),
  'apps/www/src/content/docs/demo_components/virtual-list/demo-bootstrap-2-3-2-virtual-list-window.demo.ts':
    Object.freeze({
      sourceSha256: 'e9568d70d15db2d4f52fb1d677f80e6dce07c473ed4d1a0d05a12728eb5181e3',
      specifiers: Object.freeze([
        '@proto.ui/prototypes-base/virtual-list/web',
        '@proto.ui/prototypes-base/virtual-list',
      ]),
    }),
  'apps/www/src/content/docs/demo_components/virtual-list/demo-brutalist-virtual-list-filter.demo.ts':
    Object.freeze({
      sourceSha256: 'baf2b6ffdfba697637ebc5a7e8ac6500f706a6fd6b1a772b09876b3963f3a66e',
      specifiers: Object.freeze([
        '@proto.ui/prototypes-base/virtual-list/web',
        '@proto.ui/prototypes-base/virtual-list',
      ]),
    }),
  'apps/www/src/content/docs/demo_components/virtual-list/demo-brutalist-virtual-list-jump.demo.ts':
    Object.freeze({
      sourceSha256: '6b14404a054787aeaab9c4066a2bd1a07955d4984a54be8d85163c2cbfc77d55',
      specifiers: Object.freeze([
        '@proto.ui/prototypes-base/virtual-list/web',
        '@proto.ui/prototypes-base/virtual-list',
      ]),
    }),
  'apps/www/src/content/docs/demo_components/virtual-list/demo-brutalist-virtual-list-window.demo.ts':
    Object.freeze({
      sourceSha256: '194f8b3058e2d0dc07bb4d21e147df3117aad777ccc6e75e9529ef26ce67fd38',
      specifiers: Object.freeze([
        '@proto.ui/prototypes-base/virtual-list/web',
        '@proto.ui/prototypes-base/virtual-list',
      ]),
    }),
  'apps/www/src/content/docs/demo_components/virtual-list/demo-liquid-glass-virtual-list-filter.demo.ts':
    Object.freeze({
      sourceSha256: '1a7b25f872fb5c17d552ecb3b38b5fe8e818c79936f7440ad7e99031d73621f9',
      specifiers: Object.freeze([
        '@proto.ui/prototypes-base/virtual-list/web',
        '@proto.ui/prototypes-base/virtual-list',
      ]),
    }),
  'apps/www/src/content/docs/demo_components/virtual-list/demo-liquid-glass-virtual-list-jump.demo.ts':
    Object.freeze({
      sourceSha256: 'eee0b36aaf8ee9b361187863a716230ba6d3884af721904bd93b0cc10df0d032',
      specifiers: Object.freeze([
        '@proto.ui/prototypes-base/virtual-list/web',
        '@proto.ui/prototypes-base/virtual-list',
      ]),
    }),
  'apps/www/src/content/docs/demo_components/virtual-list/demo-liquid-glass-virtual-list-window.demo.ts':
    Object.freeze({
      sourceSha256: '6a559b4609c273b2e18f1ad8de1dfd004ed37fb66485af9edae9b4867b045bde',
      specifiers: Object.freeze([
        '@proto.ui/prototypes-base/virtual-list/web',
        '@proto.ui/prototypes-base/virtual-list',
      ]),
    }),
  'apps/www/src/content/docs/demo_components/virtual-list/demo-shadcn-virtual-list-filter.demo.ts':
    Object.freeze({
      sourceSha256: '8aeb9ce39501ebb444e17f59d7ee116b7b897737ad808f46bb38f1d590b772b9',
      specifiers: Object.freeze([
        '@proto.ui/prototypes-base/virtual-list/web',
        '@proto.ui/prototypes-base/virtual-list',
      ]),
    }),
  'apps/www/src/content/docs/demo_components/virtual-list/demo-shadcn-virtual-list-jump.demo.ts':
    Object.freeze({
      sourceSha256: 'da28dba79c1a0607f6dee4438d9caa2c65ff2faeb24d8dab37e9b8107b67379f',
      specifiers: Object.freeze([
        '@proto.ui/prototypes-base/virtual-list/web',
        '@proto.ui/prototypes-base/virtual-list',
      ]),
    }),
  'apps/www/src/content/docs/demo_components/virtual-list/demo-shadcn-virtual-list-window.demo.ts':
    Object.freeze({
      sourceSha256: 'aad71a8ba1eb087efdba722bb960a0cb16bf0ba5159f728e1c411f17ff090a7c',
      specifiers: Object.freeze([
        '@proto.ui/prototypes-base/virtual-list/web',
        '@proto.ui/prototypes-base/virtual-list',
      ]),
    }),
  // The recipe projects serializable intent into the render-local association scope.
  'apps/www/src/components/PrototypePreviewer/shadcn-checkbox-composition.ts': Object.freeze({
    sourceSha256: '249b335382c69683b873c9b0ec7b63287e532ee1b16c709bad7595d47e1d7a86',
    specifiers: Object.freeze(['@proto.ui/prototypes-shadcn/checkbox']),
  }),
  // The application demo supplies view lifetime and disposes the public binding.
  'apps/www/src/content/docs/demo-shadcn-input-shell.demo.ts': Object.freeze({
    sourceSha256: '59d29ced33398d842168046455584ac40f7d0a390c4566992821da53101a09ac',
    specifiers: Object.freeze(['@proto.ui/prototypes-shadcn/input-shell']),
  }),
  'apps/www/src/content/docs/demo_components/input-shell/demo-shadcn-input-shell-command.demo.ts':
    Object.freeze({
      sourceSha256: '491c986c60a2fe59e0268f290a9bde60f385491485abfbf8f91d1e0c92dadb73',
      specifiers: Object.freeze(['@proto.ui/prototypes-shadcn/input-shell']),
    }),
  'apps/www/src/content/docs/demo_components/input-shell/demo-shadcn-input-shell-controlled.demo.ts':
    Object.freeze({
      sourceSha256: 'c62fa529ac16a57af832ebfa565bf748b7d2a8833443ac773a8c8a0c4f59764b',
      specifiers: Object.freeze(['@proto.ui/prototypes-shadcn/input-shell']),
    }),
  'apps/www/src/content/docs/demo_components/input-shell/demo-shadcn-input-shell-profiles.demo.ts':
    Object.freeze({
      sourceSha256: '52ff2ab3a544d07dad8335d90d1ac40b7bf548948cf9a5def2b5432db5399fb0',
      specifiers: Object.freeze(['@proto.ui/prototypes-shadcn/input-shell']),
    }),
  'apps/www/src/content/docs/demo_components/input-shell/demo-shadcn-input-shell-rhea.demo.ts':
    Object.freeze({
      sourceSha256: 'ea52c6298491345bd8e27cc91c77d9bed0f570cea08ae56e74027d0f51241552',
      specifiers: Object.freeze(['@proto.ui/prototypes-shadcn/input-shell']),
    }),
  'apps/www/src/content/docs/demo_components/input-shell/demo-shadcn-input-shell-states.demo.ts':
    Object.freeze({
      sourceSha256: '3f4d16509a55b811796454428b796f3a52c81503da5b267b97a9f6746d023c18',
      specifiers: Object.freeze(['@proto.ui/prototypes-shadcn/input-shell']),
    }),
  // Exact authored Dialog recipe: the single public Button edge is type-only.
  // Full importer bytes remain required; no controller acceptance is promoted.
  'apps/www/src/content/docs/zh-cn/demo-brutalist-dialog.demo.ts': Object.freeze({
    sourceSha256: '1bd0efedba96fd34fb151874eb988ac371a16586875b95a6aa2b07f0dee9a360',
    specifiers: Object.freeze(['@proto.ui/prototypes-brutalist/button']),
  }),
  'apps/www/src/content/docs/demo-bootstrap-2-3-2-dialog.demo.ts': Object.freeze({
    sourceSha256: 'bed828050a2f4b8157678f4d903eade26184762b97c42dd181c7e2fdcd836668',
    specifiers: Object.freeze(['@proto.ui/prototypes-bootstrap-2-3-2/surface']),
  }),
  'apps/www/src/content/docs/demo_components/dialog/demo-bootstrap-2-3-2-dialog-no-close.demo.ts':
    Object.freeze({
      sourceSha256: 'c4fe8a6e69cbb66faac9011b0417f192018cfc32a76b389abf2c5a36fef0ab4e',
      specifiers: Object.freeze(['@proto.ui/prototypes-bootstrap-2-3-2/surface']),
    }),
  'apps/www/src/content/docs/demo_components/dialog/demo-bootstrap-2-3-2-dialog-sticky-footer.demo.ts':
    Object.freeze({
      sourceSha256: 'd368450c905789d1fecb3267b3d91582b4ec37bea95cf65a455ed40c59b8164f',
      specifiers: Object.freeze(['@proto.ui/prototypes-bootstrap-2-3-2/surface']),
    }),
  'apps/www/src/content/docs/demo_components/style-scope/demo-shadcn-style-scope-composite.demo.ts':
    Object.freeze({
      sourceSha256: '93b9670fe3be83fa13b44bc5854ee8a4771928700363026d0d245d6cdba564fe',
      specifiers: Object.freeze(['@proto.ui/prototypes-shadcn/input-shell']),
    }),
  'apps/www/src/content/docs/demo_components/style-scope/demo-shadcn-style-scope-state-preservation.demo.ts':
    Object.freeze({
      sourceSha256: 'e151f512ba3906d1dfa7091ab0c0d91ccc149c6b2049875773da86554e142c34',
      specifiers: Object.freeze(['@proto.ui/prototypes-shadcn/input-shell']),
    }),
  'apps/www/src/content/docs/demo_components/style-scope/demo-shadcn-style-scope.demo.ts':
    Object.freeze({
      sourceSha256: '9b74d2eb3388fdbed1abbab46b71a3e89f4f5e08f6d53e0e6c109f26f93f4772',
      specifiers: Object.freeze(['@proto.ui/prototypes-shadcn/input-shell']),
    }),
  // Main integration sources: exact source owners and public inputs only.
  // These bindings do not promote draft components or admit sibling imports,
  // and unpinned entries do not certify the source body (see the note above).
  'apps/www/src/components/Homepage/homepage-text.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/prototypes-base/text']),
  }),
  // The reviewed extracted client owns the same manager selection. Its exact
  // importer bytes remain required; this does not admit sibling helpers.
  'apps/www/src/components/install-command-card-client.ts': Object.freeze({
    sourceSha256: 'dd644892e2650c8c6978c8b5707692ace5cc68d680acf940ef65d3483aa8fb64',
    specifiers: Object.freeze(['@proto.ui/adapter-web-component']),
  }),
  'apps/www/src/components/site-link-recipes.ts': Object.freeze({
    sourceSha256: '16860dec9586b26f48518fc6466119f25199ea15d9bffaf446297966e2c32479',
    specifiers: Object.freeze([
      '@proto.ui/prototypes-base/surface',
      '@proto.ui/prototypes-base/text',
      '@proto.ui/prototypes-shadcn/surface',
      '@proto.ui/prototypes-brutalist/surface',
      '@proto.ui/prototypes-bootstrap-2-3-2/surface',
    ]),
  }),
  'apps/www/src/components/site-native-controls.ts': Object.freeze({
    sourceSha256: 'b3adf001ead0e1cdbf5748a7f8e6a0b2e0d4f10b0c273e5a8d2751708b714451',
    specifiers: Object.freeze([
      '@proto.ui/adapter-web-component',
      '@proto.ui/prototypes-shadcn/surface',
      '@proto.ui/prototypes-brutalist/surface',
      '@proto.ui/prototypes-shadcn/text',
      '@proto.ui/prototypes-brutalist/text',
      '@proto.ui/prototypes-bootstrap-2-3-2/surface',
      '@proto.ui/prototypes-bootstrap-2-3-2/text',
    ]),
  }),
  'apps/www/src/components/site-search-commands.ts': Object.freeze({
    sourceSha256: 'ca09a603a4bb717f2f735334f380e8446027647c4eec63045b258f6246a60a1b',
    specifiers: Object.freeze([
      '@proto.ui/module-expose-state',
      '../../../../packages/prototypes/lucide/src/icons/search',
      '../../../../packages/prototypes/lucide/src/icons/arrow-right',
      '../../../../packages/prototypes/lucide/src/icons/x',
    ]),
  }),
  // Public InputShell binding only; neither Search source gains UI acceptance.
  'apps/www/src/components/site-search-composition.ts': Object.freeze({
    sourceSha256: '37e4f54bf7ae1afad9fd7a08417c104304bf7285b0f8ccee3a6b5923f4587ea7',
    specifiers: Object.freeze(['@proto.ui/prototypes-shadcn/input-shell']),
  }),
  'apps/www/src/components/site-text-recipes.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/prototypes-base/text']),
  }),
  'apps/www/src/components/surface-recipes.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/prototypes-base/surface']),
  }),
  'apps/www/src/components/SiteLibraryStyle.astro': Object.freeze({
    resolvedPaths: Object.freeze(['packages/prototypes/brutalist/src/theme']),
  }),

  // Per-render DemoSpec association-key lowering to a public opaque identity.
  // No ordinary website controller or private host lookup is admitted here.
  'apps/www/src/components/PrototypePreviewer/demo-associations.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/core']),
  }),
  'apps/www/src/components/PrototypePreviewer/demo-renderer.ts': Object.freeze({
    specifiers: Object.freeze([
      '@proto.ui/core',
      '@proto.ui/adapter-web-component',
      '@proto.ui/adapter-react',
      '@proto.ui/adapter-vue',
      '@proto.ui/adapter-vue2',
    ]),
  }),
  'apps/www/src/components/PrototypePreviewer/wc-registry.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/core', '@proto.ui/adapter-web-component']),
  }),
  'apps/www/src/components/PrototypePreviewer/registry.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/core']),
  }),
  'apps/www/src/components/PrototypePreviewer/runtimes/react-runtime.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/adapter-react']),
    viteIgnoredDynamicImports: Object.freeze([
      'https://esm.sh/react@18',
      'https://esm.sh/react-dom@18',
    ]),
  }),
  'apps/www/src/components/PrototypePreviewer/runtimes/vue-runtime.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/adapter-vue']),
    viteIgnoredDynamicImports: Object.freeze(['https://esm.sh/vue@3']),
  }),
  'apps/www/src/components/PrototypePreviewer/runtimes/vue2-runtime.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/adapter-vue2']),
    viteIgnoredDynamicImports: Object.freeze(['https://esm.sh/vue@2.6.14']),
  }),
  'apps/www/src/components/PrototypePreviewer/runtimes/wc-runtime.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/adapter-web-component']),
  }),
  'apps/www/src/components/PrototypePreviewer/prototype-modules.ts': Object.freeze({
    categories: Object.freeze(['prototype-package', 'prototype-internal']),
  }),
  // Exact lazy Finf registry source under www.demo.prototype-previewer (#1323).
  // Public prototype subpaths plus the Core type import; registrations check identity.
  'apps/www/src/components/PrototypePreviewer/finf-prototype-modules.ts': Object.freeze({
    sourceSha256: 'd865eb6912784099de15984d20be1774fd031c88b82d06a0d4147152d1b8ab77',
    specifiers: Object.freeze([
      '@proto.ui/core',
      '@proto.ui/prototypes-base/alert-dialog',
      '@proto.ui/prototypes-base/autocomplete',
      '@proto.ui/prototypes-base/calendar',
      '@proto.ui/prototypes-base/carousel',
      '@proto.ui/prototypes-base/checkbox-group',
      '@proto.ui/prototypes-base/combobox',
      '@proto.ui/prototypes-base/command',
      '@proto.ui/prototypes-base/context-menu',
      '@proto.ui/prototypes-base/data-table',
      '@proto.ui/prototypes-base/date-picker',
      '@proto.ui/prototypes-base/drawer',
      '@proto.ui/prototypes-base/dropdown',
      '@proto.ui/prototypes-base/field',
      '@proto.ui/prototypes-base/fieldset',
      '@proto.ui/prototypes-base/form',
      '@proto.ui/prototypes-base/input-otp',
      '@proto.ui/prototypes-base/menubar',
      '@proto.ui/prototypes-base/message-scroller',
      '@proto.ui/prototypes-base/meter',
      '@proto.ui/prototypes-base/navigation-menu',
      '@proto.ui/prototypes-base/number-field',
      '@proto.ui/prototypes-base/popover',
      '@proto.ui/prototypes-base/progress',
      '@proto.ui/prototypes-base/resizable',
      '@proto.ui/prototypes-base/slider',
      '@proto.ui/prototypes-base/toast',
      '@proto.ui/prototypes-base/toggle-group',
      '@proto.ui/prototypes-base/toolbar',
      '@proto.ui/prototypes-base/tree',
      '@proto.ui/prototypes-base/virtual-list',
      '@proto.ui/prototypes-bootstrap-2-3-2/alert-dialog',
      '@proto.ui/prototypes-bootstrap-2-3-2/async-region',
      '@proto.ui/prototypes-bootstrap-2-3-2/autocomplete',
      '@proto.ui/prototypes-bootstrap-2-3-2/calendar',
      '@proto.ui/prototypes-bootstrap-2-3-2/carousel',
      '@proto.ui/prototypes-bootstrap-2-3-2/checkbox-group',
      '@proto.ui/prototypes-bootstrap-2-3-2/combobox',
      '@proto.ui/prototypes-bootstrap-2-3-2/command',
      '@proto.ui/prototypes-bootstrap-2-3-2/context-menu',
      '@proto.ui/prototypes-bootstrap-2-3-2/data-table',
      '@proto.ui/prototypes-bootstrap-2-3-2/date-picker',
      '@proto.ui/prototypes-bootstrap-2-3-2/dialog',
      '@proto.ui/prototypes-bootstrap-2-3-2/drawer',
      '@proto.ui/prototypes-bootstrap-2-3-2/dropdown',
      '@proto.ui/prototypes-bootstrap-2-3-2/field',
      '@proto.ui/prototypes-bootstrap-2-3-2/fieldset',
      '@proto.ui/prototypes-bootstrap-2-3-2/form',
      '@proto.ui/prototypes-bootstrap-2-3-2/hover-card',
      '@proto.ui/prototypes-bootstrap-2-3-2/image',
      '@proto.ui/prototypes-bootstrap-2-3-2/input-otp',
      '@proto.ui/prototypes-bootstrap-2-3-2/live-region',
      '@proto.ui/prototypes-bootstrap-2-3-2/menubar',
      '@proto.ui/prototypes-bootstrap-2-3-2/message-scroller',
      '@proto.ui/prototypes-bootstrap-2-3-2/meter',
      '@proto.ui/prototypes-bootstrap-2-3-2/navigation-menu',
      '@proto.ui/prototypes-bootstrap-2-3-2/number-field',
      '@proto.ui/prototypes-bootstrap-2-3-2/popover',
      '@proto.ui/prototypes-bootstrap-2-3-2/progress',
      '@proto.ui/prototypes-bootstrap-2-3-2/radio-group',
      '@proto.ui/prototypes-bootstrap-2-3-2/resizable',
      '@proto.ui/prototypes-bootstrap-2-3-2/scroll-area',
      '@proto.ui/prototypes-bootstrap-2-3-2/select',
      '@proto.ui/prototypes-bootstrap-2-3-2/slider',
      '@proto.ui/prototypes-bootstrap-2-3-2/table',
      '@proto.ui/prototypes-bootstrap-2-3-2/tabs',
      '@proto.ui/prototypes-bootstrap-2-3-2/toast',
      '@proto.ui/prototypes-bootstrap-2-3-2/toggle-group',
      '@proto.ui/prototypes-bootstrap-2-3-2/toolbar',
      '@proto.ui/prototypes-bootstrap-2-3-2/tooltip',
      '@proto.ui/prototypes-bootstrap-2-3-2/transition',
      '@proto.ui/prototypes-bootstrap-2-3-2/tree',
      '@proto.ui/prototypes-bootstrap-2-3-2/virtual-list',
      '@proto.ui/prototypes-brutalist/alert-dialog',
      '@proto.ui/prototypes-brutalist/async-region',
      '@proto.ui/prototypes-brutalist/autocomplete',
      '@proto.ui/prototypes-brutalist/calendar',
      '@proto.ui/prototypes-brutalist/carousel',
      '@proto.ui/prototypes-brutalist/checkbox-group',
      '@proto.ui/prototypes-brutalist/combobox',
      '@proto.ui/prototypes-brutalist/command',
      '@proto.ui/prototypes-brutalist/context-menu',
      '@proto.ui/prototypes-brutalist/data-table',
      '@proto.ui/prototypes-brutalist/date-picker',
      '@proto.ui/prototypes-brutalist/drawer',
      '@proto.ui/prototypes-brutalist/dropdown',
      '@proto.ui/prototypes-brutalist/field',
      '@proto.ui/prototypes-brutalist/fieldset',
      '@proto.ui/prototypes-brutalist/form',
      '@proto.ui/prototypes-brutalist/image',
      '@proto.ui/prototypes-brutalist/input-otp',
      '@proto.ui/prototypes-brutalist/live-region',
      '@proto.ui/prototypes-brutalist/menubar',
      '@proto.ui/prototypes-brutalist/message-scroller',
      '@proto.ui/prototypes-brutalist/meter',
      '@proto.ui/prototypes-brutalist/navigation-menu',
      '@proto.ui/prototypes-brutalist/number-field',
      '@proto.ui/prototypes-brutalist/popover',
      '@proto.ui/prototypes-brutalist/progress',
      '@proto.ui/prototypes-brutalist/resizable',
      '@proto.ui/prototypes-brutalist/slider',
      '@proto.ui/prototypes-brutalist/table',
      '@proto.ui/prototypes-brutalist/toast',
      '@proto.ui/prototypes-brutalist/toggle-group',
      '@proto.ui/prototypes-brutalist/toolbar',
      '@proto.ui/prototypes-brutalist/tree',
      '@proto.ui/prototypes-brutalist/virtual-list',
      '@proto.ui/prototypes-liquid-glass/alert-dialog',
      '@proto.ui/prototypes-liquid-glass/async-region',
      '@proto.ui/prototypes-liquid-glass/autocomplete',
      '@proto.ui/prototypes-liquid-glass/calendar',
      '@proto.ui/prototypes-liquid-glass/carousel',
      '@proto.ui/prototypes-liquid-glass/checkbox',
      '@proto.ui/prototypes-liquid-glass/checkbox-group',
      '@proto.ui/prototypes-liquid-glass/combobox',
      '@proto.ui/prototypes-liquid-glass/command',
      '@proto.ui/prototypes-liquid-glass/context-menu',
      '@proto.ui/prototypes-liquid-glass/data-table',
      '@proto.ui/prototypes-liquid-glass/date-picker',
      '@proto.ui/prototypes-liquid-glass/dialog',
      '@proto.ui/prototypes-liquid-glass/drawer',
      '@proto.ui/prototypes-liquid-glass/dropdown',
      '@proto.ui/prototypes-liquid-glass/field',
      '@proto.ui/prototypes-liquid-glass/fieldset',
      '@proto.ui/prototypes-liquid-glass/form',
      '@proto.ui/prototypes-liquid-glass/hover-card',
      '@proto.ui/prototypes-liquid-glass/image',
      '@proto.ui/prototypes-liquid-glass/input',
      '@proto.ui/prototypes-liquid-glass/input-otp',
      '@proto.ui/prototypes-liquid-glass/live-region',
      '@proto.ui/prototypes-liquid-glass/menubar',
      '@proto.ui/prototypes-liquid-glass/message-scroller',
      '@proto.ui/prototypes-liquid-glass/meter',
      '@proto.ui/prototypes-liquid-glass/navigation-menu',
      '@proto.ui/prototypes-liquid-glass/number-field',
      '@proto.ui/prototypes-liquid-glass/popover',
      '@proto.ui/prototypes-liquid-glass/progress',
      '@proto.ui/prototypes-liquid-glass/radio-group',
      '@proto.ui/prototypes-liquid-glass/resizable',
      '@proto.ui/prototypes-liquid-glass/scroll-area',
      '@proto.ui/prototypes-liquid-glass/select',
      '@proto.ui/prototypes-liquid-glass/separator',
      '@proto.ui/prototypes-liquid-glass/slider',
      '@proto.ui/prototypes-liquid-glass/switch',
      '@proto.ui/prototypes-liquid-glass/table',
      '@proto.ui/prototypes-liquid-glass/tabs',
      '@proto.ui/prototypes-liquid-glass/textarea',
      '@proto.ui/prototypes-liquid-glass/toast',
      '@proto.ui/prototypes-liquid-glass/toggle-group',
      '@proto.ui/prototypes-liquid-glass/toolbar',
      '@proto.ui/prototypes-liquid-glass/tooltip',
      '@proto.ui/prototypes-liquid-glass/transition',
      '@proto.ui/prototypes-liquid-glass/tree',
      '@proto.ui/prototypes-liquid-glass/virtual-list',
      '@proto.ui/prototypes-shadcn/alert-dialog',
      '@proto.ui/prototypes-shadcn/async-region',
      '@proto.ui/prototypes-shadcn/autocomplete',
      '@proto.ui/prototypes-shadcn/calendar',
      '@proto.ui/prototypes-shadcn/carousel',
      '@proto.ui/prototypes-shadcn/checkbox-group',
      '@proto.ui/prototypes-shadcn/combobox',
      '@proto.ui/prototypes-shadcn/command',
      '@proto.ui/prototypes-shadcn/context-menu',
      '@proto.ui/prototypes-shadcn/data-table',
      '@proto.ui/prototypes-shadcn/date-picker',
      '@proto.ui/prototypes-shadcn/drawer',
      '@proto.ui/prototypes-shadcn/dropdown',
      '@proto.ui/prototypes-shadcn/field',
      '@proto.ui/prototypes-shadcn/fieldset',
      '@proto.ui/prototypes-shadcn/form',
      '@proto.ui/prototypes-shadcn/image',
      '@proto.ui/prototypes-shadcn/input-otp',
      '@proto.ui/prototypes-shadcn/input-shell',
      '@proto.ui/prototypes-shadcn/live-region',
      '@proto.ui/prototypes-shadcn/menubar',
      '@proto.ui/prototypes-shadcn/message-scroller',
      '@proto.ui/prototypes-shadcn/meter',
      '@proto.ui/prototypes-shadcn/navigation-menu',
      '@proto.ui/prototypes-shadcn/number-field',
      '@proto.ui/prototypes-shadcn/popover',
      '@proto.ui/prototypes-shadcn/progress',
      '@proto.ui/prototypes-shadcn/resizable',
      '@proto.ui/prototypes-shadcn/select',
      '@proto.ui/prototypes-shadcn/slider',
      '@proto.ui/prototypes-shadcn/table',
      '@proto.ui/prototypes-shadcn/tabs',
      '@proto.ui/prototypes-shadcn/toast',
      '@proto.ui/prototypes-shadcn/toggle-group',
      '@proto.ui/prototypes-shadcn/toolbar',
      '@proto.ui/prototypes-shadcn/transition',
      '@proto.ui/prototypes-shadcn/tree',
      '@proto.ui/prototypes-shadcn/virtual-list',
    ]),
  }),
  'apps/www/src/components/BrutalistPageStyle.astro': Object.freeze({
    resolvedPaths: Object.freeze(['packages/prototypes/brutalist/src/theme']),
  }),
  'apps/www/src/components/PrototypePreviewer/projection-theme.ts': Object.freeze({
    resolvedPaths: Object.freeze([
      'packages/prototypes/brutalist/src/theme',
      'packages/prototypes/bootstrap-2-3-2/src/theme',
      'packages/prototypes/liquid-glass/src/theme',
      'packages/prototypes/shadcn/src/text/typography',
    ]),
  }),
  'apps/www/src/components/PrototypePreviewer/canonical-motion-palette.ts': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/adapter-base', '@proto.ui/module-feedback']),
  }),
  'apps/www/src/components/LucideIconGallery.astro': Object.freeze({
    specifierPrefixes: Object.freeze(['@proto.ui/prototypes-lucide']),
  }),
  // Exact reviewed Hero glyph source and fixed icon; no general icon allowance.
  'apps/www/src/components/Homepage/home-action-icons.ts': Object.freeze({
    sourceSha256: 'f06c052c540bab9e1b8e4b2b9cb14320241bb5bfbe2dee15cc2435a5f2ee1c0c',
    specifiers: Object.freeze(['@proto.ui/prototypes-lucide/icons/arrow-right']),
  }),
  'apps/www/src/components/Homepage/homepage-gallery-icons.ts': Object.freeze({
    sourceSha256: '29b2d2041176aaa91fd68934b9869835482a16e7beafb99937c448f6ccd66fff',
    specifiers: Object.freeze([
      '@proto.ui/prototypes-lucide/icons/activity',
      '@proto.ui/prototypes-lucide/icons/arrow-right',
      '@proto.ui/prototypes-lucide/icons/bell',
      '@proto.ui/prototypes-lucide/icons/blocks',
      '@proto.ui/prototypes-lucide/icons/book-open',
      '@proto.ui/prototypes-lucide/icons/box',
      '@proto.ui/prototypes-lucide/icons/chart-no-axes-column-increasing',
      '@proto.ui/prototypes-lucide/icons/circle-question-mark',
      '@proto.ui/prototypes-lucide/icons/code',
      '@proto.ui/prototypes-lucide/icons/compass',
      '@proto.ui/prototypes-lucide/icons/cpu',
      '@proto.ui/prototypes-lucide/icons/globe',
      '@proto.ui/prototypes-lucide/icons/layers',
      '@proto.ui/prototypes-lucide/icons/layout-grid',
      '@proto.ui/prototypes-lucide/icons/mouse-pointer-click',
      '@proto.ui/prototypes-lucide/icons/palette',
      '@proto.ui/prototypes-lucide/icons/plus',
      '@proto.ui/prototypes-lucide/icons/scan-search',
      '@proto.ui/prototypes-lucide/icons/settings-2',
      '@proto.ui/prototypes-lucide/icons/shield',
      '@proto.ui/prototypes-lucide/icons/sliders-horizontal',
      '@proto.ui/prototypes-lucide/icons/sparkles',
      '@proto.ui/prototypes-lucide/icons/square-check-big',
      '@proto.ui/prototypes-lucide/icons/terminal',
      '@proto.ui/prototypes-lucide/icons/text-cursor-input',
      '@proto.ui/prototypes-lucide/icons/workflow',
      '@proto.ui/prototypes-lucide/icons/wrench',
    ]),
  }),
  'apps/www/src/components/StaticLucideIcon.astro': Object.freeze({
    specifierPrefixes: Object.freeze(['@proto.ui/prototypes-lucide']),
  }),
  'apps/www/src/components/site-shadcn-controls.ts': Object.freeze({
    sourceSha256: '13adc1a8fbbc2ef61dc40c4c11d7c96c8c3e276373596b53f8bdc95e9baa2b00',
    specifiers: Object.freeze([
      '@proto.ui/adapter-web-component',
      '@proto.ui/prototypes-bootstrap-2-3-2/button',
      '@proto.ui/prototypes-bootstrap-2-3-2/select',
      '@proto.ui/prototypes-liquid-glass/button',
      '@proto.ui/prototypes-shadcn/button',
      '@proto.ui/prototypes-shadcn/select',
      '@proto.ui/prototypes-brutalist/button',
      '@proto.ui/prototypes-brutalist/select',
    ]),
  }),
  // Accepted documentation-media bridge (#787/#797). These are exact source
  // imports, not a family-wide or active-SVG admission.
  'apps/www/src/components/documentation-image-controls.ts': Object.freeze({
    sourceSha256: 'c116f197edd97a5e8762c12b224723bb58566ce7fbd2c20d8fe9087eee383ba6',
    specifiers: Object.freeze([
      '@proto.ui/adapter-web-component',
      '@proto.ui/prototypes-shadcn/button',
      '@proto.ui/prototypes-shadcn/dialog',
      '@proto.ui/prototypes-brutalist/button',
      '@proto.ui/prototypes-brutalist/dialog',
      '@proto.ui/prototypes-brutalist/theme',
      '@proto.ui/prototypes-base/button',
      '@proto.ui/prototypes-base/dialog',
      '@proto.ui/prototypes-shadcn/surface',
      '@proto.ui/prototypes-brutalist/surface',
      '@proto.ui/prototypes-shadcn/text',
      '@proto.ui/prototypes-brutalist/text',
    ]),
  }),
  'apps/www/src/pages/en/test/liquid-glass-material.astro': Object.freeze({
    specifiers: Object.freeze([
      '@proto.ui/prototypes-liquid-glass/button',
      '@proto.ui/adapter-base/web-material',
    ]),
    resolvedPaths: Object.freeze([
      'packages/prototypes/liquid-glass/src/theme',
      'packages/adapters/base/src/material/program-pool',
      'packages/adapters/base/src/material/program',
      'packages/adapters/base/src/material/style',
    ]),
  }),
  // Bounded four-runtime fixture of the actual eight Bootstrap source parts.
  // Its authored commands remain separately blocked consumer compositions.
  'apps/www/src/pages/en/test/bootstrap-state-controls.astro': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/prototypes-bootstrap-2-3-2']),
    resolvedPaths: Object.freeze(['packages/prototypes/bootstrap-2-3-2/src/theme']),
  }),
  'apps/www/src/pages/en/test/new-projection-families.astro': Object.freeze({
    specifiers: Object.freeze([
      '@proto.ui/prototypes-bootstrap-2-3-2/button',
      '@proto.ui/prototypes-liquid-glass/button',
    ]),
    resolvedPaths: Object.freeze([
      'packages/prototypes/bootstrap-2-3-2/src/theme',
      'packages/prototypes/liquid-glass/src/theme',
    ]),
  }),
  // The resource supplies `url` only after same-origin HTTP(S) validation.
  // Neither the importer nor its URL-construction companion may drift alone.
  'apps/www/src/components/site-search-owner.ts': Object.freeze({
    viteIgnoredDynamicImports: Object.freeze(['url']),
    sourceSha256: 'aa4d3cc13174e2e9d62b557d81a8cf192483b669217af733332d22d42842f580',
    companionSource: Object.freeze({
      path: 'apps/www/src/components/site-pagefind-resource.ts',
      sha256: '1af8170a8e53e5b06f8583d13a8a4b7680e178abeccbffd04237ecb3a885b02a',
    }),
  }),
});

export const HARNESS_REVIEWED_THIRD_PARTY_SCRIPT_IMPORTS = new Set(['react']);
export const HARNESS_GENERATED_FACADE_SOURCE_PATHS = new Set([
  'proto-ui/components/index.ts',
  'proto-ui/components/react/index.ts',
  'proto-ui/components/vue/index.ts',
  'proto-ui/components/wc/index.ts',
]);
const NODE_BUILTIN_SPECIFIERS = new Set(
  builtinModules.map((specifier) => specifier.replace(/^node:/u, ''))
);

export function isReviewedHarnessThirdPartyPackage(sourcePath, specifier) {
  return (
    /\.[cm]?[jt]sx?$/iu.test(sourcePath) &&
    HARNESS_REVIEWED_THIRD_PARTY_SCRIPT_IMPORTS.has(specifier)
  );
}

export function isNodeBuiltinSpecifier(specifier) {
  return NODE_BUILTIN_SPECIFIERS.has(specifier.replace(/^node:/u, '').split('/')[0]);
}

export function isGeneratedHarnessFacadeSource(relativeToHarnessSource) {
  return HARNESS_GENERATED_FACADE_SOURCE_PATHS.has(relativeToHarnessSource);
}
export const HARNESS_RAW_IMPORT_ALLOWLIST = Object.freeze({
  // M0 policy for the planned Harness bootstrap (dogfood row
  // harness.infrastructure.react-bootstrap, #533). The Harness app does not
  // exist at this revision, so this entry admits nothing today and is not an
  // earned admission; it is not prior approval for a file that later appears at
  // this path. Any prototype/facade entry must be admitted here exactly in the
  // same change that approves it, and this entry must be re-admitted with the
  // Harness application's own review under #533.
  'apps/agent-harness/src/proto-ui/bootstrap.tsx': Object.freeze({
    specifiers: Object.freeze(['@proto.ui/adapter-react']),
  }),
});
