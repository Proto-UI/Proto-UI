import { formatCode } from '@/utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/registry';

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-base-slider': formatCode(`
<wc-base-slider-root class="w-full max-w-md" props='{"defaultValue":50}'></wc-base-slider-root>
    `),
    'demo-base-slider-disabled': formatCode(`
<wc-base-slider-root class="w-full max-w-md" props='{"defaultValue":30,"disabled":true}'></wc-base-slider-root>
    `),
  },
  react: {
    'demo-base-slider': formatCode(`
import { BaseSliderRoot } from '@prototype-libs/base';

export function DemoBaseSliderDemo() {
  return (
    <div className="flex flex-col gap-8 p-8">
      <BaseSliderRoot className="w-full max-w-md" defaultValue={50} />
      <BaseSliderRoot className="w-full max-w-md" defaultValue={25} min={10} max={80} step={5} />
    </div>
  );
}
    `),
    'demo-base-slider-disabled': formatCode(`
import { BaseSliderRoot } from '@prototype-libs/base';

export function DemoBaseSliderDisabledDemo() {
  return (
    <div className="flex flex-col gap-8 p-8">
      <BaseSliderRoot className="w-full max-w-md" defaultValue={30} disabled />
    </div>
  );
}
    `),
  },
  vue: {
    'demo-base-slider': formatCode(`
<script setup lang="ts">
import { BaseSliderRoot } from '@prototype-libs/base';
</script>

<template>
  <div class="flex flex-col gap-8 p-8">
    <BaseSliderRoot class="w-full max-w-md" :defaultValue="50" />
    <BaseSliderRoot class="w-full max-w-md" :defaultValue="25" :min="10" :max="80" :step="5" />
  </div>
</template>
    `),
    'demo-base-slider-disabled': formatCode(`
<script setup lang="ts">
import { BaseSliderRoot } from '@prototype-libs/base';
</script>

<template>
  <div class="flex flex-col gap-8 p-8">
    <BaseSliderRoot class="w-full max-w-md" :defaultValue="30" :disabled="true" />
  </div>
</template>
    `),
  },
};
