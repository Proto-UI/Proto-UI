import { formatCode } from '@/utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/registry';

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-base-radio-group': formatCode(`
<wc-base-radio-group-root default-value="option-a" class="flex flex-col gap-2">
  <wc-base-radio-item value="option-a" class="flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer select-none">
    <span class="w-4 h-4 rounded-full border-2 border-slate-300 flex items-center justify-center">
      <span class="w-2 h-2 rounded-full hidden data-[checked]:block bg-blue-600"></span>
    </span>
    Option A
  </wc-base-radio-item>
  <wc-base-radio-item value="option-b" class="flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer select-none">
    <span class="w-4 h-4 rounded-full border-2 border-slate-300 flex items-center justify-center">
      <span class="w-2 h-2 rounded-full hidden data-[checked]:block bg-blue-600"></span>
    </span>
    Option B
  </wc-base-radio-item>
  <wc-base-radio-item value="option-c" disabled class="flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer select-none">
    <span class="w-4 h-4 rounded-full border-2 border-slate-300 flex items-center justify-center">
      <span class="w-2 h-2 rounded-full hidden data-[checked]:block bg-blue-600"></span>
    </span>
    Option C (disabled)
  </wc-base-radio-item>
</wc-base-radio-group-root>
    `),
  },
  react: {
    'demo-base-radio-group': formatCode(`
import {
  BaseRadioGroupRoot,
  BaseRadioItem,
} from '@prototype-libs/base';

export function DemoBaseRadioGroupDemo() {
  return (
    <div className="flex flex-col gap-4">
      <BaseRadioGroupRoot defaultValue="option-a" className="flex flex-col gap-2">
        <BaseRadioItem value="option-a" className="flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer select-none">
          <span className="w-4 h-4 rounded-full border-2 border-slate-300 flex items-center justify-center">
            <span className="w-2 h-2 rounded-full hidden data-[checked]:block bg-blue-600" />
          </span>
          Option A
        </BaseRadioItem>
        <BaseRadioItem value="option-b" className="flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer select-none">
          <span className="w-4 h-4 rounded-full border-2 border-slate-300 flex items-center justify-center">
            <span className="w-2 h-2 rounded-full hidden data-[checked]:block bg-blue-600" />
          </span>
          Option B
        </BaseRadioItem>
        <BaseRadioItem value="option-c" disabled className="flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer select-none">
          <span className="w-4 h-4 rounded-full border-2 border-slate-300 flex items-center justify-center">
            <span className="w-2 h-2 rounded-full hidden data-[checked]:block bg-blue-600" />
          </span>
          Option C (disabled)
        </BaseRadioItem>
      </BaseRadioGroupRoot>
      <BaseRadioGroupRoot disabled className="flex flex-col gap-2">
        <BaseRadioItem value="disabled-a" className="flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer select-none">
          <span className="w-4 h-4 rounded-full border-2 border-slate-300 flex items-center justify-center">
            <span className="w-2 h-2 rounded-full hidden data-[checked]:block bg-blue-600" />
          </span>
          Disabled Group A
        </BaseRadioItem>
        <BaseRadioItem value="disabled-b" className="flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer select-none">
          <span className="w-4 h-4 rounded-full border-2 border-slate-300 flex items-center justify-center">
            <span className="w-2 h-2 rounded-full hidden data-[checked]:block bg-blue-600" />
          </span>
          Disabled Group B
        </BaseRadioItem>
      </BaseRadioGroupRoot>
    </div>
  );
}
    `),
  },
  vue: {
    'demo-base-radio-group': formatCode(`
<script setup lang="ts">
import {
  BaseRadioGroupRoot,
  BaseRadioItem,
} from '@prototype-libs/base';
</script>

<template>
  <div class="flex flex-col gap-4">
    <BaseRadioGroupRoot default-value="option-a" class="flex flex-col gap-2">
      <BaseRadioItem value="option-a" class="flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer select-none">
        <span class="w-4 h-4 rounded-full border-2 border-slate-300 flex items-center justify-center">
          <span class="w-2 h-2 rounded-full hidden data-[checked]:block bg-blue-600" />
        </span>
        Option A
      </BaseRadioItem>
      <BaseRadioItem value="option-b" class="flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer select-none">
        <span class="w-4 h-4 rounded-full border-2 border-slate-300 flex items-center justify-center">
          <span class="w-2 h-2 rounded-full hidden data-[checked]:block bg-blue-600" />
        </span>
        Option B
      </BaseRadioItem>
      <BaseRadioItem value="option-c" disabled class="flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer select-none">
        <span class="w-4 h-4 rounded-full border-2 border-slate-300 flex items-center justify-center">
          <span class="w-2 h-2 rounded-full hidden data-[checked]:block bg-blue-600" />
        </span>
        Option C (disabled)
      </BaseRadioItem>
    </BaseRadioGroupRoot>
    <BaseRadioGroupRoot disabled class="flex flex-col gap-2">
      <BaseRadioItem value="disabled-a" class="flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer select-none">
        <span class="w-4 h-4 rounded-full border-2 border-slate-300 flex items-center justify-center">
          <span class="w-2 h-2 rounded-full hidden data-[checked]:block bg-blue-600" />
        </span>
        Disabled Group A
      </BaseRadioItem>
      <BaseRadioItem value="disabled-b" class="flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer select-none">
        <span class="w-4 h-4 rounded-full border-2 border-slate-300 flex items-center justify-center">
          <span class="w-2 h-2 rounded-full hidden data-[checked]:block bg-blue-600" />
        </span>
        Disabled Group B
      </BaseRadioItem>
    </BaseRadioGroupRoot>
  </div>
</template>
    `),
  },
};
