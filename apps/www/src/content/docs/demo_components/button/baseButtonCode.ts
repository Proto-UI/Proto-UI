import type { CodeExampleFile, CodeExamplesByHost } from '@/components/code-example-types';

const layout = `/* src/base-button-demo.css — application-owned presentation */
.base-button-examples { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; }
.base-button-example { border: 1px solid currentColor; border-radius: 0.25rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; font-weight: 500; }
.base-button-example.is-disabled { opacity: 0.5; }`;

const stylesheet: CodeExampleFile = { name: 'src/base-button-demo.css', lang: 'css', code: layout };

/** The same enabled/disabled composition as demo-base-button, using public CLI facades. */
export const baseButtonFiles: CodeExamplesByHost = {
  wc: [
    {
      name: 'src/main.ts',
      lang: 'typescript',
      code: `import './styles/proto-ui-style.css';
import './base-button-demo.css';
import { setElementProps } from '@proto.ui/adapter-web-component';
import '../proto-ui/components/wc';

const disabledButton = document.querySelector('#disabled-action');
if (!(disabledButton instanceof HTMLElement)) throw new Error('Missing #disabled-action');
setElementProps(disabledButton, { disabled: true });`,
    },
    {
      name: 'index.html',
      lang: 'html',
      code: `<div class="base-button-examples">
  <proto-ui-base-button class="base-button-example">Run action</proto-ui-base-button>
  <proto-ui-base-button id="disabled-action" class="base-button-example is-disabled">Disabled</proto-ui-base-button>
</div>
<script type="module" src="/src/main.ts"></script>`,
    },
    stylesheet,
  ],
  react: [
    {
      name: 'src/App.tsx',
      lang: 'tsx',
      code: `import './styles/proto-ui-style.css';
import './base-button-demo.css';
import { BaseButton } from '../proto-ui/components/react';

export default function App() {
  return (
    <div className="base-button-examples">
      <BaseButton className="base-button-example">Run action</BaseButton>
      <BaseButton className="base-button-example is-disabled" disabled>Disabled</BaseButton>
    </div>
  );
}`,
    },
    stylesheet,
  ],
  vue: [
    {
      name: 'src/App.vue',
      lang: 'vue',
      code: `<script setup lang="ts">
import './styles/proto-ui-style.css';
import './base-button-demo.css';
import { BaseButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="base-button-examples">
    <BaseButton class="base-button-example">Run action</BaseButton>
    <BaseButton class="base-button-example is-disabled" :disabled="true">Disabled</BaseButton>
  </div>
</template>`,
    },
    stylesheet,
  ],
  vue2: [
    {
      name: 'src/App.vue',
      lang: 'vue',
      code: `<script>
import './styles/proto-ui-style.css';
import './base-button-demo.css';
import { BaseButton } from '../proto-ui/components/vue2';

export default {
  components: { BaseButton },
};
</script>

<template>
  <div class="base-button-examples">
    <BaseButton class="base-button-example">Run action</BaseButton>
    <BaseButton class="base-button-example is-disabled" :disabled="true">Disabled</BaseButton>
  </div>
</template>`,
    },
    stylesheet,
  ],
};
