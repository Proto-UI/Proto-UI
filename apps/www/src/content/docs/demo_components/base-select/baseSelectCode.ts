import { formatCode } from '@/utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/registry';

export const codeMap: Partial<Record<RuntimeId, Record<string, string>>> = {
  wc: {
    'demo-base-select': formatCode(`
<wc-base-select-root class="relative inline-flex flex-col gap-2">
  <wc-base-select-trigger class="inline-flex min-w-56 items-center justify-between gap-3 rounded-md border bg-white px-3 py-2 text-sm shadow-sm cursor-pointer select-none">
    <wc-base-select-value placeholder="Pick a framework"></wc-base-select-value>
    <span class="text-slate-400">▾</span>
  </wc-base-select-trigger>

  <wc-base-select-content class="w-56 rounded-md border bg-white p-1 shadow-lg">
    <wc-base-select-item value="react" textValue="React" class="block rounded px-3 py-2 text-sm cursor-pointer">
      React
    </wc-base-select-item>
    <wc-base-select-item value="vue" textValue="Vue" class="block rounded px-3 py-2 text-sm cursor-pointer">
      Vue
    </wc-base-select-item>
    <wc-base-select-item value="wc" textValue="Web Components" class="block rounded px-3 py-2 text-sm cursor-pointer">
      Web Components
    </wc-base-select-item>
  </wc-base-select-content>
</wc-base-select-root>
    `),
  },
  react: {
    'demo-base-select': formatCode(`
<BaseSelectRoot className="relative inline-flex flex-col gap-2">
  <BaseSelectTrigger className="inline-flex min-w-56 items-center justify-between gap-3 rounded-md border bg-white px-3 py-2 text-sm shadow-sm cursor-pointer select-none">
    <BaseSelectValue placeholder="Pick a framework" />
    <span className="text-slate-400">▾</span>
  </BaseSelectTrigger>

  <BaseSelectContent className="w-56 rounded-md border bg-white p-1 shadow-lg">
    <BaseSelectItem value="react" textValue="React" className="block rounded px-3 py-2 text-sm cursor-pointer">
      React
    </BaseSelectItem>
    <BaseSelectItem value="vue" textValue="Vue" className="block rounded px-3 py-2 text-sm cursor-pointer">
      Vue
    </BaseSelectItem>
    <BaseSelectItem value="wc" textValue="Web Components" className="block rounded px-3 py-2 text-sm cursor-pointer">
      Web Components
    </BaseSelectItem>
  </BaseSelectContent>
</BaseSelectRoot>
    `),
  },
  vue: {
    'demo-base-select': formatCode(`
<BaseSelectRoot class="relative inline-flex flex-col gap-2">
  <BaseSelectTrigger class="inline-flex min-w-56 items-center justify-between gap-3 rounded-md border bg-white px-3 py-2 text-sm shadow-sm cursor-pointer select-none">
    <BaseSelectValue placeholder="Pick a framework" />
    <span class="text-slate-400">▾</span>
  </BaseSelectTrigger>

  <BaseSelectContent class="w-56 rounded-md border bg-white p-1 shadow-lg">
    <BaseSelectItem value="react" textValue="React" class="block rounded px-3 py-2 text-sm cursor-pointer">
      React
    </BaseSelectItem>
    <BaseSelectItem value="vue" textValue="Vue" class="block rounded px-3 py-2 text-sm cursor-pointer">
      Vue
    </BaseSelectItem>
    <BaseSelectItem value="wc" textValue="Web Components" class="block rounded px-3 py-2 text-sm cursor-pointer">
      Web Components
    </BaseSelectItem>
  </BaseSelectContent>
</BaseSelectRoot>
    `),
  },
  vue2: {
    'demo-base-select': formatCode(`
<template>
  <BaseSelectRoot class="relative inline-flex flex-col gap-2">
    <BaseSelectTrigger class="inline-flex min-w-56 items-center justify-between gap-3 rounded-md border bg-white px-3 py-2 text-sm shadow-sm cursor-pointer select-none">
      <BaseSelectValue placeholder="Pick a framework" />
      <span class="text-slate-400">▾</span>
    </BaseSelectTrigger>

    <BaseSelectContent class="w-56 rounded-md border bg-white p-1 shadow-lg">
      <BaseSelectItem value="react" textValue="React" class="block rounded px-3 py-2 text-sm cursor-pointer">React</BaseSelectItem>
      <BaseSelectItem value="vue" textValue="Vue" class="block rounded px-3 py-2 text-sm cursor-pointer">Vue</BaseSelectItem>
      <BaseSelectItem value="wc" textValue="Web Components" class="block rounded px-3 py-2 text-sm cursor-pointer">Web Components</BaseSelectItem>
    </BaseSelectContent>
  </BaseSelectRoot>
</template>

<script>
import Vue from 'vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import {
  selectRoot,
  selectTrigger,
  selectValue,
  selectContent,
  selectItem,
} from '@proto.ui/prototypes-base/select';

const adapt = createVue2Adapter({
  extend: Vue.extend.bind(Vue),
  nextTick: Vue.nextTick.bind(Vue),
  set: Vue.set.bind(Vue),
  delete: Vue.delete.bind(Vue),
});

export default {
  components: {
    BaseSelectRoot: adapt(selectRoot),
    BaseSelectTrigger: adapt(selectTrigger),
    BaseSelectValue: adapt(selectValue),
    BaseSelectContent: adapt(selectContent),
    BaseSelectItem: adapt(selectItem),
  },
};
</script>
    `),
  },
};
