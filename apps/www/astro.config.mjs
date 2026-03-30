// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import starlight from '@astrojs/starlight';

import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { rehypeEnhancedImage } from './src/utils/rehype-enhanced-image.js';

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
        // 1) 体验承接：从 Landing Demo 过来的人，先看这里
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

        // 2) 结构入口：少而精
        {
          label: 'Project',
          translations: { en: 'Project', 'zh-CN': '项目' },
          items: [
            {
              label: '项目介绍',
              translations: { en: 'Project Introduction', 'zh-CN': '项目介绍' },
              slug: 'project/introduction',
              badge: inProgressBadge,
            },
            {
              label: '为什么会有 Proto UI',
              translations: { en: 'Why Proto UI', 'zh-CN': '为什么会有 Proto UI' },
              slug: 'project/why',
              badge: inProgressBadge,
            },
            {
              label: 'Proto UI 不做什么',
              translations: { en: 'What Proto UI Does Not Do', 'zh-CN': 'Proto UI 不做什么' },
              slug: 'project/what-proto-ui-does-not-do',
              badge: inProgressBadge,
            },
            {
              label: '时间线 & 里程碑',
              translations: { en: 'Milestones', 'zh-CN': '里程碑' },
              slug: 'project/milestones',
            },
          ],
        },

        // 3) 白皮书：扁平化，不要再往下分三级
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

        // 4) 规范层：把 contracts 从“讲道理”里剥离出来
        {
          label: 'Specifications',
          translations: { en: 'Specifications', 'zh-CN': '规范（契约）' },
          items: [
            {
              label: '规范导读',
              translations: { en: 'How to Read Specs', 'zh-CN': '规范导读' },
              slug: 'specs/introduction',
              badge: inProgressBadge,
            },
            {
              label: '核心规范',
              translations: { en: 'Core', 'zh-CN': '核心' },
              slug: 'specs/core',
              badge: inProgressBadge,
            },
            {
              label: 'Props',
              translations: { en: 'Props', 'zh-CN': 'Props' },
              slug: 'specs/props',
              badge: inProgressBadge,
            },
            {
              label: 'Event',
              translations: { en: 'Event', 'zh-CN': 'Event' },
              slug: 'specs/event',
              badge: inProgressBadge,
            },
            {
              label: 'Expose',
              translations: { en: 'Expose', 'zh-CN': 'Expose' },
              slug: 'specs/expose',
              badge: inProgressBadge,
            },
            {
              label: 'State',
              translations: { en: 'State', 'zh-CN': 'State' },
              slug: 'specs/state',
              badge: inProgressBadge,
            },
            {
              label: 'Context',
              translations: { en: 'Context', 'zh-CN': 'Context' },
              slug: 'specs/context',
              badge: inProgressBadge,
            },
            {
              label: 'Feedback',
              translations: { en: 'Feedback', 'zh-CN': 'Feedback' },
              slug: 'specs/feedback',
              badge: inProgressBadge,
            },
            {
              label: 'asHook',
              translations: { en: 'asHook', 'zh-CN': 'asHook' },
              slug: 'specs/as-hook',
              badge: inProgressBadge,
            },
            {
              label: 'Rule',
              translations: { en: 'Rule', 'zh-CN': 'Rule' },
              slug: 'specs/rule',
              badge: inProgressBadge,
            },
          ],
        },

        // 5) 工程实现：给 maintainer / adapter 作者
        {
          label: 'Engineering',
          translations: { en: 'Engineering', 'zh-CN': '工程实现' },
          items: [
            {
              label: '工程导读',
              translations: { en: 'Engineering Introduction', 'zh-CN': '工程导读' },
              slug: 'engineering/introduction',
              badge: inProgressBadge,
            },
            {
              label: 'Runtime 架构',
              translations: { en: 'Runtime Architecture', 'zh-CN': 'Runtime 架构' },
              slug: 'engineering/runtime-architecture',
              badge: inProgressBadge,
            },
            {
              label: 'Prototype API',
              translations: { en: 'Prototype API', 'zh-CN': 'Prototype API' },
              slug: 'engineering/prototype-api',
              badge: inProgressBadge,
            },
            {
              label: 'Adapter Guide',
              translations: { en: 'Adapter Guide', 'zh-CN': 'Adapter 指南' },
              slug: 'engineering/adapter-guide',
              badge: inProgressBadge,
            },
            {
              label: 'Compiler Guide',
              translations: { en: 'Compiler Guide', 'zh-CN': 'Compiler 指南' },
              slug: 'engineering/compiler-guide',
              badge: inProgressBadge,
            },
            {
              label: 'Host Caps',
              translations: { en: 'Host Caps', 'zh-CN': 'Host Caps' },
              slug: 'engineering/host-caps',
              badge: inProgressBadge,
            },
            {
              label: '模块与扩展架构',
              translations: { en: 'Module & Extension Architecture', 'zh-CN': '模块与扩展架构' },
              slug: 'engineering/module-extension-architecture',
              badge: inProgressBadge,
            },
          ],
        },

        // 6) 原型库：建议作为独立大类，且支持 autogenerate
        {
          label: 'Prototypes',
          translations: { en: 'Prototypes', 'zh-CN': '原型库' },
          items: [
            {
              label: 'Base Library',
              translations: { en: 'Base Library', 'zh-CN': '基础原型库' },
              slug: 'prototypes/base',
            },
            {
              label: 'Shadcn Library',
              translations: { en: 'Shadcn Library', 'zh-CN': 'Shadcn 原型库' },
              slug: 'prototypes/shadcn',
            },
            {
              label: 'Advanced Examples',
              translations: { en: 'Advanced Examples', 'zh-CN': '高级示例' },
              slug: 'prototypes/advanced',
              badge: inProgressBadge,
            },
            {
              label: '全部条目',
              translations: { en: 'All Entries', 'zh-CN': '全部条目' },
              autogenerate: { directory: 'reference/prototypes' },
            },
          ],
        },

        // 7) 生态：面向想理解或参与 Proto UI 生态建设的人
        {
          label: 'Ecosystem',
          translations: { en: 'Ecosystem', 'zh-CN': '生态建设' },
          items: [
            {
              label: '生态导读',
              translations: { en: 'Ecosystem Introduction', 'zh-CN': '生态导读' },
              slug: 'ecosystem',
              badge: inProgressBadge,
            },
            {
              label: '如何参与贡献',
              translations: { en: 'How to Contribute', 'zh-CN': '如何参与贡献' },
              slug: 'ecosystem/contribute',
              badge: inProgressBadge,
            },
            {
              label: '编写原型',
              translations: { en: 'Write a Prototype', 'zh-CN': '编写原型' },
              slug: 'ecosystem/write-prototype',
              badge: inProgressBadge,
            },
            {
              label: '编写适配器',
              translations: { en: 'Write an Adapter', 'zh-CN': '编写适配器' },
              slug: 'ecosystem/write-adapter',
              badge: inProgressBadge,
            },
            {
              label: '契约与测试',
              translations: { en: 'Contracts & Tests', 'zh-CN': '契约与测试' },
              slug: 'ecosystem/contracts',
              badge: inProgressBadge,
            },
            {
              label: '原型库（概览）',
              translations: { en: 'Prototype Library (Overview)', 'zh-CN': '原型库（概览）' },
              slug: 'ecosystem/prototypes',
              badge: inProgressBadge,
            },
            {
              label: '适配器库（概览）',
              translations: { en: 'Adapter Library (Overview)', 'zh-CN': '适配器库（概览）' },
              slug: 'ecosystem/adapters',
              badge: inProgressBadge,
            },
            {
              label: '生态建设方向',
              translations: { en: 'Ecosystem Roadmap', 'zh-CN': '生态建设方向' },
              slug: 'ecosystem/roadmap',
              badge: inProgressBadge,
            },
          ],
        },
        {
          label: '原型库',
          translations: { en: 'Prototype Libraries', 'zh-CN': '原型库' },
          autogenerate: {
            directory: 'reference/prototypes',
          },
        },
        {
          label: 'Wiki',
          translations: { en: 'Wiki', 'zh-CN': 'Wiki' },
          items: [
            {
              label: 'Wiki 导读',
              translations: { en: 'Wiki Overview', 'zh-CN': 'Wiki 导读' },
              slug: 'wiki',
            },
            {
              label: 'asHook',
              translations: { en: 'asHook', 'zh-CN': 'asHook' },
              slug: 'wiki/as-hook',
            },
            {
              label: 'Anatomy',
              translations: { en: 'Anatomy', 'zh-CN': 'Anatomy' },
              slug: 'wiki/anatomy',
            },
            {
              label: 'Rule',
              translations: { en: 'Rule', 'zh-CN': 'Rule' },
              slug: 'wiki/rule',
            },
            {
              label: 'Style Token',
              translations: { en: 'Style Token', 'zh-CN': 'Style Token' },
              slug: 'wiki/style-tokens',
            },
            {
              label: '核心能力',
              translations: { en: 'Core Capabilities', 'zh-CN': '核心能力' },
              slug: 'wiki/core-capabilities',
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
    plugins: [tailwindcss()],
  },
});
