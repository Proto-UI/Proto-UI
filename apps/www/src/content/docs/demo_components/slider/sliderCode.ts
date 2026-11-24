import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

type FamilyConfig = {
  id: 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass';
  prefix: string;
  wcTag: string;
  pkg: string;
  styleProfileAttr?: string;
  styleProfileProp?: string;
};

const FAMILIES: readonly FamilyConfig[] = [
  {
    id: 'shadcn',
    prefix: 'Shadcn',
    wcTag: 'proto-ui-shadcn',
    pkg: '@proto.ui/prototypes-shadcn/slider',
    styleProfileAttr: ' styleProfile="rhea"',
    styleProfileProp: "styleProfile: 'rhea', ",
  },
  {
    id: 'brutalist',
    prefix: 'Brutalist',
    wcTag: 'proto-ui-brutalist',
    pkg: '@proto.ui/prototypes-brutalist/slider',
  },
  {
    id: 'bootstrap-2-3-2',
    prefix: 'Bootstrap232',
    wcTag: 'proto-ui-bootstrap-2-3-2',
    pkg: '@proto.ui/prototypes-bootstrap-2-3-2/slider',
  },
  {
    id: 'liquid-glass',
    prefix: 'LiquidGlass',
    wcTag: 'proto-ui-liquid-glass',
    pkg: '@proto.ui/prototypes-liquid-glass/slider',
  },
];

function buildFamilySnippets(f: FamilyConfig): Record<RuntimeId, Record<string, string>> {
  const sp = f.styleProfileAttr ?? '';
  const spObj = f.styleProfileProp ?? '';
  const tag = f.wcTag;
  const P = f.prefix;
  const basicId = `demo-${f.id}-slider`;
  const rangeId = `demo-${f.id}-slider-values`;
  const multipleId = `demo-${f.id}-slider-multiple`;
  const verticalId = `demo-${f.id}-slider-vertical`;
  const controlledId = `demo-${f.id}-slider-controlled`;
  const disabledId = `demo-${f.id}-slider-disabled`;
  const rtlId = `demo-${f.id}-slider-rtl`;

  const wc: Record<string, string> = {
    [basicId]: formatCode(`
<div class="mx-auto w-full max-w-xs">
  <${tag}-slider-root id="${basicId}-root">
    <${tag}-slider-label>Volume</${tag}-slider-label>
    <${tag}-slider-value></${tag}-slider-value>
    <${tag}-slider-track>
      <${tag}-slider-indicator></${tag}-slider-indicator>
      <${tag}-slider-thumb></${tag}-slider-thumb>
    </${tag}-slider-track>
  </${tag}-slider-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#${basicId}-root');
  if (root instanceof HTMLElement) {
    setElementProps(root, { ${spObj}defaultValue: 75, min: 0, max: 100, step: 1, ariaLabel: 'Volume' });
  }
</script>
    `),
    [rangeId]: formatCode(`
<div class="mx-auto grid w-full max-w-xs gap-4">
  <${tag}-slider-values-root id="${rangeId}-root">
    <${tag}-slider-values-label>Price range</${tag}-slider-values-label>
    <${tag}-slider-values-value></${tag}-slider-values-value>
    <${tag}-slider-values-track>
      <${tag}-slider-values-indicator></${tag}-slider-values-indicator>
      <${tag}-slider-values-thumb id="${rangeId}-t0"></${tag}-slider-values-thumb>
      <${tag}-slider-values-thumb id="${rangeId}-t1"></${tag}-slider-values-thumb>
    </${tag}-slider-values-track>
  </${tag}-slider-values-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#${rangeId}-root'), {
    ${spObj}defaultValue: [25, 50], min: 0, max: 100, step: 5, minStepsBetweenValues: 1,
  });
  setElementProps(document.querySelector('#${rangeId}-t0'), { index: 0, ariaLabel: 'Minimum price' });
  setElementProps(document.querySelector('#${rangeId}-t1'), { index: 1, ariaLabel: 'Maximum price' });
</script>
    `),
    [multipleId]: formatCode(`
<div class="mx-auto w-full max-w-xs">
  <${tag}-slider-values-root id="${multipleId}-root">
    <${tag}-slider-values-label>Breakpoints</${tag}-slider-values-label>
    <${tag}-slider-values-value></${tag}-slider-values-value>
    <${tag}-slider-values-track>
      <${tag}-slider-values-indicator></${tag}-slider-values-indicator>
      <${tag}-slider-values-thumb id="${multipleId}-t0"></${tag}-slider-values-thumb>
      <${tag}-slider-values-thumb id="${multipleId}-t1"></${tag}-slider-values-thumb>
      <${tag}-slider-values-thumb id="${multipleId}-t2"></${tag}-slider-values-thumb>
    </${tag}-slider-values-track>
  </${tag}-slider-values-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#${multipleId}-root'), {
    ${spObj}defaultValue: [10, 20, 70], min: 0, max: 100, step: 10,
  });
  [0, 1, 2].forEach((index) => {
    setElementProps(document.querySelector('#${multipleId}-t' + index), { index });
  });
</script>
    `),
    [verticalId]: formatCode(`
<div class="mx-auto flex h-40 max-w-xs items-center justify-center gap-8">
  <${tag}-slider-root id="${verticalId}-a">
    <${tag}-slider-track>
      <${tag}-slider-indicator></${tag}-slider-indicator>
      <${tag}-slider-thumb></${tag}-slider-thumb>
    </${tag}-slider-track>
  </${tag}-slider-root>
  <${tag}-slider-root id="${verticalId}-b">
    <${tag}-slider-track>
      <${tag}-slider-indicator></${tag}-slider-indicator>
      <${tag}-slider-thumb></${tag}-slider-thumb>
    </${tag}-slider-track>
  </${tag}-slider-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#${verticalId}-a'), { ${spObj}defaultValue: 50, orientation: 'vertical' });
  setElementProps(document.querySelector('#${verticalId}-b'), { ${spObj}defaultValue: 25, orientation: 'vertical' });
</script>
    `),
    [controlledId]: formatCode(`
<div class="mx-auto grid w-full max-w-xs gap-3">
  <div class="flex items-center justify-between text-sm">
    <span>Temperature</span>
    <span id="${controlledId}-readout">0.3, 0.7</span>
  </div>
  <${tag}-slider-values-root id="${controlledId}-root">
    <${tag}-slider-values-track>
      <${tag}-slider-values-indicator></${tag}-slider-values-indicator>
      <${tag}-slider-values-thumb id="${controlledId}-t0"></${tag}-slider-values-thumb>
      <${tag}-slider-values-thumb id="${controlledId}-t1"></${tag}-slider-values-thumb>
    </${tag}-slider-values-track>
  </${tag}-slider-values-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#${controlledId}-root');
  const readout = document.querySelector('#${controlledId}-readout');
  setElementProps(root, {
    ${spObj}value: [0.3, 0.7], min: 0, max: 1, step: 0.1,
    onValueChange: ({ value }) => {
      setElementProps(root, { value });
      if (readout) readout.textContent = Array.isArray(value) ? value.join(', ') : String(value);
    },
  });
  setElementProps(document.querySelector('#${controlledId}-t0'), { index: 0 });
  setElementProps(document.querySelector('#${controlledId}-t1'), { index: 1 });
</script>
    `),
    [disabledId]: formatCode(`
<div class="mx-auto w-full max-w-xs">
  <${tag}-slider-root id="${disabledId}-root">
    <${tag}-slider-label>Disabled</${tag}-slider-label>
    <${tag}-slider-track>
      <${tag}-slider-indicator></${tag}-slider-indicator>
      <${tag}-slider-thumb></${tag}-slider-thumb>
    </${tag}-slider-track>
  </${tag}-slider-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#${disabledId}-root'), {
    ${spObj}defaultValue: 50, min: 0, max: 100, step: 1, disabled: true,
  });
</script>
    `),
  };

  const react: Record<string, string> = {
    [basicId]: formatCode(`
import {
  ${P}SliderRoot,
  ${P}SliderLabel,
  ${P}SliderValue,
  ${P}SliderTrack,
  ${P}SliderIndicator,
  ${P}SliderThumb,
} from '../proto-ui/components/react';

export function SliderDemo() {
  return (
    <div className="mx-auto w-full max-w-xs">
      <${P}SliderRoot${sp} defaultValue={75} min={0} max={100} step={1} ariaLabel="Volume">
        <${P}SliderLabel>Volume</${P}SliderLabel>
        <${P}SliderValue />
        <${P}SliderTrack>
          <${P}SliderIndicator />
          <${P}SliderThumb />
        </${P}SliderTrack>
      </${P}SliderRoot>
    </div>
  );
}
    `),
    [rangeId]: formatCode(`
import {
  ${P}SliderValuesRoot,
  ${P}SliderValuesLabel,
  ${P}SliderValuesValue,
  ${P}SliderValuesTrack,
  ${P}SliderValuesIndicator,
  ${P}SliderValuesThumb,
} from '../proto-ui/components/react';

export function SliderRangeDemo() {
  return (
    <div className="mx-auto w-full max-w-xs">
      <${P}SliderValuesRoot${sp} defaultValue={[25, 50]} min={0} max={100} step={5} minStepsBetweenValues={1}>
        <${P}SliderValuesLabel>Price range</${P}SliderValuesLabel>
        <${P}SliderValuesValue />
        <${P}SliderValuesTrack>
          <${P}SliderValuesIndicator />
          <${P}SliderValuesThumb index={0} ariaLabel="Minimum price" />
          <${P}SliderValuesThumb index={1} ariaLabel="Maximum price" />
        </${P}SliderValuesTrack>
      </${P}SliderValuesRoot>
    </div>
  );
}
    `),
    [multipleId]: formatCode(`
import {
  ${P}SliderValuesRoot,
  ${P}SliderValuesLabel,
  ${P}SliderValuesValue,
  ${P}SliderValuesTrack,
  ${P}SliderValuesIndicator,
  ${P}SliderValuesThumb,
} from '../proto-ui/components/react';

export function SliderMultipleDemo() {
  return (
    <div className="mx-auto w-full max-w-xs">
      <${P}SliderValuesRoot${sp} defaultValue={[10, 20, 70]} min={0} max={100} step={10}>
        <${P}SliderValuesLabel>Breakpoints</${P}SliderValuesLabel>
        <${P}SliderValuesValue />
        <${P}SliderValuesTrack>
          <${P}SliderValuesIndicator />
          <${P}SliderValuesThumb index={0} ariaLabel="First stop" />
          <${P}SliderValuesThumb index={1} ariaLabel="Second stop" />
          <${P}SliderValuesThumb index={2} ariaLabel="Third stop" />
        </${P}SliderValuesTrack>
      </${P}SliderValuesRoot>
    </div>
  );
}
    `),
    [verticalId]: formatCode(`
import {
  ${P}SliderRoot,
  ${P}SliderTrack,
  ${P}SliderIndicator,
  ${P}SliderThumb,
} from '../proto-ui/components/react';

export function SliderVerticalDemo() {
  return (
    <div className="mx-auto flex h-40 max-w-xs items-center justify-center gap-8">
      <${P}SliderRoot${sp} defaultValue={50} orientation="vertical" ariaLabel="Bass">
        <${P}SliderTrack>
          <${P}SliderIndicator />
          <${P}SliderThumb />
        </${P}SliderTrack>
      </${P}SliderRoot>
      <${P}SliderRoot${sp} defaultValue={25} orientation="vertical" ariaLabel="Treble">
        <${P}SliderTrack>
          <${P}SliderIndicator />
          <${P}SliderThumb />
        </${P}SliderTrack>
      </${P}SliderRoot>
    </div>
  );
}
    `),
    [controlledId]: formatCode(`
import { useState } from 'react';
import {
  ${P}SliderValuesRoot,
  ${P}SliderValuesTrack,
  ${P}SliderValuesIndicator,
  ${P}SliderValuesThumb,
} from '../proto-ui/components/react';

export function SliderControlledDemo() {
  const [value, setValue] = useState<readonly number[]>([0.3, 0.7]);
  return (
    <div className="mx-auto grid w-full max-w-xs gap-3">
      <div className="flex items-center justify-between text-sm">
        <span>Temperature</span>
        <span>{value.join(', ')}</span>
      </div>
      <${P}SliderValuesRoot${sp}
        value={value}
        onValueChange={(e) => Array.isArray(e.value) && setValue(e.value)}
        min={0}
        max={1}
        step={0.1}
      >
        <${P}SliderValuesTrack>
          <${P}SliderValuesIndicator />
          <${P}SliderValuesThumb index={0} ariaLabel="Minimum temperature" />
          <${P}SliderValuesThumb index={1} ariaLabel="Maximum temperature" />
        </${P}SliderValuesTrack>
      </${P}SliderValuesRoot>
    </div>
  );
}
    `),
    [disabledId]: formatCode(`
import {
  ${P}SliderRoot,
  ${P}SliderLabel,
  ${P}SliderTrack,
  ${P}SliderIndicator,
  ${P}SliderThumb,
} from '../proto-ui/components/react';

export function SliderDisabledDemo() {
  return (
    <div className="mx-auto w-full max-w-xs">
      <${P}SliderRoot${sp} defaultValue={50} min={0} max={100} step={1} disabled>
        <${P}SliderLabel>Disabled</${P}SliderLabel>
        <${P}SliderTrack>
          <${P}SliderIndicator />
          <${P}SliderThumb />
        </${P}SliderTrack>
      </${P}SliderRoot>
    </div>
  );
}
    `),
  };

  const vue: Record<string, string> = {
    [basicId]: formatCode(`
<script setup lang="ts">
import {
  ${P}SliderRoot,
  ${P}SliderLabel,
  ${P}SliderValue,
  ${P}SliderTrack,
  ${P}SliderIndicator,
  ${P}SliderThumb,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="mx-auto w-full max-w-xs">
    <${P}SliderRoot${sp} :default-value="75" :min="0" :max="100" :step="1" aria-label="Volume">
      <${P}SliderLabel>Volume</${P}SliderLabel>
      <${P}SliderValue />
      <${P}SliderTrack>
        <${P}SliderIndicator />
        <${P}SliderThumb />
      </${P}SliderTrack>
    </${P}SliderRoot>
  </div>
</template>
    `),
    [rangeId]: formatCode(`
<script setup lang="ts">
import {
  ${P}SliderValuesRoot,
  ${P}SliderValuesLabel,
  ${P}SliderValuesValue,
  ${P}SliderValuesTrack,
  ${P}SliderValuesIndicator,
  ${P}SliderValuesThumb,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="mx-auto w-full max-w-xs">
    <${P}SliderValuesRoot${sp} :default-value="[25, 50]" :min="0" :max="100" :step="5" :min-steps-between-values="1">
      <${P}SliderValuesLabel>Price range</${P}SliderValuesLabel>
      <${P}SliderValuesValue />
      <${P}SliderValuesTrack>
        <${P}SliderValuesIndicator />
        <${P}SliderValuesThumb :index="0" aria-label="Minimum price" />
        <${P}SliderValuesThumb :index="1" aria-label="Maximum price" />
      </${P}SliderValuesTrack>
    </${P}SliderValuesRoot>
  </div>
</template>
    `),
    [multipleId]: formatCode(`
<script setup lang="ts">
import {
  ${P}SliderValuesRoot,
  ${P}SliderValuesLabel,
  ${P}SliderValuesValue,
  ${P}SliderValuesTrack,
  ${P}SliderValuesIndicator,
  ${P}SliderValuesThumb,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="mx-auto w-full max-w-xs">
    <${P}SliderValuesRoot${sp} :default-value="[10, 20, 70]" :min="0" :max="100" :step="10">
      <${P}SliderValuesLabel>Breakpoints</${P}SliderValuesLabel>
      <${P}SliderValuesValue />
      <${P}SliderValuesTrack>
        <${P}SliderValuesIndicator />
        <${P}SliderValuesThumb :index="0" />
        <${P}SliderValuesThumb :index="1" />
        <${P}SliderValuesThumb :index="2" />
      </${P}SliderValuesTrack>
    </${P}SliderValuesRoot>
  </div>
</template>
    `),
    [verticalId]: formatCode(`
<script setup lang="ts">
import {
  ${P}SliderRoot,
  ${P}SliderTrack,
  ${P}SliderIndicator,
  ${P}SliderThumb,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="mx-auto flex h-40 max-w-xs items-center justify-center gap-8">
    <${P}SliderRoot${sp} :default-value="50" orientation="vertical">
      <${P}SliderTrack>
        <${P}SliderIndicator />
        <${P}SliderThumb />
      </${P}SliderTrack>
    </${P}SliderRoot>
    <${P}SliderRoot${sp} :default-value="25" orientation="vertical">
      <${P}SliderTrack>
        <${P}SliderIndicator />
        <${P}SliderThumb />
      </${P}SliderTrack>
    </${P}SliderRoot>
  </div>
</template>
    `),
    [controlledId]: formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  ${P}SliderValuesRoot,
  ${P}SliderValuesTrack,
  ${P}SliderValuesIndicator,
  ${P}SliderValuesThumb,
} from '../proto-ui/components/vue';

const value = ref([0.3, 0.7]);
</script>

<template>
  <div class="mx-auto grid w-full max-w-xs gap-3">
    <div class="flex items-center justify-between text-sm">
      <span>Temperature</span>
      <span>{{ value.join(', ') }}</span>
    </div>
    <${P}SliderValuesRoot${sp}
      :value="value"
      :min="0"
      :max="1"
      :step="0.1"
      @value-change="(e) => { if (Array.isArray(e.value)) value = [...e.value]; }"
    >
      <${P}SliderValuesTrack>
        <${P}SliderValuesIndicator />
        <${P}SliderValuesThumb :index="0" />
        <${P}SliderValuesThumb :index="1" />
      </${P}SliderValuesTrack>
    </${P}SliderValuesRoot>
  </div>
</template>
    `),
    [disabledId]: formatCode(`
<script setup lang="ts">
import {
  ${P}SliderRoot,
  ${P}SliderLabel,
  ${P}SliderTrack,
  ${P}SliderIndicator,
  ${P}SliderThumb,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="mx-auto w-full max-w-xs">
    <${P}SliderRoot${sp} :default-value="50" :min="0" :max="100" :step="1" :disabled="true">
      <${P}SliderLabel>Disabled</${P}SliderLabel>
      <${P}SliderTrack>
        <${P}SliderIndicator />
        <${P}SliderThumb />
      </${P}SliderTrack>
    </${P}SliderRoot>
  </div>
</template>
    `),
  };

  const vue2: Record<string, string> = {
    [basicId]: formatCode(`
<template>
  <div class="mx-auto w-full max-w-xs">
    <${P}SliderRoot${sp} :default-value="75" :min="0" :max="100" :step="1" aria-label="Volume">
      <${P}SliderLabel>Volume</${P}SliderLabel>
      <${P}SliderValue />
      <${P}SliderTrack>
        <${P}SliderIndicator />
        <${P}SliderThumb />
      </${P}SliderTrack>
    </${P}SliderRoot>
  </div>
</template>

<script>
import {
  ${P}SliderRoot,
  ${P}SliderLabel,
  ${P}SliderValue,
  ${P}SliderTrack,
  ${P}SliderIndicator,
  ${P}SliderThumb,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${P}SliderRoot,
    ${P}SliderLabel,
    ${P}SliderValue,
    ${P}SliderTrack,
    ${P}SliderIndicator,
    ${P}SliderThumb,
  },
};
</script>
    `),
    [rangeId]: formatCode(`
<template>
  <div class="mx-auto w-full max-w-xs">
    <${P}SliderValuesRoot${sp} :default-value="[25, 50]" :min="0" :max="100" :step="5">
      <${P}SliderValuesLabel>Price range</${P}SliderValuesLabel>
      <${P}SliderValuesValue />
      <${P}SliderValuesTrack>
        <${P}SliderValuesIndicator />
        <${P}SliderValuesThumb :index="0" />
        <${P}SliderValuesThumb :index="1" />
      </${P}SliderValuesTrack>
    </${P}SliderValuesRoot>
  </div>
</template>

<script>
import {
  ${P}SliderValuesRoot,
  ${P}SliderValuesLabel,
  ${P}SliderValuesValue,
  ${P}SliderValuesTrack,
  ${P}SliderValuesIndicator,
  ${P}SliderValuesThumb,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${P}SliderValuesRoot,
    ${P}SliderValuesLabel,
    ${P}SliderValuesValue,
    ${P}SliderValuesTrack,
    ${P}SliderValuesIndicator,
    ${P}SliderValuesThumb,
  },
};
</script>
    `),
    [multipleId]: formatCode(`
<template>
  <div class="mx-auto w-full max-w-xs">
    <${P}SliderValuesRoot${sp} :default-value="[10, 20, 70]" :min="0" :max="100" :step="10">
      <${P}SliderValuesLabel>Breakpoints</${P}SliderValuesLabel>
      <${P}SliderValuesValue />
      <${P}SliderValuesTrack>
        <${P}SliderValuesIndicator />
        <${P}SliderValuesThumb :index="0" />
        <${P}SliderValuesThumb :index="1" />
        <${P}SliderValuesThumb :index="2" />
      </${P}SliderValuesTrack>
    </${P}SliderValuesRoot>
  </div>
</template>

<script>
import {
  ${P}SliderValuesRoot,
  ${P}SliderValuesLabel,
  ${P}SliderValuesValue,
  ${P}SliderValuesTrack,
  ${P}SliderValuesIndicator,
  ${P}SliderValuesThumb,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${P}SliderValuesRoot,
    ${P}SliderValuesLabel,
    ${P}SliderValuesValue,
    ${P}SliderValuesTrack,
    ${P}SliderValuesIndicator,
    ${P}SliderValuesThumb,
  },
};
</script>
    `),
    [verticalId]: formatCode(`
<template>
  <div class="mx-auto flex h-40 max-w-xs items-center justify-center gap-8">
    <${P}SliderRoot${sp} :default-value="50" orientation="vertical">
      <${P}SliderTrack>
        <${P}SliderIndicator />
        <${P}SliderThumb />
      </${P}SliderTrack>
    </${P}SliderRoot>
    <${P}SliderRoot${sp} :default-value="25" orientation="vertical">
      <${P}SliderTrack>
        <${P}SliderIndicator />
        <${P}SliderThumb />
      </${P}SliderTrack>
    </${P}SliderRoot>
  </div>
</template>

<script>
import {
  ${P}SliderRoot,
  ${P}SliderTrack,
  ${P}SliderIndicator,
  ${P}SliderThumb,
} from '../proto-ui/components/vue2';

export default {
  components: { ${P}SliderRoot, ${P}SliderTrack, ${P}SliderIndicator, ${P}SliderThumb },
};
</script>
    `),
    [controlledId]: formatCode(`
<template>
  <div class="mx-auto grid w-full max-w-xs gap-3">
    <div class="flex items-center justify-between text-sm">
      <span>Temperature</span>
      <span>{{ value.join(', ') }}</span>
    </div>
    <${P}SliderValuesRoot${sp} :value="value" :min="0" :max="1" :step="0.1" @value-change="onChange">
      <${P}SliderValuesTrack>
        <${P}SliderValuesIndicator />
        <${P}SliderValuesThumb :index="0" />
        <${P}SliderValuesThumb :index="1" />
      </${P}SliderValuesTrack>
    </${P}SliderValuesRoot>
  </div>
</template>

<script>
import {
  ${P}SliderValuesRoot,
  ${P}SliderValuesTrack,
  ${P}SliderValuesIndicator,
  ${P}SliderValuesThumb,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${P}SliderValuesRoot,
    ${P}SliderValuesTrack,
    ${P}SliderValuesIndicator,
    ${P}SliderValuesThumb,
  },
  data() {
    return { value: [0.3, 0.7] };
  },
  methods: {
    onChange(e) {
      if (Array.isArray(e.value)) this.value = [...e.value];
    },
  },
};
</script>
    `),
    [disabledId]: formatCode(`
<template>
  <div class="mx-auto w-full max-w-xs">
    <${P}SliderRoot${sp} :default-value="50" :min="0" :max="100" :step="1" :disabled="true">
      <${P}SliderLabel>Disabled</${P}SliderLabel>
      <${P}SliderTrack>
        <${P}SliderIndicator />
        <${P}SliderThumb />
      </${P}SliderTrack>
    </${P}SliderRoot>
  </div>
</template>

<script>
import {
  ${P}SliderRoot,
  ${P}SliderLabel,
  ${P}SliderTrack,
  ${P}SliderIndicator,
  ${P}SliderThumb,
} from '../proto-ui/components/vue2';

export default {
  components: { ${P}SliderRoot, ${P}SliderLabel, ${P}SliderTrack, ${P}SliderIndicator, ${P}SliderThumb },
};
</script>
    `),
  };

  if (f.id === 'shadcn') {
    wc[rtlId] = formatCode(`
<div class="mx-auto w-full max-w-xs">
  <${tag}-slider-root id="${rtlId}-root">
    <${tag}-slider-label>Direction: RTL</${tag}-slider-label>
    <${tag}-slider-value></${tag}-slider-value>
    <${tag}-slider-track>
      <${tag}-slider-indicator></${tag}-slider-indicator>
      <${tag}-slider-thumb></${tag}-slider-thumb>
    </${tag}-slider-track>
  </${tag}-slider-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#${rtlId}-root'), {
    ${spObj}defaultValue: 75, min: 0, max: 100, step: 1, direction: 'rtl',
  });
</script>
    `);
    react[rtlId] = formatCode(`
import {
  ${P}SliderRoot,
  ${P}SliderLabel,
  ${P}SliderValue,
  ${P}SliderTrack,
  ${P}SliderIndicator,
  ${P}SliderThumb,
} from '../proto-ui/components/react';

export function SliderRtlDemo() {
  return (
    <div className="mx-auto w-full max-w-xs">
      <${P}SliderRoot${sp} defaultValue={75} min={0} max={100} step={1} direction="rtl">
        <${P}SliderLabel>Direction: RTL</${P}SliderLabel>
        <${P}SliderValue />
        <${P}SliderTrack>
          <${P}SliderIndicator />
          <${P}SliderThumb />
        </${P}SliderTrack>
      </${P}SliderRoot>
    </div>
  );
}
    `);
    vue[rtlId] = formatCode(`
<script setup lang="ts">
import {
  ${P}SliderRoot,
  ${P}SliderLabel,
  ${P}SliderValue,
  ${P}SliderTrack,
  ${P}SliderIndicator,
  ${P}SliderThumb,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="mx-auto w-full max-w-xs">
    <${P}SliderRoot${sp} :default-value="75" :min="0" :max="100" :step="1" direction="rtl">
      <${P}SliderLabel>Direction: RTL</${P}SliderLabel>
      <${P}SliderValue />
      <${P}SliderTrack>
        <${P}SliderIndicator />
        <${P}SliderThumb />
      </${P}SliderTrack>
    </${P}SliderRoot>
  </div>
</template>
    `);
    vue2[rtlId] = formatCode(`
<template>
  <div class="mx-auto w-full max-w-xs">
    <${P}SliderRoot${sp} :default-value="75" :min="0" :max="100" :step="1" direction="rtl">
      <${P}SliderLabel>Direction: RTL</${P}SliderLabel>
      <${P}SliderValue />
      <${P}SliderTrack>
        <${P}SliderIndicator />
        <${P}SliderThumb />
      </${P}SliderTrack>
    </${P}SliderRoot>
  </div>
</template>

<script>
import {
  ${P}SliderRoot,
  ${P}SliderLabel,
  ${P}SliderValue,
  ${P}SliderTrack,
  ${P}SliderIndicator,
  ${P}SliderThumb,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${P}SliderRoot,
    ${P}SliderLabel,
    ${P}SliderValue,
    ${P}SliderTrack,
    ${P}SliderIndicator,
    ${P}SliderThumb,
  },
};
</script>
    `);
  }

  return { wc, react, vue, vue2 };
}

const merged: Record<RuntimeId, Record<string, string>> = {
  wc: {},
  react: {},
  vue: {},
  vue2: {},
};

for (const family of FAMILIES) {
  const snippets = buildFamilySnippets(family);
  Object.assign(merged.wc, snippets.wc);
  Object.assign(merged.react, snippets.react);
  Object.assign(merged.vue, snippets.vue);
  Object.assign(merged.vue2, snippets.vue2);
}

export const codeMap: Record<RuntimeId, Record<string, string>> = merged;
