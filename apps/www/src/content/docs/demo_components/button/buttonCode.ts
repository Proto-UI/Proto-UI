import { formatCode } from '@/utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/registry';

export const codeMap: Partial<Record<RuntimeId, Record<string, string>>> = {
  wc: {
    'demo-button-default': formatCode(`
<div class="flex flex-wrap items-center gap-3">
  <wc-shadcn-button>Default</wc-shadcn-button>
</div>
    `),
    'demo-button-destructive': formatCode(`
<div class="flex flex-wrap items-center gap-3">
  <wc-shadcn-button variant="destructive">Destructive</wc-shadcn-button>
</div>
    `),
    'demo-button-disabled': formatCode(`
<div class="flex flex-wrap items-center gap-3">
  <wc-shadcn-button disabled>Disabled</wc-shadcn-button>
</div>
    `),
    'demo-button-ghost': formatCode(`
<div class="flex flex-wrap items-center gap-3">
  <wc-shadcn-button variant="ghost">Ghost</wc-shadcn-button>
</div>
    `),
    'demo-button-outline': formatCode(`
<div class="flex flex-wrap items-center gap-3">
  <wc-shadcn-button variant="outline">Outline</wc-shadcn-button>
</div>
    `),
    'demo-button-secondary': formatCode(`
<div class="flex flex-wrap items-center gap-3">
  <wc-shadcn-button variant="secondary">Secondary</wc-shadcn-button>
</div>
    `),
    'demo-button-sizes': formatCode(`
<div class="flex flex-wrap items-center justify-center gap-3">
  <wc-shadcn-button size="sm">Small</wc-shadcn-button>
  <wc-shadcn-button>Default</wc-shadcn-button>
  <wc-shadcn-button size="lg">Large</wc-shadcn-button>
  <wc-shadcn-button size="icon" variant="outline">+</wc-shadcn-button>
</div>
    `),
    'demo-button-states': formatCode(`
<div class="flex flex-wrap items-center justify-center gap-3">
  <wc-shadcn-button>Default</wc-shadcn-button>
  <wc-shadcn-button disabled>Disabled</wc-shadcn-button>
  <wc-shadcn-button variant="outline" disabled>Disabled outline</wc-shadcn-button>
  <wc-shadcn-button variant="ghost" size="icon">+</wc-shadcn-button>
</div>
    `),
    'demo-button-variants': formatCode(`
<div class="flex flex-wrap items-center justify-center gap-3">
  <wc-shadcn-button>Default</wc-shadcn-button>
  <wc-shadcn-button variant="secondary">Secondary</wc-shadcn-button>
  <wc-shadcn-button variant="outline">Outline</wc-shadcn-button>
  <wc-shadcn-button variant="ghost">Ghost</wc-shadcn-button>
  <wc-shadcn-button variant="destructive">Destructive</wc-shadcn-button>
  <wc-shadcn-button variant="link">Link</wc-shadcn-button>
</div>
    `),
    'demo-button': formatCode(`
<div class="flex flex-wrap items-center justify-center gap-3">
  <wc-shadcn-button>Default</wc-shadcn-button>
  <div>
    <wc-shadcn-button>Default2</wc-shadcn-button>
  </div>
  <wc-shadcn-button variant="outline">Outline</wc-shadcn-button>
  <wc-shadcn-button variant="destructive">Destructive</wc-shadcn-button>
  <wc-shadcn-button variant="ghost" size="icon">+</wc-shadcn-button>
  <wc-shadcn-button disabled>Disabled</wc-shadcn-button>
</div>
    `),
    'demo-Secondray': formatCode(`
<div class="flex flex-wrap items-center justify-center gap-3">
  <wc-shadcn-button>Default</wc-shadcn-button>
  <wc-shadcn-button variant="secondary">Secondary2</wc-shadcn-button>
  <wc-shadcn-button variant="outline">Outline</wc-shadcn-button>
</div>
    `),
  },
  react: {
    'demo-button-default': formatCode(`
import { ShadcnButton } from '../proto-ui/components/react';

export function DemoButtonDefaultDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ShadcnButton>Default</ShadcnButton>
    </div>
  );
}
    `),
    'demo-button-destructive': formatCode(`
import { ShadcnButton } from '../proto-ui/components/react';

export function DemoButtonDestructiveDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ShadcnButton variant="destructive">Destructive</ShadcnButton>
    </div>
  );
}
    `),
    'demo-button-disabled': formatCode(`
import { ShadcnButton } from '../proto-ui/components/react';

export function DemoButtonDisabledDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ShadcnButton disabled>Disabled</ShadcnButton>
    </div>
  );
}
    `),
    'demo-button-ghost': formatCode(`
import { ShadcnButton } from '../proto-ui/components/react';

export function DemoButtonGhostDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ShadcnButton variant="ghost">Ghost</ShadcnButton>
    </div>
  );
}
    `),
    'demo-button-outline': formatCode(`
import { ShadcnButton } from '../proto-ui/components/react';

export function DemoButtonOutlineDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ShadcnButton variant="outline">Outline</ShadcnButton>
    </div>
  );
}
    `),
    'demo-button-secondary': formatCode(`
import { ShadcnButton } from '../proto-ui/components/react';

export function DemoButtonSecondaryDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ShadcnButton variant="secondary">Secondary</ShadcnButton>
    </div>
  );
}
    `),
    'demo-button-sizes': formatCode(`
import { ShadcnButton } from '../proto-ui/components/react';

export function DemoButtonSizesDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <ShadcnButton size="sm">Small</ShadcnButton>
      <ShadcnButton>Default</ShadcnButton>
      <ShadcnButton size="lg">Large</ShadcnButton>
      <ShadcnButton size="icon" variant="outline">
        +
      </ShadcnButton>
    </div>
  );
}
    `),
    'demo-button-states': formatCode(`
import { ShadcnButton } from '../proto-ui/components/react';

export function DemoButtonStatesDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <ShadcnButton>Default</ShadcnButton>
      <ShadcnButton disabled>Disabled</ShadcnButton>
      <ShadcnButton variant="outline" disabled>
        Disabled outline
      </ShadcnButton>
      <ShadcnButton variant="ghost" size="icon">
        +
      </ShadcnButton>
    </div>
  );
}
    `),
    'demo-button-variants': formatCode(`
import { ShadcnButton } from '../proto-ui/components/react';

export function DemoButtonVariantsDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <ShadcnButton>Default</ShadcnButton>
      <ShadcnButton variant="secondary">Secondary</ShadcnButton>
      <ShadcnButton variant="outline">Outline</ShadcnButton>
      <ShadcnButton variant="ghost">Ghost</ShadcnButton>
      <ShadcnButton variant="destructive">Destructive</ShadcnButton>
      <ShadcnButton variant="link">Link</ShadcnButton>
    </div>
  );
}
    `),
    'demo-button': formatCode(`
import { ShadcnButton } from '../proto-ui/components/react';

export function DemoButtonDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <ShadcnButton>Default</ShadcnButton>
      <div>
        <ShadcnButton>Default2</ShadcnButton>
      </div>
      <ShadcnButton variant="outline">Outline</ShadcnButton>
      <ShadcnButton variant="destructive">Destructive</ShadcnButton>
      <ShadcnButton variant="ghost" size="icon">
        +
      </ShadcnButton>
      <ShadcnButton disabled>Disabled</ShadcnButton>
    </div>
  );
}
    `),
    'demo-Secondray': formatCode(`
import { ShadcnButton } from '../proto-ui/components/react';

export function DemoSecondrayDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <ShadcnButton>Default</ShadcnButton>
      <ShadcnButton variant="secondary">Secondary2</ShadcnButton>
      <ShadcnButton variant="outline">Outline</ShadcnButton>
    </div>
  );
}
    `),
  },
  vue: {
    'demo-button-default': formatCode(`
<script setup lang="ts">
import { ShadcnButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <ShadcnButton>Default</ShadcnButton>
  </div>
</template>
    `),
    'demo-button-destructive': formatCode(`
<script setup lang="ts">
import { ShadcnButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <ShadcnButton variant="destructive">Destructive</ShadcnButton>
  </div>
</template>
    `),
    'demo-button-disabled': formatCode(`
<script setup lang="ts">
import { ShadcnButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <ShadcnButton disabled>Disabled</ShadcnButton>
  </div>
</template>
    `),
    'demo-button-ghost': formatCode(`
<script setup lang="ts">
import { ShadcnButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <ShadcnButton variant="ghost">Ghost</ShadcnButton>
  </div>
</template>
    `),
    'demo-button-outline': formatCode(`
<script setup lang="ts">
import { ShadcnButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <ShadcnButton variant="outline">Outline</ShadcnButton>
  </div>
</template>
    `),
    'demo-button-secondary': formatCode(`
<script setup lang="ts">
import { ShadcnButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <ShadcnButton variant="secondary">Secondary</ShadcnButton>
  </div>
</template>
    `),
    'demo-button-sizes': formatCode(`
<script setup lang="ts">
import { ShadcnButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-3">
    <ShadcnButton size="sm">Small</ShadcnButton>
    <ShadcnButton>Default</ShadcnButton>
    <ShadcnButton size="lg">Large</ShadcnButton>
    <ShadcnButton size="icon" variant="outline">+</ShadcnButton>
  </div>
</template>
    `),
    'demo-button-states': formatCode(`
<script setup lang="ts">
import { ShadcnButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-3">
    <ShadcnButton>Default</ShadcnButton>
    <ShadcnButton disabled>Disabled</ShadcnButton>
    <ShadcnButton variant="outline" disabled>Disabled outline</ShadcnButton>
    <ShadcnButton variant="ghost" size="icon">+</ShadcnButton>
  </div>
</template>
    `),
    'demo-button-variants': formatCode(`
<script setup lang="ts">
import { ShadcnButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-3">
    <ShadcnButton>Default</ShadcnButton>
    <ShadcnButton variant="secondary">Secondary</ShadcnButton>
    <ShadcnButton variant="outline">Outline</ShadcnButton>
    <ShadcnButton variant="ghost">Ghost</ShadcnButton>
    <ShadcnButton variant="destructive">Destructive</ShadcnButton>
    <ShadcnButton variant="link">Link</ShadcnButton>
  </div>
</template>
    `),
    'demo-button': formatCode(`
<script setup lang="ts">
import { ShadcnButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-3">
    <ShadcnButton>Default</ShadcnButton>
    <div>
      <ShadcnButton>Default2</ShadcnButton>
    </div>
    <ShadcnButton variant="outline">Outline</ShadcnButton>
    <ShadcnButton variant="destructive">Destructive</ShadcnButton>
    <ShadcnButton variant="ghost" size="icon">+</ShadcnButton>
    <ShadcnButton disabled>Disabled</ShadcnButton>
  </div>
</template>
    `),
    'demo-Secondray': formatCode(`
<script setup lang="ts">
import { ShadcnButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-3">
    <ShadcnButton>Default</ShadcnButton>
    <ShadcnButton variant="secondary">Secondary2</ShadcnButton>
    <ShadcnButton variant="outline">Outline</ShadcnButton>
  </div>
</template>
    `),
  },
  vue2: {
    'demo-button-default': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-3">
    <ShadcnButton>Default</ShadcnButton>
  </div>
</template>

<script>
import { ShadcnButton } from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnButton,
  },
};
</script>
    `),
    'demo-button-destructive': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-3">
    <ShadcnButton variant="destructive">Destructive</ShadcnButton>
  </div>
</template>

<script>
import { ShadcnButton } from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnButton,
  },
};
</script>
    `),
    'demo-button-disabled': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-3">
    <ShadcnButton disabled>Disabled</ShadcnButton>
  </div>
</template>

<script>
import { ShadcnButton } from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnButton,
  },
};
</script>
    `),
    'demo-button-ghost': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-3">
    <ShadcnButton variant="ghost">Ghost</ShadcnButton>
  </div>
</template>

<script>
import { ShadcnButton } from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnButton,
  },
};
</script>
    `),
    'demo-button-outline': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-3">
    <ShadcnButton variant="outline">Outline</ShadcnButton>
  </div>
</template>

<script>
import { ShadcnButton } from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnButton,
  },
};
</script>
    `),
    'demo-button-secondary': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-3">
    <ShadcnButton variant="secondary">Secondary</ShadcnButton>
  </div>
</template>

<script>
import { ShadcnButton } from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnButton,
  },
};
</script>
    `),
    'demo-button-sizes': formatCode(`
<template>
  <div class="flex flex-wrap items-center justify-center gap-3">
    <ShadcnButton size="sm">Small</ShadcnButton>
    <ShadcnButton>Default</ShadcnButton>
    <ShadcnButton size="lg">Large</ShadcnButton>
    <ShadcnButton size="icon" variant="outline">+</ShadcnButton>
  </div>
</template>

<script>
import { ShadcnButton } from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnButton,
  },
};
</script>
    `),
    'demo-button-states': formatCode(`
<template>
  <div class="flex flex-wrap items-center justify-center gap-3">
    <ShadcnButton>Default</ShadcnButton>
    <ShadcnButton disabled>Disabled</ShadcnButton>
    <ShadcnButton variant="outline" disabled>Disabled outline</ShadcnButton>
    <ShadcnButton variant="ghost" size="icon">+</ShadcnButton>
  </div>
</template>

<script>
import { ShadcnButton } from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnButton,
  },
};
</script>
    `),
    'demo-button-variants': formatCode(`
<template>
  <div class="flex flex-wrap items-center justify-center gap-3">
    <ShadcnButton>Default</ShadcnButton>
    <ShadcnButton variant="secondary">Secondary</ShadcnButton>
    <ShadcnButton variant="outline">Outline</ShadcnButton>
    <ShadcnButton variant="ghost">Ghost</ShadcnButton>
    <ShadcnButton variant="destructive">Destructive</ShadcnButton>
    <ShadcnButton variant="link">Link</ShadcnButton>
  </div>
</template>

<script>
import { ShadcnButton } from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnButton,
  },
};
</script>
    `),
    'demo-button': formatCode(`
<template>
  <div class="flex flex-wrap items-center justify-center gap-3">
    <ShadcnButton>Default</ShadcnButton>
    <div>
      <ShadcnButton>Default2</ShadcnButton>
    </div>
    <ShadcnButton variant="outline">Outline</ShadcnButton>
    <ShadcnButton variant="destructive">Destructive</ShadcnButton>
    <ShadcnButton variant="ghost" size="icon">+</ShadcnButton>
    <ShadcnButton disabled>Disabled</ShadcnButton>
  </div>
</template>

<script>
import { ShadcnButton } from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnButton,
  },
};
</script>
    `),
    'demo-Secondray': formatCode(`
<template>
  <div class="flex flex-wrap items-center justify-center gap-3">
    <ShadcnButton>Default</ShadcnButton>
    <ShadcnButton variant="secondary">Secondary2</ShadcnButton>
    <ShadcnButton variant="outline">Outline</ShadcnButton>
  </div>
</template>

<script>
import { ShadcnButton } from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnButton,
  },
};
</script>
    `),
  },
};
