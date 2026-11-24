const makeFrameworkWc = (
  prefix: string,
  extraInputAttr = '',
  extraTriggerAttr = '',
  extraContentAttr = ''
) =>
  `<${prefix}-combobox-root a11y-label="Framework">
  <${prefix}-combobox-input placeholder="Select a framework..."${extraInputAttr}></${prefix}-combobox-input>
  <${prefix}-combobox-trigger${extraTriggerAttr}>▾</${prefix}-combobox-trigger>
  <${prefix}-combobox-content${extraContentAttr}>
    <${prefix}-combobox-item value="next.js" text-value="Next.js" keywords="react ssr">Next.js</${prefix}-combobox-item>
    <${prefix}-combobox-item value="sveltekit" text-value="SvelteKit" keywords="svelte">SvelteKit</${prefix}-combobox-item>
    <${prefix}-combobox-item value="nuxt.js" text-value="Nuxt.js" keywords="vue">Nuxt.js</${prefix}-combobox-item>
    <${prefix}-combobox-item value="remix" text-value="Remix" keywords="react">Remix</${prefix}-combobox-item>
    <${prefix}-combobox-item value="astro" text-value="Astro" keywords="static">Astro</${prefix}-combobox-item>
    <${prefix}-combobox-empty>No frameworks found.</${prefix}-combobox-empty>
  </${prefix}-combobox-content>
</${prefix}-combobox-root>`;

const makeFrameworkReact = (extraInputProp = '', extraTriggerProp = '', extraContentProp = '') =>
  `<ComboboxRoot a11yLabel="Framework">
  <ComboboxInput placeholder="Select a framework..."${extraInputProp} />
  <ComboboxTrigger${extraTriggerProp}>▾</ComboboxTrigger>
  <ComboboxContent${extraContentProp}>
    <ComboboxItem value="next.js" textValue="Next.js" keywords="react ssr">Next.js</ComboboxItem>
    <ComboboxItem value="sveltekit" textValue="SvelteKit" keywords="svelte">SvelteKit</ComboboxItem>
    <ComboboxItem value="nuxt.js" textValue="Nuxt.js" keywords="vue">Nuxt.js</ComboboxItem>
    <ComboboxItem value="remix" textValue="Remix" keywords="react">Remix</ComboboxItem>
    <ComboboxItem value="astro" textValue="Astro" keywords="static">Astro</ComboboxItem>
    <ComboboxEmpty>No frameworks found.</ComboboxEmpty>
  </ComboboxContent>
</ComboboxRoot>`;

const makeFrameworkVue = (extraInputProp = '', extraTriggerProp = '', extraContentProp = '') =>
  `<template>
  <ComboboxRoot a11y-label="Framework">
    <ComboboxInput placeholder="Select a framework..."${extraInputProp} />
    <ComboboxTrigger${extraTriggerProp}>▾</ComboboxTrigger>
    <ComboboxContent${extraContentProp}>
      <ComboboxItem value="next.js" text-value="Next.js" keywords="react ssr">Next.js</ComboboxItem>
      <ComboboxItem value="sveltekit" text-value="SvelteKit" keywords="svelte">SvelteKit</ComboboxItem>
      <ComboboxItem value="nuxt.js" text-value="Nuxt.js" keywords="vue">Nuxt.js</ComboboxItem>
      <ComboboxItem value="remix" text-value="Remix" keywords="react">Remix</ComboboxItem>
      <ComboboxItem value="astro" text-value="Astro" keywords="static">Astro</ComboboxItem>
      <ComboboxEmpty>No frameworks found.</ComboboxEmpty>
    </ComboboxContent>
  </ComboboxRoot>
</template>`;

const makeTimezoneWc = (prefix: string) =>
  `<${prefix}-combobox-root a11y-label="Timezone">
  <${prefix}-combobox-input placeholder="Select a timezone..."></${prefix}-combobox-input>
  <${prefix}-combobox-trigger>▾</${prefix}-combobox-trigger>
  <${prefix}-combobox-content>
    <${prefix}-combobox-item value="america-new-york" text-value="(GMT-5) New York" keywords="americas us nyc est">(GMT-5) New York</${prefix}-combobox-item>
    <${prefix}-combobox-item value="europe-london" text-value="(GMT+0) London" keywords="europe uk utc">(GMT+0) London</${prefix}-combobox-item>
    <${prefix}-combobox-item value="asia-shanghai" text-value="(GMT+8) Shanghai" keywords="asia china cst">(GMT+8) Shanghai</${prefix}-combobox-item>
    <${prefix}-combobox-item value="asia-tokyo" text-value="(GMT+9) Tokyo" keywords="asia japan jst">(GMT+9) Tokyo</${prefix}-combobox-item>
    <${prefix}-combobox-empty>No timezones found.</${prefix}-combobox-empty>
  </${prefix}-combobox-content>
</${prefix}-combobox-root>`;

const makeTimezoneReact = () =>
  `<ComboboxRoot a11yLabel="Timezone">
  <ComboboxInput placeholder="Select a timezone..." />
  <ComboboxTrigger>▾</ComboboxTrigger>
  <ComboboxContent>
    <ComboboxItem value="america-new-york" textValue="(GMT-5) New York" keywords="americas us nyc est">(GMT-5) New York</ComboboxItem>
    <ComboboxItem value="europe-london" textValue="(GMT+0) London" keywords="europe uk utc">(GMT+0) London</ComboboxItem>
    <ComboboxItem value="asia-shanghai" textValue="(GMT+8) Shanghai" keywords="asia china cst">(GMT+8) Shanghai</ComboboxItem>
    <ComboboxItem value="asia-tokyo" textValue="(GMT+9) Tokyo" keywords="asia japan jst">(GMT+9) Tokyo</ComboboxItem>
    <ComboboxEmpty>No timezones found.</ComboboxEmpty>
  </ComboboxContent>
</ComboboxRoot>`;

const makeTimezoneVue = () =>
  `<template>
  <ComboboxRoot a11y-label="Timezone">
    <ComboboxInput placeholder="Select a timezone..." />
    <ComboboxTrigger>▾</ComboboxTrigger>
    <ComboboxContent>
      <ComboboxItem value="america-new-york" text-value="(GMT-5) New York" keywords="americas us nyc est">(GMT-5) New York</ComboboxItem>
      <ComboboxItem value="europe-london" text-value="(GMT+0) London" keywords="europe uk utc">(GMT+0) London</ComboboxItem>
      <ComboboxItem value="asia-shanghai" text-value="(GMT+8) Shanghai" keywords="asia china cst">(GMT+8) Shanghai</ComboboxItem>
      <ComboboxItem value="asia-tokyo" text-value="(GMT+9) Tokyo" keywords="asia japan jst">(GMT+9) Tokyo</ComboboxItem>
      <ComboboxEmpty>No timezones found.</ComboboxEmpty>
    </ComboboxContent>
  </ComboboxRoot>
</template>`;

const makeDisabledWc = (prefix: string) =>
  `<${prefix}-combobox-root disabled a11y-label="Disabled framework picker">
  <${prefix}-combobox-input placeholder="Disabled combobox..."></${prefix}-combobox-input>
  <${prefix}-combobox-trigger>▾</${prefix}-combobox-trigger>
  <${prefix}-combobox-content>
    <${prefix}-combobox-item value="next.js" text-value="Next.js">Next.js</${prefix}-combobox-item>
    <${prefix}-combobox-empty>No frameworks found.</${prefix}-combobox-empty>
  </${prefix}-combobox-content>
</${prefix}-combobox-root>

<${prefix}-combobox-root read-only default-value="astro" a11y-label="Read-only framework picker">
  <${prefix}-combobox-input placeholder="Read-only combobox..."></${prefix}-combobox-input>
  <${prefix}-combobox-trigger>▾</${prefix}-combobox-trigger>
  <${prefix}-combobox-content>
    <${prefix}-combobox-item value="astro" text-value="Astro">Astro</${prefix}-combobox-item>
    <${prefix}-combobox-empty>No frameworks found.</${prefix}-combobox-empty>
  </${prefix}-combobox-content>
</${prefix}-combobox-root>`;

const makeDisabledReact = () =>
  `<ComboboxRoot disabled a11yLabel="Disabled framework picker">
  <ComboboxInput placeholder="Disabled combobox..." />
  <ComboboxTrigger>▾</ComboboxTrigger>
  <ComboboxContent>
    <ComboboxItem value="next.js" textValue="Next.js">Next.js</ComboboxItem>
    <ComboboxEmpty>No frameworks found.</ComboboxEmpty>
  </ComboboxContent>
</ComboboxRoot>

<ComboboxRoot readOnly defaultValue="astro" a11yLabel="Read-only framework picker">
  <ComboboxInput placeholder="Read-only combobox..." />
  <ComboboxTrigger>▾</ComboboxTrigger>
  <ComboboxContent>
    <ComboboxItem value="astro" textValue="Astro">Astro</ComboboxItem>
    <ComboboxEmpty>No frameworks found.</ComboboxEmpty>
  </ComboboxContent>
</ComboboxRoot>`;

const makeDisabledVue = () =>
  `<template>
  <ComboboxRoot disabled a11y-label="Disabled framework picker">
    <ComboboxInput placeholder="Disabled combobox..." />
    <ComboboxTrigger>▾</ComboboxTrigger>
    <ComboboxContent>
      <ComboboxItem value="next.js" text-value="Next.js">Next.js</ComboboxItem>
      <ComboboxEmpty>No frameworks found.</ComboboxEmpty>
    </ComboboxContent>
  </ComboboxRoot>

  <ComboboxRoot read-only default-value="astro" a11y-label="Read-only framework picker">
    <ComboboxInput placeholder="Read-only combobox..." />
    <ComboboxTrigger>▾</ComboboxTrigger>
    <ComboboxContent>
      <ComboboxItem value="astro" text-value="Astro">Astro</ComboboxItem>
      <ComboboxEmpty>No frameworks found.</ComboboxEmpty>
    </ComboboxContent>
  </ComboboxRoot>
</template>`;

const brutalistUsersWc = `<brutalist-combobox-root default-value="shadcn" a11y-label="Assignee">
  <brutalist-combobox-input placeholder="Select user..."></brutalist-combobox-input>
  <brutalist-combobox-trigger>▾</brutalist-combobox-trigger>
  <brutalist-combobox-content>
    <brutalist-combobox-item value="shadcn" text-value="shadcn" keywords="design systems ui">shadcn</brutalist-combobox-item>
    <brutalist-combobox-item value="leerob" text-value="leerob" keywords="devrel nextjs">leerob</brutalist-combobox-item>
    <brutalist-combobox-item value="evilrabbit" text-value="evilrabbit" keywords="design brand">evilrabbit</brutalist-combobox-item>
    <brutalist-combobox-item value="maxleiter" text-value="maxleiter" keywords="engineering">maxleiter</brutalist-combobox-item>
    <brutalist-combobox-empty>No user found.</brutalist-combobox-empty>
  </brutalist-combobox-content>
</brutalist-combobox-root>`;

const brutalistUsersReact = `<ComboboxRoot defaultValue="shadcn" a11yLabel="Assignee">
  <ComboboxInput placeholder="Select user..." />
  <ComboboxTrigger>▾</ComboboxTrigger>
  <ComboboxContent>
    <ComboboxItem value="shadcn" textValue="shadcn" keywords="design systems ui">shadcn</ComboboxItem>
    <ComboboxItem value="leerob" textValue="leerob" keywords="devrel nextjs">leerob</ComboboxItem>
    <ComboboxItem value="evilrabbit" textValue="evilrabbit" keywords="design brand">evilrabbit</ComboboxItem>
    <ComboboxItem value="maxleiter" textValue="maxleiter" keywords="engineering">maxleiter</ComboboxItem>
    <ComboboxEmpty>No user found.</ComboboxEmpty>
  </ComboboxContent>
</ComboboxRoot>`;

const brutalistUsersVue = `<template>
  <ComboboxRoot default-value="shadcn" a11y-label="Assignee">
    <ComboboxInput placeholder="Select user..." />
    <ComboboxTrigger>▾</ComboboxTrigger>
    <ComboboxContent>
      <ComboboxItem value="shadcn" text-value="shadcn" keywords="design systems ui">shadcn</ComboboxItem>
      <ComboboxItem value="leerob" text-value="leerob" keywords="devrel nextjs">leerob</ComboboxItem>
      <ComboboxItem value="evilrabbit" text-value="evilrabbit" keywords="design brand">evilrabbit</ComboboxItem>
      <ComboboxItem value="maxleiter" text-value="maxleiter" keywords="engineering">maxleiter</ComboboxItem>
      <ComboboxEmpty>No user found.</ComboboxEmpty>
    </ComboboxContent>
  </ComboboxRoot>
</template>`;

const controlledWc = `<shadcn-combobox-root id="controlled-combobox" value="next.js" input-value="Next.js" a11y-label="Framework">
  <shadcn-combobox-input placeholder="Select a framework..."></shadcn-combobox-input>
  <shadcn-combobox-trigger>▾</shadcn-combobox-trigger>
  <shadcn-combobox-content>
    <shadcn-combobox-item value="next.js" text-value="Next.js">Next.js</shadcn-combobox-item>
    <shadcn-combobox-item value="sveltekit" text-value="SvelteKit">SvelteKit</shadcn-combobox-item>
    <shadcn-combobox-item value="nuxt.js" text-value="Nuxt.js">Nuxt.js</shadcn-combobox-item>
    <shadcn-combobox-item value="astro" text-value="Astro">Astro</shadcn-combobox-item>
    <shadcn-combobox-empty>No frameworks found.</shadcn-combobox-empty>
  </shadcn-combobox-content>
</shadcn-combobox-root>`;

const controlledReact = `const [value, setValue] = useState('next.js');
const [inputValue, setInputValue] = useState('Next.js');
const [open, setOpen] = useState(false);

<ComboboxRoot
  value={value}
  inputValue={inputValue}
  open={open}
  onValueChange={(e) => {
    setValue(e.value);
    setInputValue(e.textValue);
  }}
  onInputValueChange={(e) => setInputValue(e.value)}
  onOpenChange={(e) => setOpen(e.open)}
>
  <ComboboxInput placeholder="Select a framework..." />
  <ComboboxTrigger>▾</ComboboxTrigger>
  <ComboboxContent>
    <ComboboxItem value="next.js" textValue="Next.js">Next.js</ComboboxItem>
    <ComboboxItem value="sveltekit" textValue="SvelteKit">SvelteKit</ComboboxItem>
    <ComboboxItem value="nuxt.js" textValue="Nuxt.js">Nuxt.js</ComboboxItem>
    <ComboboxItem value="astro" textValue="Astro">Astro</ComboboxItem>
    <ComboboxEmpty>No frameworks found.</ComboboxEmpty>
  </ComboboxContent>
</ComboboxRoot>`;

const controlledVue = `<template>
  <ComboboxRoot
    :value="value"
    :input-value="inputValue"
    :open="open"
    @value-change="({ value: v, textValue }) => { value = v; inputValue = textValue; }"
    @input-value-change="({ value: q }) => { inputValue = q; }"
    @open-change="({ open: next }) => { open = next; }"
  >
    <ComboboxInput placeholder="Select a framework..." />
    <ComboboxTrigger>▾</ComboboxTrigger>
    <ComboboxContent>
      <ComboboxItem value="next.js" text-value="Next.js">Next.js</ComboboxItem>
      <ComboboxItem value="sveltekit" text-value="SvelteKit">SvelteKit</ComboboxItem>
      <ComboboxItem value="nuxt.js" text-value="Nuxt.js">Nuxt.js</ComboboxItem>
      <ComboboxItem value="astro" text-value="Astro">Astro</ComboboxItem>
      <ComboboxEmpty>No frameworks found.</ComboboxEmpty>
    </ComboboxContent>
  </ComboboxRoot>
</template>`;

export const codeMap = {
  wc: {
    'demo-shadcn-combobox': makeFrameworkWc('shadcn'),
    'demo-shadcn-combobox-keywords': makeTimezoneWc('shadcn'),
    'demo-shadcn-combobox-invalid': makeFrameworkWc('shadcn', ' invalid'),
    'demo-shadcn-combobox-disabled': makeDisabledWc('shadcn'),
    'demo-shadcn-combobox-controlled': controlledWc,
    'demo-brutalist-combobox': makeFrameworkWc('brutalist'),
    'demo-brutalist-combobox-users': brutalistUsersWc,
    'demo-brutalist-combobox-timezones': makeTimezoneWc('brutalist'),
    'demo-brutalist-combobox-disabled': makeDisabledWc('brutalist'),
    'demo-bootstrap-2-3-2-combobox': makeFrameworkWc('bootstrap-2-3-2'),
    'demo-bootstrap-2-3-2-combobox-timezones': makeTimezoneWc('bootstrap-2-3-2'),
    'demo-bootstrap-2-3-2-combobox-disabled': makeDisabledWc('bootstrap-2-3-2'),
    'demo-liquid-glass-combobox': makeFrameworkWc('liquid-glass'),
    'demo-liquid-glass-combobox-prominence':
      makeFrameworkWc('liquid-glass', '', ' prominence="prominent"') +
      '\n\n' +
      makeFrameworkWc('liquid-glass', '', '', ' material="opaque"'),
    'demo-liquid-glass-combobox-timezones': makeTimezoneWc('liquid-glass'),
    'demo-liquid-glass-combobox-disabled': makeDisabledWc('liquid-glass'),
  },
  react: {
    'demo-shadcn-combobox': makeFrameworkReact(),
    'demo-shadcn-combobox-keywords': makeTimezoneReact(),
    'demo-shadcn-combobox-invalid': makeFrameworkReact(' invalid'),
    'demo-shadcn-combobox-disabled': makeDisabledReact(),
    'demo-shadcn-combobox-controlled': controlledReact,
    'demo-brutalist-combobox': makeFrameworkReact(),
    'demo-brutalist-combobox-users': brutalistUsersReact,
    'demo-brutalist-combobox-timezones': makeTimezoneReact(),
    'demo-brutalist-combobox-disabled': makeDisabledReact(),
    'demo-bootstrap-2-3-2-combobox': makeFrameworkReact(),
    'demo-bootstrap-2-3-2-combobox-timezones': makeTimezoneReact(),
    'demo-bootstrap-2-3-2-combobox-disabled': makeDisabledReact(),
    'demo-liquid-glass-combobox': makeFrameworkReact(),
    'demo-liquid-glass-combobox-prominence':
      makeFrameworkReact('', ' prominence="prominent"') +
      '\n\n' +
      makeFrameworkReact('', '', ' material="opaque"'),
    'demo-liquid-glass-combobox-timezones': makeTimezoneReact(),
    'demo-liquid-glass-combobox-disabled': makeDisabledReact(),
  },
  vue: {
    'demo-shadcn-combobox': makeFrameworkVue(),
    'demo-shadcn-combobox-keywords': makeTimezoneVue(),
    'demo-shadcn-combobox-invalid': makeFrameworkVue(' invalid'),
    'demo-shadcn-combobox-disabled': makeDisabledVue(),
    'demo-shadcn-combobox-controlled': controlledVue,
    'demo-brutalist-combobox': makeFrameworkVue(),
    'demo-brutalist-combobox-users': brutalistUsersVue,
    'demo-brutalist-combobox-timezones': makeTimezoneVue(),
    'demo-brutalist-combobox-disabled': makeDisabledVue(),
    'demo-bootstrap-2-3-2-combobox': makeFrameworkVue(),
    'demo-bootstrap-2-3-2-combobox-timezones': makeTimezoneVue(),
    'demo-bootstrap-2-3-2-combobox-disabled': makeDisabledVue(),
    'demo-liquid-glass-combobox': makeFrameworkVue(),
    'demo-liquid-glass-combobox-prominence':
      makeFrameworkVue('', ' prominence="prominent"') +
      '\n\n' +
      makeFrameworkVue('', '', ' material="opaque"'),
    'demo-liquid-glass-combobox-timezones': makeTimezoneVue(),
    'demo-liquid-glass-combobox-disabled': makeDisabledVue(),
  },
  vue2: {
    'demo-shadcn-combobox': makeFrameworkVue(),
    'demo-shadcn-combobox-keywords': makeTimezoneVue(),
    'demo-shadcn-combobox-invalid': makeFrameworkVue(' invalid'),
    'demo-shadcn-combobox-disabled': makeDisabledVue(),
    'demo-shadcn-combobox-controlled': controlledVue,
    'demo-brutalist-combobox': makeFrameworkVue(),
    'demo-brutalist-combobox-users': brutalistUsersVue,
    'demo-brutalist-combobox-timezones': makeTimezoneVue(),
    'demo-brutalist-combobox-disabled': makeDisabledVue(),
    'demo-bootstrap-2-3-2-combobox': makeFrameworkVue(),
    'demo-bootstrap-2-3-2-combobox-timezones': makeTimezoneVue(),
    'demo-bootstrap-2-3-2-combobox-disabled': makeDisabledVue(),
    'demo-liquid-glass-combobox': makeFrameworkVue(),
    'demo-liquid-glass-combobox-prominence':
      makeFrameworkVue('', ' prominence="prominent"') +
      '\n\n' +
      makeFrameworkVue('', '', ' material="opaque"'),
    'demo-liquid-glass-combobox-timezones': makeTimezoneVue(),
    'demo-liquid-glass-combobox-disabled': makeDisabledVue(),
  },
} as const;
