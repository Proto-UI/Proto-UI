import { formatCode } from '@/utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/registry';

const cssSnippet = `
/* 宿主通过 data-transition-state 属性驱动样式 */
.transition-wrapper[data-transition-state="closed"] .transition-box {
  opacity: 0;
  transform: scale(0.95) translateY(-10px);
}

.transition-wrapper[data-transition-state="entering"] .transition-box {
  opacity: 0.7;
  transform: scale(0.98) translateY(-2px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.transition-wrapper[data-transition-state="entered"] .transition-box {
  opacity: 1;
  transform: scale(1) translateY(0);
}

.transition-wrapper[data-transition-state="leaving"] .transition-box {
  opacity: 0.5;
  transform: scale(0.98) translateY(2px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
`.trim();

export const codeMap: Partial<Record<RuntimeId, Record<string, string>>> = {
  wc: {
    'demo-base-transition-command': formatCode(`
<wc-base-transition open appear class="transition-wrapper">
  <div class="w-64 h-40 rounded-xl flex flex-col items-center justify-center text-background shadow-xl transition-box">
    <span class="text-lg font-semibold">Animated Box</span>
  </div>
</wc-base-transition>

<style>
${cssSnippet}
</style>
    `),
    'demo-base-transition-controlled': formatCode(`
<wc-base-transition class="transition-wrapper">
  <div class="w-64 h-40 rounded-xl flex flex-col items-center justify-center text-background shadow-xl transition-box cursor-pointer select-none">
    <span class="text-lg font-semibold">Click Me</span>
  </div>
</wc-base-transition>

<style>
${cssSnippet}
</style>
    `),
  },
  react: {
    'demo-base-transition-command': formatCode(`
import { BaseTransition } from '@prototype-libs/base';

export function DemoBaseTransitionCommandDemo() {
  return (
    <BaseTransition open appear className="transition-wrapper">
      <div className="w-64 h-40 rounded-xl flex flex-col items-center justify-center text-background shadow-xl transition-box">
        <span className="text-lg font-semibold">Animated Box</span>
      </div>
    </BaseTransition>
  );
}

/* transition.css — 通过 data-transition-state 属性驱动样式 */
/* .transition-wrapper[data-transition-state="closed"] .transition-box {     */
/*   opacity: 0;                                                              */
/*   transform: scale(0.95) translateY(-10px);                                */
/* }                                                                           */
/*                                                                             */
/* .transition-wrapper[data-transition-state="entering"] .transition-box {    */
/*   opacity: 0.7;                                                             */
/*   transform: scale(0.98) translateY(-2px);                                  */
/*   transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);                        */
/* }                                                                           */
/*                                                                             */
/* .transition-wrapper[data-transition-state="entered"] .transition-box {     */
/*   opacity: 1;                                                              */
/*   transform: scale(1) translateY(0);                                        */
/* }                                                                           */
/*                                                                             */
/* .transition-wrapper[data-transition-state="leaving"] .transition-box {     */
/*   opacity: 0.5;                                                             */
/*   transform: scale(0.98) translateY(2px);                                   */
/*   transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);                        */
/* }                                                                           */
    `),
    'demo-base-transition-controlled': formatCode(`
import { BaseTransition } from '@prototype-libs/base';
import { useState } from 'react';

export function DemoBaseTransitionControlledDemo() {
  const [open, setOpen] = useState(false);

  return (
    <BaseTransition open={open} className="transition-wrapper">
      <div
        className="w-64 h-40 rounded-xl flex flex-col items-center justify-center text-background shadow-xl transition-box cursor-pointer select-none"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-lg font-semibold">Click Me</span>
      </div>
    </BaseTransition>
  );
}

/* transition.css — 通过 data-transition-state 属性驱动样式 */
/* .transition-wrapper[data-transition-state="closed"] .transition-box {     */
/*   opacity: 0;                                                              */
/*   transform: scale(0.95) translateY(-10px);                                */
/* }                                                                           */
/*                                                                             */
/* .transition-wrapper[data-transition-state="entering"] .transition-box {    */
/*   opacity: 0.7;                                                             */
/*   transform: scale(0.98) translateY(-2px);                                  */
/*   transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);                        */
/* }                                                                           */
/*                                                                             */
/* .transition-wrapper[data-transition-state="entered"] .transition-box {     */
/*   opacity: 1;                                                              */
/*   transform: scale(1) translateY(0);                                        */
/* }                                                                           */
/*                                                                             */
/* .transition-wrapper[data-transition-state="leaving"] .transition-box {     */
/*   opacity: 0.5;                                                             */
/*   transform: scale(0.98) translateY(2px);                                   */
/*   transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);                        */
/* }                                                                           */
    `),
  },
  vue: {
    'demo-base-transition-command': formatCode(`
<script setup lang="ts">
import { BaseTransition } from '@prototype-libs/base';
</script>

<template>
  <BaseTransition open appear class="transition-wrapper">
    <div class="w-64 h-40 rounded-xl flex flex-col items-center justify-center text-background shadow-xl transition-box">
      <span class="text-lg font-semibold">Animated Box</span>
    </div>
  </BaseTransition>
</template>

<style>
${cssSnippet}
</style>
    `),
    'demo-base-transition-controlled': formatCode(`
<script setup lang="ts">
import { BaseTransition } from '@prototype-libs/base';
import { ref } from 'vue';

const open = ref(false);
</script>

<template>
  <BaseTransition :open="open" class="transition-wrapper">
    <div
      class="w-64 h-40 rounded-xl flex flex-col items-center justify-center text-background shadow-xl transition-box cursor-pointer select-none"
      @click="open = !open"
    >
      <span class="text-lg font-semibold">Click Me</span>
    </div>
  </BaseTransition>
</template>

<style>
${cssSnippet}
</style>
    `),
  },
};
