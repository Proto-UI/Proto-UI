import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-brutalist-skeleton': formatCode(`
<div class="flex flex-col gap-3">
  <proto-ui-brutalist-skeleton-root class="w-32 h-4"></proto-ui-brutalist-skeleton-root>
  <proto-ui-brutalist-skeleton-root class="w-64 h-12"></proto-ui-brutalist-skeleton-root>
  <proto-ui-brutalist-skeleton-root class="w-56 h-4"></proto-ui-brutalist-skeleton-root>
</div>
    `),
    'demo-brutalist-skeleton-avatar': formatCode(`
<div class="flex items-center gap-4">
  <proto-ui-brutalist-skeleton-root class="h-12 w-12 shrink-0 rounded-full"></proto-ui-brutalist-skeleton-root>
  <div class="flex flex-col gap-2">
    <proto-ui-brutalist-skeleton-root class="h-4 w-48"></proto-ui-brutalist-skeleton-root>
    <proto-ui-brutalist-skeleton-root class="h-4 w-36"></proto-ui-brutalist-skeleton-root>
  </div>
</div>
    `),
    'demo-brutalist-skeleton-card': formatCode(`
<proto-ui-brutalist-card-root class="w-full max-w-xs">
  <proto-ui-brutalist-card-header class="flex flex-col gap-2">
    <proto-ui-brutalist-skeleton-root class="h-4 w-2/3"></proto-ui-brutalist-skeleton-root>
    <proto-ui-brutalist-skeleton-root class="h-4 w-1/2"></proto-ui-brutalist-skeleton-root>
  </proto-ui-brutalist-card-header>
  <proto-ui-brutalist-card-content>
    <proto-ui-brutalist-skeleton-root class="h-32 w-full"></proto-ui-brutalist-skeleton-root>
  </proto-ui-brutalist-card-content>
</proto-ui-brutalist-card-root>
    `),
    'demo-brutalist-skeleton-text': formatCode(`
<div class="flex w-full max-w-xs flex-col gap-2">
  <proto-ui-brutalist-skeleton-root class="h-4 w-full"></proto-ui-brutalist-skeleton-root>
  <proto-ui-brutalist-skeleton-root class="h-4 w-full"></proto-ui-brutalist-skeleton-root>
  <proto-ui-brutalist-skeleton-root class="h-4 w-3/4"></proto-ui-brutalist-skeleton-root>
</div>
    `),
    'demo-brutalist-skeleton-form': formatCode(`
<div class="flex w-full max-w-xs flex-col gap-5">
  <div class="flex flex-col gap-2">
    <proto-ui-brutalist-skeleton-root class="h-4 w-20"></proto-ui-brutalist-skeleton-root>
    <proto-ui-brutalist-skeleton-root class="h-9 w-full"></proto-ui-brutalist-skeleton-root>
  </div>
  <div class="flex flex-col gap-2">
    <proto-ui-brutalist-skeleton-root class="h-4 w-24"></proto-ui-brutalist-skeleton-root>
    <proto-ui-brutalist-skeleton-root class="h-9 w-full"></proto-ui-brutalist-skeleton-root>
  </div>
  <proto-ui-brutalist-skeleton-root class="h-9 w-24"></proto-ui-brutalist-skeleton-root>
</div>
    `),
    'demo-brutalist-skeleton-table': formatCode(`
<div class="flex w-full max-w-sm flex-col gap-2.5">
  <div class="flex items-center gap-3">
    <proto-ui-brutalist-skeleton-root class="h-4 flex-1"></proto-ui-brutalist-skeleton-root>
    <proto-ui-brutalist-skeleton-root class="h-4 w-24"></proto-ui-brutalist-skeleton-root>
    <proto-ui-brutalist-skeleton-root class="h-4 w-16"></proto-ui-brutalist-skeleton-root>
  </div>
  <div class="flex items-center gap-3">
    <proto-ui-brutalist-skeleton-root class="h-4 flex-1"></proto-ui-brutalist-skeleton-root>
    <proto-ui-brutalist-skeleton-root class="h-4 w-24"></proto-ui-brutalist-skeleton-root>
    <proto-ui-brutalist-skeleton-root class="h-4 w-16"></proto-ui-brutalist-skeleton-root>
  </div>
  <div class="flex items-center gap-3">
    <proto-ui-brutalist-skeleton-root class="h-4 flex-1"></proto-ui-brutalist-skeleton-root>
    <proto-ui-brutalist-skeleton-root class="h-4 w-24"></proto-ui-brutalist-skeleton-root>
    <proto-ui-brutalist-skeleton-root class="h-4 w-16"></proto-ui-brutalist-skeleton-root>
  </div>
  <div class="flex items-center gap-3">
    <proto-ui-brutalist-skeleton-root class="h-4 flex-1"></proto-ui-brutalist-skeleton-root>
    <proto-ui-brutalist-skeleton-root class="h-4 w-24"></proto-ui-brutalist-skeleton-root>
    <proto-ui-brutalist-skeleton-root class="h-4 w-16"></proto-ui-brutalist-skeleton-root>
  </div>
</div>
    `),
  },
  react: {
    'demo-brutalist-skeleton': formatCode(`
import { BrutalistSkeletonRoot } from '../proto-ui/components/react';

export function SkeletonDemo() {
  return (
    <div className="flex flex-col gap-3">
      <BrutalistSkeletonRoot className="w-32 h-4" />
      <BrutalistSkeletonRoot className="w-64 h-12" />
      <BrutalistSkeletonRoot className="w-56 h-4" />
    </div>
  );
}
    `),
    'demo-brutalist-skeleton-avatar': formatCode(`
import { BrutalistSkeletonRoot } from '../proto-ui/components/react';

export function SkeletonAvatar() {
  return (
    <div className="flex items-center gap-4">
      <BrutalistSkeletonRoot className="h-12 w-12 shrink-0 rounded-full" />
      <div className="flex flex-col gap-2">
        <BrutalistSkeletonRoot className="h-4 w-48" />
        <BrutalistSkeletonRoot className="h-4 w-36" />
      </div>
    </div>
  );
}
    `),
    'demo-brutalist-skeleton-card': formatCode(`
import {
  BrutalistCardContent,
  BrutalistCardHeader,
  BrutalistCardRoot,
  BrutalistSkeletonRoot,
} from '../proto-ui/components/react';

export function SkeletonCard() {
  return (
    <BrutalistCardRoot className="w-full max-w-xs">
      <BrutalistCardHeader className="flex flex-col gap-2">
        <BrutalistSkeletonRoot className="h-4 w-2/3" />
        <BrutalistSkeletonRoot className="h-4 w-1/2" />
      </BrutalistCardHeader>
      <BrutalistCardContent>
        <BrutalistSkeletonRoot className="h-32 w-full" />
      </BrutalistCardContent>
    </BrutalistCardRoot>
  );
}
    `),
    'demo-brutalist-skeleton-text': formatCode(`
import { BrutalistSkeletonRoot } from '../proto-ui/components/react';

export function SkeletonText() {
  return (
    <div className="flex w-full max-w-xs flex-col gap-2">
      <BrutalistSkeletonRoot className="h-4 w-full" />
      <BrutalistSkeletonRoot className="h-4 w-full" />
      <BrutalistSkeletonRoot className="h-4 w-3/4" />
    </div>
  );
}
    `),
    'demo-brutalist-skeleton-form': formatCode(`
import { BrutalistSkeletonRoot } from '../proto-ui/components/react';

export function SkeletonForm() {
  return (
    <div className="flex w-full max-w-xs flex-col gap-5">
      <div className="flex flex-col gap-2">
        <BrutalistSkeletonRoot className="h-4 w-20" />
        <BrutalistSkeletonRoot className="h-9 w-full" />
      </div>
      <div className="flex flex-col gap-2">
        <BrutalistSkeletonRoot className="h-4 w-24" />
        <BrutalistSkeletonRoot className="h-9 w-full" />
      </div>
      <BrutalistSkeletonRoot className="h-9 w-24" />
    </div>
  );
}
    `),
    'demo-brutalist-skeleton-table': formatCode(`
import { BrutalistSkeletonRoot } from '../proto-ui/components/react';

export function SkeletonTable() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-2.5">
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="flex items-center gap-3" key={index}>
          <BrutalistSkeletonRoot className="h-4 flex-1" />
          <BrutalistSkeletonRoot className="h-4 w-24" />
          <BrutalistSkeletonRoot className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
    `),
  },
  vue: {
    'demo-brutalist-skeleton': formatCode(`
<template>
  <div class="flex flex-col gap-3">
    <BrutalistSkeletonRoot class="w-32 h-4" />
    <BrutalistSkeletonRoot class="w-64 h-12" />
    <BrutalistSkeletonRoot class="w-56 h-4" />
  </div>
</template>

<script setup>
import { BrutalistSkeletonRoot } from '../proto-ui/components/vue';
</script>
    `),
    'demo-brutalist-skeleton-avatar': formatCode(`
<template>
  <div class="flex items-center gap-4">
    <BrutalistSkeletonRoot class="h-12 w-12 shrink-0 rounded-full" />
    <div class="flex flex-col gap-2">
      <BrutalistSkeletonRoot class="h-4 w-48" />
      <BrutalistSkeletonRoot class="h-4 w-36" />
    </div>
  </div>
</template>

<script setup>
import { BrutalistSkeletonRoot } from '../proto-ui/components/vue';
</script>
    `),
    'demo-brutalist-skeleton-card': formatCode(`
<template>
  <BrutalistCardRoot class="w-full max-w-xs">
    <BrutalistCardHeader class="flex flex-col gap-2">
      <BrutalistSkeletonRoot class="h-4 w-2/3" />
      <BrutalistSkeletonRoot class="h-4 w-1/2" />
    </BrutalistCardHeader>
    <BrutalistCardContent>
      <BrutalistSkeletonRoot class="h-32 w-full" />
    </BrutalistCardContent>
  </BrutalistCardRoot>
</template>

<script setup>
import {
  BrutalistCardContent,
  BrutalistCardHeader,
  BrutalistCardRoot,
  BrutalistSkeletonRoot,
} from '../proto-ui/components/vue';
</script>
    `),
    'demo-brutalist-skeleton-text': formatCode(`
<template>
  <div class="flex w-full max-w-xs flex-col gap-2">
    <BrutalistSkeletonRoot class="h-4 w-full" />
    <BrutalistSkeletonRoot class="h-4 w-full" />
    <BrutalistSkeletonRoot class="h-4 w-3/4" />
  </div>
</template>

<script setup>
import { BrutalistSkeletonRoot } from '../proto-ui/components/vue';
</script>
    `),
    'demo-brutalist-skeleton-form': formatCode(`
<template>
  <div class="flex w-full max-w-xs flex-col gap-5">
    <div class="flex flex-col gap-2">
      <BrutalistSkeletonRoot class="h-4 w-20" />
      <BrutalistSkeletonRoot class="h-9 w-full" />
    </div>
    <div class="flex flex-col gap-2">
      <BrutalistSkeletonRoot class="h-4 w-24" />
      <BrutalistSkeletonRoot class="h-9 w-full" />
    </div>
    <BrutalistSkeletonRoot class="h-9 w-24" />
  </div>
</template>

<script setup>
import { BrutalistSkeletonRoot } from '../proto-ui/components/vue';
</script>
    `),
    'demo-brutalist-skeleton-table': formatCode(`
<template>
  <div class="flex w-full max-w-sm flex-col gap-2.5">
    <div v-for="index in 4" :key="index" class="flex items-center gap-3">
      <BrutalistSkeletonRoot class="h-4 flex-1" />
      <BrutalistSkeletonRoot class="h-4 w-24" />
      <BrutalistSkeletonRoot class="h-4 w-16" />
    </div>
  </div>
</template>

<script setup>
import { BrutalistSkeletonRoot } from '../proto-ui/components/vue';
</script>
    `),
  },
  vue2: {
    'demo-brutalist-skeleton': formatCode(`
<template>
  <div class="flex flex-col gap-3">
    <BrutalistSkeletonRoot class="w-32 h-4" />
    <BrutalistSkeletonRoot class="w-64 h-12" />
    <BrutalistSkeletonRoot class="w-56 h-4" />
  </div>
</template>

<script>
import { BrutalistSkeletonRoot } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistSkeletonRoot },
};
</script>
    `),
    'demo-brutalist-skeleton-avatar': formatCode(`
<template>
  <div class="flex items-center gap-4">
    <BrutalistSkeletonRoot class="h-12 w-12 shrink-0 rounded-full" />
    <div class="flex flex-col gap-2">
      <BrutalistSkeletonRoot class="h-4 w-48" />
      <BrutalistSkeletonRoot class="h-4 w-36" />
    </div>
  </div>
</template>

<script>
import { BrutalistSkeletonRoot } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistSkeletonRoot },
};
</script>
    `),
    'demo-brutalist-skeleton-card': formatCode(`
<template>
  <BrutalistCardRoot class="w-full max-w-xs">
    <BrutalistCardHeader class="flex flex-col gap-2">
      <BrutalistSkeletonRoot class="h-4 w-2/3" />
      <BrutalistSkeletonRoot class="h-4 w-1/2" />
    </BrutalistCardHeader>
    <BrutalistCardContent>
      <BrutalistSkeletonRoot class="h-32 w-full" />
    </BrutalistCardContent>
  </BrutalistCardRoot>
</template>

<script>
import {
  BrutalistCardContent,
  BrutalistCardHeader,
  BrutalistCardRoot,
  BrutalistSkeletonRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistCardContent,
    BrutalistCardHeader,
    BrutalistCardRoot,
    BrutalistSkeletonRoot,
  },
};
</script>
    `),
    'demo-brutalist-skeleton-text': formatCode(`
<template>
  <div class="flex w-full max-w-xs flex-col gap-2">
    <BrutalistSkeletonRoot class="h-4 w-full" />
    <BrutalistSkeletonRoot class="h-4 w-full" />
    <BrutalistSkeletonRoot class="h-4 w-3/4" />
  </div>
</template>

<script>
import { BrutalistSkeletonRoot } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistSkeletonRoot },
};
</script>
    `),
    'demo-brutalist-skeleton-form': formatCode(`
<template>
  <div class="flex w-full max-w-xs flex-col gap-5">
    <div class="flex flex-col gap-2">
      <BrutalistSkeletonRoot class="h-4 w-20" />
      <BrutalistSkeletonRoot class="h-9 w-full" />
    </div>
    <div class="flex flex-col gap-2">
      <BrutalistSkeletonRoot class="h-4 w-24" />
      <BrutalistSkeletonRoot class="h-9 w-full" />
    </div>
    <BrutalistSkeletonRoot class="h-9 w-24" />
  </div>
</template>

<script>
import { BrutalistSkeletonRoot } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistSkeletonRoot },
};
</script>
    `),
    'demo-brutalist-skeleton-table': formatCode(`
<template>
  <div class="flex w-full max-w-sm flex-col gap-2.5">
    <div v-for="index in 4" :key="index" class="flex items-center gap-3">
      <BrutalistSkeletonRoot class="h-4 flex-1" />
      <BrutalistSkeletonRoot class="h-4 w-24" />
      <BrutalistSkeletonRoot class="h-4 w-16" />
    </div>
  </div>
</template>

<script>
import { BrutalistSkeletonRoot } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistSkeletonRoot },
};
</script>
    `),
  },
};
