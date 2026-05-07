import { formatCode } from '@/utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/registry';

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-base-tooltip': formatCode(`
<wc-base-tooltip-root class="relative inline-flex" props='{"delay":150}'>
  <wc-base-tooltip-trigger class="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium cursor-pointer select-none">
    Hover me
  </wc-base-tooltip-trigger>
  <wc-base-tooltip-content class="absolute left-0 top-full z-50 mt-1 rounded-md bg-gray-900 px-3 py-1.5 text-xs text-white shadow-lg">
    Tooltip text
  </wc-base-tooltip-content>
</wc-base-tooltip-root>
    `),
  },
  react: {
    'demo-base-tooltip': formatCode(`
import {
  BaseTooltipRoot,
  BaseTooltipTrigger,
  BaseTooltipContent,
} from '@prototype-libs/base';

export function DemoBaseTooltipDemo() {
  return (
    <div className="flex items-center justify-center p-12">
      <BaseTooltipRoot className="relative inline-flex" delay={150}>
        <BaseTooltipTrigger className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium cursor-pointer select-none">
          Hover me
        </BaseTooltipTrigger>
        <BaseTooltipContent className="absolute left-0 top-full z-50 mt-1 rounded-md bg-gray-900 px-3 py-1.5 text-xs text-white shadow-lg">
          Tooltip text
        </BaseTooltipContent>
      </BaseTooltipRoot>
    </div>
  );
}
    `),
  },
  vue: {
    'demo-base-tooltip': formatCode(`
<script setup lang="ts">
import {
  BaseTooltipRoot,
  BaseTooltipTrigger,
  BaseTooltipContent,
} from '@prototype-libs/base';
</script>

<template>
  <div class="flex items-center justify-center p-12">
    <BaseTooltipRoot class="relative inline-flex" :delay="150">
      <BaseTooltipTrigger class="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium cursor-pointer select-none">
        Hover me
      </BaseTooltipTrigger>
      <BaseTooltipContent class="absolute left-0 top-full z-50 mt-1 rounded-md bg-gray-900 px-3 py-1.5 text-xs text-white shadow-lg">
        Tooltip text
      </BaseTooltipContent>
    </BaseTooltipRoot>
  </div>
</template>
    `),
  },
};
