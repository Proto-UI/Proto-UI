export interface RuntimePackage {
  name: string;
  versionRange?: string;
}

export interface Adapter {
  id: string;
  label: string;
  aliases: string[];
  packageName: string;
  runtimePackages: RuntimePackage[];
  createImport: string;
  runtimeImport: string | null;
  adapterStatement: string | null;
  rootAliasPrefix: string | null;
}

export const ADAPTER_REGISTRY: Record<string, Adapter> = {
  react: {
    id: 'react',
    label: 'React',
    aliases: ['react'],
    packageName: '@proto.ui/adapter-react',
    runtimePackages: [{ name: 'react' }],
    createImport: `import { createReactAdapter } from '@proto.ui/adapter-react';`,
    runtimeImport: `import * as React from 'react';`,
    adapterStatement: `const adapt = createReactAdapter(React);`,
    rootAliasPrefix: 'React',
  },
  vue: {
    id: 'vue',
    label: 'Vue',
    aliases: ['vue'],
    packageName: '@proto.ui/adapter-vue',
    runtimePackages: [{ name: 'vue' }],
    createImport: `import { createVueAdapter } from '@proto.ui/adapter-vue';`,
    runtimeImport: `import * as Vue from 'vue';`,
    adapterStatement: `const adapt = createVueAdapter(Vue);`,
    rootAliasPrefix: 'Vue',
  },
  vue2: {
    id: 'vue2',
    label: 'Vue 2',
    aliases: ['vue2', 'vue-2'],
    packageName: '@proto.ui/adapter-vue2',
    runtimePackages: [{ name: 'vue', versionRange: '>=2.6.0 <2.7' }],
    createImport: `import { createVue2Adapter } from '@proto.ui/adapter-vue2';`,
    runtimeImport: `import Vue from 'vue';`,
    adapterStatement: `const adapt = createVue2Adapter({
  extend: Vue.extend.bind(Vue),
  nextTick: Vue.nextTick.bind(Vue),
  set: Vue.set.bind(Vue),
  delete: Vue.delete.bind(Vue),
});`,
    rootAliasPrefix: 'Vue2',
  },
  wc: {
    id: 'wc',
    label: 'Web Components',
    aliases: ['wc', 'web-component', 'web-components'],
    packageName: '@proto.ui/adapter-web-component',
    runtimePackages: [],
    createImport: `import { AdaptToWebComponent } from '@proto.ui/adapter-web-component';`,
    runtimeImport: null,
    adapterStatement: null,
    rootAliasPrefix: null,
  },
};

const ALIAS_TO_ADAPTER = new Map<string, Adapter>();
for (const adapter of Object.values(ADAPTER_REGISTRY)) {
  for (const alias of adapter.aliases) {
    ALIAS_TO_ADAPTER.set(alias, adapter);
  }
}

export function normalizeHost(input: string | undefined): string | null {
  if (!input) return null;
  return ALIAS_TO_ADAPTER.get(String(input).toLowerCase())?.id ?? null;
}

export function getAdapter(host: string): Adapter | null {
  return ADAPTER_REGISTRY[host] ?? null;
}

export function listAdapterChoices(): { title: string; value: string }[] {
  return Object.values(ADAPTER_REGISTRY).map((adapter) => ({
    title: adapter.label,
    value: adapter.id,
  }));
}
