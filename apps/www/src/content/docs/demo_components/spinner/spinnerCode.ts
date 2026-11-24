import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-brutalist-spinner': formatCode(`
<div id="brutalist-spinner-hero" class="flex flex-col gap-4">
  <div class="flex flex-wrap items-center gap-4">
    <proto-ui-brutalist-spinner-root data-size="sm"></proto-ui-brutalist-spinner-root>
    <proto-ui-brutalist-spinner-root data-size="md"></proto-ui-brutalist-spinner-root>
    <proto-ui-brutalist-spinner-root data-size="lg"></proto-ui-brutalist-spinner-root>
  </div>
  <proto-ui-base-async-region-root
    id="spinner-busy-region"
    class="flex items-center gap-3 rounded-[5px] border-2 border-black bg-[var(--pui-secondary-background)] px-3.5 py-2.5 text-sm font-medium text-[var(--pui-foreground)] shadow-[4px_4px_0_0_#000]"
  >
    <proto-ui-brutalist-spinner-root></proto-ui-brutalist-spinner-root>
    Loading results…
  </proto-ui-base-async-region-root>
  <div class="flex items-center gap-3">
    <proto-ui-brutalist-button>
      <proto-ui-brutalist-spinner-root data-size="sm"></proto-ui-brutalist-spinner-root>
      Saving…
    </proto-ui-brutalist-button>
  </div>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  document.querySelectorAll('#brutalist-spinner-hero proto-ui-brutalist-spinner-root[data-size]').forEach((el) => {
    if (el instanceof HTMLElement && el.dataset.size) {
      setElementProps(el, { size: el.dataset.size });
    }
  });
  const region = document.querySelector('#spinner-busy-region');
  if (region instanceof HTMLElement) setElementProps(region, { busy: true });
</script>
    `),
    'demo-brutalist-spinner-sizes': formatCode(`
<div id="brutalist-spinner-sizes" class="flex flex-wrap items-end gap-6">
  <div class="flex flex-col items-center gap-2">
    <proto-ui-brutalist-spinner-root data-size="sm"></proto-ui-brutalist-spinner-root>
    <span class="text-xs font-medium">sm (16px)</span>
  </div>
  <div class="flex flex-col items-center gap-2">
    <proto-ui-brutalist-spinner-root data-size="md"></proto-ui-brutalist-spinner-root>
    <span class="text-xs font-medium">md (24px)</span>
  </div>
  <div class="flex flex-col items-center gap-2">
    <proto-ui-brutalist-spinner-root data-size="lg"></proto-ui-brutalist-spinner-root>
    <span class="text-xs font-medium">lg (32px)</span>
  </div>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  document.querySelectorAll('#brutalist-spinner-sizes proto-ui-brutalist-spinner-root').forEach((el) => {
    if (el instanceof HTMLElement && el.dataset.size) {
      setElementProps(el, { size: el.dataset.size });
    }
  });
</script>
    `),
    'demo-brutalist-spinner-button': formatCode(`
<div id="brutalist-spinner-buttons" class="flex flex-wrap items-center gap-4">
  <proto-ui-brutalist-button>
    <proto-ui-brutalist-spinner-root></proto-ui-brutalist-spinner-root>
    Please wait
  </proto-ui-brutalist-button>
  <proto-ui-brutalist-button>
    <proto-ui-brutalist-spinner-root></proto-ui-brutalist-spinner-root>
    Saving…
  </proto-ui-brutalist-button>
  <proto-ui-brutalist-button>
    <proto-ui-brutalist-spinner-root></proto-ui-brutalist-spinner-root>
    Processing
  </proto-ui-brutalist-button>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const buttonProps = [
    { disabled: true },
    { variant: 'surface', disabled: true },
    { color: 'mint' },
  ];
  document.querySelectorAll('#brutalist-spinner-buttons proto-ui-brutalist-button').forEach((btn, i) => {
    if (btn instanceof HTMLElement) setElementProps(btn, buttonProps[i]);
  });
  document.querySelectorAll('#brutalist-spinner-buttons proto-ui-brutalist-spinner-root').forEach((el) => {
    if (el instanceof HTMLElement) setElementProps(el, { size: 'sm' });
  });
</script>
    `),
    'demo-brutalist-spinner-badge': formatCode(`
<div id="brutalist-spinner-badges" class="flex flex-wrap items-center gap-3">
  <proto-ui-brutalist-badge-root>
    <span class="inline-flex items-center gap-1.5">
      <proto-ui-brutalist-spinner-root></proto-ui-brutalist-spinner-root>
      Syncing
    </span>
  </proto-ui-brutalist-badge-root>
  <proto-ui-brutalist-badge-root>
    <span class="inline-flex items-center gap-1.5">
      <proto-ui-brutalist-spinner-root></proto-ui-brutalist-spinner-root>
      Updating
    </span>
  </proto-ui-brutalist-badge-root>
  <proto-ui-brutalist-badge-root>
    <span class="inline-flex items-center gap-1.5">
      <proto-ui-brutalist-spinner-root></proto-ui-brutalist-spinner-root>
      Processing
    </span>
  </proto-ui-brutalist-badge-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const tones = [{ tone: 'accent' }, { tone: 'info' }, { tone: 'danger' }];
  document.querySelectorAll('#brutalist-spinner-badges proto-ui-brutalist-badge-root').forEach((badge, i) => {
    if (badge instanceof HTMLElement) setElementProps(badge, tones[i]);
  });
  document.querySelectorAll('#brutalist-spinner-badges proto-ui-brutalist-spinner-root').forEach((el) => {
    if (el instanceof HTMLElement) setElementProps(el, { size: 'sm' });
  });
</script>
    `),
    'demo-brutalist-spinner-async-region': formatCode(`
<div class="flex w-full max-w-sm flex-col gap-3">
  <proto-ui-base-async-region-root
    id="spinner-payment-region"
    class="flex items-center justify-between gap-4 rounded-[5px] border-2 border-black bg-[var(--pui-secondary-background)] px-4 py-3 text-sm font-medium text-[var(--pui-foreground)] shadow-[4px_4px_0_0_#000]"
  >
    <div class="flex items-center gap-3">
      <proto-ui-brutalist-spinner-root id="spinner-payment-icon"></proto-ui-brutalist-spinner-root>
      Processing payment…
    </div>
    <span class="text-xs font-bold">$100.00</span>
  </proto-ui-base-async-region-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const region = document.querySelector('#spinner-payment-region');
  const icon = document.querySelector('#spinner-payment-icon');
  if (region instanceof HTMLElement) setElementProps(region, { busy: true });
  if (icon instanceof HTMLElement) setElementProps(icon, { size: 'sm' });
</script>
    `),
  },
  react: {
    'demo-brutalist-spinner': formatCode(`
import {
  BaseAsyncRegionRoot,
  BrutalistButton,
  BrutalistSpinnerRoot,
} from '../proto-ui/components/react';

export function BrutalistSpinnerDemo() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <BrutalistSpinnerRoot size="sm" />
        <BrutalistSpinnerRoot size="md" />
        <BrutalistSpinnerRoot size="lg" />
      </div>
      <BaseAsyncRegionRoot
        busy
        className="flex items-center gap-3 rounded-[5px] border-2 border-black bg-[var(--pui-secondary-background)] px-3.5 py-2.5 text-sm font-medium text-[var(--pui-foreground)] shadow-[4px_4px_0_0_#000]"
      >
        <BrutalistSpinnerRoot />
        Loading results…
      </BaseAsyncRegionRoot>
      <div className="flex items-center gap-3">
        <BrutalistButton>
          <BrutalistSpinnerRoot size="sm" />
          Saving…
        </BrutalistButton>
      </div>
    </div>
  );
}
    `),
    'demo-brutalist-spinner-sizes': formatCode(`
import { BrutalistSpinnerRoot } from '../proto-ui/components/react';

export function BrutalistSpinnerSizesDemo() {
  return (
    <div className="flex flex-wrap items-end gap-6">
      <div className="flex flex-col items-center gap-2">
        <BrutalistSpinnerRoot size="sm" />
        <span className="text-xs font-medium">sm (16px)</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <BrutalistSpinnerRoot size="md" />
        <span className="text-xs font-medium">md (24px)</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <BrutalistSpinnerRoot size="lg" />
        <span className="text-xs font-medium">lg (32px)</span>
      </div>
    </div>
  );
}
    `),
    'demo-brutalist-spinner-button': formatCode(`
import { BrutalistButton, BrutalistSpinnerRoot } from '../proto-ui/components/react';

export function BrutalistSpinnerButtonDemo() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <BrutalistButton disabled>
        <BrutalistSpinnerRoot size="sm" />
        Please wait
      </BrutalistButton>
      <BrutalistButton variant="surface" disabled>
        <BrutalistSpinnerRoot size="sm" />
        Saving…
      </BrutalistButton>
      <BrutalistButton color="mint">
        <BrutalistSpinnerRoot size="sm" />
        Processing
      </BrutalistButton>
    </div>
  );
}
    `),
    'demo-brutalist-spinner-badge': formatCode(`
import { BrutalistBadgeRoot, BrutalistSpinnerRoot } from '../proto-ui/components/react';

export function BrutalistSpinnerBadgeDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <BrutalistBadgeRoot tone="accent">
        <span className="inline-flex items-center gap-1.5">
          <BrutalistSpinnerRoot size="sm" />
          Syncing
        </span>
      </BrutalistBadgeRoot>
      <BrutalistBadgeRoot tone="info">
        <span className="inline-flex items-center gap-1.5">
          <BrutalistSpinnerRoot size="sm" />
          Updating
        </span>
      </BrutalistBadgeRoot>
      <BrutalistBadgeRoot tone="danger">
        <span className="inline-flex items-center gap-1.5">
          <BrutalistSpinnerRoot size="sm" />
          Processing
        </span>
      </BrutalistBadgeRoot>
    </div>
  );
}
    `),
    'demo-brutalist-spinner-async-region': formatCode(`
import { BaseAsyncRegionRoot, BrutalistSpinnerRoot } from '../proto-ui/components/react';

export function BrutalistSpinnerAsyncRegionDemo() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <BaseAsyncRegionRoot
        busy
        className="flex items-center justify-between gap-4 rounded-[5px] border-2 border-black bg-[var(--pui-secondary-background)] px-4 py-3 text-sm font-medium text-[var(--pui-foreground)] shadow-[4px_4px_0_0_#000]"
      >
        <div className="flex items-center gap-3">
          <BrutalistSpinnerRoot size="sm" />
          Processing payment…
        </div>
        <span className="text-xs font-bold">$100.00</span>
      </BaseAsyncRegionRoot>
    </div>
  );
}
    `),
  },
  vue: {
    'demo-brutalist-spinner': formatCode(`
<script setup lang="ts">
import {
  BaseAsyncRegionRoot,
  BrutalistButton,
  BrutalistSpinnerRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-4">
      <BrutalistSpinnerRoot size="sm" />
      <BrutalistSpinnerRoot size="md" />
      <BrutalistSpinnerRoot size="lg" />
    </div>
    <BaseAsyncRegionRoot
      :busy="true"
      class="flex items-center gap-3 rounded-[5px] border-2 border-black bg-[var(--pui-secondary-background)] px-3.5 py-2.5 text-sm font-medium text-[var(--pui-foreground)] shadow-[4px_4px_0_0_#000]"
    >
      <BrutalistSpinnerRoot />
      Loading results…
    </BaseAsyncRegionRoot>
    <div class="flex items-center gap-3">
      <BrutalistButton>
        <BrutalistSpinnerRoot size="sm" />
        Saving…
      </BrutalistButton>
    </div>
  </div>
</template>
    `),
    'demo-brutalist-spinner-sizes': formatCode(`
<script setup lang="ts">
import { BrutalistSpinnerRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-end gap-6">
    <div class="flex flex-col items-center gap-2">
      <BrutalistSpinnerRoot size="sm" />
      <span class="text-xs font-medium">sm (16px)</span>
    </div>
    <div class="flex flex-col items-center gap-2">
      <BrutalistSpinnerRoot size="md" />
      <span class="text-xs font-medium">md (24px)</span>
    </div>
    <div class="flex flex-col items-center gap-2">
      <BrutalistSpinnerRoot size="lg" />
      <span class="text-xs font-medium">lg (32px)</span>
    </div>
  </div>
</template>
    `),
    'demo-brutalist-spinner-button': formatCode(`
<script setup lang="ts">
import { BrutalistButton, BrutalistSpinnerRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-4">
    <BrutalistButton :disabled="true">
      <BrutalistSpinnerRoot size="sm" />
      Please wait
    </BrutalistButton>
    <BrutalistButton variant="surface" :disabled="true">
      <BrutalistSpinnerRoot size="sm" />
      Saving…
    </BrutalistButton>
    <BrutalistButton color="mint">
      <BrutalistSpinnerRoot size="sm" />
      Processing
    </BrutalistButton>
  </div>
</template>
    `),
    'demo-brutalist-spinner-badge': formatCode(`
<script setup lang="ts">
import { BrutalistBadgeRoot, BrutalistSpinnerRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <BrutalistBadgeRoot tone="accent">
      <span class="inline-flex items-center gap-1.5">
        <BrutalistSpinnerRoot size="sm" />
        Syncing
      </span>
    </BrutalistBadgeRoot>
    <BrutalistBadgeRoot tone="info">
      <span class="inline-flex items-center gap-1.5">
        <BrutalistSpinnerRoot size="sm" />
        Updating
      </span>
    </BrutalistBadgeRoot>
    <BrutalistBadgeRoot tone="danger">
      <span class="inline-flex items-center gap-1.5">
        <BrutalistSpinnerRoot size="sm" />
        Processing
      </span>
    </BrutalistBadgeRoot>
  </div>
</template>
    `),
    'demo-brutalist-spinner-async-region': formatCode(`
<script setup lang="ts">
import { BaseAsyncRegionRoot, BrutalistSpinnerRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex w-full max-w-sm flex-col gap-3">
    <BaseAsyncRegionRoot
      :busy="true"
      class="flex items-center justify-between gap-4 rounded-[5px] border-2 border-black bg-[var(--pui-secondary-background)] px-4 py-3 text-sm font-medium text-[var(--pui-foreground)] shadow-[4px_4px_0_0_#000]"
    >
      <div class="flex items-center gap-3">
        <BrutalistSpinnerRoot size="sm" />
        Processing payment…
      </div>
      <span class="text-xs font-bold">$100.00</span>
    </BaseAsyncRegionRoot>
  </div>
</template>
    `),
  },
  vue2: {
    'demo-brutalist-spinner': formatCode(`
<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-4">
      <BrutalistSpinnerRoot size="sm" />
      <BrutalistSpinnerRoot size="md" />
      <BrutalistSpinnerRoot size="lg" />
    </div>
    <BaseAsyncRegionRoot
      :busy="true"
      class="flex items-center gap-3 rounded-[5px] border-2 border-black bg-[var(--pui-secondary-background)] px-3.5 py-2.5 text-sm font-medium text-[var(--pui-foreground)] shadow-[4px_4px_0_0_#000]"
    >
      <BrutalistSpinnerRoot />
      Loading results…
    </BaseAsyncRegionRoot>
    <div class="flex items-center gap-3">
      <BrutalistButton>
        <BrutalistSpinnerRoot size="sm" />
        Saving…
      </BrutalistButton>
    </div>
  </div>
</template>

<script>
import {
  BaseAsyncRegionRoot,
  BrutalistButton,
  BrutalistSpinnerRoot,
} from '../proto-ui/components/vue2';

export default {
  components: { BaseAsyncRegionRoot, BrutalistButton, BrutalistSpinnerRoot },
};
</script>
    `),
    'demo-brutalist-spinner-sizes': formatCode(`
<template>
  <div class="flex flex-wrap items-end gap-6">
    <div class="flex flex-col items-center gap-2">
      <BrutalistSpinnerRoot size="sm" />
      <span class="text-xs font-medium">sm (16px)</span>
    </div>
    <div class="flex flex-col items-center gap-2">
      <BrutalistSpinnerRoot size="md" />
      <span class="text-xs font-medium">md (24px)</span>
    </div>
    <div class="flex flex-col items-center gap-2">
      <BrutalistSpinnerRoot size="lg" />
      <span class="text-xs font-medium">lg (32px)</span>
    </div>
  </div>
</template>

<script>
import { BrutalistSpinnerRoot } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistSpinnerRoot },
};
</script>
    `),
    'demo-brutalist-spinner-button': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-4">
    <BrutalistButton :disabled="true">
      <BrutalistSpinnerRoot size="sm" />
      Please wait
    </BrutalistButton>
    <BrutalistButton variant="surface" :disabled="true">
      <BrutalistSpinnerRoot size="sm" />
      Saving…
    </BrutalistButton>
    <BrutalistButton color="mint">
      <BrutalistSpinnerRoot size="sm" />
      Processing
    </BrutalistButton>
  </div>
</template>

<script>
import { BrutalistButton, BrutalistSpinnerRoot } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistButton, BrutalistSpinnerRoot },
};
</script>
    `),
    'demo-brutalist-spinner-badge': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-3">
    <BrutalistBadgeRoot tone="accent">
      <span class="inline-flex items-center gap-1.5">
        <BrutalistSpinnerRoot size="sm" />
        Syncing
      </span>
    </BrutalistBadgeRoot>
    <BrutalistBadgeRoot tone="info">
      <span class="inline-flex items-center gap-1.5">
        <BrutalistSpinnerRoot size="sm" />
        Updating
      </span>
    </BrutalistBadgeRoot>
    <BrutalistBadgeRoot tone="danger">
      <span class="inline-flex items-center gap-1.5">
        <BrutalistSpinnerRoot size="sm" />
        Processing
      </span>
    </BrutalistBadgeRoot>
  </div>
</template>

<script>
import { BrutalistBadgeRoot, BrutalistSpinnerRoot } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistBadgeRoot, BrutalistSpinnerRoot },
};
</script>
    `),
    'demo-brutalist-spinner-async-region': formatCode(`
<template>
  <div class="flex w-full max-w-sm flex-col gap-3">
    <BaseAsyncRegionRoot
      :busy="true"
      class="flex items-center justify-between gap-4 rounded-[5px] border-2 border-black bg-[var(--pui-secondary-background)] px-4 py-3 text-sm font-medium text-[var(--pui-foreground)] shadow-[4px_4px_0_0_#000]"
    >
      <div class="flex items-center gap-3">
        <BrutalistSpinnerRoot size="sm" />
        Processing payment…
      </div>
      <span class="text-xs font-bold">$100.00</span>
    </BaseAsyncRegionRoot>
  </div>
</template>

<script>
import { BaseAsyncRegionRoot, BrutalistSpinnerRoot } from '../proto-ui/components/vue2';

export default {
  components: { BaseAsyncRegionRoot, BrutalistSpinnerRoot },
};
</script>
    `),
  },
};
