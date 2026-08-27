import { formatCode } from '@/utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/registry';

export const codeMap: Partial<Record<RuntimeId, Record<string, string>>> = {
  wc: {
    'demo-base-tooltip': formatCode(`
<wc-base-tooltip-group id="tooltip-group-demo">
  <wc-base-tooltip-root>
    <wc-base-tooltip-trigger>Account</wc-base-tooltip-trigger>
    <wc-base-tooltip-content class="tooltip-content">
      View account settings and profile details.
    </wc-base-tooltip-content>
  </wc-base-tooltip-root>

  <wc-base-tooltip-root>
    <wc-base-tooltip-trigger>Notifications</wc-base-tooltip-trigger>
    <wc-base-tooltip-content class="tooltip-content">
      Review recent alerts and notification preferences.
    </wc-base-tooltip-content>
  </wc-base-tooltip-root>
</wc-base-tooltip-group>

<script type="module">
  document.querySelector('#tooltip-group-demo').setProps({
    openDelay: 500,
    closeDelay: 150,
    skipDelay: 700,
  });
  document.querySelectorAll('.tooltip-content').forEach((content) => {
    content.setProps({ side: 'top', sideOffset: 8 });
  });
</script>
    `),
  },
  react: {
    'demo-base-tooltip': formatCode(`
import {
  BaseTooltipContent,
  BaseTooltipGroup,
  BaseTooltipRoot,
  BaseTooltipTrigger,
} from '@prototype-libs/base';

export function DemoBaseTooltip() {
  return (
    <BaseTooltipGroup openDelay={500} closeDelay={150} skipDelay={700}>
      <BaseTooltipRoot>
        <BaseTooltipTrigger>Account</BaseTooltipTrigger>
        <BaseTooltipContent side="top" sideOffset={8}>
          View account settings and profile details.
        </BaseTooltipContent>
      </BaseTooltipRoot>

      <BaseTooltipRoot>
        <BaseTooltipTrigger>Notifications</BaseTooltipTrigger>
        <BaseTooltipContent side="top" sideOffset={8}>
          Review recent alerts and notification preferences.
        </BaseTooltipContent>
      </BaseTooltipRoot>
    </BaseTooltipGroup>
  );
}
    `),
  },
  vue: {
    'demo-base-tooltip': formatCode(`
<script setup lang="ts">
import {
  BaseTooltipContent,
  BaseTooltipGroup,
  BaseTooltipRoot,
  BaseTooltipTrigger,
} from '@prototype-libs/base';
</script>

<template>
  <BaseTooltipGroup :open-delay="500" :close-delay="150" :skip-delay="700">
    <BaseTooltipRoot>
      <BaseTooltipTrigger>Account</BaseTooltipTrigger>
      <BaseTooltipContent side="top" :side-offset="8">
        View account settings and profile details.
      </BaseTooltipContent>
    </BaseTooltipRoot>

    <BaseTooltipRoot>
      <BaseTooltipTrigger>Notifications</BaseTooltipTrigger>
      <BaseTooltipContent side="top" :side-offset="8">
        Review recent alerts and notification preferences.
      </BaseTooltipContent>
    </BaseTooltipRoot>
  </BaseTooltipGroup>
</template>
    `),
  },
};
