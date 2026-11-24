import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-brutalist-button': formatCode(`
<div class="flex flex-wrap items-center gap-4">
  <proto-ui-brutalist-button>Solid main</proto-ui-brutalist-button>
  <proto-ui-brutalist-button variant="solid" color="mint">Mint</proto-ui-brutalist-button>
  <proto-ui-brutalist-button variant="surface">Surface</proto-ui-brutalist-button>
  <proto-ui-brutalist-button variant="destructive">Destructive</proto-ui-brutalist-button>
  <proto-ui-brutalist-button disabled>Disabled</proto-ui-brutalist-button>
</div>
    `),
    'demo-brutalist-button-solid': formatCode(`
<div class="flex flex-wrap items-center gap-4">
  <proto-ui-brutalist-button>Solid main</proto-ui-brutalist-button>
  <proto-ui-brutalist-button variant="solid" color="mint">Mint</proto-ui-brutalist-button>
  <proto-ui-brutalist-button variant="solid" color="lavender">Lavender</proto-ui-brutalist-button>
  <proto-ui-brutalist-button variant="solid" color="coral">Coral</proto-ui-brutalist-button>
  <proto-ui-brutalist-button variant="solid" color="sky">Sky</proto-ui-brutalist-button>
</div>
    `),
    'demo-brutalist-button-surface': formatCode(`
<proto-ui-brutalist-button variant="surface">Surface</proto-ui-brutalist-button>
    `),
    'demo-brutalist-button-destructive': formatCode(`
<proto-ui-brutalist-button variant="destructive">Destructive</proto-ui-brutalist-button>
    `),
    'demo-brutalist-button-no-shadow': formatCode(`
<div class="flex flex-wrap items-center gap-4">
  <proto-ui-brutalist-button variant="noShadow">No Shadow</proto-ui-brutalist-button>
  <proto-ui-brutalist-button variant="noShadow" color="mint">Mint</proto-ui-brutalist-button>
  <proto-ui-brutalist-button variant="noShadow" color="coral">Coral</proto-ui-brutalist-button>
</div>
    `),
    'demo-brutalist-button-sizes': formatCode(`
<div class="flex flex-wrap items-center gap-4">
  <proto-ui-brutalist-button size="xs">Extra Small</proto-ui-brutalist-button>
  <proto-ui-brutalist-button size="icon-xs">
    <proto-ui-lucide-arrow-right-icon size="12"></proto-ui-lucide-arrow-right-icon>
    <span class="sr-only">Extra small icon</span>
  </proto-ui-brutalist-button>
  <proto-ui-brutalist-button size="sm">Small</proto-ui-brutalist-button>
  <proto-ui-brutalist-button size="icon-sm">
    <proto-ui-lucide-arrow-right-icon size="14"></proto-ui-lucide-arrow-right-icon>
    <span class="sr-only">Small icon</span>
  </proto-ui-brutalist-button>
  <proto-ui-brutalist-button>Default</proto-ui-brutalist-button>
  <proto-ui-brutalist-button size="icon">
    <proto-ui-lucide-arrow-right-icon size="16"></proto-ui-lucide-arrow-right-icon>
    <span class="sr-only">Default icon</span>
  </proto-ui-brutalist-button>
  <proto-ui-brutalist-button size="lg">Large</proto-ui-brutalist-button>
  <proto-ui-brutalist-button size="icon-lg">
    <proto-ui-lucide-arrow-right-icon size="18"></proto-ui-lucide-arrow-right-icon>
    <span class="sr-only">Large icon</span>
  </proto-ui-brutalist-button>
</div>
    `),
    'demo-brutalist-button-icon': formatCode(`
<proto-ui-brutalist-button size="icon">
  <proto-ui-lucide-arrow-right-icon size="16"></proto-ui-lucide-arrow-right-icon>
  <span class="sr-only">Continue</span>
</proto-ui-brutalist-button>
    `),
    'demo-brutalist-button-with-icon': formatCode(`
<div class="flex flex-wrap items-center gap-4">
  <proto-ui-brutalist-button>
    <proto-ui-lucide-pencil-icon size="16"></proto-ui-lucide-pencil-icon>
    Edit
  </proto-ui-brutalist-button>
  <proto-ui-brutalist-button variant="surface">
    Send
    <proto-ui-lucide-arrow-right-icon size="16"></proto-ui-lucide-arrow-right-icon>
  </proto-ui-brutalist-button>
</div>
    `),
    'demo-brutalist-button-wrap': formatCode(`
<div class="flex w-full max-w-52 flex-col items-start gap-4">
  <proto-ui-brutalist-button wrap>Publish changes and update workspace settings</proto-ui-brutalist-button>
  <proto-ui-brutalist-button variant="surface" size="sm" wrap>Review pending notifications</proto-ui-brutalist-button>
</div>
    `),
    'demo-brutalist-button-disabled': formatCode(`
<div class="flex flex-wrap items-center gap-4">
  <proto-ui-brutalist-button disabled>Disabled</proto-ui-brutalist-button>
  <proto-ui-brutalist-button variant="surface" disabled>Disabled surface</proto-ui-brutalist-button>
</div>
    `),
  },
  react: {
    'demo-brutalist-button': formatCode(`
import { BrutalistButton } from '../proto-ui/components/react';

export function BrutalistButtonDemo() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <BrutalistButton>Solid main</BrutalistButton>
      <BrutalistButton variant="solid" color="mint">Mint</BrutalistButton>
      <BrutalistButton variant="surface">Surface</BrutalistButton>
      <BrutalistButton variant="destructive">Destructive</BrutalistButton>
      <BrutalistButton disabled>Disabled</BrutalistButton>
    </div>
  );
}
    `),
    'demo-brutalist-button-solid': formatCode(`
import { BrutalistButton } from '../proto-ui/components/react';

export function BrutalistButtonSolidDemo() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <BrutalistButton>Solid main</BrutalistButton>
      <BrutalistButton variant="solid" color="mint">Mint</BrutalistButton>
      <BrutalistButton variant="solid" color="lavender">Lavender</BrutalistButton>
      <BrutalistButton variant="solid" color="coral">Coral</BrutalistButton>
      <BrutalistButton variant="solid" color="sky">Sky</BrutalistButton>
    </div>
  );
}
    `),
    'demo-brutalist-button-surface': formatCode(`
import { BrutalistButton } from '../proto-ui/components/react';

export function BrutalistButtonSurfaceDemo() {
  return <BrutalistButton variant="surface">Surface</BrutalistButton>;
}
    `),
    'demo-brutalist-button-destructive': formatCode(`
import { BrutalistButton } from '../proto-ui/components/react';

export function BrutalistButtonDestructiveDemo() {
  return <BrutalistButton variant="destructive">Destructive</BrutalistButton>;
}
    `),
    'demo-brutalist-button-no-shadow': formatCode(`
import { BrutalistButton } from '../proto-ui/components/react';

export function BrutalistButtonNoShadowDemo() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <BrutalistButton variant="noShadow">No Shadow</BrutalistButton>
      <BrutalistButton variant="noShadow" color="mint">Mint</BrutalistButton>
      <BrutalistButton variant="noShadow" color="coral">Coral</BrutalistButton>
    </div>
  );
}
    `),
    'demo-brutalist-button-sizes': formatCode(`
import { BrutalistButton, LucideArrowRightIcon } from '../proto-ui/components/react';

export function BrutalistButtonSizesDemo() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <BrutalistButton size="xs">Extra Small</BrutalistButton>
      <BrutalistButton size="icon-xs">
        <LucideArrowRightIcon size={12} />
        <span className="sr-only">Extra small icon</span>
      </BrutalistButton>
      <BrutalistButton size="sm">Small</BrutalistButton>
      <BrutalistButton size="icon-sm">
        <LucideArrowRightIcon size={14} />
        <span className="sr-only">Small icon</span>
      </BrutalistButton>
      <BrutalistButton>Default</BrutalistButton>
      <BrutalistButton size="icon">
        <LucideArrowRightIcon size={16} />
        <span className="sr-only">Default icon</span>
      </BrutalistButton>
      <BrutalistButton size="lg">Large</BrutalistButton>
      <BrutalistButton size="icon-lg">
        <LucideArrowRightIcon size={18} />
        <span className="sr-only">Large icon</span>
      </BrutalistButton>
    </div>
  );
}
    `),
    'demo-brutalist-button-icon': formatCode(`
import { BrutalistButton, LucideArrowRightIcon } from '../proto-ui/components/react';

export function BrutalistButtonIconDemo() {
  return (
    <BrutalistButton size="icon">
      <LucideArrowRightIcon size={16} />
      <span className="sr-only">Continue</span>
    </BrutalistButton>
  );
}
    `),
    'demo-brutalist-button-with-icon': formatCode(`
import {
  BrutalistButton,
  LucidePencilIcon,
  LucideArrowRightIcon,
} from '../proto-ui/components/react';

export function BrutalistButtonWithIconDemo() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <BrutalistButton>
        <LucidePencilIcon size={16} />
        Edit
      </BrutalistButton>
      <BrutalistButton variant="surface">
        Send
        <LucideArrowRightIcon size={16} />
      </BrutalistButton>
    </div>
  );
}
    `),
    'demo-brutalist-button-wrap': formatCode(`
import { BrutalistButton } from '../proto-ui/components/react';

export function BrutalistButtonWrapDemo() {
  return (
    <div className="flex w-full max-w-52 flex-col items-start gap-4">
      <BrutalistButton wrap>Publish changes and update workspace settings</BrutalistButton>
      <BrutalistButton variant="surface" size="sm" wrap>
        Review pending notifications
      </BrutalistButton>
    </div>
  );
}
    `),
    'demo-brutalist-button-disabled': formatCode(`
import { BrutalistButton } from '../proto-ui/components/react';

export function BrutalistButtonDisabledDemo() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <BrutalistButton disabled>Disabled</BrutalistButton>
      <BrutalistButton variant="surface" disabled>Disabled surface</BrutalistButton>
    </div>
  );
}
    `),
  },
  vue: {
    'demo-brutalist-button': formatCode(`
<script setup lang="ts">
import { BrutalistButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-4">
    <BrutalistButton>Solid main</BrutalistButton>
    <BrutalistButton variant="solid" color="mint">Mint</BrutalistButton>
    <BrutalistButton variant="surface">Surface</BrutalistButton>
    <BrutalistButton variant="destructive">Destructive</BrutalistButton>
    <BrutalistButton :disabled="true">Disabled</BrutalistButton>
  </div>
</template>
    `),
    'demo-brutalist-button-solid': formatCode(`
<script setup lang="ts">
import { BrutalistButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-4">
    <BrutalistButton>Solid main</BrutalistButton>
    <BrutalistButton variant="solid" color="mint">Mint</BrutalistButton>
    <BrutalistButton variant="solid" color="lavender">Lavender</BrutalistButton>
    <BrutalistButton variant="solid" color="coral">Coral</BrutalistButton>
    <BrutalistButton variant="solid" color="sky">Sky</BrutalistButton>
  </div>
</template>
    `),
    'demo-brutalist-button-surface': formatCode(`
<script setup lang="ts">
import { BrutalistButton } from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistButton variant="surface">Surface</BrutalistButton>
</template>
    `),
    'demo-brutalist-button-destructive': formatCode(`
<script setup lang="ts">
import { BrutalistButton } from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistButton variant="destructive">Destructive</BrutalistButton>
</template>
    `),
    'demo-brutalist-button-no-shadow': formatCode(`
<script setup lang="ts">
import { BrutalistButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-4">
    <BrutalistButton variant="noShadow">No Shadow</BrutalistButton>
    <BrutalistButton variant="noShadow" color="mint">Mint</BrutalistButton>
    <BrutalistButton variant="noShadow" color="coral">Coral</BrutalistButton>
  </div>
</template>
    `),
    'demo-brutalist-button-sizes': formatCode(`
<script setup lang="ts">
import { BrutalistButton, LucideArrowRightIcon } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-4">
    <BrutalistButton size="xs">Extra Small</BrutalistButton>
    <BrutalistButton size="icon-xs">
      <LucideArrowRightIcon :size="12" />
      <span class="sr-only">Extra small icon</span>
    </BrutalistButton>
    <BrutalistButton size="sm">Small</BrutalistButton>
    <BrutalistButton size="icon-sm">
      <LucideArrowRightIcon :size="14" />
      <span class="sr-only">Small icon</span>
    </BrutalistButton>
    <BrutalistButton>Default</BrutalistButton>
    <BrutalistButton size="icon">
      <LucideArrowRightIcon :size="16" />
      <span class="sr-only">Default icon</span>
    </BrutalistButton>
    <BrutalistButton size="lg">Large</BrutalistButton>
    <BrutalistButton size="icon-lg">
      <LucideArrowRightIcon :size="18" />
      <span class="sr-only">Large icon</span>
    </BrutalistButton>
  </div>
</template>
    `),
    'demo-brutalist-button-icon': formatCode(`
<script setup lang="ts">
import { BrutalistButton, LucideArrowRightIcon } from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistButton size="icon">
    <LucideArrowRightIcon :size="16" />
    <span class="sr-only">Continue</span>
  </BrutalistButton>
</template>
    `),
    'demo-brutalist-button-with-icon': formatCode(`
<script setup lang="ts">
import {
  BrutalistButton,
  LucidePencilIcon,
  LucideArrowRightIcon,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-4">
    <BrutalistButton>
      <LucidePencilIcon :size="16" />
      Edit
    </BrutalistButton>
    <BrutalistButton variant="surface">
      Send
      <LucideArrowRightIcon :size="16" />
    </BrutalistButton>
  </div>
</template>
    `),
    'demo-brutalist-button-wrap': formatCode(`
<script setup lang="ts">
import { BrutalistButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex w-full max-w-52 flex-col items-start gap-4">
    <BrutalistButton :wrap="true">Publish changes and update workspace settings</BrutalistButton>
    <BrutalistButton variant="surface" size="sm" :wrap="true">
      Review pending notifications
    </BrutalistButton>
  </div>
</template>
    `),
    'demo-brutalist-button-disabled': formatCode(`
<script setup lang="ts">
import { BrutalistButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-4">
    <BrutalistButton :disabled="true">Disabled</BrutalistButton>
    <BrutalistButton variant="surface" :disabled="true">Disabled surface</BrutalistButton>
  </div>
</template>
    `),
  },
  vue2: {
    'demo-brutalist-button': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-4">
    <BrutalistButton>Solid main</BrutalistButton>
    <BrutalistButton variant="solid" color="mint">Mint</BrutalistButton>
    <BrutalistButton variant="surface">Surface</BrutalistButton>
    <BrutalistButton variant="destructive">Destructive</BrutalistButton>
    <BrutalistButton :disabled="true">Disabled</BrutalistButton>
  </div>
</template>

<script>
import { BrutalistButton } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistButton },
};
</script>
    `),
    'demo-brutalist-button-solid': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-4">
    <BrutalistButton>Solid main</BrutalistButton>
    <BrutalistButton variant="solid" color="mint">Mint</BrutalistButton>
    <BrutalistButton variant="solid" color="lavender">Lavender</BrutalistButton>
    <BrutalistButton variant="solid" color="coral">Coral</BrutalistButton>
    <BrutalistButton variant="solid" color="sky">Sky</BrutalistButton>
  </div>
</template>

<script>
import { BrutalistButton } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistButton },
};
</script>
    `),
    'demo-brutalist-button-surface': formatCode(`
<template>
  <BrutalistButton variant="surface">Surface</BrutalistButton>
</template>

<script>
import { BrutalistButton } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistButton },
};
</script>
    `),
    'demo-brutalist-button-destructive': formatCode(`
<template>
  <BrutalistButton variant="destructive">Destructive</BrutalistButton>
</template>

<script>
import { BrutalistButton } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistButton },
};
</script>
    `),
    'demo-brutalist-button-no-shadow': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-4">
    <BrutalistButton variant="noShadow">No Shadow</BrutalistButton>
    <BrutalistButton variant="noShadow" color="mint">Mint</BrutalistButton>
    <BrutalistButton variant="noShadow" color="coral">Coral</BrutalistButton>
  </div>
</template>

<script>
import { BrutalistButton } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistButton },
};
</script>
    `),
    'demo-brutalist-button-sizes': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-4">
    <BrutalistButton size="xs">Extra Small</BrutalistButton>
    <BrutalistButton size="icon-xs">
      <LucideArrowRightIcon :size="12" />
      <span class="sr-only">Extra small icon</span>
    </BrutalistButton>
    <BrutalistButton size="sm">Small</BrutalistButton>
    <BrutalistButton size="icon-sm">
      <LucideArrowRightIcon :size="14" />
      <span class="sr-only">Small icon</span>
    </BrutalistButton>
    <BrutalistButton>Default</BrutalistButton>
    <BrutalistButton size="icon">
      <LucideArrowRightIcon :size="16" />
      <span class="sr-only">Default icon</span>
    </BrutalistButton>
    <BrutalistButton size="lg">Large</BrutalistButton>
    <BrutalistButton size="icon-lg">
      <LucideArrowRightIcon :size="18" />
      <span class="sr-only">Large icon</span>
    </BrutalistButton>
  </div>
</template>

<script>
import { BrutalistButton, LucideArrowRightIcon } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistButton, LucideArrowRightIcon },
};
</script>
    `),
    'demo-brutalist-button-icon': formatCode(`
<template>
  <BrutalistButton size="icon">
    <LucideArrowRightIcon :size="16" />
    <span class="sr-only">Continue</span>
  </BrutalistButton>
</template>

<script>
import { BrutalistButton, LucideArrowRightIcon } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistButton, LucideArrowRightIcon },
};
</script>
    `),
    'demo-brutalist-button-with-icon': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-4">
    <BrutalistButton>
      <LucidePencilIcon :size="16" />
      Edit
    </BrutalistButton>
    <BrutalistButton variant="surface">
      Send
      <LucideArrowRightIcon :size="16" />
    </BrutalistButton>
  </div>
</template>

<script>
import {
  BrutalistButton,
  LucidePencilIcon,
  LucideArrowRightIcon,
} from '../proto-ui/components/vue2';

export default {
  components: { BrutalistButton, LucidePencilIcon, LucideArrowRightIcon },
};
</script>
    `),
    'demo-brutalist-button-wrap': formatCode(`
<template>
  <div class="flex w-full max-w-52 flex-col items-start gap-4">
    <BrutalistButton :wrap="true">Publish changes and update workspace settings</BrutalistButton>
    <BrutalistButton variant="surface" size="sm" :wrap="true">
      Review pending notifications
    </BrutalistButton>
  </div>
</template>

<script>
import { BrutalistButton } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistButton },
};
</script>
    `),
    'demo-brutalist-button-disabled': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-4">
    <BrutalistButton :disabled="true">Disabled</BrutalistButton>
    <BrutalistButton variant="surface" :disabled="true">Disabled surface</BrutalistButton>
  </div>
</template>

<script>
import { BrutalistButton } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistButton },
};
</script>
    `),
  },
};
