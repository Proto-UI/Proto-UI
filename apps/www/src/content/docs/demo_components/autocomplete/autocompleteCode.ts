import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

function buildHeroWc(family: string, triggerBody: string) {
  const prefix = `proto-ui-${family}-autocomplete`;
  return formatCode(`
<${prefix}-root id="${family}-ac-hero" a11y-label="Framework">
  <${prefix}-input placeholder="Search frameworks…" a11y-label="Framework"></${prefix}-input>
  <${prefix}-trigger>${triggerBody}</${prefix}-trigger>
  <${prefix}-content>
    <${prefix}-item value="next" text-value="Next.js" keywords="react ssr">Next.js</${prefix}-item>
    <${prefix}-item value="astro" text-value="Astro" keywords="islands static">Astro</${prefix}-item>
    <${prefix}-item value="nuxt" text-value="Nuxt" keywords="vue">Nuxt</${prefix}-item>
    <${prefix}-item value="sveltekit" text-value="SvelteKit" keywords="svelte">SvelteKit</${prefix}-item>
    <${prefix}-item value="legacy" text-value="Legacy v1" disabled>Legacy v1</${prefix}-item>
    <${prefix}-empty>No matching frameworks.</${prefix}-empty>
  </${prefix}-content>
</${prefix}-root>
  `);
}

function buildHeroReact(pkg: string, styleProp = '') {
  return formatCode(`
import {
  AutocompleteRoot,
  AutocompleteInput,
  AutocompleteTrigger,
  AutocompleteContent,
  AutocompleteItem,
  AutocompleteEmpty,
} from '${pkg}';

export function FrameworkAutocomplete() {
  return (
    <AutocompleteRoot${styleProp} a11yLabel="Framework">
      <AutocompleteInput placeholder="Search frameworks…" a11yLabel="Framework" />
      <AutocompleteTrigger>Options</AutocompleteTrigger>
      <AutocompleteContent>
        <AutocompleteItem value="next" textValue="Next.js" keywords="react ssr">Next.js</AutocompleteItem>
        <AutocompleteItem value="astro" textValue="Astro" keywords="islands static">Astro</AutocompleteItem>
        <AutocompleteItem value="nuxt" textValue="Nuxt" keywords="vue">Nuxt</AutocompleteItem>
        <AutocompleteItem value="sveltekit" textValue="SvelteKit" keywords="svelte">SvelteKit</AutocompleteItem>
        <AutocompleteItem value="legacy" textValue="Legacy v1" disabled>Legacy v1</AutocompleteItem>
        <AutocompleteEmpty>No matching frameworks.</AutocompleteEmpty>
      </AutocompleteContent>
    </AutocompleteRoot>
  );
}
  `);
}

function buildHeroVue(pkg: string, styleProp = '') {
  return formatCode(`
<script setup lang="ts">
import {
  AutocompleteRoot,
  AutocompleteInput,
  AutocompleteTrigger,
  AutocompleteContent,
  AutocompleteItem,
  AutocompleteEmpty,
} from '${pkg}';
</script>

<template>
  <AutocompleteRoot${styleProp} a11y-label="Framework">
    <AutocompleteInput placeholder="Search frameworks…" a11y-label="Framework" />
    <AutocompleteTrigger>Options</AutocompleteTrigger>
    <AutocompleteContent>
      <AutocompleteItem value="next" text-value="Next.js" keywords="react ssr">Next.js</AutocompleteItem>
      <AutocompleteItem value="astro" text-value="Astro" keywords="islands static">Astro</AutocompleteItem>
      <AutocompleteItem value="nuxt" text-value="Nuxt" keywords="vue">Nuxt</AutocompleteItem>
      <AutocompleteItem value="sveltekit" text-value="SvelteKit" keywords="svelte">SvelteKit</AutocompleteItem>
      <AutocompleteItem value="legacy" text-value="Legacy v1" :disabled="true">Legacy v1</AutocompleteItem>
      <AutocompleteEmpty>No matching frameworks.</AutocompleteEmpty>
    </AutocompleteContent>
  </AutocompleteRoot>
</template>
  `);
}

function buildKeywordsWc(family: string) {
  const prefix = `proto-ui-${family}-autocomplete`;
  return formatCode(`
<${prefix}-root a11y-label="Cities and cuisines">
  <${prefix}-input placeholder='Try "cafe", "brazil", or "dessert"…'></${prefix}-input>
  <${prefix}-trigger>Browse</${prefix}-trigger>
  <${prefix}-content>
    <${prefix}-item value="cafe" text-value="Café" keywords="coffee espresso">Café</${prefix}-item>
    <${prefix}-item value="creme-brulee" text-value="Crème Brûlée" keywords="dessert french">Crème Brûlée</${prefix}-item>
    <${prefix}-item value="sao-paulo" text-value="São Paulo" keywords="brazil city">São Paulo</${prefix}-item>
    <${prefix}-empty>No matching entries.</${prefix}-empty>
  </${prefix}-content>
</${prefix}-root>
  `);
}

function buildKeywordsReact(pkg: string, styleProp = '') {
  return formatCode(`
import {
  AutocompleteRoot,
  AutocompleteInput,
  AutocompleteTrigger,
  AutocompleteContent,
  AutocompleteItem,
  AutocompleteEmpty,
} from '${pkg}';

export function KeywordsAutocomplete() {
  return (
    <AutocompleteRoot${styleProp} a11yLabel="Cities and cuisines">
      <AutocompleteInput placeholder='Try "cafe", "brazil", or "dessert"…' />
      <AutocompleteTrigger>Browse</AutocompleteTrigger>
      <AutocompleteContent>
        <AutocompleteItem value="cafe" textValue="Café" keywords="coffee espresso">Café</AutocompleteItem>
        <AutocompleteItem value="creme-brulee" textValue="Crème Brûlée" keywords="dessert french">Crème Brûlée</AutocompleteItem>
        <AutocompleteItem value="sao-paulo" textValue="São Paulo" keywords="brazil city">São Paulo</AutocompleteItem>
        <AutocompleteEmpty>No matching entries.</AutocompleteEmpty>
      </AutocompleteContent>
    </AutocompleteRoot>
  );
}
  `);
}

function buildKeywordsVue(pkg: string, styleProp = '') {
  return formatCode(`
<script setup lang="ts">
import {
  AutocompleteRoot,
  AutocompleteInput,
  AutocompleteTrigger,
  AutocompleteContent,
  AutocompleteItem,
  AutocompleteEmpty,
} from '${pkg}';
</script>

<template>
  <AutocompleteRoot${styleProp} a11y-label="Cities and cuisines">
    <AutocompleteInput placeholder='Try "cafe", "brazil", or "dessert"…' />
    <AutocompleteTrigger>Browse</AutocompleteTrigger>
    <AutocompleteContent>
      <AutocompleteItem value="cafe" text-value="Café" keywords="coffee espresso">Café</AutocompleteItem>
      <AutocompleteItem value="creme-brulee" text-value="Crème Brûlée" keywords="dessert french">Crème Brûlée</AutocompleteItem>
      <AutocompleteItem value="sao-paulo" text-value="São Paulo" keywords="brazil city">São Paulo</AutocompleteItem>
      <AutocompleteEmpty>No matching entries.</AutocompleteEmpty>
    </AutocompleteContent>
  </AutocompleteRoot>
</template>
  `);
}

function buildFreeTextWc(family: string) {
  const prefix = `proto-ui-${family}-autocomplete`;
  return formatCode(`
<${prefix}-root a11y-label="Issue label">
  <${prefix}-input placeholder="Add or create a tag…"></${prefix}-input>
  <${prefix}-content>
    <${prefix}-item value="bug" text-value="bug">bug</${prefix}-item>
    <${prefix}-item value="documentation" text-value="documentation">documentation</${prefix}-item>
    <${prefix}-item value="enhancement" text-value="enhancement">enhancement</${prefix}-item>
    <${prefix}-empty>No existing tag — press Enter to create it.</${prefix}-empty>
  </${prefix}-content>
</${prefix}-root>
  `);
}

function buildFreeTextReact(pkg: string, styleProp = '') {
  return formatCode(`
import {
  AutocompleteRoot,
  AutocompleteInput,
  AutocompleteContent,
  AutocompleteItem,
  AutocompleteEmpty,
} from '${pkg}';

export function FreeTextAutocomplete() {
  return (
    <AutocompleteRoot${styleProp} a11yLabel="Issue label">
      <AutocompleteInput placeholder="Add or create a tag…" />
      <AutocompleteContent>
        <AutocompleteItem value="bug" textValue="bug">bug</AutocompleteItem>
        <AutocompleteItem value="documentation" textValue="documentation">documentation</AutocompleteItem>
        <AutocompleteItem value="enhancement" textValue="enhancement">enhancement</AutocompleteItem>
        <AutocompleteEmpty>No existing tag — press Enter to create it.</AutocompleteEmpty>
      </AutocompleteContent>
    </AutocompleteRoot>
  );
}
  `);
}

function buildFreeTextVue(pkg: string, styleProp = '') {
  return formatCode(`
<script setup lang="ts">
import {
  AutocompleteRoot,
  AutocompleteInput,
  AutocompleteContent,
  AutocompleteItem,
  AutocompleteEmpty,
} from '${pkg}';
</script>

<template>
  <AutocompleteRoot${styleProp} a11y-label="Issue label">
    <AutocompleteInput placeholder="Add or create a tag…" />
    <AutocompleteContent>
      <AutocompleteItem value="bug" text-value="bug">bug</AutocompleteItem>
      <AutocompleteItem value="documentation" text-value="documentation">documentation</AutocompleteItem>
      <AutocompleteItem value="enhancement" text-value="enhancement">enhancement</AutocompleteItem>
      <AutocompleteEmpty>No existing tag — press Enter to create it.</AutocompleteEmpty>
    </AutocompleteContent>
  </AutocompleteRoot>
</template>
  `);
}

function buildDisabledWc(family: string) {
  const prefix = `proto-ui-${family}-autocomplete`;
  return formatCode(`
<div class="grid gap-4">
  <${prefix}-root disabled default-value="Astro" default-input-value="Astro">
    <${prefix}-input placeholder="Disabled…"></${prefix}-input>
    <${prefix}-trigger>Options</${prefix}-trigger>
    <${prefix}-content>
      <${prefix}-item value="astro" text-value="Astro">Astro</${prefix}-item>
    </${prefix}-content>
  </${prefix}-root>
  <${prefix}-root read-only default-value="Next.js" default-input-value="Next.js">
    <${prefix}-input placeholder="Read-only…"></${prefix}-input>
    <${prefix}-trigger>Options</${prefix}-trigger>
    <${prefix}-content>
      <${prefix}-item value="next" text-value="Next.js">Next.js</${prefix}-item>
    </${prefix}-content>
  </${prefix}-root>
</div>
  `);
}

function buildDisabledReact(pkg: string, styleProp = '') {
  return formatCode(`
import {
  AutocompleteRoot,
  AutocompleteInput,
  AutocompleteTrigger,
  AutocompleteContent,
  AutocompleteItem,
} from '${pkg}';

export function DisabledAutocomplete() {
  return (
    <div className="grid gap-4">
      <AutocompleteRoot${styleProp} disabled defaultValue="Astro" defaultInputValue="Astro">
        <AutocompleteInput placeholder="Disabled…" />
        <AutocompleteTrigger>Options</AutocompleteTrigger>
        <AutocompleteContent>
          <AutocompleteItem value="astro" textValue="Astro">Astro</AutocompleteItem>
        </AutocompleteContent>
      </AutocompleteRoot>
      <AutocompleteRoot${styleProp} readOnly defaultValue="Next.js" defaultInputValue="Next.js">
        <AutocompleteInput placeholder="Read-only…" />
        <AutocompleteTrigger>Options</AutocompleteTrigger>
        <AutocompleteContent>
          <AutocompleteItem value="next" textValue="Next.js">Next.js</AutocompleteItem>
        </AutocompleteContent>
      </AutocompleteRoot>
    </div>
  );
}
  `);
}

function buildDisabledVue(pkg: string, styleProp = '') {
  return formatCode(`
<script setup lang="ts">
import {
  AutocompleteRoot,
  AutocompleteInput,
  AutocompleteTrigger,
  AutocompleteContent,
  AutocompleteItem,
} from '${pkg}';
</script>

<template>
  <div class="grid gap-4">
    <AutocompleteRoot${styleProp} :disabled="true" default-value="Astro" default-input-value="Astro">
      <AutocompleteInput placeholder="Disabled…" />
      <AutocompleteTrigger>Options</AutocompleteTrigger>
      <AutocompleteContent>
        <AutocompleteItem value="astro" text-value="Astro">Astro</AutocompleteItem>
      </AutocompleteContent>
    </AutocompleteRoot>
    <AutocompleteRoot${styleProp} :read-only="true" default-value="Next.js" default-input-value="Next.js">
      <AutocompleteInput placeholder="Read-only…" />
      <AutocompleteTrigger>Options</AutocompleteTrigger>
      <AutocompleteContent>
        <AutocompleteItem value="next" text-value="Next.js">Next.js</AutocompleteItem>
      </AutocompleteContent>
    </AutocompleteRoot>
  </div>
</template>
  `);
}

const shadcnControlledWc = formatCode(`
<proto-ui-shadcn-autocomplete-root
  id="controlled-ac"
  default-value="Astro"
  default-input-value="Astro"
  a11y-label="Region"
>
  <proto-ui-shadcn-autocomplete-input placeholder="Filter regions…"></proto-ui-shadcn-autocomplete-input>
  <proto-ui-shadcn-autocomplete-trigger>Regions</proto-ui-shadcn-autocomplete-trigger>
  <proto-ui-shadcn-autocomplete-content side="bottom" align="start" side-offset="6">
    <proto-ui-shadcn-autocomplete-item value="us-east" text-value="US East (Virginia)">US East (Virginia)</proto-ui-shadcn-autocomplete-item>
    <proto-ui-shadcn-autocomplete-item value="eu-west" text-value="EU West (Frankfurt)">EU West (Frankfurt)</proto-ui-shadcn-autocomplete-item>
    <proto-ui-shadcn-autocomplete-item value="ap-east" text-value="Asia Pacific (Tokyo)">Asia Pacific (Tokyo)</proto-ui-shadcn-autocomplete-item>
    <proto-ui-shadcn-autocomplete-empty>No regions matched.</proto-ui-shadcn-autocomplete-empty>
  </proto-ui-shadcn-autocomplete-content>
</proto-ui-shadcn-autocomplete-root>
`);

const shadcnControlledReact = formatCode(`
import { useState } from 'react';
import {
  AutocompleteRoot,
  AutocompleteInput,
  AutocompleteTrigger,
  AutocompleteContent,
  AutocompleteItem,
  AutocompleteEmpty,
} from './components/shadcn/autocomplete';

export function ControlledAutocomplete() {
  const [value, setValue] = useState('Astro');
  const [inputValue, setInputValue] = useState('Astro');
  const [open, setOpen] = useState(false);

  return (
    <AutocompleteRoot
      styleProfile="rhea"
      value={value}
      inputValue={inputValue}
      open={open}
      loop={false}
      onValueChange={(detail) => setValue(detail.textValue)}
      onInputValueChange={(detail) => setInputValue(detail.value)}
      onOpenChange={(detail) => setOpen(detail.open)}
    >
      <AutocompleteInput placeholder="Filter regions…" />
      <AutocompleteTrigger>Regions</AutocompleteTrigger>
      <AutocompleteContent side="bottom" align="start" sideOffset={6}>
        <AutocompleteItem value="us-east" textValue="US East (Virginia)">US East (Virginia)</AutocompleteItem>
        <AutocompleteItem value="eu-west" textValue="EU West (Frankfurt)">EU West (Frankfurt)</AutocompleteItem>
        <AutocompleteItem value="ap-east" textValue="Asia Pacific (Tokyo)">Asia Pacific (Tokyo)</AutocompleteItem>
        <AutocompleteEmpty>No regions matched.</AutocompleteEmpty>
      </AutocompleteContent>
    </AutocompleteRoot>
  );
}
`);

const shadcnControlledVue = formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  AutocompleteRoot,
  AutocompleteInput,
  AutocompleteTrigger,
  AutocompleteContent,
  AutocompleteItem,
  AutocompleteEmpty,
} from './components/shadcn/autocomplete';

const value = ref('Astro');
const inputValue = ref('Astro');
const open = ref(false);
</script>

<template>
  <AutocompleteRoot
    style-profile="rhea"
    :value="value"
    :input-value="inputValue"
    :open="open"
    :loop="false"
    @value-change="(d) => (value = d.textValue)"
    @input-value-change="(d) => (inputValue = d.value)"
    @open-change="(d) => (open = d.open)"
  >
    <AutocompleteInput placeholder="Filter regions…" />
    <AutocompleteTrigger>Regions</AutocompleteTrigger>
    <AutocompleteContent side="bottom" align="start" :side-offset="6">
      <AutocompleteItem value="us-east" text-value="US East (Virginia)">US East (Virginia)</AutocompleteItem>
      <AutocompleteItem value="eu-west" text-value="EU West (Frankfurt)">EU West (Frankfurt)</AutocompleteItem>
      <AutocompleteItem value="ap-east" text-value="Asia Pacific (Tokyo)">Asia Pacific (Tokyo)</AutocompleteItem>
      <AutocompleteEmpty>No regions matched.</AutocompleteEmpty>
    </AutocompleteContent>
  </AutocompleteRoot>
</template>
`);

const liquidGlassProminentWc = formatCode(`
<div class="grid gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
  <proto-ui-liquid-glass-autocomplete-root>
    <proto-ui-liquid-glass-autocomplete-input placeholder="Prominent glass trigger…"></proto-ui-liquid-glass-autocomplete-input>
    <proto-ui-liquid-glass-autocomplete-trigger variant="prominent" material="auto">Browse</proto-ui-liquid-glass-autocomplete-trigger>
    <proto-ui-liquid-glass-autocomplete-content material="auto">
      <proto-ui-liquid-glass-autocomplete-item value="swift" text-value="Swift">Swift</proto-ui-liquid-glass-autocomplete-item>
      <proto-ui-liquid-glass-autocomplete-item value="typescript" text-value="TypeScript">TypeScript</proto-ui-liquid-glass-autocomplete-item>
    </proto-ui-liquid-glass-autocomplete-content>
  </proto-ui-liquid-glass-autocomplete-root>

  <proto-ui-liquid-glass-autocomplete-root>
    <proto-ui-liquid-glass-autocomplete-input placeholder='Opaque fallback (material="opaque")…'></proto-ui-liquid-glass-autocomplete-input>
    <proto-ui-liquid-glass-autocomplete-trigger variant="regular" material="opaque">Opaque</proto-ui-liquid-glass-autocomplete-trigger>
    <proto-ui-liquid-glass-autocomplete-content material="opaque">
      <proto-ui-liquid-glass-autocomplete-item value="swift" text-value="Swift">Swift</proto-ui-liquid-glass-autocomplete-item>
      <proto-ui-liquid-glass-autocomplete-item value="typescript" text-value="TypeScript">TypeScript</proto-ui-liquid-glass-autocomplete-item>
    </proto-ui-liquid-glass-autocomplete-content>
  </proto-ui-liquid-glass-autocomplete-root>
</div>
`);

const liquidGlassProminentReact = formatCode(`
import {
  AutocompleteRoot,
  AutocompleteInput,
  AutocompleteTrigger,
  AutocompleteContent,
  AutocompleteItem,
} from './components/liquid-glass/autocomplete';

export function ProminentAndOpaqueAutocomplete() {
  return (
    <div className="grid gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
      <AutocompleteRoot>
        <AutocompleteInput placeholder="Prominent glass trigger…" />
        <AutocompleteTrigger variant="prominent" material="auto">Browse</AutocompleteTrigger>
        <AutocompleteContent material="auto">
          <AutocompleteItem value="swift" textValue="Swift">Swift</AutocompleteItem>
          <AutocompleteItem value="typescript" textValue="TypeScript">TypeScript</AutocompleteItem>
        </AutocompleteContent>
      </AutocompleteRoot>

      <AutocompleteRoot>
        <AutocompleteInput placeholder='Opaque fallback (material="opaque")…' />
        <AutocompleteTrigger variant="regular" material="opaque">Opaque</AutocompleteTrigger>
        <AutocompleteContent material="opaque">
          <AutocompleteItem value="swift" textValue="Swift">Swift</AutocompleteItem>
          <AutocompleteItem value="typescript" textValue="TypeScript">TypeScript</AutocompleteItem>
        </AutocompleteContent>
      </AutocompleteRoot>
    </div>
  );
}
`);

const liquidGlassProminentVue = formatCode(`
<script setup lang="ts">
import {
  AutocompleteRoot,
  AutocompleteInput,
  AutocompleteTrigger,
  AutocompleteContent,
  AutocompleteItem,
} from './components/liquid-glass/autocomplete';
</script>

<template>
  <div class="grid gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <AutocompleteRoot>
      <AutocompleteInput placeholder="Prominent glass trigger…" />
      <AutocompleteTrigger variant="prominent" material="auto">Browse</AutocompleteTrigger>
      <AutocompleteContent material="auto">
        <AutocompleteItem value="swift" text-value="Swift">Swift</AutocompleteItem>
        <AutocompleteItem value="typescript" text-value="TypeScript">TypeScript</AutocompleteItem>
      </AutocompleteContent>
    </AutocompleteRoot>

    <AutocompleteRoot>
      <AutocompleteInput placeholder='Opaque fallback (material="opaque")…' />
      <AutocompleteTrigger variant="regular" material="opaque">Opaque</AutocompleteTrigger>
      <AutocompleteContent material="opaque">
        <AutocompleteItem value="swift" text-value="Swift">Swift</AutocompleteItem>
        <AutocompleteItem value="typescript" text-value="TypeScript">TypeScript</AutocompleteItem>
      </AutocompleteContent>
    </AutocompleteRoot>
  </div>
</template>
`);

const vueEntries: Record<string, string> = {
  'demo-shadcn-autocomplete': buildHeroVue(
    './components/shadcn/autocomplete',
    ' style-profile="rhea"'
  ),
  'demo-shadcn-autocomplete-keywords': buildKeywordsVue(
    './components/shadcn/autocomplete',
    ' style-profile="rhea"'
  ),
  'demo-shadcn-autocomplete-free-text': buildFreeTextVue(
    './components/shadcn/autocomplete',
    ' style-profile="rhea"'
  ),
  'demo-shadcn-autocomplete-disabled': buildDisabledVue(
    './components/shadcn/autocomplete',
    ' style-profile="rhea"'
  ),
  'demo-shadcn-autocomplete-controlled': shadcnControlledVue,
  'demo-brutalist-autocomplete': buildHeroVue('./components/brutalist/autocomplete'),
  'demo-brutalist-autocomplete-keywords': buildKeywordsVue('./components/brutalist/autocomplete'),
  'demo-brutalist-autocomplete-free-text': buildFreeTextVue('./components/brutalist/autocomplete'),
  'demo-brutalist-autocomplete-disabled': buildDisabledVue('./components/brutalist/autocomplete'),
  'demo-bootstrap-2-3-2-autocomplete': buildHeroVue('./components/bootstrap-2-3-2/autocomplete'),
  'demo-bootstrap-2-3-2-autocomplete-keywords': buildKeywordsVue(
    './components/bootstrap-2-3-2/autocomplete'
  ),
  'demo-bootstrap-2-3-2-autocomplete-free-text': buildFreeTextVue(
    './components/bootstrap-2-3-2/autocomplete'
  ),
  'demo-bootstrap-2-3-2-autocomplete-disabled': buildDisabledVue(
    './components/bootstrap-2-3-2/autocomplete'
  ),
  'demo-liquid-glass-autocomplete': buildHeroVue('./components/liquid-glass/autocomplete'),
  'demo-liquid-glass-autocomplete-prominent': liquidGlassProminentVue,
  'demo-liquid-glass-autocomplete-keywords': buildKeywordsVue(
    './components/liquid-glass/autocomplete'
  ),
  'demo-liquid-glass-autocomplete-disabled': buildDisabledVue(
    './components/liquid-glass/autocomplete'
  ),
};

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-autocomplete': buildHeroWc(
      'shadcn',
      '<span class="sr-only">Toggle framework suggestions</span>'
    ),
    'demo-shadcn-autocomplete-keywords': buildKeywordsWc('shadcn'),
    'demo-shadcn-autocomplete-free-text': buildFreeTextWc('shadcn'),
    'demo-shadcn-autocomplete-disabled': buildDisabledWc('shadcn'),
    'demo-shadcn-autocomplete-controlled': shadcnControlledWc,
    'demo-brutalist-autocomplete': buildHeroWc('brutalist', 'Options'),
    'demo-brutalist-autocomplete-keywords': buildKeywordsWc('brutalist'),
    'demo-brutalist-autocomplete-free-text': buildFreeTextWc('brutalist'),
    'demo-brutalist-autocomplete-disabled': buildDisabledWc('brutalist'),
    'demo-bootstrap-2-3-2-autocomplete': buildHeroWc('bootstrap-2-3-2', 'Options'),
    'demo-bootstrap-2-3-2-autocomplete-keywords': buildKeywordsWc('bootstrap-2-3-2'),
    'demo-bootstrap-2-3-2-autocomplete-free-text': buildFreeTextWc('bootstrap-2-3-2'),
    'demo-bootstrap-2-3-2-autocomplete-disabled': buildDisabledWc('bootstrap-2-3-2'),
    'demo-liquid-glass-autocomplete': buildHeroWc('liquid-glass', 'Options'),
    'demo-liquid-glass-autocomplete-prominent': liquidGlassProminentWc,
    'demo-liquid-glass-autocomplete-keywords': buildKeywordsWc('liquid-glass'),
    'demo-liquid-glass-autocomplete-disabled': buildDisabledWc('liquid-glass'),
  },
  react: {
    'demo-shadcn-autocomplete': buildHeroReact(
      './components/shadcn/autocomplete',
      ' styleProfile="rhea"'
    ),
    'demo-shadcn-autocomplete-keywords': buildKeywordsReact(
      './components/shadcn/autocomplete',
      ' styleProfile="rhea"'
    ),
    'demo-shadcn-autocomplete-free-text': buildFreeTextReact(
      './components/shadcn/autocomplete',
      ' styleProfile="rhea"'
    ),
    'demo-shadcn-autocomplete-disabled': buildDisabledReact(
      './components/shadcn/autocomplete',
      ' styleProfile="rhea"'
    ),
    'demo-shadcn-autocomplete-controlled': shadcnControlledReact,
    'demo-brutalist-autocomplete': buildHeroReact('./components/brutalist/autocomplete'),
    'demo-brutalist-autocomplete-keywords': buildKeywordsReact(
      './components/brutalist/autocomplete'
    ),
    'demo-brutalist-autocomplete-free-text': buildFreeTextReact(
      './components/brutalist/autocomplete'
    ),
    'demo-brutalist-autocomplete-disabled': buildDisabledReact(
      './components/brutalist/autocomplete'
    ),
    'demo-bootstrap-2-3-2-autocomplete': buildHeroReact(
      './components/bootstrap-2-3-2/autocomplete'
    ),
    'demo-bootstrap-2-3-2-autocomplete-keywords': buildKeywordsReact(
      './components/bootstrap-2-3-2/autocomplete'
    ),
    'demo-bootstrap-2-3-2-autocomplete-free-text': buildFreeTextReact(
      './components/bootstrap-2-3-2/autocomplete'
    ),
    'demo-bootstrap-2-3-2-autocomplete-disabled': buildDisabledReact(
      './components/bootstrap-2-3-2/autocomplete'
    ),
    'demo-liquid-glass-autocomplete': buildHeroReact('./components/liquid-glass/autocomplete'),
    'demo-liquid-glass-autocomplete-prominent': liquidGlassProminentReact,
    'demo-liquid-glass-autocomplete-keywords': buildKeywordsReact(
      './components/liquid-glass/autocomplete'
    ),
    'demo-liquid-glass-autocomplete-disabled': buildDisabledReact(
      './components/liquid-glass/autocomplete'
    ),
  },
  vue: vueEntries,
  vue2: vueEntries,
};
