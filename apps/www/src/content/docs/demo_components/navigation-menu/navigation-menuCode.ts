import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

type FamilyMeta = {
  slug: 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass';
  prefix: string;
  tagPrefix: string;
  pkg: string;
  rheaProp: string;
  wcStyleScript: string;
  liquidExtras?: boolean;
};

const FAMILIES: readonly FamilyMeta[] = [
  {
    slug: 'shadcn',
    prefix: 'ShadcnNavigationMenu',
    tagPrefix: 'shadcn-navigation-menu',
    pkg: '@proto.ui/prototypes-shadcn/navigation-menu',
    rheaProp: ' styleProfile="rhea"',
    wcStyleScript: `styleProfile: 'rhea', `,
  },
  {
    slug: 'brutalist',
    prefix: 'BrutalistNavigationMenu',
    tagPrefix: 'brutalist-navigation-menu',
    pkg: '@proto.ui/prototypes-brutalist/navigation-menu',
    rheaProp: '',
    wcStyleScript: '',
  },
  {
    slug: 'bootstrap-2-3-2',
    prefix: 'Bootstrap232NavigationMenu',
    tagPrefix: 'bootstrap-2-3-2-navigation-menu',
    pkg: '@proto.ui/prototypes-bootstrap-2-3-2/navigation-menu',
    rheaProp: '',
    wcStyleScript: '',
  },
  {
    slug: 'liquid-glass',
    prefix: 'LiquidGlassNavigationMenu',
    tagPrefix: 'liquid-glass-navigation-menu',
    pkg: '@proto.ui/prototypes-liquid-glass/navigation-menu',
    rheaProp: '',
    wcStyleScript: '',
    liquidExtras: true,
  },
];

function buildFamilySnippets(f: FamilyMeta) {
  const { slug, prefix, tagPrefix, rheaProp, wcStyleScript, liquidExtras } = f;
  const R = `${prefix}Root`;
  const T = `${prefix}Trigger`;
  const C = `${prefix}Content`;
  const I = `${prefix}Item`;
  const L = `${prefix}Link`;
  const rTag = `${tagPrefix}-root`;
  const tTag = `${tagPrefix}-trigger`;
  const cTag = `${tagPrefix}-content`;
  const iTag = `${tagPrefix}-item`;
  const lTag = `${tagPrefix}-link`;

  const heroId = `demo-${slug}-navigation-menu`;
  const iconsId = `demo-${slug}-navigation-menu-with-icons`;
  const statesId = `demo-${slug}-navigation-menu-links-and-states`;
  const controlledId = `demo-${slug}-navigation-menu-controlled`;

  const wcHero = formatCode(`
<${rTag} id="${slug}-nav-hero">
  <${tTag} data-nav-part="trigger" data-value="getting-started">Getting started ▾</${tTag}>
  <${cTag} data-nav-part="content" data-value="getting-started">
    <div class="grid gap-1 w-[360px] p-1">
      <${lTag} data-nav-link="intro">
        <span class="grid gap-1 text-left">
          <span class="block text-sm font-medium leading-none">Introduction</span>
          <span class="block text-xs opacity-80">Re-usable components built with Proto UI prototypes.</span>
        </span>
      </${lTag}>
      <${lTag} data-nav-link="install">
        <span class="grid gap-1 text-left">
          <span class="block text-sm font-medium leading-none">Installation</span>
          <span class="block text-xs opacity-80">How to install adapters and structure your app.</span>
        </span>
      </${lTag}>
    </div>
  </${cTag}>
  <${tTag} data-nav-part="trigger" data-value="components">Components ▾</${tTag}>
  <${cTag} data-nav-part="content" data-value="components">
    <div class="grid gap-1 sm:grid-cols-2 w-[480px] p-1">
      <${lTag} data-nav-link="alert-dialog">Alert Dialog</${lTag}>
      <${lTag} data-nav-link="tabs">Tabs</${lTag}>
    </div>
  </${cTag}>
  <${tTag} data-nav-part="trigger" data-value="resources">Resources ▾</${tTag}>
  <${cTag} data-nav-part="content" data-value="resources">
    <${lTag} data-nav-link="changelog">Changelog</${lTag}>
    <${iTag} data-nav-item="search">Search documentation</${iTag}>
  </${cTag}>
</${rTag}>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#${slug}-nav-hero');
  setElementProps(root, { ${wcStyleScript}a11yLabel: 'Main navigation' });
  root.querySelectorAll('[data-nav-part]').forEach((el) => {
    setElementProps(el, { value: el.getAttribute('data-value') });
  });
  setElementProps(root.querySelector('[data-nav-link="intro"]'), { href: '#introduction', current: true });
  setElementProps(root.querySelector('[data-nav-link="install"]'), { href: '#installation' });
  setElementProps(root.querySelector('[data-nav-link="alert-dialog"]'), { href: '#alert-dialog' });
  setElementProps(root.querySelector('[data-nav-link="tabs"]'), { href: '#tabs' });
  setElementProps(root.querySelector('[data-nav-link="changelog"]'), { href: '#changelog' });
  setElementProps(root.querySelector('[data-nav-item="search"]'), { value: 'search', textValue: 'Search documentation' });
</script>
  `);

  const reactHero = formatCode(`
import {
  ${R},
  ${T},
  ${C},
  ${I},
  ${L},
} from '../proto-ui/components/react';

export function NavigationMenuHero() {
  return (
    <${R}${rheaProp} a11yLabel="Main navigation">
      <${T} value="getting-started">Getting started ▾</${T}>
      <${C} value="getting-started" a11yLabel="Getting started links">
        <div className="grid gap-1 w-[360px] p-1">
          <${L} href="#introduction" current>
            <span className="grid gap-1 text-left">
              <span className="block text-sm font-medium leading-none">Introduction</span>
              <span className="block text-xs opacity-80">Re-usable components built with Proto UI prototypes.</span>
            </span>
          </${L}>
          <${L} href="#installation">
            <span className="grid gap-1 text-left">
              <span className="block text-sm font-medium leading-none">Installation</span>
              <span className="block text-xs opacity-80">How to install adapters and structure your app.</span>
            </span>
          </${L}>
        </div>
      </${C}>
      <${T} value="components">Components ▾</${T}>
      <${C} value="components" a11yLabel="Component links">
        <div className="grid gap-1 sm:grid-cols-2 w-[480px] p-1">
          <${L} href="#alert-dialog">Alert Dialog</${L}>
          <${L} href="#tabs">Tabs</${L}>
        </div>
      </${C}>
      <${T} value="resources">Resources ▾</${T}>
      <${C} value="resources" a11yLabel="Documentation resources">
        <${L} href="#changelog">Changelog</${L}>
        <${I} value="search" textValue="Search documentation">Search documentation</${I}>
      </${C}>
    </${R}>
  );
}
  `);

  const vueHero = formatCode(`
<script setup lang="ts">
import {
  ${R},
  ${T},
  ${C},
  ${I},
  ${L},
} from '../proto-ui/components/vue';
</script>

<template>
  <${R}${rheaProp} a11yLabel="Main navigation">
    <${T} value="getting-started">Getting started ▾</${T}>
    <${C} value="getting-started" a11yLabel="Getting started links">
      <div class="grid gap-1 w-[360px] p-1">
        <${L} href="#introduction" :current="true">Introduction</${L}>
        <${L} href="#installation">Installation</${L}>
      </div>
    </${C}>
    <${T} value="components">Components ▾</${T}>
    <${C} value="components" a11yLabel="Component links">
      <div class="grid gap-1 sm:grid-cols-2 w-[480px] p-1">
        <${L} href="#alert-dialog">Alert Dialog</${L}>
        <${L} href="#tabs">Tabs</${L}>
      </div>
    </${C}>
    <${T} value="resources">Resources ▾</${T}>
    <${C} value="resources" a11yLabel="Documentation resources">
      <${L} href="#changelog">Changelog</${L}>
      <${I} value="search" textValue="Search documentation">Search documentation</${I}>
    </${C}>
  </${R}>
</template>
  `);

  const vue2Hero = formatCode(`
<template>
  <${R}${rheaProp} a11yLabel="Main navigation">
    <${T} value="getting-started">Getting started ▾</${T}>
    <${C} value="getting-started" a11yLabel="Getting started links">
      <div class="grid gap-1 w-[360px] p-1">
        <${L} href="#introduction" :current="true">Introduction</${L}>
        <${L} href="#installation">Installation</${L}>
      </div>
    </${C}>
    <${T} value="components">Components ▾</${T}>
    <${C} value="components" a11yLabel="Component links">
      <div class="grid gap-1 sm:grid-cols-2 w-[480px] p-1">
        <${L} href="#alert-dialog">Alert Dialog</${L}>
        <${L} href="#tabs">Tabs</${L}>
      </div>
    </${C}>
    <${T} value="resources">Resources ▾</${T}>
    <${C} value="resources" a11yLabel="Documentation resources">
      <${L} href="#changelog">Changelog</${L}>
      <${I} value="search" textValue="Search documentation">Search documentation</${I}>
    </${C}>
  </${R}>
</template>

<script>
import {
  ${R},
  ${T},
  ${C},
  ${I},
  ${L},
} from '../proto-ui/components/vue2';

export default {
  components: { ${R}, ${T}, ${C}, ${I}, ${L} },
};
</script>
  `);

  const wcIcons = formatCode(`
<${rTag} id="${slug}-nav-icons">
  <${tTag} data-value="status">With Icon ▾</${tTag}>
  <${cTag} data-value="status">
    <${lTag} data-href="#backlog"><span aria-hidden="true">○</span> Backlog</${lTag}>
    <${lTag} data-href="#todo" data-current="true"><span aria-hidden="true">◔</span> To Do</${lTag}>
    <${lTag} data-href="#done"><span aria-hidden="true">●</span> Done</${lTag}>
  </${cTag}>
</${rTag}>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#${slug}-nav-icons');
  setElementProps(root, { ${wcStyleScript}a11yLabel: 'Project status navigation' });
  root.querySelectorAll('[data-value]').forEach((el) => {
    setElementProps(el, { value: el.getAttribute('data-value') });
  });
  root.querySelectorAll('[data-href]').forEach((el) => {
    setElementProps(el, {
      href: el.getAttribute('data-href'),
      current: el.getAttribute('data-current') === 'true',
    });
  });
</script>
  `);

  const reactIcons = formatCode(`
import { ${R}, ${T}, ${C}, ${L} } from '../proto-ui/components/react';

export function NavigationMenuWithIcons() {
  return (
    <${R}${rheaProp} a11yLabel="Project status navigation">
      <${T} value="status">With Icon ▾</${T}>
      <${C} value="status" a11yLabel="Task status links">
        <div className="grid gap-0.5 w-[200px] p-1">
          <${L} href="#backlog"><span aria-hidden="true">○</span> Backlog</${L}>
          <${L} href="#todo" current><span aria-hidden="true">◔</span> To Do</${L}>
          <${L} href="#done"><span aria-hidden="true">●</span> Done</${L}>
        </div>
      </${C}>
    </${R}>
  );
}
  `);

  const vueIcons = formatCode(`
<script setup lang="ts">
import { ${R}, ${T}, ${C}, ${L} } from '../proto-ui/components/vue';
</script>

<template>
  <${R}${rheaProp} a11yLabel="Project status navigation">
    <${T} value="status">With Icon ▾</${T}>
    <${C} value="status" a11yLabel="Task status links">
      <div class="grid gap-0.5 w-[200px] p-1">
        <${L} href="#backlog"><span aria-hidden="true">○</span> Backlog</${L}>
        <${L} href="#todo" :current="true"><span aria-hidden="true">◔</span> To Do</${L}>
        <${L} href="#done"><span aria-hidden="true">●</span> Done</${L}>
      </div>
    </${C}>
  </${R}>
</template>
  `);

  const vue2Icons = formatCode(`
<template>
  <${R}${rheaProp} a11yLabel="Project status navigation">
    <${T} value="status">With Icon ▾</${T}>
    <${C} value="status" a11yLabel="Task status links">
      <div class="grid gap-0.5 w-[200px] p-1">
        <${L} href="#backlog"><span aria-hidden="true">○</span> Backlog</${L}>
        <${L} href="#todo" :current="true"><span aria-hidden="true">◔</span> To Do</${L}>
        <${L} href="#done"><span aria-hidden="true">●</span> Done</${L}>
      </div>
    </${C}>
  </${R}>
</template>

<script>
import { ${R}, ${T}, ${C}, ${L} } from '../proto-ui/components/vue2';
export default { components: { ${R}, ${T}, ${C}, ${L} } };
</script>
  `);

  const extraTriggerPropReact = liquidExtras ? ' prominence="prominent"' : '';
  const extraOpaquePanelReact = liquidExtras
    ? `\n      <${T} value="opaque-panel">Opaque Panel ▾</${T}>\n      <${C} value="opaque-panel" material="opaque" a11yLabel="Opaque fallback links">\n        <${L} href="#contrast">High-contrast surface</${L}>\n      </${C}>`
    : '';

  const wcStates = formatCode(`
<${rTag} id="${slug}-nav-states">
  <${tTag} id="${slug}-guides-trigger">Guides ▾</${tTag}>
  <${cTag} id="${slug}-guides-content">
    <${lTag} id="${slug}-link-current">Overview (current page)</${lTag}>
    <${lTag} id="${slug}-link-keep-open">Stay open on click</${lTag}>
    <${lTag} id="${slug}-link-blank">Open in new tab ↗</${lTag}>
    <${lTag} id="${slug}-link-disabled">Archived guide (disabled)</${lTag}>
  </${cTag}>
  <${tTag} id="${slug}-disabled-trigger">Enterprise (disabled)</${tTag}>
</${rTag}>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#${slug}-nav-states'), { ${wcStyleScript}a11yLabel: 'Documentation link states' });
  setElementProps(document.querySelector('#${slug}-guides-trigger'), { value: 'guides'${liquidExtras ? `, prominence: 'prominent'` : ''} });
  setElementProps(document.querySelector('#${slug}-guides-content'), { value: 'guides', a11yLabel: 'Guide links' });
  setElementProps(document.querySelector('#${slug}-link-current'), { href: '#overview', current: true });
  setElementProps(document.querySelector('#${slug}-link-keep-open'), { href: '#api-reference', closeOnSelect: false });
  setElementProps(document.querySelector('#${slug}-link-blank'), { href: '#release-notes', target: '_blank' });
  setElementProps(document.querySelector('#${slug}-link-disabled'), { href: '#archived', disabled: true });
  setElementProps(document.querySelector('#${slug}-disabled-trigger'), { value: 'billing', disabled: true });
</script>
  `);

  const reactStates = formatCode(`
import { ${R}, ${T}, ${C}, ${L} } from '../proto-ui/components/react';

export function NavigationMenuStates() {
  return (
    <${R}${rheaProp} a11yLabel="Documentation link states">
      <${T} value="guides"${extraTriggerPropReact}>Guides ▾</${T}>
      <${C} value="guides" a11yLabel="Guide links">
        <${L} href="#overview" current>Overview (current page)</${L}>
        <${L} href="#api-reference" closeOnSelect={false}>Stay open on click</${L}>
        <${L} href="#release-notes" target="_blank">Open in new tab ↗</${L}>
        <${L} href="#archived" disabled>Archived guide (disabled)</${L}>
      </${C}>${extraOpaquePanelReact}
      <${T} value="billing" disabled>Enterprise (disabled)</${T}>
    </${R}>
  );
}
  `);

  const vueStates = formatCode(`
<script setup lang="ts">
import { ${R}, ${T}, ${C}, ${L} } from '../proto-ui/components/vue';
</script>

<template>
  <${R}${rheaProp} a11yLabel="Documentation link states">
    <${T} value="guides"${extraTriggerPropReact}>Guides ▾</${T}>
    <${C} value="guides" a11yLabel="Guide links">
      <${L} href="#overview" :current="true">Overview (current page)</${L}>
      <${L} href="#api-reference" :closeOnSelect="false">Stay open on click</${L}>
      <${L} href="#release-notes" target="_blank">Open in new tab ↗</${L}>
      <${L} href="#archived" :disabled="true">Archived guide (disabled)</${L}>
    </${C}>
    <${T} value="billing" :disabled="true">Enterprise (disabled)</${T}>
  </${R}>
</template>
  `);

  const vue2States = formatCode(`
<template>
  <${R}${rheaProp} a11yLabel="Documentation link states">
    <${T} value="guides"${extraTriggerPropReact}>Guides ▾</${T}>
    <${C} value="guides" a11yLabel="Guide links">
      <${L} href="#overview" :current="true">Overview (current page)</${L}>
      <${L} href="#api-reference" :closeOnSelect="false">Stay open on click</${L}>
      <${L} href="#release-notes" target="_blank">Open in new tab ↗</${L}>
      <${L} href="#archived" :disabled="true">Archived guide (disabled)</${L}>
    </${C}>
    <${T} value="billing" :disabled="true">Enterprise (disabled)</${T}>
  </${R}>
</template>

<script>
import { ${R}, ${T}, ${C}, ${L} } from '../proto-ui/components/vue2';
export default { components: { ${R}, ${T}, ${C}, ${L} } };
</script>
  `);

  const wcControlled = formatCode(`
<${rTag} id="${slug}-nav-controlled">
  <${tTag} data-value="docs">Docs ▾</${tTag}>
  <${cTag} data-value="docs">
    <${lTag} id="${slug}-ctrl-intro">Getting started</${lTag}>
    <${iTag} id="${slug}-ctrl-copy">Copy install command</${iTag}>
  </${cTag}>
</${rTag}>
<p id="${slug}-ctrl-status" aria-live="polite">Active panel: none</p>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#${slug}-nav-controlled');
  const status = document.querySelector('#${slug}-ctrl-status');
  setElementProps(root, { ${wcStyleScript}value: '', a11yLabel: 'Controlled navigation' });
  root.querySelectorAll('[data-value]').forEach((el) => {
    setElementProps(el, { value: el.getAttribute('data-value') });
  });
  setElementProps(document.querySelector('#${slug}-ctrl-intro'), { href: '#getting-started', current: true });
  setElementProps(document.querySelector('#${slug}-ctrl-copy'), { value: 'copy-install', textValue: 'Copy install command' });
  root.addEventListener('valueChange', (event) => {
    const next = event.detail.value;
    setElementProps(root, { ${wcStyleScript}value: next });
    status.textContent = next ? 'Active panel: ' + next : 'Active panel: none';
  });
</script>
  `);

  const reactControlled = formatCode(`
import { useState } from 'react';
import { ${R}, ${T}, ${C}, ${I}, ${L} } from '../proto-ui/components/react';

export function ControlledNavigationMenu() {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState('Active panel: none');

  return (
    <div className="grid gap-3">
      <${R}
        ${rheaProp.trim() ? `${rheaProp.trim()}\n        ` : ''}value={value}
        a11yLabel="Controlled navigation"
        onValueChange={(detail) => {
          setValue(detail.value);
          setStatus(detail.value ? \`Active panel: \${detail.value}\` : 'Active panel: none');
        }}
      >
        <${T} value="docs">Docs ▾</${T}>
        <${C} value="docs" a11yLabel="Documentation links">
          <${L}
            href="#getting-started"
            current
            onNavigate={(detail) => setStatus(\`Navigated to: \${detail.href}\`)}
          >
            Getting started
          </${L}>
          <${I}
            value="copy-install"
            textValue="Copy install command"
            onSelect={(detail) => setStatus(\`Selected action: \${detail.value}\`)}
          >
            Copy install command
          </${I}>
        </${C}>
      </${R}>
      <p aria-live="polite">{status}</p>
    </div>
  );
}
  `);

  const vueControlled = formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import { ${R}, ${T}, ${C}, ${I}, ${L} } from '../proto-ui/components/vue';

const value = ref('');
const status = ref('Active panel: none');
function handleValueChange(detail: { value: string }) {
  value.value = detail.value;
  status.value = detail.value ? \`Active panel: \${detail.value}\` : 'Active panel: none';
}
</script>

<template>
  <${R}${rheaProp} :value="value" a11yLabel="Controlled navigation" @valueChange="handleValueChange">
    <${T} value="docs">Docs ▾</${T}>
    <${C} value="docs" a11yLabel="Documentation links">
      <${L} href="#getting-started" :current="true" @navigate="(d) => (status = 'Navigated to: ' + d.href)">
        Getting started
      </${L}>
      <${I} value="copy-install" textValue="Copy install command" @select="(d) => (status = 'Selected action: ' + d.value)">
        Copy install command
      </${I}>
    </${C}>
  </${R}>
  <p aria-live="polite">{{ status }}</p>
</template>
  `);

  const vue2Controlled = formatCode(`
<template>
  <div>
    <${R}${rheaProp} :value="value" a11yLabel="Controlled navigation" @valueChange="onValueChange">
      <${T} value="docs">Docs ▾</${T}>
      <${C} value="docs" a11yLabel="Documentation links">
        <${L} href="#getting-started" :current="true" @navigate="onNavigate">Getting started</${L}>
        <${I} value="copy-install" textValue="Copy install command" @select="onSelect">Copy install command</${I}>
      </${C}>
    </${R}>
    <p aria-live="polite">{{ status }}</p>
  </div>
</template>

<script>
import { ${R}, ${T}, ${C}, ${I}, ${L} } from '../proto-ui/components/vue2';
export default {
  components: { ${R}, ${T}, ${C}, ${I}, ${L} },
  data() {
    return { value: '', status: 'Active panel: none' };
  },
  methods: {
    onValueChange(detail) {
      this.value = detail.value;
      this.status = detail.value ? 'Active panel: ' + detail.value : 'Active panel: none';
    },
    onNavigate(detail) {
      this.status = 'Navigated to: ' + detail.href;
    },
    onSelect(detail) {
      this.status = 'Selected action: ' + detail.value;
    },
  },
};
</script>
  `);

  return {
    wc: {
      [heroId]: wcHero,
      [iconsId]: wcIcons,
      [statesId]: wcStates,
      [controlledId]: wcControlled,
    },
    react: {
      [heroId]: reactHero,
      [iconsId]: reactIcons,
      [statesId]: reactStates,
      [controlledId]: reactControlled,
    },
    vue: {
      [heroId]: vueHero,
      [iconsId]: vueIcons,
      [statesId]: vueStates,
      [controlledId]: vueControlled,
    },
    vue2: {
      [heroId]: vue2Hero,
      [iconsId]: vue2Icons,
      [statesId]: vue2States,
      [controlledId]: vue2Controlled,
    },
  };
}

const wc: Record<string, string> = {};
const react: Record<string, string> = {};
const vue: Record<string, string> = {};
const vue2: Record<string, string> = {};

for (const family of FAMILIES) {
  const built = buildFamilySnippets(family);
  Object.assign(wc, built.wc);
  Object.assign(react, built.react);
  Object.assign(vue, built.vue);
  Object.assign(vue2, built.vue2);
}

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc,
  react,
  vue,
  vue2,
};
