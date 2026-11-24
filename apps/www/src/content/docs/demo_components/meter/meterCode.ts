import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

function heroWc(family: string, styleProfile?: string) {
  const scopeOpen = styleProfile ? `<proto-ui-shadcn-style-scope class="contents">\n  ` : '';
  const scopeClose = styleProfile ? `\n</proto-ui-shadcn-style-scope>` : '';
  const scopeScript = styleProfile
    ? `  setElementProps(document.querySelector('proto-ui-shadcn-style-scope'), { styleProfile: '${styleProfile}' });\n`
    : '';
  const btnProps = family === 'shadcn' ? `, variant: 'outline', size: 'sm'` : '';
  return formatCode(`
${scopeOpen}<div id="${family}-meter-hero" class="mx-auto grid w-full max-w-md gap-4">
  <proto-ui-${family}-meter-root id="${family}-meter">
    <div class="flex items-center justify-between gap-2">
      <proto-ui-${family}-meter-label>Storage used</proto-ui-${family}-meter-label>
      <proto-ui-${family}-meter-value></proto-ui-${family}-meter-value>
    </div>
    <proto-ui-${family}-meter-track>
      <proto-ui-${family}-meter-indicator></proto-ui-${family}-meter-indicator>
    </proto-ui-${family}-meter-track>
  </proto-ui-${family}-meter-root>
  <div class="flex flex-wrap items-center gap-2">
    <proto-ui-${family}-button data-preset="optimal">Optimal (32%)</proto-ui-${family}-button>
    <proto-ui-${family}-button data-preset="suboptimal">Warning (68%)</proto-ui-${family}-button>
    <proto-ui-${family}-button data-preset="critical">Critical (92%)</proto-ui-${family}-button>
  </div>
</div>${scopeClose}
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
${scopeScript}  const meter = document.querySelector('#${family}-meter');
  const base = { min: 0, max: 100, low: 50, high: 80, optimum: 20 };
  const presets = {
    optimal: { value: 32, valueText: '32 GB / 100 GB' },
    suboptimal: { value: 68, valueText: '68 GB / 100 GB' },
    critical: { value: 92, valueText: '92 GB / 100 GB' },
  };
  setElementProps(meter, { ...base, ...presets.optimal });
  for (const [key, preset] of Object.entries(presets)) {
    const btn = document.querySelector(\`#${family}-meter-hero [data-preset="\${key}"]\`);
    setElementProps(btn, { onClick: () => setElementProps(meter, { ...base, ...preset })${btnProps} });
  }
</script>
  `);
}

function heroReact(pkg: string, styleProfile?: string) {
  const scopeImport = styleProfile ? `import { styleScope } from '${pkg}/style-scope';\n` : '';
  const scopeAdapt = styleProfile ? `const StyleScope = AdaptToReact(styleScope);\n` : '';
  const scopeStart = styleProfile
    ? `<StyleScope styleProfile="${styleProfile}" className="contents">\n      `
    : '';
  const scopeEnd = styleProfile ? `\n    </StyleScope>` : '';
  const btnAttrs = styleProfile ? ` variant="outline" size="sm"` : '';
  return formatCode(`
import { useState } from 'react';
import { AdaptToReact } from '@proto.ui/adapter-react';
import { button } from '${pkg}/button';
${scopeImport}import {
  meterRoot,
  meterLabel,
  meterTrack,
  meterIndicator,
  meterValue,
} from '${pkg}/meter';

${scopeAdapt}const Button = AdaptToReact(button);
const MeterRoot = AdaptToReact(meterRoot);
const MeterLabel = AdaptToReact(meterLabel);
const MeterTrack = AdaptToReact(meterTrack);
const MeterIndicator = AdaptToReact(meterIndicator);
const MeterValue = AdaptToReact(meterValue);

export function MeterDemo() {
  const [value, setValue] = useState(32);
  return (
    ${scopeStart}<div className="mx-auto grid w-full max-w-md gap-4">
      <MeterRoot
        value={value}
        min={0}
        max={100}
        low={50}
        high={80}
        optimum={20}
        valueText={\`\${value} GB / 100 GB\`}
      >
        <div className="flex items-center justify-between gap-2">
          <MeterLabel>Storage used</MeterLabel>
          <MeterValue />
        </div>
        <MeterTrack>
          <MeterIndicator />
        </MeterTrack>
      </MeterRoot>
      <div className="flex flex-wrap items-center gap-2">
        <Button${btnAttrs} onClick={() => setValue(32)}>Optimal (32%)</Button>
        <Button${btnAttrs} onClick={() => setValue(68)}>Warning (68%)</Button>
        <Button${btnAttrs} onClick={() => setValue(92)}>Critical (92%)</Button>
      </div>
    </div>${scopeEnd}
  );
}
  `);
}

function heroVue(pkg: string, version: 3 | 2, styleProfile?: string) {
  const adapter = version === 3 ? '@proto.ui/adapter-vue' : '@proto.ui/adapter-vue2';
  const adaptFn = version === 3 ? 'AdaptToVue' : 'AdaptToVue2';
  const scopeImport = styleProfile ? `import { styleScope } from '${pkg}/style-scope';\n` : '';
  const scopeAdapt = styleProfile ? `const StyleScope = ${adaptFn}(styleScope);\n` : '';
  const scopeOpen = styleProfile
    ? `  <StyleScope style-profile="${styleProfile}" class="contents">\n  `
    : '';
  const scopeClose = styleProfile ? `\n  </StyleScope>` : '';
  const btnAttrs = styleProfile ? ` variant="outline" size="sm"` : '';
  if (version === 2) {
    return formatCode(`
<template>
${scopeOpen}  <div class="mx-auto grid w-full max-w-md gap-4">
    <MeterRoot
      :value="value"
      :min="0"
      :max="100"
      :low="50"
      :high="80"
      :optimum="20"
      :value-text="\`\${value} GB / 100 GB\`"
    >
      <div class="flex items-center justify-between gap-2">
        <MeterLabel>Storage used</MeterLabel>
        <MeterValue />
      </div>
      <MeterTrack>
        <MeterIndicator />
      </MeterTrack>
    </MeterRoot>
    <div class="flex flex-wrap items-center gap-2">
      <PuiButton${btnAttrs} :on-click="() => (value = 32)">Optimal (32%)</PuiButton>
      <PuiButton${btnAttrs} :on-click="() => (value = 68)">Warning (68%)</PuiButton>
      <PuiButton${btnAttrs} :on-click="() => (value = 92)">Critical (92%)</PuiButton>
    </div>
  </div>${scopeClose}
</template>

<script>
import { ${adaptFn} } from '${adapter}';
import { button } from '${pkg}/button';
${scopeImport}import { meterRoot, meterLabel, meterTrack, meterIndicator, meterValue } from '${pkg}/meter';

${scopeAdapt}export default {
  components: {
    ${styleProfile ? 'StyleScope,\n    ' : ''}PuiButton: ${adaptFn}(button),
    MeterRoot: ${adaptFn}(meterRoot),
    MeterLabel: ${adaptFn}(meterLabel),
    MeterTrack: ${adaptFn}(meterTrack),
    MeterIndicator: ${adaptFn}(meterIndicator),
    MeterValue: ${adaptFn}(meterValue),
  },
  data() {
    return { value: 32 };
  },
};
</script>
    `);
  }
  return formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import { ${adaptFn} } from '${adapter}';
import { button } from '${pkg}/button';
${scopeImport}import { meterRoot, meterLabel, meterTrack, meterIndicator, meterValue } from '${pkg}/meter';

${scopeAdapt}const PuiButton = ${adaptFn}(button);
const MeterRoot = ${adaptFn}(meterRoot);
const MeterLabel = ${adaptFn}(meterLabel);
const MeterTrack = ${adaptFn}(meterTrack);
const MeterIndicator = ${adaptFn}(meterIndicator);
const MeterValue = ${adaptFn}(meterValue);
const value = ref(32);
</script>

<template>
${scopeOpen}  <div class="mx-auto grid w-full max-w-md gap-4">
    <MeterRoot
      :value="value"
      :min="0"
      :max="100"
      :low="50"
      :high="80"
      :optimum="20"
      :value-text="\`\${value} GB / 100 GB\`"
    >
      <div class="flex items-center justify-between gap-2">
        <MeterLabel>Storage used</MeterLabel>
        <MeterValue />
      </div>
      <MeterTrack>
        <MeterIndicator />
      </MeterTrack>
    </MeterRoot>
    <div class="flex flex-wrap items-center gap-2">
      <PuiButton${btnAttrs} :on-click="() => (value = 32)">Optimal (32%)</PuiButton>
      <PuiButton${btnAttrs} :on-click="() => (value = 68)">Warning (68%)</PuiButton>
      <PuiButton${btnAttrs} :on-click="() => (value = 92)">Critical (92%)</PuiButton>
    </div>
  </div>${scopeClose}
</template>
  `);
}

function thresholdsWc(family: string, styleProfile?: string) {
  const scopeOpen = styleProfile ? `<proto-ui-shadcn-style-scope class="contents">\n  ` : '';
  const scopeClose = styleProfile ? `\n</proto-ui-shadcn-style-scope>` : '';
  const scopeScript = styleProfile
    ? `  setElementProps(document.querySelector('proto-ui-shadcn-style-scope'), { styleProfile: '${styleProfile}' });\n`
    : '';
  return formatCode(`
${scopeOpen}<div id="${family}-meter-zones" class="mx-auto grid w-full max-w-md gap-5">
  <proto-ui-${family}-meter-root data-zone="optimal">
    <div class="flex items-center justify-between gap-2">
      <proto-ui-${family}-meter-label>Disk usage (optimal)</proto-ui-${family}-meter-label>
      <proto-ui-${family}-meter-value></proto-ui-${family}-meter-value>
    </div>
    <proto-ui-${family}-meter-track><proto-ui-${family}-meter-indicator></proto-ui-${family}-meter-indicator></proto-ui-${family}-meter-track>
  </proto-ui-${family}-meter-root>
  <proto-ui-${family}-meter-root data-zone="suboptimal">
    <div class="flex items-center justify-between gap-2">
      <proto-ui-${family}-meter-label>Disk usage (suboptimal)</proto-ui-${family}-meter-label>
      <proto-ui-${family}-meter-value></proto-ui-${family}-meter-value>
    </div>
    <proto-ui-${family}-meter-track><proto-ui-${family}-meter-indicator></proto-ui-${family}-meter-indicator></proto-ui-${family}-meter-track>
  </proto-ui-${family}-meter-root>
  <proto-ui-${family}-meter-root data-zone="critical">
    <div class="flex items-center justify-between gap-2">
      <proto-ui-${family}-meter-label>Disk usage (critical)</proto-ui-${family}-meter-label>
      <proto-ui-${family}-meter-value></proto-ui-${family}-meter-value>
    </div>
    <proto-ui-${family}-meter-track><proto-ui-${family}-meter-indicator></proto-ui-${family}-meter-indicator></proto-ui-${family}-meter-track>
  </proto-ui-${family}-meter-root>
  <proto-ui-${family}-meter-root data-zone="battery">
    <div class="flex items-center justify-between gap-2">
      <proto-ui-${family}-meter-label>Battery charge (higher is better)</proto-ui-${family}-meter-label>
      <proto-ui-${family}-meter-value></proto-ui-${family}-meter-value>
    </div>
    <proto-ui-${family}-meter-track><proto-ui-${family}-meter-indicator></proto-ui-${family}-meter-indicator></proto-ui-${family}-meter-track>
  </proto-ui-${family}-meter-root>
</div>${scopeClose}
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
${scopeScript}  const configs = {
    optimal: { value: 32, low: 50, high: 80, optimum: 20, valueText: '32%' },
    suboptimal: { value: 68, low: 50, high: 80, optimum: 20, valueText: '68%' },
    critical: { value: 92, low: 50, high: 80, optimum: 20, valueText: '92%' },
    battery: { value: 88, low: 25, high: 60, optimum: 95, valueText: '88%' },
  };
  for (const [key, props] of Object.entries(configs)) {
    setElementProps(document.querySelector(\`#${family}-meter-zones [data-zone="\${key}"]\`), props);
  }
</script>
  `);
}

function thresholdsReact(pkg: string, styleProfile?: string) {
  const styleAttr = styleProfile ? ` styleProfile="${styleProfile}"` : '';
  return formatCode(`
import { AdaptToReact } from '@proto.ui/adapter-react';
import { meterRoot, meterLabel, meterTrack, meterIndicator, meterValue } from '${pkg}/meter';

const MeterRoot = AdaptToReact(meterRoot);
const MeterLabel = AdaptToReact(meterLabel);
const MeterTrack = AdaptToReact(meterTrack);
const MeterIndicator = AdaptToReact(meterIndicator);
const MeterValue = AdaptToReact(meterValue);

const ITEMS = [
  { label: 'Disk usage (optimal)', value: 32, low: 50, high: 80, optimum: 20, valueText: '32%' },
  { label: 'Disk usage (suboptimal)', value: 68, low: 50, high: 80, optimum: 20, valueText: '68%' },
  { label: 'Disk usage (critical)', value: 92, low: 50, high: 80, optimum: 20, valueText: '92%' },
  { label: 'Battery charge (higher is better)', value: 88, low: 25, high: 60, optimum: 95, valueText: '88%' },
];

export function MeterThresholdsDemo() {
  return (
    <div className="mx-auto grid w-full max-w-md gap-5">
      {ITEMS.map((item) => (
        <MeterRoot key={item.label}${styleAttr} {...item}>
          <div className="flex items-center justify-between gap-2">
            <MeterLabel>{item.label}</MeterLabel>
            <MeterValue />
          </div>
          <MeterTrack>
            <MeterIndicator />
          </MeterTrack>
        </MeterRoot>
      ))}
    </div>
  );
}
  `);
}

function thresholdsVue(pkg: string, version: 3 | 2, styleProfile?: string) {
  const adapter = version === 3 ? '@proto.ui/adapter-vue' : '@proto.ui/adapter-vue2';
  const adaptFn = version === 3 ? 'AdaptToVue' : 'AdaptToVue2';
  const styleAttr = styleProfile ? ` style-profile="${styleProfile}"` : '';
  if (version === 2) {
    return formatCode(`
<template>
  <div class="mx-auto grid w-full max-w-md gap-5">
    <MeterRoot
      v-for="item in items"
      :key="item.label"${styleAttr}
      :value="item.value"
      :low="item.low"
      :high="item.high"
      :optimum="item.optimum"
      :value-text="item.valueText"
    >
      <div class="flex items-center justify-between gap-2">
        <MeterLabel>{{ item.label }}</MeterLabel>
        <MeterValue />
      </div>
      <MeterTrack><MeterIndicator /></MeterTrack>
    </MeterRoot>
  </div>
</template>

<script>
import { ${adaptFn} } from '${adapter}';
import { meterRoot, meterLabel, meterTrack, meterIndicator, meterValue } from '${pkg}/meter';

export default {
  components: {
    MeterRoot: ${adaptFn}(meterRoot),
    MeterLabel: ${adaptFn}(meterLabel),
    MeterTrack: ${adaptFn}(meterTrack),
    MeterIndicator: ${adaptFn}(meterIndicator),
    MeterValue: ${adaptFn}(meterValue),
  },
  data() {
    return {
      items: [
        { label: 'Disk usage (optimal)', value: 32, low: 50, high: 80, optimum: 20, valueText: '32%' },
        { label: 'Disk usage (suboptimal)', value: 68, low: 50, high: 80, optimum: 20, valueText: '68%' },
        { label: 'Disk usage (critical)', value: 92, low: 50, high: 80, optimum: 20, valueText: '92%' },
        { label: 'Battery charge (higher is better)', value: 88, low: 25, high: 60, optimum: 95, valueText: '88%' },
      ],
    };
  },
};
</script>
    `);
  }
  return formatCode(`
<script setup lang="ts">
import { ${adaptFn} } from '${adapter}';
import { meterRoot, meterLabel, meterTrack, meterIndicator, meterValue } from '${pkg}/meter';

const MeterRoot = ${adaptFn}(meterRoot);
const MeterLabel = ${adaptFn}(meterLabel);
const MeterTrack = ${adaptFn}(meterTrack);
const MeterIndicator = ${adaptFn}(meterIndicator);
const MeterValue = ${adaptFn}(meterValue);
const items = [
  { label: 'Disk usage (optimal)', value: 32, low: 50, high: 80, optimum: 20, valueText: '32%' },
  { label: 'Disk usage (suboptimal)', value: 68, low: 50, high: 80, optimum: 20, valueText: '68%' },
  { label: 'Disk usage (critical)', value: 92, low: 50, high: 80, optimum: 20, valueText: '92%' },
  { label: 'Battery charge (higher is better)', value: 88, low: 25, high: 60, optimum: 95, valueText: '88%' },
];
</script>

<template>
  <div class="mx-auto grid w-full max-w-md gap-5">
    <MeterRoot
      v-for="item in items"
      :key="item.label"${styleAttr}
      :value="item.value"
      :low="item.low"
      :high="item.high"
      :optimum="item.optimum"
      :value-text="item.valueText"
    >
      <div class="flex items-center justify-between gap-2">
        <MeterLabel>{{ item.label }}</MeterLabel>
        <MeterValue />
      </div>
      <MeterTrack><MeterIndicator /></MeterTrack>
    </MeterRoot>
  </div>
</template>
  `);
}

function customRangeWc(family: string, styleProfile?: string) {
  const storageLabel = family === 'liquid-glass' ? 'iCloud storage' : 'Cloud storage';
  const extraProp = styleProfile ? `, styleProfile: '${styleProfile}'` : '';
  return formatCode(`
<div id="${family}-meter-range" class="mx-auto grid w-full max-w-md gap-5">
  <proto-ui-${family}-meter-root data-range="storage">
    <div class="flex items-center justify-between gap-2">
      <proto-ui-${family}-meter-label>${storageLabel}</proto-ui-${family}-meter-label>
      <proto-ui-${family}-meter-value></proto-ui-${family}-meter-value>
    </div>
    <proto-ui-${family}-meter-track><proto-ui-${family}-meter-indicator></proto-ui-${family}-meter-indicator></proto-ui-${family}-meter-track>
  </proto-ui-${family}-meter-root>
  <proto-ui-${family}-meter-root data-range="api">
    <div class="flex items-center justify-between gap-2">
      <proto-ui-${family}-meter-label>Monthly API calls</proto-ui-${family}-meter-label>
      <proto-ui-${family}-meter-value></proto-ui-${family}-meter-value>
    </div>
    <proto-ui-${family}-meter-track><proto-ui-${family}-meter-indicator></proto-ui-${family}-meter-indicator></proto-ui-${family}-meter-track>
  </proto-ui-${family}-meter-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#${family}-meter-range [data-range="storage"]'), {
    value: 384, min: 0, max: 512, low: 256, high: 420, optimum: 128, valueText: '384 GB / 512 GB'${extraProp},
  });
  setElementProps(document.querySelector('#${family}-meter-range [data-range="api"]'), {
    value: 9200, min: 0, max: 10000, low: 5000, high: 8500, optimum: 1000, valueText: '9,200 / 10,000 req'${extraProp},
  });
</script>
  `);
}

function customRangeReact(pkg: string, styleProfile?: string) {
  const storageLabel = pkg.includes('liquid-glass') ? 'iCloud storage' : 'Cloud storage';
  const styleAttr = styleProfile ? ` styleProfile="${styleProfile}"` : '';
  return formatCode(`
import { AdaptToReact } from '@proto.ui/adapter-react';
import { meterRoot, meterLabel, meterTrack, meterIndicator, meterValue } from '${pkg}/meter';

const MeterRoot = AdaptToReact(meterRoot);
const MeterLabel = AdaptToReact(meterLabel);
const MeterTrack = AdaptToReact(meterTrack);
const MeterIndicator = AdaptToReact(meterIndicator);
const MeterValue = AdaptToReact(meterValue);

export function MeterCustomRangeDemo() {
  return (
    <div className="mx-auto grid w-full max-w-md gap-5">
      <MeterRoot${styleAttr} value={384} min={0} max={512} low={256} high={420} optimum={128} valueText="384 GB / 512 GB">
        <div className="flex items-center justify-between gap-2">
          <MeterLabel>${storageLabel}</MeterLabel>
          <MeterValue />
        </div>
        <MeterTrack><MeterIndicator /></MeterTrack>
      </MeterRoot>
      <MeterRoot${styleAttr} value={9200} min={0} max={10000} low={5000} high={8500} optimum={1000} valueText="9,200 / 10,000 req">
        <div className="flex items-center justify-between gap-2">
          <MeterLabel>Monthly API calls</MeterLabel>
          <MeterValue />
        </div>
        <MeterTrack><MeterIndicator /></MeterTrack>
      </MeterRoot>
    </div>
  );
}
  `);
}

function customRangeVue(pkg: string, version: 3 | 2, styleProfile?: string) {
  const adapter = version === 3 ? '@proto.ui/adapter-vue' : '@proto.ui/adapter-vue2';
  const adaptFn = version === 3 ? 'AdaptToVue' : 'AdaptToVue2';
  const storageLabel = pkg.includes('liquid-glass') ? 'iCloud storage' : 'Cloud storage';
  const styleAttr = styleProfile ? ` style-profile="${styleProfile}"` : '';
  const tpl = `  <div class="mx-auto grid w-full max-w-md gap-5">
    <MeterRoot${styleAttr} :value="384" :min="0" :max="512" :low="256" :high="420" :optimum="128" value-text="384 GB / 512 GB">
      <div class="flex items-center justify-between gap-2">
        <MeterLabel>${storageLabel}</MeterLabel>
        <MeterValue />
      </div>
      <MeterTrack><MeterIndicator /></MeterTrack>
    </MeterRoot>
    <MeterRoot${styleAttr} :value="9200" :min="0" :max="10000" :low="5000" :high="8500" :optimum="1000" value-text="9,200 / 10,000 req">
      <div class="flex items-center justify-between gap-2">
        <MeterLabel>Monthly API calls</MeterLabel>
        <MeterValue />
      </div>
      <MeterTrack><MeterIndicator /></MeterTrack>
    </MeterRoot>
  </div>`;
  if (version === 2) {
    return formatCode(`
<template>
${tpl}
</template>

<script>
import { ${adaptFn} } from '${adapter}';
import { meterRoot, meterLabel, meterTrack, meterIndicator, meterValue } from '${pkg}/meter';

export default {
  components: {
    MeterRoot: ${adaptFn}(meterRoot),
    MeterLabel: ${adaptFn}(meterLabel),
    MeterTrack: ${adaptFn}(meterTrack),
    MeterIndicator: ${adaptFn}(meterIndicator),
    MeterValue: ${adaptFn}(meterValue),
  },
};
</script>
    `);
  }
  return formatCode(`
<script setup lang="ts">
import { ${adaptFn} } from '${adapter}';
import { meterRoot, meterLabel, meterTrack, meterIndicator, meterValue } from '${pkg}/meter';

const MeterRoot = ${adaptFn}(meterRoot);
const MeterLabel = ${adaptFn}(meterLabel);
const MeterTrack = ${adaptFn}(meterTrack);
const MeterIndicator = ${adaptFn}(meterIndicator);
const MeterValue = ${adaptFn}(meterValue);
</script>

<template>
${tpl}
</template>
  `);
}

function quotaCardWc(family: string, styleProfile?: string) {
  const extraProp = styleProfile ? `, styleProfile: '${styleProfile}'` : '';
  return formatCode(`
<div id="${family}-quota-card" class="mx-auto grid w-full max-w-md gap-4 rounded-xl border p-5">
  <proto-ui-${family}-meter-root data-metric="cpu">
    <div class="flex items-center justify-between gap-2">
      <proto-ui-${family}-meter-label>CPU allocation</proto-ui-${family}-meter-label>
      <proto-ui-${family}-meter-value></proto-ui-${family}-meter-value>
    </div>
    <proto-ui-${family}-meter-track><proto-ui-${family}-meter-indicator></proto-ui-${family}-meter-indicator></proto-ui-${family}-meter-track>
  </proto-ui-${family}-meter-root>
  <proto-ui-${family}-meter-root data-metric="memory">
    <div class="flex items-center justify-between gap-2">
      <proto-ui-${family}-meter-label>Memory</proto-ui-${family}-meter-label>
      <proto-ui-${family}-meter-value></proto-ui-${family}-meter-value>
    </div>
    <proto-ui-${family}-meter-track><proto-ui-${family}-meter-indicator></proto-ui-${family}-meter-indicator></proto-ui-${family}-meter-track>
  </proto-ui-${family}-meter-root>
  <proto-ui-${family}-meter-root data-metric="ssd">
    <div class="flex items-center justify-between gap-2">
      <proto-ui-${family}-meter-label>SSD volume</proto-ui-${family}-meter-label>
      <proto-ui-${family}-meter-value></proto-ui-${family}-meter-value>
    </div>
    <proto-ui-${family}-meter-track><proto-ui-${family}-meter-indicator></proto-ui-${family}-meter-indicator></proto-ui-${family}-meter-track>
  </proto-ui-${family}-meter-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const metrics = {
    cpu: { value: 28, min: 0, max: 100, low: 60, high: 85, optimum: 20, valueText: '28%'${extraProp} },
    memory: { value: 11.4, min: 0, max: 16, low: 10, high: 14, optimum: 4, valueText: '11.4 GB / 16 GB'${extraProp} },
    ssd: { value: 468, min: 0, max: 500, low: 300, high: 425, optimum: 100, valueText: '468 GB / 500 GB'${extraProp} },
  };
  for (const [key, props] of Object.entries(metrics)) {
    setElementProps(document.querySelector(\`#${family}-quota-card [data-metric="\${key}"]\`), props);
  }
</script>
  `);
}

function quotaCardReact(pkg: string, styleProfile?: string) {
  const styleAttr = styleProfile ? ` styleProfile="${styleProfile}"` : '';
  return formatCode(`
import { AdaptToReact } from '@proto.ui/adapter-react';
import { meterRoot, meterLabel, meterTrack, meterIndicator, meterValue } from '${pkg}/meter';

const MeterRoot = AdaptToReact(meterRoot);
const MeterLabel = AdaptToReact(meterLabel);
const MeterTrack = AdaptToReact(meterTrack);
const MeterIndicator = AdaptToReact(meterIndicator);
const MeterValue = AdaptToReact(meterValue);

const METRICS = [
  { label: 'CPU allocation', value: 28, min: 0, max: 100, low: 60, high: 85, optimum: 20, valueText: '28%' },
  { label: 'Memory', value: 11.4, min: 0, max: 16, low: 10, high: 14, optimum: 4, valueText: '11.4 GB / 16 GB' },
  { label: 'SSD volume', value: 468, min: 0, max: 500, low: 300, high: 425, optimum: 100, valueText: '468 GB / 500 GB' },
];

export function MeterQuotaCardDemo() {
  return (
    <div className="mx-auto grid w-full max-w-md gap-4 rounded-xl border p-5">
      {METRICS.map((item) => (
        <MeterRoot key={item.label}${styleAttr} {...item}>
          <div className="flex items-center justify-between gap-2">
            <MeterLabel>{item.label}</MeterLabel>
            <MeterValue />
          </div>
          <MeterTrack><MeterIndicator /></MeterTrack>
        </MeterRoot>
      ))}
    </div>
  );
}
  `);
}

function quotaCardVue(pkg: string, version: 3 | 2, styleProfile?: string) {
  const adapter = version === 3 ? '@proto.ui/adapter-vue' : '@proto.ui/adapter-vue2';
  const adaptFn = version === 3 ? 'AdaptToVue' : 'AdaptToVue2';
  const styleAttr = styleProfile ? ` style-profile="${styleProfile}"` : '';
  if (version === 2) {
    return formatCode(`
<template>
  <div class="mx-auto grid w-full max-w-md gap-4 rounded-xl border p-5">
    <MeterRoot
      v-for="item in metrics"
      :key="item.label"${styleAttr}
      :value="item.value"
      :min="item.min"
      :max="item.max"
      :low="item.low"
      :high="item.high"
      :optimum="item.optimum"
      :value-text="item.valueText"
    >
      <div class="flex items-center justify-between gap-2">
        <MeterLabel>{{ item.label }}</MeterLabel>
        <MeterValue />
      </div>
      <MeterTrack><MeterIndicator /></MeterTrack>
    </MeterRoot>
  </div>
</template>

<script>
import { ${adaptFn} } from '${adapter}';
import { meterRoot, meterLabel, meterTrack, meterIndicator, meterValue } from '${pkg}/meter';

export default {
  components: {
    MeterRoot: ${adaptFn}(meterRoot),
    MeterLabel: ${adaptFn}(meterLabel),
    MeterTrack: ${adaptFn}(meterTrack),
    MeterIndicator: ${adaptFn}(meterIndicator),
    MeterValue: ${adaptFn}(meterValue),
  },
  data() {
    return {
      metrics: [
        { label: 'CPU allocation', value: 28, min: 0, max: 100, low: 60, high: 85, optimum: 20, valueText: '28%' },
        { label: 'Memory', value: 11.4, min: 0, max: 16, low: 10, high: 14, optimum: 4, valueText: '11.4 GB / 16 GB' },
        { label: 'SSD volume', value: 468, min: 0, max: 500, low: 300, high: 425, optimum: 100, valueText: '468 GB / 500 GB' },
      ],
    };
  },
};
</script>
    `);
  }
  return formatCode(`
<script setup lang="ts">
import { ${adaptFn} } from '${adapter}';
import { meterRoot, meterLabel, meterTrack, meterIndicator, meterValue } from '${pkg}/meter';

const MeterRoot = ${adaptFn}(meterRoot);
const MeterLabel = ${adaptFn}(meterLabel);
const MeterTrack = ${adaptFn}(meterTrack);
const MeterIndicator = ${adaptFn}(meterIndicator);
const MeterValue = ${adaptFn}(meterValue);
const metrics = [
  { label: 'CPU allocation', value: 28, min: 0, max: 100, low: 60, high: 85, optimum: 20, valueText: '28%' },
  { label: 'Memory', value: 11.4, min: 0, max: 16, low: 10, high: 14, optimum: 4, valueText: '11.4 GB / 16 GB' },
  { label: 'SSD volume', value: 468, min: 0, max: 500, low: 300, high: 425, optimum: 100, valueText: '468 GB / 500 GB' },
];
</script>

<template>
  <div class="mx-auto grid w-full max-w-md gap-4 rounded-xl border p-5">
    <MeterRoot
      v-for="item in metrics"
      :key="item.label"${styleAttr}
      :value="item.value"
      :min="item.min"
      :max="item.max"
      :low="item.low"
      :high="item.high"
      :optimum="item.optimum"
      :value-text="item.valueText"
    >
      <div class="flex items-center justify-between gap-2">
        <MeterLabel>{{ item.label }}</MeterLabel>
        <MeterValue />
      </div>
      <MeterTrack><MeterIndicator /></MeterTrack>
    </MeterRoot>
  </div>
</template>
  `);
}

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-meter': heroWc('shadcn', 'rhea'),
    'demo-shadcn-meter-thresholds': thresholdsWc('shadcn', 'rhea'),
    'demo-shadcn-meter-custom-range': customRangeWc('shadcn', 'rhea'),
    'demo-shadcn-meter-quota-card': quotaCardWc('shadcn', 'rhea'),
    'demo-shadcn-meter-profiles': formatCode(`
<div id="shadcn-meter-profiles" class="mx-auto grid w-full max-w-md gap-5">
  <proto-ui-shadcn-style-scope data-profile="rhea" class="contents">
    <proto-ui-shadcn-meter-root>
      <div class="flex items-center justify-between gap-2">
        <proto-ui-shadcn-meter-label>Rhea (default docs)</proto-ui-shadcn-meter-label>
        <proto-ui-shadcn-meter-value></proto-ui-shadcn-meter-value>
      </div>
      <proto-ui-shadcn-meter-track><proto-ui-shadcn-meter-indicator></proto-ui-shadcn-meter-indicator></proto-ui-shadcn-meter-track>
    </proto-ui-shadcn-meter-root>
  </proto-ui-shadcn-style-scope>
  <proto-ui-shadcn-style-scope data-profile="luma" class="contents">
    <proto-ui-shadcn-meter-root>
      <div class="flex items-center justify-between gap-2">
        <proto-ui-shadcn-meter-label>Luma</proto-ui-shadcn-meter-label>
        <proto-ui-shadcn-meter-value></proto-ui-shadcn-meter-value>
      </div>
      <proto-ui-shadcn-meter-track><proto-ui-shadcn-meter-indicator></proto-ui-shadcn-meter-indicator></proto-ui-shadcn-meter-track>
    </proto-ui-shadcn-meter-root>
  </proto-ui-shadcn-style-scope>
  <proto-ui-shadcn-style-scope data-profile="lyra" class="contents">
    <proto-ui-shadcn-meter-root>
      <div class="flex items-center justify-between gap-2">
        <proto-ui-shadcn-meter-label>Lyra</proto-ui-shadcn-meter-label>
        <proto-ui-shadcn-meter-value></proto-ui-shadcn-meter-value>
      </div>
      <proto-ui-shadcn-meter-track><proto-ui-shadcn-meter-indicator></proto-ui-shadcn-meter-indicator></proto-ui-shadcn-meter-track>
    </proto-ui-shadcn-meter-root>
  </proto-ui-shadcn-style-scope>
  <proto-ui-shadcn-style-scope data-profile="sera" class="contents">
    <proto-ui-shadcn-meter-root>
      <div class="flex items-center justify-between gap-2">
        <proto-ui-shadcn-meter-label>Sera</proto-ui-shadcn-meter-label>
        <proto-ui-shadcn-meter-value></proto-ui-shadcn-meter-value>
      </div>
      <proto-ui-shadcn-meter-track><proto-ui-shadcn-meter-indicator></proto-ui-shadcn-meter-indicator></proto-ui-shadcn-meter-track>
    </proto-ui-shadcn-meter-root>
  </proto-ui-shadcn-style-scope>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  for (const profile of ['rhea', 'luma', 'lyra', 'sera']) {
    const scope = document.querySelector(\`#shadcn-meter-profiles [data-profile="\${profile}"]\`);
    setElementProps(scope, { styleProfile: profile });
    setElementProps(scope.querySelector('proto-ui-shadcn-meter-root'), {
      value: 64, min: 0, max: 100, low: 70, high: 90, optimum: 20, valueText: '64%',
    });
  }
</script>
    `),
    'demo-brutalist-meter': heroWc('brutalist'),
    'demo-brutalist-meter-thresholds': thresholdsWc('brutalist'),
    'demo-brutalist-meter-custom-range': customRangeWc('brutalist'),
    'demo-brutalist-meter-quota-card': quotaCardWc('brutalist'),
    'demo-bootstrap-2-3-2-meter': heroWc('bootstrap-2-3-2'),
    'demo-bootstrap-2-3-2-meter-thresholds': thresholdsWc('bootstrap-2-3-2'),
    'demo-bootstrap-2-3-2-meter-custom-range': customRangeWc('bootstrap-2-3-2'),
    'demo-bootstrap-2-3-2-meter-quota-card': quotaCardWc('bootstrap-2-3-2'),
    'demo-liquid-glass-meter': heroWc('liquid-glass'),
    'demo-liquid-glass-meter-thresholds': thresholdsWc('liquid-glass'),
    'demo-liquid-glass-meter-custom-range': customRangeWc('liquid-glass'),
    'demo-liquid-glass-meter-surface-layering': formatCode(`
<div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
  <div id="lg-meter-surface" class="mx-auto grid w-full max-w-md gap-4">
    <div class="grid gap-4 rounded-2xl border border-border bg-background/90 p-5">
      <proto-ui-liquid-glass-meter-root data-metric="memory">
        <div class="flex items-center justify-between gap-2">
          <proto-ui-liquid-glass-meter-label>Memory</proto-ui-liquid-glass-meter-label>
          <proto-ui-liquid-glass-meter-value></proto-ui-liquid-glass-meter-value>
        </div>
        <proto-ui-liquid-glass-meter-track><proto-ui-liquid-glass-meter-indicator></proto-ui-liquid-glass-meter-indicator></proto-ui-liquid-glass-meter-track>
      </proto-ui-liquid-glass-meter-root>
      <proto-ui-liquid-glass-meter-root data-metric="storage">
        <div class="flex items-center justify-between gap-2">
          <proto-ui-liquid-glass-meter-label>Local storage</proto-ui-liquid-glass-meter-label>
          <proto-ui-liquid-glass-meter-value></proto-ui-liquid-glass-meter-value>
        </div>
        <proto-ui-liquid-glass-meter-track><proto-ui-liquid-glass-meter-indicator></proto-ui-liquid-glass-meter-indicator></proto-ui-liquid-glass-meter-track>
      </proto-ui-liquid-glass-meter-root>
    </div>
    <div class="flex justify-end gap-2">
      <proto-ui-liquid-glass-button data-action="optimize">Free cache</proto-ui-liquid-glass-button>
      <proto-ui-liquid-glass-button data-action="reset">Restore load</proto-ui-liquid-glass-button>
    </div>
  </div>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const memory = document.querySelector('#lg-meter-surface [data-metric="memory"]');
  const storage = document.querySelector('#lg-meter-surface [data-metric="storage"]');
  const apply = (mem, disk) => {
    setElementProps(memory, { value: mem, min: 0, max: 16, low: 10, high: 14, optimum: 4, valueText: \`\${mem} GB / 16 GB\` });
    setElementProps(storage, { value: disk, min: 0, max: 500, low: 300, high: 425, optimum: 100, valueText: \`\${disk} GB / 500 GB\` });
  };
  apply(11.4, 468);
  setElementProps(document.querySelector('#lg-meter-surface [data-action="optimize"]'), { onClick: () => apply(6.2, 240) });
  setElementProps(document.querySelector('#lg-meter-surface [data-action="reset"]'), { onClick: () => apply(11.4, 468) });
</script>
    `),
  },
  react: {
    'demo-shadcn-meter': heroReact('@proto.ui/prototypes-shadcn', 'rhea'),
    'demo-shadcn-meter-thresholds': thresholdsReact('@proto.ui/prototypes-shadcn', 'rhea'),
    'demo-shadcn-meter-custom-range': customRangeReact('@proto.ui/prototypes-shadcn', 'rhea'),
    'demo-shadcn-meter-quota-card': quotaCardReact('@proto.ui/prototypes-shadcn', 'rhea'),
    'demo-shadcn-meter-profiles': formatCode(`
import { AdaptToReact } from '@proto.ui/adapter-react';
import { styleScope } from '@proto.ui/prototypes-shadcn/style-scope';
import { meterRoot, meterLabel, meterTrack, meterIndicator, meterValue } from '@proto.ui/prototypes-shadcn/meter';

const StyleScope = AdaptToReact(styleScope);
const MeterRoot = AdaptToReact(meterRoot);
const MeterLabel = AdaptToReact(meterLabel);
const MeterTrack = AdaptToReact(meterTrack);
const MeterIndicator = AdaptToReact(meterIndicator);
const MeterValue = AdaptToReact(meterValue);

const PROFILES = ['rhea', 'luma', 'lyra', 'sera'] as const;

export function MeterProfilesDemo() {
  return (
    <div className="mx-auto grid w-full max-w-md gap-5">
      {PROFILES.map((profile) => (
        <StyleScope key={profile} styleProfile={profile} className="contents">
          <MeterRoot value={64} min={0} max={100} low={70} high={90} optimum={20} valueText="64%">
            <div className="flex items-center justify-between gap-2">
              <MeterLabel>{profile}</MeterLabel>
              <MeterValue />
            </div>
            <MeterTrack><MeterIndicator /></MeterTrack>
          </MeterRoot>
        </StyleScope>
      ))}
    </div>
  );
}
    `),
    'demo-brutalist-meter': heroReact('@proto.ui/prototypes-brutalist'),
    'demo-brutalist-meter-thresholds': thresholdsReact('@proto.ui/prototypes-brutalist'),
    'demo-brutalist-meter-custom-range': customRangeReact('@proto.ui/prototypes-brutalist'),
    'demo-brutalist-meter-quota-card': quotaCardReact('@proto.ui/prototypes-brutalist'),
    'demo-bootstrap-2-3-2-meter': heroReact('@proto.ui/prototypes-bootstrap-2-3-2'),
    'demo-bootstrap-2-3-2-meter-thresholds': thresholdsReact(
      '@proto.ui/prototypes-bootstrap-2-3-2'
    ),
    'demo-bootstrap-2-3-2-meter-custom-range': customRangeReact(
      '@proto.ui/prototypes-bootstrap-2-3-2'
    ),
    'demo-bootstrap-2-3-2-meter-quota-card': quotaCardReact('@proto.ui/prototypes-bootstrap-2-3-2'),
    'demo-liquid-glass-meter': heroReact('@proto.ui/prototypes-liquid-glass'),
    'demo-liquid-glass-meter-thresholds': thresholdsReact('@proto.ui/prototypes-liquid-glass'),
    'demo-liquid-glass-meter-custom-range': customRangeReact('@proto.ui/prototypes-liquid-glass'),
    'demo-liquid-glass-meter-surface-layering': formatCode(`
import { useState } from 'react';
import { AdaptToReact } from '@proto.ui/adapter-react';
import { button } from '@proto.ui/prototypes-liquid-glass/button';
import { meterRoot, meterLabel, meterTrack, meterIndicator, meterValue } from '@proto.ui/prototypes-liquid-glass/meter';

const Button = AdaptToReact(button);
const MeterRoot = AdaptToReact(meterRoot);
const MeterLabel = AdaptToReact(meterLabel);
const MeterTrack = AdaptToReact(meterTrack);
const MeterIndicator = AdaptToReact(meterIndicator);
const MeterValue = AdaptToReact(meterValue);

export function LiquidGlassMeterLayeringDemo() {
  const [optimized, setOptimized] = useState(false);
  const memory = optimized ? 6.2 : 11.4;
  const storage = optimized ? 240 : 468;
  return (
    <div className="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
      <div className="mx-auto grid w-full max-w-md gap-4">
        <div className="grid gap-4 rounded-2xl border border-border bg-background/90 p-5">
          <MeterRoot value={memory} min={0} max={16} low={10} high={14} optimum={4} valueText={\`\${memory} GB / 16 GB\`}>
            <div className="flex items-center justify-between gap-2">
              <MeterLabel>Memory</MeterLabel>
              <MeterValue />
            </div>
            <MeterTrack><MeterIndicator /></MeterTrack>
          </MeterRoot>
          <MeterRoot value={storage} min={0} max={500} low={300} high={425} optimum={100} valueText={\`\${storage} GB / 500 GB\`}>
            <div className="flex items-center justify-between gap-2">
              <MeterLabel>Local storage</MeterLabel>
              <MeterValue />
            </div>
            <MeterTrack><MeterIndicator /></MeterTrack>
          </MeterRoot>
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={() => setOptimized(true)}>Free cache</Button>
          <Button onClick={() => setOptimized(false)}>Restore load</Button>
        </div>
      </div>
    </div>
  );
}
    `),
  },
  vue: {
    'demo-shadcn-meter': heroVue('@proto.ui/prototypes-shadcn', 3, 'rhea'),
    'demo-shadcn-meter-thresholds': thresholdsVue('@proto.ui/prototypes-shadcn', 3, 'rhea'),
    'demo-shadcn-meter-custom-range': customRangeVue('@proto.ui/prototypes-shadcn', 3, 'rhea'),
    'demo-shadcn-meter-quota-card': quotaCardVue('@proto.ui/prototypes-shadcn', 3, 'rhea'),
    'demo-shadcn-meter-profiles': formatCode(`
<script setup lang="ts">
import { AdaptToVue } from '@proto.ui/adapter-vue';
import { styleScope } from '@proto.ui/prototypes-shadcn/style-scope';
import { meterRoot, meterLabel, meterTrack, meterIndicator, meterValue } from '@proto.ui/prototypes-shadcn/meter';

const StyleScope = AdaptToVue(styleScope);
const MeterRoot = AdaptToVue(meterRoot);
const MeterLabel = AdaptToVue(meterLabel);
const MeterTrack = AdaptToVue(meterTrack);
const MeterIndicator = AdaptToVue(meterIndicator);
const MeterValue = AdaptToVue(meterValue);
const profiles = ['rhea', 'luma', 'lyra', 'sera'] as const;
</script>

<template>
  <div class="mx-auto grid w-full max-w-md gap-5">
    <StyleScope v-for="profile in profiles" :key="profile" :style-profile="profile" class="contents">
      <MeterRoot :value="64" :min="0" :max="100" :low="70" :high="90" :optimum="20" value-text="64%">
        <div class="flex items-center justify-between gap-2">
          <MeterLabel>{{ profile }}</MeterLabel>
          <MeterValue />
        </div>
        <MeterTrack><MeterIndicator /></MeterTrack>
      </MeterRoot>
    </StyleScope>
  </div>
</template>
    `),
    'demo-brutalist-meter': heroVue('@proto.ui/prototypes-brutalist', 3),
    'demo-brutalist-meter-thresholds': thresholdsVue('@proto.ui/prototypes-brutalist', 3),
    'demo-brutalist-meter-custom-range': customRangeVue('@proto.ui/prototypes-brutalist', 3),
    'demo-brutalist-meter-quota-card': quotaCardVue('@proto.ui/prototypes-brutalist', 3),
    'demo-bootstrap-2-3-2-meter': heroVue('@proto.ui/prototypes-bootstrap-2-3-2', 3),
    'demo-bootstrap-2-3-2-meter-thresholds': thresholdsVue(
      '@proto.ui/prototypes-bootstrap-2-3-2',
      3
    ),
    'demo-bootstrap-2-3-2-meter-custom-range': customRangeVue(
      '@proto.ui/prototypes-bootstrap-2-3-2',
      3
    ),
    'demo-bootstrap-2-3-2-meter-quota-card': quotaCardVue(
      '@proto.ui/prototypes-bootstrap-2-3-2',
      3
    ),
    'demo-liquid-glass-meter': heroVue('@proto.ui/prototypes-liquid-glass', 3),
    'demo-liquid-glass-meter-thresholds': thresholdsVue('@proto.ui/prototypes-liquid-glass', 3),
    'demo-liquid-glass-meter-custom-range': customRangeVue('@proto.ui/prototypes-liquid-glass', 3),
    'demo-liquid-glass-meter-surface-layering': formatCode(`
<script setup lang="ts">
import { computed, ref } from 'vue';
import { AdaptToVue } from '@proto.ui/adapter-vue';
import { button } from '@proto.ui/prototypes-liquid-glass/button';
import { meterRoot, meterLabel, meterTrack, meterIndicator, meterValue } from '@proto.ui/prototypes-liquid-glass/meter';

const PuiButton = AdaptToVue(button);
const MeterRoot = AdaptToVue(meterRoot);
const MeterLabel = AdaptToVue(meterLabel);
const MeterTrack = AdaptToVue(meterTrack);
const MeterIndicator = AdaptToVue(meterIndicator);
const MeterValue = AdaptToVue(meterValue);
const optimized = ref(false);
const memory = computed(() => (optimized.value ? 6.2 : 11.4));
const storage = computed(() => (optimized.value ? 240 : 468));
</script>

<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <div class="mx-auto grid w-full max-w-md gap-4">
      <div class="grid gap-4 rounded-2xl border border-border bg-background/90 p-5">
        <MeterRoot :value="memory" :min="0" :max="16" :low="10" :high="14" :optimum="4" :value-text="\`\${memory} GB / 16 GB\`">
          <div class="flex items-center justify-between gap-2">
            <MeterLabel>Memory</MeterLabel>
            <MeterValue />
          </div>
          <MeterTrack><MeterIndicator /></MeterTrack>
        </MeterRoot>
        <MeterRoot :value="storage" :min="0" :max="500" :low="300" :high="425" :optimum="100" :value-text="\`\${storage} GB / 500 GB\`">
          <div class="flex items-center justify-between gap-2">
            <MeterLabel>Local storage</MeterLabel>
            <MeterValue />
          </div>
          <MeterTrack><MeterIndicator /></MeterTrack>
        </MeterRoot>
      </div>
      <div class="flex justify-end gap-2">
        <PuiButton :on-click="() => (optimized = true)">Free cache</PuiButton>
        <PuiButton :on-click="() => (optimized = false)">Restore load</PuiButton>
      </div>
    </div>
  </div>
</template>
    `),
  },
  vue2: {
    'demo-shadcn-meter': heroVue('@proto.ui/prototypes-shadcn', 2, 'rhea'),
    'demo-shadcn-meter-thresholds': thresholdsVue('@proto.ui/prototypes-shadcn', 2, 'rhea'),
    'demo-shadcn-meter-custom-range': customRangeVue('@proto.ui/prototypes-shadcn', 2, 'rhea'),
    'demo-shadcn-meter-quota-card': quotaCardVue('@proto.ui/prototypes-shadcn', 2, 'rhea'),
    'demo-shadcn-meter-profiles': formatCode(`
<template>
  <div class="mx-auto grid w-full max-w-md gap-5">
    <StyleScope v-for="profile in profiles" :key="profile" :style-profile="profile" class="contents">
      <MeterRoot :value="64" :min="0" :max="100" :low="70" :high="90" :optimum="20" value-text="64%">
        <div class="flex items-center justify-between gap-2">
          <MeterLabel>{{ profile }}</MeterLabel>
          <MeterValue />
        </div>
        <MeterTrack><MeterIndicator /></MeterTrack>
      </MeterRoot>
    </StyleScope>
  </div>
</template>

<script>
import { AdaptToVue2 } from '@proto.ui/adapter-vue2';
import { styleScope } from '@proto.ui/prototypes-shadcn/style-scope';
import { meterRoot, meterLabel, meterTrack, meterIndicator, meterValue } from '@proto.ui/prototypes-shadcn/meter';

export default {
  components: {
    StyleScope: AdaptToVue2(styleScope),
    MeterRoot: AdaptToVue2(meterRoot),
    MeterLabel: AdaptToVue2(meterLabel),
    MeterTrack: AdaptToVue2(meterTrack),
    MeterIndicator: AdaptToVue2(meterIndicator),
    MeterValue: AdaptToVue2(meterValue),
  },
  data() {
    return { profiles: ['rhea', 'luma', 'lyra', 'sera'] };
  },
};
</script>
    `),
    'demo-brutalist-meter': heroVue('@proto.ui/prototypes-brutalist', 2),
    'demo-brutalist-meter-thresholds': thresholdsVue('@proto.ui/prototypes-brutalist', 2),
    'demo-brutalist-meter-custom-range': customRangeVue('@proto.ui/prototypes-brutalist', 2),
    'demo-brutalist-meter-quota-card': quotaCardVue('@proto.ui/prototypes-brutalist', 2),
    'demo-bootstrap-2-3-2-meter': heroVue('@proto.ui/prototypes-bootstrap-2-3-2', 2),
    'demo-bootstrap-2-3-2-meter-thresholds': thresholdsVue(
      '@proto.ui/prototypes-bootstrap-2-3-2',
      2
    ),
    'demo-bootstrap-2-3-2-meter-custom-range': customRangeVue(
      '@proto.ui/prototypes-bootstrap-2-3-2',
      2
    ),
    'demo-bootstrap-2-3-2-meter-quota-card': quotaCardVue(
      '@proto.ui/prototypes-bootstrap-2-3-2',
      2
    ),
    'demo-liquid-glass-meter': heroVue('@proto.ui/prototypes-liquid-glass', 2),
    'demo-liquid-glass-meter-thresholds': thresholdsVue('@proto.ui/prototypes-liquid-glass', 2),
    'demo-liquid-glass-meter-custom-range': customRangeVue('@proto.ui/prototypes-liquid-glass', 2),
    'demo-liquid-glass-meter-surface-layering': formatCode(`
<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <div class="mx-auto grid w-full max-w-md gap-4">
      <div class="grid gap-4 rounded-2xl border border-border bg-background/90 p-5">
        <MeterRoot :value="memory" :min="0" :max="16" :low="10" :high="14" :optimum="4" :value-text="\`\${memory} GB / 16 GB\`">
          <div class="flex items-center justify-between gap-2">
            <MeterLabel>Memory</MeterLabel>
            <MeterValue />
          </div>
          <MeterTrack><MeterIndicator /></MeterTrack>
        </MeterRoot>
        <MeterRoot :value="storage" :min="0" :max="500" :low="300" :high="425" :optimum="100" :value-text="\`\${storage} GB / 500 GB\`">
          <div class="flex items-center justify-between gap-2">
            <MeterLabel>Local storage</MeterLabel>
            <MeterValue />
          </div>
          <MeterTrack><MeterIndicator /></MeterTrack>
        </MeterRoot>
      </div>
      <div class="flex justify-end gap-2">
        <PuiButton :on-click="() => (optimized = true)">Free cache</PuiButton>
        <PuiButton :on-click="() => (optimized = false)">Restore load</PuiButton>
      </div>
    </div>
  </div>
</template>

<script>
import { AdaptToVue2 } from '@proto.ui/adapter-vue2';
import { button } from '@proto.ui/prototypes-liquid-glass/button';
import { meterRoot, meterLabel, meterTrack, meterIndicator, meterValue } from '@proto.ui/prototypes-liquid-glass/meter';

export default {
  components: {
    PuiButton: AdaptToVue2(button),
    MeterRoot: AdaptToVue2(meterRoot),
    MeterLabel: AdaptToVue2(meterLabel),
    MeterTrack: AdaptToVue2(meterTrack),
    MeterIndicator: AdaptToVue2(meterIndicator),
    MeterValue: AdaptToVue2(meterValue),
  },
  data() {
    return { optimized: false };
  },
  computed: {
    memory() { return this.optimized ? 6.2 : 11.4; },
    storage() { return this.optimized ? 240 : 468; },
  },
};
</script>
    `),
  },
};
