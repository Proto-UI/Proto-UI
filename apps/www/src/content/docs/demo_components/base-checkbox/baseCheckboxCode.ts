import { formatCode } from '@/utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/registry';

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-base-checkbox': formatCode(`
<wc-base-checkbox-root class="flex items-center gap-2">
  <wc-base-checkbox-indicator class="flex h-5 w-5 items-center justify-center rounded border">
    <svg class="h-3 w-3" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" stroke-width="1.5" />
    </svg>
  </wc-base-checkbox-indicator>
  <span>Accept terms</span>
</wc-base-checkbox-root>
    `),
  },
  react: {
    'demo-base-checkbox': formatCode(`
import {
  BaseCheckboxRoot,
  BaseCheckboxIndicator,
} from '@prototype-libs/base';

export function DemoBaseCheckbox() {
  return (
    <BaseCheckboxRoot className="flex items-center gap-2">
      <BaseCheckboxIndicator className="flex h-5 w-5 items-center justify-center rounded border">
        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth={1.5} />
        </svg>
      </BaseCheckboxIndicator>
      <span>Accept terms</span>
    </BaseCheckboxRoot>
  );
}
    `),
  },
  vue: {
    'demo-base-checkbox': formatCode(`
<script setup lang="ts">
import {
  BaseCheckboxRoot,
  BaseCheckboxIndicator,
} from '@prototype-libs/base';
</script>

<template>
  <BaseCheckboxRoot class="flex items-center gap-2">
    <BaseCheckboxIndicator class="flex h-5 w-5 items-center justify-center rounded border">
      <svg class="h-3 w-3" viewBox="0 0 12 12" fill="none">
        <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" stroke-width="1.5" />
      </svg>
    </BaseCheckboxIndicator>
    <span>Accept terms</span>
  </BaseCheckboxRoot>
</template>
    `),
  },
};
