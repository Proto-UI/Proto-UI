import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';
import { tabsProfileSwitchCode } from './tabs-profile-switch-code';

function tabsPresetWc(styleProfile: string) {
  return formatCode(`
<wc-shadcn-tabs-root style-profile="${styleProfile}" default-value="account">
  <wc-shadcn-tabs-list style-profile="${styleProfile}">
    <wc-shadcn-tabs-trigger style-profile="${styleProfile}" value="account">Account</wc-shadcn-tabs-trigger>
    <wc-shadcn-tabs-trigger style-profile="${styleProfile}" value="password">Password</wc-shadcn-tabs-trigger>
    <wc-shadcn-tabs-trigger style-profile="${styleProfile}" value="billing" disabled>Billing</wc-shadcn-tabs-trigger>
  </wc-shadcn-tabs-list>
  <wc-shadcn-tabs-content style-profile="${styleProfile}" value="account">Make changes to your account profile and preferences here.</wc-shadcn-tabs-content>
  <wc-shadcn-tabs-content style-profile="${styleProfile}" value="password">Update your password and two-factor sign-in methods here.</wc-shadcn-tabs-content>
  <wc-shadcn-tabs-content style-profile="${styleProfile}" value="billing">Manage workspace subscription plans and billing contacts.</wc-shadcn-tabs-content>
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
        <ShadcnTabsTrigger styleProfile="${styleProfile}" value="billing" disabled>Billing</ShadcnTabsTrigger>
      </ShadcnTabsList>
      <ShadcnTabsContent styleProfile="${styleProfile}" value="account">Make changes to your account profile and preferences here.</ShadcnTabsContent>
      <ShadcnTabsContent styleProfile="${styleProfile}" value="password">Update your password and two-factor sign-in methods here.</ShadcnTabsContent>
      <ShadcnTabsContent styleProfile="${styleProfile}" value="billing">Manage workspace subscription plans and billing contacts.</ShadcnTabsContent>
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
    <ShadcnTabsContent styleProfile="${styleProfile}" value="account">Make changes to your account profile and preferences here.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="${styleProfile}" value="password">Update your password and two-factor sign-in methods here.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="${styleProfile}" value="billing">Manage workspace subscription plans and billing contacts.</ShadcnTabsContent>
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
    <ShadcnTabsContent styleProfile="${styleProfile}" value="account">Make changes to your account profile and preferences here.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="${styleProfile}" value="password">Update your password and two-factor sign-in methods here.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="${styleProfile}" value="billing">Manage workspace subscription plans and billing contacts.</ShadcnTabsContent>
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

function familyTabsSnippets(prefix: { wcTag: string; compPrefix: string; importSubpath: string }) {
  const { wcTag, compPrefix, importSubpath } = prefix;
  const R = `${compPrefix}TabsRoot`;
  const L = `${compPrefix}TabsList`;
  const T = `${compPrefix}TabsTrigger`;
  const C = `${compPrefix}TabsContent`;

  return {
    basic(
      tabs: Array<{ value: string; label: string; content: string; disabled?: boolean }>,
      defaultValue: string,
      extraRootWc = '',
      extraRootJsx = '',
      extraListWc = '',
      extraListJsx = '',
      extraTriggerWc = '',
      extraTriggerJsx = ''
    ) {
      const wcTriggers = tabs
        .map(
          (t) =>
            `    <${wcTag}-trigger value="${t.value}"${extraTriggerWc ? ` ${extraTriggerWc}` : ''}${t.disabled ? ' disabled' : ''}>${t.label}</${wcTag}-trigger>`
        )
        .join('\n');
      const wcContents = tabs
        .map((t) => `  <${wcTag}-content value="${t.value}">${t.content}</${wcTag}-content>`)
        .join('\n');

      const jsxTriggers = tabs
        .map(
          (t) =>
            `        <${T} value="${t.value}"${extraTriggerJsx ? ` ${extraTriggerJsx}` : ''}${t.disabled ? ' disabled' : ''}>${t.label}</${T}>`
        )
        .join('\n');
      const jsxContents = tabs
        .map((t) => `      <${C} value="${t.value}">${t.content}</${C}>`)
        .join('\n');

      return {
        wc: formatCode(`
<${wcTag}-root default-value="${defaultValue}"${extraRootWc ? ` ${extraRootWc}` : ''}>
  <${wcTag}-list${extraListWc ? ` ${extraListWc}` : ''}>
${wcTriggers}
  </${wcTag}-list>
${wcContents}
</${wcTag}-root>
        `),
        react: formatCode(`
import { ${R}, ${L}, ${T}, ${C} } from '${importSubpath}/react';

export function TabsExample() {
  return (
    <${R} defaultValue="${defaultValue}"${extraRootJsx ? ` ${extraRootJsx}` : ''}>
      <${L}${extraListJsx ? ` ${extraListJsx}` : ''}>
${jsxTriggers}
      </${L}>
${jsxContents}
    </${R}>
  );
}
        `),
        vue: formatCode(`
<script setup lang="ts">
import { ${R}, ${L}, ${T}, ${C} } from '${importSubpath}/vue';
</script>

<template>
  <${R} defaultValue="${defaultValue}"${extraRootJsx ? ` ${extraRootJsx}` : ''}>
    <${L}${extraListJsx ? ` ${extraListJsx}` : ''}>
${jsxTriggers.replace(/^ {4}/gm, '')}
    </${L}>
${jsxContents.replace(/^ {2}/gm, '')}
  </${R}>
</template>
        `),
        vue2: formatCode(`
<template>
  <${R} defaultValue="${defaultValue}"${extraRootJsx ? ` ${extraRootJsx}` : ''}>
    <${L}${extraListJsx ? ` ${extraListJsx}` : ''}>
${jsxTriggers.replace(/^ {4}/gm, '')}
    </${L}>
${jsxContents.replace(/^ {2}/gm, '')}
  </${R}>
</template>

<script>
import { ${R}, ${L}, ${T}, ${C} } from '${importSubpath}/vue2';

export default {
  components: { ${R}, ${L}, ${T}, ${C} },
};
</script>
        `),
      };
    },
  };
}

const brutalist = familyTabsSnippets({
  wcTag: 'wc-brutalist-tabs',
  compPrefix: 'Brutalist',
  importSubpath: '../proto-ui/components',
});
const bootstrap = familyTabsSnippets({
  wcTag: 'wc-bootstrap-2-3-2-tabs',
  compPrefix: 'Bootstrap232',
  importSubpath: '../proto-ui/components',
});
const liquidGlass = familyTabsSnippets({
  wcTag: 'wc-liquid-glass-tabs',
  compPrefix: 'LiquidGlass',
  importSubpath: '../proto-ui/components',
});

const brutalistHero = brutalist.basic(
  [
    {
      value: 'account',
      label: 'Account',
      content: 'Make changes to your account profile and username here.',
    },
    {
      value: 'password',
      label: 'Password',
      content: "Change your password here. After saving, you'll be logged out.",
    },
  ],
  'account'
);
const brutalistVertical = brutalist.basic(
  [
    {
      value: 'account',
      label: 'Account',
      content: 'Manage profile details, email aliases, and workspace identity.',
    },
    {
      value: 'password',
      label: 'Password',
      content: 'Update your account password and review active login sessions.',
    },
    {
      value: 'notifications',
      label: 'Notifications',
      content: 'Configure release digests, security alerts, and mention notifications.',
    },
  ],
  'account',
  'orientation="vertical"',
  'orientation="vertical"'
);
const brutalistDisabled = brutalist.basic(
  [
    {
      value: 'home',
      label: 'Home',
      content:
        'Disabled tabs remain visible in the strip while skipping focus and pointer activation.',
    },
    {
      value: 'settings',
      label: 'Disabled',
      content: 'Administrator settings are currently locked.',
      disabled: true,
    },
  ],
  'home'
);
const brutalistUnderline = brutalist.basic(
  [
    {
      value: 'overview',
      label: 'Overview',
      content: 'High-contrast underline navigation using bold DM Sans heading labels.',
    },
    {
      value: 'analytics',
      label: 'Analytics',
      content: 'Compare weekly traffic, conversion milestones, and active cohorts.',
    },
    {
      value: 'reports',
      label: 'Reports',
      content: 'Export CSV and PDF summaries for quarterly reviews.',
    },
  ],
  'overview',
  '',
  '',
  'appearance="underline"',
  'appearance="underline"',
  'appearance="underline"',
  'appearance="underline"'
);

const bootstrapHero = bootstrap.basic(
  [
    {
      value: 'overview',
      label: 'Overview',
      content: 'You have 12 active projects and 3 pending tasks.',
    },
    {
      value: 'analytics',
      label: 'Analytics',
      content: 'Page views are up 25% compared to last month.',
    },
    { value: 'reports', label: 'Reports', content: 'You have 5 reports ready to export.' },
    {
      value: 'settings',
      label: 'Settings',
      content: 'Changes apply immediately across your workspace.',
    },
  ],
  'overview'
);
const bootstrapVertical = bootstrap.basic(
  [
    {
      value: 'account',
      label: 'Account',
      content:
        'Classic Bootstrap 2.3.2 left-aligned tabs (.tabs-left) with left-rounded active borders.',
    },
    {
      value: 'password',
      label: 'Password',
      content: 'Update your credentials and configure session timeout rules.',
    },
    {
      value: 'notifications',
      label: 'Notifications',
      content: 'Choose digest frequency and alert delivery channels.',
    },
  ],
  'account',
  'orientation="vertical"',
  'orientation="vertical"'
);
const bootstrapUnderline = bootstrap.basic(
  [
    {
      value: 'overview',
      label: 'Overview',
      content:
        'Lightweight underline tabs retaining Bootstrap 2.3.2 typography and focus outlines.',
    },
    {
      value: 'analytics',
      label: 'Analytics',
      content: 'Monitor page views, bounce rates, and weekly referral sources.',
    },
    {
      value: 'reports',
      label: 'Reports',
      content: 'Export monthly snapshots in CSV or JSON format.',
    },
  ],
  'overview',
  '',
  '',
  'appearance="underline"',
  'appearance="underline"',
  'appearance="underline"',
  'appearance="underline"'
);
const bootstrapDisabled = bootstrap.basic(
  [
    {
      value: 'home',
      label: 'Home',
      content: 'Disabled tabs use muted #999 text in light mode and are skipped by roving focus.',
    },
    {
      value: 'settings',
      label: 'Disabled',
      content: 'Settings are unavailable for read-only members.',
      disabled: true,
    },
  ],
  'home'
);

const liquidHero = liquidGlass.basic(
  [
    {
      value: 'overview',
      label: 'Overview',
      content: 'You have 12 active projects and 3 pending tasks.',
    },
    {
      value: 'analytics',
      label: 'Analytics',
      content: 'Page views are up 25% compared to last month.',
    },
    { value: 'reports', label: 'Reports', content: 'You have 5 reports ready to export.' },
    {
      value: 'settings',
      label: 'Settings',
      content:
        'Liquid Glass automatically adapts to reduced transparency and contrast preferences.',
    },
  ],
  'overview'
);
const liquidProminence = liquidGlass.basic(
  [
    {
      value: 'overview',
      label: 'Overview',
      content: 'Prominent style tints the navigation track for higher visual emphasis.',
    },
    {
      value: 'analytics',
      label: 'Analytics',
      content: 'Active lens remains crisp without stacking glass-on-glass.',
    },
    { value: 'reports', label: 'Reports', content: 'Exports and audit digests.' },
  ],
  'overview',
  '',
  '',
  'prominence="prominent"',
  'prominence="prominent"'
);
const liquidVertical = liquidGlass.basic(
  [
    {
      value: 'account',
      label: 'Account',
      content:
        'Vertical track uses concentric rounded-2xl (16px) with p-1 (4px) and rounded-xl (12px) triggers.',
    },
    {
      value: 'password',
      label: 'Password',
      content: 'Manage password policy, passkeys, and trusted devices.',
    },
    {
      value: 'notifications',
      label: 'Notifications',
      content: 'Configure quiet hours and priority alerts.',
    },
  ],
  'account',
  'orientation="vertical"',
  'orientation="vertical"'
);
const liquidUnderline = liquidGlass.basic(
  [
    {
      value: 'overview',
      label: 'Overview',
      content: 'Underline appearance omits the glass track for lightweight secondary navigation.',
    },
    {
      value: 'analytics',
      label: 'Analytics',
      content: 'Track active users and retention curves across platforms.',
    },
    {
      value: 'reports',
      label: 'Reports',
      content: 'Download quarterly summaries and automated digests.',
    },
  ],
  'overview',
  '',
  '',
  'appearance="underline"',
  'appearance="underline"',
  'appearance="underline"',
  'appearance="underline"'
);
const liquidDisabled = liquidGlass.basic(
  [
    {
      value: 'home',
      label: 'Home',
      content:
        'Disabled triggers withdraw interaction without dimming opacity, preserving opaque fallback contrast.',
    },
    {
      value: 'settings',
      label: 'Disabled',
      content: 'Administrator settings are currently disabled.',
      disabled: true,
    },
  ],
  'home'
);

export const codeMap: Partial<Record<RuntimeId, Record<string, string>>> = {
  wc: {
    'demo-shadcn-tabs': formatCode(`
<wc-shadcn-tabs-root style-profile="rhea" default-value="overview">
  <wc-shadcn-tabs-list style-profile="rhea">
    <wc-shadcn-tabs-trigger style-profile="rhea" value="overview">Overview</wc-shadcn-tabs-trigger>
    <wc-shadcn-tabs-trigger style-profile="rhea" value="analytics">Analytics</wc-shadcn-tabs-trigger>
    <wc-shadcn-tabs-trigger style-profile="rhea" value="reports">Reports</wc-shadcn-tabs-trigger>
    <wc-shadcn-tabs-trigger style-profile="rhea" value="settings">Settings</wc-shadcn-tabs-trigger>
  </wc-shadcn-tabs-list>
  <wc-shadcn-tabs-content style-profile="rhea" value="overview">You have 12 active projects and 3 pending tasks.</wc-shadcn-tabs-content>
  <wc-shadcn-tabs-content style-profile="rhea" value="analytics">Page views are up 25% compared to last month.</wc-shadcn-tabs-content>
  <wc-shadcn-tabs-content style-profile="rhea" value="reports">You have 5 reports ready and available to export.</wc-shadcn-tabs-content>
  <wc-shadcn-tabs-content style-profile="rhea" value="settings">Configure notifications, security, and themes.</wc-shadcn-tabs-content>
</wc-shadcn-tabs-root>
    `),
    'demo-shadcn-tabs-line': formatCode(`
<wc-shadcn-tabs-root style-profile="rhea" default-value="overview">
  <wc-shadcn-tabs-list style-profile="rhea" variant="line">
    <wc-shadcn-tabs-trigger style-profile="rhea" value="overview">Overview</wc-shadcn-tabs-trigger>
    <wc-shadcn-tabs-trigger style-profile="rhea" value="analytics">Analytics</wc-shadcn-tabs-trigger>
    <wc-shadcn-tabs-trigger style-profile="rhea" value="reports">Reports</wc-shadcn-tabs-trigger>
  </wc-shadcn-tabs-list>
  <wc-shadcn-tabs-content style-profile="rhea" value="overview">Summary of active projects, milestones, and team velocity.</wc-shadcn-tabs-content>
  <wc-shadcn-tabs-content style-profile="rhea" value="analytics">Weekly active sessions, retention cohorts, and funnel trends.</wc-shadcn-tabs-content>
  <wc-shadcn-tabs-content style-profile="rhea" value="reports">Scheduled exports and audit snapshots ready for download.</wc-shadcn-tabs-content>
</wc-shadcn-tabs-root>
    `),
    'demo-shadcn-tabs-vertical': formatCode(`
<wc-shadcn-tabs-root style-profile="rhea" default-value="account" orientation="vertical">
  <wc-shadcn-tabs-list style-profile="rhea">
    <wc-shadcn-tabs-trigger style-profile="rhea" value="account">Account</wc-shadcn-tabs-trigger>
    <wc-shadcn-tabs-trigger style-profile="rhea" value="password">Password</wc-shadcn-tabs-trigger>
    <wc-shadcn-tabs-trigger style-profile="rhea" value="notifications">Notifications</wc-shadcn-tabs-trigger>
  </wc-shadcn-tabs-list>
  <wc-shadcn-tabs-content style-profile="rhea" value="account">Update your display name, workspace email, and profile avatar.</wc-shadcn-tabs-content>
  <wc-shadcn-tabs-content style-profile="rhea" value="password">Rotate your password regularly and manage passkey sign-in.</wc-shadcn-tabs-content>
  <wc-shadcn-tabs-content style-profile="rhea" value="notifications">Choose which project updates trigger email or desktop alerts.</wc-shadcn-tabs-content>
</wc-shadcn-tabs-root>
    `),
    'demo-shadcn-tabs-disabled': formatCode(`
<wc-shadcn-tabs-root style-profile="rhea" default-value="home">
  <wc-shadcn-tabs-list style-profile="rhea">
    <wc-shadcn-tabs-trigger style-profile="rhea" value="home">Home</wc-shadcn-tabs-trigger>
    <wc-shadcn-tabs-trigger style-profile="rhea" value="settings" disabled>Disabled</wc-shadcn-tabs-trigger>
  </wc-shadcn-tabs-list>
  <wc-shadcn-tabs-content style-profile="rhea" value="home">Disabled triggers are skipped during keyboard navigation and cannot be activated.</wc-shadcn-tabs-content>
</wc-shadcn-tabs-root>
    `),
    'demo-shadcn-tabs-controlled': formatCode(`
<wc-shadcn-tabs-root style-profile="rhea" id="controlled-tabs" value="overview">
  <wc-shadcn-tabs-list style-profile="rhea">
    <wc-shadcn-tabs-trigger style-profile="rhea" value="overview">Overview</wc-shadcn-tabs-trigger>
    <wc-shadcn-tabs-trigger style-profile="rhea" value="analytics">Analytics</wc-shadcn-tabs-trigger>
    <wc-shadcn-tabs-trigger style-profile="rhea" value="reports">Reports</wc-shadcn-tabs-trigger>
  </wc-shadcn-tabs-list>
  <wc-shadcn-tabs-content style-profile="rhea" value="overview">Controlled overview panel synchronized with external actions.</wc-shadcn-tabs-content>
  <wc-shadcn-tabs-content style-profile="rhea" value="analytics">Controlled analytics panel updated through value and valueChange.</wc-shadcn-tabs-content>
  <wc-shadcn-tabs-content style-profile="rhea" value="reports">Controlled reports panel driven by external state.</wc-shadcn-tabs-content>
</wc-shadcn-tabs-root>
    `),
    'demo-shadcn-tabs-manual': formatCode(`
<wc-shadcn-tabs-root style-profile="rhea" default-value="general" activation-mode="manual">
  <wc-shadcn-tabs-list style-profile="rhea" loop a11y-label="Manual activation settings">
    <wc-shadcn-tabs-trigger style-profile="rhea" value="general">General</wc-shadcn-tabs-trigger>
    <wc-shadcn-tabs-trigger style-profile="rhea" value="security">Security</wc-shadcn-tabs-trigger>
    <wc-shadcn-tabs-trigger style-profile="rhea" value="integrations">Integrations</wc-shadcn-tabs-trigger>
  </wc-shadcn-tabs-list>
  <wc-shadcn-tabs-content style-profile="rhea" value="general" keep-mounted>Arrow keys move focus with looping enabled. Press Enter or Space to switch panels.</wc-shadcn-tabs-content>
  <wc-shadcn-tabs-content style-profile="rhea" value="security" keep-mounted>Panels with keepMounted remain in the tree while hidden.</wc-shadcn-tabs-content>
  <wc-shadcn-tabs-content style-profile="rhea" value="integrations" keep-mounted>Connect webhooks, OAuth apps, and automated CI notifications.</wc-shadcn-tabs-content>
</wc-shadcn-tabs-root>
    `),
    'demo-shadcn-tabs-profile-switch': tabsProfileSwitchCode.wc,
    'demo-shadcn-tabs-preset-nova': tabsPresetWc('nova'),
    'demo-shadcn-tabs-preset-rhea': tabsPresetWc('rhea'),
    'demo-shadcn-tabs-preset-new-york-v4': tabsPresetWc('new-york-v4'),
    'demo-brutalist-tabs': brutalistHero.wc,
    'demo-brutalist-tabs-vertical': brutalistVertical.wc,
    'demo-brutalist-tabs-disabled': brutalistDisabled.wc,
    'demo-brutalist-tabs-underline': brutalistUnderline.wc,
    'demo-brutalist-tabs-controlled': formatCode(`
<wc-brutalist-tabs-root value="overview">
  <wc-brutalist-tabs-list>
    <wc-brutalist-tabs-trigger value="overview">Overview</wc-brutalist-tabs-trigger>
    <wc-brutalist-tabs-trigger value="analytics">Analytics</wc-brutalist-tabs-trigger>
    <wc-brutalist-tabs-trigger value="reports">Reports</wc-brutalist-tabs-trigger>
  </wc-brutalist-tabs-list>
  <wc-brutalist-tabs-content value="overview">Controlled Overview tab synced with external Brutalist buttons.</wc-brutalist-tabs-content>
  <wc-brutalist-tabs-content value="analytics">Controlled Analytics tab updated via value and valueChange.</wc-brutalist-tabs-content>
  <wc-brutalist-tabs-content value="reports">Controlled Reports tab ready for export workflows.</wc-brutalist-tabs-content>
</wc-brutalist-tabs-root>
    `),
    'demo-bootstrap-2-3-2-tabs': bootstrapHero.wc,
    'demo-bootstrap-2-3-2-tabs-vertical': bootstrapVertical.wc,
    'demo-bootstrap-2-3-2-tabs-underline': bootstrapUnderline.wc,
    'demo-bootstrap-2-3-2-tabs-disabled': bootstrapDisabled.wc,
    'demo-liquid-glass-tabs': liquidHero.wc,
    'demo-liquid-glass-tabs-prominence': liquidProminence.wc,
    'demo-liquid-glass-tabs-vertical': liquidVertical.wc,
    'demo-liquid-glass-tabs-underline': liquidUnderline.wc,
    'demo-liquid-glass-tabs-disabled': liquidDisabled.wc,
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
    <ShadcnTabsRoot styleProfile="rhea" defaultValue="overview">
      <ShadcnTabsList styleProfile="rhea">
        <ShadcnTabsTrigger styleProfile="rhea" value="overview">Overview</ShadcnTabsTrigger>
        <ShadcnTabsTrigger styleProfile="rhea" value="analytics">Analytics</ShadcnTabsTrigger>
        <ShadcnTabsTrigger styleProfile="rhea" value="reports">Reports</ShadcnTabsTrigger>
        <ShadcnTabsTrigger styleProfile="rhea" value="settings">Settings</ShadcnTabsTrigger>
      </ShadcnTabsList>
      <ShadcnTabsContent styleProfile="rhea" value="overview">You have 12 active projects and 3 pending tasks.</ShadcnTabsContent>
      <ShadcnTabsContent styleProfile="rhea" value="analytics">Page views are up 25% compared to last month.</ShadcnTabsContent>
      <ShadcnTabsContent styleProfile="rhea" value="reports">You have 5 reports ready and available to export.</ShadcnTabsContent>
      <ShadcnTabsContent styleProfile="rhea" value="settings">Configure notifications, security, and themes.</ShadcnTabsContent>
    </ShadcnTabsRoot>
  );
}
    `),
    'demo-shadcn-tabs-line': formatCode(`
import {
  ShadcnTabsContent,
  ShadcnTabsList,
  ShadcnTabsRoot,
  ShadcnTabsTrigger,
} from '../proto-ui/components/react';

export function TabsLineDemo() {
  return (
    <ShadcnTabsRoot styleProfile="rhea" defaultValue="overview">
      <ShadcnTabsList styleProfile="rhea" variant="line">
        <ShadcnTabsTrigger styleProfile="rhea" value="overview">Overview</ShadcnTabsTrigger>
        <ShadcnTabsTrigger styleProfile="rhea" value="analytics">Analytics</ShadcnTabsTrigger>
        <ShadcnTabsTrigger styleProfile="rhea" value="reports">Reports</ShadcnTabsTrigger>
      </ShadcnTabsList>
      <ShadcnTabsContent styleProfile="rhea" value="overview">Summary of active projects, milestones, and team velocity.</ShadcnTabsContent>
      <ShadcnTabsContent styleProfile="rhea" value="analytics">Weekly active sessions, retention cohorts, and funnel trends.</ShadcnTabsContent>
      <ShadcnTabsContent styleProfile="rhea" value="reports">Scheduled exports and audit snapshots ready for download.</ShadcnTabsContent>
    </ShadcnTabsRoot>
  );
}
    `),
    'demo-shadcn-tabs-vertical': formatCode(`
import {
  ShadcnTabsContent,
  ShadcnTabsList,
  ShadcnTabsRoot,
  ShadcnTabsTrigger,
} from '../proto-ui/components/react';

export function TabsVerticalDemo() {
  return (
    <ShadcnTabsRoot styleProfile="rhea" defaultValue="account" orientation="vertical">
      <ShadcnTabsList styleProfile="rhea">
        <ShadcnTabsTrigger styleProfile="rhea" value="account">Account</ShadcnTabsTrigger>
        <ShadcnTabsTrigger styleProfile="rhea" value="password">Password</ShadcnTabsTrigger>
        <ShadcnTabsTrigger styleProfile="rhea" value="notifications">Notifications</ShadcnTabsTrigger>
      </ShadcnTabsList>
      <ShadcnTabsContent styleProfile="rhea" value="account">Update your display name, workspace email, and profile avatar.</ShadcnTabsContent>
      <ShadcnTabsContent styleProfile="rhea" value="password">Rotate your password regularly and manage passkey sign-in.</ShadcnTabsContent>
      <ShadcnTabsContent styleProfile="rhea" value="notifications">Choose which project updates trigger email or desktop alerts.</ShadcnTabsContent>
    </ShadcnTabsRoot>
  );
}
    `),
    'demo-shadcn-tabs-disabled': formatCode(`
import {
  ShadcnTabsContent,
  ShadcnTabsList,
  ShadcnTabsRoot,
  ShadcnTabsTrigger,
} from '../proto-ui/components/react';

export function TabsDisabledDemo() {
  return (
    <ShadcnTabsRoot styleProfile="rhea" defaultValue="home">
      <ShadcnTabsList styleProfile="rhea">
        <ShadcnTabsTrigger styleProfile="rhea" value="home">Home</ShadcnTabsTrigger>
        <ShadcnTabsTrigger styleProfile="rhea" value="settings" disabled>Disabled</ShadcnTabsTrigger>
      </ShadcnTabsList>
      <ShadcnTabsContent styleProfile="rhea" value="home">Disabled triggers are skipped during keyboard navigation and cannot be activated.</ShadcnTabsContent>
    </ShadcnTabsRoot>
  );
}
    `),
    'demo-shadcn-tabs-controlled': formatCode(`
import { useState } from 'react';
import {
  ShadcnButton,
  ShadcnTabsContent,
  ShadcnTabsList,
  ShadcnTabsRoot,
  ShadcnTabsTrigger,
} from '../proto-ui/components/react';

export function TabsControlledDemo() {
  const [tab, setTab] = useState('overview');
  const handleValueChange = (payload: { value: string }) => setTab(payload.value);

  return (
    <div>
      <ShadcnButton styleProfile="rhea" variant="outline" size="sm" onClick={() => setTab('analytics')}>
        Go to Analytics
      </ShadcnButton>
      <ShadcnTabsRoot styleProfile="rhea" value={tab} onValueChange={handleValueChange}>
        <ShadcnTabsList styleProfile="rhea">
          <ShadcnTabsTrigger styleProfile="rhea" value="overview">Overview</ShadcnTabsTrigger>
          <ShadcnTabsTrigger styleProfile="rhea" value="analytics">Analytics</ShadcnTabsTrigger>
          <ShadcnTabsTrigger styleProfile="rhea" value="reports">Reports</ShadcnTabsTrigger>
        </ShadcnTabsList>
        <ShadcnTabsContent styleProfile="rhea" value="overview">Controlled overview panel synchronized with external actions.</ShadcnTabsContent>
        <ShadcnTabsContent styleProfile="rhea" value="analytics">Controlled analytics panel updated through value and valueChange.</ShadcnTabsContent>
        <ShadcnTabsContent styleProfile="rhea" value="reports">Controlled reports panel driven by external state.</ShadcnTabsContent>
      </ShadcnTabsRoot>
    </div>
  );
}
    `),
    'demo-shadcn-tabs-manual': formatCode(`
import {
  ShadcnTabsContent,
  ShadcnTabsList,
  ShadcnTabsRoot,
  ShadcnTabsTrigger,
} from '../proto-ui/components/react';

export function TabsManualDemo() {
  return (
    <ShadcnTabsRoot styleProfile="rhea" defaultValue="general" activationMode="manual">
      <ShadcnTabsList styleProfile="rhea" loop a11yLabel="Manual activation settings">
        <ShadcnTabsTrigger styleProfile="rhea" value="general">General</ShadcnTabsTrigger>
        <ShadcnTabsTrigger styleProfile="rhea" value="security">Security</ShadcnTabsTrigger>
        <ShadcnTabsTrigger styleProfile="rhea" value="integrations">Integrations</ShadcnTabsTrigger>
      </ShadcnTabsList>
      <ShadcnTabsContent styleProfile="rhea" value="general" keepMounted>Arrow keys move focus with looping enabled. Press Enter or Space to switch panels.</ShadcnTabsContent>
      <ShadcnTabsContent styleProfile="rhea" value="security" keepMounted>Panels with keepMounted remain in the tree while hidden.</ShadcnTabsContent>
      <ShadcnTabsContent styleProfile="rhea" value="integrations" keepMounted>Connect webhooks, OAuth apps, and automated CI notifications.</ShadcnTabsContent>
    </ShadcnTabsRoot>
  );
}
    `),
    'demo-shadcn-tabs-profile-switch': tabsProfileSwitchCode.react,
    'demo-shadcn-tabs-preset-nova': tabsPresetReact('nova'),
    'demo-shadcn-tabs-preset-rhea': tabsPresetReact('rhea'),
    'demo-shadcn-tabs-preset-new-york-v4': tabsPresetReact('new-york-v4'),
    'demo-brutalist-tabs': brutalistHero.react,
    'demo-brutalist-tabs-vertical': brutalistVertical.react,
    'demo-brutalist-tabs-disabled': brutalistDisabled.react,
    'demo-brutalist-tabs-underline': brutalistUnderline.react,
    'demo-brutalist-tabs-controlled': formatCode(`
import { useState } from 'react';
import {
  BrutalistButton,
  BrutalistTabsContent,
  BrutalistTabsList,
  BrutalistTabsRoot,
  BrutalistTabsTrigger,
} from '../proto-ui/components/react';

export function BrutalistTabsControlledDemo() {
  const [tab, setTab] = useState('overview');

  return (
    <div>
      <BrutalistButton onClick={() => setTab('analytics')}>Analytics</BrutalistButton>
      <BrutalistTabsRoot value={tab} onValueChange={(e: { value: string }) => setTab(e.value)}>
        <BrutalistTabsList>
          <BrutalistTabsTrigger value="overview">Overview</BrutalistTabsTrigger>
          <BrutalistTabsTrigger value="analytics">Analytics</BrutalistTabsTrigger>
          <BrutalistTabsTrigger value="reports">Reports</BrutalistTabsTrigger>
        </BrutalistTabsList>
        <BrutalistTabsContent value="overview">Controlled Overview tab synced with external Brutalist buttons.</BrutalistTabsContent>
        <BrutalistTabsContent value="analytics">Controlled Analytics tab updated via value and valueChange.</BrutalistTabsContent>
        <BrutalistTabsContent value="reports">Controlled Reports tab ready for export workflows.</BrutalistTabsContent>
      </BrutalistTabsRoot>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-tabs': bootstrapHero.react,
    'demo-bootstrap-2-3-2-tabs-vertical': bootstrapVertical.react,
    'demo-bootstrap-2-3-2-tabs-underline': bootstrapUnderline.react,
    'demo-bootstrap-2-3-2-tabs-disabled': bootstrapDisabled.react,
    'demo-liquid-glass-tabs': liquidHero.react,
    'demo-liquid-glass-tabs-prominence': liquidProminence.react,
    'demo-liquid-glass-tabs-vertical': liquidVertical.react,
    'demo-liquid-glass-tabs-underline': liquidUnderline.react,
    'demo-liquid-glass-tabs-disabled': liquidDisabled.react,
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
  <ShadcnTabsRoot styleProfile="rhea" defaultValue="overview">
    <ShadcnTabsList styleProfile="rhea">
      <ShadcnTabsTrigger styleProfile="rhea" value="overview">Overview</ShadcnTabsTrigger>
      <ShadcnTabsTrigger styleProfile="rhea" value="analytics">Analytics</ShadcnTabsTrigger>
      <ShadcnTabsTrigger styleProfile="rhea" value="reports">Reports</ShadcnTabsTrigger>
      <ShadcnTabsTrigger styleProfile="rhea" value="settings">Settings</ShadcnTabsTrigger>
    </ShadcnTabsList>
    <ShadcnTabsContent styleProfile="rhea" value="overview">You have 12 active projects and 3 pending tasks.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="rhea" value="analytics">Page views are up 25% compared to last month.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="rhea" value="reports">You have 5 reports ready and available to export.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="rhea" value="settings">Configure notifications, security, and themes.</ShadcnTabsContent>
  </ShadcnTabsRoot>
</template>
    `),
    'demo-shadcn-tabs-line': formatCode(`
<script setup lang="ts">
import {
  ShadcnTabsContent,
  ShadcnTabsList,
  ShadcnTabsRoot,
  ShadcnTabsTrigger,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnTabsRoot styleProfile="rhea" defaultValue="overview">
    <ShadcnTabsList styleProfile="rhea" variant="line">
      <ShadcnTabsTrigger styleProfile="rhea" value="overview">Overview</ShadcnTabsTrigger>
      <ShadcnTabsTrigger styleProfile="rhea" value="analytics">Analytics</ShadcnTabsTrigger>
      <ShadcnTabsTrigger styleProfile="rhea" value="reports">Reports</ShadcnTabsTrigger>
    </ShadcnTabsList>
    <ShadcnTabsContent styleProfile="rhea" value="overview">Summary of active projects, milestones, and team velocity.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="rhea" value="analytics">Weekly active sessions, retention cohorts, and funnel trends.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="rhea" value="reports">Scheduled exports and audit snapshots ready for download.</ShadcnTabsContent>
  </ShadcnTabsRoot>
</template>
    `),
    'demo-shadcn-tabs-vertical': formatCode(`
<script setup lang="ts">
import {
  ShadcnTabsContent,
  ShadcnTabsList,
  ShadcnTabsRoot,
  ShadcnTabsTrigger,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnTabsRoot styleProfile="rhea" defaultValue="account" orientation="vertical">
    <ShadcnTabsList styleProfile="rhea">
      <ShadcnTabsTrigger styleProfile="rhea" value="account">Account</ShadcnTabsTrigger>
      <ShadcnTabsTrigger styleProfile="rhea" value="password">Password</ShadcnTabsTrigger>
      <ShadcnTabsTrigger styleProfile="rhea" value="notifications">Notifications</ShadcnTabsTrigger>
    </ShadcnTabsList>
    <ShadcnTabsContent styleProfile="rhea" value="account">Update your display name, workspace email, and profile avatar.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="rhea" value="password">Rotate your password regularly and manage passkey sign-in.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="rhea" value="notifications">Choose which project updates trigger email or desktop alerts.</ShadcnTabsContent>
  </ShadcnTabsRoot>
</template>
    `),
    'demo-shadcn-tabs-disabled': formatCode(`
<script setup lang="ts">
import {
  ShadcnTabsContent,
  ShadcnTabsList,
  ShadcnTabsRoot,
  ShadcnTabsTrigger,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnTabsRoot styleProfile="rhea" defaultValue="home">
    <ShadcnTabsList styleProfile="rhea">
      <ShadcnTabsTrigger styleProfile="rhea" value="home">Home</ShadcnTabsTrigger>
      <ShadcnTabsTrigger styleProfile="rhea" value="settings" disabled>Disabled</ShadcnTabsTrigger>
    </ShadcnTabsList>
    <ShadcnTabsContent styleProfile="rhea" value="home">Disabled triggers are skipped during keyboard navigation and cannot be activated.</ShadcnTabsContent>
  </ShadcnTabsRoot>
</template>
    `),
    'demo-shadcn-tabs-controlled': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  ShadcnButton,
  ShadcnTabsContent,
  ShadcnTabsList,
  ShadcnTabsRoot,
  ShadcnTabsTrigger,
} from '../proto-ui/components/vue';

const tab = ref('overview');
const onValueChange = (payload: { value: string }) => {
  tab.value = payload.value;
};
</script>

<template>
  <ShadcnButton styleProfile="rhea" variant="outline" size="sm" @click="tab = 'analytics'">
    Go to Analytics
  </ShadcnButton>
  <ShadcnTabsRoot styleProfile="rhea" :value="tab" @valueChange="onValueChange">
    <ShadcnTabsList styleProfile="rhea">
      <ShadcnTabsTrigger styleProfile="rhea" value="overview">Overview</ShadcnTabsTrigger>
      <ShadcnTabsTrigger styleProfile="rhea" value="analytics">Analytics</ShadcnTabsTrigger>
      <ShadcnTabsTrigger styleProfile="rhea" value="reports">Reports</ShadcnTabsTrigger>
    </ShadcnTabsList>
    <ShadcnTabsContent styleProfile="rhea" value="overview">Controlled overview panel synchronized with external actions.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="rhea" value="analytics">Controlled analytics panel updated through value and valueChange.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="rhea" value="reports">Controlled reports panel driven by external state.</ShadcnTabsContent>
  </ShadcnTabsRoot>
</template>
    `),
    'demo-shadcn-tabs-manual': formatCode(`
<script setup lang="ts">
import {
  ShadcnTabsContent,
  ShadcnTabsList,
  ShadcnTabsRoot,
  ShadcnTabsTrigger,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnTabsRoot styleProfile="rhea" defaultValue="general" activationMode="manual">
    <ShadcnTabsList styleProfile="rhea" loop a11yLabel="Manual activation settings">
      <ShadcnTabsTrigger styleProfile="rhea" value="general">General</ShadcnTabsTrigger>
      <ShadcnTabsTrigger styleProfile="rhea" value="security">Security</ShadcnTabsTrigger>
      <ShadcnTabsTrigger styleProfile="rhea" value="integrations">Integrations</ShadcnTabsTrigger>
    </ShadcnTabsList>
    <ShadcnTabsContent styleProfile="rhea" value="general" keepMounted>Arrow keys move focus with looping enabled. Press Enter or Space to switch panels.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="rhea" value="security" keepMounted>Panels with keepMounted remain in the tree while hidden.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="rhea" value="integrations" keepMounted>Connect webhooks, OAuth apps, and automated CI notifications.</ShadcnTabsContent>
  </ShadcnTabsRoot>
</template>
    `),
    'demo-shadcn-tabs-profile-switch': tabsProfileSwitchCode.vue,
    'demo-shadcn-tabs-preset-nova': tabsPresetVue('nova'),
    'demo-shadcn-tabs-preset-rhea': tabsPresetVue('rhea'),
    'demo-shadcn-tabs-preset-new-york-v4': tabsPresetVue('new-york-v4'),
    'demo-brutalist-tabs': brutalistHero.vue,
    'demo-brutalist-tabs-vertical': brutalistVertical.vue,
    'demo-brutalist-tabs-disabled': brutalistDisabled.vue,
    'demo-brutalist-tabs-underline': brutalistUnderline.vue,
    'demo-brutalist-tabs-controlled': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  BrutalistButton,
  BrutalistTabsContent,
  BrutalistTabsList,
  BrutalistTabsRoot,
  BrutalistTabsTrigger,
} from '../proto-ui/components/vue';

const tab = ref('overview');
</script>

<template>
  <BrutalistButton @click="tab = 'analytics'">Analytics</BrutalistButton>
  <BrutalistTabsRoot :value="tab" @valueChange="tab = $event.value">
    <BrutalistTabsList>
      <BrutalistTabsTrigger value="overview">Overview</BrutalistTabsTrigger>
      <BrutalistTabsTrigger value="analytics">Analytics</BrutalistTabsTrigger>
      <BrutalistTabsTrigger value="reports">Reports</BrutalistTabsTrigger>
    </BrutalistTabsList>
    <BrutalistTabsContent value="overview">Controlled Overview tab synced with external Brutalist buttons.</BrutalistTabsContent>
    <BrutalistTabsContent value="analytics">Controlled Analytics tab updated via value and valueChange.</BrutalistTabsContent>
    <BrutalistTabsContent value="reports">Controlled Reports tab ready for export workflows.</BrutalistTabsContent>
  </BrutalistTabsRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-tabs': bootstrapHero.vue,
    'demo-bootstrap-2-3-2-tabs-vertical': bootstrapVertical.vue,
    'demo-bootstrap-2-3-2-tabs-underline': bootstrapUnderline.vue,
    'demo-bootstrap-2-3-2-tabs-disabled': bootstrapDisabled.vue,
    'demo-liquid-glass-tabs': liquidHero.vue,
    'demo-liquid-glass-tabs-prominence': liquidProminence.vue,
    'demo-liquid-glass-tabs-vertical': liquidVertical.vue,
    'demo-liquid-glass-tabs-underline': liquidUnderline.vue,
    'demo-liquid-glass-tabs-disabled': liquidDisabled.vue,
  },
  vue2: {
    'demo-shadcn-tabs': formatCode(`
<template>
  <ShadcnTabsRoot styleProfile="rhea" defaultValue="overview">
    <ShadcnTabsList styleProfile="rhea">
      <ShadcnTabsTrigger styleProfile="rhea" value="overview">Overview</ShadcnTabsTrigger>
      <ShadcnTabsTrigger styleProfile="rhea" value="analytics">Analytics</ShadcnTabsTrigger>
      <ShadcnTabsTrigger styleProfile="rhea" value="reports">Reports</ShadcnTabsTrigger>
      <ShadcnTabsTrigger styleProfile="rhea" value="settings">Settings</ShadcnTabsTrigger>
    </ShadcnTabsList>
    <ShadcnTabsContent styleProfile="rhea" value="overview">You have 12 active projects and 3 pending tasks.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="rhea" value="analytics">Page views are up 25% compared to last month.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="rhea" value="reports">You have 5 reports ready and available to export.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="rhea" value="settings">Configure notifications, security, and themes.</ShadcnTabsContent>
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
    'demo-shadcn-tabs-line': formatCode(`
<template>
  <ShadcnTabsRoot styleProfile="rhea" defaultValue="overview">
    <ShadcnTabsList styleProfile="rhea" variant="line">
      <ShadcnTabsTrigger styleProfile="rhea" value="overview">Overview</ShadcnTabsTrigger>
      <ShadcnTabsTrigger styleProfile="rhea" value="analytics">Analytics</ShadcnTabsTrigger>
      <ShadcnTabsTrigger styleProfile="rhea" value="reports">Reports</ShadcnTabsTrigger>
    </ShadcnTabsList>
    <ShadcnTabsContent styleProfile="rhea" value="overview">Summary of active projects, milestones, and team velocity.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="rhea" value="analytics">Weekly active sessions, retention cohorts, and funnel trends.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="rhea" value="reports">Scheduled exports and audit snapshots ready for download.</ShadcnTabsContent>
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
    'demo-shadcn-tabs-vertical': formatCode(`
<template>
  <ShadcnTabsRoot styleProfile="rhea" defaultValue="account" orientation="vertical">
    <ShadcnTabsList styleProfile="rhea">
      <ShadcnTabsTrigger styleProfile="rhea" value="account">Account</ShadcnTabsTrigger>
      <ShadcnTabsTrigger styleProfile="rhea" value="password">Password</ShadcnTabsTrigger>
      <ShadcnTabsTrigger styleProfile="rhea" value="notifications">Notifications</ShadcnTabsTrigger>
    </ShadcnTabsList>
    <ShadcnTabsContent styleProfile="rhea" value="account">Update your display name, workspace email, and profile avatar.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="rhea" value="password">Rotate your password regularly and manage passkey sign-in.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="rhea" value="notifications">Choose which project updates trigger email or desktop alerts.</ShadcnTabsContent>
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
    'demo-shadcn-tabs-disabled': formatCode(`
<template>
  <ShadcnTabsRoot styleProfile="rhea" defaultValue="home">
    <ShadcnTabsList styleProfile="rhea">
      <ShadcnTabsTrigger styleProfile="rhea" value="home">Home</ShadcnTabsTrigger>
      <ShadcnTabsTrigger styleProfile="rhea" value="settings" disabled>Disabled</ShadcnTabsTrigger>
    </ShadcnTabsList>
    <ShadcnTabsContent styleProfile="rhea" value="home">Disabled triggers are skipped during keyboard navigation and cannot be activated.</ShadcnTabsContent>
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
    'demo-shadcn-tabs-controlled': formatCode(`
<template>
  <div>
    <ShadcnButton styleProfile="rhea" variant="outline" size="sm" @click="selectAnalytics">
      Go to Analytics
    </ShadcnButton>
    <ShadcnTabsRoot styleProfile="rhea" :value="tab" @valueChange="onValueChange">
      <ShadcnTabsList styleProfile="rhea">
        <ShadcnTabsTrigger styleProfile="rhea" value="overview">Overview</ShadcnTabsTrigger>
        <ShadcnTabsTrigger styleProfile="rhea" value="analytics">Analytics</ShadcnTabsTrigger>
        <ShadcnTabsTrigger styleProfile="rhea" value="reports">Reports</ShadcnTabsTrigger>
      </ShadcnTabsList>
      <ShadcnTabsContent styleProfile="rhea" value="overview">Controlled overview panel synchronized with external actions.</ShadcnTabsContent>
      <ShadcnTabsContent styleProfile="rhea" value="analytics">Controlled analytics panel updated through value and valueChange.</ShadcnTabsContent>
      <ShadcnTabsContent styleProfile="rhea" value="reports">Controlled reports panel driven by external state.</ShadcnTabsContent>
    </ShadcnTabsRoot>
  </div>
</template>

<script>
import {
  ShadcnButton,
  ShadcnTabsContent,
  ShadcnTabsList,
  ShadcnTabsRoot,
  ShadcnTabsTrigger,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnButton,
    ShadcnTabsContent,
    ShadcnTabsList,
    ShadcnTabsRoot,
    ShadcnTabsTrigger,
  },
  data: () => ({ tab: 'overview' }),
  methods: {
    selectAnalytics() {
      this.tab = 'analytics';
    },
    onValueChange(payload) {
      this.tab = payload.value;
    },
  },
};
</script>
    `),
    'demo-shadcn-tabs-manual': formatCode(`
<template>
  <ShadcnTabsRoot styleProfile="rhea" defaultValue="general" activationMode="manual">
    <ShadcnTabsList styleProfile="rhea" loop a11yLabel="Manual activation settings">
      <ShadcnTabsTrigger styleProfile="rhea" value="general">General</ShadcnTabsTrigger>
      <ShadcnTabsTrigger styleProfile="rhea" value="security">Security</ShadcnTabsTrigger>
      <ShadcnTabsTrigger styleProfile="rhea" value="integrations">Integrations</ShadcnTabsTrigger>
    </ShadcnTabsList>
    <ShadcnTabsContent styleProfile="rhea" value="general" keepMounted>Arrow keys move focus with looping enabled. Press Enter or Space to switch panels.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="rhea" value="security" keepMounted>Panels with keepMounted remain in the tree while hidden.</ShadcnTabsContent>
    <ShadcnTabsContent styleProfile="rhea" value="integrations" keepMounted>Connect webhooks, OAuth apps, and automated CI notifications.</ShadcnTabsContent>
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
    'demo-shadcn-tabs-profile-switch': tabsProfileSwitchCode.vue2,
    'demo-shadcn-tabs-preset-nova': tabsPresetVue2('nova'),
    'demo-shadcn-tabs-preset-rhea': tabsPresetVue2('rhea'),
    'demo-shadcn-tabs-preset-new-york-v4': tabsPresetVue2('new-york-v4'),
    'demo-brutalist-tabs': brutalistHero.vue2,
    'demo-brutalist-tabs-vertical': brutalistVertical.vue2,
    'demo-brutalist-tabs-disabled': brutalistDisabled.vue2,
    'demo-brutalist-tabs-underline': brutalistUnderline.vue2,
    'demo-brutalist-tabs-controlled': formatCode(`
<template>
  <div>
    <BrutalistButton @click="selectAnalytics">Analytics</BrutalistButton>
    <BrutalistTabsRoot :value="tab" @valueChange="onValueChange">
      <BrutalistTabsList>
        <BrutalistTabsTrigger value="overview">Overview</BrutalistTabsTrigger>
        <BrutalistTabsTrigger value="analytics">Analytics</BrutalistTabsTrigger>
        <BrutalistTabsTrigger value="reports">Reports</BrutalistTabsTrigger>
      </BrutalistTabsList>
      <BrutalistTabsContent value="overview">Controlled Overview tab synced with external Brutalist buttons.</BrutalistTabsContent>
      <BrutalistTabsContent value="analytics">Controlled Analytics tab updated via value and valueChange.</BrutalistTabsContent>
      <BrutalistTabsContent value="reports">Controlled Reports tab ready for export workflows.</BrutalistTabsContent>
    </BrutalistTabsRoot>
  </div>
</template>

<script>
import {
  BrutalistButton,
  BrutalistTabsContent,
  BrutalistTabsList,
  BrutalistTabsRoot,
  BrutalistTabsTrigger,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistButton,
    BrutalistTabsContent,
    BrutalistTabsList,
    BrutalistTabsRoot,
    BrutalistTabsTrigger,
  },
  data: () => ({ tab: 'overview' }),
  methods: {
    selectAnalytics() {
      this.tab = 'analytics';
    },
    onValueChange(payload) {
      this.tab = payload.value;
    },
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-tabs': bootstrapHero.vue2,
    'demo-bootstrap-2-3-2-tabs-vertical': bootstrapVertical.vue2,
    'demo-bootstrap-2-3-2-tabs-underline': bootstrapUnderline.vue2,
    'demo-bootstrap-2-3-2-tabs-disabled': bootstrapDisabled.vue2,
    'demo-liquid-glass-tabs': liquidHero.vue2,
    'demo-liquid-glass-tabs-prominence': liquidProminence.vue2,
    'demo-liquid-glass-tabs-vertical': liquidVertical.vue2,
    'demo-liquid-glass-tabs-underline': liquidUnderline.vue2,
    'demo-liquid-glass-tabs-disabled': liquidDisabled.vue2,
  },
};
