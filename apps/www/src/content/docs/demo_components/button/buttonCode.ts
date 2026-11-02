import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Partial<Record<RuntimeId, Record<string, string>>> = {
  wc: {
    'demo-button-default': formatCode(`
<div class="flex flex-wrap items-center gap-3">
  <wc-shadcn-button style-profile="rhea">Default</wc-shadcn-button>
</div>
    `),
    'demo-button-destructive': formatCode(`
<div class="flex flex-wrap items-center gap-3">
  <wc-shadcn-button style-profile="rhea" variant="destructive">Destructive</wc-shadcn-button>
</div>
    `),
    'demo-button-disabled': formatCode(`
<div class="flex flex-wrap items-center gap-3">
  <wc-shadcn-button style-profile="rhea" disabled>Disabled</wc-shadcn-button>
</div>
    `),
    'demo-button-ghost': formatCode(`
<div id="ghost-demo" class="flex flex-wrap items-center gap-3">
  <wc-shadcn-button style-profile="rhea" variant="ghost">Ghost</wc-shadcn-button>
  <wc-shadcn-button style-profile="rhea" variant="ghost" disabled>Disabled ghost</wc-shadcn-button>
  <div role="status" aria-live="polite">Enabled activations: 0; disabled activations: 0</div>
</div>
<script>
  const demo = document.querySelector('#ghost-demo');
  const buttons = demo.querySelectorAll('wc-shadcn-button');
  const counts = [0, 0];
  buttons.forEach((button, index) => button.addEventListener('click', (event) => {
    if (!(event instanceof CustomEvent) || event.target !== button) return;
    counts[index]++;
    demo.querySelector('[role="status"]').textContent =
      'Enabled activations: ' + counts[0] + '; disabled activations: ' + counts[1];
  }));
</script>
    `),
    'demo-button-outline': formatCode(`
<div class="flex flex-wrap items-center gap-3">
  <wc-shadcn-button style-profile="rhea" variant="outline">Outline</wc-shadcn-button>
</div>
    `),
    'demo-button-secondary': formatCode(`
<div class="flex flex-wrap items-center gap-3">
  <wc-shadcn-button style-profile="rhea" variant="secondary">Secondary</wc-shadcn-button>
</div>
    `),
    'demo-button-sizes': formatCode(`
<div class="flex flex-wrap items-center justify-center gap-3">
  <wc-shadcn-button style-profile="rhea" size="sm">Small</wc-shadcn-button>
  <wc-shadcn-button style-profile="rhea">Default</wc-shadcn-button>
  <wc-shadcn-button style-profile="rhea" size="lg">Large</wc-shadcn-button>
  <wc-shadcn-button style-profile="rhea" size="icon" variant="outline">+</wc-shadcn-button>
</div>
    `),
    'demo-button-states': formatCode(`
<div class="flex flex-wrap items-center justify-center gap-3">
  <wc-shadcn-button style-profile="rhea">Default</wc-shadcn-button>
  <wc-shadcn-button style-profile="rhea" disabled>Disabled</wc-shadcn-button>
  <wc-shadcn-button style-profile="rhea" variant="outline" disabled>Disabled outline</wc-shadcn-button>
  <wc-shadcn-button style-profile="rhea" variant="ghost" size="icon">+</wc-shadcn-button>
</div>
    `),
    'demo-button-variants': formatCode(`
<div class="flex flex-wrap items-center justify-center gap-3">
  <wc-shadcn-button style-profile="rhea">Default</wc-shadcn-button>
  <wc-shadcn-button style-profile="rhea" variant="secondary">Secondary</wc-shadcn-button>
  <wc-shadcn-button style-profile="rhea" variant="outline">Outline</wc-shadcn-button>
  <wc-shadcn-button style-profile="rhea" variant="ghost">Ghost</wc-shadcn-button>
  <wc-shadcn-button style-profile="rhea" variant="destructive">Destructive</wc-shadcn-button>
  <wc-shadcn-button style-profile="rhea" variant="link">Link</wc-shadcn-button>
</div>
    `),
    'demo-button': formatCode(`
<div class="flex flex-wrap items-center justify-center gap-3">
  <wc-shadcn-button style-profile="rhea">Default</wc-shadcn-button>
  <div>
    <wc-shadcn-button style-profile="rhea">Default2</wc-shadcn-button>
  </div>
  <wc-shadcn-button style-profile="rhea" variant="outline">Outline</wc-shadcn-button>
  <wc-shadcn-button style-profile="rhea" variant="destructive">Destructive</wc-shadcn-button>
  <wc-shadcn-button style-profile="rhea" variant="ghost" size="icon">+</wc-shadcn-button>
  <wc-shadcn-button style-profile="rhea" disabled>Disabled</wc-shadcn-button>
</div>
    `),
    'demo-button-secondary-example': formatCode(`
<div class="flex flex-wrap items-center justify-center gap-3">
  <wc-shadcn-button style-profile="rhea">Default</wc-shadcn-button>
  <wc-shadcn-button style-profile="rhea" variant="secondary">Secondary</wc-shadcn-button>
  <wc-shadcn-button style-profile="rhea" variant="outline">Outline</wc-shadcn-button>
</div>
    `),
  },
  react: {
    'demo-button-default': formatCode(`
import { ShadcnButton } from '../proto-ui/components/react';

export function DemoButtonDefaultDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ShadcnButton styleProfile="rhea">Default</ShadcnButton>
    </div>
  );
}
    `),
    'demo-button-destructive': formatCode(`
import { ShadcnButton } from '../proto-ui/components/react';

export function DemoButtonDestructiveDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ShadcnButton styleProfile="rhea" variant="destructive">Destructive</ShadcnButton>
    </div>
  );
}
    `),
    'demo-button-disabled': formatCode(`
import { ShadcnButton } from '../proto-ui/components/react';

export function DemoButtonDisabledDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ShadcnButton styleProfile="rhea" disabled>Disabled</ShadcnButton>
    </div>
  );
}
    `),
    'demo-button-ghost': formatCode(`
import { useState } from 'react';
import { ShadcnButton } from '../proto-ui/components/react';

export function DemoButtonGhostDemo() {
  const [enabled, setEnabled] = useState(0);
  const [disabled, setDisabled] = useState(0);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ShadcnButton styleProfile="rhea" variant="ghost" onClick={() => setEnabled((n) => n + 1)}>Ghost</ShadcnButton>
      <ShadcnButton styleProfile="rhea" variant="ghost" disabled onClick={() => setDisabled((n) => n + 1)}>Disabled ghost</ShadcnButton>
      <div role="status" aria-live="polite">Enabled activations: {enabled}; disabled activations: {disabled}</div>
    </div>
  );
}
    `),
    'demo-button-outline': formatCode(`
import { ShadcnButton } from '../proto-ui/components/react';

export function DemoButtonOutlineDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ShadcnButton styleProfile="rhea" variant="outline">Outline</ShadcnButton>
    </div>
  );
}
    `),
    'demo-button-secondary': formatCode(`
import { ShadcnButton } from '../proto-ui/components/react';

export function DemoButtonSecondaryDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ShadcnButton styleProfile="rhea" variant="secondary">Secondary</ShadcnButton>
    </div>
  );
}
    `),
    'demo-button-sizes': formatCode(`
import { ShadcnButton } from '../proto-ui/components/react';

export function DemoButtonSizesDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <ShadcnButton styleProfile="rhea" size="sm">Small</ShadcnButton>
      <ShadcnButton styleProfile="rhea">Default</ShadcnButton>
      <ShadcnButton styleProfile="rhea" size="lg">Large</ShadcnButton>
      <ShadcnButton styleProfile="rhea" size="icon" variant="outline">
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
      <ShadcnButton styleProfile="rhea">Default</ShadcnButton>
      <ShadcnButton styleProfile="rhea" disabled>Disabled</ShadcnButton>
      <ShadcnButton styleProfile="rhea" variant="outline" disabled>
        Disabled outline
      </ShadcnButton>
      <ShadcnButton styleProfile="rhea" variant="ghost" size="icon">
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
      <ShadcnButton styleProfile="rhea">Default</ShadcnButton>
      <ShadcnButton styleProfile="rhea" variant="secondary">Secondary</ShadcnButton>
      <ShadcnButton styleProfile="rhea" variant="outline">Outline</ShadcnButton>
      <ShadcnButton styleProfile="rhea" variant="ghost">Ghost</ShadcnButton>
      <ShadcnButton styleProfile="rhea" variant="destructive">Destructive</ShadcnButton>
      <ShadcnButton styleProfile="rhea" variant="link">Link</ShadcnButton>
    </div>
  );
}
    `),
    'demo-button': formatCode(`
import { ShadcnButton } from '../proto-ui/components/react';

export function DemoButtonDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <ShadcnButton styleProfile="rhea">Default</ShadcnButton>
      <div>
        <ShadcnButton styleProfile="rhea">Default2</ShadcnButton>
      </div>
      <ShadcnButton styleProfile="rhea" variant="outline">Outline</ShadcnButton>
      <ShadcnButton styleProfile="rhea" variant="destructive">Destructive</ShadcnButton>
      <ShadcnButton styleProfile="rhea" variant="ghost" size="icon">
        +
      </ShadcnButton>
      <ShadcnButton styleProfile="rhea" disabled>Disabled</ShadcnButton>
    </div>
  );
}
    `),
    'demo-button-secondary-example': formatCode(`
import { ShadcnButton } from '../proto-ui/components/react';

export function DemoButtonSecondaryExampleDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <ShadcnButton styleProfile="rhea">Default</ShadcnButton>
      <ShadcnButton styleProfile="rhea" variant="secondary">Secondary</ShadcnButton>
      <ShadcnButton styleProfile="rhea" variant="outline">Outline</ShadcnButton>
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
    <ShadcnButton styleProfile="rhea">Default</ShadcnButton>
  </div>
</template>
    `),
    'demo-button-destructive': formatCode(`
<script setup lang="ts">
import { ShadcnButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <ShadcnButton styleProfile="rhea" variant="destructive">Destructive</ShadcnButton>
  </div>
</template>
    `),
    'demo-button-disabled': formatCode(`
<script setup lang="ts">
import { ShadcnButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <ShadcnButton styleProfile="rhea" disabled>Disabled</ShadcnButton>
  </div>
</template>
    `),
    'demo-button-ghost': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import { ShadcnButton } from '../proto-ui/components/vue';
const enabled = ref(0);
const disabled = ref(0);
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <ShadcnButton styleProfile="rhea" variant="ghost" @click="enabled++">Ghost</ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="ghost" disabled @click="disabled++">Disabled ghost</ShadcnButton>
    <div role="status" aria-live="polite">Enabled activations: {{ enabled }}; disabled activations: {{ disabled }}</div>
  </div>
</template>
    `),
    'demo-button-outline': formatCode(`
<script setup lang="ts">
import { ShadcnButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <ShadcnButton styleProfile="rhea" variant="outline">Outline</ShadcnButton>
  </div>
</template>
    `),
    'demo-button-secondary': formatCode(`
<script setup lang="ts">
import { ShadcnButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <ShadcnButton styleProfile="rhea" variant="secondary">Secondary</ShadcnButton>
  </div>
</template>
    `),
    'demo-button-sizes': formatCode(`
<script setup lang="ts">
import { ShadcnButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-3">
    <ShadcnButton styleProfile="rhea" size="sm">Small</ShadcnButton>
    <ShadcnButton styleProfile="rhea">Default</ShadcnButton>
    <ShadcnButton styleProfile="rhea" size="lg">Large</ShadcnButton>
    <ShadcnButton styleProfile="rhea" size="icon" variant="outline">+</ShadcnButton>
  </div>
</template>
    `),
    'demo-button-states': formatCode(`
<script setup lang="ts">
import { ShadcnButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-3">
    <ShadcnButton styleProfile="rhea">Default</ShadcnButton>
    <ShadcnButton styleProfile="rhea" disabled>Disabled</ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="outline" disabled>Disabled outline</ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="ghost" size="icon">+</ShadcnButton>
  </div>
</template>
    `),
    'demo-button-variants': formatCode(`
<script setup lang="ts">
import { ShadcnButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-3">
    <ShadcnButton styleProfile="rhea">Default</ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="secondary">Secondary</ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="outline">Outline</ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="ghost">Ghost</ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="destructive">Destructive</ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="link">Link</ShadcnButton>
  </div>
</template>
    `),
    'demo-button': formatCode(`
<script setup lang="ts">
import { ShadcnButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-3">
    <ShadcnButton styleProfile="rhea">Default</ShadcnButton>
    <div>
      <ShadcnButton styleProfile="rhea">Default2</ShadcnButton>
    </div>
    <ShadcnButton styleProfile="rhea" variant="outline">Outline</ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="destructive">Destructive</ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="ghost" size="icon">+</ShadcnButton>
    <ShadcnButton styleProfile="rhea" disabled>Disabled</ShadcnButton>
  </div>
</template>
    `),
    'demo-button-secondary-example': formatCode(`
<script setup lang="ts">
import { ShadcnButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-3">
    <ShadcnButton styleProfile="rhea">Default</ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="secondary">Secondary</ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="outline">Outline</ShadcnButton>
  </div>
</template>
    `),
  },
  vue2: {
    'demo-button-default': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-3">
    <ShadcnButton styleProfile="rhea">Default</ShadcnButton>
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
    <ShadcnButton styleProfile="rhea" variant="destructive">Destructive</ShadcnButton>
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
    <ShadcnButton styleProfile="rhea" disabled>Disabled</ShadcnButton>
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
    <ShadcnButton styleProfile="rhea" variant="ghost" @click="enabled++">Ghost</ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="ghost" disabled @click="disabled++">Disabled ghost</ShadcnButton>
    <div role="status" aria-live="polite">Enabled activations: {{ enabled }}; disabled activations: {{ disabled }}</div>
  </div>
</template>

<script>
import { ShadcnButton } from '../proto-ui/components/vue2';
export default {
  components: { ShadcnButton },
  data() { return { enabled: 0, disabled: 0 }; },
};
</script>
    `),
    'demo-button-outline': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-3">
    <ShadcnButton styleProfile="rhea" variant="outline">Outline</ShadcnButton>
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
    <ShadcnButton styleProfile="rhea" variant="secondary">Secondary</ShadcnButton>
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
    <ShadcnButton styleProfile="rhea" size="sm">Small</ShadcnButton>
    <ShadcnButton styleProfile="rhea">Default</ShadcnButton>
    <ShadcnButton styleProfile="rhea" size="lg">Large</ShadcnButton>
    <ShadcnButton styleProfile="rhea" size="icon" variant="outline">+</ShadcnButton>
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
    <ShadcnButton styleProfile="rhea">Default</ShadcnButton>
    <ShadcnButton styleProfile="rhea" disabled>Disabled</ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="outline" disabled>Disabled outline</ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="ghost" size="icon">+</ShadcnButton>
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
    <ShadcnButton styleProfile="rhea">Default</ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="secondary">Secondary</ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="outline">Outline</ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="ghost">Ghost</ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="destructive">Destructive</ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="link">Link</ShadcnButton>
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
    <ShadcnButton styleProfile="rhea">Default</ShadcnButton>
    <div>
      <ShadcnButton styleProfile="rhea">Default2</ShadcnButton>
    </div>
    <ShadcnButton styleProfile="rhea" variant="outline">Outline</ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="destructive">Destructive</ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="ghost" size="icon">+</ShadcnButton>
    <ShadcnButton styleProfile="rhea" disabled>Disabled</ShadcnButton>
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
    'demo-button-secondary-example': formatCode(`
<template>
  <div class="flex flex-wrap items-center justify-center gap-3">
    <ShadcnButton styleProfile="rhea">Default</ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="secondary">Secondary</ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="outline">Outline</ShadcnButton>
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
