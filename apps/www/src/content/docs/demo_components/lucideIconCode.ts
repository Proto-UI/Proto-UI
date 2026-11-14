import type { CodeExamplesByHost } from '@/components/code-example-types';

/** Current public Adapter entrypoints, also used by the CLI's host facade registry. */
export const lucideIconFiles: CodeExamplesByHost = {
  wc: [
    {
      name: 'src/main.ts',
      lang: 'typescript',
      code: `import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { lucideCheckIcon } from '@proto.ui/prototypes-lucide/icons/check';

const CheckIcon = AdaptToWebComponent(lucideCheckIcon, { registerAs: 'app-check-icon' });
const icon = new CheckIcon();
setElementProps(icon, { size: 18, strokeWidth: 2 });
const slot = document.querySelector('#check-icon');
if (!slot) throw new Error('Missing #check-icon mount');
slot.append(icon);`,
    },
    {
      name: 'index.html',
      lang: 'html',
      code: `<p><span id="check-icon" aria-hidden="true"></span> Saved</p>
<script type="module" src="/src/main.ts"></script>`,
    },
  ],
  react: [
    {
      name: 'src/App.tsx',
      lang: 'tsx',
      code: `import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { lucideCheckIcon } from '@proto.ui/prototypes-lucide/icons/check';

const CheckIcon = createReactAdapter(React)(lucideCheckIcon);

export default function App() {
  return <p><span aria-hidden="true"><CheckIcon size={18} strokeWidth={2} /></span> Saved</p>;
}`,
    },
  ],
  vue: [
    {
      name: 'src/App.vue',
      lang: 'vue',
      code: `<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { lucideCheckIcon } from '@proto.ui/prototypes-lucide/icons/check';

const CheckIcon = createVueAdapter(Vue)(lucideCheckIcon);
</script>

<template>
  <p><span aria-hidden="true"><CheckIcon :size="18" :strokeWidth="2" /></span> Saved</p>
</template>`,
    },
  ],
  vue2: [
    {
      name: 'src/App.vue',
      lang: 'vue',
      code: `<script>
import Vue from 'vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { lucideCheckIcon } from '@proto.ui/prototypes-lucide/icons/check';

const adapt = createVue2Adapter({
  extend: Vue.extend.bind(Vue),
  nextTick: Vue.nextTick.bind(Vue),
  set: Vue.set.bind(Vue),
  delete: Vue.delete.bind(Vue),
});

export default {
  components: { CheckIcon: adapt(lucideCheckIcon) },
};
</script>

<template>
  <p><span aria-hidden="true"><CheckIcon :size="18" :strokeWidth="2" /></span> Saved</p>
</template>`,
    },
  ],
};
