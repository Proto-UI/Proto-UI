import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

type FamilyMeta = {
  id: 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass';
  pascal: string;
  tagPrefix: string;
  styleProfileAttr: string;
  styleProfileProp: string;
};

const FAMILIES: readonly FamilyMeta[] = [
  {
    id: 'shadcn',
    pascal: 'Shadcn',
    tagPrefix: 'proto-ui-shadcn-number-field',
    styleProfileAttr: ' styleProfile="rhea"',
    styleProfileProp: "styleProfile: 'rhea', ",
  },
  {
    id: 'brutalist',
    pascal: 'Brutalist',
    tagPrefix: 'proto-ui-brutalist-number-field',
    styleProfileAttr: '',
    styleProfileProp: '',
  },
  {
    id: 'bootstrap-2-3-2',
    pascal: 'Bootstrap232',
    tagPrefix: 'proto-ui-bootstrap-2-3-2-number-field',
    styleProfileAttr: '',
    styleProfileProp: '',
  },
  {
    id: 'liquid-glass',
    pascal: 'LiquidGlass',
    tagPrefix: 'proto-ui-liquid-glass-number-field',
    styleProfileAttr: '',
    styleProfileProp: '',
  },
];

function wcField(
  tagPrefix: string,
  id: string,
  label: string,
  decLabel: string,
  incLabel: string
): string {
  return `  <${tagPrefix}-root id="${id}">
    <${tagPrefix}-label>${label}</${tagPrefix}-label>
    <${tagPrefix}-decrement><span aria-hidden="true">−</span><span class="sr-only">${decLabel}</span></${tagPrefix}-decrement>
    <${tagPrefix}-input></${tagPrefix}-input>
    <${tagPrefix}-increment><span aria-hidden="true">+</span><span class="sr-only">${incLabel}</span></${tagPrefix}-increment>
  </${tagPrefix}-root>`;
}

function reactField(
  p: string,
  propsExpr: string,
  label: string,
  decLabel: string,
  incLabel: string
): string {
  return `      <${p}NumberFieldRoot${propsExpr}>
        <${p}NumberFieldLabel>${label}</${p}NumberFieldLabel>
        <${p}NumberFieldDecrement>
          <span aria-hidden="true">−</span><span className="sr-only">${decLabel}</span>
        </${p}NumberFieldDecrement>
        <${p}NumberFieldInput />
        <${p}NumberFieldIncrement>
          <span aria-hidden="true">+</span><span className="sr-only">${incLabel}</span>
        </${p}NumberFieldIncrement>
      </${p}NumberFieldRoot>`;
}

function vueField(
  p: string,
  propsExpr: string,
  label: string,
  decLabel: string,
  incLabel: string
): string {
  return `    <${p}NumberFieldRoot${propsExpr}>
      <${p}NumberFieldLabel>${label}</${p}NumberFieldLabel>
      <${p}NumberFieldDecrement><span aria-hidden="true">−</span><span class="sr-only">${decLabel}</span></${p}NumberFieldDecrement>
      <${p}NumberFieldInput />
      <${p}NumberFieldIncrement><span aria-hidden="true">+</span><span class="sr-only">${incLabel}</span></${p}NumberFieldIncrement>
    </${p}NumberFieldRoot>`;
}

function buildFamilySnippets(family: FamilyMeta): Record<RuntimeId, Record<string, string>> {
  const { id, pascal: p, tagPrefix: t, styleProfileAttr: sa, styleProfileProp: sp } = family;
  const baseId = `demo-${id}-number-field`;
  const parts = `${p}NumberFieldRoot, ${p}NumberFieldLabel, ${p}NumberFieldDecrement, ${p}NumberFieldInput, ${p}NumberFieldIncrement`;

  const wc: Record<string, string> = {
    [baseId]: formatCode(`
<div class="grid w-full max-w-xs gap-4">
${wcField(t, 'quantity-field', 'Quantity', 'Decrease Quantity', 'Increase Quantity')}
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#quantity-field');
  if (root instanceof HTMLElement) {
    setElementProps(root, { ${sp}defaultValue: 12, min: 0, max: 100, step: 1, ariaLabel: 'Quantity' });
  }
</script>
    `),
    [`${baseId}-formatting`]: formatCode(`
<div class="grid w-full max-w-xs gap-4">
${wcField(t, 'budget-field', 'Budget (USD)', 'Decrease Budget', 'Increase Budget')}
${wcField(t, 'discount-field', 'Discount rate', 'Decrease Discount rate', 'Increase Discount rate')}
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const budget = document.querySelector('#budget-field');
  const discount = document.querySelector('#discount-field');
  if (budget instanceof HTMLElement) {
    setElementProps(budget, {
      ${sp}defaultValue: 1250,
      min: 0,
      max: 100000,
      step: 25,
      locale: 'en-US',
      formatOptions: { style: 'currency', currency: 'USD' },
      ariaLabel: 'Budget (USD)',
    });
  }
  if (discount instanceof HTMLElement) {
    setElementProps(discount, {
      ${sp}defaultValue: 0.25,
      min: 0,
      max: 1,
      step: 0.05,
      locale: 'en-US',
      formatOptions: { style: 'percent' },
      ariaLabel: 'Discount rate',
    });
  }
</script>
    `),
    [`${baseId}-scrub-nullable`]: formatCode(`
<div class="grid w-full max-w-xs gap-4">
${wcField(t, 'opacity-field', 'Opacity (drag label)', 'Decrease Opacity', 'Increase Opacity')}
${wcField(t, 'seats-field', 'Optional seat limit', 'Decrease Optional seat limit', 'Increase Optional seat limit')}
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const opacity = document.querySelector('#opacity-field');
  const seats = document.querySelector('#seats-field');
  if (opacity instanceof HTMLElement) {
    setElementProps(opacity, {
      ${sp}defaultValue: 60,
      min: 0,
      max: 100,
      step: 1,
      scrub: true,
      scrubSteps: 50,
      ariaLabel: 'Opacity',
    });
  }
  if (seats instanceof HTMLElement) {
    setElementProps(seats, {
      ${sp}defaultValue: null,
      min: 1,
      max: 500,
      step: 1,
      allowEmpty: true,
      ariaLabel: 'Optional seat limit',
    });
  }
</script>
    `),
    [`${baseId}-states`]: formatCode(`
<div class="grid w-full max-w-xs gap-4">
${wcField(t, 'disabled-field', 'Disabled', 'Decrease Disabled', 'Increase Disabled')}
${wcField(t, 'readonly-field', 'Read-only', 'Decrease Read-only', 'Increase Read-only')}
${wcField(t, 'unbounded-field', 'Unbounded offset', 'Decrease Unbounded offset', 'Increase Unbounded offset')}
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const disabled = document.querySelector('#disabled-field');
  const readOnly = document.querySelector('#readonly-field');
  const unbounded = document.querySelector('#unbounded-field');
  if (disabled instanceof HTMLElement) setElementProps(disabled, { ${sp}defaultValue: 42, disabled: true });
  if (readOnly instanceof HTMLElement) setElementProps(readOnly, { ${sp}defaultValue: 24, readOnly: true });
  if (unbounded instanceof HTMLElement) {
    setElementProps(unbounded, { ${sp}defaultValue: 3.14, min: null, max: null, step: 0.5, snapToStep: false });
  }
</script>
    `),
    [`${baseId}-controlled`]: formatCode(`
<div class="grid w-full max-w-xs gap-4">
${wcField(t, 'controlled-field', 'Controlled volume', 'Decrease Controlled volume', 'Increase Controlled volume')}
  <div id="controlled-status" role="status" aria-live="polite" class="text-xs text-muted-foreground tabular-nums">
    Accepted value: 25 · Commits: 0
  </div>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#controlled-field');
  const status = document.querySelector('#controlled-status');
  let value = 25;
  let commits = 0;
  const sync = () => {
    if (root instanceof HTMLElement) {
      setElementProps(root, { ${sp}value, min: 0, max: 100, step: 5, allowEmpty: true });
    }
    if (status) status.textContent = 'Accepted value: ' + (value ?? 'empty') + ' · Commits: ' + commits;
  };
  sync();
  root?.addEventListener('valueChange', (event) => {
    value = event.detail.value;
    sync();
  });
  root?.addEventListener('valueCommit', (event) => {
    value = event.detail.value;
    commits += 1;
    sync();
  });
</script>
    `),
    [`${baseId}-rtl`]: formatCode(`
<div dir="rtl" class="grid w-full max-w-xs gap-4">
${wcField(t, 'rtl-field', 'الكمية (اسحب التسمية)', 'إنقاص الكمية', 'زيادة الكمية')}
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#rtl-field');
  if (root instanceof HTMLElement) {
    setElementProps(root, {
      ${sp}defaultValue: 40,
      min: 0,
      max: 100,
      step: 5,
      direction: 'rtl',
      scrub: true,
      scrubSteps: 20,
      ariaLabel: 'الكمية',
    });
  }
</script>
    `),
  };

  const react: Record<string, string> = {
    [baseId]: formatCode(`
import { ${parts} } from '../proto-ui/components/react';

export function NumberFieldDemo() {
  return (
    <div className="grid w-full max-w-xs gap-4">
${reactField(p, `${sa} defaultValue={12} min={0} max={100} step={1} ariaLabel="Quantity"`, 'Quantity', 'Decrease Quantity', 'Increase Quantity')}
    </div>
  );
}
    `),
    [`${baseId}-formatting`]: formatCode(`
import { ${parts} } from '../proto-ui/components/react';

export function NumberFieldFormattingDemo() {
  return (
    <div className="grid w-full max-w-xs gap-4">
${reactField(p, `${sa} defaultValue={1250} min={0} max={100000} step={25} locale="en-US" formatOptions={{ style: 'currency', currency: 'USD' }} ariaLabel="Budget (USD)"`, 'Budget (USD)', 'Decrease Budget', 'Increase Budget')}
${reactField(p, `${sa} defaultValue={0.25} min={0} max={1} step={0.05} locale="en-US" formatOptions={{ style: 'percent' }} ariaLabel="Discount rate"`, 'Discount rate', 'Decrease Discount rate', 'Increase Discount rate')}
    </div>
  );
}
    `),
    [`${baseId}-scrub-nullable`]: formatCode(`
import { ${parts} } from '../proto-ui/components/react';

export function NumberFieldScrubNullableDemo() {
  return (
    <div className="grid w-full max-w-xs gap-4">
${reactField(p, `${sa} defaultValue={60} min={0} max={100} step={1} scrub scrubSteps={50} ariaLabel="Opacity"`, 'Opacity (drag label)', 'Decrease Opacity', 'Increase Opacity')}
${reactField(p, `${sa} defaultValue={null} min={1} max={500} step={1} allowEmpty ariaLabel="Optional seat limit"`, 'Optional seat limit', 'Decrease Optional seat limit', 'Increase Optional seat limit')}
    </div>
  );
}
    `),
    [`${baseId}-states`]: formatCode(`
import { ${parts} } from '../proto-ui/components/react';

export function NumberFieldStatesDemo() {
  return (
    <div className="grid w-full max-w-xs gap-4">
${reactField(p, `${sa} defaultValue={42} disabled ariaLabel="Disabled quantity"`, 'Disabled', 'Decrease Disabled', 'Increase Disabled')}
${reactField(p, `${sa} defaultValue={24} readOnly ariaLabel="Read-only quantity"`, 'Read-only', 'Decrease Read-only', 'Increase Read-only')}
${reactField(p, `${sa} defaultValue={3.14} min={null} max={null} step={0.5} snapToStep={false} ariaLabel="Unbounded offset"`, 'Unbounded offset', 'Decrease Unbounded offset', 'Increase Unbounded offset')}
    </div>
  );
}
    `),
    [`${baseId}-controlled`]: formatCode(`
import { useState } from 'react';
import { ${parts} } from '../proto-ui/components/react';

export function NumberFieldControlledDemo() {
  const [value, setValue] = useState<number | null>(25);
  const [commits, setCommits] = useState(0);

  return (
    <div className="grid w-full max-w-xs gap-4">
${reactField(p, `${sa} value={value} min={0} max={100} step={5} allowEmpty ariaLabel="Controlled volume" onValueChange={({ value: next }) => setValue(next)} onValueCommit={({ value: next }) => { setValue(next); setCommits((n) => n + 1); }}`, 'Controlled volume', 'Decrease Controlled volume', 'Increase Controlled volume')}
      <div role="status" aria-live="polite" className="text-xs text-muted-foreground tabular-nums">
        Accepted value: {value ?? 'empty'} · Commits: {commits}
      </div>
    </div>
  );
}
    `),
    [`${baseId}-rtl`]: formatCode(`
import { ${parts} } from '../proto-ui/components/react';

export function NumberFieldRtlDemo() {
  return (
    <div dir="rtl" className="grid w-full max-w-xs gap-4">
${reactField(p, `${sa} defaultValue={40} min={0} max={100} step={5} direction="rtl" scrub scrubSteps={20} ariaLabel="الكمية"`, 'الكمية (اسحب التسمية)', 'إنقاص الكمية', 'زيادة الكمية')}
    </div>
  );
}
    `),
  };

  const vue: Record<string, string> = {
    [baseId]: formatCode(`
<script setup lang="ts">
import { ${parts} } from '../proto-ui/components/vue';
</script>

<template>
  <div class="grid w-full max-w-xs gap-4">
${vueField(p, `${sa} :default-value="12" :min="0" :max="100" :step="1" aria-label="Quantity"`, 'Quantity', 'Decrease Quantity', 'Increase Quantity')}
  </div>
</template>
    `),
    [`${baseId}-formatting`]: formatCode(`
<script setup lang="ts">
import { ${parts} } from '../proto-ui/components/vue';
</script>

<template>
  <div class="grid w-full max-w-xs gap-4">
${vueField(p, `${sa} :default-value="1250" :min="0" :max="100000" :step="25" locale="en-US" :format-options="{ style: 'currency', currency: 'USD' }" aria-label="Budget (USD)"`, 'Budget (USD)', 'Decrease Budget', 'Increase Budget')}
${vueField(p, `${sa} :default-value="0.25" :min="0" :max="1" :step="0.05" locale="en-US" :format-options="{ style: 'percent' }" aria-label="Discount rate"`, 'Discount rate', 'Decrease Discount rate', 'Increase Discount rate')}
  </div>
</template>
    `),
    [`${baseId}-scrub-nullable`]: formatCode(`
<script setup lang="ts">
import { ${parts} } from '../proto-ui/components/vue';
</script>

<template>
  <div class="grid w-full max-w-xs gap-4">
${vueField(p, `${sa} :default-value="60" :min="0" :max="100" :step="1" :scrub="true" :scrub-steps="50" aria-label="Opacity"`, 'Opacity (drag label)', 'Decrease Opacity', 'Increase Opacity')}
${vueField(p, `${sa} :default-value="null" :min="1" :max="500" :step="1" :allow-empty="true" aria-label="Optional seat limit"`, 'Optional seat limit', 'Decrease Optional seat limit', 'Increase Optional seat limit')}
  </div>
</template>
    `),
    [`${baseId}-states`]: formatCode(`
<script setup lang="ts">
import { ${parts} } from '../proto-ui/components/vue';
</script>

<template>
  <div class="grid w-full max-w-xs gap-4">
${vueField(p, `${sa} :default-value="42" :disabled="true" aria-label="Disabled quantity"`, 'Disabled', 'Decrease Disabled', 'Increase Disabled')}
${vueField(p, `${sa} :default-value="24" :read-only="true" aria-label="Read-only quantity"`, 'Read-only', 'Decrease Read-only', 'Increase Read-only')}
${vueField(p, `${sa} :default-value="3.14" :min="null" :max="null" :step="0.5" :snap-to-step="false" aria-label="Unbounded offset"`, 'Unbounded offset', 'Decrease Unbounded offset', 'Increase Unbounded offset')}
  </div>
</template>
    `),
    [`${baseId}-controlled`]: formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import { ${parts} } from '../proto-ui/components/vue';

const value = ref<number | null>(25);
const commits = ref(0);
</script>

<template>
  <div class="grid w-full max-w-xs gap-4">
${vueField(p, `${sa} :value="value" :min="0" :max="100" :step="5" :allow-empty="true" aria-label="Controlled volume" @value-change="({ value: next }) => (value = next)" @value-commit="({ value: next }) => { value = next; commits += 1; }"`, 'Controlled volume', 'Decrease Controlled volume', 'Increase Controlled volume')}
    <div role="status" aria-live="polite" class="text-xs text-muted-foreground tabular-nums">
      Accepted value: {{ value ?? 'empty' }} · Commits: {{ commits }}
    </div>
  </div>
</template>
    `),
    [`${baseId}-rtl`]: formatCode(`
<script setup lang="ts">
import { ${parts} } from '../proto-ui/components/vue';
</script>

<template>
  <div dir="rtl" class="grid w-full max-w-xs gap-4">
${vueField(p, `${sa} :default-value="40" :min="0" :max="100" :step="5" direction="rtl" :scrub="true" :scrub-steps="20" aria-label="الكمية"`, 'الكمية (اسحب التسمية)', 'إنقاص الكمية', 'زيادة الكمية')}
  </div>
</template>
    `),
  };

  const vue2: Record<string, string> = {
    [baseId]: formatCode(`
<template>
  <div class="grid w-full max-w-xs gap-4">
${vueField(p, `${sa} :default-value="12" :min="0" :max="100" :step="1" aria-label="Quantity"`, 'Quantity', 'Decrease Quantity', 'Increase Quantity')}
  </div>
</template>

<script>
import { ${parts} } from '../proto-ui/components/vue2';

export default {
  components: { ${parts} },
};
</script>
    `),
    [`${baseId}-formatting`]: formatCode(`
<template>
  <div class="grid w-full max-w-xs gap-4">
${vueField(p, `${sa} :default-value="1250" :min="0" :max="100000" :step="25" locale="en-US" :format-options="{ style: 'currency', currency: 'USD' }" aria-label="Budget (USD)"`, 'Budget (USD)', 'Decrease Budget', 'Increase Budget')}
${vueField(p, `${sa} :default-value="0.25" :min="0" :max="1" :step="0.05" locale="en-US" :format-options="{ style: 'percent' }" aria-label="Discount rate"`, 'Discount rate', 'Decrease Discount rate', 'Increase Discount rate')}
  </div>
</template>

<script>
import { ${parts} } from '../proto-ui/components/vue2';

export default {
  components: { ${parts} },
};
</script>
    `),
    [`${baseId}-scrub-nullable`]: formatCode(`
<template>
  <div class="grid w-full max-w-xs gap-4">
${vueField(p, `${sa} :default-value="60" :min="0" :max="100" :step="1" :scrub="true" :scrub-steps="50" aria-label="Opacity"`, 'Opacity (drag label)', 'Decrease Opacity', 'Increase Opacity')}
${vueField(p, `${sa} :default-value="null" :min="1" :max="500" :step="1" :allow-empty="true" aria-label="Optional seat limit"`, 'Optional seat limit', 'Decrease Optional seat limit', 'Increase Optional seat limit')}
  </div>
</template>

<script>
import { ${parts} } from '../proto-ui/components/vue2';

export default {
  components: { ${parts} },
};
</script>
    `),
    [`${baseId}-states`]: formatCode(`
<template>
  <div class="grid w-full max-w-xs gap-4">
${vueField(p, `${sa} :default-value="42" :disabled="true" aria-label="Disabled quantity"`, 'Disabled', 'Decrease Disabled', 'Increase Disabled')}
${vueField(p, `${sa} :default-value="24" :read-only="true" aria-label="Read-only quantity"`, 'Read-only', 'Decrease Read-only', 'Increase Read-only')}
${vueField(p, `${sa} :default-value="3.14" :min="null" :max="null" :step="0.5" :snap-to-step="false" aria-label="Unbounded offset"`, 'Unbounded offset', 'Decrease Unbounded offset', 'Increase Unbounded offset')}
  </div>
</template>

<script>
import { ${parts} } from '../proto-ui/components/vue2';

export default {
  components: { ${parts} },
};
</script>
    `),
    [`${baseId}-controlled`]: formatCode(`
<template>
  <div class="grid w-full max-w-xs gap-4">
${vueField(p, `${sa} :value="value" :min="0" :max="100" :step="5" :allow-empty="true" aria-label="Controlled volume" @value-change="onValueChange" @value-commit="onValueCommit"`, 'Controlled volume', 'Decrease Controlled volume', 'Increase Controlled volume')}
    <div role="status" aria-live="polite" class="text-xs text-muted-foreground tabular-nums">
      Accepted value: {{ value === null ? 'empty' : value }} · Commits: {{ commits }}
    </div>
  </div>
</template>

<script>
import { ${parts} } from '../proto-ui/components/vue2';

export default {
  components: { ${parts} },
  data() {
    return { value: 25, commits: 0 };
  },
  methods: {
    onValueChange({ value }) {
      this.value = value;
    },
    onValueCommit({ value }) {
      this.value = value;
      this.commits += 1;
    },
  },
};
</script>
    `),
    [`${baseId}-rtl`]: formatCode(`
<template>
  <div dir="rtl" class="grid w-full max-w-xs gap-4">
${vueField(p, `${sa} :default-value="40" :min="0" :max="100" :step="5" direction="rtl" :scrub="true" :scrub-steps="20" aria-label="الكمية"`, 'الكمية (اسحب التسمية)', 'إنقاص الكمية', 'زيادة الكمية')}
  </div>
</template>

<script>
import { ${parts} } from '../proto-ui/components/vue2';

export default {
  components: { ${parts} },
};
</script>
    `),
  };

  return { wc, react, vue, vue2 };
}

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {},
  react: {},
  vue: {},
  vue2: {},
};

for (const family of FAMILIES) {
  const snippets = buildFamilySnippets(family);
  Object.assign(codeMap.wc, snippets.wc);
  Object.assign(codeMap.react, snippets.react);
  Object.assign(codeMap.vue, snippets.vue);
  Object.assign(codeMap.vue2, snippets.vue2);
}
