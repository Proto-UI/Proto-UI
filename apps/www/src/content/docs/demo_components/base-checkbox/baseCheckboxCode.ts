import { formatCode } from '@/utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/registry';

export const codeMap: Partial<Record<RuntimeId, Record<string, string>>> = {
  wc: {
    'demo-base-checkbox': formatCode(`
<div class="flex flex-col items-start gap-3">
  <wc-base-checkbox-root>
    <wc-base-checkbox-indicator>
      <div class="h-2.5 w-2.5 rounded-sm bg-current opacity-0 group-data-[checked]:opacity-100"></div>
      <div class="absolute h-0.5 w-2.5 rounded bg-current opacity-0 group-data-[indeterminate]:opacity-100"></div>
    </wc-base-checkbox-indicator>
    <div class="flex flex-col gap-0.5">Unchecked</div>
  </wc-base-checkbox-root>
  <wc-base-checkbox-root default-checked>
    <wc-base-checkbox-indicator>
      <div class="h-2.5 w-2.5 rounded-sm bg-current opacity-0 group-data-[checked]:opacity-100"></div>
      <div class="absolute h-0.5 w-2.5 rounded bg-current opacity-0 group-data-[indeterminate]:opacity-100"></div>
    </wc-base-checkbox-indicator>
    <div class="flex flex-col gap-0.5">Checked</div>
  </wc-base-checkbox-root>
  <wc-base-checkbox-root default-indeterminate>
    <wc-base-checkbox-indicator>
      <div class="h-2.5 w-2.5 rounded-sm bg-current opacity-0 group-data-[checked]:opacity-100"></div>
      <div class="absolute h-0.5 w-2.5 rounded bg-current opacity-0 group-data-[indeterminate]:opacity-100"></div>
    </wc-base-checkbox-indicator>
    <div class="flex flex-col gap-0.5">Indeterminate</div>
  </wc-base-checkbox-root>
  <wc-base-checkbox-root disabled>
    <wc-base-checkbox-indicator>
      <div class="h-2.5 w-2.5 rounded-sm bg-current opacity-0 group-data-[checked]:opacity-100"></div>
      <div class="absolute h-0.5 w-2.5 rounded bg-current opacity-0 group-data-[indeterminate]:opacity-100"></div>
    </wc-base-checkbox-indicator>
    <div class="flex flex-col gap-0.5">Disabled</div>
  </wc-base-checkbox-root>
</div>
    `),
  },
  react: {
    'demo-base-checkbox': formatCode(`
import {
  BaseCheckboxIndicator,
  BaseCheckboxRoot,
} from '../proto-ui/components/react';

export function DemoBaseCheckboxDemo() {
  return (
    <div className="flex flex-col items-start gap-3">
      <BaseCheckboxRoot>
        <BaseCheckboxIndicator>
          <div className="h-2.5 w-2.5 rounded-sm bg-current opacity-0 group-data-[checked]:opacity-100"></div>
          <div className="absolute h-0.5 w-2.5 rounded bg-current opacity-0 group-data-[indeterminate]:opacity-100"></div>
        </BaseCheckboxIndicator>
        <div className="flex flex-col gap-0.5">Unchecked</div>
      </BaseCheckboxRoot>
      <BaseCheckboxRoot defaultChecked>
        <BaseCheckboxIndicator>
          <div className="h-2.5 w-2.5 rounded-sm bg-current opacity-0 group-data-[checked]:opacity-100"></div>
          <div className="absolute h-0.5 w-2.5 rounded bg-current opacity-0 group-data-[indeterminate]:opacity-100"></div>
        </BaseCheckboxIndicator>
        <div className="flex flex-col gap-0.5">Checked</div>
      </BaseCheckboxRoot>
      <BaseCheckboxRoot defaultIndeterminate>
        <BaseCheckboxIndicator>
          <div className="h-2.5 w-2.5 rounded-sm bg-current opacity-0 group-data-[checked]:opacity-100"></div>
          <div className="absolute h-0.5 w-2.5 rounded bg-current opacity-0 group-data-[indeterminate]:opacity-100"></div>
        </BaseCheckboxIndicator>
        <div className="flex flex-col gap-0.5">Indeterminate</div>
      </BaseCheckboxRoot>
      <BaseCheckboxRoot disabled>
        <BaseCheckboxIndicator>
          <div className="h-2.5 w-2.5 rounded-sm bg-current opacity-0 group-data-[checked]:opacity-100"></div>
          <div className="absolute h-0.5 w-2.5 rounded bg-current opacity-0 group-data-[indeterminate]:opacity-100"></div>
        </BaseCheckboxIndicator>
        <div className="flex flex-col gap-0.5">Disabled</div>
      </BaseCheckboxRoot>
    </div>
  );
}
    `),
  },
  vue: {
    'demo-base-checkbox': formatCode(`
<script setup lang="ts">
import {
  BaseCheckboxIndicator,
  BaseCheckboxRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-col items-start gap-3">
    <BaseCheckboxRoot>
      <BaseCheckboxIndicator>
        <div
          class="h-2.5 w-2.5 rounded-sm bg-current opacity-0 group-data-[checked]:opacity-100"
        ></div>
        <div
          class="absolute h-0.5 w-2.5 rounded bg-current opacity-0 group-data-[indeterminate]:opacity-100"
        ></div>
      </BaseCheckboxIndicator>
      <div class="flex flex-col gap-0.5">Unchecked</div>
    </BaseCheckboxRoot>
    <BaseCheckboxRoot defaultChecked>
      <BaseCheckboxIndicator>
        <div
          class="h-2.5 w-2.5 rounded-sm bg-current opacity-0 group-data-[checked]:opacity-100"
        ></div>
        <div
          class="absolute h-0.5 w-2.5 rounded bg-current opacity-0 group-data-[indeterminate]:opacity-100"
        ></div>
      </BaseCheckboxIndicator>
      <div class="flex flex-col gap-0.5">Checked</div>
    </BaseCheckboxRoot>
    <BaseCheckboxRoot defaultIndeterminate>
      <BaseCheckboxIndicator>
        <div
          class="h-2.5 w-2.5 rounded-sm bg-current opacity-0 group-data-[checked]:opacity-100"
        ></div>
        <div
          class="absolute h-0.5 w-2.5 rounded bg-current opacity-0 group-data-[indeterminate]:opacity-100"
        ></div>
      </BaseCheckboxIndicator>
      <div class="flex flex-col gap-0.5">Indeterminate</div>
    </BaseCheckboxRoot>
    <BaseCheckboxRoot disabled>
      <BaseCheckboxIndicator>
        <div
          class="h-2.5 w-2.5 rounded-sm bg-current opacity-0 group-data-[checked]:opacity-100"
        ></div>
        <div
          class="absolute h-0.5 w-2.5 rounded bg-current opacity-0 group-data-[indeterminate]:opacity-100"
        ></div>
      </BaseCheckboxIndicator>
      <div class="flex flex-col gap-0.5">Disabled</div>
    </BaseCheckboxRoot>
  </div>
</template>
    `),
  },
};
