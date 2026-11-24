import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

interface FamilyMeta {
  tagPrefix: string;
  componentPrefix: string;
  wcAttr?: string;
  jsxAttr?: string;
}

const FAMILIES = {
  shadcn: {
    tagPrefix: 'wc-shadcn',
    componentPrefix: 'Shadcn',
    wcAttr: ' style-profile="rhea"',
    jsxAttr: ' styleProfile="rhea"',
  },
  brutalist: {
    tagPrefix: 'wc-brutalist',
    componentPrefix: 'Brutalist',
  },
  'bootstrap-2-3-2': {
    tagPrefix: 'wc-bootstrap-2-3-2',
    componentPrefix: 'Bootstrap232',
  },
  'liquid-glass': {
    tagPrefix: 'wc-liquid-glass',
    componentPrefix: 'LiquidGlass',
  },
} as const satisfies Record<string, FamilyMeta>;

function heroSnippets(m: FamilyMeta) {
  const wcA = m.wcAttr ?? '';
  const jsxA = m.jsxAttr ?? '';
  const P = m.componentPrefix;
  const t = m.tagPrefix;
  return {
    wc: formatCode(`
<div class="w-[60%]">
  <${t}-progress-root${wcA} id="hero-progress" aria-label="Task progress" value="13" value-text="13%">
    <${t}-progress-track${wcA}>
      <${t}-progress-indicator${wcA}></${t}-progress-indicator>
    </${t}-progress-track>
  </${t}-progress-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const el = document.querySelector('#hero-progress');
  setTimeout(() => {
    if (el instanceof HTMLElement) setElementProps(el, { value: 66, valueText: '66%' });
  }, 500);
</script>
    `),
    react: formatCode(`
import { useEffect, useState } from 'react';
import {
  ${P}ProgressIndicator,
  ${P}ProgressRoot,
  ${P}ProgressTrack,
} from '../proto-ui/components/react';

export function ProgressDemo() {
  const [value, setValue] = useState(13);

  useEffect(() => {
    const timer = setTimeout(() => setValue(66), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="w-[60%]">
      <${P}ProgressRoot${jsxA} value={value} valueText={\`\${value}%\`} ariaLabel="Task progress">
        <${P}ProgressTrack${jsxA}>
          <${P}ProgressIndicator${jsxA} />
        </${P}ProgressTrack>
      </${P}ProgressRoot>
    </div>
  );
}
    `),
    vue: formatCode(`
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import {
  ${P}ProgressIndicator,
  ${P}ProgressRoot,
  ${P}ProgressTrack,
} from '../proto-ui/components/vue';

const value = ref(13);
let timer: ReturnType<typeof setTimeout> | undefined;

onMounted(() => {
  timer = setTimeout(() => {
    value.value = 66;
  }, 500);
});

onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div class="w-[60%]">
    <${P}ProgressRoot${jsxA} :value="value" :valueText="\`\${value}%\`" ariaLabel="Task progress">
      <${P}ProgressTrack${jsxA}>
        <${P}ProgressIndicator${jsxA} />
      </${P}ProgressTrack>
    </${P}ProgressRoot>
  </div>
</template>
    `),
    vue2: formatCode(`
<template>
  <div class="w-[60%]">
    <${P}ProgressRoot${jsxA} :value="value" :valueText="value + '%'" ariaLabel="Task progress">
      <${P}ProgressTrack${jsxA}>
        <${P}ProgressIndicator${jsxA} />
      </${P}ProgressTrack>
    </${P}ProgressRoot>
  </div>
</template>

<script>
import {
  ${P}ProgressIndicator,
  ${P}ProgressRoot,
  ${P}ProgressTrack,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${P}ProgressIndicator,
    ${P}ProgressRoot,
    ${P}ProgressTrack,
  },
  data() {
    return { value: 13, timer: null };
  },
  mounted() {
    this.timer = setTimeout(() => {
      this.value = 66;
    }, 500);
  },
  beforeDestroy() {
    clearTimeout(this.timer);
  },
};
</script>
    `),
  };
}

function labelSnippets(m: FamilyMeta) {
  const wcA = m.wcAttr ?? '';
  const jsxA = m.jsxAttr ?? '';
  const P = m.componentPrefix;
  const t = m.tagPrefix;
  return {
    wc: formatCode(`
<${t}-progress-root${wcA} class="w-full max-w-sm" value="56" value-text="56%">
  <${t}-progress-label${wcA}>Upload progress</${t}-progress-label>
  <${t}-progress-value${wcA}></${t}-progress-value>
  <${t}-progress-track${wcA}>
    <${t}-progress-indicator${wcA}></${t}-progress-indicator>
  </${t}-progress-track>
</${t}-progress-root>
    `),
    react: formatCode(`
import {
  ${P}ProgressIndicator,
  ${P}ProgressLabel,
  ${P}ProgressRoot,
  ${P}ProgressTrack,
  ${P}ProgressValue,
} from '../proto-ui/components/react';

export function ProgressWithLabel() {
  return (
    <${P}ProgressRoot${jsxA} value={56} valueText="56%" className="w-full max-w-sm">
      <${P}ProgressLabel${jsxA}>Upload progress</${P}ProgressLabel>
      <${P}ProgressValue${jsxA} />
      <${P}ProgressTrack${jsxA}>
        <${P}ProgressIndicator${jsxA} />
      </${P}ProgressTrack>
    </${P}ProgressRoot>
  );
}
    `),
    vue: formatCode(`
<script setup lang="ts">
import {
  ${P}ProgressIndicator,
  ${P}ProgressLabel,
  ${P}ProgressRoot,
  ${P}ProgressTrack,
  ${P}ProgressValue,
} from '../proto-ui/components/vue';
</script>

<template>
  <${P}ProgressRoot${jsxA} :value="56" valueText="56%" class="w-full max-w-sm">
    <${P}ProgressLabel${jsxA}>Upload progress</${P}ProgressLabel>
    <${P}ProgressValue${jsxA} />
    <${P}ProgressTrack${jsxA}>
      <${P}ProgressIndicator${jsxA} />
    </${P}ProgressTrack>
  </${P}ProgressRoot>
</template>
    `),
    vue2: formatCode(`
<template>
  <${P}ProgressRoot${jsxA} :value="56" valueText="56%" class="w-full max-w-sm">
    <${P}ProgressLabel${jsxA}>Upload progress</${P}ProgressLabel>
    <${P}ProgressValue${jsxA} />
    <${P}ProgressTrack${jsxA}>
      <${P}ProgressIndicator${jsxA} />
    </${P}ProgressTrack>
  </${P}ProgressRoot>
</template>

<script>
import {
  ${P}ProgressIndicator,
  ${P}ProgressLabel,
  ${P}ProgressRoot,
  ${P}ProgressTrack,
  ${P}ProgressValue,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${P}ProgressIndicator,
    ${P}ProgressLabel,
    ${P}ProgressRoot,
    ${P}ProgressTrack,
    ${P}ProgressValue,
  },
};
</script>
    `),
  };
}

function controlledSnippets(m: FamilyMeta) {
  const wcA = m.wcAttr ?? '';
  const jsxA = m.jsxAttr ?? '';
  const P = m.componentPrefix;
  const t = m.tagPrefix;
  return {
    wc: formatCode(`
<div class="flex w-full max-w-sm flex-col gap-4">
  <${t}-progress-root${wcA} id="controlled-progress" value="50" value-text="50%">
    <${t}-progress-label${wcA}>Completion</${t}-progress-label>
    <${t}-progress-value${wcA}></${t}-progress-value>
    <${t}-progress-track${wcA}>
      <${t}-progress-indicator${wcA}></${t}-progress-indicator>
    </${t}-progress-track>
  </${t}-progress-root>
  <${t}-slider-root${wcA} id="controlled-slider" value="50" min="0" max="100" step="1" aria-label="Progress value">
    <${t}-slider-track${wcA}>
      <${t}-slider-indicator${wcA}></${t}-slider-indicator>
      <${t}-slider-thumb${wcA}></${t}-slider-thumb>
    </${t}-slider-track>
  </${t}-slider-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const progress = document.querySelector('#controlled-progress');
  const slider = document.querySelector('#controlled-slider');
  if (progress instanceof HTMLElement && slider instanceof HTMLElement) {
    slider.addEventListener('valueChange', (event) => {
      const next = Math.round(event.detail.value);
      setElementProps(slider, { value: next });
      setElementProps(progress, { value: next, valueText: \`\${next}%\` });
    });
  }
</script>
    `),
    react: formatCode(`
import { useState } from 'react';
import {
  ${P}ProgressIndicator,
  ${P}ProgressLabel,
  ${P}ProgressRoot,
  ${P}ProgressTrack,
  ${P}ProgressValue,
  ${P}SliderIndicator,
  ${P}SliderRoot,
  ${P}SliderThumb,
  ${P}SliderTrack,
} from '../proto-ui/components/react';

export function ProgressControlled() {
  const [value, setValue] = useState(50);

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <${P}ProgressRoot${jsxA} value={value} valueText={\`\${value}%\`}>
        <${P}ProgressLabel${jsxA}>Completion</${P}ProgressLabel>
        <${P}ProgressValue${jsxA} />
        <${P}ProgressTrack${jsxA}>
          <${P}ProgressIndicator${jsxA} />
        </${P}ProgressTrack>
      </${P}ProgressRoot>
      <${P}SliderRoot${jsxA}
        value={value}
        min={0}
        max={100}
        step={1}
        ariaLabel="Progress value"
        onValueChange={(e) => setValue(Math.round(e.value))}
      >
        <${P}SliderTrack${jsxA}>
          <${P}SliderIndicator${jsxA} />
          <${P}SliderThumb${jsxA} />
        </${P}SliderTrack>
      </${P}SliderRoot>
    </div>
  );
}
    `),
    vue: formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  ${P}ProgressIndicator,
  ${P}ProgressLabel,
  ${P}ProgressRoot,
  ${P}ProgressTrack,
  ${P}ProgressValue,
  ${P}SliderIndicator,
  ${P}SliderRoot,
  ${P}SliderThumb,
  ${P}SliderTrack,
} from '../proto-ui/components/vue';

const value = ref(50);
</script>

<template>
  <div class="flex w-full max-w-sm flex-col gap-4">
    <${P}ProgressRoot${jsxA} :value="value" :valueText="\`\${value}%\`">
      <${P}ProgressLabel${jsxA}>Completion</${P}ProgressLabel>
      <${P}ProgressValue${jsxA} />
      <${P}ProgressTrack${jsxA}>
        <${P}ProgressIndicator${jsxA} />
      </${P}ProgressTrack>
    </${P}ProgressRoot>
    <${P}SliderRoot${jsxA}
      :value="value"
      :min="0"
      :max="100"
      :step="1"
      ariaLabel="Progress value"
      @valueChange="(e) => (value = Math.round(e.value))"
    >
      <${P}SliderTrack${jsxA}>
        <${P}SliderIndicator${jsxA} />
        <${P}SliderThumb${jsxA} />
      </${P}SliderTrack>
    </${P}SliderRoot>
  </div>
</template>
    `),
    vue2: formatCode(`
<template>
  <div class="flex w-full max-w-sm flex-col gap-4">
    <${P}ProgressRoot${jsxA} :value="value" :valueText="value + '%'">
      <${P}ProgressLabel${jsxA}>Completion</${P}ProgressLabel>
      <${P}ProgressValue${jsxA} />
      <${P}ProgressTrack${jsxA}>
        <${P}ProgressIndicator${jsxA} />
      </${P}ProgressTrack>
    </${P}ProgressRoot>
    <${P}SliderRoot${jsxA}
      :value="value"
      :min="0"
      :max="100"
      :step="1"
      ariaLabel="Progress value"
      @valueChange="onChange"
    >
      <${P}SliderTrack${jsxA}>
        <${P}SliderIndicator${jsxA} />
        <${P}SliderThumb${jsxA} />
      </${P}SliderTrack>
    </${P}SliderRoot>
  </div>
</template>

<script>
import {
  ${P}ProgressIndicator,
  ${P}ProgressLabel,
  ${P}ProgressRoot,
  ${P}ProgressTrack,
  ${P}ProgressValue,
  ${P}SliderIndicator,
  ${P}SliderRoot,
  ${P}SliderThumb,
  ${P}SliderTrack,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${P}ProgressIndicator,
    ${P}ProgressLabel,
    ${P}ProgressRoot,
    ${P}ProgressTrack,
    ${P}ProgressValue,
    ${P}SliderIndicator,
    ${P}SliderRoot,
    ${P}SliderThumb,
    ${P}SliderTrack,
  },
  data() {
    return { value: 50 };
  },
  methods: {
    onChange(event) {
      this.value = Math.round(event.value);
    },
  },
};
</script>
    `),
  };
}

function indeterminateSnippets(m: FamilyMeta, label: string) {
  const wcA = m.wcAttr ?? '';
  const jsxA = m.jsxAttr ?? '';
  const P = m.componentPrefix;
  const t = m.tagPrefix;
  return {
    wc: formatCode(`
<${t}-progress-root${wcA} class="w-full max-w-sm" indeterminate>
  <${t}-progress-label${wcA}>${label}</${t}-progress-label>
  <${t}-progress-value${wcA}></${t}-progress-value>
  <${t}-progress-track${wcA}>
    <${t}-progress-indicator${wcA}></${t}-progress-indicator>
  </${t}-progress-track>
</${t}-progress-root>
    `),
    react: formatCode(`
import {
  ${P}ProgressIndicator,
  ${P}ProgressLabel,
  ${P}ProgressRoot,
  ${P}ProgressTrack,
  ${P}ProgressValue,
} from '../proto-ui/components/react';

export function ProgressIndeterminate() {
  return (
    <${P}ProgressRoot${jsxA} indeterminate className="w-full max-w-sm">
      <${P}ProgressLabel${jsxA}>${label}</${P}ProgressLabel>
      <${P}ProgressValue${jsxA} />
      <${P}ProgressTrack${jsxA}>
        <${P}ProgressIndicator${jsxA} />
      </${P}ProgressTrack>
    </${P}ProgressRoot>
  );
}
    `),
    vue: formatCode(`
<script setup lang="ts">
import {
  ${P}ProgressIndicator,
  ${P}ProgressLabel,
  ${P}ProgressRoot,
  ${P}ProgressTrack,
  ${P}ProgressValue,
} from '../proto-ui/components/vue';
</script>

<template>
  <${P}ProgressRoot${jsxA} :indeterminate="true" class="w-full max-w-sm">
    <${P}ProgressLabel${jsxA}>${label}</${P}ProgressLabel>
    <${P}ProgressValue${jsxA} />
    <${P}ProgressTrack${jsxA}>
      <${P}ProgressIndicator${jsxA} />
    </${P}ProgressTrack>
  </${P}ProgressRoot>
</template>
    `),
    vue2: formatCode(`
<template>
  <${P}ProgressRoot${jsxA} :indeterminate="true" class="w-full max-w-sm">
    <${P}ProgressLabel${jsxA}>${label}</${P}ProgressLabel>
    <${P}ProgressValue${jsxA} />
    <${P}ProgressTrack${jsxA}>
      <${P}ProgressIndicator${jsxA} />
    </${P}ProgressTrack>
  </${P}ProgressRoot>
</template>

<script>
import {
  ${P}ProgressIndicator,
  ${P}ProgressLabel,
  ${P}ProgressRoot,
  ${P}ProgressTrack,
  ${P}ProgressValue,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${P}ProgressIndicator,
    ${P}ProgressLabel,
    ${P}ProgressRoot,
    ${P}ProgressTrack,
    ${P}ProgressValue,
  },
};
</script>
    `),
  };
}

const shadcnHero = heroSnippets(FAMILIES.shadcn);
const shadcnLabel = labelSnippets(FAMILIES.shadcn);
const shadcnControlled = controlledSnippets(FAMILIES.shadcn);
const shadcnIndeterminate = indeterminateSnippets(FAMILIES.shadcn, 'Syncing workspace…');

const brutalistHero = heroSnippets(FAMILIES.brutalist);
const brutalistLabel = labelSnippets(FAMILIES.brutalist);
const brutalistControlled = controlledSnippets(FAMILIES.brutalist);
const brutalistIndeterminate = indeterminateSnippets(FAMILIES.brutalist, 'Building assets…');

const bootstrapHero = heroSnippets(FAMILIES['bootstrap-2-3-2']);
const bootstrapLabel = labelSnippets(FAMILIES['bootstrap-2-3-2']);
const bootstrapControlled = controlledSnippets(FAMILIES['bootstrap-2-3-2']);
const bootstrapIndeterminate = indeterminateSnippets(
  FAMILIES['bootstrap-2-3-2'],
  'Loading package…'
);

const liquidHero = heroSnippets(FAMILIES['liquid-glass']);
const liquidLabel = labelSnippets(FAMILIES['liquid-glass']);
const liquidControlled = controlledSnippets(FAMILIES['liquid-glass']);
const liquidIndeterminate = indeterminateSnippets(FAMILIES['liquid-glass'], 'Preparing backup…');

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-progress': shadcnHero.wc,
    'demo-shadcn-progress-label': shadcnLabel.wc,
    'demo-shadcn-progress-controlled': shadcnControlled.wc,
    'demo-shadcn-progress-indeterminate': shadcnIndeterminate.wc,
    'demo-shadcn-progress-rtl': formatCode(`
<wc-shadcn-progress-root style-profile="rhea" dir="rtl" value="56" value-text="٥٦٪" class="w-full max-w-sm">
  <wc-shadcn-progress-label style-profile="rhea">تقدم الرفع</wc-shadcn-progress-label>
  <wc-shadcn-progress-value style-profile="rhea"></wc-shadcn-progress-value>
  <wc-shadcn-progress-track style-profile="rhea">
    <wc-shadcn-progress-indicator style-profile="rhea"></wc-shadcn-progress-indicator>
  </wc-shadcn-progress-track>
</wc-shadcn-progress-root>
    `),
    'demo-brutalist-progress': brutalistHero.wc,
    'demo-brutalist-progress-label': brutalistLabel.wc,
    'demo-brutalist-progress-controlled': brutalistControlled.wc,
    'demo-brutalist-progress-indeterminate': brutalistIndeterminate.wc,
    'demo-bootstrap-2-3-2-progress': bootstrapHero.wc,
    'demo-bootstrap-2-3-2-progress-variants': formatCode(`
<div class="w-full max-w-md">
  <wc-bootstrap-2-3-2-progress-root variant="default" value="40" value-text="40%">
    <wc-bootstrap-2-3-2-progress-label>Default</wc-bootstrap-2-3-2-progress-label>
    <wc-bootstrap-2-3-2-progress-value></wc-bootstrap-2-3-2-progress-value>
    <wc-bootstrap-2-3-2-progress-track><wc-bootstrap-2-3-2-progress-indicator></wc-bootstrap-2-3-2-progress-indicator></wc-bootstrap-2-3-2-progress-track>
  </wc-bootstrap-2-3-2-progress-root>
  <wc-bootstrap-2-3-2-progress-root variant="info" value="20" value-text="20%">
    <wc-bootstrap-2-3-2-progress-label>Info</wc-bootstrap-2-3-2-progress-label>
    <wc-bootstrap-2-3-2-progress-value></wc-bootstrap-2-3-2-progress-value>
    <wc-bootstrap-2-3-2-progress-track><wc-bootstrap-2-3-2-progress-indicator></wc-bootstrap-2-3-2-progress-indicator></wc-bootstrap-2-3-2-progress-track>
  </wc-bootstrap-2-3-2-progress-root>
  <wc-bootstrap-2-3-2-progress-root variant="success" value="60" value-text="60%">
    <wc-bootstrap-2-3-2-progress-label>Success</wc-bootstrap-2-3-2-progress-label>
    <wc-bootstrap-2-3-2-progress-value></wc-bootstrap-2-3-2-progress-value>
    <wc-bootstrap-2-3-2-progress-track><wc-bootstrap-2-3-2-progress-indicator></wc-bootstrap-2-3-2-progress-indicator></wc-bootstrap-2-3-2-progress-track>
  </wc-bootstrap-2-3-2-progress-root>
  <wc-bootstrap-2-3-2-progress-root variant="warning" value="80" value-text="80%">
    <wc-bootstrap-2-3-2-progress-label>Warning</wc-bootstrap-2-3-2-progress-label>
    <wc-bootstrap-2-3-2-progress-value></wc-bootstrap-2-3-2-progress-value>
    <wc-bootstrap-2-3-2-progress-track><wc-bootstrap-2-3-2-progress-indicator></wc-bootstrap-2-3-2-progress-indicator></wc-bootstrap-2-3-2-progress-track>
  </wc-bootstrap-2-3-2-progress-root>
  <wc-bootstrap-2-3-2-progress-root variant="danger" value="90" value-text="90%">
    <wc-bootstrap-2-3-2-progress-label>Danger</wc-bootstrap-2-3-2-progress-label>
    <wc-bootstrap-2-3-2-progress-value></wc-bootstrap-2-3-2-progress-value>
    <wc-bootstrap-2-3-2-progress-track><wc-bootstrap-2-3-2-progress-indicator></wc-bootstrap-2-3-2-progress-indicator></wc-bootstrap-2-3-2-progress-track>
  </wc-bootstrap-2-3-2-progress-root>
</div>
    `),
    'demo-bootstrap-2-3-2-progress-label': bootstrapLabel.wc,
    'demo-bootstrap-2-3-2-progress-controlled': bootstrapControlled.wc,
    'demo-bootstrap-2-3-2-progress-indeterminate': bootstrapIndeterminate.wc,
    'demo-liquid-glass-progress': liquidHero.wc,
    'demo-liquid-glass-progress-label': liquidLabel.wc,
    'demo-liquid-glass-progress-prominence': formatCode(`
<div class="flex w-full max-w-md flex-col gap-5">
  <wc-liquid-glass-progress-root prominence="regular" value="56" value-text="56%">
    <wc-liquid-glass-progress-label>Syncing photo library</wc-liquid-glass-progress-label>
    <wc-liquid-glass-progress-value></wc-liquid-glass-progress-value>
    <wc-liquid-glass-progress-track><wc-liquid-glass-progress-indicator></wc-liquid-glass-progress-indicator></wc-liquid-glass-progress-track>
  </wc-liquid-glass-progress-root>
  <wc-liquid-glass-progress-root prominence="prominent" value="74" value-text="74%">
    <wc-liquid-glass-progress-label>Downloading system update</wc-liquid-glass-progress-label>
    <wc-liquid-glass-progress-value></wc-liquid-glass-progress-value>
    <wc-liquid-glass-progress-track><wc-liquid-glass-progress-indicator></wc-liquid-glass-progress-indicator></wc-liquid-glass-progress-track>
  </wc-liquid-glass-progress-root>
  <wc-liquid-glass-progress-root prominence="destructive" value="92" value-text="92%">
    <wc-liquid-glass-progress-label>Cloud storage quota</wc-liquid-glass-progress-label>
    <wc-liquid-glass-progress-value></wc-liquid-glass-progress-value>
    <wc-liquid-glass-progress-track><wc-liquid-glass-progress-indicator></wc-liquid-glass-progress-indicator></wc-liquid-glass-progress-track>
  </wc-liquid-glass-progress-root>
</div>
    `),
    'demo-liquid-glass-progress-controlled': liquidControlled.wc,
    'demo-liquid-glass-progress-indeterminate': liquidIndeterminate.wc,
  },
  react: {
    'demo-shadcn-progress': shadcnHero.react,
    'demo-shadcn-progress-label': shadcnLabel.react,
    'demo-shadcn-progress-controlled': shadcnControlled.react,
    'demo-shadcn-progress-indeterminate': shadcnIndeterminate.react,
    'demo-shadcn-progress-rtl': formatCode(`
import {
  ShadcnProgressIndicator,
  ShadcnProgressLabel,
  ShadcnProgressRoot,
  ShadcnProgressTrack,
  ShadcnProgressValue,
} from '../proto-ui/components/react';

export function ProgressRtl() {
  return (
    <ShadcnProgressRoot styleProfile="rhea" dir="rtl" value={56} valueText="٥٦٪" className="w-full max-w-sm">
      <ShadcnProgressLabel styleProfile="rhea">تقدم الرفع</ShadcnProgressLabel>
      <ShadcnProgressValue styleProfile="rhea" />
      <ShadcnProgressTrack styleProfile="rhea">
        <ShadcnProgressIndicator styleProfile="rhea" />
      </ShadcnProgressTrack>
    </ShadcnProgressRoot>
  );
}
    `),
    'demo-brutalist-progress': brutalistHero.react,
    'demo-brutalist-progress-label': brutalistLabel.react,
    'demo-brutalist-progress-controlled': brutalistControlled.react,
    'demo-brutalist-progress-indeterminate': brutalistIndeterminate.react,
    'demo-bootstrap-2-3-2-progress': bootstrapHero.react,
    'demo-bootstrap-2-3-2-progress-variants': formatCode(`
import {
  Bootstrap232ProgressIndicator,
  Bootstrap232ProgressLabel,
  Bootstrap232ProgressRoot,
  Bootstrap232ProgressTrack,
  Bootstrap232ProgressValue,
} from '../proto-ui/components/react';

const ITEMS = [
  { variant: 'default', label: 'Default', value: 40 },
  { variant: 'info', label: 'Info', value: 20 },
  { variant: 'success', label: 'Success', value: 60 },
  { variant: 'warning', label: 'Warning', value: 80 },
  { variant: 'danger', label: 'Danger', value: 90 },
] as const;

export function BootstrapProgressVariants() {
  return (
    <div className="w-full max-w-md">
      {ITEMS.map((item) => (
        <Bootstrap232ProgressRoot
          key={item.variant}
          variant={item.variant}
          value={item.value}
          valueText={\`\${item.value}%\`}
        >
          <Bootstrap232ProgressLabel>{item.label}</Bootstrap232ProgressLabel>
          <Bootstrap232ProgressValue />
          <Bootstrap232ProgressTrack>
            <Bootstrap232ProgressIndicator />
          </Bootstrap232ProgressTrack>
        </Bootstrap232ProgressRoot>
      ))}
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-progress-label': bootstrapLabel.react,
    'demo-bootstrap-2-3-2-progress-controlled': bootstrapControlled.react,
    'demo-bootstrap-2-3-2-progress-indeterminate': bootstrapIndeterminate.react,
    'demo-liquid-glass-progress': liquidHero.react,
    'demo-liquid-glass-progress-label': liquidLabel.react,
    'demo-liquid-glass-progress-prominence': formatCode(`
import {
  LiquidGlassProgressIndicator,
  LiquidGlassProgressLabel,
  LiquidGlassProgressRoot,
  LiquidGlassProgressTrack,
  LiquidGlassProgressValue,
} from '../proto-ui/components/react';

export function LiquidGlassProgressProminence() {
  return (
    <div className="flex w-full max-w-md flex-col gap-5">
      <LiquidGlassProgressRoot prominence="regular" value={56} valueText="56%">
        <LiquidGlassProgressLabel>Syncing photo library</LiquidGlassProgressLabel>
        <LiquidGlassProgressValue />
        <LiquidGlassProgressTrack>
          <LiquidGlassProgressIndicator />
        </LiquidGlassProgressTrack>
      </LiquidGlassProgressRoot>
      <LiquidGlassProgressRoot prominence="prominent" value={74} valueText="74%">
        <LiquidGlassProgressLabel>Downloading system update</LiquidGlassProgressLabel>
        <LiquidGlassProgressValue />
        <LiquidGlassProgressTrack>
          <LiquidGlassProgressIndicator />
        </LiquidGlassProgressTrack>
      </LiquidGlassProgressRoot>
      <LiquidGlassProgressRoot prominence="destructive" value={92} valueText="92%">
        <LiquidGlassProgressLabel>Cloud storage quota</LiquidGlassProgressLabel>
        <LiquidGlassProgressValue />
        <LiquidGlassProgressTrack>
          <LiquidGlassProgressIndicator />
        </LiquidGlassProgressTrack>
      </LiquidGlassProgressRoot>
    </div>
  );
}
    `),
    'demo-liquid-glass-progress-controlled': liquidControlled.react,
    'demo-liquid-glass-progress-indeterminate': liquidIndeterminate.react,
  },
  vue: {
    'demo-shadcn-progress': shadcnHero.vue,
    'demo-shadcn-progress-label': shadcnLabel.vue,
    'demo-shadcn-progress-controlled': shadcnControlled.vue,
    'demo-shadcn-progress-indeterminate': shadcnIndeterminate.vue,
    'demo-shadcn-progress-rtl': formatCode(`
<script setup lang="ts">
import {
  ShadcnProgressIndicator,
  ShadcnProgressLabel,
  ShadcnProgressRoot,
  ShadcnProgressTrack,
  ShadcnProgressValue,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnProgressRoot styleProfile="rhea" dir="rtl" :value="56" valueText="٥٦٪" class="w-full max-w-sm">
    <ShadcnProgressLabel styleProfile="rhea">تقدم الرفع</ShadcnProgressLabel>
    <ShadcnProgressValue styleProfile="rhea" />
    <ShadcnProgressTrack styleProfile="rhea">
      <ShadcnProgressIndicator styleProfile="rhea" />
    </ShadcnProgressTrack>
  </ShadcnProgressRoot>
</template>
    `),
    'demo-brutalist-progress': brutalistHero.vue,
    'demo-brutalist-progress-label': brutalistLabel.vue,
    'demo-brutalist-progress-controlled': brutalistControlled.vue,
    'demo-brutalist-progress-indeterminate': brutalistIndeterminate.vue,
    'demo-bootstrap-2-3-2-progress': bootstrapHero.vue,
    'demo-bootstrap-2-3-2-progress-variants': formatCode(`
<script setup lang="ts">
import {
  Bootstrap232ProgressIndicator,
  Bootstrap232ProgressLabel,
  Bootstrap232ProgressRoot,
  Bootstrap232ProgressTrack,
  Bootstrap232ProgressValue,
} from '../proto-ui/components/vue';

const items = [
  { variant: 'default', label: 'Default', value: 40 },
  { variant: 'info', label: 'Info', value: 20 },
  { variant: 'success', label: 'Success', value: 60 },
  { variant: 'warning', label: 'Warning', value: 80 },
  { variant: 'danger', label: 'Danger', value: 90 },
] as const;
</script>

<template>
  <div class="w-full max-w-md">
    <Bootstrap232ProgressRoot
      v-for="item in items"
      :key="item.variant"
      :variant="item.variant"
      :value="item.value"
      :valueText="\`\${item.value}%\`"
    >
      <Bootstrap232ProgressLabel>{{ item.label }}</Bootstrap232ProgressLabel>
      <Bootstrap232ProgressValue />
      <Bootstrap232ProgressTrack>
        <Bootstrap232ProgressIndicator />
      </Bootstrap232ProgressTrack>
    </Bootstrap232ProgressRoot>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-progress-label': bootstrapLabel.vue,
    'demo-bootstrap-2-3-2-progress-controlled': bootstrapControlled.vue,
    'demo-bootstrap-2-3-2-progress-indeterminate': bootstrapIndeterminate.vue,
    'demo-liquid-glass-progress': liquidHero.vue,
    'demo-liquid-glass-progress-label': liquidLabel.vue,
    'demo-liquid-glass-progress-prominence': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassProgressIndicator,
  LiquidGlassProgressLabel,
  LiquidGlassProgressRoot,
  LiquidGlassProgressTrack,
  LiquidGlassProgressValue,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex w-full max-w-md flex-col gap-5">
    <LiquidGlassProgressRoot prominence="regular" :value="56" valueText="56%">
      <LiquidGlassProgressLabel>Syncing photo library</LiquidGlassProgressLabel>
      <LiquidGlassProgressValue />
      <LiquidGlassProgressTrack>
        <LiquidGlassProgressIndicator />
      </LiquidGlassProgressTrack>
    </LiquidGlassProgressRoot>
    <LiquidGlassProgressRoot prominence="prominent" :value="74" valueText="74%">
      <LiquidGlassProgressLabel>Downloading system update</LiquidGlassProgressLabel>
      <LiquidGlassProgressValue />
      <LiquidGlassProgressTrack>
        <LiquidGlassProgressIndicator />
      </LiquidGlassProgressTrack>
    </LiquidGlassProgressRoot>
    <LiquidGlassProgressRoot prominence="destructive" :value="92" valueText="92%">
      <LiquidGlassProgressLabel>Cloud storage quota</LiquidGlassProgressLabel>
      <LiquidGlassProgressValue />
      <LiquidGlassProgressTrack>
        <LiquidGlassProgressIndicator />
      </LiquidGlassProgressTrack>
    </LiquidGlassProgressRoot>
  </div>
</template>
    `),
    'demo-liquid-glass-progress-controlled': liquidControlled.vue,
    'demo-liquid-glass-progress-indeterminate': liquidIndeterminate.vue,
  },
  vue2: {
    'demo-shadcn-progress': shadcnHero.vue2,
    'demo-shadcn-progress-label': shadcnLabel.vue2,
    'demo-shadcn-progress-controlled': shadcnControlled.vue2,
    'demo-shadcn-progress-indeterminate': shadcnIndeterminate.vue2,
    'demo-shadcn-progress-rtl': formatCode(`
<template>
  <ShadcnProgressRoot styleProfile="rhea" dir="rtl" :value="56" valueText="٥٦٪" class="w-full max-w-sm">
    <ShadcnProgressLabel styleProfile="rhea">تقدم الرفع</ShadcnProgressLabel>
    <ShadcnProgressValue styleProfile="rhea" />
    <ShadcnProgressTrack styleProfile="rhea">
      <ShadcnProgressIndicator styleProfile="rhea" />
    </ShadcnProgressTrack>
  </ShadcnProgressRoot>
</template>

<script>
import {
  ShadcnProgressIndicator,
  ShadcnProgressLabel,
  ShadcnProgressRoot,
  ShadcnProgressTrack,
  ShadcnProgressValue,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnProgressIndicator,
    ShadcnProgressLabel,
    ShadcnProgressRoot,
    ShadcnProgressTrack,
    ShadcnProgressValue,
  },
};
</script>
    `),
    'demo-brutalist-progress': brutalistHero.vue2,
    'demo-brutalist-progress-label': brutalistLabel.vue2,
    'demo-brutalist-progress-controlled': brutalistControlled.vue2,
    'demo-brutalist-progress-indeterminate': brutalistIndeterminate.vue2,
    'demo-bootstrap-2-3-2-progress': bootstrapHero.vue2,
    'demo-bootstrap-2-3-2-progress-variants': formatCode(`
<template>
  <div class="w-full max-w-md">
    <Bootstrap232ProgressRoot
      v-for="item in items"
      :key="item.variant"
      :variant="item.variant"
      :value="item.value"
      :valueText="item.value + '%'"
    >
      <Bootstrap232ProgressLabel>{{ item.label }}</Bootstrap232ProgressLabel>
      <Bootstrap232ProgressValue />
      <Bootstrap232ProgressTrack>
        <Bootstrap232ProgressIndicator />
      </Bootstrap232ProgressTrack>
    </Bootstrap232ProgressRoot>
  </div>
</template>

<script>
import {
  Bootstrap232ProgressIndicator,
  Bootstrap232ProgressLabel,
  Bootstrap232ProgressRoot,
  Bootstrap232ProgressTrack,
  Bootstrap232ProgressValue,
} from '../proto-ui/components/vue2';

export default {
  components: {
    Bootstrap232ProgressIndicator,
    Bootstrap232ProgressLabel,
    Bootstrap232ProgressRoot,
    Bootstrap232ProgressTrack,
    Bootstrap232ProgressValue,
  },
  data() {
    return {
      items: [
        { variant: 'default', label: 'Default', value: 40 },
        { variant: 'info', label: 'Info', value: 20 },
        { variant: 'success', label: 'Success', value: 60 },
        { variant: 'warning', label: 'Warning', value: 80 },
        { variant: 'danger', label: 'Danger', value: 90 },
      ],
    };
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-progress-label': bootstrapLabel.vue2,
    'demo-bootstrap-2-3-2-progress-controlled': bootstrapControlled.vue2,
    'demo-bootstrap-2-3-2-progress-indeterminate': bootstrapIndeterminate.vue2,
    'demo-liquid-glass-progress': liquidHero.vue2,
    'demo-liquid-glass-progress-label': liquidLabel.vue2,
    'demo-liquid-glass-progress-prominence': formatCode(`
<template>
  <div class="flex w-full max-w-md flex-col gap-5">
    <LiquidGlassProgressRoot prominence="regular" :value="56" valueText="56%">
      <LiquidGlassProgressLabel>Syncing photo library</LiquidGlassProgressLabel>
      <LiquidGlassProgressValue />
      <LiquidGlassProgressTrack>
        <LiquidGlassProgressIndicator />
      </LiquidGlassProgressTrack>
    </LiquidGlassProgressRoot>
    <LiquidGlassProgressRoot prominence="prominent" :value="74" valueText="74%">
      <LiquidGlassProgressLabel>Downloading system update</LiquidGlassProgressLabel>
      <LiquidGlassProgressValue />
      <LiquidGlassProgressTrack>
        <LiquidGlassProgressIndicator />
      </LiquidGlassProgressTrack>
    </LiquidGlassProgressRoot>
    <LiquidGlassProgressRoot prominence="destructive" :value="92" valueText="92%">
      <LiquidGlassProgressLabel>Cloud storage quota</LiquidGlassProgressLabel>
      <LiquidGlassProgressValue />
      <LiquidGlassProgressTrack>
        <LiquidGlassProgressIndicator />
      </LiquidGlassProgressTrack>
    </LiquidGlassProgressRoot>
  </div>
</template>

<script>
import {
  LiquidGlassProgressIndicator,
  LiquidGlassProgressLabel,
  LiquidGlassProgressRoot,
  LiquidGlassProgressTrack,
  LiquidGlassProgressValue,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassProgressIndicator,
    LiquidGlassProgressLabel,
    LiquidGlassProgressRoot,
    LiquidGlassProgressTrack,
    LiquidGlassProgressValue,
  },
};
</script>
    `),
    'demo-liquid-glass-progress-controlled': liquidControlled.vue2,
    'demo-liquid-glass-progress-indeterminate': liquidIndeterminate.vue2,
  },
};
