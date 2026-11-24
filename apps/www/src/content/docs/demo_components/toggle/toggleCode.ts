import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-toggle': formatCode(`
<div class="flex flex-wrap items-center gap-3">
  <wc-shadcn-toggle style-profile="rhea">
    <span aria-hidden="true">B</span><span class="sr-only">Bold</span>
  </wc-shadcn-toggle>
  <wc-shadcn-toggle style-profile="rhea" variant="outline" default-active>
    <span aria-hidden="true">I</span><span class="sr-only">Italic</span>
  </wc-shadcn-toggle>
  <wc-shadcn-toggle style-profile="rhea" size="sm">
    <span aria-hidden="true">U</span><span class="sr-only">Underline</span>
  </wc-shadcn-toggle>
  <wc-shadcn-toggle style-profile="rhea" default-active disabled>
    <span aria-hidden="true">S</span><span class="sr-only">Strikethrough</span>
  </wc-shadcn-toggle>
  <wc-shadcn-toggle style-profile="rhea" size="lg">Large</wc-shadcn-toggle>
  <wc-shadcn-toggle style-profile="rhea" variant="outline">Outline</wc-shadcn-toggle>
</div>
    `),
    'demo-shadcn-toggle-outline': formatCode(`
<div class="flex flex-wrap items-center gap-2">
  <wc-shadcn-toggle style-profile="rhea" variant="outline">Italic</wc-shadcn-toggle>
  <wc-shadcn-toggle style-profile="rhea" variant="outline" default-active>Bold</wc-shadcn-toggle>
</div>
    `),
    'demo-shadcn-toggle-with-text': formatCode(`
<div class="flex flex-wrap items-center gap-2">
  <wc-shadcn-toggle style-profile="rhea">Italic</wc-shadcn-toggle>
  <wc-shadcn-toggle style-profile="rhea" default-active>Underline</wc-shadcn-toggle>
</div>
    `),
    'demo-shadcn-toggle-sizes': formatCode(`
<div class="flex flex-wrap items-center gap-2">
  <wc-shadcn-toggle style-profile="rhea" variant="outline" size="sm">Small</wc-shadcn-toggle>
  <wc-shadcn-toggle style-profile="rhea" variant="outline" size="default">Default</wc-shadcn-toggle>
  <wc-shadcn-toggle style-profile="rhea" variant="outline" size="lg">Large</wc-shadcn-toggle>
</div>
    `),
    'demo-shadcn-toggle-disabled': formatCode(`
<div class="flex flex-wrap items-center gap-2">
  <wc-shadcn-toggle style-profile="rhea" disabled>Disabled</wc-shadcn-toggle>
  <wc-shadcn-toggle style-profile="rhea" variant="outline" disabled>Disabled</wc-shadcn-toggle>
  <wc-shadcn-toggle style-profile="rhea" variant="outline" default-active disabled>Active Disabled</wc-shadcn-toggle>
</div>
    `),
    'demo-shadcn-toggle-controlled': formatCode(`
<div class="flex flex-wrap items-center gap-3">
  <wc-shadcn-toggle id="controlled-toggle" style-profile="rhea" variant="outline">Bold</wc-shadcn-toggle>
  <span id="controlled-state" role="status" aria-live="polite">Bold: On</span>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const toggle = document.querySelector('#controlled-toggle');
  const state = document.querySelector('#controlled-state');
  let active = true;
  const sync = () => {
    setElementProps(toggle, { styleProfile: 'rhea', variant: 'outline', active });
    state.textContent = active ? 'Bold: On' : 'Bold: Off';
  };
  toggle.addEventListener('activeChange', (event) => {
    active = event.detail.active;
    sync();
  });
  sync();
</script>
    `),
    'demo-shadcn-toggle-rtl': formatCode(`
<div dir="rtl" class="flex flex-wrap items-center gap-2">
  <wc-shadcn-toggle style-profile="rhea" variant="outline" size="sm">غامق</wc-shadcn-toggle>
  <wc-shadcn-toggle style-profile="rhea" variant="outline" size="sm" default-active>مائل</wc-shadcn-toggle>
</div>
    `),
    'demo-brutalist-toggle': formatCode(`
<div class="flex flex-wrap items-center gap-4">
  <wc-brutalist-toggle>Toggle</wc-brutalist-toggle>
  <wc-brutalist-toggle default-active>Active</wc-brutalist-toggle>
  <wc-brutalist-toggle variant="outline">Outline</wc-brutalist-toggle>
  <wc-brutalist-toggle disabled>Disabled</wc-brutalist-toggle>
</div>
    `),
    'demo-brutalist-toggle-outline': formatCode(`
<div class="flex flex-wrap items-center gap-3">
  <wc-brutalist-toggle variant="outline">Italic</wc-brutalist-toggle>
  <wc-brutalist-toggle variant="outline" default-active>Bold</wc-brutalist-toggle>
</div>
    `),
    'demo-brutalist-toggle-with-text': formatCode(`
<div class="flex flex-wrap items-center gap-3">
  <wc-brutalist-toggle>Italic</wc-brutalist-toggle>
  <wc-brutalist-toggle default-active>Underline</wc-brutalist-toggle>
</div>
    `),
    'demo-brutalist-toggle-sizes': formatCode(`
<div class="flex flex-wrap items-center gap-3">
  <wc-brutalist-toggle variant="outline" size="sm">Small</wc-brutalist-toggle>
  <wc-brutalist-toggle variant="outline" size="default">Default</wc-brutalist-toggle>
  <wc-brutalist-toggle variant="outline" size="lg">Large</wc-brutalist-toggle>
</div>
    `),
    'demo-brutalist-toggle-disabled': formatCode(`
<div class="flex flex-wrap items-center gap-3">
  <wc-brutalist-toggle disabled>Disabled</wc-brutalist-toggle>
  <wc-brutalist-toggle variant="outline" disabled>Disabled</wc-brutalist-toggle>
  <wc-brutalist-toggle default-active disabled>Active Disabled</wc-brutalist-toggle>
</div>
    `),
    'demo-bootstrap-2-3-2-toggle': formatCode(`
<div class="flex flex-wrap items-center gap-3">
  <wc-bootstrap-2-3-2-toggle>Bold</wc-bootstrap-2-3-2-toggle>
  <wc-bootstrap-2-3-2-toggle default-active>Italic</wc-bootstrap-2-3-2-toggle>
  <wc-bootstrap-2-3-2-toggle default-active disabled>Unavailable</wc-bootstrap-2-3-2-toggle>
</div>
    `),
    'demo-bootstrap-2-3-2-toggle-variants': formatCode(`
<div class="flex flex-wrap items-center gap-2">
  <wc-bootstrap-2-3-2-toggle variant="default">Default</wc-bootstrap-2-3-2-toggle>
  <wc-bootstrap-2-3-2-toggle variant="primary" default-active>Primary</wc-bootstrap-2-3-2-toggle>
  <wc-bootstrap-2-3-2-toggle variant="success">Success</wc-bootstrap-2-3-2-toggle>
  <wc-bootstrap-2-3-2-toggle variant="info">Info</wc-bootstrap-2-3-2-toggle>
  <wc-bootstrap-2-3-2-toggle variant="warning">Warning</wc-bootstrap-2-3-2-toggle>
  <wc-bootstrap-2-3-2-toggle variant="danger">Danger</wc-bootstrap-2-3-2-toggle>
  <wc-bootstrap-2-3-2-toggle variant="inverse">Inverse</wc-bootstrap-2-3-2-toggle>
</div>
    `),
    'demo-bootstrap-2-3-2-toggle-with-text': formatCode(`
<div class="flex flex-wrap items-center gap-2">
  <wc-bootstrap-2-3-2-toggle>Bold</wc-bootstrap-2-3-2-toggle>
  <wc-bootstrap-2-3-2-toggle default-active>Italic</wc-bootstrap-2-3-2-toggle>
  <wc-bootstrap-2-3-2-toggle>Underline</wc-bootstrap-2-3-2-toggle>
</div>
    `),
    'demo-bootstrap-2-3-2-toggle-sizes': formatCode(`
<div class="flex flex-wrap items-center gap-2">
  <wc-bootstrap-2-3-2-toggle size="mini">Mini</wc-bootstrap-2-3-2-toggle>
  <wc-bootstrap-2-3-2-toggle size="small">Small</wc-bootstrap-2-3-2-toggle>
  <wc-bootstrap-2-3-2-toggle size="default" default-active>Default</wc-bootstrap-2-3-2-toggle>
  <wc-bootstrap-2-3-2-toggle size="large">Large</wc-bootstrap-2-3-2-toggle>
</div>
    `),
    'demo-bootstrap-2-3-2-toggle-disabled': formatCode(`
<div class="flex flex-wrap items-center gap-2">
  <wc-bootstrap-2-3-2-toggle disabled>Disabled</wc-bootstrap-2-3-2-toggle>
  <wc-bootstrap-2-3-2-toggle default-active disabled>Active Disabled</wc-bootstrap-2-3-2-toggle>
  <wc-bootstrap-2-3-2-toggle variant="primary" disabled>Primary Disabled</wc-bootstrap-2-3-2-toggle>
</div>
    `),
    'demo-liquid-glass-toggle': formatCode(`
<div class="flex flex-wrap items-center gap-8">
  <wc-liquid-glass-toggle>Bold</wc-liquid-glass-toggle>
  <wc-liquid-glass-toggle default-active>Italic</wc-liquid-glass-toggle>
  <wc-liquid-glass-toggle material="opaque">Opaque</wc-liquid-glass-toggle>
  <wc-liquid-glass-toggle default-active disabled>Disabled</wc-liquid-glass-toggle>
</div>
    `),
    'demo-liquid-glass-toggle-with-text': formatCode(`
<div class="flex flex-wrap items-center gap-8">
  <wc-liquid-glass-toggle>Bold</wc-liquid-glass-toggle>
  <wc-liquid-glass-toggle default-active>Italic</wc-liquid-glass-toggle>
</div>
    `),
    'demo-liquid-glass-toggle-sizes': formatCode(`
<div class="flex flex-wrap items-center gap-8">
  <wc-liquid-glass-toggle size="sm">Small</wc-liquid-glass-toggle>
  <wc-liquid-glass-toggle size="default" default-active>Default</wc-liquid-glass-toggle>
  <wc-liquid-glass-toggle size="lg">Large</wc-liquid-glass-toggle>
</div>
    `),
    'demo-liquid-glass-toggle-material': formatCode(`
<div class="flex flex-wrap items-center gap-8">
  <wc-liquid-glass-toggle material="auto">Auto Glass</wc-liquid-glass-toggle>
  <wc-liquid-glass-toggle material="auto" default-active>Auto Active</wc-liquid-glass-toggle>
  <wc-liquid-glass-toggle material="opaque">Opaque</wc-liquid-glass-toggle>
  <wc-liquid-glass-toggle material="opaque" default-active>Opaque Active</wc-liquid-glass-toggle>
</div>
    `),
    'demo-liquid-glass-toggle-disabled': formatCode(`
<div class="flex flex-wrap items-center gap-8">
  <wc-liquid-glass-toggle disabled>Disabled</wc-liquid-glass-toggle>
  <wc-liquid-glass-toggle default-active disabled>Active Disabled</wc-liquid-glass-toggle>
</div>
    `),
  },
  react: {
    'demo-shadcn-toggle': formatCode(`
import { Bold, Italic, Strikethrough, Underline } from 'lucide-react';
import { ShadcnToggle } from '../proto-ui/components/react';

export function ToggleDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ShadcnToggle styleProfile="rhea">
        <Bold className="size-4 shrink-0 pointer-events-none" />
        <span className="sr-only">Bold</span>
      </ShadcnToggle>
      <ShadcnToggle styleProfile="rhea" variant="outline" defaultActive>
        <Italic className="size-4 shrink-0 pointer-events-none" />
        <span className="sr-only">Italic</span>
      </ShadcnToggle>
      <ShadcnToggle styleProfile="rhea" size="sm">
        <Underline className="size-4 shrink-0 pointer-events-none" />
        <span className="sr-only">Underline</span>
      </ShadcnToggle>
      <ShadcnToggle styleProfile="rhea" defaultActive disabled>
        <Strikethrough className="size-4 shrink-0 pointer-events-none" />
        <span className="sr-only">Strikethrough</span>
      </ShadcnToggle>
      <ShadcnToggle styleProfile="rhea" size="lg">Large</ShadcnToggle>
      <ShadcnToggle styleProfile="rhea" variant="outline">Outline</ShadcnToggle>
    </div>
  );
}
    `),
    'demo-shadcn-toggle-outline': formatCode(`
import { Bold, Italic } from 'lucide-react';
import { ShadcnToggle } from '../proto-ui/components/react';

export function ToggleOutlineDemo() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ShadcnToggle styleProfile="rhea" variant="outline">
        <Italic className="size-4 shrink-0 pointer-events-none" />
        Italic
      </ShadcnToggle>
      <ShadcnToggle styleProfile="rhea" variant="outline" defaultActive>
        <Bold className="size-4 shrink-0 pointer-events-none" />
        Bold
      </ShadcnToggle>
    </div>
  );
}
    `),
    'demo-shadcn-toggle-with-text': formatCode(`
import { Italic, Underline } from 'lucide-react';
import { ShadcnToggle } from '../proto-ui/components/react';

export function ToggleWithTextDemo() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ShadcnToggle styleProfile="rhea">
        <Italic className="size-4 shrink-0 pointer-events-none" />
        Italic
      </ShadcnToggle>
      <ShadcnToggle styleProfile="rhea" defaultActive>
        <Underline className="size-4 shrink-0 pointer-events-none" />
        Underline
      </ShadcnToggle>
    </div>
  );
}
    `),
    'demo-shadcn-toggle-sizes': formatCode(`
import { ShadcnToggle } from '../proto-ui/components/react';

export function ToggleSizesDemo() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ShadcnToggle styleProfile="rhea" variant="outline" size="sm">Small</ShadcnToggle>
      <ShadcnToggle styleProfile="rhea" variant="outline" size="default">Default</ShadcnToggle>
      <ShadcnToggle styleProfile="rhea" variant="outline" size="lg">Large</ShadcnToggle>
    </div>
  );
}
    `),
    'demo-shadcn-toggle-disabled': formatCode(`
import { ShadcnToggle } from '../proto-ui/components/react';

export function ToggleDisabledDemo() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ShadcnToggle styleProfile="rhea" disabled>Disabled</ShadcnToggle>
      <ShadcnToggle styleProfile="rhea" variant="outline" disabled>Disabled</ShadcnToggle>
      <ShadcnToggle styleProfile="rhea" variant="outline" defaultActive disabled>
        Active Disabled
      </ShadcnToggle>
    </div>
  );
}
    `),
    'demo-shadcn-toggle-controlled': formatCode(`
import { useState } from 'react';
import { Bold } from 'lucide-react';
import { ShadcnToggle } from '../proto-ui/components/react';

export function ToggleControlledDemo() {
  const [active, setActive] = useState(true);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ShadcnToggle
        styleProfile="rhea"
        variant="outline"
        active={active}
        onActiveChange={(detail) => setActive(detail.active)}
      >
        <Bold className="size-4 shrink-0 pointer-events-none" />
        Bold
      </ShadcnToggle>
      <span className="text-sm text-muted-foreground" role="status" aria-live="polite">
        {active ? 'Bold: On' : 'Bold: Off'}
      </span>
    </div>
  );
}
    `),
    'demo-shadcn-toggle-rtl': formatCode(`
import { Bold, Italic } from 'lucide-react';
import { ShadcnToggle } from '../proto-ui/components/react';

export function ToggleRtlDemo() {
  return (
    <div dir="rtl" className="flex flex-wrap items-center gap-2">
      <ShadcnToggle styleProfile="rhea" variant="outline" size="sm">
        <Bold className="size-4 shrink-0 pointer-events-none" />
        غامق
      </ShadcnToggle>
      <ShadcnToggle styleProfile="rhea" variant="outline" size="sm" defaultActive>
        <Italic className="size-4 shrink-0 pointer-events-none" />
        مائل
      </ShadcnToggle>
    </div>
  );
}
    `),
    'demo-brutalist-toggle': formatCode(`
import { BrutalistToggle } from '../proto-ui/components/react';

export function BrutalistToggleDemo() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <BrutalistToggle>Toggle</BrutalistToggle>
      <BrutalistToggle defaultActive>Active</BrutalistToggle>
      <BrutalistToggle variant="outline">Outline</BrutalistToggle>
      <BrutalistToggle disabled>Disabled</BrutalistToggle>
    </div>
  );
}
    `),
    'demo-brutalist-toggle-outline': formatCode(`
import { Bold, Italic } from 'lucide-react';
import { BrutalistToggle } from '../proto-ui/components/react';

export function BrutalistToggleOutlineDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <BrutalistToggle variant="outline">
        <Italic className="size-4 shrink-0 pointer-events-none" />
        Italic
      </BrutalistToggle>
      <BrutalistToggle variant="outline" defaultActive>
        <Bold className="size-4 shrink-0 pointer-events-none" />
        Bold
      </BrutalistToggle>
    </div>
  );
}
    `),
    'demo-brutalist-toggle-with-text': formatCode(`
import { Italic, Underline } from 'lucide-react';
import { BrutalistToggle } from '../proto-ui/components/react';

export function BrutalistToggleWithTextDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <BrutalistToggle>
        <Italic className="size-4 shrink-0 pointer-events-none" />
        Italic
      </BrutalistToggle>
      <BrutalistToggle defaultActive>
        <Underline className="size-4 shrink-0 pointer-events-none" />
        Underline
      </BrutalistToggle>
    </div>
  );
}
    `),
    'demo-brutalist-toggle-sizes': formatCode(`
import { BrutalistToggle } from '../proto-ui/components/react';

export function BrutalistToggleSizesDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <BrutalistToggle variant="outline" size="sm">Small</BrutalistToggle>
      <BrutalistToggle variant="outline" size="default">Default</BrutalistToggle>
      <BrutalistToggle variant="outline" size="lg">Large</BrutalistToggle>
    </div>
  );
}
    `),
    'demo-brutalist-toggle-disabled': formatCode(`
import { BrutalistToggle } from '../proto-ui/components/react';

export function BrutalistToggleDisabledDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <BrutalistToggle disabled>Disabled</BrutalistToggle>
      <BrutalistToggle variant="outline" disabled>Disabled</BrutalistToggle>
      <BrutalistToggle defaultActive disabled>Active Disabled</BrutalistToggle>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-toggle': formatCode(`
import { BootstrapToggle } from '../proto-ui/components/react';

export function BootstrapToggleDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <BootstrapToggle>Bold</BootstrapToggle>
      <BootstrapToggle defaultActive>Italic</BootstrapToggle>
      <BootstrapToggle defaultActive disabled>Unavailable</BootstrapToggle>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-toggle-variants': formatCode(`
import { BootstrapToggle } from '../proto-ui/components/react';

export function BootstrapToggleVariantsDemo() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <BootstrapToggle variant="default">Default</BootstrapToggle>
      <BootstrapToggle variant="primary" defaultActive>Primary</BootstrapToggle>
      <BootstrapToggle variant="success">Success</BootstrapToggle>
      <BootstrapToggle variant="info">Info</BootstrapToggle>
      <BootstrapToggle variant="warning">Warning</BootstrapToggle>
      <BootstrapToggle variant="danger">Danger</BootstrapToggle>
      <BootstrapToggle variant="inverse">Inverse</BootstrapToggle>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-toggle-with-text': formatCode(`
import { Bold, Italic, Underline } from 'lucide-react';
import { BootstrapToggle } from '../proto-ui/components/react';

export function BootstrapToggleWithTextDemo() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <BootstrapToggle>
        <Bold className="size-4 shrink-0 pointer-events-none" />
        Bold
      </BootstrapToggle>
      <BootstrapToggle defaultActive>
        <Italic className="size-4 shrink-0 pointer-events-none" />
        Italic
      </BootstrapToggle>
      <BootstrapToggle>
        <Underline className="size-4 shrink-0 pointer-events-none" />
        Underline
      </BootstrapToggle>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-toggle-sizes': formatCode(`
import { BootstrapToggle } from '../proto-ui/components/react';

export function BootstrapToggleSizesDemo() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <BootstrapToggle size="mini">Mini</BootstrapToggle>
      <BootstrapToggle size="small">Small</BootstrapToggle>
      <BootstrapToggle size="default" defaultActive>Default</BootstrapToggle>
      <BootstrapToggle size="large">Large</BootstrapToggle>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-toggle-disabled': formatCode(`
import { BootstrapToggle } from '../proto-ui/components/react';

export function BootstrapToggleDisabledDemo() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <BootstrapToggle disabled>Disabled</BootstrapToggle>
      <BootstrapToggle defaultActive disabled>Active Disabled</BootstrapToggle>
      <BootstrapToggle variant="primary" disabled>Primary Disabled</BootstrapToggle>
    </div>
  );
}
    `),
    'demo-liquid-glass-toggle': formatCode(`
import { LiquidGlassToggle } from '../proto-ui/components/react';

export function LiquidGlassToggleDemo() {
  return (
    <div className="flex flex-wrap items-center gap-8">
      <LiquidGlassToggle>Bold</LiquidGlassToggle>
      <LiquidGlassToggle defaultActive>Italic</LiquidGlassToggle>
      <LiquidGlassToggle material="opaque">Opaque</LiquidGlassToggle>
      <LiquidGlassToggle defaultActive disabled>Disabled</LiquidGlassToggle>
    </div>
  );
}
    `),
    'demo-liquid-glass-toggle-with-text': formatCode(`
import { Bold, Italic } from 'lucide-react';
import { LiquidGlassToggle } from '../proto-ui/components/react';

export function LiquidGlassToggleWithTextDemo() {
  return (
    <div className="flex flex-wrap items-center gap-8">
      <LiquidGlassToggle>
        <Bold className="size-4 shrink-0 pointer-events-none" />
        Bold
      </LiquidGlassToggle>
      <LiquidGlassToggle defaultActive>
        <Italic className="size-4 shrink-0 pointer-events-none" />
        Italic
      </LiquidGlassToggle>
    </div>
  );
}
    `),
    'demo-liquid-glass-toggle-sizes': formatCode(`
import { LiquidGlassToggle } from '../proto-ui/components/react';

export function LiquidGlassToggleSizesDemo() {
  return (
    <div className="flex flex-wrap items-center gap-8">
      <LiquidGlassToggle size="sm">Small</LiquidGlassToggle>
      <LiquidGlassToggle size="default" defaultActive>Default</LiquidGlassToggle>
      <LiquidGlassToggle size="lg">Large</LiquidGlassToggle>
    </div>
  );
}
    `),
    'demo-liquid-glass-toggle-material': formatCode(`
import { LiquidGlassToggle } from '../proto-ui/components/react';

export function LiquidGlassToggleMaterialDemo() {
  return (
    <div className="flex flex-wrap items-center gap-8">
      <LiquidGlassToggle material="auto">Auto Glass</LiquidGlassToggle>
      <LiquidGlassToggle material="auto" defaultActive>Auto Active</LiquidGlassToggle>
      <LiquidGlassToggle material="opaque">Opaque</LiquidGlassToggle>
      <LiquidGlassToggle material="opaque" defaultActive>Opaque Active</LiquidGlassToggle>
    </div>
  );
}
    `),
    'demo-liquid-glass-toggle-disabled': formatCode(`
import { LiquidGlassToggle } from '../proto-ui/components/react';

export function LiquidGlassToggleDisabledDemo() {
  return (
    <div className="flex flex-wrap items-center gap-8">
      <LiquidGlassToggle disabled>Disabled</LiquidGlassToggle>
      <LiquidGlassToggle defaultActive disabled>Active Disabled</LiquidGlassToggle>
    </div>
  );
}
    `),
  },
  vue: {
    'demo-shadcn-toggle': formatCode(`
<script setup lang="ts">
import { ShadcnToggle } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <ShadcnToggle styleProfile="rhea">
      <span aria-hidden="true">B</span><span class="sr-only">Bold</span>
    </ShadcnToggle>
    <ShadcnToggle styleProfile="rhea" variant="outline" :defaultActive="true">
      <span aria-hidden="true">I</span><span class="sr-only">Italic</span>
    </ShadcnToggle>
    <ShadcnToggle styleProfile="rhea" size="sm">
      <span aria-hidden="true">U</span><span class="sr-only">Underline</span>
    </ShadcnToggle>
    <ShadcnToggle styleProfile="rhea" :defaultActive="true" :disabled="true">
      <span aria-hidden="true">S</span><span class="sr-only">Strikethrough</span>
    </ShadcnToggle>
    <ShadcnToggle styleProfile="rhea" size="lg">Large</ShadcnToggle>
    <ShadcnToggle styleProfile="rhea" variant="outline">Outline</ShadcnToggle>
  </div>
</template>
    `),
    'demo-shadcn-toggle-outline': formatCode(`
<script setup lang="ts">
import { ShadcnToggle } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <ShadcnToggle styleProfile="rhea" variant="outline">Italic</ShadcnToggle>
    <ShadcnToggle styleProfile="rhea" variant="outline" :defaultActive="true">Bold</ShadcnToggle>
  </div>
</template>
    `),
    'demo-shadcn-toggle-with-text': formatCode(`
<script setup lang="ts">
import { ShadcnToggle } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <ShadcnToggle styleProfile="rhea">Italic</ShadcnToggle>
    <ShadcnToggle styleProfile="rhea" :defaultActive="true">Underline</ShadcnToggle>
  </div>
</template>
    `),
    'demo-shadcn-toggle-sizes': formatCode(`
<script setup lang="ts">
import { ShadcnToggle } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <ShadcnToggle styleProfile="rhea" variant="outline" size="sm">Small</ShadcnToggle>
    <ShadcnToggle styleProfile="rhea" variant="outline" size="default">Default</ShadcnToggle>
    <ShadcnToggle styleProfile="rhea" variant="outline" size="lg">Large</ShadcnToggle>
  </div>
</template>
    `),
    'demo-shadcn-toggle-disabled': formatCode(`
<script setup lang="ts">
import { ShadcnToggle } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <ShadcnToggle styleProfile="rhea" :disabled="true">Disabled</ShadcnToggle>
    <ShadcnToggle styleProfile="rhea" variant="outline" :disabled="true">Disabled</ShadcnToggle>
    <ShadcnToggle styleProfile="rhea" variant="outline" :defaultActive="true" :disabled="true">
      Active Disabled
    </ShadcnToggle>
  </div>
</template>
    `),
    'demo-shadcn-toggle-controlled': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import { ShadcnToggle } from '../proto-ui/components/vue';

const active = ref(true);
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <ShadcnToggle
      styleProfile="rhea"
      variant="outline"
      :active="active"
      @active-change="active = $event.active"
    >
      Bold
    </ShadcnToggle>
    <span class="text-sm text-muted-foreground" role="status" aria-live="polite">
      {{ active ? 'Bold: On' : 'Bold: Off' }}
    </span>
  </div>
</template>
    `),
    'demo-shadcn-toggle-rtl': formatCode(`
<script setup lang="ts">
import { ShadcnToggle } from '../proto-ui/components/vue';
</script>

<template>
  <div dir="rtl" class="flex flex-wrap items-center gap-2">
    <ShadcnToggle styleProfile="rhea" variant="outline" size="sm">غامق</ShadcnToggle>
    <ShadcnToggle styleProfile="rhea" variant="outline" size="sm" :defaultActive="true">مائل</ShadcnToggle>
  </div>
</template>
    `),
    'demo-brutalist-toggle': formatCode(`
<script setup lang="ts">
import { BrutalistToggle } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-4">
    <BrutalistToggle>Toggle</BrutalistToggle>
    <BrutalistToggle :defaultActive="true">Active</BrutalistToggle>
    <BrutalistToggle variant="outline">Outline</BrutalistToggle>
    <BrutalistToggle :disabled="true">Disabled</BrutalistToggle>
  </div>
</template>
    `),
    'demo-brutalist-toggle-outline': formatCode(`
<script setup lang="ts">
import { BrutalistToggle } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <BrutalistToggle variant="outline">Italic</BrutalistToggle>
    <BrutalistToggle variant="outline" :defaultActive="true">Bold</BrutalistToggle>
  </div>
</template>
    `),
    'demo-brutalist-toggle-with-text': formatCode(`
<script setup lang="ts">
import { BrutalistToggle } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <BrutalistToggle>Italic</BrutalistToggle>
    <BrutalistToggle :defaultActive="true">Underline</BrutalistToggle>
  </div>
</template>
    `),
    'demo-brutalist-toggle-sizes': formatCode(`
<script setup lang="ts">
import { BrutalistToggle } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <BrutalistToggle variant="outline" size="sm">Small</BrutalistToggle>
    <BrutalistToggle variant="outline" size="default">Default</BrutalistToggle>
    <BrutalistToggle variant="outline" size="lg">Large</BrutalistToggle>
  </div>
</template>
    `),
    'demo-brutalist-toggle-disabled': formatCode(`
<script setup lang="ts">
import { BrutalistToggle } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <BrutalistToggle :disabled="true">Disabled</BrutalistToggle>
    <BrutalistToggle variant="outline" :disabled="true">Disabled</BrutalistToggle>
    <BrutalistToggle :defaultActive="true" :disabled="true">Active Disabled</BrutalistToggle>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-toggle': formatCode(`
<script setup lang="ts">
import { BootstrapToggle } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <BootstrapToggle>Bold</BootstrapToggle>
    <BootstrapToggle :defaultActive="true">Italic</BootstrapToggle>
    <BootstrapToggle :defaultActive="true" :disabled="true">Unavailable</BootstrapToggle>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-toggle-variants': formatCode(`
<script setup lang="ts">
import { BootstrapToggle } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <BootstrapToggle variant="default">Default</BootstrapToggle>
    <BootstrapToggle variant="primary" :defaultActive="true">Primary</BootstrapToggle>
    <BootstrapToggle variant="success">Success</BootstrapToggle>
    <BootstrapToggle variant="info">Info</BootstrapToggle>
    <BootstrapToggle variant="warning">Warning</BootstrapToggle>
    <BootstrapToggle variant="danger">Danger</BootstrapToggle>
    <BootstrapToggle variant="inverse">Inverse</BootstrapToggle>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-toggle-with-text': formatCode(`
<script setup lang="ts">
import { BootstrapToggle } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <BootstrapToggle>Bold</BootstrapToggle>
    <BootstrapToggle :defaultActive="true">Italic</BootstrapToggle>
    <BootstrapToggle>Underline</BootstrapToggle>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-toggle-sizes': formatCode(`
<script setup lang="ts">
import { BootstrapToggle } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <BootstrapToggle size="mini">Mini</BootstrapToggle>
    <BootstrapToggle size="small">Small</BootstrapToggle>
    <BootstrapToggle size="default" :defaultActive="true">Default</BootstrapToggle>
    <BootstrapToggle size="large">Large</BootstrapToggle>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-toggle-disabled': formatCode(`
<script setup lang="ts">
import { BootstrapToggle } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <BootstrapToggle :disabled="true">Disabled</BootstrapToggle>
    <BootstrapToggle :defaultActive="true" :disabled="true">Active Disabled</BootstrapToggle>
    <BootstrapToggle variant="primary" :disabled="true">Primary Disabled</BootstrapToggle>
  </div>
</template>
    `),
    'demo-liquid-glass-toggle': formatCode(`
<script setup lang="ts">
import { LiquidGlassToggle } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-8">
    <LiquidGlassToggle>Bold</LiquidGlassToggle>
    <LiquidGlassToggle :defaultActive="true">Italic</LiquidGlassToggle>
    <LiquidGlassToggle material="opaque">Opaque</LiquidGlassToggle>
    <LiquidGlassToggle :defaultActive="true" :disabled="true">Disabled</LiquidGlassToggle>
  </div>
</template>
    `),
    'demo-liquid-glass-toggle-with-text': formatCode(`
<script setup lang="ts">
import { LiquidGlassToggle } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-8">
    <LiquidGlassToggle>Bold</LiquidGlassToggle>
    <LiquidGlassToggle :defaultActive="true">Italic</LiquidGlassToggle>
  </div>
</template>
    `),
    'demo-liquid-glass-toggle-sizes': formatCode(`
<script setup lang="ts">
import { LiquidGlassToggle } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-8">
    <LiquidGlassToggle size="sm">Small</LiquidGlassToggle>
    <LiquidGlassToggle size="default" :defaultActive="true">Default</LiquidGlassToggle>
    <LiquidGlassToggle size="lg">Large</LiquidGlassToggle>
  </div>
</template>
    `),
    'demo-liquid-glass-toggle-material': formatCode(`
<script setup lang="ts">
import { LiquidGlassToggle } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-8">
    <LiquidGlassToggle material="auto">Auto Glass</LiquidGlassToggle>
    <LiquidGlassToggle material="auto" :defaultActive="true">Auto Active</LiquidGlassToggle>
    <LiquidGlassToggle material="opaque">Opaque</LiquidGlassToggle>
    <LiquidGlassToggle material="opaque" :defaultActive="true">Opaque Active</LiquidGlassToggle>
  </div>
</template>
    `),
    'demo-liquid-glass-toggle-disabled': formatCode(`
<script setup lang="ts">
import { LiquidGlassToggle } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-8">
    <LiquidGlassToggle :disabled="true">Disabled</LiquidGlassToggle>
    <LiquidGlassToggle :defaultActive="true" :disabled="true">Active Disabled</LiquidGlassToggle>
  </div>
</template>
    `),
  },
  vue2: {
    'demo-shadcn-toggle': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-3">
    <ShadcnToggle styleProfile="rhea">
      <span aria-hidden="true">B</span><span class="sr-only">Bold</span>
    </ShadcnToggle>
    <ShadcnToggle styleProfile="rhea" variant="outline" :defaultActive="true">
      <span aria-hidden="true">I</span><span class="sr-only">Italic</span>
    </ShadcnToggle>
    <ShadcnToggle styleProfile="rhea" size="sm">
      <span aria-hidden="true">U</span><span class="sr-only">Underline</span>
    </ShadcnToggle>
    <ShadcnToggle styleProfile="rhea" :defaultActive="true" :disabled="true">
      <span aria-hidden="true">S</span><span class="sr-only">Strikethrough</span>
    </ShadcnToggle>
    <ShadcnToggle styleProfile="rhea" size="lg">Large</ShadcnToggle>
    <ShadcnToggle styleProfile="rhea" variant="outline">Outline</ShadcnToggle>
  </div>
</template>

<script>
import { ShadcnToggle } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnToggle },
};
</script>
    `),
    'demo-shadcn-toggle-outline': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-2">
    <ShadcnToggle styleProfile="rhea" variant="outline">Italic</ShadcnToggle>
    <ShadcnToggle styleProfile="rhea" variant="outline" :defaultActive="true">Bold</ShadcnToggle>
  </div>
</template>

<script>
import { ShadcnToggle } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnToggle },
};
</script>
    `),
    'demo-shadcn-toggle-with-text': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-2">
    <ShadcnToggle styleProfile="rhea">Italic</ShadcnToggle>
    <ShadcnToggle styleProfile="rhea" :defaultActive="true">Underline</ShadcnToggle>
  </div>
</template>

<script>
import { ShadcnToggle } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnToggle },
};
</script>
    `),
    'demo-shadcn-toggle-sizes': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-2">
    <ShadcnToggle styleProfile="rhea" variant="outline" size="sm">Small</ShadcnToggle>
    <ShadcnToggle styleProfile="rhea" variant="outline" size="default">Default</ShadcnToggle>
    <ShadcnToggle styleProfile="rhea" variant="outline" size="lg">Large</ShadcnToggle>
  </div>
</template>

<script>
import { ShadcnToggle } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnToggle },
};
</script>
    `),
    'demo-shadcn-toggle-disabled': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-2">
    <ShadcnToggle styleProfile="rhea" :disabled="true">Disabled</ShadcnToggle>
    <ShadcnToggle styleProfile="rhea" variant="outline" :disabled="true">Disabled</ShadcnToggle>
    <ShadcnToggle styleProfile="rhea" variant="outline" :defaultActive="true" :disabled="true">
      Active Disabled
    </ShadcnToggle>
  </div>
</template>

<script>
import { ShadcnToggle } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnToggle },
};
</script>
    `),
    'demo-shadcn-toggle-controlled': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-3">
    <ShadcnToggle
      styleProfile="rhea"
      variant="outline"
      :active="active"
      @activeChange="active = $event.active"
    >
      Bold
    </ShadcnToggle>
    <span class="text-sm text-muted-foreground" role="status" aria-live="polite">
      {{ active ? 'Bold: On' : 'Bold: Off' }}
    </span>
  </div>
</template>

<script>
import { ShadcnToggle } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnToggle },
  data() {
    return { active: true };
  },
};
</script>
    `),
    'demo-shadcn-toggle-rtl': formatCode(`
<template>
  <div dir="rtl" class="flex flex-wrap items-center gap-2">
    <ShadcnToggle styleProfile="rhea" variant="outline" size="sm">غامق</ShadcnToggle>
    <ShadcnToggle styleProfile="rhea" variant="outline" size="sm" :defaultActive="true">مائل</ShadcnToggle>
  </div>
</template>

<script>
import { ShadcnToggle } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnToggle },
};
</script>
    `),
    'demo-brutalist-toggle': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-4">
    <BrutalistToggle>Toggle</BrutalistToggle>
    <BrutalistToggle :defaultActive="true">Active</BrutalistToggle>
    <BrutalistToggle variant="outline">Outline</BrutalistToggle>
    <BrutalistToggle :disabled="true">Disabled</BrutalistToggle>
  </div>
</template>

<script>
import { BrutalistToggle } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistToggle },
};
</script>
    `),
    'demo-brutalist-toggle-outline': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-3">
    <BrutalistToggle variant="outline">Italic</BrutalistToggle>
    <BrutalistToggle variant="outline" :defaultActive="true">Bold</BrutalistToggle>
  </div>
</template>

<script>
import { BrutalistToggle } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistToggle },
};
</script>
    `),
    'demo-brutalist-toggle-with-text': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-3">
    <BrutalistToggle>Italic</BrutalistToggle>
    <BrutalistToggle :defaultActive="true">Underline</BrutalistToggle>
  </div>
</template>

<script>
import { BrutalistToggle } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistToggle },
};
</script>
    `),
    'demo-brutalist-toggle-sizes': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-3">
    <BrutalistToggle variant="outline" size="sm">Small</BrutalistToggle>
    <BrutalistToggle variant="outline" size="default">Default</BrutalistToggle>
    <BrutalistToggle variant="outline" size="lg">Large</BrutalistToggle>
  </div>
</template>

<script>
import { BrutalistToggle } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistToggle },
};
</script>
    `),
    'demo-brutalist-toggle-disabled': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-3">
    <BrutalistToggle :disabled="true">Disabled</BrutalistToggle>
    <BrutalistToggle variant="outline" :disabled="true">Disabled</BrutalistToggle>
    <BrutalistToggle :defaultActive="true" :disabled="true">Active Disabled</BrutalistToggle>
  </div>
</template>

<script>
import { BrutalistToggle } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistToggle },
};
</script>
    `),
    'demo-bootstrap-2-3-2-toggle': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-3">
    <BootstrapToggle>Bold</BootstrapToggle>
    <BootstrapToggle :defaultActive="true">Italic</BootstrapToggle>
    <BootstrapToggle :defaultActive="true" :disabled="true">Unavailable</BootstrapToggle>
  </div>
</template>

<script>
import { BootstrapToggle } from '../proto-ui/components/vue2';

export default {
  components: { BootstrapToggle },
};
</script>
    `),
    'demo-bootstrap-2-3-2-toggle-variants': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-2">
    <BootstrapToggle variant="default">Default</BootstrapToggle>
    <BootstrapToggle variant="primary" :defaultActive="true">Primary</BootstrapToggle>
    <BootstrapToggle variant="success">Success</BootstrapToggle>
    <BootstrapToggle variant="info">Info</BootstrapToggle>
    <BootstrapToggle variant="warning">Warning</BootstrapToggle>
    <BootstrapToggle variant="danger">Danger</BootstrapToggle>
    <BootstrapToggle variant="inverse">Inverse</BootstrapToggle>
  </div>
</template>

<script>
import { BootstrapToggle } from '../proto-ui/components/vue2';

export default {
  components: { BootstrapToggle },
};
</script>
    `),
    'demo-bootstrap-2-3-2-toggle-with-text': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-2">
    <BootstrapToggle>Bold</BootstrapToggle>
    <BootstrapToggle :defaultActive="true">Italic</BootstrapToggle>
    <BootstrapToggle>Underline</BootstrapToggle>
  </div>
</template>

<script>
import { BootstrapToggle } from '../proto-ui/components/vue2';

export default {
  components: { BootstrapToggle },
};
</script>
    `),
    'demo-bootstrap-2-3-2-toggle-sizes': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-2">
    <BootstrapToggle size="mini">Mini</BootstrapToggle>
    <BootstrapToggle size="small">Small</BootstrapToggle>
    <BootstrapToggle size="default" :defaultActive="true">Default</BootstrapToggle>
    <BootstrapToggle size="large">Large</BootstrapToggle>
  </div>
</template>

<script>
import { BootstrapToggle } from '../proto-ui/components/vue2';

export default {
  components: { BootstrapToggle },
};
</script>
    `),
    'demo-bootstrap-2-3-2-toggle-disabled': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-2">
    <BootstrapToggle :disabled="true">Disabled</BootstrapToggle>
    <BootstrapToggle :defaultActive="true" :disabled="true">Active Disabled</BootstrapToggle>
    <BootstrapToggle variant="primary" :disabled="true">Primary Disabled</BootstrapToggle>
  </div>
</template>

<script>
import { BootstrapToggle } from '../proto-ui/components/vue2';

export default {
  components: { BootstrapToggle },
};
</script>
    `),
    'demo-liquid-glass-toggle': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-8">
    <LiquidGlassToggle>Bold</LiquidGlassToggle>
    <LiquidGlassToggle :defaultActive="true">Italic</LiquidGlassToggle>
    <LiquidGlassToggle material="opaque">Opaque</LiquidGlassToggle>
    <LiquidGlassToggle :defaultActive="true" :disabled="true">Disabled</LiquidGlassToggle>
  </div>
</template>

<script>
import { LiquidGlassToggle } from '../proto-ui/components/vue2';

export default {
  components: { LiquidGlassToggle },
};
</script>
    `),
    'demo-liquid-glass-toggle-with-text': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-8">
    <LiquidGlassToggle>Bold</LiquidGlassToggle>
    <LiquidGlassToggle :defaultActive="true">Italic</LiquidGlassToggle>
  </div>
</template>

<script>
import { LiquidGlassToggle } from '../proto-ui/components/vue2';

export default {
  components: { LiquidGlassToggle },
};
</script>
    `),
    'demo-liquid-glass-toggle-sizes': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-8">
    <LiquidGlassToggle size="sm">Small</LiquidGlassToggle>
    <LiquidGlassToggle size="default" :defaultActive="true">Default</LiquidGlassToggle>
    <LiquidGlassToggle size="lg">Large</LiquidGlassToggle>
  </div>
</template>

<script>
import { LiquidGlassToggle } from '../proto-ui/components/vue2';

export default {
  components: { LiquidGlassToggle },
};
</script>
    `),
    'demo-liquid-glass-toggle-material': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-8">
    <LiquidGlassToggle material="auto">Auto Glass</LiquidGlassToggle>
    <LiquidGlassToggle material="auto" :defaultActive="true">Auto Active</LiquidGlassToggle>
    <LiquidGlassToggle material="opaque">Opaque</LiquidGlassToggle>
    <LiquidGlassToggle material="opaque" :defaultActive="true">Opaque Active</LiquidGlassToggle>
  </div>
</template>

<script>
import { LiquidGlassToggle } from '../proto-ui/components/vue2';

export default {
  components: { LiquidGlassToggle },
};
</script>
    `),
    'demo-liquid-glass-toggle-disabled': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-8">
    <LiquidGlassToggle :disabled="true">Disabled</LiquidGlassToggle>
    <LiquidGlassToggle :defaultActive="true" :disabled="true">Active Disabled</LiquidGlassToggle>
  </div>
</template>

<script>
import { LiquidGlassToggle } from '../proto-ui/components/vue2';

export default {
  components: { LiquidGlassToggle },
};
</script>
    `),
  },
};
