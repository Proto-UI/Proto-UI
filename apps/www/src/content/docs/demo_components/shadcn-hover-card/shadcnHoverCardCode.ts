import { formatCode } from '@/utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/registry';

export const codeMap: Partial<Record<RuntimeId, Record<string, string>>> = {
  wc: {
    'demo-shadcn-hover-card': formatCode(`
<wc-shadcn-hover-card-root class="relative inline-flex items-start">
  <wc-shadcn-hover-card-trigger>@proto-ui</wc-shadcn-hover-card-trigger>
  <wc-shadcn-hover-card-content>
    Host-neutral interaction protocols for adaptable UI components.
  </wc-shadcn-hover-card-content>
</wc-shadcn-hover-card-root>
    `),
  },
  react: {
    'demo-shadcn-hover-card': formatCode(`
import {
  ShadcnHoverCardRoot,
  ShadcnHoverCardTrigger,
  ShadcnHoverCardContent,
} from '@prototype-libs/shadcn';

export function DemoShadcnHoverCardDemo() {
  return (
    <ShadcnHoverCardRoot openDelay={150} closeDelay={300} className="relative inline-flex items-start">
      <ShadcnHoverCardTrigger>@proto-ui</ShadcnHoverCardTrigger>
      <ShadcnHoverCardContent side="bottom" align="center">
        Host-neutral interaction protocols for adaptable UI components.
      </ShadcnHoverCardContent>
    </ShadcnHoverCardRoot>
  );
}
    `),
  },
  vue: {
    'demo-shadcn-hover-card': formatCode(`
<script setup lang="ts">
import {
  ShadcnHoverCardRoot,
  ShadcnHoverCardTrigger,
  ShadcnHoverCardContent,
} from '@prototype-libs/shadcn';
</script>

<template>
  <ShadcnHoverCardRoot :open-delay="150" :close-delay="300" class="relative inline-flex items-start">
    <ShadcnHoverCardTrigger>@proto-ui</ShadcnHoverCardTrigger>
    <ShadcnHoverCardContent side="bottom" align="center">
      Host-neutral interaction protocols for adaptable UI components.
    </ShadcnHoverCardContent>
  </ShadcnHoverCardRoot>
</template>
    `),
  },
};
