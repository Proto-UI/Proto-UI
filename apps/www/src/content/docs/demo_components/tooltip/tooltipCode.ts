import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

type FamilyCodeConfig = {
  wcPrefix: string;
  componentPrefix: string;
  importPathReact: string;
  importPathVue: string;
  importPathVue2: string;
  profileAttrWc: string;
  profilePropReact: string;
  profileAttrVue: string;
};

const FAMILIES: Record<'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass', FamilyCodeConfig> = {
  shadcn: {
    wcPrefix: 'wc-shadcn-tooltip',
    componentPrefix: 'ShadcnTooltip',
    importPathReact: '../proto-ui/components/react',
    importPathVue: '../proto-ui/components/vue',
    importPathVue2: '../proto-ui/components/vue2',
    profileAttrWc: ' style-profile="rhea"',
    profilePropReact: ' styleProfile="rhea"',
    profileAttrVue: ' style-profile="rhea"',
  },
  brutalist: {
    wcPrefix: 'wc-brutalist-tooltip',
    componentPrefix: 'BrutalistTooltip',
    importPathReact: '../proto-ui/components/react',
    importPathVue: '../proto-ui/components/vue',
    importPathVue2: '../proto-ui/components/vue2',
    profileAttrWc: '',
    profilePropReact: '',
    profileAttrVue: '',
  },
  'bootstrap-2-3-2': {
    wcPrefix: 'wc-bootstrap-2-3-2-tooltip',
    componentPrefix: 'BootstrapTooltip',
    importPathReact: '../proto-ui/components/react',
    importPathVue: '../proto-ui/components/vue',
    importPathVue2: '../proto-ui/components/vue2',
    profileAttrWc: '',
    profilePropReact: '',
    profileAttrVue: '',
  },
  'liquid-glass': {
    wcPrefix: 'wc-liquid-glass-tooltip',
    componentPrefix: 'LiquidGlassTooltip',
    importPathReact: '../proto-ui/components/react',
    importPathVue: '../proto-ui/components/vue',
    importPathVue2: '../proto-ui/components/vue2',
    profileAttrWc: '',
    profilePropReact: '',
    profileAttrVue: '',
  },
};

function groupExample(family: keyof typeof FAMILIES) {
  const c = FAMILIES[family];
  const P = c.componentPrefix;
  const W = c.wcPrefix;
  const pWc = c.profileAttrWc;
  const pR = c.profilePropReact;
  const pV = c.profileAttrVue;

  return {
    wc: `<${W}-group${pWc} class="flex items-center gap-3">
  <${W}-root${pWc}>
    <${W}-trigger${pWc}>Account</${W}-trigger>
    <${W}-content${pWc} side="top">View account settings</${W}-content>
  </${W}-root>
  <${W}-root${pWc}>
    <${W}-trigger${pWc}>Notifications</${W}-trigger>
    <${W}-content${pWc} side="top">Manage notification preferences</${W}-content>
  </${W}-root>
</${W}-group>`,
    react: `import {
  ${P}Group,
  ${P}Root,
  ${P}Trigger,
  ${P}Content,
} from '${c.importPathReact}';

export function TooltipGroupExample() {
  return (
    <${P}Group${pR} className="flex items-center gap-3">
      <${P}Root${pR}>
        <${P}Trigger${pR}>Account</${P}Trigger>
        <${P}Content${pR} side="top">View account settings</${P}Content>
      </${P}Root>
      <${P}Root${pR}>
        <${P}Trigger${pR}>Notifications</${P}Trigger>
        <${P}Content${pR} side="top">Manage notification preferences</${P}Content>
      </${P}Root>
    </${P}Group>
  );
}`,
    vue: `<script setup lang="ts">
import {
  ${P}Group,
  ${P}Root,
  ${P}Trigger,
  ${P}Content,
} from '${c.importPathVue}';
</script>

<template>
  <${P}Group${pV} class="flex items-center gap-3">
    <${P}Root${pV}>
      <${P}Trigger${pV}>Account</${P}Trigger>
      <${P}Content${pV} side="top">View account settings</${P}Content>
    </${P}Root>
    <${P}Root${pV}>
      <${P}Trigger${pV}>Notifications</${P}Trigger>
      <${P}Content${pV} side="top">Manage notification preferences</${P}Content>
    </${P}Root>
  </${P}Group>
</template>`,
    vue2: `<template>
  <${P}Group${pV} class="flex items-center gap-3">
    <${P}Root${pV}>
      <${P}Trigger${pV}>Account</${P}Trigger>
      <${P}Content${pV} side="top">View account settings</${P}Content>
    </${P}Root>
    <${P}Root${pV}>
      <${P}Trigger${pV}>Notifications</${P}Trigger>
      <${P}Content${pV} side="top">Manage notification preferences</${P}Content>
    </${P}Root>
  </${P}Group>
</template>

<script>
import {
  ${P}Group,
  ${P}Root,
  ${P}Trigger,
  ${P}Content,
} from '${c.importPathVue2}';

export default {
  components: {
    ${P}Group,
    ${P}Root,
    ${P}Trigger,
    ${P}Content,
  },
};
</script>`,
  };
}

function basicExample(family: keyof typeof FAMILIES) {
  const c = FAMILIES[family];
  const P = c.componentPrefix;
  const W = c.wcPrefix;
  const pWc = c.profileAttrWc;
  const pR = c.profilePropReact;
  const pV = c.profileAttrVue;

  return {
    wc: `<${W}-root${pWc}>
  <${W}-trigger${pWc}>Hover</${W}-trigger>
  <${W}-content${pWc} side="top">Add to library</${W}-content>
</${W}-root>`,
    react: `import {
  ${P}Root,
  ${P}Trigger,
  ${P}Content,
} from '${c.importPathReact}';

export function TooltipBasicExample() {
  return (
    <${P}Root${pR} openDelay={0}>
      <${P}Trigger${pR}>Hover</${P}Trigger>
      <${P}Content${pR} side="top">Add to library</${P}Content>
    </${P}Root>
  );
}`,
    vue: `<script setup lang="ts">
import {
  ${P}Root,
  ${P}Trigger,
  ${P}Content,
} from '${c.importPathVue}';
</script>

<template>
  <${P}Root${pV} :open-delay="0">
    <${P}Trigger${pV}>Hover</${P}Trigger>
    <${P}Content${pV} side="top">Add to library</${P}Content>
  </${P}Root>
</template>`,
    vue2: `<template>
  <${P}Root${pV} :open-delay="0">
    <${P}Trigger${pV}>Hover</${P}Trigger>
    <${P}Content${pV} side="top">Add to library</${P}Content>
  </${P}Root>
</template>

<script>
import {
  ${P}Root,
  ${P}Trigger,
  ${P}Content,
} from '${c.importPathVue2}';

export default {
  components: {
    ${P}Root,
    ${P}Trigger,
    ${P}Content,
  },
};
</script>`,
  };
}

function sidesExample(family: keyof typeof FAMILIES) {
  const c = FAMILIES[family];
  const P = c.componentPrefix;
  const W = c.wcPrefix;
  const pWc = c.profileAttrWc;
  const pR = c.profilePropReact;
  const pV = c.profileAttrVue;

  return {
    wc: `<${W}-group${pWc} class="flex flex-wrap gap-2">
  <${W}-root${pWc}>
    <${W}-trigger${pWc}>Left</${W}-trigger>
    <${W}-content${pWc} side="left">Add to library</${W}-content>
  </${W}-root>
  <${W}-root${pWc}>
    <${W}-trigger${pWc}>Top</${W}-trigger>
    <${W}-content${pWc} side="top">Add to library</${W}-content>
  </${W}-root>
  <${W}-root${pWc}>
    <${W}-trigger${pWc}>Bottom</${W}-trigger>
    <${W}-content${pWc} side="bottom">Add to library</${W}-content>
  </${W}-root>
  <${W}-root${pWc}>
    <${W}-trigger${pWc}>Right</${W}-trigger>
    <${W}-content${pWc} side="right">Add to library</${W}-content>
  </${W}-root>
</${W}-group>`,
    react: `import {
  ${P}Group,
  ${P}Root,
  ${P}Trigger,
  ${P}Content,
} from '${c.importPathReact}';

const SIDES = ['left', 'top', 'bottom', 'right'] as const;

export function TooltipSidesExample() {
  return (
    <${P}Group${pR} openDelay={0} className="flex flex-wrap gap-2">
      {SIDES.map((side) => (
        <${P}Root${pR} key={side}>
          <${P}Trigger${pR}>{side}</${P}Trigger>
          <${P}Content${pR} side={side}>Add to library</${P}Content>
        </${P}Root>
      ))}
    </${P}Group>
  );
}`,
    vue: `<script setup lang="ts">
import {
  ${P}Group,
  ${P}Root,
  ${P}Trigger,
  ${P}Content,
} from '${c.importPathVue}';

const sides = ['left', 'top', 'bottom', 'right'] as const;
</script>

<template>
  <${P}Group${pV} :open-delay="0" class="flex flex-wrap gap-2">
    <${P}Root${pV} v-for="side in sides" :key="side">
      <${P}Trigger${pV}>{{ side }}</${P}Trigger>
      <${P}Content${pV} :side="side">Add to library</${P}Content>
    </${P}Root>
  </${P}Group>
</template>`,
    vue2: `<template>
  <${P}Group${pV} :open-delay="0" class="flex flex-wrap gap-2">
    <${P}Root${pV} v-for="side in sides" :key="side">
      <${P}Trigger${pV}>{{ side }}</${P}Trigger>
      <${P}Content${pV} :side="side">Add to library</${P}Content>
    </${P}Root>
  </${P}Group>
</template>

<script>
import {
  ${P}Group,
  ${P}Root,
  ${P}Trigger,
  ${P}Content,
} from '${c.importPathVue2}';

export default {
  components: {
    ${P}Group,
    ${P}Root,
    ${P}Trigger,
    ${P}Content,
  },
  data() {
    return { sides: ['left', 'top', 'bottom', 'right'] };
  },
};
</script>`,
  };
}

function shortcutExample(family: keyof typeof FAMILIES) {
  const c = FAMILIES[family];
  const P = c.componentPrefix;
  const W = c.wcPrefix;
  const pWc = c.profileAttrWc;
  const pR = c.profilePropReact;
  const pV = c.profileAttrVue;

  return {
    wc: `<${W}-root${pWc}>
  <${W}-trigger${pWc}>Save</${W}-trigger>
  <${W}-content${pWc} side="top">
    Save Changes <kbd>S</kbd>
  </${W}-content>
</${W}-root>`,
    react: `import {
  ${P}Root,
  ${P}Trigger,
  ${P}Content,
} from '${c.importPathReact}';

export function TooltipShortcutExample() {
  return (
    <${P}Root${pR} openDelay={0}>
      <${P}Trigger${pR}>Save</${P}Trigger>
      <${P}Content${pR} side="top">
        Save Changes <kbd>S</kbd>
      </${P}Content>
    </${P}Root>
  );
}`,
    vue: `<script setup lang="ts">
import {
  ${P}Root,
  ${P}Trigger,
  ${P}Content,
} from '${c.importPathVue}';
</script>

<template>
  <${P}Root${pV} :open-delay="0">
    <${P}Trigger${pV}>Save</${P}Trigger>
    <${P}Content${pV} side="top">
      Save Changes <kbd>S</kbd>
    </${P}Content>
  </${P}Root>
</template>`,
    vue2: `<template>
  <${P}Root${pV} :open-delay="0">
    <${P}Trigger${pV}>Save</${P}Trigger>
    <${P}Content${pV} side="top">
      Save Changes <kbd>S</kbd>
    </${P}Content>
  </${P}Root>
</template>

<script>
import {
  ${P}Root,
  ${P}Trigger,
  ${P}Content,
} from '${c.importPathVue2}';

export default {
  components: {
    ${P}Root,
    ${P}Trigger,
    ${P}Content,
  },
};
</script>`,
  };
}

function disabledExample(family: keyof typeof FAMILIES) {
  const c = FAMILIES[family];
  const P = c.componentPrefix;
  const W = c.wcPrefix;
  const pWc = c.profileAttrWc;
  const pR = c.profilePropReact;
  const pV = c.profileAttrVue;

  return {
    wc: `<${W}-root${pWc}>
  <${W}-trigger${pWc} class="inline-block w-fit">
    <button type="button" disabled>Disabled</button>
  </${W}-trigger>
  <${W}-content${pWc} side="top">This feature is currently unavailable</${W}-content>
</${W}-root>`,
    react: `import {
  ${P}Root,
  ${P}Trigger,
  ${P}Content,
} from '${c.importPathReact}';

export function TooltipDisabledExample() {
  return (
    <${P}Root${pR} openDelay={0}>
      <${P}Trigger${pR} className="inline-block w-fit">
        <button type="button" disabled>
          Disabled
        </button>
      </${P}Trigger>
      <${P}Content${pR} side="top">
        This feature is currently unavailable
      </${P}Content>
    </${P}Root>
  );
}`,
    vue: `<script setup lang="ts">
import {
  ${P}Root,
  ${P}Trigger,
  ${P}Content,
} from '${c.importPathVue}';
</script>

<template>
  <${P}Root${pV} :open-delay="0">
    <${P}Trigger${pV} class="inline-block w-fit">
      <button type="button" disabled>Disabled</button>
    </${P}Trigger>
    <${P}Content${pV} side="top">
      This feature is currently unavailable
    </${P}Content>
  </${P}Root>
</template>`,
    vue2: `<template>
  <${P}Root${pV} :open-delay="0">
    <${P}Trigger${pV} class="inline-block w-fit">
      <button type="button" disabled>Disabled</button>
    </${P}Trigger>
    <${P}Content${pV} side="top">
      This feature is currently unavailable
    </${P}Content>
  </${P}Root>
</template>

<script>
import {
  ${P}Root,
  ${P}Trigger,
  ${P}Content,
} from '${c.importPathVue2}';

export default {
  components: {
    ${P}Root,
    ${P}Trigger,
    ${P}Content,
  },
};
</script>`,
  };
}

const entries: Record<string, Record<'wc' | 'react' | 'vue' | 'vue2', string>> = {
  'demo-shadcn-tooltip': groupExample('shadcn'),
  'demo-shadcn-tooltip-basic': basicExample('shadcn'),
  'demo-shadcn-tooltip-sides': sidesExample('shadcn'),
  'demo-shadcn-tooltip-shortcut': shortcutExample('shadcn'),
  'demo-shadcn-tooltip-disabled': disabledExample('shadcn'),
  'demo-brutalist-tooltip': groupExample('brutalist'),
  'demo-brutalist-tooltip-sides': sidesExample('brutalist'),
  'demo-brutalist-tooltip-shortcut': shortcutExample('brutalist'),
  'demo-brutalist-tooltip-disabled': disabledExample('brutalist'),
  'demo-bootstrap-2-3-2-tooltip': groupExample('bootstrap-2-3-2'),
  'demo-bootstrap-2-3-2-tooltip-sides': sidesExample('bootstrap-2-3-2'),
  'demo-bootstrap-2-3-2-tooltip-shortcut': shortcutExample('bootstrap-2-3-2'),
  'demo-bootstrap-2-3-2-tooltip-disabled': disabledExample('bootstrap-2-3-2'),
  'demo-liquid-glass-tooltip': groupExample('liquid-glass'),
  'demo-liquid-glass-tooltip-sides': sidesExample('liquid-glass'),
  'demo-liquid-glass-tooltip-shortcut': shortcutExample('liquid-glass'),
  'demo-liquid-glass-tooltip-disabled': disabledExample('liquid-glass'),
};

function mapRuntime(runtime: 'wc' | 'react' | 'vue' | 'vue2'): Record<string, string> {
  return Object.fromEntries(Object.entries(entries).map(([id, code]) => [id, code[runtime]]));
}

export const codeMap: Partial<Record<RuntimeId, Record<string, string>>> = {
  wc: mapRuntime('wc'),
  react: mapRuntime('react'),
  vue: mapRuntime('vue'),
  vue2: mapRuntime('vue2'),
};
