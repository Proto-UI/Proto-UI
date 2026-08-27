import { formatCode } from '@/utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/registry';

export const codeMap: Partial<Record<RuntimeId, Record<string, string>>> = {
  wc: {
    'demo-base-dialog': formatCode(`
<wc-base-dialog-root class="relative inline-block">
  <wc-base-dialog-trigger class="rounded border px-3 py-1.5 cursor-pointer select-none">
    Open Dialog
  </wc-base-dialog-trigger>
  <wc-base-dialog-mask class="base-dialog-demo-mask bg-black/50"></wc-base-dialog-mask>
  <wc-base-dialog-content class="base-dialog-demo-content w-full max-w-md rounded-lg border bg-white p-6 shadow-xl">
    <wc-base-dialog-title class="text-lg font-semibold mb-2">Confirm Action</wc-base-dialog-title>
    <wc-base-dialog-description class="text-sm text-slate-600 mb-6">
      Are you sure you want to proceed? This action cannot be undone.
    </wc-base-dialog-description>
    <div class="flex gap-3 justify-end">
      <wc-base-dialog-close class="px-4 py-2 text-sm font-medium rounded border cursor-pointer select-none">Cancel</wc-base-dialog-close>
      <wc-base-dialog-close class="px-4 py-2 text-sm font-medium rounded bg-blue-600 text-white cursor-pointer select-none">Confirm</wc-base-dialog-close>
    </div>
  </wc-base-dialog-content>
</wc-base-dialog-root>
    `),
  },
  react: {
    'demo-base-dialog': formatCode(`
import {
  BaseDialogRoot,
  BaseDialogTrigger,
  BaseDialogMask,
  BaseDialogContent,
  BaseDialogTitle,
  BaseDialogDescription,
  BaseDialogClose,
} from '@prototype-libs/base';

export function DemoBaseDialogDemo() {
  return (
    <BaseDialogRoot className="relative inline-block">
      <BaseDialogTrigger className="rounded border px-3 py-1.5 cursor-pointer select-none">
        Open Dialog
      </BaseDialogTrigger>
      <BaseDialogMask className="base-dialog-demo-mask bg-black/50" />
      <BaseDialogContent className="base-dialog-demo-content w-full max-w-md rounded-lg border bg-white p-6 shadow-xl">
        <BaseDialogTitle className="text-lg font-semibold mb-2">Confirm Action</BaseDialogTitle>
        <BaseDialogDescription className="text-sm text-slate-600 mb-6">
          Are you sure you want to proceed? This action cannot be undone.
        </BaseDialogDescription>
        <div className="flex gap-3 justify-end">
          <BaseDialogClose className="px-4 py-2 text-sm font-medium rounded border cursor-pointer select-none">
            Cancel
          </BaseDialogClose>
          <BaseDialogClose className="px-4 py-2 text-sm font-medium rounded bg-blue-600 text-white cursor-pointer select-none">
            Confirm
          </BaseDialogClose>
        </div>
      </BaseDialogContent>
    </BaseDialogRoot>
  );
}
    `),
  },
  vue: {
    'demo-base-dialog': formatCode(`
<script setup lang="ts">
import {
  BaseDialogRoot,
  BaseDialogTrigger,
  BaseDialogMask,
  BaseDialogContent,
  BaseDialogTitle,
  BaseDialogDescription,
  BaseDialogClose,
} from '@prototype-libs/base';
</script>

<template>
  <BaseDialogRoot class="relative inline-block">
    <BaseDialogTrigger class="rounded border px-3 py-1.5 cursor-pointer select-none">
      Open Dialog
    </BaseDialogTrigger>
    <BaseDialogMask class="base-dialog-demo-mask bg-black/50" />
    <BaseDialogContent class="base-dialog-demo-content w-full max-w-md rounded-lg border bg-white p-6 shadow-xl">
      <BaseDialogTitle class="text-lg font-semibold mb-2">Confirm Action</BaseDialogTitle>
      <BaseDialogDescription class="text-sm text-slate-600 mb-6">
        Are you sure you want to proceed? This action cannot be undone.
      </BaseDialogDescription>
      <div class="flex gap-3 justify-end">
        <BaseDialogClose class="px-4 py-2 text-sm font-medium rounded border cursor-pointer select-none">Cancel</BaseDialogClose>
        <BaseDialogClose class="px-4 py-2 text-sm font-medium rounded bg-blue-600 text-white cursor-pointer select-none">Confirm</BaseDialogClose>
      </div>
    </BaseDialogContent>
  </BaseDialogRoot>
</template>
    `),
  },
};
