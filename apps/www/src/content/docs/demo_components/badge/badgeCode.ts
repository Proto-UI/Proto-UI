import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-brutalist-badge': formatCode(`
<div id="brutalist-badge-demo" class="flex flex-wrap items-center gap-3">
  <proto-ui-brutalist-badge-root>Accent</proto-ui-brutalist-badge-root>
  <proto-ui-brutalist-badge-root>Info</proto-ui-brutalist-badge-root>
  <proto-ui-brutalist-badge-root>Danger</proto-ui-brutalist-badge-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const tones = ['accent', 'info', 'danger'];
  document.querySelectorAll('#brutalist-badge-demo proto-ui-brutalist-badge-root').forEach((badge, index) => {
    if (!(badge instanceof HTMLElement)) throw new Error('Missing Brutalist Badge');
    setElementProps(badge, { tone: tones[index] });
  });
</script>
    `),
    'demo-brutalist-badge-default': formatCode(`
<div class="flex flex-wrap items-center justify-center gap-3">
  <proto-ui-brutalist-badge-root>Badge</proto-ui-brutalist-badge-root>
</div>
    `),
    'demo-brutalist-badge-tones': formatCode(`
<div id="brutalist-badge-tones" class="flex flex-wrap items-center justify-center gap-3">
  <proto-ui-brutalist-badge-root>Draft</proto-ui-brutalist-badge-root>
  <proto-ui-brutalist-badge-root>Staging</proto-ui-brutalist-badge-root>
  <proto-ui-brutalist-badge-root>Deprecated</proto-ui-brutalist-badge-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const tones = ['accent', 'info', 'danger'];
  document.querySelectorAll('#brutalist-badge-tones proto-ui-brutalist-badge-root').forEach((badge, index) => {
    if (!(badge instanceof HTMLElement)) throw new Error('Missing Brutalist Badge');
    setElementProps(badge, { tone: tones[index] });
  });
</script>
    `),
    'demo-brutalist-badge-with-icon': formatCode(`
<div id="brutalist-badge-icons" class="flex flex-wrap items-center justify-center gap-3">
  <proto-ui-brutalist-badge-root><span aria-hidden="true">✓</span>Verified</proto-ui-brutalist-badge-root>
  <proto-ui-brutalist-badge-root><span aria-hidden="true">★</span>Featured</proto-ui-brutalist-badge-root>
  <proto-ui-brutalist-badge-root>Breaking<span aria-hidden="true">!</span></proto-ui-brutalist-badge-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const tones = ['info', 'accent', 'danger'];
  document.querySelectorAll('#brutalist-badge-icons proto-ui-brutalist-badge-root').forEach((badge, index) => {
    if (!(badge instanceof HTMLElement)) throw new Error('Missing Brutalist Badge');
    setElementProps(badge, { tone: tones[index] });
  });
</script>
    `),
    'demo-brutalist-badge-roles': formatCode(`
<div id="brutalist-badge-roles" class="flex flex-col gap-2.5 text-sm">
  <div class="flex flex-wrap items-center justify-between gap-4">
    <span class="font-medium">Workspace Role</span>
    <proto-ui-brutalist-badge-root>Maintainer</proto-ui-brutalist-badge-root>
  </div>
  <div class="flex flex-wrap items-center justify-between gap-4">
    <span class="font-medium">Deployment Target</span>
    <proto-ui-brutalist-badge-root>Production</proto-ui-brutalist-badge-root>
  </div>
  <div class="flex flex-wrap items-center justify-between gap-4">
    <span class="font-medium">Legacy API v1</span>
    <proto-ui-brutalist-badge-root>Sunset</proto-ui-brutalist-badge-root>
  </div>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const tones = ['accent', 'info', 'danger'];
  document.querySelectorAll('#brutalist-badge-roles proto-ui-brutalist-badge-root').forEach((badge, index) => {
    if (!(badge instanceof HTMLElement)) throw new Error('Missing Brutalist Badge');
    setElementProps(badge, { tone: tones[index] });
  });
</script>
    `),
  },
  react: {
    'demo-brutalist-badge': formatCode(`
import { BrutalistBadgeRoot } from '../proto-ui/components/react';

export function BrutalistBadgeDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <BrutalistBadgeRoot tone="accent">Accent</BrutalistBadgeRoot>
      <BrutalistBadgeRoot tone="info">Info</BrutalistBadgeRoot>
      <BrutalistBadgeRoot tone="danger">Danger</BrutalistBadgeRoot>
    </div>
  );
}
    `),
    'demo-brutalist-badge-default': formatCode(`
import { BrutalistBadgeRoot } from '../proto-ui/components/react';

export function BrutalistBadgeDefaultDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <BrutalistBadgeRoot>Badge</BrutalistBadgeRoot>
    </div>
  );
}
    `),
    'demo-brutalist-badge-tones': formatCode(`
import { BrutalistBadgeRoot } from '../proto-ui/components/react';

export function BrutalistBadgeTonesDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <BrutalistBadgeRoot tone="accent">Draft</BrutalistBadgeRoot>
      <BrutalistBadgeRoot tone="info">Staging</BrutalistBadgeRoot>
      <BrutalistBadgeRoot tone="danger">Deprecated</BrutalistBadgeRoot>
    </div>
  );
}
    `),
    'demo-brutalist-badge-with-icon': formatCode(`
import { BrutalistBadgeRoot } from '../proto-ui/components/react';

export function BrutalistBadgeWithIconDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <BrutalistBadgeRoot tone="info">
        <span aria-hidden="true">✓</span>
        Verified
      </BrutalistBadgeRoot>
      <BrutalistBadgeRoot tone="accent">
        <span aria-hidden="true">★</span>
        Featured
      </BrutalistBadgeRoot>
      <BrutalistBadgeRoot tone="danger">
        Breaking
        <span aria-hidden="true">!</span>
      </BrutalistBadgeRoot>
    </div>
  );
}
    `),
    'demo-brutalist-badge-roles': formatCode(`
import { BrutalistBadgeRoot } from '../proto-ui/components/react';

export function BrutalistBadgeRolesDemo() {
  return (
    <div className="flex flex-col gap-2.5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <span className="font-medium">Workspace Role</span>
        <BrutalistBadgeRoot tone="accent">Maintainer</BrutalistBadgeRoot>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <span className="font-medium">Deployment Target</span>
        <BrutalistBadgeRoot tone="info">Production</BrutalistBadgeRoot>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <span className="font-medium">Legacy API v1</span>
        <BrutalistBadgeRoot tone="danger">Sunset</BrutalistBadgeRoot>
      </div>
    </div>
  );
}
    `),
  },
  vue: {
    'demo-brutalist-badge': formatCode(`
<script setup lang="ts">
import { BrutalistBadgeRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <BrutalistBadgeRoot tone="accent">Accent</BrutalistBadgeRoot>
    <BrutalistBadgeRoot tone="info">Info</BrutalistBadgeRoot>
    <BrutalistBadgeRoot tone="danger">Danger</BrutalistBadgeRoot>
  </div>
</template>
    `),
    'demo-brutalist-badge-default': formatCode(`
<script setup lang="ts">
import { BrutalistBadgeRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-3">
    <BrutalistBadgeRoot>Badge</BrutalistBadgeRoot>
  </div>
</template>
    `),
    'demo-brutalist-badge-tones': formatCode(`
<script setup lang="ts">
import { BrutalistBadgeRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-3">
    <BrutalistBadgeRoot tone="accent">Draft</BrutalistBadgeRoot>
    <BrutalistBadgeRoot tone="info">Staging</BrutalistBadgeRoot>
    <BrutalistBadgeRoot tone="danger">Deprecated</BrutalistBadgeRoot>
  </div>
</template>
    `),
    'demo-brutalist-badge-with-icon': formatCode(`
<script setup lang="ts">
import { BrutalistBadgeRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-3">
    <BrutalistBadgeRoot tone="info">
      <span aria-hidden="true">✓</span>
      Verified
    </BrutalistBadgeRoot>
    <BrutalistBadgeRoot tone="accent">
      <span aria-hidden="true">★</span>
      Featured
    </BrutalistBadgeRoot>
    <BrutalistBadgeRoot tone="danger">
      Breaking
      <span aria-hidden="true">!</span>
    </BrutalistBadgeRoot>
  </div>
</template>
    `),
    'demo-brutalist-badge-roles': formatCode(`
<script setup lang="ts">
import { BrutalistBadgeRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-col gap-2.5 text-sm">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <span class="font-medium">Workspace Role</span>
      <BrutalistBadgeRoot tone="accent">Maintainer</BrutalistBadgeRoot>
    </div>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <span class="font-medium">Deployment Target</span>
      <BrutalistBadgeRoot tone="info">Production</BrutalistBadgeRoot>
    </div>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <span class="font-medium">Legacy API v1</span>
      <BrutalistBadgeRoot tone="danger">Sunset</BrutalistBadgeRoot>
    </div>
  </div>
</template>
    `),
  },
  vue2: {
    'demo-brutalist-badge': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-3">
    <BrutalistBadgeRoot tone="accent">Accent</BrutalistBadgeRoot>
    <BrutalistBadgeRoot tone="info">Info</BrutalistBadgeRoot>
    <BrutalistBadgeRoot tone="danger">Danger</BrutalistBadgeRoot>
  </div>
</template>

<script>
import { BrutalistBadgeRoot } from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistBadgeRoot,
  },
};
</script>
    `),
    'demo-brutalist-badge-default': formatCode(`
<template>
  <div class="flex flex-wrap items-center justify-center gap-3">
    <BrutalistBadgeRoot>Badge</BrutalistBadgeRoot>
  </div>
</template>

<script>
import { BrutalistBadgeRoot } from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistBadgeRoot,
  },
};
</script>
    `),
    'demo-brutalist-badge-tones': formatCode(`
<template>
  <div class="flex flex-wrap items-center justify-center gap-3">
    <BrutalistBadgeRoot tone="accent">Draft</BrutalistBadgeRoot>
    <BrutalistBadgeRoot tone="info">Staging</BrutalistBadgeRoot>
    <BrutalistBadgeRoot tone="danger">Deprecated</BrutalistBadgeRoot>
  </div>
</template>

<script>
import { BrutalistBadgeRoot } from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistBadgeRoot,
  },
};
</script>
    `),
    'demo-brutalist-badge-with-icon': formatCode(`
<template>
  <div class="flex flex-wrap items-center justify-center gap-3">
    <BrutalistBadgeRoot tone="info">
      <span aria-hidden="true">✓</span>
      Verified
    </BrutalistBadgeRoot>
    <BrutalistBadgeRoot tone="accent">
      <span aria-hidden="true">★</span>
      Featured
    </BrutalistBadgeRoot>
    <BrutalistBadgeRoot tone="danger">
      Breaking
      <span aria-hidden="true">!</span>
    </BrutalistBadgeRoot>
  </div>
</template>

<script>
import { BrutalistBadgeRoot } from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistBadgeRoot,
  },
};
</script>
    `),
    'demo-brutalist-badge-roles': formatCode(`
<template>
  <div class="flex flex-col gap-2.5 text-sm">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <span class="font-medium">Workspace Role</span>
      <BrutalistBadgeRoot tone="accent">Maintainer</BrutalistBadgeRoot>
    </div>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <span class="font-medium">Deployment Target</span>
      <BrutalistBadgeRoot tone="info">Production</BrutalistBadgeRoot>
    </div>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <span class="font-medium">Legacy API v1</span>
      <BrutalistBadgeRoot tone="danger">Sunset</BrutalistBadgeRoot>
    </div>
  </div>
</template>

<script>
import { BrutalistBadgeRoot } from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistBadgeRoot,
  },
};
</script>
    `),
  },
};
