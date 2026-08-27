import { formatCode } from '@/utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/registry';

export const codeMap: Partial<Record<RuntimeId, Record<string, string>>> = {
  wc: {
    'demo-shadcn-tabs': formatCode(`
<wc-shadcn-tabs-root default-value="account">
  <wc-shadcn-tabs-list>
    <wc-shadcn-tabs-trigger value="account">Account</wc-shadcn-tabs-trigger>
    <wc-shadcn-tabs-trigger value="password">Password</wc-shadcn-tabs-trigger>
    <wc-shadcn-tabs-trigger value="billing" disabled>Billing</wc-shadcn-tabs-trigger>
  </wc-shadcn-tabs-list>
  <wc-shadcn-tabs-content value="account">Make changes to your account here.</wc-shadcn-tabs-content>
  <wc-shadcn-tabs-content value="password">Change your password here.</wc-shadcn-tabs-content>
  <wc-shadcn-tabs-content value="billing">Billing tab is disabled in this preview.</wc-shadcn-tabs-content>
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
    <ShadcnTabsRoot defaultValue="account">
      <ShadcnTabsList>
        <ShadcnTabsTrigger value="account">Account</ShadcnTabsTrigger>
        <ShadcnTabsTrigger value="password">Password</ShadcnTabsTrigger>
        <ShadcnTabsTrigger value="billing" disabled>
          Billing
        </ShadcnTabsTrigger>
      </ShadcnTabsList>
      <ShadcnTabsContent value="account">Make changes to your account here.</ShadcnTabsContent>
      <ShadcnTabsContent value="password">Change your password here.</ShadcnTabsContent>
      <ShadcnTabsContent value="billing">
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
  <ShadcnTabsRoot defaultValue="account">
    <ShadcnTabsList>
      <ShadcnTabsTrigger value="account">Account</ShadcnTabsTrigger>
      <ShadcnTabsTrigger value="password">Password</ShadcnTabsTrigger>
      <ShadcnTabsTrigger value="billing" disabled>Billing</ShadcnTabsTrigger>
    </ShadcnTabsList>
    <ShadcnTabsContent value="account">Make changes to your account here.</ShadcnTabsContent>
    <ShadcnTabsContent value="password">Change your password here.</ShadcnTabsContent>
    <ShadcnTabsContent value="billing">Billing tab is disabled in this preview.</ShadcnTabsContent>
  </ShadcnTabsRoot>
</template>
    `),
  },
  vue2: {
    'demo-shadcn-tabs': formatCode(`
<template>
  <ShadcnTabsRoot defaultValue="account">
    <ShadcnTabsList>
      <ShadcnTabsTrigger value="account">Account</ShadcnTabsTrigger>
      <ShadcnTabsTrigger value="password">Password</ShadcnTabsTrigger>
      <ShadcnTabsTrigger value="billing" disabled>Billing</ShadcnTabsTrigger>
    </ShadcnTabsList>
    <ShadcnTabsContent value="account">Make changes to your account here.</ShadcnTabsContent>
    <ShadcnTabsContent value="password">Change your password here.</ShadcnTabsContent>
    <ShadcnTabsContent value="billing">Billing tab is disabled in this preview.</ShadcnTabsContent>
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
