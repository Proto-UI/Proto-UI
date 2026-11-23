import { formatCode } from '@/utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

// Authored public entrypoints and Adapter setup are part of these examples.
// Keep them executable; a static DemoSpec tree cannot generate this ownership.
export const codeMap: Partial<Record<RuntimeId, Record<string, string>>> = {
  wc: {
    'demo-base-select': formatCode(`
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Base Select</title>
    <style>
.base-select-example-root {
  position: relative; display: inline-flex; flex-direction: column; gap: 0.5rem;
}
.base-select-example-trigger {
  display: inline-flex; min-width: 14rem; align-items: center; justify-content: space-between;
  box-sizing: border-box; gap: 0.75rem; border: 1px solid #cbd5e1; border-radius: 0.375rem;
  background: #fff; color: #0f172a; padding: 0.5rem 0.75rem;
  font: 400 0.875rem/1.5 system-ui, sans-serif; cursor: pointer; user-select: none;
}
.base-select-example-content {
  box-sizing: border-box; width: 14rem; border: 1px solid #cbd5e1; border-radius: 0.375rem;
  background: #fff; color: #0f172a; padding: 0.25rem;
  font: 400 0.875rem/1.5 system-ui, sans-serif; box-shadow: 0 6px 18px #0002;
}
.base-select-example-item {
  display: block; border-radius: 0.25rem; padding: 0.5rem 0.75rem; cursor: pointer;
}
.base-select-example-item[data-selected] { background: #e2e8f0; }
.base-select-example-item[data-active] { background: #f1f5f9; }
.base-select-example-trigger:focus-visible,
.base-select-example-item:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
.base-select-example-icon { display: inline-flex; color: #64748b; }
    </style>
  </head>
  <body>
    <template id="base-select-example">
      <app-base-select-root class="base-select-example-root">
        <app-base-select-trigger class="base-select-example-trigger">
          <app-base-select-value></app-base-select-value>
          <span aria-hidden="true" class="base-select-example-icon">
            <app-base-select-chevron></app-base-select-chevron>
          </span>
        </app-base-select-trigger>
        <app-base-select-content class="base-select-example-content">
          <app-base-select-item data-option="react" class="base-select-example-item">React</app-base-select-item>
          <app-base-select-item data-option="vue" class="base-select-example-item">Vue</app-base-select-item>
          <app-base-select-item data-option="wc" class="base-select-example-item">Web Components</app-base-select-item>
        </app-base-select-content>
      </app-base-select-root>
    </template>

    <script type="module">
import './src/styles/proto-ui-style.css';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  selectRoot,
  selectTrigger,
  selectValue,
  selectContent,
  selectItem,
} from '@proto.ui/prototypes-base/select';
import lucideChevronDownIcon from '@proto.ui/prototypes-lucide/icons/chevron-down';

AdaptToWebComponent(selectRoot, { registerAs: 'app-base-select-root' });
AdaptToWebComponent(selectTrigger, { registerAs: 'app-base-select-trigger' });
AdaptToWebComponent(selectValue, { registerAs: 'app-base-select-value' });
AdaptToWebComponent(selectContent, { registerAs: 'app-base-select-content' });
AdaptToWebComponent(selectItem, { registerAs: 'app-base-select-item' });
AdaptToWebComponent(lucideChevronDownIcon, { registerAs: 'app-base-select-chevron' });

const template = document.querySelector('#base-select-example');
if (!(template instanceof HTMLTemplateElement)) throw new Error('Missing Select template');
const fragment = template.content.cloneNode(true);
function element(selector) {
  const node = fragment.querySelector(selector);
  if (!(node instanceof HTMLElement)) throw new Error('Missing Select part: ' + selector);
  return node;
}

// Supply portable props before the custom elements connect.
setElementProps(element('app-base-select-trigger'), { accessibleLabel: 'Framework selector' });
setElementProps(element('app-base-select-value'), { placeholder: 'Pick a framework' });
setElementProps(element('app-base-select-chevron'), { size: 16 });
for (const [value, textValue] of [
  ['react', 'React'],
  ['vue', 'Vue'],
  ['wc', 'Web Components'],
]) {
  setElementProps(element('app-base-select-item[data-option="' + value + '"]'), {
    value,
    textValue,
  });
}
template.replaceWith(fragment);
    </script>
  </body>
</html>
    `),
  },
  react: {
    'demo-base-select': formatCode(`
import './styles/proto-ui-style.css';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { createReactAdapter } from '@proto.ui/adapter-react';
import {
  selectRoot,
  selectTrigger,
  selectValue,
  selectContent,
  selectItem,
} from '@proto.ui/prototypes-base/select';
import lucideChevronDownIcon from '@proto.ui/prototypes-lucide/icons/chevron-down';

const adapt = createReactAdapter({ ...React, createPortal });
const BaseSelectRoot = adapt(selectRoot);
const BaseSelectTrigger = adapt(selectTrigger);
const BaseSelectValue = adapt(selectValue);
const BaseSelectContent = adapt(selectContent);
const BaseSelectItem = adapt(selectItem);
const LucideChevronDownIcon = adapt(lucideChevronDownIcon);

const styles = \`.base-select-example-root {
  position: relative; display: inline-flex; flex-direction: column; gap: 0.5rem;
}
.base-select-example-trigger {
  display: inline-flex; min-width: 14rem; align-items: center; justify-content: space-between;
  box-sizing: border-box; gap: 0.75rem; border: 1px solid #cbd5e1; border-radius: 0.375rem;
  background: #fff; color: #0f172a; padding: 0.5rem 0.75rem;
  font: 400 0.875rem/1.5 system-ui, sans-serif; cursor: pointer; user-select: none;
}
.base-select-example-content {
  box-sizing: border-box; width: 14rem; border: 1px solid #cbd5e1; border-radius: 0.375rem;
  background: #fff; color: #0f172a; padding: 0.25rem;
  font: 400 0.875rem/1.5 system-ui, sans-serif; box-shadow: 0 6px 18px #0002;
}
.base-select-example-item {
  display: block; border-radius: 0.25rem; padding: 0.5rem 0.75rem; cursor: pointer;
}
.base-select-example-item[data-selected] { background: #e2e8f0; }
.base-select-example-item[data-active] { background: #f1f5f9; }
.base-select-example-trigger:focus-visible,
.base-select-example-item:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
.base-select-example-icon { display: inline-flex; color: #64748b; }\`;

export default function App() {
  return (
    <>
      <style>{styles}</style>
      <BaseSelectRoot className="base-select-example-root">
        <BaseSelectTrigger accessibleLabel="Framework selector" className="base-select-example-trigger">
          <BaseSelectValue placeholder="Pick a framework" />
          <span aria-hidden="true" className="base-select-example-icon">
            <LucideChevronDownIcon size={16} />
          </span>
        </BaseSelectTrigger>
        <BaseSelectContent className="base-select-example-content">
          <BaseSelectItem value="react" textValue="React" className="base-select-example-item">React</BaseSelectItem>
          <BaseSelectItem value="vue" textValue="Vue" className="base-select-example-item">Vue</BaseSelectItem>
          <BaseSelectItem value="wc" textValue="Web Components" className="base-select-example-item">Web Components</BaseSelectItem>
        </BaseSelectContent>
      </BaseSelectRoot>
    </>
  );
}
    `),
  },
  vue: {
    'demo-base-select': formatCode(`
<script setup lang="ts">
import './styles/proto-ui-style.css';
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import {
  selectRoot,
  selectTrigger,
  selectValue,
  selectContent,
  selectItem,
} from '@proto.ui/prototypes-base/select';
import lucideChevronDownIcon from '@proto.ui/prototypes-lucide/icons/chevron-down';

const adapt = createVueAdapter(Vue);
const BaseSelectRoot = adapt(selectRoot);
const BaseSelectTrigger = adapt(selectTrigger);
const BaseSelectValue = adapt(selectValue);
const BaseSelectContent = adapt(selectContent);
const BaseSelectItem = adapt(selectItem);
const LucideChevronDownIcon = adapt(lucideChevronDownIcon);
</script>

<template>
  <BaseSelectRoot class="base-select-example-root">
    <BaseSelectTrigger accessibleLabel="Framework selector" class="base-select-example-trigger">
      <BaseSelectValue placeholder="Pick a framework" />
      <span aria-hidden="true" class="base-select-example-icon">
        <LucideChevronDownIcon :size="16" />
      </span>
    </BaseSelectTrigger>
    <BaseSelectContent class="base-select-example-content">
      <BaseSelectItem value="react" textValue="React" class="base-select-example-item">React</BaseSelectItem>
      <BaseSelectItem value="vue" textValue="Vue" class="base-select-example-item">Vue</BaseSelectItem>
      <BaseSelectItem value="wc" textValue="Web Components" class="base-select-example-item">Web Components</BaseSelectItem>
    </BaseSelectContent>
  </BaseSelectRoot>
</template>

<style>
.base-select-example-root {
  position: relative; display: inline-flex; flex-direction: column; gap: 0.5rem;
}
.base-select-example-trigger {
  display: inline-flex; min-width: 14rem; align-items: center; justify-content: space-between;
  box-sizing: border-box; gap: 0.75rem; border: 1px solid #cbd5e1; border-radius: 0.375rem;
  background: #fff; color: #0f172a; padding: 0.5rem 0.75rem;
  font: 400 0.875rem/1.5 system-ui, sans-serif; cursor: pointer; user-select: none;
}
.base-select-example-content {
  box-sizing: border-box; width: 14rem; border: 1px solid #cbd5e1; border-radius: 0.375rem;
  background: #fff; color: #0f172a; padding: 0.25rem;
  font: 400 0.875rem/1.5 system-ui, sans-serif; box-shadow: 0 6px 18px #0002;
}
.base-select-example-item {
  display: block; border-radius: 0.25rem; padding: 0.5rem 0.75rem; cursor: pointer;
}
.base-select-example-item[data-selected] { background: #e2e8f0; }
.base-select-example-item[data-active] { background: #f1f5f9; }
.base-select-example-trigger:focus-visible,
.base-select-example-item:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
.base-select-example-icon { display: inline-flex; color: #64748b; }
</style>
    `),
  },
  vue2: {
    'demo-base-select': formatCode(`
<script>
import './styles/proto-ui-style.css';
import Vue from 'vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import {
  selectRoot,
  selectTrigger,
  selectValue,
  selectContent,
  selectItem,
} from '@proto.ui/prototypes-base/select';
import lucideChevronDownIcon from '@proto.ui/prototypes-lucide/icons/chevron-down';

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
    LucideChevronDownIcon: adapt(lucideChevronDownIcon),
  },
};
</script>

<template>
  <BaseSelectRoot class="base-select-example-root">
    <BaseSelectTrigger accessibleLabel="Framework selector" class="base-select-example-trigger">
      <BaseSelectValue placeholder="Pick a framework" />
      <span aria-hidden="true" class="base-select-example-icon">
        <LucideChevronDownIcon :size="16" />
      </span>
    </BaseSelectTrigger>
    <BaseSelectContent class="base-select-example-content">
      <BaseSelectItem value="react" textValue="React" class="base-select-example-item">React</BaseSelectItem>
      <BaseSelectItem value="vue" textValue="Vue" class="base-select-example-item">Vue</BaseSelectItem>
      <BaseSelectItem value="wc" textValue="Web Components" class="base-select-example-item">Web Components</BaseSelectItem>
    </BaseSelectContent>
  </BaseSelectRoot>
</template>

<style>
.base-select-example-root {
  position: relative; display: inline-flex; flex-direction: column; gap: 0.5rem;
}
.base-select-example-trigger {
  display: inline-flex; min-width: 14rem; align-items: center; justify-content: space-between;
  box-sizing: border-box; gap: 0.75rem; border: 1px solid #cbd5e1; border-radius: 0.375rem;
  background: #fff; color: #0f172a; padding: 0.5rem 0.75rem;
  font: 400 0.875rem/1.5 system-ui, sans-serif; cursor: pointer; user-select: none;
}
.base-select-example-content {
  box-sizing: border-box; width: 14rem; border: 1px solid #cbd5e1; border-radius: 0.375rem;
  background: #fff; color: #0f172a; padding: 0.25rem;
  font: 400 0.875rem/1.5 system-ui, sans-serif; box-shadow: 0 6px 18px #0002;
}
.base-select-example-item {
  display: block; border-radius: 0.25rem; padding: 0.5rem 0.75rem; cursor: pointer;
}
.base-select-example-item[data-selected] { background: #e2e8f0; }
.base-select-example-item[data-active] { background: #f1f5f9; }
.base-select-example-trigger:focus-visible,
.base-select-example-item:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
.base-select-example-icon { display: inline-flex; color: #64748b; }
</style>
    `),
  },
};
