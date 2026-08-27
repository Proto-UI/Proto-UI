import { formatCode } from '@/utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/registry';

export const codeMap: Partial<Record<RuntimeId, Record<string, string>>> = {
  wc: {
    'demo-base-hover-card': formatCode(`
<wc-base-hover-card-root class="relative inline-flex items-start">
<wc-base-hover-card-trigger class="cursor-pointer rounded border px-3 py-1.5">
    Hover me
  </wc-base-hover-card-trigger>
  <wc-base-hover-card-content class="w-72 rounded border bg-white p-3 shadow">
    Base hover-card content. Pointer and focus intent use cancellable delays.
  </wc-base-hover-card-content>
</wc-base-hover-card-root>
    `),
  },
  react: {
    'demo-base-hover-card': formatCode(`
import {
  BaseHoverCardRoot,
  BaseHoverCardTrigger,
  BaseHoverCardContent,
} from '@prototype-libs/base';

export function DemoBaseHoverCardDemo() {
  return (
    <BaseHoverCardRoot openDelay={150} closeDelay={300} className="relative inline-flex items-start">
      <BaseHoverCardTrigger className="cursor-pointer rounded border px-3 py-1.5">
        Hover me
      </BaseHoverCardTrigger>
      <BaseHoverCardContent side="bottom" align="center" className="w-72 rounded border bg-white p-3 shadow">
        Base hover-card content. Pointer and focus intent use cancellable delays.
      </BaseHoverCardContent>
    </BaseHoverCardRoot>
  );
}
    `),
  },
  vue: {
    'demo-base-hover-card': formatCode(`
<script setup lang="ts">
import {
  BaseHoverCardRoot,
  BaseHoverCardTrigger,
  BaseHoverCardContent,
} from '@prototype-libs/base';
</script>

<template>
  <BaseHoverCardRoot :open-delay="150" :close-delay="300" class="relative inline-flex items-start">
    <BaseHoverCardTrigger class="cursor-pointer rounded border px-3 py-1.5">
      Hover me
    </BaseHoverCardTrigger>
    <BaseHoverCardContent side="bottom" align="center" class="w-72 rounded border bg-white p-3 shadow">
      Base hover-card content. Pointer and focus intent use cancellable delays.
    </BaseHoverCardContent>
  </BaseHoverCardRoot>
</template>
    `),
  },
};
