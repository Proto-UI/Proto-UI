import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

function makeFamilySnippets(config: {
  family: 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass';
  pkg: string;
  tagPrefix: string;
  componentPrefix: string;
  buttonTag: string;
  buttonComp: string;
  styleProfileProp?: string;
}) {
  const { family, pkg, tagPrefix, componentPrefix, buttonTag, buttonComp, styleProfileProp } =
    config;
  const rootTag = `${tagPrefix}-virtual-list-root`;
  const viewportTag = `${tagPrefix}-virtual-list-viewport`;
  const contentTag = `${tagPrefix}-virtual-list-content`;
  const rootComp = `${componentPrefix}VirtualListRoot`;
  const viewportComp = `${componentPrefix}VirtualListViewport`;
  const contentComp = `${componentPrefix}VirtualListContent`;
  const profileJs = styleProfileProp ? ` styleProfile: '${styleProfileProp}',` : '';
  const profileAttr = styleProfileProp ? ` styleProfile="${styleProfileProp}"` : '';
  const profileVueAttr = styleProfileProp ? ` style-profile="${styleProfileProp}"` : '';

  const baseId = `demo-${family}-virtual-list`;
  const jumpId = `demo-${family}-virtual-list-jump`;
  const filterId = `demo-${family}-virtual-list-filter`;
  const windowId = `demo-${family}-virtual-list-window`;

  return {
    wc: {
      [baseId]: formatCode(`
<${rootTag} id="activity-list" class="w-full max-w-lg">
  <${viewportTag} id="activity-viewport" class="h-72">
    <${contentTag} id="activity-content"></${contentTag}>
  </${viewportTag}>
</${rootTag}>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  import { attachWebVirtualList } from '@proto.ui/prototypes-base/virtual-list/web';

  const keys = Array.from({ length: 1000 }, (_, i) => \`event-\${String(i + 1).padStart(4, '0')}\`);
  const list = document.querySelector('#activity-list');
  const viewport = document.querySelector('#activity-viewport');
  const content = document.querySelector('#activity-content');

  setElementProps(list, {${profileJs} itemKeys: keys, overscanItems: 3, maxMaterializedItems: 60 });

  const host = attachWebVirtualList({
    viewport,
    content,
    collection: list.getExposes().getCollection(),
    estimateSize: 64,
    renderItem(key) {
      const row = document.createElement('div');
      row.className = 'border-b border-border/60 px-4 py-3 text-sm';
      row.textContent = \`Activity \${key}\`;
      return row;
    },
  });
  // Call host.dispose() when removing the list.
</script>
      `),
      [jumpId]: formatCode(`
<div class="flex flex-col gap-3">
  <div class="flex flex-wrap gap-2">
    <${buttonTag} id="jump-top">Jump to #1</${buttonTag}>
    <${buttonTag} id="jump-mid">Center #250</${buttonTag}>
    <${buttonTag} id="jump-end">Jump to #1000</${buttonTag}>
  </div>
  <${rootTag} id="jump-list" class="w-full max-w-lg">
    <${viewportTag} id="jump-viewport" class="h-64">
      <${contentTag} id="jump-content"></${contentTag}>
    </${viewportTag}>
  </${rootTag}>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  import { attachWebVirtualList } from '@proto.ui/prototypes-base/virtual-list/web';

  const keys = Array.from({ length: 1000 }, (_, i) => \`item-\${String(i + 1).padStart(4, '0')}\`);
  const list = document.querySelector('#jump-list');
  setElementProps(list, {${profileJs} itemKeys: keys, overscanItems: 3, maxMaterializedItems: 60 });

  const host = attachWebVirtualList({
    viewport: document.querySelector('#jump-viewport'),
    content: document.querySelector('#jump-content'),
    collection: list.getExposes().getCollection(),
    estimateSize: 48,
    renderItem(key) {
      const row = document.createElement('div');
      row.className = 'border-b border-border/60 px-4 py-3 text-sm';
      row.textContent = \`Release entry \${key}\`;
      return row;
    },
  });

  document.querySelector('#jump-top').addEventListener('click', () => host.ensureVisible('item-0001', 'start'));
  document.querySelector('#jump-mid').addEventListener('click', () => host.ensureVisible('item-0250', 'center'));
  document.querySelector('#jump-end').addEventListener('click', () => host.ensureVisible('item-1000', 'end'));
</script>
      `),
      [filterId]: formatCode(`
<div class="flex flex-col gap-3">
  <div class="flex flex-wrap gap-2">
    <${buttonTag} id="filter-all">All (500)</${buttonTag}>
    <${buttonTag} id="filter-alerts">Alerts (125)</${buttonTag}>
    <${buttonTag} id="filter-empty">Empty (0)</${buttonTag}>
  </div>
  <${rootTag} id="filter-list" class="w-full max-w-lg">
    <${viewportTag} id="filter-viewport" class="h-60">
      <${contentTag} id="filter-content"></${contentTag}>
    </${viewportTag}>
  </${rootTag}>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  import { attachWebVirtualList } from '@proto.ui/prototypes-base/virtual-list/web';

  const allKeys = Array.from({ length: 500 }, (_, i) => \`rec-\${String(i + 1).padStart(4, '0')}\`);
  const alertKeys = allKeys.filter((_, i) => i % 4 === 0);
  const list = document.querySelector('#filter-list');
  setElementProps(list, {${profileJs} itemKeys: allKeys, overscanItems: 2, maxMaterializedItems: 50 });

  const host = attachWebVirtualList({
    viewport: document.querySelector('#filter-viewport'),
    content: document.querySelector('#filter-content'),
    collection: list.getExposes().getCollection(),
    estimateSize: 58,
    renderItem(key) {
      const row = document.createElement('div');
      row.className = 'border-b border-border/60 px-4 py-3 text-sm';
      row.textContent = key;
      return row;
    },
  });

  document.querySelector('#filter-all').addEventListener('click', () => setElementProps(list, { itemKeys: allKeys }));
  document.querySelector('#filter-alerts').addEventListener('click', () => setElementProps(list, { itemKeys: alertKeys }));
  document.querySelector('#filter-empty').addEventListener('click', () => setElementProps(list, { itemKeys: [] }));
</script>
      `),
      [windowId]: formatCode(`
<${rootTag} id="window-list" class="w-full max-w-lg">
  <${viewportTag} id="window-viewport" class="h-60">
    <${contentTag} id="window-content"></${contentTag}>
  </${viewportTag}>
</${rootTag}>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  import { attachWebVirtualList } from '@proto.ui/prototypes-base/virtual-list/web';

  const keys = Array.from({ length: 2000 }, (_, i) => \`row-\${String(i + 1).padStart(4, '0')}\`);
  const list = document.querySelector('#window-list');
  setElementProps(list, {${profileJs} itemKeys: keys, overscanItems: 1, maxMaterializedItems: 40 });

  const collection = list.getExposes().getCollection();
  const host = attachWebVirtualList({
    viewport: document.querySelector('#window-viewport'),
    content: document.querySelector('#window-content'),
    collection,
    estimateSize: 44,
    renderItem(key) {
      const row = document.createElement('div');
      row.className = 'border-b border-border/60 px-4 py-2.5 text-sm';
      row.textContent = \`Metric stream \${key}\`;
      return row;
    },
  });

  // Inspect bounded materialization at any time:
  const snapshot = collection.snapshot();
  console.log(snapshot.keys.length, snapshot.materializedKeys.length);
</script>
      `),
    },
    react: {
      [baseId]: formatCode(`
import { useEffect, useRef } from 'react';
import { AdaptToReact } from '@proto.ui/adapter-react';
import { virtualListRoot, virtualListViewport, virtualListContent } from '${pkg}/virtual-list';
import { attachWebVirtualList } from '@proto.ui/prototypes-base/virtual-list/web';

const ${rootComp} = AdaptToReact(virtualListRoot);
const ${viewportComp} = AdaptToReact(virtualListViewport);
const ${contentComp} = AdaptToReact(virtualListContent);

const keys = Array.from({ length: 1000 }, (_, i) => \`event-\${String(i + 1).padStart(4, '0')}\`);

export function VirtualListDemo() {
  const rootRef = useRef<any>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const collection = rootRef.current?.getExposes().getCollection();
    if (!collection || !viewportRef.current || !contentRef.current) return;
    const host = attachWebVirtualList({
      viewport: viewportRef.current,
      content: contentRef.current,
      collection,
      estimateSize: 64,
      renderItem(key) {
        const row = document.createElement('div');
        row.className = 'border-b border-border/60 px-4 py-3 text-sm';
        row.textContent = \`Activity \${key}\`;
        return row;
      },
    });
    return () => host.dispose();
  }, []);

  return (
    <${rootComp} ref={rootRef}${profileAttr} itemKeys={keys} overscanItems={3} maxMaterializedItems={60} className="w-full max-w-lg">
      <${viewportComp} ref={viewportRef} className="h-72">
        <${contentComp} ref={contentRef} />
      </${viewportComp}>
    </${rootComp}>
  );
}
      `),
      [jumpId]: formatCode(`
import { useEffect, useRef } from 'react';
import { AdaptToReact } from '@proto.ui/adapter-react';
import { virtualListRoot, virtualListViewport, virtualListContent } from '${pkg}/virtual-list';
import { attachWebVirtualList } from '@proto.ui/prototypes-base/virtual-list/web';

const ${rootComp} = AdaptToReact(virtualListRoot);
const ${viewportComp} = AdaptToReact(virtualListViewport);
const ${contentComp} = AdaptToReact(virtualListContent);
const keys = Array.from({ length: 1000 }, (_, i) => \`item-\${String(i + 1).padStart(4, '0')}\`);

export function VirtualListJumpDemo() {
  const rootRef = useRef<any>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<ReturnType<typeof attachWebVirtualList> | null>(null);

  useEffect(() => {
    const collection = rootRef.current?.getExposes().getCollection();
    if (!collection || !viewportRef.current || !contentRef.current) return;
    hostRef.current = attachWebVirtualList({
      viewport: viewportRef.current,
      content: contentRef.current,
      collection,
      estimateSize: 48,
      renderItem(key) {
        const row = document.createElement('div');
        row.className = 'border-b border-border/60 px-4 py-3 text-sm';
        row.textContent = \`Release entry \${key}\`;
        return row;
      },
    });
    return () => hostRef.current?.dispose();
  }, []);

  return (
    <div className="flex w-full max-w-lg flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <${buttonComp} onClick={() => hostRef.current?.ensureVisible('item-0001', 'start')}>Jump to #1</${buttonComp}>
        <${buttonComp} onClick={() => hostRef.current?.ensureVisible('item-0250', 'center')}>Center #250</${buttonComp}>
        <${buttonComp} onClick={() => hostRef.current?.ensureVisible('item-1000', 'end')}>Jump to #1000</${buttonComp}>
      </div>
      <${rootComp} ref={rootRef}${profileAttr} itemKeys={keys} overscanItems={3} maxMaterializedItems={60}>
        <${viewportComp} ref={viewportRef} className="h-64">
          <${contentComp} ref={contentRef} />
        </${viewportComp}>
      </${rootComp}>
    </div>
  );
}
      `),
      [filterId]: formatCode(`
import { useEffect, useMemo, useRef, useState } from 'react';
import { AdaptToReact } from '@proto.ui/adapter-react';
import { virtualListRoot, virtualListViewport, virtualListContent } from '${pkg}/virtual-list';
import { attachWebVirtualList } from '@proto.ui/prototypes-base/virtual-list/web';

const ${rootComp} = AdaptToReact(virtualListRoot);
const ${viewportComp} = AdaptToReact(virtualListViewport);
const ${contentComp} = AdaptToReact(virtualListContent);
const allKeys = Array.from({ length: 500 }, (_, i) => \`rec-\${String(i + 1).padStart(4, '0')}\`);

export function VirtualListFilterDemo() {
  const [filter, setFilter] = useState<'all' | 'alerts' | 'empty'>('all');
  const rootRef = useRef<any>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const itemKeys = useMemo(() => {
    if (filter === 'empty') return [];
    if (filter === 'alerts') return allKeys.filter((_, i) => i % 4 === 0);
    return allKeys;
  }, [filter]);

  useEffect(() => {
    const collection = rootRef.current?.getExposes().getCollection();
    if (!collection || !viewportRef.current || !contentRef.current) return;
    const host = attachWebVirtualList({
      viewport: viewportRef.current,
      content: contentRef.current,
      collection,
      estimateSize: 58,
      renderItem(key) {
        const row = document.createElement('div');
        row.className = 'border-b border-border/60 px-4 py-3 text-sm';
        row.textContent = key;
        return row;
      },
    });
    return () => host.dispose();
  }, []);

  return (
    <div className="flex w-full max-w-lg flex-col gap-3">
      <div className="flex gap-2">
        <${buttonComp} onClick={() => setFilter('all')}>All (500)</${buttonComp}>
        <${buttonComp} onClick={() => setFilter('alerts')}>Alerts (125)</${buttonComp}>
        <${buttonComp} onClick={() => setFilter('empty')}>Empty (0)</${buttonComp}>
      </div>
      <${rootComp} ref={rootRef}${profileAttr} itemKeys={itemKeys} overscanItems={2} maxMaterializedItems={50}>
        <${viewportComp} ref={viewportRef} className="h-60">
          <${contentComp} ref={contentRef} />
        </${viewportComp}>
      </${rootComp}>
    </div>
  );
}
      `),
      [windowId]: formatCode(`
import { useEffect, useRef, useState } from 'react';
import { AdaptToReact } from '@proto.ui/adapter-react';
import { virtualListRoot, virtualListViewport, virtualListContent } from '${pkg}/virtual-list';
import { attachWebVirtualList } from '@proto.ui/prototypes-base/virtual-list/web';

const ${rootComp} = AdaptToReact(virtualListRoot);
const ${viewportComp} = AdaptToReact(virtualListViewport);
const ${contentComp} = AdaptToReact(virtualListContent);
const keys = Array.from({ length: 2000 }, (_, i) => \`row-\${String(i + 1).padStart(4, '0')}\`);

export function VirtualListWindowDemo() {
  const [overscan, setOverscan] = useState(1);
  const rootRef = useRef<any>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const collection = rootRef.current?.getExposes().getCollection();
    if (!collection || !viewportRef.current || !contentRef.current) return;
    const host = attachWebVirtualList({
      viewport: viewportRef.current,
      content: contentRef.current,
      collection,
      estimateSize: 44,
      renderItem(key) {
        const row = document.createElement('div');
        row.className = 'border-b border-border/60 px-4 py-2.5 text-sm';
        row.textContent = \`Metric stream \${key}\`;
        return row;
      },
    });
    return () => host.dispose();
  }, []);

  return (
    <div className="flex w-full max-w-lg flex-col gap-3">
      <div className="flex gap-2">
        <${buttonComp} onClick={() => setOverscan(1)}>overscan: 1</${buttonComp}>
        <${buttonComp} onClick={() => setOverscan(6)}>overscan: 6</${buttonComp}>
      </div>
      <${rootComp} ref={rootRef}${profileAttr} itemKeys={keys} overscanItems={overscan} maxMaterializedItems={40}>
        <${viewportComp} ref={viewportRef} className="h-60">
          <${contentComp} ref={contentRef} />
        </${viewportComp}>
      </${rootComp}>
    </div>
  );
}
      `),
    },
    vue: {
      [baseId]: formatCode(`
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { AdaptToVue } from '@proto.ui/adapter-vue';
import { virtualListRoot, virtualListViewport, virtualListContent } from '${pkg}/virtual-list';
import { attachWebVirtualList } from '@proto.ui/prototypes-base/virtual-list/web';

const ${rootComp} = AdaptToVue(virtualListRoot);
const ${viewportComp} = AdaptToVue(virtualListViewport);
const ${contentComp} = AdaptToVue(virtualListContent);

const keys = Array.from({ length: 1000 }, (_, i) => \`event-\${String(i + 1).padStart(4, '0')}\`);
const rootRef = ref<any>(null);
const viewportRef = ref<any>(null);
const contentRef = ref<any>(null);
let host: ReturnType<typeof attachWebVirtualList> | null = null;

onMounted(() => {
  const collection = rootRef.value?.getExposes().getCollection();
  if (!collection) return;
  host = attachWebVirtualList({
    viewport: viewportRef.value.$el,
    content: contentRef.value.$el,
    collection,
    estimateSize: 64,
    renderItem(key) {
      const row = document.createElement('div');
      row.className = 'border-b border-border/60 px-4 py-3 text-sm';
      row.textContent = \`Activity \${key}\`;
      return row;
    },
  });
});

onBeforeUnmount(() => host?.dispose());
</script>

<template>
  <${rootComp} ref="rootRef"${profileVueAttr} :item-keys="keys" :overscan-items="3" :max-materialized-items="60" class="w-full max-w-lg">
    <${viewportComp} ref="viewportRef" class="h-72">
      <${contentComp} ref="contentRef" />
    </${viewportComp}>
  </${rootComp}>
</template>
      `),
      [jumpId]: formatCode(`
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { AdaptToVue } from '@proto.ui/adapter-vue';
import { virtualListRoot, virtualListViewport, virtualListContent } from '${pkg}/virtual-list';
import { attachWebVirtualList } from '@proto.ui/prototypes-base/virtual-list/web';

const ${rootComp} = AdaptToVue(virtualListRoot);
const ${viewportComp} = AdaptToVue(virtualListViewport);
const ${contentComp} = AdaptToVue(virtualListContent);

const keys = Array.from({ length: 1000 }, (_, i) => \`item-\${String(i + 1).padStart(4, '0')}\`);
const rootRef = ref<any>(null);
const viewportRef = ref<any>(null);
const contentRef = ref<any>(null);
let host: ReturnType<typeof attachWebVirtualList> | null = null;

onMounted(() => {
  host = attachWebVirtualList({
    viewport: viewportRef.value.$el,
    content: contentRef.value.$el,
    collection: rootRef.value.getExposes().getCollection(),
    estimateSize: 48,
    renderItem(key) {
      const row = document.createElement('div');
      row.className = 'border-b border-border/60 px-4 py-3 text-sm';
      row.textContent = \`Release entry \${key}\`;
      return row;
    },
  });
});

onBeforeUnmount(() => host?.dispose());
const jump = (key: string, align: 'start' | 'center' | 'end') => host?.ensureVisible(key, align);
</script>

<template>
  <div class="flex w-full max-w-lg flex-col gap-3">
    <div class="flex flex-wrap gap-2">
      <${buttonComp} @click="jump('item-0001', 'start')">Jump to #1</${buttonComp}>
      <${buttonComp} @click="jump('item-0250', 'center')">Center #250</${buttonComp}>
      <${buttonComp} @click="jump('item-1000', 'end')">Jump to #1000</${buttonComp}>
    </div>
    <${rootComp} ref="rootRef"${profileVueAttr} :item-keys="keys" :overscan-items="3" :max-materialized-items="60">
      <${viewportComp} ref="viewportRef" class="h-64">
        <${contentComp} ref="contentRef" />
      </${viewportComp}>
    </${rootComp}>
  </div>
</template>
      `),
      [filterId]: formatCode(`
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { AdaptToVue } from '@proto.ui/adapter-vue';
import { virtualListRoot, virtualListViewport, virtualListContent } from '${pkg}/virtual-list';
import { attachWebVirtualList } from '@proto.ui/prototypes-base/virtual-list/web';

const ${rootComp} = AdaptToVue(virtualListRoot);
const ${viewportComp} = AdaptToVue(virtualListViewport);
const ${contentComp} = AdaptToVue(virtualListContent);

const allKeys = Array.from({ length: 500 }, (_, i) => \`rec-\${String(i + 1).padStart(4, '0')}\`);
const filter = ref<'all' | 'alerts' | 'empty'>('all');
const itemKeys = computed(() =>
  filter.value === 'empty' ? [] : filter.value === 'alerts' ? allKeys.filter((_, i) => i % 4 === 0) : allKeys
);

const rootRef = ref<any>(null);
const viewportRef = ref<any>(null);
const contentRef = ref<any>(null);
let host: ReturnType<typeof attachWebVirtualList> | null = null;

onMounted(() => {
  host = attachWebVirtualList({
    viewport: viewportRef.value.$el,
    content: contentRef.value.$el,
    collection: rootRef.value.getExposes().getCollection(),
    estimateSize: 58,
    renderItem(key) {
      const row = document.createElement('div');
      row.className = 'border-b border-border/60 px-4 py-3 text-sm';
      row.textContent = key;
      return row;
    },
  });
});

onBeforeUnmount(() => host?.dispose());
</script>

<template>
  <div class="flex w-full max-w-lg flex-col gap-3">
    <div class="flex gap-2">
      <${buttonComp} @click="filter = 'all'">All (500)</${buttonComp}>
      <${buttonComp} @click="filter = 'alerts'">Alerts (125)</${buttonComp}>
      <${buttonComp} @click="filter = 'empty'">Empty (0)</${buttonComp}>
    </div>
    <${rootComp} ref="rootRef"${profileVueAttr} :item-keys="itemKeys" :overscan-items="2" :max-materialized-items="50">
      <${viewportComp} ref="viewportRef" class="h-60">
        <${contentComp} ref="contentRef" />
      </${viewportComp}>
    </${rootComp}>
  </div>
</template>
      `),
      [windowId]: formatCode(`
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { AdaptToVue } from '@proto.ui/adapter-vue';
import { virtualListRoot, virtualListViewport, virtualListContent } from '${pkg}/virtual-list';
import { attachWebVirtualList } from '@proto.ui/prototypes-base/virtual-list/web';

const ${rootComp} = AdaptToVue(virtualListRoot);
const ${viewportComp} = AdaptToVue(virtualListViewport);
const ${contentComp} = AdaptToVue(virtualListContent);

const keys = Array.from({ length: 2000 }, (_, i) => \`row-\${String(i + 1).padStart(4, '0')}\`);
const overscan = ref(1);
const rootRef = ref<any>(null);
const viewportRef = ref<any>(null);
const contentRef = ref<any>(null);
let host: ReturnType<typeof attachWebVirtualList> | null = null;

onMounted(() => {
  host = attachWebVirtualList({
    viewport: viewportRef.value.$el,
    content: contentRef.value.$el,
    collection: rootRef.value.getExposes().getCollection(),
    estimateSize: 44,
    renderItem(key) {
      const row = document.createElement('div');
      row.className = 'border-b border-border/60 px-4 py-2.5 text-sm';
      row.textContent = \`Metric stream \${key}\`;
      return row;
    },
  });
});

onBeforeUnmount(() => host?.dispose());
</script>

<template>
  <div class="flex w-full max-w-lg flex-col gap-3">
    <div class="flex gap-2">
      <${buttonComp} @click="overscan = 1">overscan: 1</${buttonComp}>
      <${buttonComp} @click="overscan = 6">overscan: 6</${buttonComp}>
    </div>
    <${rootComp} ref="rootRef"${profileVueAttr} :item-keys="keys" :overscan-items="overscan" :max-materialized-items="40">
      <${viewportComp} ref="viewportRef" class="h-60">
        <${contentComp} ref="contentRef" />
      </${viewportComp}>
    </${rootComp}>
  </div>
</template>
      `),
    },
    vue2: {
      [baseId]: formatCode(`
<template>
  <${rootComp} ref="root"${profileVueAttr} :item-keys="keys" :overscan-items="3" :max-materialized-items="60" class="w-full max-w-lg">
    <${viewportComp} ref="viewport" class="h-72">
      <${contentComp} ref="content" />
    </${viewportComp}>
  </${rootComp}>
</template>

<script>
import { AdaptToVue2 } from '@proto.ui/adapter-vue2';
import { virtualListRoot, virtualListViewport, virtualListContent } from '${pkg}/virtual-list';
import { attachWebVirtualList } from '@proto.ui/prototypes-base/virtual-list/web';

export default {
  components: {
    ${rootComp}: AdaptToVue2(virtualListRoot),
    ${viewportComp}: AdaptToVue2(virtualListViewport),
    ${contentComp}: AdaptToVue2(virtualListContent),
  },
  data() {
    return {
      keys: Array.from({ length: 1000 }, (_, i) => \`event-\${String(i + 1).padStart(4, '0')}\`),
    };
  },
  mounted() {
    this._host = attachWebVirtualList({
      viewport: this.$refs.viewport.$el,
      content: this.$refs.content.$el,
      collection: this.$refs.root.getExposes().getCollection(),
      estimateSize: 64,
      renderItem(key) {
        const row = document.createElement('div');
        row.className = 'border-b border-border/60 px-4 py-3 text-sm';
        row.textContent = \`Activity \${key}\`;
        return row;
      },
    });
  },
  beforeDestroy() {
    this._host && this._host.dispose();
  },
};
</script>
      `),
      [jumpId]: formatCode(`
<template>
  <div class="flex w-full max-w-lg flex-col gap-3">
    <div class="flex flex-wrap gap-2">
      <${buttonComp} @click="jump('item-0001', 'start')">Jump to #1</${buttonComp}>
      <${buttonComp} @click="jump('item-0250', 'center')">Center #250</${buttonComp}>
      <${buttonComp} @click="jump('item-1000', 'end')">Jump to #1000</${buttonComp}>
    </div>
    <${rootComp} ref="root"${profileVueAttr} :item-keys="keys" :overscan-items="3" :max-materialized-items="60">
      <${viewportComp} ref="viewport" class="h-64">
        <${contentComp} ref="content" />
      </${viewportComp}>
    </${rootComp}>
  </div>
</template>

<script>
import { AdaptToVue2 } from '@proto.ui/adapter-vue2';
import { virtualListRoot, virtualListViewport, virtualListContent } from '${pkg}/virtual-list';
import { attachWebVirtualList } from '@proto.ui/prototypes-base/virtual-list/web';

export default {
  components: {
    ${rootComp}: AdaptToVue2(virtualListRoot),
    ${viewportComp}: AdaptToVue2(virtualListViewport),
    ${contentComp}: AdaptToVue2(virtualListContent),
  },
  data() {
    return {
      keys: Array.from({ length: 1000 }, (_, i) => \`item-\${String(i + 1).padStart(4, '0')}\`),
    };
  },
  mounted() {
    this._host = attachWebVirtualList({
      viewport: this.$refs.viewport.$el,
      content: this.$refs.content.$el,
      collection: this.$refs.root.getExposes().getCollection(),
      estimateSize: 48,
      renderItem(key) {
        const row = document.createElement('div');
        row.className = 'border-b border-border/60 px-4 py-3 text-sm';
        row.textContent = \`Release entry \${key}\`;
        return row;
      },
    });
  },
  beforeDestroy() {
    this._host && this._host.dispose();
  },
  methods: {
    jump(key, align) {
      this._host && this._host.ensureVisible(key, align);
    },
  },
};
</script>
      `),
      [filterId]: formatCode(`
<template>
  <div class="flex w-full max-w-lg flex-col gap-3">
    <div class="flex gap-2">
      <${buttonComp} @click="filter = 'all'">All (500)</${buttonComp}>
      <${buttonComp} @click="filter = 'alerts'">Alerts (125)</${buttonComp}>
      <${buttonComp} @click="filter = 'empty'">Empty (0)</${buttonComp}>
    </div>
    <${rootComp} ref="root"${profileVueAttr} :item-keys="itemKeys" :overscan-items="2" :max-materialized-items="50">
      <${viewportComp} ref="viewport" class="h-60">
        <${contentComp} ref="content" />
      </${viewportComp}>
    </${rootComp}>
  </div>
</template>

<script>
import { AdaptToVue2 } from '@proto.ui/adapter-vue2';
import { virtualListRoot, virtualListViewport, virtualListContent } from '${pkg}/virtual-list';
import { attachWebVirtualList } from '@proto.ui/prototypes-base/virtual-list/web';

const allKeys = Array.from({ length: 500 }, (_, i) => \`rec-\${String(i + 1).padStart(4, '0')}\`);

export default {
  components: {
    ${rootComp}: AdaptToVue2(virtualListRoot),
    ${viewportComp}: AdaptToVue2(virtualListViewport),
    ${contentComp}: AdaptToVue2(virtualListContent),
  },
  data() {
    return { filter: 'all' };
  },
  computed: {
    itemKeys() {
      if (this.filter === 'empty') return [];
      if (this.filter === 'alerts') return allKeys.filter((_, i) => i % 4 === 0);
      return allKeys;
    },
  },
  mounted() {
    this._host = attachWebVirtualList({
      viewport: this.$refs.viewport.$el,
      content: this.$refs.content.$el,
      collection: this.$refs.root.getExposes().getCollection(),
      estimateSize: 58,
      renderItem(key) {
        const row = document.createElement('div');
        row.className = 'border-b border-border/60 px-4 py-3 text-sm';
        row.textContent = key;
        return row;
      },
    });
  },
  beforeDestroy() {
    this._host && this._host.dispose();
  },
};
</script>
      `),
      [windowId]: formatCode(`
<template>
  <div class="flex w-full max-w-lg flex-col gap-3">
    <div class="flex gap-2">
      <${buttonComp} @click="overscan = 1">overscan: 1</${buttonComp}>
      <${buttonComp} @click="overscan = 6">overscan: 6</${buttonComp}>
    </div>
    <${rootComp} ref="root"${profileVueAttr} :item-keys="keys" :overscan-items="overscan" :max-materialized-items="40">
      <${viewportComp} ref="viewport" class="h-60">
        <${contentComp} ref="content" />
      </${viewportComp}>
    </${rootComp}>
  </div>
</template>

<script>
import { AdaptToVue2 } from '@proto.ui/adapter-vue2';
import { virtualListRoot, virtualListViewport, virtualListContent } from '${pkg}/virtual-list';
import { attachWebVirtualList } from '@proto.ui/prototypes-base/virtual-list/web';

export default {
  components: {
    ${rootComp}: AdaptToVue2(virtualListRoot),
    ${viewportComp}: AdaptToVue2(virtualListViewport),
    ${contentComp}: AdaptToVue2(virtualListContent),
  },
  data() {
    return {
      overscan: 1,
      keys: Array.from({ length: 2000 }, (_, i) => \`row-\${String(i + 1).padStart(4, '0')}\`),
    };
  },
  mounted() {
    this._host = attachWebVirtualList({
      viewport: this.$refs.viewport.$el,
      content: this.$refs.content.$el,
      collection: this.$refs.root.getExposes().getCollection(),
      estimateSize: 44,
      renderItem(key) {
        const row = document.createElement('div');
        row.className = 'border-b border-border/60 px-4 py-2.5 text-sm';
        row.textContent = \`Metric stream \${key}\`;
        return row;
      },
    });
  },
  beforeDestroy() {
    this._host && this._host.dispose();
  },
};
</script>
      `),
    },
  };
}

const shadcn = makeFamilySnippets({
  family: 'shadcn',
  pkg: '@proto.ui/prototypes-shadcn',
  tagPrefix: 'proto-ui-shadcn',
  componentPrefix: 'Shadcn',
  buttonTag: 'proto-ui-shadcn-button',
  buttonComp: 'ShadcnButton',
  styleProfileProp: 'rhea',
});

const brutalist = makeFamilySnippets({
  family: 'brutalist',
  pkg: '@proto.ui/prototypes-brutalist',
  tagPrefix: 'proto-ui-brutalist',
  componentPrefix: 'Brutalist',
  buttonTag: 'proto-ui-brutalist-button',
  buttonComp: 'BrutalistButton',
});

const bootstrap = makeFamilySnippets({
  family: 'bootstrap-2-3-2',
  pkg: '@proto.ui/prototypes-bootstrap-2-3-2',
  tagPrefix: 'proto-ui-bootstrap-2-3-2',
  componentPrefix: 'Bootstrap',
  buttonTag: 'proto-ui-bootstrap-2-3-2-button',
  buttonComp: 'BootstrapButton',
});

const liquidGlass = makeFamilySnippets({
  family: 'liquid-glass',
  pkg: '@proto.ui/prototypes-liquid-glass',
  tagPrefix: 'proto-ui-liquid-glass',
  componentPrefix: 'LiquidGlass',
  buttonTag: 'proto-ui-liquid-glass-button',
  buttonComp: 'LiquidGlassButton',
});

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: { ...shadcn.wc, ...brutalist.wc, ...bootstrap.wc, ...liquidGlass.wc },
  react: { ...shadcn.react, ...brutalist.react, ...bootstrap.react, ...liquidGlass.react },
  vue: { ...shadcn.vue, ...brutalist.vue, ...bootstrap.vue, ...liquidGlass.vue },
  vue2: { ...shadcn.vue2, ...brutalist.vue2, ...bootstrap.vue2, ...liquidGlass.vue2 },
};
