import { formatCode } from '@/utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Partial<Record<RuntimeId, Record<string, string>>> = {
  wc: {
    'demo-shadcn-hover-card': formatCode(`
<wc-shadcn-hover-card-root style-profile="rhea" class="relative inline-flex items-start">
  <wc-shadcn-hover-card-trigger style-profile="rhea">@proto-ui</wc-shadcn-hover-card-trigger>
  <wc-shadcn-hover-card-content style-profile="rhea">
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
    <ShadcnHoverCardRoot styleProfile="rhea" openDelay={150} closeDelay={300} className="relative inline-flex items-start">
      <ShadcnHoverCardTrigger styleProfile="rhea">@proto-ui</ShadcnHoverCardTrigger>
      <ShadcnHoverCardContent styleProfile="rhea" side="bottom" align="center">
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
  <ShadcnHoverCardRoot styleProfile="rhea" :open-delay="150" :close-delay="300" class="relative inline-flex items-start">
    <ShadcnHoverCardTrigger styleProfile="rhea">@proto-ui</ShadcnHoverCardTrigger>
    <ShadcnHoverCardContent styleProfile="rhea" side="bottom" align="center">
      Host-neutral interaction protocols for adaptable UI components.
    </ShadcnHoverCardContent>
  </ShadcnHoverCardRoot>
</template>
    `),
  },
  vue2: {
    'demo-shadcn-hover-card': formatCode(`
<template>
  <ShadcnHoverCardRoot styleProfile="rhea" :open-delay="150" :close-delay="300" class="relative inline-flex items-start">
    <ShadcnHoverCardTrigger styleProfile="rhea">@proto-ui</ShadcnHoverCardTrigger>
    <ShadcnHoverCardContent styleProfile="rhea" side="bottom" align="center">
      Host-neutral interaction protocols for adaptable UI components.
    </ShadcnHoverCardContent>
  </ShadcnHoverCardRoot>
</template>

<script>
import {
  ShadcnHoverCardRoot,
  ShadcnHoverCardTrigger,
  ShadcnHoverCardContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnHoverCardRoot,
    ShadcnHoverCardTrigger,
    ShadcnHoverCardContent,
  },
};
</script>
    `),
  },
};
