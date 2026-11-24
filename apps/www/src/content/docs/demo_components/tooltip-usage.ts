import type { CodeExampleFile } from '@/components/code-example-types';
import type { PublicRuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

type TooltipFamily = 'base' | 'shadcn' | 'brutalist';
type TooltipFiles = Record<PublicRuntimeId, readonly CodeExampleFile[]>;

const parts = ['Group', 'Root', 'Trigger', 'Content'] as const;
const examples = [
  ['Account', 'View account settings and profile details.'],
  ['Notifications', 'Review recent alerts and notification preferences.'],
] as const;

const families = {
  base: { prefix: 'Base', tag: 'app-base-tooltip', open: 500, close: 150, skip: 700, offset: 8 },
  shadcn: {
    prefix: 'Shadcn',
    tag: 'proto-ui-shadcn-tooltip',
    open: 700,
    close: 100,
    skip: 300,
    offset: 4,
  },
  brutalist: {
    prefix: 'Brutalist',
    tag: 'app-brutalist-tooltip',
    open: 700,
    close: 100,
    skip: 300,
    offset: 4,
  },
} as const;

const styledFamilyStyles = `/* Application-owned layout and passive Trigger presentation. */
.tooltip-examples { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; padding: 3rem 1rem; }
.tooltip-example-trigger { display: inline-flex; border: 1px solid currentColor; border-radius: 0.375rem; padding: 0.5rem 0.75rem; font: inherit; font-size: 0.875rem; }
.tooltip-example-trigger:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }`;

const baseStyles = `${styledFamilyStyles}
/* Base has no family paint. Presence and positioning still come from Proto UI. */
.base-tooltip-content { max-width: 20rem; border-radius: 0.375rem; background: #111827; color: #fff; padding: 0.375rem 0.75rem; font: 0.75rem/1.5 system-ui, sans-serif; }`;

function prototypeImport(family: Exclude<TooltipFamily, 'shadcn'>): string {
  const names = parts.map((part) =>
    family === 'base' ? `  tooltip${part},` : `  BrutalistTooltip${part} as tooltip${part},`
  );
  return `import {\n${names.join('\n')}\n} from '@proto.ui/prototypes-${family}/tooltip';`;
}

function imports(family: TooltipFamily, host: PublicRuntimeId): string {
  const css = "import './styles/proto-ui-style.css';\nimport './tooltip-demo.css';";
  if (family === 'shadcn') {
    if (host === 'wc') {
      return `${css}\nimport { setElementProps } from '@proto.ui/adapter-web-component';\nimport '../proto-ui/components/wc';`;
    }
    return `${css}\nimport {\n${parts.map((part) => `  ShadcnTooltip${part},`).join('\n')}\n} from '../proto-ui/components/${host}';`;
  }

  if (host === 'wc') {
    const registrations = parts.map(
      (part) =>
        `AdaptToWebComponent(tooltip${part}, { registerAs: '${families[family].tag}-${part.toLowerCase()}' });`
    );
    return `${css}\nimport { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';\n${prototypeImport(family)}\n\n${registrations.join('\n')}`;
  }

  const adapter =
    host === 'react'
      ? `import * as React from 'react';
import { createPortal } from 'react-dom';
import { createReactAdapter } from '@proto.ui/adapter-react';`
      : host === 'vue'
        ? `import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';`
        : `import Vue from 'vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';`;
  const create =
    host === 'react'
      ? 'const adapt = createReactAdapter({ ...React, createPortal });'
      : host === 'vue'
        ? 'const adapt = createVueAdapter(Vue);'
        : `const adapt = createVue2Adapter({
  extend: Vue.extend.bind(Vue),
  nextTick: Vue.nextTick.bind(Vue),
  set: Vue.set.bind(Vue),
  delete: Vue.delete.bind(Vue),
});`;
  return `${css}\n${adapter}\n${prototypeImport(family)}\n\n${create}\n${parts.map((part) => `const ${families[family].prefix}Tooltip${part} = adapt(tooltip${part});`).join('\n')}`;
}

function template(family: TooltipFamily, host: PublicRuntimeId): string {
  const { prefix, tag, open, close, skip, offset } = families[family];
  const wc = host === 'wc';
  const react = host === 'react';
  const name = (part: (typeof parts)[number]) =>
    wc ? `${tag}-${part.toLowerCase()}` : `${prefix}Tooltip${part}`;
  const className = react ? 'className' : 'class';
  const groupProps = wc
    ? 'id="tooltip-example-group"'
    : react
      ? `openDelay={${open}} closeDelay={${close}} skipDelay={${skip}}`
      : `:open-delay="${open}" :close-delay="${close}" :skip-delay="${skip}"`;
  const profile =
    family === 'shadcn' && !wc ? (react ? ' styleProfile="rhea"' : ' style-profile="rhea"') : '';
  const contentProps = [
    family === 'base' ? `${className}="base-tooltip-content"` : '',
    wc ? '' : react ? `side="top" sideOffset={${offset}}` : `side="top" :side-offset="${offset}"`,
  ]
    .filter(Boolean)
    .join(' ');
  const roots = examples.map(
    ([label, description]) => `  <${name('Root')}>
    <${name('Trigger')} ${className}="tooltip-example-trigger"${profile}>${label}</${name('Trigger')}>
    <${name('Content')}${contentProps ? ` ${contentProps}` : ''}${profile}>${description}</${name('Content')}>
  </${name('Root')}>`
  );
  return `<${name('Group')} ${className}="tooltip-examples" ${groupProps}>\n${roots.join('\n')}\n</${name('Group')}>`;
}

function createTooltipFiles(family: TooltipFamily): TooltipFiles {
  const { prefix, tag, open, close, skip, offset } = families[family];
  const stylesheet: CodeExampleFile = {
    name: 'src/tooltip-demo.css',
    lang: 'css',
    code: family === 'base' ? baseStyles : styledFamilyStyles,
  };
  const wcSetup = `const group = document.querySelector('#tooltip-example-group');
if (!(group instanceof HTMLElement)) throw new Error('Missing Tooltip Group');
setElementProps(group, { openDelay: ${open}, closeDelay: ${close}, skipDelay: ${skip} });
for (const content of document.querySelectorAll('${tag}-content')) {
  if (!(content instanceof HTMLElement)) throw new Error('Missing Tooltip Content');
  setElementProps(content, { side: 'top', sideOffset: ${offset}${family === 'shadcn' ? ", styleProfile: 'rhea'" : ''} });
}${
    family === 'shadcn'
      ? `
for (const trigger of document.querySelectorAll('${tag}-trigger')) {
  if (!(trigger instanceof HTMLElement)) throw new Error('Missing Tooltip Trigger');
  setElementProps(trigger, { styleProfile: 'rhea' });
}`
      : ''
  }`;
  return {
    wc: [
      { name: 'src/main.ts', lang: 'typescript', code: `${imports(family, 'wc')}\n\n${wcSetup}` },
      {
        name: 'index.html',
        lang: 'html',
        code: `${template(family, 'wc')}\n<script type="module" src="/src/main.ts"></script>`,
      },
      stylesheet,
    ],
    react: [
      {
        name: 'src/App.tsx',
        lang: 'tsx',
        code: `${imports(family, 'react')}\n\nexport default function App() {\n  return (\n${template(
          family,
          'react'
        )
          .split('\n')
          .map((line) => `    ${line}`)
          .join('\n')}\n  );\n}`,
      },
      stylesheet,
    ],
    vue: [
      {
        name: 'src/App.vue',
        lang: 'vue',
        code: `<script setup lang="ts">\n${imports(family, 'vue')}\n</script>\n\n<template>\n${template(
          family,
          'vue'
        )
          .split('\n')
          .map((line) => `  ${line}`)
          .join('\n')}\n</template>`,
      },
      stylesheet,
    ],
    vue2: [
      {
        name: 'src/App.vue',
        lang: 'vue',
        code: `<script>\n${imports(family, 'vue2')}\n\nexport default {\n  components: { ${parts.map((part) => `${prefix}Tooltip${part}`).join(', ')} },\n};\n</script>\n\n<template>\n${template(
          family,
          'vue2'
        )
          .split('\n')
          .map((line) => `  ${line}`)
          .join('\n')}\n</template>`,
      },
      stylesheet,
    ],
  };
}

/** Base and Brutalist have public package exports, but no CLI add target. */
export const baseTooltipFiles = createTooltipFiles('base');
export const brutalistTooltipFiles = createTooltipFiles('brutalist');
/** These local facade names are emitted by the existing shadcn-tooltip CLI entry. */
export const shadcnTooltipFiles = createTooltipFiles('shadcn');
