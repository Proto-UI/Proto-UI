import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

type FamilyMeta = {
  prefix: string;
  wcTagPrefix: string;
  componentPrefix: string;
  importPath: string;
  supportsStyleProfile: boolean;
  supportsIconToggle: boolean;
};

const FAMILIES: Record<'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass', FamilyMeta> = {
  shadcn: {
    prefix: 'demo-shadcn-tree',
    wcTagPrefix: 'proto-ui-shadcn-tree',
    componentPrefix: 'ShadcnTree',
    importPath: '@proto.ui/prototypes-shadcn/tree',
    supportsStyleProfile: true,
    supportsIconToggle: true,
  },
  brutalist: {
    prefix: 'demo-brutalist-tree',
    wcTagPrefix: 'proto-ui-brutalist-tree',
    componentPrefix: 'BrutalistTree',
    importPath: '@proto.ui/prototypes-brutalist/tree',
    supportsStyleProfile: false,
    supportsIconToggle: true,
  },
  'bootstrap-2-3-2': {
    prefix: 'demo-bootstrap-2-3-2-tree',
    wcTagPrefix: 'proto-ui-bootstrap-2-3-2-tree',
    componentPrefix: 'Bootstrap232Tree',
    importPath: '@proto.ui/prototypes-bootstrap-2-3-2/tree',
    supportsStyleProfile: false,
    supportsIconToggle: false,
  },
  'liquid-glass': {
    prefix: 'demo-liquid-glass-tree',
    wcTagPrefix: 'proto-ui-liquid-glass-tree',
    componentPrefix: 'LiquidGlassTree',
    importPath: '@proto.ui/prototypes-liquid-glass/tree',
    supportsStyleProfile: false,
    supportsIconToggle: true,
  },
};

function makeBasicSnippets(meta: FamilyMeta) {
  const { wcTagPrefix: tag, componentPrefix: C, supportsStyleProfile, supportsIconToggle } = meta;
  const stylePropReact = supportsStyleProfile ? ' styleProfile="rhea"' : '';
  const stylePropObj = supportsStyleProfile ? ", styleProfile: 'rhea'" : '';
  const toggleSizeReact = supportsIconToggle ? ' size="icon"' : '';
  const toggleSizeObj = supportsIconToggle ? ", size: 'icon'" : '';

  return {
    wc: formatCode(`
<${tag}-root id="project-tree" class="w-full max-w-sm">
  <div class="flex items-center gap-1">
    <${tag}-toggle data-toggle="src"><span aria-hidden="true">▾</span><span class="sr-only">Toggle src</span></${tag}-toggle>
    <${tag}-item data-node="src" class="flex-1">src/</${tag}-item>
  </div>
  <${tag}-group data-group="src">
    <div class="flex items-center gap-1">
      <${tag}-toggle data-toggle="components"><span aria-hidden="true">▾</span><span class="sr-only">Toggle components</span></${tag}-toggle>
      <${tag}-item data-node="components" class="flex-1">components/</${tag}-item>
    </div>
    <${tag}-group data-group="components">
      <${tag}-item data-node="button">button.tsx</${tag}-item>
      <${tag}-item data-node="tree">tree.tsx</${tag}-item>
    </${tag}-group>
    <${tag}-item data-node="index">index.ts</${tag}-item>
  </${tag}-group>
  <${tag}-item data-node="package">package.json</${tag}-item>
  <${tag}-item data-node="readme">README.md</${tag}-item>
</${tag}-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#project-tree');
  setElementProps(root, { defaultValue: 'button', defaultExpandedKeys: ['src', 'components']${stylePropObj} });
  setElementProps(root.querySelector('[data-node="src"]'), { nodeKey: 'src', textValue: 'src' });
  setElementProps(root.querySelector('[data-toggle="src"]'), { nodeKey: 'src'${toggleSizeObj} });
  setElementProps(root.querySelector('[data-group="src"]'), { nodeKey: 'src' });
  setElementProps(root.querySelector('[data-node="components"]'), { nodeKey: 'components', parentKey: 'src', textValue: 'components' });
  setElementProps(root.querySelector('[data-toggle="components"]'), { nodeKey: 'components'${toggleSizeObj} });
  setElementProps(root.querySelector('[data-group="components"]'), { nodeKey: 'components' });
  setElementProps(root.querySelector('[data-node="button"]'), { nodeKey: 'button', parentKey: 'components', textValue: 'button.tsx' });
  setElementProps(root.querySelector('[data-node="tree"]'), { nodeKey: 'tree', parentKey: 'components', textValue: 'tree.tsx' });
  setElementProps(root.querySelector('[data-node="index"]'), { nodeKey: 'index', parentKey: 'src', textValue: 'index.ts' });
  setElementProps(root.querySelector('[data-node="package"]'), { nodeKey: 'package', textValue: 'package.json' });
  setElementProps(root.querySelector('[data-node="readme"]'), { nodeKey: 'readme', textValue: 'README.md' });
</script>
    `),
    react: formatCode(`
import { ${C}Root, ${C}Item, ${C}Group, ${C}Toggle } from '../proto-ui/components/react';

export function ProjectTreeDemo() {
  return (
    <${C}Root${stylePropReact} defaultValue="button" defaultExpandedKeys={['src', 'components']} className="w-full max-w-sm">
      <div className="flex items-center gap-1">
        <${C}Toggle nodeKey="src"${toggleSizeReact}>
          <span aria-hidden="true">▾</span><span className="sr-only">Toggle src</span>
        </${C}Toggle>
        <${C}Item nodeKey="src" textValue="src" className="flex-1">src/</${C}Item>
      </div>
      <${C}Group nodeKey="src">
        <div className="flex items-center gap-1">
          <${C}Toggle nodeKey="components"${toggleSizeReact}>
            <span aria-hidden="true">▾</span><span className="sr-only">Toggle components</span>
          </${C}Toggle>
          <${C}Item nodeKey="components" parentKey="src" textValue="components" className="flex-1">components/</${C}Item>
        </div>
        <${C}Group nodeKey="components">
          <${C}Item nodeKey="button" parentKey="components" textValue="button.tsx">button.tsx</${C}Item>
          <${C}Item nodeKey="tree" parentKey="components" textValue="tree.tsx">tree.tsx</${C}Item>
        </${C}Group>
        <${C}Item nodeKey="index" parentKey="src" textValue="index.ts">index.ts</${C}Item>
      </${C}Group>
      <${C}Item nodeKey="package" textValue="package.json">package.json</${C}Item>
      <${C}Item nodeKey="readme" textValue="README.md">README.md</${C}Item>
    </${C}Root>
  );
}
    `),
    vue: formatCode(`
<script setup lang="ts">
import { ${C}Root, ${C}Item, ${C}Group, ${C}Toggle } from '../proto-ui/components/vue';
</script>

<template>
  <${C}Root${stylePropReact} defaultValue="button" :defaultExpandedKeys="['src', 'components']" class="w-full max-w-sm">
    <div class="flex items-center gap-1">
      <${C}Toggle nodeKey="src"${toggleSizeReact}><span aria-hidden="true">▾</span><span class="sr-only">Toggle src</span></${C}Toggle>
      <${C}Item nodeKey="src" textValue="src" class="flex-1">src/</${C}Item>
    </div>
    <${C}Group nodeKey="src">
      <div class="flex items-center gap-1">
        <${C}Toggle nodeKey="components"${toggleSizeReact}><span aria-hidden="true">▾</span><span class="sr-only">Toggle components</span></${C}Toggle>
        <${C}Item nodeKey="components" parentKey="src" textValue="components" class="flex-1">components/</${C}Item>
      </div>
      <${C}Group nodeKey="components">
        <${C}Item nodeKey="button" parentKey="components" textValue="button.tsx">button.tsx</${C}Item>
        <${C}Item nodeKey="tree" parentKey="components" textValue="tree.tsx">tree.tsx</${C}Item>
      </${C}Group>
      <${C}Item nodeKey="index" parentKey="src" textValue="index.ts">index.ts</${C}Item>
    </${C}Group>
    <${C}Item nodeKey="package" textValue="package.json">package.json</${C}Item>
    <${C}Item nodeKey="readme" textValue="README.md">README.md</${C}Item>
  </${C}Root>
</template>
    `),
    vue2: formatCode(`
<template>
  <${C}Root${stylePropReact} defaultValue="button" :defaultExpandedKeys="['src', 'components']" class="w-full max-w-sm">
    <div class="flex items-center gap-1">
      <${C}Toggle nodeKey="src"${toggleSizeReact}><span aria-hidden="true">▾</span><span class="sr-only">Toggle src</span></${C}Toggle>
      <${C}Item nodeKey="src" textValue="src" class="flex-1">src/</${C}Item>
    </div>
    <${C}Group nodeKey="src">
      <div class="flex items-center gap-1">
        <${C}Toggle nodeKey="components"${toggleSizeReact}><span aria-hidden="true">▾</span><span class="sr-only">Toggle components</span></${C}Toggle>
        <${C}Item nodeKey="components" parentKey="src" textValue="components" class="flex-1">components/</${C}Item>
      </div>
      <${C}Group nodeKey="components">
        <${C}Item nodeKey="button" parentKey="components" textValue="button.tsx">button.tsx</${C}Item>
        <${C}Item nodeKey="tree" parentKey="components" textValue="tree.tsx">tree.tsx</${C}Item>
      </${C}Group>
      <${C}Item nodeKey="index" parentKey="src" textValue="index.ts">index.ts</${C}Item>
    </${C}Group>
    <${C}Item nodeKey="package" textValue="package.json">package.json</${C}Item>
    <${C}Item nodeKey="readme" textValue="README.md">README.md</${C}Item>
  </${C}Root>
</template>

<script>
import { ${C}Root, ${C}Item, ${C}Group, ${C}Toggle } from '../proto-ui/components/vue2';

export default {
  components: { ${C}Root, ${C}Item, ${C}Group, ${C}Toggle },
};
</script>
    `),
  };
}

function makeControlledSnippets(meta: FamilyMeta) {
  const { wcTagPrefix: tag, componentPrefix: C, supportsStyleProfile, supportsIconToggle } = meta;
  const stylePropReact = supportsStyleProfile ? ' styleProfile="rhea"' : '';
  const stylePropObj = supportsStyleProfile ? ", styleProfile: 'rhea'" : '';
  const toggleSizeReact = supportsIconToggle ? ' size="icon"' : '';
  const toggleSizeObj = supportsIconToggle ? ", size: 'icon'" : '';

  return {
    wc: formatCode(`
<div class="grid w-full max-w-sm gap-2">
  <${tag}-root id="controlled-tree">
    <div class="flex items-center gap-1">
      <${tag}-toggle data-toggle="src"><span aria-hidden="true">▾</span><span class="sr-only">Toggle src</span></${tag}-toggle>
      <${tag}-item data-node="src" class="flex-1">src/</${tag}-item>
    </div>
    <${tag}-group data-group="src">
      <div class="flex items-center gap-1">
        <${tag}-toggle data-toggle="components"><span aria-hidden="true">▾</span><span class="sr-only">Toggle components</span></${tag}-toggle>
        <${tag}-item data-node="components" class="flex-1">components/</${tag}-item>
      </div>
      <${tag}-group data-group="components">
        <${tag}-item data-node="button">button.tsx</${tag}-item>
        <${tag}-item data-node="tree">tree.tsx</${tag}-item>
      </${tag}-group>
    </${tag}-group>
    <${tag}-item data-node="readme">README.md</${tag}-item>
  </${tag}-root>
  <div id="tree-status" role="status" aria-live="polite">Selected: button · Expanded: src, components</div>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#controlled-tree');
  const status = document.querySelector('#tree-status');
  let value = 'button';
  let expandedKeys = ['src', 'components'];
  const sync = () => {
    setElementProps(root, { value, expandedKeys${stylePropObj} });
    status.textContent = 'Selected: ' + value + ' · Expanded: ' + (expandedKeys.join(', ') || 'none');
  };
  setElementProps(root.querySelector('[data-node="src"]'), { nodeKey: 'src', textValue: 'src' });
  setElementProps(root.querySelector('[data-toggle="src"]'), { nodeKey: 'src'${toggleSizeObj} });
  setElementProps(root.querySelector('[data-group="src"]'), { nodeKey: 'src' });
  setElementProps(root.querySelector('[data-node="components"]'), { nodeKey: 'components', parentKey: 'src', textValue: 'components' });
  setElementProps(root.querySelector('[data-toggle="components"]'), { nodeKey: 'components'${toggleSizeObj} });
  setElementProps(root.querySelector('[data-group="components"]'), { nodeKey: 'components' });
  setElementProps(root.querySelector('[data-node="button"]'), { nodeKey: 'button', parentKey: 'components', textValue: 'button.tsx' });
  setElementProps(root.querySelector('[data-node="tree"]'), { nodeKey: 'tree', parentKey: 'components', textValue: 'tree.tsx' });
  setElementProps(root.querySelector('[data-node="readme"]'), { nodeKey: 'readme', textValue: 'README.md' });
  root.addEventListener('valueChange', (e) => { value = e.detail.value; sync(); });
  root.addEventListener('expandedChange', (e) => { expandedKeys = e.detail.expandedKeys; sync(); });
  sync();
</script>
    `),
    react: formatCode(`
import { useState } from 'react';
import { ${C}Root, ${C}Item, ${C}Group, ${C}Toggle } from '../proto-ui/components/react';

export function ControlledTreeDemo() {
  const [value, setValue] = useState('button');
  const [expandedKeys, setExpandedKeys] = useState(['src', 'components']);

  return (
    <div className="grid w-full max-w-sm gap-2">
      <${C}Root${stylePropReact}
        value={value}
        expandedKeys={expandedKeys}
        onValueChange={(detail) => setValue(detail.value)}
        onExpandedChange={(detail) => setExpandedKeys(detail.expandedKeys)}
      >
        <div className="flex items-center gap-1">
          <${C}Toggle nodeKey="src"${toggleSizeReact}>{expandedKeys.includes('src') ? '▾' : '▸'}</${C}Toggle>
          <${C}Item nodeKey="src" textValue="src" className="flex-1">src/</${C}Item>
        </div>
        <${C}Group nodeKey="src">
          <div className="flex items-center gap-1">
            <${C}Toggle nodeKey="components"${toggleSizeReact}>{expandedKeys.includes('components') ? '▾' : '▸'}</${C}Toggle>
            <${C}Item nodeKey="components" parentKey="src" textValue="components" className="flex-1">components/</${C}Item>
          </div>
          <${C}Group nodeKey="components">
            <${C}Item nodeKey="button" parentKey="components" textValue="button.tsx">button.tsx</${C}Item>
            <${C}Item nodeKey="tree" parentKey="components" textValue="tree.tsx">tree.tsx</${C}Item>
          </${C}Group>
        </${C}Group>
        <${C}Item nodeKey="readme" textValue="README.md">README.md</${C}Item>
      </${C}Root>
      <div role="status" aria-live="polite">
        Selected: {value} · Expanded: {expandedKeys.join(', ') || 'none'}
      </div>
    </div>
  );
}
    `),
    vue: formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import { ${C}Root, ${C}Item, ${C}Group, ${C}Toggle } from '../proto-ui/components/vue';

const value = ref('button');
const expandedKeys = ref(['src', 'components']);
</script>

<template>
  <div class="grid w-full max-w-sm gap-2">
    <${C}Root${stylePropReact}
      :value="value"
      :expandedKeys="expandedKeys"
      @valueChange="(d) => (value = d.value)"
      @expandedChange="(d) => (expandedKeys = d.expandedKeys)"
    >
      <div class="flex items-center gap-1">
        <${C}Toggle nodeKey="src"${toggleSizeReact}>{{ expandedKeys.includes('src') ? '▾' : '▸' }}</${C}Toggle>
        <${C}Item nodeKey="src" textValue="src" class="flex-1">src/</${C}Item>
      </div>
      <${C}Group nodeKey="src">
        <div class="flex items-center gap-1">
          <${C}Toggle nodeKey="components"${toggleSizeReact}>{{ expandedKeys.includes('components') ? '▾' : '▸' }}</${C}Toggle>
          <${C}Item nodeKey="components" parentKey="src" textValue="components" class="flex-1">components/</${C}Item>
        </div>
        <${C}Group nodeKey="components">
          <${C}Item nodeKey="button" parentKey="components" textValue="button.tsx">button.tsx</${C}Item>
          <${C}Item nodeKey="tree" parentKey="components" textValue="tree.tsx">tree.tsx</${C}Item>
        </${C}Group>
      </${C}Group>
      <${C}Item nodeKey="readme" textValue="README.md">README.md</${C}Item>
    </${C}Root>
    <div role="status" aria-live="polite">
      Selected: {{ value }} · Expanded: {{ expandedKeys.join(', ') || 'none' }}
    </div>
  </div>
</template>
    `),
    vue2: formatCode(`
<template>
  <div class="grid w-full max-w-sm gap-2">
    <${C}Root${stylePropReact}
      :value="value"
      :expandedKeys="expandedKeys"
      @valueChange="onValueChange"
      @expandedChange="onExpandedChange"
    >
      <div class="flex items-center gap-1">
        <${C}Toggle nodeKey="src"${toggleSizeReact}>{{ expandedKeys.includes('src') ? '▾' : '▸' }}</${C}Toggle>
        <${C}Item nodeKey="src" textValue="src" class="flex-1">src/</${C}Item>
      </div>
      <${C}Group nodeKey="src">
        <div class="flex items-center gap-1">
          <${C}Toggle nodeKey="components"${toggleSizeReact}>{{ expandedKeys.includes('components') ? '▾' : '▸' }}</${C}Toggle>
          <${C}Item nodeKey="components" parentKey="src" textValue="components" class="flex-1">components/</${C}Item>
        </div>
        <${C}Group nodeKey="components">
          <${C}Item nodeKey="button" parentKey="components" textValue="button.tsx">button.tsx</${C}Item>
          <${C}Item nodeKey="tree" parentKey="components" textValue="tree.tsx">tree.tsx</${C}Item>
        </${C}Group>
      </${C}Group>
      <${C}Item nodeKey="readme" textValue="README.md">README.md</${C}Item>
    </${C}Root>
    <div role="status" aria-live="polite">
      Selected: {{ value }} · Expanded: {{ expandedKeys.join(', ') || 'none' }}
    </div>
  </div>
</template>

<script>
import { ${C}Root, ${C}Item, ${C}Group, ${C}Toggle } from '../proto-ui/components/vue2';

export default {
  components: { ${C}Root, ${C}Item, ${C}Group, ${C}Toggle },
  data() {
    return { value: 'button', expandedKeys: ['src', 'components'] };
  },
  methods: {
    onValueChange(detail) { this.value = detail.value; },
    onExpandedChange(detail) { this.expandedKeys = detail.expandedKeys; },
  },
};
</script>
    `),
  };
}

function makeStatesSnippets(meta: FamilyMeta) {
  const { wcTagPrefix: tag, componentPrefix: C, supportsStyleProfile, supportsIconToggle } = meta;
  const stylePropReact = supportsStyleProfile ? ' styleProfile="rhea"' : '';
  const stylePropObj = supportsStyleProfile ? ", styleProfile: 'rhea'" : '';
  const toggleSizeReact = supportsIconToggle ? ' size="icon"' : '';
  const toggleSizeObj = supportsIconToggle ? ", size: 'icon'" : '';

  return {
    wc: formatCode(`
<div class="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
  <${tag}-root id="disabled-tree">
    <div class="flex items-center gap-1">
      <${tag}-toggle data-toggle="packages"><span aria-hidden="true">▾</span><span class="sr-only">Toggle packages</span></${tag}-toggle>
      <${tag}-item data-node="packages" class="flex-1">packages/</${tag}-item>
    </div>
    <${tag}-group data-group="packages">
      <${tag}-item data-node="active">core</${tag}-item>
      <${tag}-item data-node="deprecated">legacy (disabled)</${tag}-item>
    </${tag}-group>
    <${tag}-item data-node="license">LICENSE</${tag}-item>
  </${tag}-root>
  <${tag}-root id="readonly-tree">
    <div class="flex items-center gap-1">
      <${tag}-toggle data-toggle="docs"><span aria-hidden="true">▾</span><span class="sr-only">Toggle docs</span></${tag}-toggle>
      <${tag}-item data-node="docs" class="flex-1">docs/</${tag}-item>
    </div>
    <${tag}-group data-group="docs">
      <${tag}-item data-node="overview">overview.mdx</${tag}-item>
      <${tag}-item data-node="api">api.mdx</${tag}-item>
    </${tag}-group>
  </${tag}-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const disabledTree = document.querySelector('#disabled-tree');
  setElementProps(disabledTree, { defaultValue: 'active', defaultExpandedKeys: ['packages']${stylePropObj} });
  setElementProps(disabledTree.querySelector('[data-node="packages"]'), { nodeKey: 'packages', textValue: 'packages' });
  setElementProps(disabledTree.querySelector('[data-toggle="packages"]'), { nodeKey: 'packages'${toggleSizeObj} });
  setElementProps(disabledTree.querySelector('[data-group="packages"]'), { nodeKey: 'packages' });
  setElementProps(disabledTree.querySelector('[data-node="active"]'), { nodeKey: 'active', parentKey: 'packages', textValue: 'core' });
  setElementProps(disabledTree.querySelector('[data-node="deprecated"]'), { nodeKey: 'deprecated', parentKey: 'packages', textValue: 'legacy', disabled: true });
  setElementProps(disabledTree.querySelector('[data-node="license"]'), { nodeKey: 'license', textValue: 'LICENSE' });

  const readonlyTree = document.querySelector('#readonly-tree');
  setElementProps(readonlyTree, { readOnly: true, defaultValue: 'overview', defaultExpandedKeys: ['docs']${stylePropObj} });
  setElementProps(readonlyTree.querySelector('[data-node="docs"]'), { nodeKey: 'docs', textValue: 'docs' });
  setElementProps(readonlyTree.querySelector('[data-toggle="docs"]'), { nodeKey: 'docs'${toggleSizeObj} });
  setElementProps(readonlyTree.querySelector('[data-group="docs"]'), { nodeKey: 'docs' });
  setElementProps(readonlyTree.querySelector('[data-node="overview"]'), { nodeKey: 'overview', parentKey: 'docs', textValue: 'overview.mdx' });
  setElementProps(readonlyTree.querySelector('[data-node="api"]'), { nodeKey: 'api', parentKey: 'docs', textValue: 'api.mdx' });
</script>
    `),
    react: formatCode(`
import { ${C}Root, ${C}Item, ${C}Group, ${C}Toggle } from '../proto-ui/components/react';

export function TreeStatesDemo() {
  return (
    <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
      <${C}Root${stylePropReact} defaultValue="active" defaultExpandedKeys={['packages']}>
        <div className="flex items-center gap-1">
          <${C}Toggle nodeKey="packages"${toggleSizeReact}>▾</${C}Toggle>
          <${C}Item nodeKey="packages" textValue="packages" className="flex-1">packages/</${C}Item>
        </div>
        <${C}Group nodeKey="packages">
          <${C}Item nodeKey="active" parentKey="packages" textValue="core">core</${C}Item>
          <${C}Item nodeKey="deprecated" parentKey="packages" textValue="legacy" disabled>legacy (disabled)</${C}Item>
        </${C}Group>
        <${C}Item nodeKey="license" textValue="LICENSE">LICENSE</${C}Item>
      </${C}Root>

      <${C}Root${stylePropReact} readOnly defaultValue="overview" defaultExpandedKeys={['docs']}>
        <div className="flex items-center gap-1">
          <${C}Toggle nodeKey="docs"${toggleSizeReact}>▾</${C}Toggle>
          <${C}Item nodeKey="docs" textValue="docs" className="flex-1">docs/</${C}Item>
        </div>
        <${C}Group nodeKey="docs">
          <${C}Item nodeKey="overview" parentKey="docs" textValue="overview.mdx">overview.mdx</${C}Item>
          <${C}Item nodeKey="api" parentKey="docs" textValue="api.mdx">api.mdx</${C}Item>
        </${C}Group>
      </${C}Root>
    </div>
  );
}
    `),
    vue: formatCode(`
<script setup lang="ts">
import { ${C}Root, ${C}Item, ${C}Group, ${C}Toggle } from '../proto-ui/components/vue';
</script>

<template>
  <div class="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
    <${C}Root${stylePropReact} defaultValue="active" :defaultExpandedKeys="['packages']">
      <div class="flex items-center gap-1">
        <${C}Toggle nodeKey="packages"${toggleSizeReact}>▾</${C}Toggle>
        <${C}Item nodeKey="packages" textValue="packages" class="flex-1">packages/</${C}Item>
      </div>
      <${C}Group nodeKey="packages">
        <${C}Item nodeKey="active" parentKey="packages" textValue="core">core</${C}Item>
        <${C}Item nodeKey="deprecated" parentKey="packages" textValue="legacy" :disabled="true">legacy (disabled)</${C}Item>
      </${C}Group>
      <${C}Item nodeKey="license" textValue="LICENSE">LICENSE</${C}Item>
    </${C}Root>

    <${C}Root${stylePropReact} :readOnly="true" defaultValue="overview" :defaultExpandedKeys="['docs']">
      <div class="flex items-center gap-1">
        <${C}Toggle nodeKey="docs"${toggleSizeReact}>▾</${C}Toggle>
        <${C}Item nodeKey="docs" textValue="docs" class="flex-1">docs/</${C}Item>
      </div>
      <${C}Group nodeKey="docs">
        <${C}Item nodeKey="overview" parentKey="docs" textValue="overview.mdx">overview.mdx</${C}Item>
        <${C}Item nodeKey="api" parentKey="docs" textValue="api.mdx">api.mdx</${C}Item>
      </${C}Group>
    </${C}Root>
  </div>
</template>
    `),
    vue2: formatCode(`
<template>
  <div class="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
    <${C}Root${stylePropReact} defaultValue="active" :defaultExpandedKeys="['packages']">
      <div class="flex items-center gap-1">
        <${C}Toggle nodeKey="packages"${toggleSizeReact}>▾</${C}Toggle>
        <${C}Item nodeKey="packages" textValue="packages" class="flex-1">packages/</${C}Item>
      </div>
      <${C}Group nodeKey="packages">
        <${C}Item nodeKey="active" parentKey="packages" textValue="core">core</${C}Item>
        <${C}Item nodeKey="deprecated" parentKey="packages" textValue="legacy" :disabled="true">legacy (disabled)</${C}Item>
      </${C}Group>
      <${C}Item nodeKey="license" textValue="LICENSE">LICENSE</${C}Item>
    </${C}Root>

    <${C}Root${stylePropReact} :readOnly="true" defaultValue="overview" :defaultExpandedKeys="['docs']">
      <div class="flex items-center gap-1">
        <${C}Toggle nodeKey="docs"${toggleSizeReact}>▾</${C}Toggle>
        <${C}Item nodeKey="docs" textValue="docs" class="flex-1">docs/</${C}Item>
      </div>
      <${C}Group nodeKey="docs">
        <${C}Item nodeKey="overview" parentKey="docs" textValue="overview.mdx">overview.mdx</${C}Item>
        <${C}Item nodeKey="api" parentKey="docs" textValue="api.mdx">api.mdx</${C}Item>
      </${C}Group>
    </${C}Root>
  </div>
</template>

<script>
import { ${C}Root, ${C}Item, ${C}Group, ${C}Toggle } from '../proto-ui/components/vue2';

export default {
  components: { ${C}Root, ${C}Item, ${C}Group, ${C}Toggle },
};
</script>
    `),
  };
}

function makeRtlSnippets(meta: FamilyMeta) {
  const { wcTagPrefix: tag, componentPrefix: C, supportsStyleProfile, supportsIconToggle } = meta;
  const stylePropReact = supportsStyleProfile ? ' styleProfile="rhea"' : '';
  const stylePropObj = supportsStyleProfile ? ", styleProfile: 'rhea'" : '';
  const toggleSizeReact = supportsIconToggle ? ' size="icon"' : '';
  const toggleSizeObj = supportsIconToggle ? ", size: 'icon'" : '';

  return {
    wc: formatCode(`
<${tag}-root id="rtl-tree" class="w-full max-w-sm">
  <div class="flex items-center gap-1">
    <${tag}-toggle data-toggle="project"><span aria-hidden="true">▾</span><span class="sr-only">تبديل مجلد المشروع</span></${tag}-toggle>
    <${tag}-item data-node="project" class="flex-1">المشروع</${tag}-item>
  </div>
  <${tag}-group data-group="project">
    <${tag}-item data-node="components">المكونات</${tag}-item>
    <${tag}-item data-node="styles">الأنماط</${tag}-item>
  </${tag}-group>
  <${tag}-item data-node="readme">الدليل</${tag}-item>
</${tag}-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#rtl-tree');
  setElementProps(root, { direction: 'rtl', defaultValue: 'components', defaultExpandedKeys: ['project']${stylePropObj} });
  setElementProps(root.querySelector('[data-node="project"]'), { nodeKey: 'project', textValue: 'المشروع' });
  setElementProps(root.querySelector('[data-toggle="project"]'), { nodeKey: 'project'${toggleSizeObj} });
  setElementProps(root.querySelector('[data-group="project"]'), { nodeKey: 'project' });
  setElementProps(root.querySelector('[data-node="components"]'), { nodeKey: 'components', parentKey: 'project', textValue: 'المكونات' });
  setElementProps(root.querySelector('[data-node="styles"]'), { nodeKey: 'styles', parentKey: 'project', textValue: 'الأنماط' });
  setElementProps(root.querySelector('[data-node="readme"]'), { nodeKey: 'readme', textValue: 'الدليل' });
</script>
    `),
    react: formatCode(`
import { ${C}Root, ${C}Item, ${C}Group, ${C}Toggle } from '../proto-ui/components/react';

export function RtlTreeDemo() {
  return (
    <${C}Root${stylePropReact} direction="rtl" defaultValue="components" defaultExpandedKeys={['project']} className="w-full max-w-sm">
      <div className="flex items-center gap-1">
        <${C}Toggle nodeKey="project"${toggleSizeReact}>▾</${C}Toggle>
        <${C}Item nodeKey="project" textValue="المشروع" className="flex-1">المشروع</${C}Item>
      </div>
      <${C}Group nodeKey="project">
        <${C}Item nodeKey="components" parentKey="project" textValue="المكونات">المكونات</${C}Item>
        <${C}Item nodeKey="styles" parentKey="project" textValue="الأنماط">الأنماط</${C}Item>
      </${C}Group>
      <${C}Item nodeKey="readme" textValue="الدليل">الدليل</${C}Item>
    </${C}Root>
  );
}
    `),
    vue: formatCode(`
<script setup lang="ts">
import { ${C}Root, ${C}Item, ${C}Group, ${C}Toggle } from '../proto-ui/components/vue';
</script>

<template>
  <${C}Root${stylePropReact} direction="rtl" defaultValue="components" :defaultExpandedKeys="['project']" class="w-full max-w-sm">
    <div class="flex items-center gap-1">
      <${C}Toggle nodeKey="project"${toggleSizeReact}>▾</${C}Toggle>
      <${C}Item nodeKey="project" textValue="المشروع" class="flex-1">المشروع</${C}Item>
    </div>
    <${C}Group nodeKey="project">
      <${C}Item nodeKey="components" parentKey="project" textValue="المكونات">المكونات</${C}Item>
      <${C}Item nodeKey="styles" parentKey="project" textValue="الأنماط">الأنماط</${C}Item>
    </${C}Group>
    <${C}Item nodeKey="readme" textValue="الدليل">الدليل</${C}Item>
  </${C}Root>
</template>
    `),
    vue2: formatCode(`
<template>
  <${C}Root${stylePropReact} direction="rtl" defaultValue="components" :defaultExpandedKeys="['project']" class="w-full max-w-sm">
    <div class="flex items-center gap-1">
      <${C}Toggle nodeKey="project"${toggleSizeReact}>▾</${C}Toggle>
      <${C}Item nodeKey="project" textValue="المشروع" class="flex-1">المشروع</${C}Item>
    </div>
    <${C}Group nodeKey="project">
      <${C}Item nodeKey="components" parentKey="project" textValue="المكونات">المكونات</${C}Item>
      <${C}Item nodeKey="styles" parentKey="project" textValue="الأنماط">الأنماط</${C}Item>
    </${C}Group>
    <${C}Item nodeKey="readme" textValue="الدليل">الدليل</${C}Item>
  </${C}Root>
</template>

<script>
import { ${C}Root, ${C}Item, ${C}Group, ${C}Toggle } from '../proto-ui/components/vue2';

export default {
  components: { ${C}Root, ${C}Item, ${C}Group, ${C}Toggle },
};
</script>
    `),
  };
}

const shadcnEmbedded = {
  wc: formatCode(`
<div class="w-full max-w-xs rounded-xl border border-border bg-muted/30 p-3">
  <div class="mb-2 px-2 text-xs font-medium text-muted-foreground">Workspace</div>
  <proto-ui-shadcn-tree-root id="embedded-tree">
    <div class="flex items-center gap-1">
      <proto-ui-shadcn-tree-toggle data-toggle="docs"><span aria-hidden="true">▾</span><span class="sr-only">Toggle Documentation</span></proto-ui-shadcn-tree-toggle>
      <proto-ui-shadcn-tree-item data-node="docs" class="flex-1">Documentation</proto-ui-shadcn-tree-item>
    </div>
    <proto-ui-shadcn-tree-group data-group="docs">
      <proto-ui-shadcn-tree-item data-node="getting-started">Getting Started</proto-ui-shadcn-tree-item>
      <proto-ui-shadcn-tree-item data-node="theming">Theming &amp; Tokens</proto-ui-shadcn-tree-item>
      <proto-ui-shadcn-tree-item data-node="changelog">Changelog</proto-ui-shadcn-tree-item>
    </proto-ui-shadcn-tree-group>
    <proto-ui-shadcn-tree-item data-node="settings">Settings</proto-ui-shadcn-tree-item>
  </proto-ui-shadcn-tree-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#embedded-tree');
  setElementProps(root, {
    styleProfile: 'rhea',
    appearance: 'embedded',
    defaultValue: 'getting-started',
    defaultExpandedKeys: ['docs'],
  });
  setElementProps(root.querySelector('[data-node="docs"]'), { nodeKey: 'docs', textValue: 'Documentation' });
  setElementProps(root.querySelector('[data-toggle="docs"]'), { nodeKey: 'docs', size: 'icon' });
  setElementProps(root.querySelector('[data-group="docs"]'), { nodeKey: 'docs' });
  setElementProps(root.querySelector('[data-node="getting-started"]'), { nodeKey: 'getting-started', parentKey: 'docs', textValue: 'Getting Started' });
  setElementProps(root.querySelector('[data-node="theming"]'), { nodeKey: 'theming', parentKey: 'docs', textValue: 'Theming & Tokens' });
  setElementProps(root.querySelector('[data-node="changelog"]'), { nodeKey: 'changelog', parentKey: 'docs', textValue: 'Changelog' });
  setElementProps(root.querySelector('[data-node="settings"]'), { nodeKey: 'settings', textValue: 'Settings' });
</script>
  `),
  react: formatCode(`
import {
  ShadcnTreeRoot,
  ShadcnTreeItem,
  ShadcnTreeGroup,
  ShadcnTreeToggle,
} from '../proto-ui/components/react';

export function EmbeddedSidebarTreeDemo() {
  return (
    <div className="w-full max-w-xs rounded-xl border border-border bg-muted/30 p-3">
      <div className="mb-2 px-2 text-xs font-medium text-muted-foreground">Workspace</div>
      <ShadcnTreeRoot
        styleProfile="rhea"
        appearance="embedded"
        defaultValue="getting-started"
        defaultExpandedKeys={['docs']}
      >
        <div className="flex items-center gap-1">
          <ShadcnTreeToggle nodeKey="docs" size="icon">▾</ShadcnTreeToggle>
          <ShadcnTreeItem nodeKey="docs" textValue="Documentation" className="flex-1">Documentation</ShadcnTreeItem>
        </div>
        <ShadcnTreeGroup nodeKey="docs">
          <ShadcnTreeItem nodeKey="getting-started" parentKey="docs" textValue="Getting Started">Getting Started</ShadcnTreeItem>
          <ShadcnTreeItem nodeKey="theming" parentKey="docs" textValue="Theming & Tokens">Theming &amp; Tokens</ShadcnTreeItem>
          <ShadcnTreeItem nodeKey="changelog" parentKey="docs" textValue="Changelog">Changelog</ShadcnTreeItem>
        </ShadcnTreeGroup>
        <ShadcnTreeItem nodeKey="settings" textValue="Settings">Settings</ShadcnTreeItem>
      </ShadcnTreeRoot>
    </div>
  );
}
  `),
  vue: formatCode(`
<script setup lang="ts">
import {
  ShadcnTreeRoot,
  ShadcnTreeItem,
  ShadcnTreeGroup,
  ShadcnTreeToggle,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="w-full max-w-xs rounded-xl border border-border bg-muted/30 p-3">
    <div class="mb-2 px-2 text-xs font-medium text-muted-foreground">Workspace</div>
    <ShadcnTreeRoot
      styleProfile="rhea"
      appearance="embedded"
      defaultValue="getting-started"
      :defaultExpandedKeys="['docs']"
    >
      <div class="flex items-center gap-1">
        <ShadcnTreeToggle nodeKey="docs" size="icon">▾</ShadcnTreeToggle>
        <ShadcnTreeItem nodeKey="docs" textValue="Documentation" class="flex-1">Documentation</ShadcnTreeItem>
      </div>
      <ShadcnTreeGroup nodeKey="docs">
        <ShadcnTreeItem nodeKey="getting-started" parentKey="docs" textValue="Getting Started">Getting Started</ShadcnTreeItem>
        <ShadcnTreeItem nodeKey="theming" parentKey="docs" textValue="Theming & Tokens">Theming &amp; Tokens</ShadcnTreeItem>
        <ShadcnTreeItem nodeKey="changelog" parentKey="docs" textValue="Changelog">Changelog</ShadcnTreeItem>
      </ShadcnTreeGroup>
      <ShadcnTreeItem nodeKey="settings" textValue="Settings">Settings</ShadcnTreeItem>
    </ShadcnTreeRoot>
  </div>
</template>
  `),
  vue2: formatCode(`
<template>
  <div class="w-full max-w-xs rounded-xl border border-border bg-muted/30 p-3">
    <div class="mb-2 px-2 text-xs font-medium text-muted-foreground">Workspace</div>
    <ShadcnTreeRoot
      styleProfile="rhea"
      appearance="embedded"
      defaultValue="getting-started"
      :defaultExpandedKeys="['docs']"
    >
      <div class="flex items-center gap-1">
        <ShadcnTreeToggle nodeKey="docs" size="icon">▾</ShadcnTreeToggle>
        <ShadcnTreeItem nodeKey="docs" textValue="Documentation" class="flex-1">Documentation</ShadcnTreeItem>
      </div>
      <ShadcnTreeGroup nodeKey="docs">
        <ShadcnTreeItem nodeKey="getting-started" parentKey="docs" textValue="Getting Started">Getting Started</ShadcnTreeItem>
        <ShadcnTreeItem nodeKey="theming" parentKey="docs" textValue="Theming & Tokens">Theming &amp; Tokens</ShadcnTreeItem>
        <ShadcnTreeItem nodeKey="changelog" parentKey="docs" textValue="Changelog">Changelog</ShadcnTreeItem>
      </ShadcnTreeGroup>
      <ShadcnTreeItem nodeKey="settings" textValue="Settings">Settings</ShadcnTreeItem>
    </ShadcnTreeRoot>
  </div>
</template>

<script>
import {
  ShadcnTreeRoot,
  ShadcnTreeItem,
  ShadcnTreeGroup,
  ShadcnTreeToggle,
} from '../proto-ui/components/vue2';

export default {
  components: { ShadcnTreeRoot, ShadcnTreeItem, ShadcnTreeGroup, ShadcnTreeToggle },
};
</script>
  `),
};

function buildCodeMap(): Record<RuntimeId, Record<string, string>> {
  const result: Record<RuntimeId, Record<string, string>> = {
    wc: {},
    react: {},
    vue: {},
    vue2: {},
  };

  for (const meta of Object.values(FAMILIES)) {
    const basic = makeBasicSnippets(meta);
    const controlled = makeControlledSnippets(meta);
    const states = makeStatesSnippets(meta);
    const rtl = makeRtlSnippets(meta);
    for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
      result[runtime][meta.prefix] = basic[runtime];
      result[runtime][`${meta.prefix}-controlled`] = controlled[runtime];
      result[runtime][`${meta.prefix}-states`] = states[runtime];
      result[runtime][`${meta.prefix}-rtl`] = rtl[runtime];
    }
  }

  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    result[runtime]['demo-shadcn-tree-embedded'] = shadcnEmbedded[runtime];
  }

  return result;
}

export const codeMap: Record<RuntimeId, Record<string, string>> = buildCodeMap();
