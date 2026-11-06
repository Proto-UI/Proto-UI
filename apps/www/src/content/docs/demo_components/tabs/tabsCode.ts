import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

function tabsPresetWc(styleProfile: string) {
  return formatCode(`
<wc-shadcn-tabs-root style-profile="${styleProfile}" default-value="account">
  <wc-shadcn-tabs-list style-profile="${styleProfile}">
    <wc-shadcn-tabs-trigger style-profile="${styleProfile}" value="account">Account</wc-shadcn-tabs-trigger>
    <wc-shadcn-tabs-trigger style-profile="${styleProfile}" value="password">Password</wc-shadcn-tabs-trigger>
    <wc-shadcn-tabs-trigger style-profile="${styleProfile}" value="billing" disabled>Billing</wc-shadcn-tabs-trigger>
  </wc-shadcn-tabs-list>
  <wc-shadcn-tabs-content style-profile="${styleProfile}" value="account">Make changes to your account here.</wc-shadcn-tabs-content>
  <wc-shadcn-tabs-content style-profile="${styleProfile}" value="password">Change your password here.</wc-shadcn-tabs-content>
  <wc-shadcn-tabs-content style-profile="${styleProfile}" value="billing">Billing tab is disabled in this preview.</wc-shadcn-tabs-content>
</wc-shadcn-tabs-root>
  `);
}

function tabsPresetReact(styleProfile: string) {
  return formatCode(`
import {
  ShadcnTabsContent,
  ShadcnTabsList,
  ShadcnTabsRoot,
  ShadcnTabsTrigger,
} from '../proto-ui/components/react';

export function DemoShadcnTabsPresetDemo() {
  return (
    <ShadcnTabsRoot styleProfile="${styleProfile}" defaultValue="account">
      <ShadcnTabsList styleProfile="${styleProfile}">
        <ShadcnTabsTrigger styleProfile="${styleProfile}" value="account">Account</ShadcnTabsTrigger>
        <ShadcnTabsTrigger styleProfile="${styleProfile}" value="password">Password</ShadcnTabsTrigger>
        <ShadcnTabsTrigger styleProfile="${styleProfile}" value="billing" disabled>
          Billing
        </ShadcnTabsTrigger>
      </ShadcnTabsList>
      <ShadcnTabsContent styleProfile="${styleProfile}" value="account">Make changes to your account here.</ShadcnTabsContent>
      <ShadcnTabsContent styleProfile="${styleProfile}" value="password">Change your password here.</ShadcnTabsContent>
      <ShadcnTabsContent styleProfile="${styleProfile}" value="billing">
        Billing tab is disabled in this preview.
      </ShadcnTabsContent>
    </ShadcnTabsRoot>
  );
}
  `);
}

function tabsPresetVue(styleProfile: string) {
  return formatCode(`
<script setup lang="ts">
import {
  ShadcnTabsContent,
  ShadcnTabsList,
  ShadcnTabsRoot,
  ShadcnTabsTrigger,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnTabsRoot styleProfile="${styleProfile}" defaultValue="account">
    <ShadcnTabsList styleProfile="${styleProfile}">
      <ShadcnTabsTrigger styleProfile="${styleProfile}" value="account">Account</ShadcnTabsTrigger>
      <ShadcnTabsTrigger styleProfile="${styleProfile}" value="password">Password</ShadcnTabsTrigger>
      <ShadcnTabsTrigger styleProfile="${styleProfile}" value="billing" disabled>Billing</ShadcnTabsTrigger>
    </ShadcnTabsList>
    <ShadcnTabsContent styleProfile="${styleProfile}" value="account">Make changes to your account here.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="${styleProfile}" value="password">Change your password here.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="${styleProfile}" value="billing">Billing tab is disabled in this preview.</ShadcnTabsContent>
  </ShadcnTabsRoot>
</template>
  `);
}

function tabsPresetVue2(styleProfile: string) {
  return formatCode(`
<template>
  <ShadcnTabsRoot styleProfile="${styleProfile}" defaultValue="account">
    <ShadcnTabsList styleProfile="${styleProfile}">
      <ShadcnTabsTrigger styleProfile="${styleProfile}" value="account">Account</ShadcnTabsTrigger>
      <ShadcnTabsTrigger styleProfile="${styleProfile}" value="password">Password</ShadcnTabsTrigger>
      <ShadcnTabsTrigger styleProfile="${styleProfile}" value="billing" disabled>Billing</ShadcnTabsTrigger>
    </ShadcnTabsList>
    <ShadcnTabsContent styleProfile="${styleProfile}" value="account">Make changes to your account here.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="${styleProfile}" value="password">Change your password here.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="${styleProfile}" value="billing">Billing tab is disabled in this preview.</ShadcnTabsContent>
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
  `);
}

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
    'demo-shadcn-tabs-preset-nova': tabsPresetWc('nova'),
    'demo-shadcn-tabs-preset-rhea': tabsPresetWc('rhea'),
    'demo-shadcn-tabs-preset-new-york-v4': tabsPresetWc('new-york-v4'),
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
    'demo-shadcn-tabs-preset-nova': tabsPresetReact('nova'),
    'demo-shadcn-tabs-preset-rhea': tabsPresetReact('rhea'),
    'demo-shadcn-tabs-preset-new-york-v4': tabsPresetReact('new-york-v4'),
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
    'demo-shadcn-tabs-preset-nova': tabsPresetVue('nova'),
    'demo-shadcn-tabs-preset-rhea': tabsPresetVue('rhea'),
    'demo-shadcn-tabs-preset-new-york-v4': tabsPresetVue('new-york-v4'),
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
    'demo-shadcn-tabs-preset-nova': tabsPresetVue2('nova'),
    'demo-shadcn-tabs-preset-rhea': tabsPresetVue2('rhea'),
    'demo-shadcn-tabs-preset-new-york-v4': tabsPresetVue2('new-york-v4'),
  },
};
