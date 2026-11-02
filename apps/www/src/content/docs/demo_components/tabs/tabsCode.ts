import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Partial<Record<RuntimeId, Record<string, string>>> = {
  wc: {
    'demo-shadcn-tabs': formatCode(`
<wc-shadcn-tabs-root style-profile="rhea" default-value="account">
  <wc-shadcn-tabs-list style-profile="rhea">
    <wc-shadcn-tabs-trigger style-profile="rhea" value="account">Account</wc-shadcn-tabs-trigger>
    <wc-shadcn-tabs-trigger style-profile="rhea" value="password">Password</wc-shadcn-tabs-trigger>
    <wc-shadcn-tabs-trigger style-profile="rhea" value="billing" disabled>Billing</wc-shadcn-tabs-trigger>
  </wc-shadcn-tabs-list>
  <wc-shadcn-tabs-content style-profile="rhea" value="account">Make changes to your account here.</wc-shadcn-tabs-content>
  <wc-shadcn-tabs-content style-profile="rhea" value="password">Change your password here.</wc-shadcn-tabs-content>
  <wc-shadcn-tabs-content style-profile="rhea" value="billing">Billing tab is disabled in this preview.</wc-shadcn-tabs-content>
</wc-shadcn-tabs-root>
    `),
  },
  react: {
    'demo-shadcn-tabs': formatCode(`
import {
  ShadcnTabsContent,
  ShadcnTabsList,
  ShadcnTabsRoot,
  ShadcnTabsTrigger,
} from '../proto-ui/components/react';

export function DemoShadcnTabsDemo() {
  return (
    <ShadcnTabsRoot styleProfile="rhea" defaultValue="account">
      <ShadcnTabsList styleProfile="rhea">
        <ShadcnTabsTrigger styleProfile="rhea" value="account">Account</ShadcnTabsTrigger>
        <ShadcnTabsTrigger styleProfile="rhea" value="password">Password</ShadcnTabsTrigger>
        <ShadcnTabsTrigger styleProfile="rhea" value="billing" disabled>
          Billing
        </ShadcnTabsTrigger>
      </ShadcnTabsList>
      <ShadcnTabsContent styleProfile="rhea" value="account">Make changes to your account here.</ShadcnTabsContent>
      <ShadcnTabsContent styleProfile="rhea" value="password">Change your password here.</ShadcnTabsContent>
      <ShadcnTabsContent styleProfile="rhea" value="billing">
        Billing tab is disabled in this preview.
      </ShadcnTabsContent>
    </ShadcnTabsRoot>
  );
}
    `),
  },
  vue: {
    'demo-shadcn-tabs': formatCode(`
<script setup lang="ts">
import {
  ShadcnTabsContent,
  ShadcnTabsList,
  ShadcnTabsRoot,
  ShadcnTabsTrigger,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnTabsRoot styleProfile="rhea" defaultValue="account">
    <ShadcnTabsList styleProfile="rhea">
      <ShadcnTabsTrigger styleProfile="rhea" value="account">Account</ShadcnTabsTrigger>
      <ShadcnTabsTrigger styleProfile="rhea" value="password">Password</ShadcnTabsTrigger>
      <ShadcnTabsTrigger styleProfile="rhea" value="billing" disabled>Billing</ShadcnTabsTrigger>
    </ShadcnTabsList>
    <ShadcnTabsContent styleProfile="rhea" value="account">Make changes to your account here.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="rhea" value="password">Change your password here.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="rhea" value="billing">Billing tab is disabled in this preview.</ShadcnTabsContent>
  </ShadcnTabsRoot>
</template>
    `),
  },
  vue2: {
    'demo-shadcn-tabs': formatCode(`
<template>
  <ShadcnTabsRoot styleProfile="rhea" defaultValue="account">
    <ShadcnTabsList styleProfile="rhea">
      <ShadcnTabsTrigger styleProfile="rhea" value="account">Account</ShadcnTabsTrigger>
      <ShadcnTabsTrigger styleProfile="rhea" value="password">Password</ShadcnTabsTrigger>
      <ShadcnTabsTrigger styleProfile="rhea" value="billing" disabled>Billing</ShadcnTabsTrigger>
    </ShadcnTabsList>
    <ShadcnTabsContent styleProfile="rhea" value="account">Make changes to your account here.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="rhea" value="password">Change your password here.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="rhea" value="billing">Billing tab is disabled in this preview.</ShadcnTabsContent>
  </ShadcnTabsRoot>
</template>

<script>
import {
  ShadcnTabsContent,
  ShadcnTabsList,
  ShadcnTabsRoot,
  ShadcnTabsTrigger,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnTabsContent,
    ShadcnTabsList,
    ShadcnTabsRoot,
    ShadcnTabsTrigger,
  },
};
</script>
    `),
  },
};
