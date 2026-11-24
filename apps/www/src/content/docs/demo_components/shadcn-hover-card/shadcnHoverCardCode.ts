import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Partial<Record<RuntimeId, Record<string, string>>> = {
  wc: {
    'demo-shadcn-hover-card': formatCode(`
<wc-shadcn-hover-card-root style-profile="rhea" open-delay="150" close-delay="200">
  <wc-shadcn-hover-card-trigger style-profile="rhea">@proto-ui</wc-shadcn-hover-card-trigger>
  <wc-shadcn-hover-card-content style-profile="rhea" side="bottom" align="center">
    <div class="flex items-start gap-3">
      <div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">PU</div>
      <div class="flex flex-col gap-1">
        <div class="text-sm font-semibold leading-none">@proto-ui</div>
        <p class="text-sm text-muted-foreground">Host-neutral interaction protocols for building adaptable UI components across frameworks.</p>
        <span class="pt-1 text-xs text-muted-foreground">Joined December 2024</span>
      </div>
    </div>
  </wc-shadcn-hover-card-content>
</wc-shadcn-hover-card-root>
    `),
    'demo-shadcn-hover-card-sides': formatCode(`
<div class="flex flex-wrap items-center justify-center gap-3">
  <wc-shadcn-hover-card-root style-profile="rhea" open-delay="100" close-delay="100">
    <wc-shadcn-hover-card-trigger style-profile="rhea" class="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium shadow-xs">Left</wc-shadcn-hover-card-trigger>
    <wc-shadcn-hover-card-content style-profile="rhea" side="left" align="center" side-offset="6">
      <div class="font-semibold">Hover Card</div>
      <p class="text-muted-foreground">This hover card opens on the left side of the trigger.</p>
    </wc-shadcn-hover-card-content>
  </wc-shadcn-hover-card-root>
  <wc-shadcn-hover-card-root style-profile="rhea" open-delay="100" close-delay="100">
    <wc-shadcn-hover-card-trigger style-profile="rhea" class="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium shadow-xs">Top</wc-shadcn-hover-card-trigger>
    <wc-shadcn-hover-card-content style-profile="rhea" side="top" align="center" side-offset="6">
      <div class="font-semibold">Hover Card</div>
      <p class="text-muted-foreground">This hover card opens on the top side of the trigger.</p>
    </wc-shadcn-hover-card-content>
  </wc-shadcn-hover-card-root>
  <wc-shadcn-hover-card-root style-profile="rhea" open-delay="100" close-delay="100">
    <wc-shadcn-hover-card-trigger style-profile="rhea" class="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium shadow-xs">Bottom</wc-shadcn-hover-card-trigger>
    <wc-shadcn-hover-card-content style-profile="rhea" side="bottom" align="center" side-offset="6">
      <div class="font-semibold">Hover Card</div>
      <p class="text-muted-foreground">This hover card opens on the bottom side of the trigger.</p>
    </wc-shadcn-hover-card-content>
  </wc-shadcn-hover-card-root>
  <wc-shadcn-hover-card-root style-profile="rhea" open-delay="100" close-delay="100">
    <wc-shadcn-hover-card-trigger style-profile="rhea" class="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium shadow-xs">Right</wc-shadcn-hover-card-trigger>
    <wc-shadcn-hover-card-content style-profile="rhea" side="right" align="center" side-offset="6">
      <div class="font-semibold">Hover Card</div>
      <p class="text-muted-foreground">This hover card opens on the right side of the trigger.</p>
    </wc-shadcn-hover-card-content>
  </wc-shadcn-hover-card-root>
</div>
    `),
    'demo-shadcn-hover-card-delays': formatCode(`
<div class="flex flex-wrap items-center justify-center gap-6">
  <wc-shadcn-hover-card-root style-profile="rhea" open-delay="0" close-delay="100">
    <wc-shadcn-hover-card-trigger style-profile="rhea">Instant (0ms / 100ms)</wc-shadcn-hover-card-trigger>
    <wc-shadcn-hover-card-content style-profile="rhea" side="bottom" align="center">
      Opens immediately on hover and closes 100ms after leaving.
    </wc-shadcn-hover-card-content>
  </wc-shadcn-hover-card-root>
  <wc-shadcn-hover-card-root style-profile="rhea" open-delay="400" close-delay="300">
    <wc-shadcn-hover-card-trigger style-profile="rhea">Delayed (400ms / 300ms)</wc-shadcn-hover-card-trigger>
    <wc-shadcn-hover-card-content style-profile="rhea" side="bottom" align="center">
      Waits 400ms before opening to avoid accidental triggers.
    </wc-shadcn-hover-card-content>
  </wc-shadcn-hover-card-root>
</div>
    `),
    'demo-shadcn-hover-card-disabled': formatCode(`
<div class="flex flex-wrap items-center justify-center gap-6">
  <wc-shadcn-hover-card-root style-profile="rhea" open-delay="100" close-delay="150">
    <wc-shadcn-hover-card-trigger style-profile="rhea">Active link</wc-shadcn-hover-card-trigger>
    <wc-shadcn-hover-card-content style-profile="rhea" side="bottom" align="center">
      Hovering or focusing this trigger opens the preview card.
    </wc-shadcn-hover-card-content>
  </wc-shadcn-hover-card-root>
  <wc-shadcn-hover-card-root style-profile="rhea" disabled open-delay="100" close-delay="150">
    <wc-shadcn-hover-card-trigger style-profile="rhea">Disabled preview</wc-shadcn-hover-card-trigger>
    <wc-shadcn-hover-card-content style-profile="rhea" side="bottom" align="center">
      Disabled cards stay closed on hover and focus.
    </wc-shadcn-hover-card-content>
  </wc-shadcn-hover-card-root>
</div>
    `),
    'demo-shadcn-hover-card-controlled': formatCode(`
<div class="flex items-center gap-4">
  <wc-shadcn-button style-profile="rhea" variant="outline" size="sm" id="toggle-card">Toggle card</wc-shadcn-button>
  <wc-shadcn-hover-card-root style-profile="rhea" id="controlled-card" open="false" open-delay="100" close-delay="150">
    <wc-shadcn-hover-card-trigger style-profile="rhea">@proto-ui</wc-shadcn-hover-card-trigger>
    <wc-shadcn-hover-card-content style-profile="rhea" side="bottom" align="center">
      Visibility is synced with external state via open and openChange.
    </wc-shadcn-hover-card-content>
  </wc-shadcn-hover-card-root>
</div>
    `),
  },
  react: {
    'demo-shadcn-hover-card': formatCode(`
import {
  ShadcnHoverCardRoot,
  ShadcnHoverCardTrigger,
  ShadcnHoverCardContent,
} from '../proto-ui/components/react';

export function HoverCardDemo() {
  return (
    <ShadcnHoverCardRoot styleProfile="rhea" openDelay={150} closeDelay={200}>
      <ShadcnHoverCardTrigger styleProfile="rhea">@proto-ui</ShadcnHoverCardTrigger>
      <ShadcnHoverCardContent styleProfile="rhea" side="bottom" align="center">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            PU
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-sm font-semibold leading-none">@proto-ui</div>
            <p className="text-sm text-muted-foreground">
              Host-neutral interaction protocols for building adaptable UI components across frameworks.
            </p>
            <span className="pt-1 text-xs text-muted-foreground">Joined December 2024</span>
          </div>
        </div>
      </ShadcnHoverCardContent>
    </ShadcnHoverCardRoot>
  );
}
    `),
    'demo-shadcn-hover-card-sides': formatCode(`
import {
  ShadcnHoverCardRoot,
  ShadcnHoverCardTrigger,
  ShadcnHoverCardContent,
} from '../proto-ui/components/react';

const SIDES = ['left', 'top', 'bottom', 'right'] as const;

export function HoverCardSidesDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {SIDES.map((side) => (
        <ShadcnHoverCardRoot styleProfile="rhea" key={side} openDelay={100} closeDelay={100}>
          <ShadcnHoverCardTrigger
            styleProfile="rhea"
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium capitalize shadow-xs"
          >
            {side}
          </ShadcnHoverCardTrigger>
          <ShadcnHoverCardContent styleProfile="rhea" side={side} align="center" sideOffset={6}>
            <div className="flex flex-col gap-1">
              <div className="font-semibold">Hover Card</div>
              <p className="text-muted-foreground">
                This hover card opens on the {side} side of the trigger.
              </p>
            </div>
          </ShadcnHoverCardContent>
        </ShadcnHoverCardRoot>
      ))}
    </div>
  );
}
    `),
    'demo-shadcn-hover-card-delays': formatCode(`
import {
  ShadcnHoverCardRoot,
  ShadcnHoverCardTrigger,
  ShadcnHoverCardContent,
} from '../proto-ui/components/react';

export function HoverCardDelaysDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <ShadcnHoverCardRoot styleProfile="rhea" openDelay={0} closeDelay={100}>
        <ShadcnHoverCardTrigger styleProfile="rhea">Instant (0ms / 100ms)</ShadcnHoverCardTrigger>
        <ShadcnHoverCardContent styleProfile="rhea" side="bottom" align="center">
          Opens immediately on hover and closes 100ms after leaving.
        </ShadcnHoverCardContent>
      </ShadcnHoverCardRoot>
      <ShadcnHoverCardRoot styleProfile="rhea" openDelay={400} closeDelay={300}>
        <ShadcnHoverCardTrigger styleProfile="rhea">Delayed (400ms / 300ms)</ShadcnHoverCardTrigger>
        <ShadcnHoverCardContent styleProfile="rhea" side="bottom" align="center">
          Waits 400ms before opening to avoid accidental triggers.
        </ShadcnHoverCardContent>
      </ShadcnHoverCardRoot>
    </div>
  );
}
    `),
    'demo-shadcn-hover-card-disabled': formatCode(`
import {
  ShadcnHoverCardRoot,
  ShadcnHoverCardTrigger,
  ShadcnHoverCardContent,
} from '../proto-ui/components/react';

export function HoverCardDisabledDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <ShadcnHoverCardRoot styleProfile="rhea" openDelay={100} closeDelay={150}>
        <ShadcnHoverCardTrigger styleProfile="rhea">Active link</ShadcnHoverCardTrigger>
        <ShadcnHoverCardContent styleProfile="rhea" side="bottom" align="center">
          Hovering or focusing this trigger opens the preview card.
        </ShadcnHoverCardContent>
      </ShadcnHoverCardRoot>
      <ShadcnHoverCardRoot styleProfile="rhea" disabled openDelay={100} closeDelay={150}>
        <ShadcnHoverCardTrigger styleProfile="rhea">Disabled preview</ShadcnHoverCardTrigger>
        <ShadcnHoverCardContent styleProfile="rhea" side="bottom" align="center">
          Disabled cards stay closed on hover and focus.
        </ShadcnHoverCardContent>
      </ShadcnHoverCardRoot>
    </div>
  );
}
    `),
    'demo-shadcn-hover-card-controlled': formatCode(`
import { useState } from 'react';
import {
  ShadcnButton,
  ShadcnHoverCardRoot,
  ShadcnHoverCardTrigger,
  ShadcnHoverCardContent,
} from '../proto-ui/components/react';

export function HoverCardControlledDemo() {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((prev) => !prev);

  return (
    <div className="flex items-center gap-4">
      <ShadcnButton styleProfile="rhea" variant="outline" size="sm" onClick={toggle}>
        Toggle card
      </ShadcnButton>
      <ShadcnHoverCardRoot styleProfile="rhea" open={open} openDelay={100} closeDelay={150}>
        <ShadcnHoverCardTrigger styleProfile="rhea">@proto-ui</ShadcnHoverCardTrigger>
        <ShadcnHoverCardContent styleProfile="rhea" side="bottom" align="center">
          Visibility is synced with external state via open and openChange.
        </ShadcnHoverCardContent>
      </ShadcnHoverCardRoot>
    </div>
  );
}
    `),
  },
  vue: {
    'demo-shadcn-hover-card': formatCode(`
<script setup lang="ts">
import {
  ShadcnHoverCardRoot,
  ShadcnHoverCardTrigger,
  ShadcnHoverCardContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnHoverCardRoot styleProfile="rhea" :open-delay="150" :close-delay="200">
    <ShadcnHoverCardTrigger styleProfile="rhea">@proto-ui</ShadcnHoverCardTrigger>
    <ShadcnHoverCardContent styleProfile="rhea" side="bottom" align="center">
      <div class="flex items-start gap-3">
        <div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">PU</div>
        <div class="flex flex-col gap-1">
          <div class="text-sm font-semibold leading-none">@proto-ui</div>
          <p class="text-sm text-muted-foreground">Host-neutral interaction protocols for building adaptable UI components across frameworks.</p>
          <span class="pt-1 text-xs text-muted-foreground">Joined December 2024</span>
        </div>
      </div>
    </ShadcnHoverCardContent>
  </ShadcnHoverCardRoot>
</template>
    `),
    'demo-shadcn-hover-card-sides': formatCode(`
<script setup lang="ts">
import {
  ShadcnHoverCardRoot,
  ShadcnHoverCardTrigger,
  ShadcnHoverCardContent,
} from '../proto-ui/components/vue';

const sides = ['left', 'top', 'bottom', 'right'] as const;
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-3">
    <ShadcnHoverCardRoot styleProfile="rhea" v-for="side in sides" :key="side" :open-delay="100" :close-delay="100">
      <ShadcnHoverCardTrigger styleProfile="rhea" class="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium capitalize shadow-xs">
        {{ side }}
      </ShadcnHoverCardTrigger>
      <ShadcnHoverCardContent styleProfile="rhea" :side="side" align="center" :side-offset="6">
        <div class="font-semibold">Hover Card</div>
        <p class="text-muted-foreground">This hover card opens on the {{ side }} side of the trigger.</p>
      </ShadcnHoverCardContent>
    </ShadcnHoverCardRoot>
  </div>
</template>
    `),
    'demo-shadcn-hover-card-delays': formatCode(`
<script setup lang="ts">
import {
  ShadcnHoverCardRoot,
  ShadcnHoverCardTrigger,
  ShadcnHoverCardContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-6">
    <ShadcnHoverCardRoot styleProfile="rhea" :open-delay="0" :close-delay="100">
      <ShadcnHoverCardTrigger styleProfile="rhea">Instant (0ms / 100ms)</ShadcnHoverCardTrigger>
      <ShadcnHoverCardContent styleProfile="rhea" side="bottom" align="center">
        Opens immediately on hover and closes 100ms after leaving.
      </ShadcnHoverCardContent>
    </ShadcnHoverCardRoot>
    <ShadcnHoverCardRoot styleProfile="rhea" :open-delay="400" :close-delay="300">
      <ShadcnHoverCardTrigger styleProfile="rhea">Delayed (400ms / 300ms)</ShadcnHoverCardTrigger>
      <ShadcnHoverCardContent styleProfile="rhea" side="bottom" align="center">
        Waits 400ms before opening to avoid accidental triggers.
      </ShadcnHoverCardContent>
    </ShadcnHoverCardRoot>
  </div>
</template>
    `),
    'demo-shadcn-hover-card-disabled': formatCode(`
<script setup lang="ts">
import {
  ShadcnHoverCardRoot,
  ShadcnHoverCardTrigger,
  ShadcnHoverCardContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-6">
    <ShadcnHoverCardRoot styleProfile="rhea" :open-delay="100" :close-delay="150">
      <ShadcnHoverCardTrigger styleProfile="rhea">Active link</ShadcnHoverCardTrigger>
      <ShadcnHoverCardContent styleProfile="rhea" side="bottom" align="center">
        Hovering or focusing this trigger opens the preview card.
      </ShadcnHoverCardContent>
    </ShadcnHoverCardRoot>
    <ShadcnHoverCardRoot styleProfile="rhea" disabled :open-delay="100" :close-delay="150">
      <ShadcnHoverCardTrigger styleProfile="rhea">Disabled preview</ShadcnHoverCardTrigger>
      <ShadcnHoverCardContent styleProfile="rhea" side="bottom" align="center">
        Disabled cards stay closed on hover and focus.
      </ShadcnHoverCardContent>
    </ShadcnHoverCardRoot>
  </div>
</template>
    `),
    'demo-shadcn-hover-card-controlled': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  ShadcnButton,
  ShadcnHoverCardRoot,
  ShadcnHoverCardTrigger,
  ShadcnHoverCardContent,
} from '../proto-ui/components/vue';

const open = ref(false);
const toggle = () => {
  open.value = !open.value;
};
</script>

<template>
  <div class="flex items-center gap-4">
    <ShadcnButton styleProfile="rhea" variant="outline" size="sm" @click="toggle">Toggle card</ShadcnButton>
    <ShadcnHoverCardRoot styleProfile="rhea" :open="open" :open-delay="100" :close-delay="150">
      <ShadcnHoverCardTrigger styleProfile="rhea">@proto-ui</ShadcnHoverCardTrigger>
      <ShadcnHoverCardContent styleProfile="rhea" side="bottom" align="center">
        Visibility is synced with external state via open and openChange.
      </ShadcnHoverCardContent>
    </ShadcnHoverCardRoot>
  </div>
</template>
    `),
  },
  vue2: {
    'demo-shadcn-hover-card': formatCode(`
<template>
  <ShadcnHoverCardRoot styleProfile="rhea" :open-delay="150" :close-delay="200">
    <ShadcnHoverCardTrigger styleProfile="rhea">@proto-ui</ShadcnHoverCardTrigger>
    <ShadcnHoverCardContent styleProfile="rhea" side="bottom" align="center">
      <div class="flex items-start gap-3">
        <div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">PU</div>
        <div class="flex flex-col gap-1">
          <div class="text-sm font-semibold leading-none">@proto-ui</div>
          <p class="text-sm text-muted-foreground">Host-neutral interaction protocols for building adaptable UI components across frameworks.</p>
          <span class="pt-1 text-xs text-muted-foreground">Joined December 2024</span>
        </div>
      </div>
    </ShadcnHoverCardContent>
  </ShadcnHoverCardRoot>
</template>

<script>
import {
  ShadcnHoverCardRoot,
  ShadcnHoverCardTrigger,
  ShadcnHoverCardContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnHoverCardRoot,
    ShadcnHoverCardTrigger,
    ShadcnHoverCardContent,
  },
};
</script>
    `),
    'demo-shadcn-hover-card-sides': formatCode(`
<template>
  <div class="flex flex-wrap items-center justify-center gap-3">
    <ShadcnHoverCardRoot styleProfile="rhea" v-for="side in sides" :key="side" :open-delay="100" :close-delay="100">
      <ShadcnHoverCardTrigger styleProfile="rhea" class="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium capitalize shadow-xs">
        {{ side }}
      </ShadcnHoverCardTrigger>
      <ShadcnHoverCardContent styleProfile="rhea" :side="side" align="center" :side-offset="6">
        <div class="font-semibold">Hover Card</div>
        <p class="text-muted-foreground">This hover card opens on the {{ side }} side of the trigger.</p>
      </ShadcnHoverCardContent>
    </ShadcnHoverCardRoot>
  </div>
</template>

<script>
import {
  ShadcnHoverCardRoot,
  ShadcnHoverCardTrigger,
  ShadcnHoverCardContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnHoverCardRoot,
    ShadcnHoverCardTrigger,
    ShadcnHoverCardContent,
  },
  data() {
    return { sides: ['left', 'top', 'bottom', 'right'] };
  },
};
</script>
    `),
    'demo-shadcn-hover-card-delays': formatCode(`
<template>
  <div class="flex flex-wrap items-center justify-center gap-6">
    <ShadcnHoverCardRoot styleProfile="rhea" :open-delay="0" :close-delay="100">
      <ShadcnHoverCardTrigger styleProfile="rhea">Instant (0ms / 100ms)</ShadcnHoverCardTrigger>
      <ShadcnHoverCardContent styleProfile="rhea" side="bottom" align="center">
        Opens immediately on hover and closes 100ms after leaving.
      </ShadcnHoverCardContent>
    </ShadcnHoverCardRoot>
    <ShadcnHoverCardRoot styleProfile="rhea" :open-delay="400" :close-delay="300">
      <ShadcnHoverCardTrigger styleProfile="rhea">Delayed (400ms / 300ms)</ShadcnHoverCardTrigger>
      <ShadcnHoverCardContent styleProfile="rhea" side="bottom" align="center">
        Waits 400ms before opening to avoid accidental triggers.
      </ShadcnHoverCardContent>
    </ShadcnHoverCardRoot>
  </div>
</template>

<script>
import {
  ShadcnHoverCardRoot,
  ShadcnHoverCardTrigger,
  ShadcnHoverCardContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnHoverCardRoot,
    ShadcnHoverCardTrigger,
    ShadcnHoverCardContent,
  },
};
</script>
    `),
    'demo-shadcn-hover-card-disabled': formatCode(`
<template>
  <div class="flex flex-wrap items-center justify-center gap-6">
    <ShadcnHoverCardRoot styleProfile="rhea" :open-delay="100" :close-delay="150">
      <ShadcnHoverCardTrigger styleProfile="rhea">Active link</ShadcnHoverCardTrigger>
      <ShadcnHoverCardContent styleProfile="rhea" side="bottom" align="center">
        Hovering or focusing this trigger opens the preview card.
      </ShadcnHoverCardContent>
    </ShadcnHoverCardRoot>
    <ShadcnHoverCardRoot styleProfile="rhea" disabled :open-delay="100" :close-delay="150">
      <ShadcnHoverCardTrigger styleProfile="rhea">Disabled preview</ShadcnHoverCardTrigger>
      <ShadcnHoverCardContent styleProfile="rhea" side="bottom" align="center">
        Disabled cards stay closed on hover and focus.
      </ShadcnHoverCardContent>
    </ShadcnHoverCardRoot>
  </div>
</template>

<script>
import {
  ShadcnHoverCardRoot,
  ShadcnHoverCardTrigger,
  ShadcnHoverCardContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnHoverCardRoot,
    ShadcnHoverCardTrigger,
    ShadcnHoverCardContent,
  },
};
</script>
    `),
    'demo-shadcn-hover-card-controlled': formatCode(`
<template>
  <div class="flex items-center gap-4">
    <ShadcnButton styleProfile="rhea" variant="outline" size="sm" @click="toggle">Toggle card</ShadcnButton>
    <ShadcnHoverCardRoot styleProfile="rhea" :open="open" :open-delay="100" :close-delay="150">
      <ShadcnHoverCardTrigger styleProfile="rhea">@proto-ui</ShadcnHoverCardTrigger>
      <ShadcnHoverCardContent styleProfile="rhea" side="bottom" align="center">
        Visibility is synced with external state via open and openChange.
      </ShadcnHoverCardContent>
    </ShadcnHoverCardRoot>
  </div>
</template>

<script>
import {
  ShadcnButton,
  ShadcnHoverCardRoot,
  ShadcnHoverCardTrigger,
  ShadcnHoverCardContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnButton,
    ShadcnHoverCardRoot,
    ShadcnHoverCardTrigger,
    ShadcnHoverCardContent,
  },
  data() {
    return { open: false };
  },
  methods: {
    toggle() {
      this.open = !this.open;
    },
  },
};
</script>
    `),
  },
};
