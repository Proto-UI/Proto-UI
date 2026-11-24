import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

type FamilyTagConfig = {
  wcPrefix: string;
  compPrefix: string;
  shadcnRhea?: boolean;
  liquidGlassBackdrop?: boolean;
};

const SHADCN: FamilyTagConfig = {
  wcPrefix: 'wc-shadcn',
  compPrefix: 'Shadcn',
  shadcnRhea: true,
};

const BRUTALIST: FamilyTagConfig = {
  wcPrefix: 'wc-brutalist',
  compPrefix: 'Brutalist',
};

const BOOTSTRAP: FamilyTagConfig = {
  wcPrefix: 'wc-bootstrap-2-3-2',
  compPrefix: 'Bootstrap',
};

const LIQUID_GLASS: FamilyTagConfig = {
  wcPrefix: 'wc-liquid-glass',
  compPrefix: 'LiquidGlass',
  liquidGlassBackdrop: true,
};

function wcProfile(cfg: FamilyTagConfig): string {
  return cfg.shadcnRhea ? ' style-profile="rhea"' : '';
}

function jsxProfile(cfg: FamilyTagConfig): string {
  return cfg.shadcnRhea ? ' styleProfile="rhea"' : '';
}

function basicWc(cfg: FamilyTagConfig): string {
  const p = wcProfile(cfg);
  const w = cfg.wcPrefix;
  const inner = `<${w}-radio-group-root${p} default-value="comfortable" a11y-label="Display density">
  <div class="flex items-center gap-3">
    <${w}-radio-group-item${p} value="default">
      <${w}-radio-group-indicator${p}></${w}-radio-group-indicator>
    </${w}-radio-group-item>
    <${w}-label-root${p}>Default</${w}-label-root>
  </div>
  <div class="flex items-center gap-3">
    <${w}-radio-group-item${p} value="comfortable">
      <${w}-radio-group-indicator${p}></${w}-radio-group-indicator>
    </${w}-radio-group-item>
    <${w}-label-root${p}>Comfortable</${w}-label-root>
  </div>
  <div class="flex items-center gap-3">
    <${w}-radio-group-item${p} value="compact">
      <${w}-radio-group-indicator${p}></${w}-radio-group-indicator>
    </${w}-radio-group-item>
    <${w}-label-root${p}>Compact</${w}-label-root>
  </div>
</${w}-radio-group-root>`;
  return formatCode(
    cfg.liquidGlassBackdrop
      ? `<div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">\n${inner}\n</div>`
      : inner
  );
}

function basicReact(cfg: FamilyTagConfig): string {
  const p = jsxProfile(cfg);
  const c = cfg.compPrefix;
  return formatCode(`
import {
  ${c}LabelRoot,
  ${c}RadioGroupIndicator,
  ${c}RadioGroupItem,
  ${c}RadioGroupRoot,
} from '../proto-ui/components/react';

export function RadioGroupDemo() {
  return (
    <${c}RadioGroupRoot${p} defaultValue="comfortable" a11yLabel="Display density" className="w-fit">
      <div className="flex items-center gap-3">
        <${c}RadioGroupItem${p} value="default">
          <${c}RadioGroupIndicator${p} />
        </${c}RadioGroupItem>
        <${c}LabelRoot${p}>Default</${c}LabelRoot>
      </div>
      <div className="flex items-center gap-3">
        <${c}RadioGroupItem${p} value="comfortable">
          <${c}RadioGroupIndicator${p} />
        </${c}RadioGroupItem>
        <${c}LabelRoot${p}>Comfortable</${c}LabelRoot>
      </div>
      <div className="flex items-center gap-3">
        <${c}RadioGroupItem${p} value="compact">
          <${c}RadioGroupIndicator${p} />
        </${c}RadioGroupItem>
        <${c}LabelRoot${p}>Compact</${c}LabelRoot>
      </div>
    </${c}RadioGroupRoot>
  );
}
  `);
}

function basicVue(cfg: FamilyTagConfig): string {
  const p = jsxProfile(cfg);
  const c = cfg.compPrefix;
  return formatCode(`
<script setup lang="ts">
import {
  ${c}LabelRoot,
  ${c}RadioGroupIndicator,
  ${c}RadioGroupItem,
  ${c}RadioGroupRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <${c}RadioGroupRoot${p} defaultValue="comfortable" a11yLabel="Display density" class="w-fit">
    <div class="flex items-center gap-3">
      <${c}RadioGroupItem${p} value="default">
        <${c}RadioGroupIndicator${p} />
      </${c}RadioGroupItem>
      <${c}LabelRoot${p}>Default</${c}LabelRoot>
    </div>
    <div class="flex items-center gap-3">
      <${c}RadioGroupItem${p} value="comfortable">
        <${c}RadioGroupIndicator${p} />
      </${c}RadioGroupItem>
      <${c}LabelRoot${p}>Comfortable</${c}LabelRoot>
    </div>
    <div class="flex items-center gap-3">
      <${c}RadioGroupItem${p} value="compact">
        <${c}RadioGroupIndicator${p} />
      </${c}RadioGroupItem>
      <${c}LabelRoot${p}>Compact</${c}LabelRoot>
    </div>
  </${c}RadioGroupRoot>
</template>
  `);
}

function basicVue2(cfg: FamilyTagConfig): string {
  const p = jsxProfile(cfg);
  const c = cfg.compPrefix;
  return formatCode(`
<template>
  <${c}RadioGroupRoot${p} defaultValue="comfortable" a11yLabel="Display density" class="w-fit">
    <div class="flex items-center gap-3">
      <${c}RadioGroupItem${p} value="default">
        <${c}RadioGroupIndicator${p} />
      </${c}RadioGroupItem>
      <${c}LabelRoot${p}>Default</${c}LabelRoot>
    </div>
    <div class="flex items-center gap-3">
      <${c}RadioGroupItem${p} value="comfortable">
        <${c}RadioGroupIndicator${p} />
      </${c}RadioGroupItem>
      <${c}LabelRoot${p}>Comfortable</${c}LabelRoot>
    </div>
    <div class="flex items-center gap-3">
      <${c}RadioGroupItem${p} value="compact">
        <${c}RadioGroupIndicator${p} />
      </${c}RadioGroupItem>
      <${c}LabelRoot${p}>Compact</${c}LabelRoot>
    </div>
  </${c}RadioGroupRoot>
</template>

<script>
import {
  ${c}LabelRoot,
  ${c}RadioGroupIndicator,
  ${c}RadioGroupItem,
  ${c}RadioGroupRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${c}LabelRoot,
    ${c}RadioGroupIndicator,
    ${c}RadioGroupItem,
    ${c}RadioGroupRoot,
  },
};
</script>
  `);
}

function descriptionWc(cfg: FamilyTagConfig): string {
  const p = wcProfile(cfg);
  const w = cfg.wcPrefix;
  return formatCode(`
<${w}-radio-group-root${p} default-value="comfortable" a11y-label="Layout density">
  <div class="flex items-start gap-3">
    <${w}-radio-group-item${p} value="default">
      <${w}-radio-group-indicator${p}></${w}-radio-group-indicator>
    </${w}-radio-group-item>
    <div class="grid gap-1">
      <${w}-label-root${p}>Default</${w}-label-root>
      <p class="text-sm text-muted-foreground">Standard spacing for most use cases.</p>
    </div>
  </div>
  <div class="flex items-start gap-3">
    <${w}-radio-group-item${p} value="comfortable">
      <${w}-radio-group-indicator${p}></${w}-radio-group-indicator>
    </${w}-radio-group-item>
    <div class="grid gap-1">
      <${w}-label-root${p}>Comfortable</${w}-label-root>
      <p class="text-sm text-muted-foreground">More space between elements.</p>
    </div>
  </div>
  <div class="flex items-start gap-3">
    <${w}-radio-group-item${p} value="compact">
      <${w}-radio-group-indicator${p}></${w}-radio-group-indicator>
    </${w}-radio-group-item>
    <div class="grid gap-1">
      <${w}-label-root${p}>Compact</${w}-label-root>
      <p class="text-sm text-muted-foreground">Minimal spacing for dense layouts.</p>
    </div>
  </div>
</${w}-radio-group-root>
  `);
}

function descriptionReact(cfg: FamilyTagConfig): string {
  const p = jsxProfile(cfg);
  const c = cfg.compPrefix;
  return formatCode(`
import {
  ${c}LabelRoot,
  ${c}RadioGroupIndicator,
  ${c}RadioGroupItem,
  ${c}RadioGroupRoot,
} from '../proto-ui/components/react';

export function RadioGroupDescriptionDemo() {
  return (
    <${c}RadioGroupRoot${p} defaultValue="comfortable" a11yLabel="Layout density" className="w-fit">
      <div className="flex items-start gap-3">
        <${c}RadioGroupItem${p} value="default">
          <${c}RadioGroupIndicator${p} />
        </${c}RadioGroupItem>
        <div className="grid gap-1">
          <${c}LabelRoot${p}>Default</${c}LabelRoot>
          <p className="text-sm text-muted-foreground">Standard spacing for most use cases.</p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <${c}RadioGroupItem${p} value="comfortable">
          <${c}RadioGroupIndicator${p} />
        </${c}RadioGroupItem>
        <div className="grid gap-1">
          <${c}LabelRoot${p}>Comfortable</${c}LabelRoot>
          <p className="text-sm text-muted-foreground">More space between elements.</p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <${c}RadioGroupItem${p} value="compact">
          <${c}RadioGroupIndicator${p} />
        </${c}RadioGroupItem>
        <div className="grid gap-1">
          <${c}LabelRoot${p}>Compact</${c}LabelRoot>
          <p className="text-sm text-muted-foreground">Minimal spacing for dense layouts.</p>
        </div>
      </div>
    </${c}RadioGroupRoot>
  );
}
  `);
}

function descriptionVue(cfg: FamilyTagConfig): string {
  const p = jsxProfile(cfg);
  const c = cfg.compPrefix;
  return formatCode(`
<script setup lang="ts">
import {
  ${c}LabelRoot,
  ${c}RadioGroupIndicator,
  ${c}RadioGroupItem,
  ${c}RadioGroupRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <${c}RadioGroupRoot${p} defaultValue="comfortable" a11yLabel="Layout density" class="w-fit">
    <div class="flex items-start gap-3">
      <${c}RadioGroupItem${p} value="default"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
      <div class="grid gap-1">
        <${c}LabelRoot${p}>Default</${c}LabelRoot>
        <p class="text-sm text-muted-foreground">Standard spacing for most use cases.</p>
      </div>
    </div>
    <div class="flex items-start gap-3">
      <${c}RadioGroupItem${p} value="comfortable"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
      <div class="grid gap-1">
        <${c}LabelRoot${p}>Comfortable</${c}LabelRoot>
        <p class="text-sm text-muted-foreground">More space between elements.</p>
      </div>
    </div>
    <div class="flex items-start gap-3">
      <${c}RadioGroupItem${p} value="compact"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
      <div class="grid gap-1">
        <${c}LabelRoot${p}>Compact</${c}LabelRoot>
        <p class="text-sm text-muted-foreground">Minimal spacing for dense layouts.</p>
      </div>
    </div>
  </${c}RadioGroupRoot>
</template>
  `);
}

function descriptionVue2(cfg: FamilyTagConfig): string {
  const p = jsxProfile(cfg);
  const c = cfg.compPrefix;
  return formatCode(`
<template>
  <${c}RadioGroupRoot${p} defaultValue="comfortable" a11yLabel="Layout density" class="w-fit">
    <div class="flex items-start gap-3">
      <${c}RadioGroupItem${p} value="default"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
      <div class="grid gap-1">
        <${c}LabelRoot${p}>Default</${c}LabelRoot>
        <p class="text-sm text-muted-foreground">Standard spacing for most use cases.</p>
      </div>
    </div>
    <div class="flex items-start gap-3">
      <${c}RadioGroupItem${p} value="comfortable"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
      <div class="grid gap-1">
        <${c}LabelRoot${p}>Comfortable</${c}LabelRoot>
        <p class="text-sm text-muted-foreground">More space between elements.</p>
      </div>
    </div>
    <div class="flex items-start gap-3">
      <${c}RadioGroupItem${p} value="compact"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
      <div class="grid gap-1">
        <${c}LabelRoot${p}>Compact</${c}LabelRoot>
        <p class="text-sm text-muted-foreground">Minimal spacing for dense layouts.</p>
      </div>
    </div>
  </${c}RadioGroupRoot>
</template>

<script>
import {
  ${c}LabelRoot,
  ${c}RadioGroupIndicator,
  ${c}RadioGroupItem,
  ${c}RadioGroupRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${c}LabelRoot,
    ${c}RadioGroupIndicator,
    ${c}RadioGroupItem,
    ${c}RadioGroupRoot,
  },
};
</script>
  `);
}

function choiceCardWc(cfg: FamilyTagConfig): string {
  const p = wcProfile(cfg);
  const w = cfg.wcPrefix;
  const itemExtra = cfg.liquidGlassBackdrop ? ' material="opaque"' : '';
  return formatCode(`
<${w}-radio-group-root${p} default-value="plus" a11y-label="Plan tier">
  <div class="flex items-start justify-between gap-4 rounded-xl border p-4">
    <div class="grid gap-1">
      <${w}-label-root${p}>Plus</${w}-label-root>
      <p class="text-sm text-muted-foreground">For individuals and small teams.</p>
    </div>
    <${w}-radio-group-item${p} value="plus"${itemExtra}>
      <${w}-radio-group-indicator${p}></${w}-radio-group-indicator>
    </${w}-radio-group-item>
  </div>
  <div class="flex items-start justify-between gap-4 rounded-xl border p-4">
    <div class="grid gap-1">
      <${w}-label-root${p}>Pro</${w}-label-root>
      <p class="text-sm text-muted-foreground">For growing businesses.</p>
    </div>
    <${w}-radio-group-item${p} value="pro"${itemExtra}>
      <${w}-radio-group-indicator${p}></${w}-radio-group-indicator>
    </${w}-radio-group-item>
  </div>
  <div class="flex items-start justify-between gap-4 rounded-xl border p-4">
    <div class="grid gap-1">
      <${w}-label-root${p}>Enterprise</${w}-label-root>
      <p class="text-sm text-muted-foreground">For large teams and enterprises.</p>
    </div>
    <${w}-radio-group-item${p} value="enterprise"${itemExtra}>
      <${w}-radio-group-indicator${p}></${w}-radio-group-indicator>
    </${w}-radio-group-item>
  </div>
</${w}-radio-group-root>
  `);
}

function choiceCardReact(cfg: FamilyTagConfig): string {
  const p = jsxProfile(cfg);
  const c = cfg.compPrefix;
  const itemExtra = cfg.liquidGlassBackdrop ? ' material="opaque"' : '';
  return formatCode(`
import {
  ${c}LabelRoot,
  ${c}RadioGroupIndicator,
  ${c}RadioGroupItem,
  ${c}RadioGroupRoot,
} from '../proto-ui/components/react';

export function RadioGroupChoiceCardDemo() {
  return (
    <${c}RadioGroupRoot${p} defaultValue="plus" a11yLabel="Plan tier" className="max-w-sm">
      <div className="flex items-start justify-between gap-4 rounded-xl border p-4">
        <div className="grid gap-1">
          <${c}LabelRoot${p}>Plus</${c}LabelRoot>
          <p className="text-sm text-muted-foreground">For individuals and small teams.</p>
        </div>
        <${c}RadioGroupItem${p} value="plus"${itemExtra}><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
      </div>
      <div className="flex items-start justify-between gap-4 rounded-xl border p-4">
        <div className="grid gap-1">
          <${c}LabelRoot${p}>Pro</${c}LabelRoot>
          <p className="text-sm text-muted-foreground">For growing businesses.</p>
        </div>
        <${c}RadioGroupItem${p} value="pro"${itemExtra}><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
      </div>
      <div className="flex items-start justify-between gap-4 rounded-xl border p-4">
        <div className="grid gap-1">
          <${c}LabelRoot${p}>Enterprise</${c}LabelRoot>
          <p className="text-sm text-muted-foreground">For large teams and enterprises.</p>
        </div>
        <${c}RadioGroupItem${p} value="enterprise"${itemExtra}><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
      </div>
    </${c}RadioGroupRoot>
  );
}
  `);
}

function choiceCardVue(cfg: FamilyTagConfig): string {
  const p = jsxProfile(cfg);
  const c = cfg.compPrefix;
  const itemExtra = cfg.liquidGlassBackdrop ? ' material="opaque"' : '';
  return formatCode(`
<script setup lang="ts">
import {
  ${c}LabelRoot,
  ${c}RadioGroupIndicator,
  ${c}RadioGroupItem,
  ${c}RadioGroupRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <${c}RadioGroupRoot${p} defaultValue="plus" a11yLabel="Plan tier" class="max-w-sm">
    <div class="flex items-start justify-between gap-4 rounded-xl border p-4">
      <div class="grid gap-1">
        <${c}LabelRoot${p}>Plus</${c}LabelRoot>
        <p class="text-sm text-muted-foreground">For individuals and small teams.</p>
      </div>
      <${c}RadioGroupItem${p} value="plus"${itemExtra}><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
    </div>
    <div class="flex items-start justify-between gap-4 rounded-xl border p-4">
      <div class="grid gap-1">
        <${c}LabelRoot${p}>Pro</${c}LabelRoot>
        <p class="text-sm text-muted-foreground">For growing businesses.</p>
      </div>
      <${c}RadioGroupItem${p} value="pro"${itemExtra}><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
    </div>
    <div class="flex items-start justify-between gap-4 rounded-xl border p-4">
      <div class="grid gap-1">
        <${c}LabelRoot${p}>Enterprise</${c}LabelRoot>
        <p class="text-sm text-muted-foreground">For large teams and enterprises.</p>
      </div>
      <${c}RadioGroupItem${p} value="enterprise"${itemExtra}><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
    </div>
  </${c}RadioGroupRoot>
</template>
  `);
}

function choiceCardVue2(cfg: FamilyTagConfig): string {
  const p = jsxProfile(cfg);
  const c = cfg.compPrefix;
  const itemExtra = cfg.liquidGlassBackdrop ? ' material="opaque"' : '';
  return formatCode(`
<template>
  <${c}RadioGroupRoot${p} defaultValue="plus" a11yLabel="Plan tier" class="max-w-sm">
    <div class="flex items-start justify-between gap-4 rounded-xl border p-4">
      <div class="grid gap-1">
        <${c}LabelRoot${p}>Plus</${c}LabelRoot>
        <p class="text-sm text-muted-foreground">For individuals and small teams.</p>
      </div>
      <${c}RadioGroupItem${p} value="plus"${itemExtra}><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
    </div>
    <div class="flex items-start justify-between gap-4 rounded-xl border p-4">
      <div class="grid gap-1">
        <${c}LabelRoot${p}>Pro</${c}LabelRoot>
        <p class="text-sm text-muted-foreground">For growing businesses.</p>
      </div>
      <${c}RadioGroupItem${p} value="pro"${itemExtra}><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
    </div>
    <div class="flex items-start justify-between gap-4 rounded-xl border p-4">
      <div class="grid gap-1">
        <${c}LabelRoot${p}>Enterprise</${c}LabelRoot>
        <p class="text-sm text-muted-foreground">For large teams and enterprises.</p>
      </div>
      <${c}RadioGroupItem${p} value="enterprise"${itemExtra}><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
    </div>
  </${c}RadioGroupRoot>
</template>

<script>
import {
  ${c}LabelRoot,
  ${c}RadioGroupIndicator,
  ${c}RadioGroupItem,
  ${c}RadioGroupRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${c}LabelRoot,
    ${c}RadioGroupIndicator,
    ${c}RadioGroupItem,
    ${c}RadioGroupRoot,
  },
};
</script>
  `);
}

function fieldsetWc(cfg: FamilyTagConfig): string {
  const p = wcProfile(cfg);
  const w = cfg.wcPrefix;
  return formatCode(`
<${w}-field-root${p}>
  <${w}-field-label${p}>Subscription Plan</${w}-field-label>
  <${w}-field-description${p}>Yearly and lifetime plans offer significant savings.</${w}-field-description>
  <${w}-radio-group-root${p} default-value="monthly" a11y-label="Subscription Plan">
    <div class="flex items-center gap-3">
      <${w}-radio-group-item${p} value="monthly"><${w}-radio-group-indicator${p}></${w}-radio-group-indicator></${w}-radio-group-item>
      <${w}-label-root${p}>Monthly ($9.99/month)</${w}-label-root>
    </div>
    <div class="flex items-center gap-3">
      <${w}-radio-group-item${p} value="yearly"><${w}-radio-group-indicator${p}></${w}-radio-group-indicator></${w}-radio-group-item>
      <${w}-label-root${p}>Yearly ($99.99/year)</${w}-label-root>
    </div>
    <div class="flex items-center gap-3">
      <${w}-radio-group-item${p} value="lifetime"><${w}-radio-group-indicator${p}></${w}-radio-group-indicator></${w}-radio-group-item>
      <${w}-label-root${p}>Lifetime ($299.99)</${w}-label-root>
    </div>
  </${w}-radio-group-root>
</${w}-field-root>
  `);
}

function fieldsetReact(cfg: FamilyTagConfig): string {
  const p = jsxProfile(cfg);
  const c = cfg.compPrefix;
  return formatCode(`
import {
  ${c}FieldDescription,
  ${c}FieldLabel,
  ${c}FieldRoot,
  ${c}LabelRoot,
  ${c}RadioGroupIndicator,
  ${c}RadioGroupItem,
  ${c}RadioGroupRoot,
} from '../proto-ui/components/react';

export function RadioGroupFieldsetDemo() {
  return (
    <${c}FieldRoot${p} className="max-w-xs">
      <${c}FieldLabel${p}>Subscription Plan</${c}FieldLabel>
      <${c}FieldDescription${p}>Yearly and lifetime plans offer significant savings.</${c}FieldDescription>
      <${c}RadioGroupRoot${p} defaultValue="monthly" a11yLabel="Subscription Plan">
        <div className="flex items-center gap-3">
          <${c}RadioGroupItem${p} value="monthly"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
          <${c}LabelRoot${p}>Monthly ($9.99/month)</${c}LabelRoot>
        </div>
        <div className="flex items-center gap-3">
          <${c}RadioGroupItem${p} value="yearly"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
          <${c}LabelRoot${p}>Yearly ($99.99/year)</${c}LabelRoot>
        </div>
        <div className="flex items-center gap-3">
          <${c}RadioGroupItem${p} value="lifetime"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
          <${c}LabelRoot${p}>Lifetime ($299.99)</${c}LabelRoot>
        </div>
      </${c}RadioGroupRoot>
    </${c}FieldRoot>
  );
}
  `);
}

function fieldsetVue(cfg: FamilyTagConfig): string {
  const p = jsxProfile(cfg);
  const c = cfg.compPrefix;
  return formatCode(`
<script setup lang="ts">
import {
  ${c}FieldDescription,
  ${c}FieldLabel,
  ${c}FieldRoot,
  ${c}LabelRoot,
  ${c}RadioGroupIndicator,
  ${c}RadioGroupItem,
  ${c}RadioGroupRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <${c}FieldRoot${p} class="max-w-xs">
    <${c}FieldLabel${p}>Subscription Plan</${c}FieldLabel>
    <${c}FieldDescription${p}>Yearly and lifetime plans offer significant savings.</${c}FieldDescription>
    <${c}RadioGroupRoot${p} defaultValue="monthly" a11yLabel="Subscription Plan">
      <div class="flex items-center gap-3">
        <${c}RadioGroupItem${p} value="monthly"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
        <${c}LabelRoot${p}>Monthly ($9.99/month)</${c}LabelRoot>
      </div>
      <div class="flex items-center gap-3">
        <${c}RadioGroupItem${p} value="yearly"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
        <${c}LabelRoot${p}>Yearly ($99.99/year)</${c}LabelRoot>
      </div>
      <div class="flex items-center gap-3">
        <${c}RadioGroupItem${p} value="lifetime"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
        <${c}LabelRoot${p}>Lifetime ($299.99)</${c}LabelRoot>
      </div>
    </${c}RadioGroupRoot>
  </${c}FieldRoot>
</template>
  `);
}

function fieldsetVue2(cfg: FamilyTagConfig): string {
  const p = jsxProfile(cfg);
  const c = cfg.compPrefix;
  return formatCode(`
<template>
  <${c}FieldRoot${p} class="max-w-xs">
    <${c}FieldLabel${p}>Subscription Plan</${c}FieldLabel>
    <${c}FieldDescription${p}>Yearly and lifetime plans offer significant savings.</${c}FieldDescription>
    <${c}RadioGroupRoot${p} defaultValue="monthly" a11yLabel="Subscription Plan">
      <div class="flex items-center gap-3">
        <${c}RadioGroupItem${p} value="monthly"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
        <${c}LabelRoot${p}>Monthly ($9.99/month)</${c}LabelRoot>
      </div>
      <div class="flex items-center gap-3">
        <${c}RadioGroupItem${p} value="yearly"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
        <${c}LabelRoot${p}>Yearly ($99.99/year)</${c}LabelRoot>
      </div>
      <div class="flex items-center gap-3">
        <${c}RadioGroupItem${p} value="lifetime"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
        <${c}LabelRoot${p}>Lifetime ($299.99)</${c}LabelRoot>
      </div>
    </${c}RadioGroupRoot>
  </${c}FieldRoot>
</template>

<script>
import {
  ${c}FieldDescription,
  ${c}FieldLabel,
  ${c}FieldRoot,
  ${c}LabelRoot,
  ${c}RadioGroupIndicator,
  ${c}RadioGroupItem,
  ${c}RadioGroupRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${c}FieldDescription,
    ${c}FieldLabel,
    ${c}FieldRoot,
    ${c}LabelRoot,
    ${c}RadioGroupIndicator,
    ${c}RadioGroupItem,
    ${c}RadioGroupRoot,
  },
};
</script>
  `);
}

function disabledWc(cfg: FamilyTagConfig): string {
  const p = wcProfile(cfg);
  const w = cfg.wcPrefix;
  return formatCode(`
<div class="grid gap-8 sm:grid-cols-2">
  <${w}-radio-group-root${p} default-value="option2" a11y-label="Single disabled option">
    <div class="flex items-center gap-3">
      <${w}-radio-group-item${p} value="option1" disabled><${w}-radio-group-indicator${p}></${w}-radio-group-indicator></${w}-radio-group-item>
      <${w}-label-root${p}>Disabled</${w}-label-root>
    </div>
    <div class="flex items-center gap-3">
      <${w}-radio-group-item${p} value="option2"><${w}-radio-group-indicator${p}></${w}-radio-group-indicator></${w}-radio-group-item>
      <${w}-label-root${p}>Option 2</${w}-label-root>
    </div>
    <div class="flex items-center gap-3">
      <${w}-radio-group-item${p} value="option3"><${w}-radio-group-indicator${p}></${w}-radio-group-indicator></${w}-radio-group-item>
      <${w}-label-root${p}>Option 3</${w}-label-root>
    </div>
  </${w}-radio-group-root>
  <${w}-radio-group-root${p} default-value="option2" disabled a11y-label="Disabled radio group">
    <div class="flex items-center gap-3">
      <${w}-radio-group-item${p} value="option1"><${w}-radio-group-indicator${p}></${w}-radio-group-indicator></${w}-radio-group-item>
      <${w}-label-root${p}>Option 1</${w}-label-root>
    </div>
    <div class="flex items-center gap-3">
      <${w}-radio-group-item${p} value="option2"><${w}-radio-group-indicator${p}></${w}-radio-group-indicator></${w}-radio-group-item>
      <${w}-label-root${p}>Option 2</${w}-label-root>
    </div>
  </${w}-radio-group-root>
</div>
  `);
}

function disabledReact(cfg: FamilyTagConfig): string {
  const p = jsxProfile(cfg);
  const c = cfg.compPrefix;
  return formatCode(`
import {
  ${c}LabelRoot,
  ${c}RadioGroupIndicator,
  ${c}RadioGroupItem,
  ${c}RadioGroupRoot,
} from '../proto-ui/components/react';

export function RadioGroupDisabledDemo() {
  return (
    <div className="grid gap-8 sm:grid-cols-2">
      <${c}RadioGroupRoot${p} defaultValue="option2" a11yLabel="Single disabled option">
        <div className="flex items-center gap-3">
          <${c}RadioGroupItem${p} value="option1" disabled><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
          <${c}LabelRoot${p}>Disabled</${c}LabelRoot>
        </div>
        <div className="flex items-center gap-3">
          <${c}RadioGroupItem${p} value="option2"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
          <${c}LabelRoot${p}>Option 2</${c}LabelRoot>
        </div>
        <div className="flex items-center gap-3">
          <${c}RadioGroupItem${p} value="option3"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
          <${c}LabelRoot${p}>Option 3</${c}LabelRoot>
        </div>
      </${c}RadioGroupRoot>
      <${c}RadioGroupRoot${p} defaultValue="option2" disabled a11yLabel="Disabled radio group">
        <div className="flex items-center gap-3">
          <${c}RadioGroupItem${p} value="option1"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
          <${c}LabelRoot${p}>Option 1</${c}LabelRoot>
        </div>
        <div className="flex items-center gap-3">
          <${c}RadioGroupItem${p} value="option2"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
          <${c}LabelRoot${p}>Option 2</${c}LabelRoot>
        </div>
      </${c}RadioGroupRoot>
    </div>
  );
}
  `);
}

function disabledVue(cfg: FamilyTagConfig): string {
  const p = jsxProfile(cfg);
  const c = cfg.compPrefix;
  return formatCode(`
<script setup lang="ts">
import {
  ${c}LabelRoot,
  ${c}RadioGroupIndicator,
  ${c}RadioGroupItem,
  ${c}RadioGroupRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="grid gap-8 sm:grid-cols-2">
    <${c}RadioGroupRoot${p} defaultValue="option2" a11yLabel="Single disabled option">
      <div class="flex items-center gap-3">
        <${c}RadioGroupItem${p} value="option1" :disabled="true"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
        <${c}LabelRoot${p}>Disabled</${c}LabelRoot>
      </div>
      <div class="flex items-center gap-3">
        <${c}RadioGroupItem${p} value="option2"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
        <${c}LabelRoot${p}>Option 2</${c}LabelRoot>
      </div>
    </${c}RadioGroupRoot>
    <${c}RadioGroupRoot${p} defaultValue="option2" :disabled="true" a11yLabel="Disabled radio group">
      <div class="flex items-center gap-3">
        <${c}RadioGroupItem${p} value="option1"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
        <${c}LabelRoot${p}>Option 1</${c}LabelRoot>
      </div>
      <div class="flex items-center gap-3">
        <${c}RadioGroupItem${p} value="option2"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
        <${c}LabelRoot${p}>Option 2</${c}LabelRoot>
      </div>
    </${c}RadioGroupRoot>
  </div>
</template>
  `);
}

function disabledVue2(cfg: FamilyTagConfig): string {
  const p = jsxProfile(cfg);
  const c = cfg.compPrefix;
  return formatCode(`
<template>
  <div class="grid gap-8 sm:grid-cols-2">
    <${c}RadioGroupRoot${p} defaultValue="option2" a11yLabel="Single disabled option">
      <div class="flex items-center gap-3">
        <${c}RadioGroupItem${p} value="option1" :disabled="true"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
        <${c}LabelRoot${p}>Disabled</${c}LabelRoot>
      </div>
      <div class="flex items-center gap-3">
        <${c}RadioGroupItem${p} value="option2"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
        <${c}LabelRoot${p}>Option 2</${c}LabelRoot>
      </div>
    </${c}RadioGroupRoot>
    <${c}RadioGroupRoot${p} defaultValue="option2" :disabled="true" a11yLabel="Disabled radio group">
      <div class="flex items-center gap-3">
        <${c}RadioGroupItem${p} value="option1"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
        <${c}LabelRoot${p}>Option 1</${c}LabelRoot>
      </div>
      <div class="flex items-center gap-3">
        <${c}RadioGroupItem${p} value="option2"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
        <${c}LabelRoot${p}>Option 2</${c}LabelRoot>
      </div>
    </${c}RadioGroupRoot>
  </div>
</template>

<script>
import {
  ${c}LabelRoot,
  ${c}RadioGroupIndicator,
  ${c}RadioGroupItem,
  ${c}RadioGroupRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${c}LabelRoot,
    ${c}RadioGroupIndicator,
    ${c}RadioGroupItem,
    ${c}RadioGroupRoot,
  },
};
</script>
  `);
}

function invalidWc(cfg: FamilyTagConfig, useFieldRadioGroup: boolean): string {
  const p = wcProfile(cfg);
  const w = cfg.wcPrefix;
  const groupTag = useFieldRadioGroup ? `${w}-field-radio-group` : `${w}-radio-group-root`;
  return formatCode(`
<${w}-field-root${p} invalid>
  <${w}-field-label${p}>Notification Preferences</${w}-field-label>
  <${w}-field-description${p}>Choose how you want to receive notifications.</${w}-field-description>
  <${groupTag}${p} default-value="email" a11y-label="Notification Preferences">
    <div class="flex items-center gap-3">
      <${w}-radio-group-item${p} value="email"><${w}-radio-group-indicator${p}></${w}-radio-group-indicator></${w}-radio-group-item>
      <${w}-label-root${p}>Email only</${w}-label-root>
    </div>
    <div class="flex items-center gap-3">
      <${w}-radio-group-item${p} value="sms"><${w}-radio-group-indicator${p}></${w}-radio-group-indicator></${w}-radio-group-item>
      <${w}-label-root${p}>SMS only</${w}-label-root>
    </div>
    <div class="flex items-center gap-3">
      <${w}-radio-group-item${p} value="both"><${w}-radio-group-indicator${p}></${w}-radio-group-indicator></${w}-radio-group-item>
      <${w}-label-root${p}>Both Email &amp; SMS</${w}-label-root>
    </div>
  </${groupTag}>
  <${w}-field-error${p}></${w}-field-error>
</${w}-field-root>
  `);
}

function invalidReact(cfg: FamilyTagConfig, useFieldRadioGroup: boolean): string {
  const p = jsxProfile(cfg);
  const c = cfg.compPrefix;
  const groupComp = useFieldRadioGroup ? `${c}FieldRadioGroup` : `${c}RadioGroupRoot`;
  return formatCode(`
import {
  ${c}FieldDescription,
  ${c}FieldError,
  ${c}FieldLabel,
  ${c}FieldRoot,
  ${c}LabelRoot,
  ${groupComp},
  ${c}RadioGroupIndicator,
  ${c}RadioGroupItem,
} from '../proto-ui/components/react';

export function RadioGroupInvalidDemo() {
  return (
    <${c}FieldRoot${p} invalid errors={['Please choose a notification preference before continuing.']}>
      <${c}FieldLabel${p}>Notification Preferences</${c}FieldLabel>
      <${c}FieldDescription${p}>Choose how you want to receive notifications.</${c}FieldDescription>
      <${groupComp}${p} defaultValue="email" a11yLabel="Notification Preferences">
        <div className="flex items-center gap-3">
          <${c}RadioGroupItem${p} value="email"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
          <${c}LabelRoot${p}>Email only</${c}LabelRoot>
        </div>
        <div className="flex items-center gap-3">
          <${c}RadioGroupItem${p} value="sms"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
          <${c}LabelRoot${p}>SMS only</${c}LabelRoot>
        </div>
        <div className="flex items-center gap-3">
          <${c}RadioGroupItem${p} value="both"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
          <${c}LabelRoot${p}>Both Email &amp; SMS</${c}LabelRoot>
        </div>
      </${groupComp}>
      <${c}FieldError${p} />
    </${c}FieldRoot>
  );
}
  `);
}

function invalidVue(cfg: FamilyTagConfig, useFieldRadioGroup: boolean): string {
  const p = jsxProfile(cfg);
  const c = cfg.compPrefix;
  const groupComp = useFieldRadioGroup ? `${c}FieldRadioGroup` : `${c}RadioGroupRoot`;
  return formatCode(`
<script setup lang="ts">
import {
  ${c}FieldDescription,
  ${c}FieldError,
  ${c}FieldLabel,
  ${c}FieldRoot,
  ${c}LabelRoot,
  ${groupComp},
  ${c}RadioGroupIndicator,
  ${c}RadioGroupItem,
} from '../proto-ui/components/vue';
</script>

<template>
  <${c}FieldRoot${p} :invalid="true" :errors="['Please choose a notification preference before continuing.']">
    <${c}FieldLabel${p}>Notification Preferences</${c}FieldLabel>
    <${c}FieldDescription${p}>Choose how you want to receive notifications.</${c}FieldDescription>
    <${groupComp}${p} defaultValue="email" a11yLabel="Notification Preferences">
      <div class="flex items-center gap-3">
        <${c}RadioGroupItem${p} value="email"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
        <${c}LabelRoot${p}>Email only</${c}LabelRoot>
      </div>
      <div class="flex items-center gap-3">
        <${c}RadioGroupItem${p} value="sms"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
        <${c}LabelRoot${p}>SMS only</${c}LabelRoot>
      </div>
      <div class="flex items-center gap-3">
        <${c}RadioGroupItem${p} value="both"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
        <${c}LabelRoot${p}>Both Email &amp; SMS</${c}LabelRoot>
      </div>
    </${groupComp}>
    <${c}FieldError${p} />
  </${c}FieldRoot>
</template>
  `);
}

function invalidVue2(cfg: FamilyTagConfig, useFieldRadioGroup: boolean): string {
  const p = jsxProfile(cfg);
  const c = cfg.compPrefix;
  const groupComp = useFieldRadioGroup ? `${c}FieldRadioGroup` : `${c}RadioGroupRoot`;
  return formatCode(`
<template>
  <${c}FieldRoot${p} :invalid="true" :errors="['Please choose a notification preference before continuing.']">
    <${c}FieldLabel${p}>Notification Preferences</${c}FieldLabel>
    <${c}FieldDescription${p}>Choose how you want to receive notifications.</${c}FieldDescription>
    <${groupComp}${p} defaultValue="email" a11yLabel="Notification Preferences">
      <div class="flex items-center gap-3">
        <${c}RadioGroupItem${p} value="email"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
        <${c}LabelRoot${p}>Email only</${c}LabelRoot>
      </div>
      <div class="flex items-center gap-3">
        <${c}RadioGroupItem${p} value="sms"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
        <${c}LabelRoot${p}>SMS only</${c}LabelRoot>
      </div>
      <div class="flex items-center gap-3">
        <${c}RadioGroupItem${p} value="both"><${c}RadioGroupIndicator${p} /></${c}RadioGroupItem>
        <${c}LabelRoot${p}>Both Email &amp; SMS</${c}LabelRoot>
      </div>
    </${groupComp}>
    <${c}FieldError${p} />
  </${c}FieldRoot>
</template>

<script>
import {
  ${c}FieldDescription,
  ${c}FieldError,
  ${c}FieldLabel,
  ${c}FieldRoot,
  ${c}LabelRoot,
  ${groupComp},
  ${c}RadioGroupIndicator,
  ${c}RadioGroupItem,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${c}FieldDescription,
    ${c}FieldError,
    ${c}FieldLabel,
    ${c}FieldRoot,
    ${c}LabelRoot,
    ${groupComp},
    ${c}RadioGroupIndicator,
    ${c}RadioGroupItem,
  },
};
</script>
  `);
}

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-radio-group': basicWc(SHADCN),
    'demo-shadcn-radio-group-description': descriptionWc(SHADCN),
    'demo-shadcn-radio-group-choice-card': choiceCardWc(SHADCN),
    'demo-shadcn-radio-group-fieldset': fieldsetWc(SHADCN),
    'demo-shadcn-radio-group-disabled': disabledWc(SHADCN),
    'demo-shadcn-radio-group-invalid': invalidWc(SHADCN, true),
    'demo-shadcn-radio-group-rtl': formatCode(`
<div dir="rtl">
  <wc-shadcn-radio-group-root style-profile="rhea" default-value="comfortable" a11y-label="كثافة العرض">
    <div class="flex items-start gap-3">
      <wc-shadcn-radio-group-item style-profile="rhea" value="default">
        <wc-shadcn-radio-group-indicator style-profile="rhea"></wc-shadcn-radio-group-indicator>
      </wc-shadcn-radio-group-item>
      <div class="grid gap-1 text-start">
        <wc-shadcn-label-root style-profile="rhea">افتراضي</wc-shadcn-label-root>
        <p class="text-sm text-muted-foreground">تباعد قياسي لمعظم حالات الاستخدام.</p>
      </div>
    </div>
    <div class="flex items-start gap-3">
      <wc-shadcn-radio-group-item style-profile="rhea" value="comfortable">
        <wc-shadcn-radio-group-indicator style-profile="rhea"></wc-shadcn-radio-group-indicator>
      </wc-shadcn-radio-group-item>
      <div class="grid gap-1 text-start">
        <wc-shadcn-label-root style-profile="rhea">مريح</wc-shadcn-label-root>
        <p class="text-sm text-muted-foreground">مساحة أكبر بين العناصر.</p>
      </div>
    </div>
    <div class="flex items-start gap-3">
      <wc-shadcn-radio-group-item style-profile="rhea" value="compact">
        <wc-shadcn-radio-group-indicator style-profile="rhea"></wc-shadcn-radio-group-indicator>
      </wc-shadcn-radio-group-item>
      <div class="grid gap-1 text-start">
        <wc-shadcn-label-root style-profile="rhea">مضغوط</wc-shadcn-label-root>
        <p class="text-sm text-muted-foreground">تباعد أدنى للتخطيطات الكثيفة.</p>
      </div>
    </div>
  </wc-shadcn-radio-group-root>
</div>
    `),
    'demo-brutalist-radio-group': basicWc(BRUTALIST),
    'demo-brutalist-radio-group-description': descriptionWc(BRUTALIST),
    'demo-brutalist-radio-group-choice-card': choiceCardWc(BRUTALIST),
    'demo-brutalist-radio-group-fieldset': fieldsetWc(BRUTALIST),
    'demo-brutalist-radio-group-disabled': disabledWc(BRUTALIST),
    'demo-brutalist-radio-group-invalid': invalidWc(BRUTALIST, true),
    'demo-bootstrap-2-3-2-radio-group': basicWc(BOOTSTRAP),
    'demo-bootstrap-2-3-2-radio-group-description': descriptionWc(BOOTSTRAP),
    'demo-bootstrap-2-3-2-radio-group-choice-card': choiceCardWc(BOOTSTRAP),
    'demo-bootstrap-2-3-2-radio-group-fieldset': fieldsetWc(BOOTSTRAP),
    'demo-bootstrap-2-3-2-radio-group-disabled': disabledWc(BOOTSTRAP),
    'demo-bootstrap-2-3-2-radio-group-invalid': invalidWc(BOOTSTRAP, false),
    'demo-liquid-glass-radio-group': basicWc(LIQUID_GLASS),
    'demo-liquid-glass-radio-group-description': descriptionWc(LIQUID_GLASS),
    'demo-liquid-glass-radio-group-choice-card': choiceCardWc(LIQUID_GLASS),
    'demo-liquid-glass-radio-group-prominence': formatCode(`
<div class="grid gap-6 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 sm:grid-cols-3">
  <wc-liquid-glass-radio-group-root default-value="auto" a11y-label="Regular material choices">
    <wc-liquid-glass-radio-group-item value="auto" variant="regular" material="auto">
      <wc-liquid-glass-radio-group-indicator></wc-liquid-glass-radio-group-indicator>
    </wc-liquid-glass-radio-group-item>
  </wc-liquid-glass-radio-group-root>
  <wc-liquid-glass-radio-group-root default-value="priority" a11y-label="Prominent material choices">
    <wc-liquid-glass-radio-group-item value="priority" variant="prominent" material="auto">
      <wc-liquid-glass-radio-group-indicator></wc-liquid-glass-radio-group-indicator>
    </wc-liquid-glass-radio-group-item>
  </wc-liquid-glass-radio-group-root>
  <wc-liquid-glass-radio-group-root default-value="solid" a11y-label="Opaque fallback choices">
    <wc-liquid-glass-radio-group-item value="solid" material="opaque">
      <wc-liquid-glass-radio-group-indicator></wc-liquid-glass-radio-group-indicator>
    </wc-liquid-glass-radio-group-item>
  </wc-liquid-glass-radio-group-root>
</div>
    `),
    'demo-liquid-glass-radio-group-disabled': disabledWc(LIQUID_GLASS),
    'demo-liquid-glass-radio-group-invalid': invalidWc(LIQUID_GLASS, false),
  },
  react: {
    'demo-shadcn-radio-group': basicReact(SHADCN),
    'demo-shadcn-radio-group-description': descriptionReact(SHADCN),
    'demo-shadcn-radio-group-choice-card': choiceCardReact(SHADCN),
    'demo-shadcn-radio-group-fieldset': fieldsetReact(SHADCN),
    'demo-shadcn-radio-group-disabled': disabledReact(SHADCN),
    'demo-shadcn-radio-group-invalid': invalidReact(SHADCN, true),
    'demo-shadcn-radio-group-rtl': formatCode(`
import {
  ShadcnLabelRoot,
  ShadcnRadioGroupIndicator,
  ShadcnRadioGroupItem,
  ShadcnRadioGroupRoot,
} from '../proto-ui/components/react';

export function RadioGroupRtlDemo() {
  return (
    <div dir="rtl">
      <ShadcnRadioGroupRoot styleProfile="rhea" defaultValue="comfortable" a11yLabel="كثافة العرض" className="w-fit">
        <div className="flex items-start gap-3">
          <ShadcnRadioGroupItem styleProfile="rhea" value="default"><ShadcnRadioGroupIndicator styleProfile="rhea" /></ShadcnRadioGroupItem>
          <div className="grid gap-1 text-start">
            <ShadcnLabelRoot styleProfile="rhea">افتراضي</ShadcnLabelRoot>
            <p className="text-sm text-muted-foreground">تباعد قياسي لمعظم حالات الاستخدام.</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <ShadcnRadioGroupItem styleProfile="rhea" value="comfortable"><ShadcnRadioGroupIndicator styleProfile="rhea" /></ShadcnRadioGroupItem>
          <div className="grid gap-1 text-start">
            <ShadcnLabelRoot styleProfile="rhea">مريح</ShadcnLabelRoot>
            <p className="text-sm text-muted-foreground">مساحة أكبر بين العناصر.</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <ShadcnRadioGroupItem styleProfile="rhea" value="compact"><ShadcnRadioGroupIndicator styleProfile="rhea" /></ShadcnRadioGroupItem>
          <div className="grid gap-1 text-start">
            <ShadcnLabelRoot styleProfile="rhea">مضغوط</ShadcnLabelRoot>
            <p className="text-sm text-muted-foreground">تباعد أدنى للتخطيطات الكثيفة.</p>
          </div>
        </div>
      </ShadcnRadioGroupRoot>
    </div>
  );
}
    `),
    'demo-brutalist-radio-group': basicReact(BRUTALIST),
    'demo-brutalist-radio-group-description': descriptionReact(BRUTALIST),
    'demo-brutalist-radio-group-choice-card': choiceCardReact(BRUTALIST),
    'demo-brutalist-radio-group-fieldset': fieldsetReact(BRUTALIST),
    'demo-brutalist-radio-group-disabled': disabledReact(BRUTALIST),
    'demo-brutalist-radio-group-invalid': invalidReact(BRUTALIST, true),
    'demo-bootstrap-2-3-2-radio-group': basicReact(BOOTSTRAP),
    'demo-bootstrap-2-3-2-radio-group-description': descriptionReact(BOOTSTRAP),
    'demo-bootstrap-2-3-2-radio-group-choice-card': choiceCardReact(BOOTSTRAP),
    'demo-bootstrap-2-3-2-radio-group-fieldset': fieldsetReact(BOOTSTRAP),
    'demo-bootstrap-2-3-2-radio-group-disabled': disabledReact(BOOTSTRAP),
    'demo-bootstrap-2-3-2-radio-group-invalid': invalidReact(BOOTSTRAP, false),
    'demo-liquid-glass-radio-group': basicReact(LIQUID_GLASS),
    'demo-liquid-glass-radio-group-description': descriptionReact(LIQUID_GLASS),
    'demo-liquid-glass-radio-group-choice-card': choiceCardReact(LIQUID_GLASS),
    'demo-liquid-glass-radio-group-prominence': formatCode(`
import {
  LiquidGlassLabelRoot,
  LiquidGlassRadioGroupIndicator,
  LiquidGlassRadioGroupItem,
  LiquidGlassRadioGroupRoot,
} from '../proto-ui/components/react';

export function RadioGroupProminenceDemo() {
  return (
    <div className="grid gap-6 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 sm:grid-cols-3">
      <LiquidGlassRadioGroupRoot defaultValue="auto" a11yLabel="Regular material choices">
        <div className="flex items-center gap-3">
          <LiquidGlassRadioGroupItem value="auto" variant="regular" material="auto">
            <LiquidGlassRadioGroupIndicator />
          </LiquidGlassRadioGroupItem>
          <LiquidGlassLabelRoot>Automatic</LiquidGlassLabelRoot>
        </div>
      </LiquidGlassRadioGroupRoot>
      <LiquidGlassRadioGroupRoot defaultValue="priority" a11yLabel="Prominent material choices">
        <div className="flex items-center gap-3">
          <LiquidGlassRadioGroupItem value="priority" variant="prominent" material="auto">
            <LiquidGlassRadioGroupIndicator />
          </LiquidGlassRadioGroupItem>
          <LiquidGlassLabelRoot>Priority</LiquidGlassLabelRoot>
        </div>
      </LiquidGlassRadioGroupRoot>
      <LiquidGlassRadioGroupRoot defaultValue="solid" a11yLabel="Opaque fallback choices">
        <div className="flex items-center gap-3">
          <LiquidGlassRadioGroupItem value="solid" material="opaque">
            <LiquidGlassRadioGroupIndicator />
          </LiquidGlassRadioGroupItem>
          <LiquidGlassLabelRoot>Solid surface</LiquidGlassLabelRoot>
        </div>
      </LiquidGlassRadioGroupRoot>
    </div>
  );
}
    `),
    'demo-liquid-glass-radio-group-disabled': disabledReact(LIQUID_GLASS),
    'demo-liquid-glass-radio-group-invalid': invalidReact(LIQUID_GLASS, false),
  },
  vue: {
    'demo-shadcn-radio-group': basicVue(SHADCN),
    'demo-shadcn-radio-group-description': descriptionVue(SHADCN),
    'demo-shadcn-radio-group-choice-card': choiceCardVue(SHADCN),
    'demo-shadcn-radio-group-fieldset': fieldsetVue(SHADCN),
    'demo-shadcn-radio-group-disabled': disabledVue(SHADCN),
    'demo-shadcn-radio-group-invalid': invalidVue(SHADCN, true),
    'demo-shadcn-radio-group-rtl': formatCode(`
<script setup lang="ts">
import {
  ShadcnLabelRoot,
  ShadcnRadioGroupIndicator,
  ShadcnRadioGroupItem,
  ShadcnRadioGroupRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <div dir="rtl">
    <ShadcnRadioGroupRoot styleProfile="rhea" defaultValue="comfortable" a11yLabel="كثافة العرض" class="w-fit">
      <div class="flex items-start gap-3">
        <ShadcnRadioGroupItem styleProfile="rhea" value="default"><ShadcnRadioGroupIndicator styleProfile="rhea" /></ShadcnRadioGroupItem>
        <div class="grid gap-1 text-start">
          <ShadcnLabelRoot styleProfile="rhea">افتراضي</ShadcnLabelRoot>
          <p class="text-sm text-muted-foreground">تباعد قياسي لمعظم حالات الاستخدام.</p>
        </div>
      </div>
      <div class="flex items-start gap-3">
        <ShadcnRadioGroupItem styleProfile="rhea" value="comfortable"><ShadcnRadioGroupIndicator styleProfile="rhea" /></ShadcnRadioGroupItem>
        <div class="grid gap-1 text-start">
          <ShadcnLabelRoot styleProfile="rhea">مريح</ShadcnLabelRoot>
          <p class="text-sm text-muted-foreground">مساحة أكبر بين العناصر.</p>
        </div>
      </div>
    </ShadcnRadioGroupRoot>
  </div>
</template>
    `),
    'demo-brutalist-radio-group': basicVue(BRUTALIST),
    'demo-brutalist-radio-group-description': descriptionVue(BRUTALIST),
    'demo-brutalist-radio-group-choice-card': choiceCardVue(BRUTALIST),
    'demo-brutalist-radio-group-fieldset': fieldsetVue(BRUTALIST),
    'demo-brutalist-radio-group-disabled': disabledVue(BRUTALIST),
    'demo-brutalist-radio-group-invalid': invalidVue(BRUTALIST, true),
    'demo-bootstrap-2-3-2-radio-group': basicVue(BOOTSTRAP),
    'demo-bootstrap-2-3-2-radio-group-description': descriptionVue(BOOTSTRAP),
    'demo-bootstrap-2-3-2-radio-group-choice-card': choiceCardVue(BOOTSTRAP),
    'demo-bootstrap-2-3-2-radio-group-fieldset': fieldsetVue(BOOTSTRAP),
    'demo-bootstrap-2-3-2-radio-group-disabled': disabledVue(BOOTSTRAP),
    'demo-bootstrap-2-3-2-radio-group-invalid': invalidVue(BOOTSTRAP, false),
    'demo-liquid-glass-radio-group': basicVue(LIQUID_GLASS),
    'demo-liquid-glass-radio-group-description': descriptionVue(LIQUID_GLASS),
    'demo-liquid-glass-radio-group-choice-card': choiceCardVue(LIQUID_GLASS),
    'demo-liquid-glass-radio-group-prominence': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassLabelRoot,
  LiquidGlassRadioGroupIndicator,
  LiquidGlassRadioGroupItem,
  LiquidGlassRadioGroupRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="grid gap-6 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 sm:grid-cols-3">
    <LiquidGlassRadioGroupRoot defaultValue="auto" a11yLabel="Regular material choices">
      <div class="flex items-center gap-3">
        <LiquidGlassRadioGroupItem value="auto" variant="regular" material="auto"><LiquidGlassRadioGroupIndicator /></LiquidGlassRadioGroupItem>
        <LiquidGlassLabelRoot>Automatic</LiquidGlassLabelRoot>
      </div>
    </LiquidGlassRadioGroupRoot>
    <LiquidGlassRadioGroupRoot defaultValue="priority" a11yLabel="Prominent material choices">
      <div class="flex items-center gap-3">
        <LiquidGlassRadioGroupItem value="priority" variant="prominent" material="auto"><LiquidGlassRadioGroupIndicator /></LiquidGlassRadioGroupItem>
        <LiquidGlassLabelRoot>Priority</LiquidGlassLabelRoot>
      </div>
    </LiquidGlassRadioGroupRoot>
    <LiquidGlassRadioGroupRoot defaultValue="solid" a11yLabel="Opaque fallback choices">
      <div class="flex items-center gap-3">
        <LiquidGlassRadioGroupItem value="solid" material="opaque"><LiquidGlassRadioGroupIndicator /></LiquidGlassRadioGroupItem>
        <LiquidGlassLabelRoot>Solid surface</LiquidGlassLabelRoot>
      </div>
    </LiquidGlassRadioGroupRoot>
  </div>
</template>
    `),
    'demo-liquid-glass-radio-group-disabled': disabledVue(LIQUID_GLASS),
    'demo-liquid-glass-radio-group-invalid': invalidVue(LIQUID_GLASS, false),
  },
  vue2: {
    'demo-shadcn-radio-group': basicVue2(SHADCN),
    'demo-shadcn-radio-group-description': descriptionVue2(SHADCN),
    'demo-shadcn-radio-group-choice-card': choiceCardVue2(SHADCN),
    'demo-shadcn-radio-group-fieldset': fieldsetVue2(SHADCN),
    'demo-shadcn-radio-group-disabled': disabledVue2(SHADCN),
    'demo-shadcn-radio-group-invalid': invalidVue2(SHADCN, true),
    'demo-shadcn-radio-group-rtl': formatCode(`
<template>
  <div dir="rtl">
    <ShadcnRadioGroupRoot styleProfile="rhea" defaultValue="comfortable" a11yLabel="كثافة العرض" class="w-fit">
      <div class="flex items-start gap-3">
        <ShadcnRadioGroupItem styleProfile="rhea" value="default"><ShadcnRadioGroupIndicator styleProfile="rhea" /></ShadcnRadioGroupItem>
        <div class="grid gap-1 text-start">
          <ShadcnLabelRoot styleProfile="rhea">افتراضي</ShadcnLabelRoot>
          <p class="text-sm text-muted-foreground">تباعد قياسي لمعظم حالات الاستخدام.</p>
        </div>
      </div>
      <div class="flex items-start gap-3">
        <ShadcnRadioGroupItem styleProfile="rhea" value="comfortable"><ShadcnRadioGroupIndicator styleProfile="rhea" /></ShadcnRadioGroupItem>
        <div class="grid gap-1 text-start">
          <ShadcnLabelRoot styleProfile="rhea">مريح</ShadcnLabelRoot>
          <p class="text-sm text-muted-foreground">مساحة أكبر بين العناصر.</p>
        </div>
      </div>
    </ShadcnRadioGroupRoot>
  </div>
</template>

<script>
import {
  ShadcnLabelRoot,
  ShadcnRadioGroupIndicator,
  ShadcnRadioGroupItem,
  ShadcnRadioGroupRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnLabelRoot,
    ShadcnRadioGroupIndicator,
    ShadcnRadioGroupItem,
    ShadcnRadioGroupRoot,
  },
};
</script>
    `),
    'demo-brutalist-radio-group': basicVue2(BRUTALIST),
    'demo-brutalist-radio-group-description': descriptionVue2(BRUTALIST),
    'demo-brutalist-radio-group-choice-card': choiceCardVue2(BRUTALIST),
    'demo-brutalist-radio-group-fieldset': fieldsetVue2(BRUTALIST),
    'demo-brutalist-radio-group-disabled': disabledVue2(BRUTALIST),
    'demo-brutalist-radio-group-invalid': invalidVue2(BRUTALIST, true),
    'demo-bootstrap-2-3-2-radio-group': basicVue2(BOOTSTRAP),
    'demo-bootstrap-2-3-2-radio-group-description': descriptionVue2(BOOTSTRAP),
    'demo-bootstrap-2-3-2-radio-group-choice-card': choiceCardVue2(BOOTSTRAP),
    'demo-bootstrap-2-3-2-radio-group-fieldset': fieldsetVue2(BOOTSTRAP),
    'demo-bootstrap-2-3-2-radio-group-disabled': disabledVue2(BOOTSTRAP),
    'demo-bootstrap-2-3-2-radio-group-invalid': invalidVue2(BOOTSTRAP, false),
    'demo-liquid-glass-radio-group': basicVue2(LIQUID_GLASS),
    'demo-liquid-glass-radio-group-description': descriptionVue2(LIQUID_GLASS),
    'demo-liquid-glass-radio-group-choice-card': choiceCardVue2(LIQUID_GLASS),
    'demo-liquid-glass-radio-group-prominence': formatCode(`
<template>
  <div class="grid gap-6 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 sm:grid-cols-3">
    <LiquidGlassRadioGroupRoot defaultValue="auto" a11yLabel="Regular material choices">
      <div class="flex items-center gap-3">
        <LiquidGlassRadioGroupItem value="auto" variant="regular" material="auto"><LiquidGlassRadioGroupIndicator /></LiquidGlassRadioGroupItem>
        <LiquidGlassLabelRoot>Automatic</LiquidGlassLabelRoot>
      </div>
    </LiquidGlassRadioGroupRoot>
    <LiquidGlassRadioGroupRoot defaultValue="priority" a11yLabel="Prominent material choices">
      <div class="flex items-center gap-3">
        <LiquidGlassRadioGroupItem value="priority" variant="prominent" material="auto"><LiquidGlassRadioGroupIndicator /></LiquidGlassRadioGroupItem>
        <LiquidGlassLabelRoot>Priority</LiquidGlassLabelRoot>
      </div>
    </LiquidGlassRadioGroupRoot>
    <LiquidGlassRadioGroupRoot defaultValue="solid" a11yLabel="Opaque fallback choices">
      <div class="flex items-center gap-3">
        <LiquidGlassRadioGroupItem value="solid" material="opaque"><LiquidGlassRadioGroupIndicator /></LiquidGlassRadioGroupItem>
        <LiquidGlassLabelRoot>Solid surface</LiquidGlassLabelRoot>
      </div>
    </LiquidGlassRadioGroupRoot>
  </div>
</template>

<script>
import {
  LiquidGlassLabelRoot,
  LiquidGlassRadioGroupIndicator,
  LiquidGlassRadioGroupItem,
  LiquidGlassRadioGroupRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassLabelRoot,
    LiquidGlassRadioGroupIndicator,
    LiquidGlassRadioGroupItem,
    LiquidGlassRadioGroupRoot,
  },
};
</script>
    `),
    'demo-liquid-glass-radio-group-disabled': disabledVue2(LIQUID_GLASS),
    'demo-liquid-glass-radio-group-invalid': invalidVue2(LIQUID_GLASS, false),
  },
};
