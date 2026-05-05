// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import starlight from '@astrojs/starlight';
import remarkDirective from 'remark-directive';

import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { rehypeEnhancedImage } from './src/utils/rehype-enhanced-image.js';
import { remarkConceptDirective } from './src/utils/remark-concept-directive.js';

const inProgressBadge = {
  text: { en: 'WIP', 'zh-CN': '施工中' },
  class:
    'text-xs px-1.5 h-4.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100',
};
// https://astro.build/config
export default defineConfig({
  site: 'https://www.proto-ui.com',
  integrations: [
    starlight({
      title: 'Proto UI',

      defaultLocale: 'zh-cn',
      locales: {
        en: {
          label: 'English',
        },

        'zh-cn': {
          label: '简体中文',
          lang: 'zh-CN',
        },
      },
      head: [
        // 双 theme-color
        {
          tag: 'script',
          attrs: {
            type: 'importmap',
          },
          content: `
          {
            "imports": {
              "react": "https://esm.sh/react@18",
              "react-dom/client": "https://esm.sh/react-dom@18/client",
              "vue": "https://esm.sh/vue@3"
            }
          }
          `,
        },
        {
          tag: 'meta',
          attrs: {
            name: 'theme-color',
            content: '#ffffff',
            media: '(prefers-color-scheme: light)',
          },
        },
        {
          tag: 'meta',
          attrs: { name: 'theme-color', content: '#0a0a0a', media: '(prefers-color-scheme: dark)' },
        },
      ],
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/withastro/starlight' }],
      sidebar: [
        {
          label: 'Start Here',
          translations: { en: 'Start Here', 'zh-CN': '从这里开始' },
          items: [
            {
              label: '你刚刚看到的是什么？',
              translations: { en: 'What You Just Saw', 'zh-CN': '你刚刚看到的是什么？' },
              slug: 'start-here/what-you-saw',
            },
            {
              label: 'Why Proto UI',
              translations: {
                en: 'Why Proto UI',
                'zh-CN': 'Why Proto UI',
              },
              slug: 'start-here/why-proto-ui',
            },
            {
              label: '它是怎么工作的？',
              translations: {
                en: 'How It Works',
                'zh-CN': '它是怎么工作的？',
              },
              slug: 'start-here/how-it-works',
            },
            {
              label: '快速开始',
              translations: {
                en: 'Quick Start',
                'zh-CN': '快速开始',
              },
              slug: 'start-here/quick-start',
            },
          ],
        },
        {
          label: 'Whitepaper',
          translations: { en: 'Whitepaper', 'zh-CN': '白皮书' },
          items: [
            {
              label: '组件作为协议',
              translations: { en: 'Component as Protocol', 'zh-CN': '组件作为协议' },
              slug: 'whitepaper/component-as-protocol',
            },
            {
              label: '信息通路模型',
              translations: { en: 'Information Flow Model', 'zh-CN': '信息通路模型' },
              slug: 'whitepaper/information-flow-model',
            },
            {
              label: '原型边界',
              translations: {
                en: 'Prototype Boundary',
                'zh-CN': '原型边界',
              },
              slug: 'whitepaper/prototype-boundary',
            },
            {
              label: '执行语义',
              translations: { en: 'Execution Semantics', 'zh-CN': '执行语义' },
              slug: 'whitepaper/execution-semantics',
            },
            {
              label: '翻译层',
              translations: { en: 'Translation Layer', 'zh-CN': '翻译层' },
              slug: 'whitepaper/translation-layer',
            },
            {
              label: '设计约束',
              translations: { en: 'Design Constraints', 'zh-CN': '设计约束' },
              slug: 'whitepaper/design-constraints',
            },
            {
              label: '演进路径',
              translations: { en: 'Evolution Path', 'zh-CN': '演进路径' },
              slug: 'whitepaper/evolution-path',
            },
            {
              label: 'FAQ',
              translations: { en: 'FAQ', 'zh-CN': 'FAQ' },
              slug: 'whitepaper/faq',
            },
          ],
        },
        {
          label: 'UI Libraries',
          translations: { en: 'UI Libraries', 'zh-CN': 'UI Libraries' },
          items: [
            {
              label: 'Overview',
              translations: { en: 'Overview', 'zh-CN': '概览' },
              slug: 'ui-libraries',
            },
            {
              label: 'Base',
              translations: { en: 'Base', 'zh-CN': 'Base' },
              items: [
                {
                  label: 'Overview',
                  translations: { en: 'Overview', 'zh-CN': '概览' },
                  slug: 'ui-libraries/base',
                },
                {
                  label: 'Hover Card',
                  translations: { en: 'Hover Card', 'zh-CN': 'Hover Card' },
                  slug: 'ui-libraries/base/hover-card',
                },
                {
                  label: 'Dialog',
                  translations: { en: 'Dialog', 'zh-CN': 'Dialog' },
                  slug: 'ui-libraries/base/dialog',
                },
                {
                  label: 'Transition',
                  translations: { en: 'Transition', 'zh-CN': 'Transition' },
                  slug: 'ui-libraries/base/transition',
                },
                {
                  label: 'Select',
                  translations: { en: 'Select', 'zh-CN': 'Select' },
                  slug: 'ui-libraries/base/select',
                },
              ],
            },
            {
              label: 'Shadcn',
              translations: { en: 'Shadcn', 'zh-CN': 'Shadcn' },
              items: [
                {
                  label: 'Overview',
                  translations: { en: 'Overview', 'zh-CN': '概览' },
                  slug: 'ui-libraries/shadcn',
                },
                {
                  label: 'Button',
                  translations: { en: 'Button', 'zh-CN': 'Button' },
                  slug: 'ui-libraries/shadcn/button',
                },
                {
                  label: 'Dropdown Menu',
                  translations: { en: 'Dropdown Menu', 'zh-CN': 'Dropdown Menu' },
                  slug: 'ui-libraries/shadcn/dropdown-menu',
                },
                {
                  label: 'Hover Card',
                  translations: { en: 'Hover Card', 'zh-CN': 'Hover Card' },
                  slug: 'ui-libraries/shadcn/hover-card',
                },
                {
                  label: 'Switch',
                  translations: { en: 'Switch', 'zh-CN': 'Switch' },
                  slug: 'ui-libraries/shadcn/switch',
                },
                {
                  label: 'Tabs',
                  translations: { en: 'Tabs', 'zh-CN': 'Tabs' },
                  slug: 'ui-libraries/shadcn/tabs',
                },
                {
                  label: 'Toggle',
                  translations: { en: 'Toggle', 'zh-CN': 'Toggle' },
                  slug: 'ui-libraries/shadcn/toggle',
                },
              ],
            },
            {
              label: 'Lucide',
              translations: { en: 'Lucide', 'zh-CN': 'Lucide' },
              items: [
                {
                  label: 'Overview',
                  translations: { en: 'Overview', 'zh-CN': '概览' },
                  slug: 'ui-libraries/lucide',
                },
                {
                  label: 'Icons',
                  translations: { en: 'Icons', 'zh-CN': '图标列表' },
                  slug: 'ui-libraries/lucide/icons',
                },
              ],
            },
          ],
        },
        {
          label: 'Build',
          translations: { en: 'Build', 'zh-CN': '构建' },
          items: [
            {
              label: 'Overview',
              translations: { en: 'Overview', 'zh-CN': '概览' },
              slug: 'build',
              badge: inProgressBadge,
            },
            {
              label: 'Prototypes',
              translations: { en: 'Prototypes', 'zh-CN': '原型专题' },
              items: [
                {
                  label: 'Overview',
                  translations: { en: 'Overview', 'zh-CN': '概览' },
                  slug: 'build/prototypes',
                },
                {
                  label: 'When Not To Write A New Prototype',
                  translations: {
                    en: 'When Not To Write A New Prototype',
                    'zh-CN': '为什么你通常不需要新写一个原型？',
                  },
                  slug: 'build/prototypes/when-not-to-write-a-new-prototype',
                },
                {
                  label: 'Writing A Custom Primitive Prototype',
                  translations: {
                    en: 'Writing A Custom Primitive Prototype',
                    'zh-CN': '编写一个定制的单体原型',
                  },
                  slug: 'build/prototypes/writing-a-custom-primitive-prototype',
                },
                {
                  label: 'Writing A Compound Prototype',
                  translations: {
                    en: 'Writing A Compound Prototype',
                    'zh-CN': '编写一个定制的复合原型',
                  },
                  slug: 'build/prototypes/writing-a-compound-prototype',
                },
                {
                  label: 'Building A Styled Library On Top Of Base',
                  translations: {
                    en: 'Building A Styled Library On Top Of Base',
                    'zh-CN': '基于 Base 长出一个带风格的原型库',
                  },
                  slug: 'build/prototypes/building-a-styled-library-on-top-of-base',
                },
                {
                  label: 'Checklist',
                  translations: { en: 'Checklist', 'zh-CN': '原型作者检查清单' },
                  slug: 'build/prototypes/checklist',
                },
                {
                  label: 'Reference Patterns',
                  translations: { en: 'Reference Patterns', 'zh-CN': '参考实现应该怎么看' },
                  slug: 'build/prototypes/reference-patterns',
                },
              ],
            },
            {
              label: 'Runtime Architecture',
              translations: { en: 'Runtime Architecture', 'zh-CN': 'Runtime 架构' },
              slug: 'build/runtime-architecture',
              badge: inProgressBadge,
            },
            {
              label: 'Adapter Guide',
              translations: { en: 'Adapter Guide', 'zh-CN': 'Adapter 指南' },
              slug: 'build/adapter-guide',
              badge: inProgressBadge,
            },
            {
              label: 'Compiler Guide',
              translations: { en: 'Compiler Guide', 'zh-CN': 'Compiler 指南' },
              slug: 'build/compiler-guide',
              badge: inProgressBadge,
            },
            {
              label: 'Host Caps',
              translations: { en: 'Host Caps', 'zh-CN': 'Host Caps' },
              slug: 'build/host-caps',
              badge: inProgressBadge,
            },
            {
              label: 'Module & Extension Architecture',
              translations: { en: 'Module & Extension Architecture', 'zh-CN': '模块与扩展架构' },
              slug: 'build/module-extension-architecture',
              badge: inProgressBadge,
            },
            {
              label: 'Contracts & Tests',
              translations: { en: 'Contracts & Tests', 'zh-CN': '契约与测试' },
              slug: 'build/contracts-and-tests',
              badge: inProgressBadge,
            },
            {
              label: 'Contribute',
              translations: { en: 'Contribute', 'zh-CN': '参与贡献' },
              slug: 'build/contribute',
            },
          ],
        },
        {
          label: 'Specifications',
          translations: { en: 'Specifications', 'zh-CN': '规范（契约）' },
          items: [
            {
              label: 'Introduction',
              translations: { en: 'Introduction', 'zh-CN': '规范导读' },
              slug: 'specifications/introduction',
              badge: inProgressBadge,
            },
            {
              label: 'Core',
              translations: { en: 'Core', 'zh-CN': '核心' },
              slug: 'specifications/core',
              badge: inProgressBadge,
            },
            {
              label: 'Props',
              translations: { en: 'Props', 'zh-CN': 'Props' },
              slug: 'specifications/props',
              badge: inProgressBadge,
            },
            {
              label: 'Event',
              translations: { en: 'Event', 'zh-CN': 'Event' },
              slug: 'specifications/event',
              badge: inProgressBadge,
            },
            {
              label: 'Expose',
              translations: { en: 'Expose', 'zh-CN': 'Expose' },
              slug: 'specifications/expose',
              badge: inProgressBadge,
            },
            {
              label: 'State',
              translations: { en: 'State', 'zh-CN': 'State' },
              slug: 'specifications/state',
              badge: inProgressBadge,
            },
            {
              label: 'Context',
              translations: { en: 'Context', 'zh-CN': 'Context' },
              slug: 'specifications/context',
              badge: inProgressBadge,
            },
            {
              label: 'Feedback',
              translations: { en: 'Feedback', 'zh-CN': 'Feedback' },
              slug: 'specifications/feedback',
              badge: inProgressBadge,
            },
            {
              label: 'asHook',
              translations: { en: 'asHook', 'zh-CN': 'asHook' },
              slug: 'specifications/as-hook',
              badge: inProgressBadge,
            },
            {
              label: 'Rule',
              translations: { en: 'Rule', 'zh-CN': 'Rule' },
              slug: 'specifications/rule',
              badge: inProgressBadge,
            },
          ],
        },
        {
          label: 'Reference',
          translations: { en: 'Reference', 'zh-CN': '参考' },
          items: [
            {
              label: 'Overview',
              translations: { en: 'Overview', 'zh-CN': '概览' },
              slug: 'reference',
              badge: inProgressBadge,
            },
            {
              label: 'Prototype API',
              translations: { en: 'Prototype API', 'zh-CN': 'Prototype API' },
              slug: 'reference/prototype-api',
              badge: inProgressBadge,
            },
            {
              label: 'Compatibility',
              translations: { en: 'Compatibility', 'zh-CN': '兼容性' },
              slug: 'reference/compatibility',
              badge: inProgressBadge,
            },
          ],
        },
        {
          label: 'Project',
          translations: { en: 'Project', 'zh-CN': '项目' },
          items: [
            {
              label: '项目介绍',
              translations: { en: 'About', 'zh-CN': '项目介绍' },
              slug: 'project/about',
            },
            {
              label: '当前状态',
              translations: { en: 'Status', 'zh-CN': '当前状态' },
              slug: 'project/status',
            },
            {
              label: '路线图',
              translations: { en: 'Roadmap', 'zh-CN': '路线图' },
              slug: 'project/roadmap',
            },
            {
              label: '相关链接',
              translations: { en: 'Links', 'zh-CN': '相关链接' },
              slug: 'project/links',
            },
          ],
        },
      ],
      components: {
        Hero: './src/components/override/Hero.astro',
        ContentPanel: './src/components/override/ContentPanel.astro',
        Header: './src/components/override/Header.astro',
        PageFrame: './src/components/override/PageFrame.astro',
        SiteTitle: './src/components/override/SiteTitle.astro',
        ThemeProvider: './src/components/override/ThemeProvider.astro',
        TableOfContents: './src/components/override/TableOfContents/TableOfContents.astro',
        TwoColumnContent: './src/components/override/TwoColumnContent.astro',
        PageTitle: './src/components/override/PageTitle.astro',
        MarkdownContent: './src/components/override/MarkdownContent.astro',
        LanguageSelect: './src/components/override/LanguageSelect.astro',
      },
    }),
    mdx(),
  ],
  markdown: {
    remarkPlugins: [remarkDirective, remarkConceptDirective],
    rehypePlugins: [rehypeEnhancedImage],
  },
  vite: {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      // 允许 dev server 读取到仓库根（否则访问 workspace 包会被拦）
      fs: { allow: ['../..'] },
    },
    // @tailwindcss/vite 的类型版本与 Astro 内部 Vite 类型可能不一致（运行时兼容即可）
    plugins: /** @type {any} */ ([tailwindcss()]),
    optimizeDeps: {
      exclude: [
        '@proto.ui/core',
        '@proto.ui/runtime',
        '@proto.ui/types',
        '@proto.ui/adapter-base',
        '@proto.ui/adapter-react',
        '@proto.ui/adapter-vue',
        '@proto.ui/adapter-web-component',
        '@proto.ui/prototypes-base',
        '@proto.ui/prototypes-shadcn',
        '@proto.ui/hooks',
        '@proto.ui/module-overlay',
        '@proto.ui/module-presence',
        '@proto.ui/module-feedback',
        '@proto.ui/module-props',
        '@proto.ui/module-event',
        '@proto.ui/module-expose',
        '@proto.ui/module-expose-state-web',
        '@proto.ui/module-rule-expose-state-web',
        '@proto.ui/module-rule-meta',
        '@proto.ui/module-context',
        '@proto.ui/module-anatomy',
        '@proto.ui/module-as-trigger',
        '@proto.ui/module-focus',
        '@proto.ui/module-base',
        '@proto.ui/module-test-sys',
      ],
    },
  },
});
