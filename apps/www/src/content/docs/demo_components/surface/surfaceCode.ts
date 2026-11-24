import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-surface': formatCode(`
<div class="flex max-w-lg flex-col gap-3">
  <shadcn-surface-root variant="outline" radius="lg">
    <div class="flex items-center justify-between gap-4 p-4">
      <div>
        <div class="text-sm font-medium">Workspace Sync</div>
        <div class="text-xs opacity-75">Automatically backs up changes across devices.</div>
      </div>
      <shadcn-surface-root variant="secondary" radius="full" border="none">
        <div class="px-2.5 py-0.5 text-xs font-medium">Active</div>
      </shadcn-surface-root>
    </div>
  </shadcn-surface-root>
  <shadcn-surface-root variant="muted" radius="md" border="none">
    <div class="px-4 py-3 text-sm">Draft saved locally. Publish when ready to share with your team.</div>
  </shadcn-surface-root>
  <div class="flex flex-wrap items-center gap-3">
    <shadcn-surface-root variant="solid" radius="md" focus-visible>
      <div class="px-4 py-2 text-sm font-medium">Publish Release</div>
    </shadcn-surface-root>
    <shadcn-surface-root variant="accent" radius="md" elevation="raised">
      <div class="px-4 py-2 text-sm font-medium">Elevated Callout</div>
    </shadcn-surface-root>
  </div>
</div>
    `),
    'demo-shadcn-surface-variants': formatCode(`
<div class="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
  <shadcn-surface-root variant="outline" radius="md"><div class="p-3 text-sm">outline</div></shadcn-surface-root>
  <shadcn-surface-root variant="secondary" radius="md"><div class="p-3 text-sm">secondary</div></shadcn-surface-root>
  <shadcn-surface-root variant="muted" radius="md" border="none"><div class="p-3 text-sm">muted</div></shadcn-surface-root>
  <shadcn-surface-root variant="accent" radius="md"><div class="p-3 text-sm">accent</div></shadcn-surface-root>
  <shadcn-surface-root variant="solid" radius="md" border="none"><div class="p-3 text-sm font-medium">solid</div></shadcn-surface-root>
  <shadcn-surface-root variant="transparent" radius="md"><div class="p-3 text-sm">transparent</div></shadcn-surface-root>
  <shadcn-surface-root variant="scrim" radius="sm" border="none" class="sm:col-span-2">
    <div class="px-3 py-2 text-xs font-medium text-white">scrim — 80% black backdrop</div>
  </shadcn-surface-root>
</div>
    `),
    'demo-shadcn-surface-geometry': formatCode(`
<div class="flex flex-col gap-4">
  <div class="flex flex-wrap gap-2">
    <shadcn-surface-root variant="outline" radius="none"><div class="px-3 py-1.5 text-xs">none</div></shadcn-surface-root>
    <shadcn-surface-root variant="outline" radius="sm"><div class="px-3 py-1.5 text-xs">sm</div></shadcn-surface-root>
    <shadcn-surface-root variant="outline" radius="md"><div class="px-3 py-1.5 text-xs">md</div></shadcn-surface-root>
    <shadcn-surface-root variant="outline" radius="lg"><div class="px-3 py-1.5 text-xs">lg</div></shadcn-surface-root>
    <shadcn-surface-root variant="outline" radius="xl"><div class="px-3 py-1.5 text-xs">xl</div></shadcn-surface-root>
    <shadcn-surface-root variant="outline" radius="full"><div class="px-3 py-1.5 text-xs">full</div></shadcn-surface-root>
  </div>
  <div class="grid grid-cols-3 gap-3">
    <shadcn-surface-root variant="outline" radius="md" border="all"><div class="p-3 text-xs">border="all"</div></shadcn-surface-root>
    <shadcn-surface-root variant="transparent" radius="none" border="bottom"><div class="p-3 text-xs">border="bottom"</div></shadcn-surface-root>
    <shadcn-surface-root variant="muted" radius="md" border="none" elevation="raised"><div class="p-3 text-xs">raised</div></shadcn-surface-root>
  </div>
</div>
    `),
    'demo-shadcn-surface-states': formatCode(`
<div class="flex flex-col gap-3">
  <shadcn-surface-root variant="outline" radius="md" hovered><div class="p-3 text-sm">Hovered item</div></shadcn-surface-root>
  <shadcn-surface-root variant="transparent" radius="md" border="none" current><div class="p-3 text-sm">Current nav item</div></shadcn-surface-root>
  <shadcn-surface-root variant="outline" radius="md" focus-visible><div class="p-3 text-sm">Keyboard focus ring</div></shadcn-surface-root>
  <shadcn-surface-root variant="solid" action-profile="rhea" pressed>
    <div class="p-3">
      <shadcn-text-root tone="inherit" size="sm" weight="medium">Pressed Rhea action · inherited text</shadcn-text-root>
    </div>
  </shadcn-surface-root>
</div>
    `),
    'demo-shadcn-surface-action-profiles': formatCode(`
<div class="flex flex-col gap-3">
  <div class="flex flex-wrap gap-2">
    <shadcn-surface-root action-profile="rhea" variant="solid"><div class="px-3 py-1.5 text-xs">Rhea Primary</div></shadcn-surface-root>
    <shadcn-surface-root action-profile="luma" variant="secondary"><div class="px-3 py-1.5 text-xs">Luma Secondary</div></shadcn-surface-root>
    <shadcn-surface-root action-profile="nova" variant="outline"><div class="px-3 py-1.5 text-xs">Nova Outline</div></shadcn-surface-root>
    <shadcn-surface-root action-profile="lyra" variant="outline"><div class="px-3 py-1.5 text-xs">Lyra Sharp</div></shadcn-surface-root>
    <shadcn-surface-root action-profile="new-york-v4" variant="outline" focus-visible><div class="px-3 py-1.5 text-xs">New York Focused</div></shadcn-surface-root>
  </div>
</div>
    `),
    'demo-shadcn-surface-fade': formatCode(`
<shadcn-surface-root
  id="fade-scrim"
  variant="scrim"
  radius="md"
  border="none"
  fade
  transition-state="entered"
  style="--pui-surface-transition-duration: 240ms"
>
  <div class="p-4 text-sm font-medium text-white">Transition-driven scrim surface (240ms)</div>
</shadcn-surface-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const scrim = document.querySelector('#fade-scrim');
  setElementProps(scrim, { fade: true, transitionState: 'leaving' });
</script>
    `),
    'demo-brutalist-surface': formatCode(`
<div class="flex max-w-lg flex-col gap-4">
  <brutalist-surface-root variant="outline">
    <div class="p-4 text-sm font-bold">Project Overview</div>
  </brutalist-surface-root>
  <brutalist-surface-root variant="secondary">
    <div class="p-4 text-sm font-medium">Secondary neutral panel</div>
  </brutalist-surface-root>
  <div class="flex flex-wrap gap-4">
    <brutalist-surface-root variant="solid" elevation="raised">
      <div class="px-4 py-2 text-sm font-bold">Raised Action</div>
    </brutalist-surface-root>
    <brutalist-surface-root variant="accent" elevation="raised" pressed>
      <div class="px-4 py-2 text-sm font-bold">Pressed Snap</div>
    </brutalist-surface-root>
  </div>
</div>
    `),
    'demo-brutalist-surface-variants': formatCode(`
<div class="grid max-w-xl grid-cols-2 gap-3">
  <brutalist-surface-root variant="outline"><div class="p-3 text-sm">outline</div></brutalist-surface-root>
  <brutalist-surface-root variant="secondary"><div class="p-3 text-sm">secondary</div></brutalist-surface-root>
  <brutalist-surface-root variant="muted"><div class="p-3 text-sm">muted</div></brutalist-surface-root>
  <brutalist-surface-root variant="accent"><div class="p-3 text-sm font-bold">accent (canary)</div></brutalist-surface-root>
  <brutalist-surface-root variant="solid"><div class="p-3 text-sm font-bold">solid (main)</div></brutalist-surface-root>
  <brutalist-surface-root variant="transparent"><div class="p-3 text-sm">transparent</div></brutalist-surface-root>
</div>
    `),
    'demo-brutalist-surface-geometry': formatCode(`
<div class="flex flex-col gap-4">
  <div class="flex flex-wrap gap-3">
    <brutalist-surface-root variant="secondary" radius="default"><div class="px-3 py-1.5 text-xs">default (5px)</div></brutalist-surface-root>
    <brutalist-surface-root variant="secondary" radius="none"><div class="px-3 py-1.5 text-xs">none</div></brutalist-surface-root>
    <brutalist-surface-root variant="secondary" radius="full"><div class="px-3 py-1.5 text-xs">full</div></brutalist-surface-root>
  </div>
  <div class="flex flex-wrap gap-4">
    <brutalist-surface-root variant="solid" elevation="raised"><div class="px-4 py-2 text-xs font-bold">Raised · rest</div></brutalist-surface-root>
    <brutalist-surface-root variant="solid" elevation="raised" pressed><div class="px-4 py-2 text-xs font-bold">Raised · pressed</div></brutalist-surface-root>
  </div>
</div>
    `),
    'demo-brutalist-surface-composition': formatCode(`
<brutalist-surface-root variant="solid" elevation="raised">
  <div class="flex flex-col gap-1 p-4">
    <brutalist-text-root tone="inherit" size="sm" weight="bold">Inherited foreground contrast</brutalist-text-root>
    <brutalist-text-root tone="inherit" size="xs">Text with tone="inherit" adapts inside solid shells.</brutalist-text-root>
  </div>
</brutalist-surface-root>
    `),
    'demo-bootstrap-2-3-2-surface': formatCode(`
<div class="flex max-w-lg flex-col gap-4">
  <div class="flex items-center gap-2 rounded-[4px] bg-[#0044cc] px-3 py-2">
    <bootstrap-2-3-2-surface-root variant="transparent" color-context="navbar" border="none" current>
      <div class="px-3 py-1.5 text-sm">Overview</div>
    </bootstrap-2-3-2-surface-root>
    <bootstrap-2-3-2-surface-root variant="transparent" color-context="navbar" border="none" hovered>
      <div class="px-3 py-1.5 text-sm">Components</div>
    </bootstrap-2-3-2-surface-root>
  </div>
  <bootstrap-2-3-2-surface-root variant="outline" elevation="raised">
    <div class="p-4 text-sm">Thumbnail frame</div>
  </bootstrap-2-3-2-surface-root>
  <div class="flex gap-3">
    <bootstrap-2-3-2-surface-root variant="solid" action-profile="button">Primary Action</bootstrap-2-3-2-surface-root>
    <bootstrap-2-3-2-surface-root variant="secondary" action-profile="button">Default Action</bootstrap-2-3-2-surface-root>
  </div>
</div>
    `),
    'demo-bootstrap-2-3-2-surface-variants': formatCode(`
<div class="grid max-w-xl grid-cols-2 gap-3">
  <bootstrap-2-3-2-surface-root variant="outline"><div class="p-3 text-sm">outline</div></bootstrap-2-3-2-surface-root>
  <bootstrap-2-3-2-surface-root variant="outline" elevation="raised"><div class="p-3 text-sm">outline + raised</div></bootstrap-2-3-2-surface-root>
  <bootstrap-2-3-2-surface-root variant="secondary"><div class="p-3 text-sm">secondary</div></bootstrap-2-3-2-surface-root>
  <bootstrap-2-3-2-surface-root variant="muted"><div class="p-3 text-sm">muted</div></bootstrap-2-3-2-surface-root>
  <bootstrap-2-3-2-surface-root variant="accent"><div class="p-3 text-sm">accent</div></bootstrap-2-3-2-surface-root>
  <bootstrap-2-3-2-surface-root variant="solid" elevation="raised"><div class="p-3 text-sm">solid</div></bootstrap-2-3-2-surface-root>
</div>
    `),
    'demo-bootstrap-2-3-2-surface-navbar': formatCode(`
<div class="flex flex-wrap items-center gap-2 rounded-[4px] bg-[#0044cc] px-4 py-2.5">
  <bootstrap-2-3-2-surface-root variant="transparent" color-context="navbar" border="none"><div class="px-3 py-1.5 text-sm">Rest</div></bootstrap-2-3-2-surface-root>
  <bootstrap-2-3-2-surface-root variant="transparent" color-context="navbar" border="none" hovered><div class="px-3 py-1.5 text-sm">Hovered</div></bootstrap-2-3-2-surface-root>
  <bootstrap-2-3-2-surface-root variant="transparent" color-context="navbar" border="none" current><div class="px-3 py-1.5 text-sm">Current</div></bootstrap-2-3-2-surface-root>
  <bootstrap-2-3-2-surface-root variant="transparent" color-context="navbar" border="none" focus-visible><div class="px-3 py-1.5 text-sm">Focused</div></bootstrap-2-3-2-surface-root>
</div>
    `),
    'demo-bootstrap-2-3-2-surface-action': formatCode(`
<div class="flex flex-wrap items-center gap-3">
  <bootstrap-2-3-2-surface-root action-profile="button" variant="secondary">Default .btn</bootstrap-2-3-2-surface-root>
  <bootstrap-2-3-2-surface-root action-profile="button" variant="secondary" hovered>Hovered .btn</bootstrap-2-3-2-surface-root>
  <bootstrap-2-3-2-surface-root action-profile="button" variant="solid">Primary</bootstrap-2-3-2-surface-root>
  <bootstrap-2-3-2-surface-root action-profile="button" variant="solid" pressed>Pressed Primary</bootstrap-2-3-2-surface-root>
</div>
    `),
    'demo-liquid-glass-surface': formatCode(`
<div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
  <liquid-glass-surface-root variant="outline" material="auto" radius="default" elevation="raised">
    <div class="flex flex-col gap-2 p-1">
      <div class="px-3 pt-2 text-xs font-semibold opacity-75">Floating Glass Shell</div>
      <liquid-glass-surface-root variant="secondary" material="opaque" radius="lg" border="none">
        <div class="p-3 text-sm">Opaque content card with concentric corners (12px outer = 8px inner + 4px padding).</div>
      </liquid-glass-surface-root>
    </div>
  </liquid-glass-surface-root>
</div>
    `),
    'demo-liquid-glass-surface-material': formatCode(`
<div class="grid grid-cols-2 gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
  <liquid-glass-surface-root variant="outline" material="auto" radius="xl" elevation="raised">
    <div class="p-4 text-sm">material="auto" · outline</div>
  </liquid-glass-surface-root>
  <liquid-glass-surface-root variant="secondary" material="auto" radius="xl">
    <div class="p-4 text-sm">material="auto" · secondary</div>
  </liquid-glass-surface-root>
  <liquid-glass-surface-root variant="muted" material="auto" radius="xl">
    <div class="p-4 text-sm">material="auto" · muted</div>
  </liquid-glass-surface-root>
  <liquid-glass-surface-root variant="outline" material="opaque" radius="xl">
    <div class="p-4 text-sm">material="opaque" (default)</div>
  </liquid-glass-surface-root>
</div>
    `),
    'demo-liquid-glass-surface-variants': formatCode(`
<div class="grid max-w-xl grid-cols-2 gap-3">
  <liquid-glass-surface-root variant="outline"><div class="p-3 text-sm">outline</div></liquid-glass-surface-root>
  <liquid-glass-surface-root variant="secondary"><div class="p-3 text-sm">secondary</div></liquid-glass-surface-root>
  <liquid-glass-surface-root variant="muted" border="none"><div class="p-3 text-sm">muted</div></liquid-glass-surface-root>
  <liquid-glass-surface-root variant="solid" border="none">
    <div class="p-3"><liquid-glass-text-root tone="inherit" size="sm">solid + inherited text</liquid-glass-text-root></div>
  </liquid-glass-surface-root>
</div>
    `),
    'demo-liquid-glass-surface-states': formatCode(`
<div class="grid grid-cols-2 gap-3 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
  <liquid-glass-surface-root variant="outline" material="auto" hovered><div class="p-3 text-sm">Glass · hovered</div></liquid-glass-surface-root>
  <liquid-glass-surface-root variant="outline" material="auto" pressed><div class="p-3 text-sm">Glass · pressed</div></liquid-glass-surface-root>
  <liquid-glass-surface-root variant="outline" material="auto" focus-visible><div class="p-3 text-sm">Glass · focused</div></liquid-glass-surface-root>
  <liquid-glass-surface-root variant="outline" material="opaque" current><div class="p-3 text-sm">Opaque · current</div></liquid-glass-surface-root>
</div>
    `),
  },
  react: {
    'demo-shadcn-surface': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { surfaceRoot } from '@proto.ui/prototypes-shadcn/surface';

const Surface = createReactAdapter(React)(surfaceRoot);

export function SurfaceOverview() {
  return (
    <div className="flex max-w-lg flex-col gap-3">
      <Surface variant="outline" radius="lg">
        <div className="flex items-center justify-between gap-4 p-4">
          <div>
            <div className="text-sm font-medium">Workspace Sync</div>
            <div className="text-xs opacity-75">Automatically backs up changes across devices.</div>
          </div>
          <Surface variant="secondary" radius="full" border="none">
            <div className="px-2.5 py-0.5 text-xs font-medium">Active</div>
          </Surface>
        </div>
      </Surface>
      <Surface variant="muted" radius="md" border="none">
        <div className="px-4 py-3 text-sm">Draft saved locally. Publish when ready to share.</div>
      </Surface>
      <div className="flex flex-wrap items-center gap-3">
        <Surface variant="solid" radius="md" focusVisible>
          <div className="px-4 py-2 text-sm font-medium">Publish Release</div>
        </Surface>
        <Surface variant="accent" radius="md" elevation="raised">
          <div className="px-4 py-2 text-sm font-medium">Elevated Callout</div>
        </Surface>
      </div>
    </div>
  );
}
    `),
    'demo-shadcn-surface-variants': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { surfaceRoot } from '@proto.ui/prototypes-shadcn/surface';

const Surface = createReactAdapter(React)(surfaceRoot);

export function SurfaceVariants() {
  return (
    <div className="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
      <Surface variant="outline" radius="md"><div className="p-3 text-sm">outline</div></Surface>
      <Surface variant="secondary" radius="md"><div className="p-3 text-sm">secondary</div></Surface>
      <Surface variant="muted" radius="md" border="none"><div className="p-3 text-sm">muted</div></Surface>
      <Surface variant="accent" radius="md"><div className="p-3 text-sm">accent</div></Surface>
      <Surface variant="solid" radius="md" border="none"><div className="p-3 text-sm font-medium">solid</div></Surface>
      <Surface variant="transparent" radius="md"><div className="p-3 text-sm">transparent</div></Surface>
      <Surface variant="scrim" radius="sm" border="none" className="sm:col-span-2">
        <div className="px-3 py-2 text-xs font-medium text-white">scrim — 80% black backdrop</div>
      </Surface>
    </div>
  );
}
    `),
    'demo-shadcn-surface-geometry': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { surfaceRoot } from '@proto.ui/prototypes-shadcn/surface';

const Surface = createReactAdapter(React)(surfaceRoot);

export function SurfaceGeometry() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {(['none', 'sm', 'md', 'lg', 'xl', 'full'] as const).map((radius) => (
          <Surface key={radius} variant="outline" radius={radius}>
            <div className="px-3 py-1.5 text-xs font-medium">radius="{radius}"</div>
          </Surface>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Surface variant="outline" radius="md" border="all"><div className="p-3 text-xs">border="all"</div></Surface>
        <Surface variant="transparent" radius="none" border="bottom"><div className="p-3 text-xs">border="bottom"</div></Surface>
        <Surface variant="muted" radius="md" border="none" elevation="raised"><div className="p-3 text-xs">raised</div></Surface>
      </div>
    </div>
  );
}
    `),
    'demo-shadcn-surface-states': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { surfaceRoot } from '@proto.ui/prototypes-shadcn/surface';
import { textRoot } from '@proto.ui/prototypes-shadcn/text';

const Surface = createReactAdapter(React)(surfaceRoot);
const Text = createReactAdapter(React)(textRoot);

export function SurfaceStates() {
  return (
    <div className="flex flex-col gap-3">
      <Surface variant="outline" radius="md" hovered><div className="p-3 text-sm">Hovered item</div></Surface>
      <Surface variant="transparent" radius="md" border="none" current><div className="p-3 text-sm">Current nav item</div></Surface>
      <Surface variant="outline" radius="md" focusVisible><div className="p-3 text-sm">Keyboard focus ring</div></Surface>
      <Surface variant="solid" actionProfile="rhea" pressed>
        <div className="p-3">
          <Text tone="inherit" size="sm" weight="medium">Pressed Rhea action · inherited text</Text>
        </div>
      </Surface>
    </div>
  );
}
    `),
    'demo-shadcn-surface-action-profiles': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { surfaceRoot } from '@proto.ui/prototypes-shadcn/surface';

const Surface = createReactAdapter(React)(surfaceRoot);

export function SurfaceActionProfiles() {
  const profiles = ['rhea', 'luma', 'nova', 'lyra', 'new-york-v4'] as const;
  return (
    <div className="flex flex-col gap-3">
      {profiles.map((profile) => (
        <div key={profile} className="flex flex-wrap items-center gap-2">
          <span className="w-28 font-mono text-xs opacity-75">{profile}</span>
          <Surface actionProfile={profile} variant="solid"><div className="px-3 py-1.5 text-xs">Primary</div></Surface>
          <Surface actionProfile={profile} variant="secondary"><div className="px-3 py-1.5 text-xs">Secondary</div></Surface>
          <Surface actionProfile={profile} variant="outline"><div className="px-3 py-1.5 text-xs">Outline</div></Surface>
        </div>
      ))}
    </div>
  );
}
    `),
    'demo-shadcn-surface-fade': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { surfaceRoot } from '@proto.ui/prototypes-shadcn/surface';

const Surface = createReactAdapter(React)(surfaceRoot);

export function SurfaceFade() {
  const [phase, setPhase] = React.useState<'entered' | 'leaving'>('entered');
  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={() => setPhase(phase === 'entered' ? 'leaving' : 'entered')}>
        Toggle Fade
      </button>
      <div style={{ '--pui-surface-transition-duration': '240ms' } as React.CSSProperties}>
        <Surface variant="scrim" radius="md" border="none" fade transitionState={phase}>
          <div className="p-4 text-sm font-medium text-white">Transition-driven scrim surface (240ms)</div>
        </Surface>
      </div>
    </div>
  );
}
    `),
    'demo-brutalist-surface': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { surfaceRoot } from '@proto.ui/prototypes-brutalist/surface';

const Surface = createReactAdapter(React)(surfaceRoot);

export function BrutalistSurfaceDemo() {
  return (
    <div className="flex max-w-lg flex-col gap-4">
      <Surface variant="outline"><div className="p-4 text-sm font-bold">Project Overview</div></Surface>
      <Surface variant="secondary"><div className="p-4 text-sm font-medium">Secondary neutral panel</div></Surface>
      <div className="flex flex-wrap gap-4">
        <Surface variant="solid" elevation="raised"><div className="px-4 py-2 text-sm font-bold">Raised Action</div></Surface>
        <Surface variant="accent" elevation="raised" pressed><div className="px-4 py-2 text-sm font-bold">Pressed Snap</div></Surface>
      </div>
    </div>
  );
}
    `),
    'demo-brutalist-surface-variants': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { surfaceRoot } from '@proto.ui/prototypes-brutalist/surface';

const Surface = createReactAdapter(React)(surfaceRoot);

export function BrutalistSurfaceVariants() {
  return (
    <div className="grid max-w-xl grid-cols-2 gap-3">
      <Surface variant="outline"><div className="p-3 text-sm">outline</div></Surface>
      <Surface variant="secondary"><div className="p-3 text-sm">secondary</div></Surface>
      <Surface variant="muted"><div className="p-3 text-sm">muted</div></Surface>
      <Surface variant="accent"><div className="p-3 text-sm font-bold">accent (canary)</div></Surface>
      <Surface variant="solid"><div className="p-3 text-sm font-bold">solid (main)</div></Surface>
      <Surface variant="transparent"><div className="p-3 text-sm">transparent</div></Surface>
    </div>
  );
}
    `),
    'demo-brutalist-surface-geometry': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { surfaceRoot } from '@proto.ui/prototypes-brutalist/surface';

const Surface = createReactAdapter(React)(surfaceRoot);

export function BrutalistSurfaceGeometry() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <Surface variant="secondary" radius="default"><div className="px-3 py-1.5 text-xs">default (5px)</div></Surface>
        <Surface variant="secondary" radius="none"><div className="px-3 py-1.5 text-xs">none</div></Surface>
        <Surface variant="secondary" radius="full"><div className="px-3 py-1.5 text-xs">full</div></Surface>
      </div>
      <div className="flex flex-wrap gap-4">
        <Surface variant="solid" elevation="raised"><div className="px-4 py-2 text-xs font-bold">Raised · rest</div></Surface>
        <Surface variant="solid" elevation="raised" pressed><div className="px-4 py-2 text-xs font-bold">Raised · pressed</div></Surface>
      </div>
    </div>
  );
}
    `),
    'demo-brutalist-surface-composition': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { surfaceRoot } from '@proto.ui/prototypes-brutalist/surface';
import { textRoot } from '@proto.ui/prototypes-brutalist/text';

const Surface = createReactAdapter(React)(surfaceRoot);
const Text = createReactAdapter(React)(textRoot);

export function BrutalistSurfaceComposition() {
  return (
    <Surface variant="solid" elevation="raised">
      <div className="flex flex-col gap-1 p-4">
        <Text tone="inherit" size="sm" weight="bold">Inherited foreground contrast</Text>
        <Text tone="inherit" size="xs">Text with tone="inherit" adapts inside solid shells.</Text>
      </div>
    </Surface>
  );
}
    `),
    'demo-bootstrap-2-3-2-surface': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { surfaceRoot } from '@proto.ui/prototypes-bootstrap-2-3-2/surface';

const Surface = createReactAdapter(React)(surfaceRoot);

export function BootstrapSurfaceDemo() {
  return (
    <div className="flex max-w-lg flex-col gap-4">
      <div className="flex items-center gap-2 rounded-[4px] bg-[#0044cc] px-3 py-2">
        <Surface variant="transparent" colorContext="navbar" border="none" current>
          <div className="px-3 py-1.5 text-sm">Overview</div>
        </Surface>
        <Surface variant="transparent" colorContext="navbar" border="none" hovered>
          <div className="px-3 py-1.5 text-sm">Components</div>
        </Surface>
      </div>
      <Surface variant="outline" elevation="raised">
        <div className="p-4 text-sm">Thumbnail frame</div>
      </Surface>
      <div className="flex gap-3">
        <Surface variant="solid" actionProfile="button">Primary Action</Surface>
        <Surface variant="secondary" actionProfile="button">Default Action</Surface>
      </div>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-surface-variants': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { surfaceRoot } from '@proto.ui/prototypes-bootstrap-2-3-2/surface';

const Surface = createReactAdapter(React)(surfaceRoot);

export function BootstrapSurfaceVariants() {
  return (
    <div className="grid max-w-xl grid-cols-2 gap-3">
      <Surface variant="outline"><div className="p-3 text-sm">outline</div></Surface>
      <Surface variant="outline" elevation="raised"><div className="p-3 text-sm">outline + raised</div></Surface>
      <Surface variant="secondary"><div className="p-3 text-sm">secondary</div></Surface>
      <Surface variant="muted"><div className="p-3 text-sm">muted</div></Surface>
      <Surface variant="accent"><div className="p-3 text-sm">accent</div></Surface>
      <Surface variant="solid" elevation="raised"><div className="p-3 text-sm">solid</div></Surface>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-surface-navbar': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { surfaceRoot } from '@proto.ui/prototypes-bootstrap-2-3-2/surface';

const Surface = createReactAdapter(React)(surfaceRoot);

export function BootstrapSurfaceNavbar() {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[4px] bg-[#0044cc] px-4 py-2.5">
      <Surface variant="transparent" colorContext="navbar" border="none"><div className="px-3 py-1.5 text-sm">Rest</div></Surface>
      <Surface variant="transparent" colorContext="navbar" border="none" hovered><div className="px-3 py-1.5 text-sm">Hovered</div></Surface>
      <Surface variant="transparent" colorContext="navbar" border="none" current><div className="px-3 py-1.5 text-sm">Current</div></Surface>
      <Surface variant="transparent" colorContext="navbar" border="none" focusVisible><div className="px-3 py-1.5 text-sm">Focused</div></Surface>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-surface-action': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { surfaceRoot } from '@proto.ui/prototypes-bootstrap-2-3-2/surface';

const Surface = createReactAdapter(React)(surfaceRoot);

export function BootstrapSurfaceAction() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Surface actionProfile="button" variant="secondary">Default .btn</Surface>
      <Surface actionProfile="button" variant="secondary" hovered>Hovered .btn</Surface>
      <Surface actionProfile="button" variant="solid">Primary</Surface>
      <Surface actionProfile="button" variant="solid" pressed>Pressed Primary</Surface>
    </div>
  );
}
    `),
    'demo-liquid-glass-surface': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { surfaceRoot } from '@proto.ui/prototypes-liquid-glass/surface';

const Surface = createReactAdapter(React)(surfaceRoot);

export function LiquidGlassSurfaceDemo() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
      <Surface variant="outline" material="auto" radius="default" elevation="raised">
        <div className="flex flex-col gap-2 p-1">
          <div className="px-3 pt-2 text-xs font-semibold opacity-75">Floating Glass Shell</div>
          <Surface variant="secondary" material="opaque" radius="lg" border="none">
            <div className="p-3 text-sm">Opaque content card with concentric corners.</div>
          </Surface>
        </div>
      </Surface>
    </div>
  );
}
    `),
    'demo-liquid-glass-surface-material': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { surfaceRoot } from '@proto.ui/prototypes-liquid-glass/surface';

const Surface = createReactAdapter(React)(surfaceRoot);

export function LiquidGlassMaterialOptIn() {
  return (
    <div className="grid grid-cols-2 gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
      <Surface variant="outline" material="auto" radius="xl" elevation="raised"><div className="p-4 text-sm">material="auto" · outline</div></Surface>
      <Surface variant="secondary" material="auto" radius="xl"><div className="p-4 text-sm">material="auto" · secondary</div></Surface>
      <Surface variant="muted" material="auto" radius="xl"><div className="p-4 text-sm">material="auto" · muted</div></Surface>
      <Surface variant="outline" material="opaque" radius="xl"><div className="p-4 text-sm">material="opaque" (default)</div></Surface>
    </div>
  );
}
    `),
    'demo-liquid-glass-surface-variants': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { surfaceRoot } from '@proto.ui/prototypes-liquid-glass/surface';
import { textRoot } from '@proto.ui/prototypes-liquid-glass/text';

const Surface = createReactAdapter(React)(surfaceRoot);
const Text = createReactAdapter(React)(textRoot);

export function LiquidGlassSurfaceVariants() {
  return (
    <div className="grid max-w-xl grid-cols-2 gap-3">
      <Surface variant="outline"><div className="p-3 text-sm">outline</div></Surface>
      <Surface variant="secondary"><div className="p-3 text-sm">secondary</div></Surface>
      <Surface variant="muted" border="none"><div className="p-3 text-sm">muted</div></Surface>
      <Surface variant="solid" border="none">
        <div className="p-3"><Text tone="inherit" size="sm">solid + inherited text</Text></div>
      </Surface>
    </div>
  );
}
    `),
    'demo-liquid-glass-surface-states': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { surfaceRoot } from '@proto.ui/prototypes-liquid-glass/surface';

const Surface = createReactAdapter(React)(surfaceRoot);

export function LiquidGlassSurfaceStates() {
  return (
    <div className="grid grid-cols-2 gap-3 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
      <Surface variant="outline" material="auto" hovered><div className="p-3 text-sm">Glass · hovered</div></Surface>
      <Surface variant="outline" material="auto" pressed><div className="p-3 text-sm">Glass · pressed</div></Surface>
      <Surface variant="outline" material="auto" focusVisible><div className="p-3 text-sm">Glass · focused</div></Surface>
      <Surface variant="outline" material="opaque" current><div className="p-3 text-sm">Opaque · current</div></Surface>
    </div>
  );
}
    `),
  },
  vue: {
    'demo-shadcn-surface': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { surfaceRoot } from '@proto.ui/prototypes-shadcn/surface';

const Surface = createVueAdapter(Vue)(surfaceRoot);
</script>

<template>
  <div class="flex max-w-lg flex-col gap-3">
    <Surface variant="outline" radius="lg">
      <div class="flex items-center justify-between gap-4 p-4">
        <div>
          <div class="text-sm font-medium">Workspace Sync</div>
          <div class="text-xs opacity-75">Automatically backs up changes across devices.</div>
        </div>
        <Surface variant="secondary" radius="full" border="none">
          <div class="px-2.5 py-0.5 text-xs font-medium">Active</div>
        </Surface>
      </div>
    </Surface>
    <Surface variant="muted" radius="md" border="none">
      <div class="px-4 py-3 text-sm">Draft saved locally. Publish when ready to share.</div>
    </Surface>
  </div>
</template>
    `),
    'demo-shadcn-surface-variants': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { surfaceRoot } from '@proto.ui/prototypes-shadcn/surface';

const Surface = createVueAdapter(Vue)(surfaceRoot);
</script>

<template>
  <div class="grid max-w-xl grid-cols-2 gap-3">
    <Surface variant="outline" radius="md"><div class="p-3 text-sm">outline</div></Surface>
    <Surface variant="secondary" radius="md"><div class="p-3 text-sm">secondary</div></Surface>
    <Surface variant="muted" radius="md" border="none"><div class="p-3 text-sm">muted</div></Surface>
    <Surface variant="accent" radius="md"><div class="p-3 text-sm">accent</div></Surface>
    <Surface variant="solid" radius="md" border="none"><div class="p-3 text-sm font-medium">solid</div></Surface>
    <Surface variant="transparent" radius="md"><div class="p-3 text-sm">transparent</div></Surface>
  </div>
</template>
    `),
    'demo-shadcn-surface-geometry': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { surfaceRoot } from '@proto.ui/prototypes-shadcn/surface';

const Surface = createVueAdapter(Vue)(surfaceRoot);
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap gap-2">
      <Surface variant="outline" radius="none"><div class="px-3 py-1.5 text-xs">none</div></Surface>
      <Surface variant="outline" radius="md"><div class="px-3 py-1.5 text-xs">md</div></Surface>
      <Surface variant="outline" radius="xl"><div class="px-3 py-1.5 text-xs">xl</div></Surface>
      <Surface variant="outline" radius="full"><div class="px-3 py-1.5 text-xs">full</div></Surface>
    </div>
    <Surface variant="transparent" radius="none" border="bottom"><div class="p-3 text-xs">border="bottom"</div></Surface>
  </div>
</template>
    `),
    'demo-shadcn-surface-states': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { surfaceRoot } from '@proto.ui/prototypes-shadcn/surface';
import { textRoot } from '@proto.ui/prototypes-shadcn/text';

const Surface = createVueAdapter(Vue)(surfaceRoot);
const Text = createVueAdapter(Vue)(textRoot);
</script>

<template>
  <div class="flex flex-col gap-3">
    <Surface variant="outline" radius="md" :hovered="true"><div class="p-3 text-sm">Hovered item</div></Surface>
    <Surface variant="outline" radius="md" :focus-visible="true"><div class="p-3 text-sm">Keyboard focus ring</div></Surface>
    <Surface variant="solid" action-profile="rhea" :pressed="true">
      <div class="p-3"><Text tone="inherit" size="sm" weight="medium">Pressed Rhea action</Text></div>
    </Surface>
  </div>
</template>
    `),
    'demo-shadcn-surface-action-profiles': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { surfaceRoot } from '@proto.ui/prototypes-shadcn/surface';

const Surface = createVueAdapter(Vue)(surfaceRoot);
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <Surface action-profile="rhea" variant="solid"><div class="px-3 py-1.5 text-xs">Rhea</div></Surface>
    <Surface action-profile="luma" variant="secondary"><div class="px-3 py-1.5 text-xs">Luma</div></Surface>
    <Surface action-profile="lyra" variant="outline"><div class="px-3 py-1.5 text-xs">Lyra</div></Surface>
    <Surface action-profile="new-york-v4" variant="outline"><div class="px-3 py-1.5 text-xs">New York</div></Surface>
  </div>
</template>
    `),
    'demo-shadcn-surface-fade': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { surfaceRoot } from '@proto.ui/prototypes-shadcn/surface';

const Surface = createVueAdapter(Vue)(surfaceRoot);
const phase = Vue.ref<'entered' | 'leaving'>('entered');
</script>

<template>
  <div style="--pui-surface-transition-duration: 240ms">
    <Surface variant="scrim" radius="md" border="none" :fade="true" :transition-state="phase">
      <div class="p-4 text-sm font-medium text-white">Transition-driven scrim surface</div>
    </Surface>
  </div>
</template>
    `),
    'demo-brutalist-surface': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { surfaceRoot } from '@proto.ui/prototypes-brutalist/surface';

const Surface = createVueAdapter(Vue)(surfaceRoot);
</script>

<template>
  <div class="flex max-w-lg flex-col gap-4">
    <Surface variant="outline"><div class="p-4 text-sm font-bold">Project Overview</div></Surface>
    <Surface variant="solid" elevation="raised"><div class="px-4 py-2 text-sm font-bold">Raised Action</div></Surface>
  </div>
</template>
    `),
    'demo-brutalist-surface-variants': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { surfaceRoot } from '@proto.ui/prototypes-brutalist/surface';

const Surface = createVueAdapter(Vue)(surfaceRoot);
</script>

<template>
  <div class="grid max-w-xl grid-cols-2 gap-3">
    <Surface variant="outline"><div class="p-3 text-sm">outline</div></Surface>
    <Surface variant="secondary"><div class="p-3 text-sm">secondary</div></Surface>
    <Surface variant="accent"><div class="p-3 text-sm font-bold">accent (canary)</div></Surface>
    <Surface variant="solid"><div class="p-3 text-sm font-bold">solid (main)</div></Surface>
  </div>
</template>
    `),
    'demo-brutalist-surface-geometry': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { surfaceRoot } from '@proto.ui/prototypes-brutalist/surface';

const Surface = createVueAdapter(Vue)(surfaceRoot);
</script>

<template>
  <div class="flex flex-wrap gap-4">
    <Surface variant="solid" elevation="raised"><div class="px-4 py-2 text-xs font-bold">Raised · rest</div></Surface>
    <Surface variant="solid" elevation="raised" :pressed="true"><div class="px-4 py-2 text-xs font-bold">Raised · pressed</div></Surface>
  </div>
</template>
    `),
    'demo-brutalist-surface-composition': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { surfaceRoot } from '@proto.ui/prototypes-brutalist/surface';
import { textRoot } from '@proto.ui/prototypes-brutalist/text';

const Surface = createVueAdapter(Vue)(surfaceRoot);
const Text = createVueAdapter(Vue)(textRoot);
</script>

<template>
  <Surface variant="solid" elevation="raised">
    <div class="p-4">
      <Text tone="inherit" size="sm" weight="bold">Inherited foreground contrast</Text>
    </div>
  </Surface>
</template>
    `),
    'demo-bootstrap-2-3-2-surface': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { surfaceRoot } from '@proto.ui/prototypes-bootstrap-2-3-2/surface';

const Surface = createVueAdapter(Vue)(surfaceRoot);
</script>

<template>
  <div class="flex max-w-lg flex-col gap-4">
    <div class="flex items-center gap-2 rounded-[4px] bg-[#0044cc] px-3 py-2">
      <Surface variant="transparent" color-context="navbar" border="none" :current="true">
        <div class="px-3 py-1.5 text-sm">Overview</div>
      </Surface>
    </div>
    <Surface variant="solid" action-profile="button">Primary Action</Surface>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-surface-variants': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { surfaceRoot } from '@proto.ui/prototypes-bootstrap-2-3-2/surface';

const Surface = createVueAdapter(Vue)(surfaceRoot);
</script>

<template>
  <div class="grid max-w-xl grid-cols-2 gap-3">
    <Surface variant="outline" elevation="raised"><div class="p-3 text-sm">Thumbnail</div></Surface>
    <Surface variant="muted"><div class="p-3 text-sm">Well</div></Surface>
    <Surface variant="accent"><div class="p-3 text-sm">Info Accent</div></Surface>
    <Surface variant="solid" elevation="raised"><div class="p-3 text-sm">Solid Primary</div></Surface>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-surface-navbar': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { surfaceRoot } from '@proto.ui/prototypes-bootstrap-2-3-2/surface';

const Surface = createVueAdapter(Vue)(surfaceRoot);
</script>

<template>
  <div class="flex items-center gap-2 rounded-[4px] bg-[#0044cc] px-4 py-2.5">
    <Surface variant="transparent" color-context="navbar" border="none"><div class="px-3 py-1.5 text-sm">Rest</div></Surface>
    <Surface variant="transparent" color-context="navbar" border="none" :hovered="true"><div class="px-3 py-1.5 text-sm">Hovered</div></Surface>
    <Surface variant="transparent" color-context="navbar" border="none" :current="true"><div class="px-3 py-1.5 text-sm">Current</div></Surface>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-surface-action': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { surfaceRoot } from '@proto.ui/prototypes-bootstrap-2-3-2/surface';

const Surface = createVueAdapter(Vue)(surfaceRoot);
</script>

<template>
  <div class="flex flex-wrap gap-3">
    <Surface action-profile="button" variant="secondary">Default .btn</Surface>
    <Surface action-profile="button" variant="solid">Primary</Surface>
    <Surface action-profile="button" variant="solid" :pressed="true">Pressed Primary</Surface>
  </div>
</template>
    `),
    'demo-liquid-glass-surface': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { surfaceRoot } from '@proto.ui/prototypes-liquid-glass/surface';

const Surface = createVueAdapter(Vue)(surfaceRoot);
</script>

<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <Surface variant="outline" material="auto" radius="default" elevation="raised">
      <div class="p-1">
        <Surface variant="secondary" material="opaque" radius="lg" border="none">
          <div class="p-3 text-sm">Opaque content card with concentric corners.</div>
        </Surface>
      </div>
    </Surface>
  </div>
</template>
    `),
    'demo-liquid-glass-surface-material': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { surfaceRoot } from '@proto.ui/prototypes-liquid-glass/surface';

const Surface = createVueAdapter(Vue)(surfaceRoot);
</script>

<template>
  <div class="grid grid-cols-2 gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <Surface variant="outline" material="auto" radius="xl"><div class="p-4 text-sm">material="auto"</div></Surface>
    <Surface variant="outline" material="opaque" radius="xl"><div class="p-4 text-sm">material="opaque"</div></Surface>
  </div>
</template>
    `),
    'demo-liquid-glass-surface-variants': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { surfaceRoot } from '@proto.ui/prototypes-liquid-glass/surface';

const Surface = createVueAdapter(Vue)(surfaceRoot);
</script>

<template>
  <div class="grid max-w-xl grid-cols-2 gap-3">
    <Surface variant="outline"><div class="p-3 text-sm">outline</div></Surface>
    <Surface variant="secondary"><div class="p-3 text-sm">secondary</div></Surface>
    <Surface variant="muted" border="none"><div class="p-3 text-sm">muted</div></Surface>
    <Surface variant="solid" border="none"><div class="p-3 text-sm">solid</div></Surface>
  </div>
</template>
    `),
    'demo-liquid-glass-surface-states': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { surfaceRoot } from '@proto.ui/prototypes-liquid-glass/surface';

const Surface = createVueAdapter(Vue)(surfaceRoot);
</script>

<template>
  <div class="grid grid-cols-2 gap-3 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <Surface variant="outline" material="auto" :hovered="true"><div class="p-3 text-sm">Glass · hovered</div></Surface>
    <Surface variant="outline" material="auto" :pressed="true"><div class="p-3 text-sm">Glass · pressed</div></Surface>
  </div>
</template>
    `),
  },
  vue2: {
    'demo-shadcn-surface': formatCode(`
<template>
  <div class="flex max-w-lg flex-col gap-3">
    <ShadcnSurfaceRoot variant="outline" radius="lg">
      <div class="p-4 text-sm font-medium">Workspace Sync</div>
    </ShadcnSurfaceRoot>
    <ShadcnSurfaceRoot variant="muted" radius="md" border="none">
      <div class="px-4 py-3 text-sm">Draft saved locally.</div>
    </ShadcnSurfaceRoot>
  </div>
</template>

<script>
import { ShadcnSurfaceRoot } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnSurfaceRoot },
};
</script>
    `),
    'demo-shadcn-surface-variants': formatCode(`
<template>
  <div class="grid max-w-xl grid-cols-2 gap-3">
    <ShadcnSurfaceRoot variant="outline" radius="md"><div class="p-3 text-sm">outline</div></ShadcnSurfaceRoot>
    <ShadcnSurfaceRoot variant="secondary" radius="md"><div class="p-3 text-sm">secondary</div></ShadcnSurfaceRoot>
    <ShadcnSurfaceRoot variant="muted" radius="md" border="none"><div class="p-3 text-sm">muted</div></ShadcnSurfaceRoot>
    <ShadcnSurfaceRoot variant="solid" radius="md" border="none"><div class="p-3 text-sm">solid</div></ShadcnSurfaceRoot>
  </div>
</template>

<script>
import { ShadcnSurfaceRoot } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnSurfaceRoot },
};
</script>
    `),
    'demo-shadcn-surface-geometry': formatCode(`
<template>
  <div class="flex flex-wrap gap-2">
    <ShadcnSurfaceRoot variant="outline" radius="none"><div class="px-3 py-1.5 text-xs">none</div></ShadcnSurfaceRoot>
    <ShadcnSurfaceRoot variant="outline" radius="md"><div class="px-3 py-1.5 text-xs">md</div></ShadcnSurfaceRoot>
    <ShadcnSurfaceRoot variant="outline" radius="full"><div class="px-3 py-1.5 text-xs">full</div></ShadcnSurfaceRoot>
  </div>
</template>

<script>
import { ShadcnSurfaceRoot } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnSurfaceRoot },
};
</script>
    `),
    'demo-shadcn-surface-states': formatCode(`
<template>
  <div class="flex flex-col gap-3">
    <ShadcnSurfaceRoot variant="outline" radius="md" :hovered="true"><div class="p-3 text-sm">Hovered item</div></ShadcnSurfaceRoot>
    <ShadcnSurfaceRoot variant="solid" action-profile="rhea" :pressed="true">
      <div class="p-3"><ShadcnTextRoot tone="inherit" size="sm">Pressed Rhea action</ShadcnTextRoot></div>
    </ShadcnSurfaceRoot>
  </div>
</template>

<script>
import { ShadcnSurfaceRoot, ShadcnTextRoot } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnSurfaceRoot, ShadcnTextRoot },
};
</script>
    `),
    'demo-shadcn-surface-action-profiles': formatCode(`
<template>
  <div class="flex flex-wrap gap-2">
    <ShadcnSurfaceRoot action-profile="rhea" variant="solid"><div class="px-3 py-1.5 text-xs">Rhea</div></ShadcnSurfaceRoot>
    <ShadcnSurfaceRoot action-profile="luma" variant="secondary"><div class="px-3 py-1.5 text-xs">Luma</div></ShadcnSurfaceRoot>
    <ShadcnSurfaceRoot action-profile="new-york-v4" variant="outline"><div class="px-3 py-1.5 text-xs">New York</div></ShadcnSurfaceRoot>
  </div>
</template>

<script>
import { ShadcnSurfaceRoot } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnSurfaceRoot },
};
</script>
    `),
    'demo-shadcn-surface-fade': formatCode(`
<template>
  <div style="--pui-surface-transition-duration: 240ms">
    <ShadcnSurfaceRoot variant="scrim" radius="md" border="none" :fade="true" :transition-state="phase">
      <div class="p-4 text-sm text-white">Transition-driven scrim surface</div>
    </ShadcnSurfaceRoot>
  </div>
</template>

<script>
import { ShadcnSurfaceRoot } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnSurfaceRoot },
  data() {
    return { phase: 'entered' };
  },
};
</script>
    `),
    'demo-brutalist-surface': formatCode(`
<template>
  <div class="flex max-w-lg flex-col gap-4">
    <BrutalistSurfaceRoot variant="outline"><div class="p-4 text-sm font-bold">Project Overview</div></BrutalistSurfaceRoot>
    <BrutalistSurfaceRoot variant="solid" elevation="raised"><div class="px-4 py-2 text-sm font-bold">Raised Action</div></BrutalistSurfaceRoot>
  </div>
</template>

<script>
import { BrutalistSurfaceRoot } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistSurfaceRoot },
};
</script>
    `),
    'demo-brutalist-surface-variants': formatCode(`
<template>
  <div class="grid max-w-xl grid-cols-2 gap-3">
    <BrutalistSurfaceRoot variant="outline"><div class="p-3 text-sm">outline</div></BrutalistSurfaceRoot>
    <BrutalistSurfaceRoot variant="accent"><div class="p-3 text-sm font-bold">accent (canary)</div></BrutalistSurfaceRoot>
    <BrutalistSurfaceRoot variant="solid"><div class="p-3 text-sm font-bold">solid (main)</div></BrutalistSurfaceRoot>
  </div>
</template>

<script>
import { BrutalistSurfaceRoot } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistSurfaceRoot },
};
</script>
    `),
    'demo-brutalist-surface-geometry': formatCode(`
<template>
  <div class="flex flex-wrap gap-4">
    <BrutalistSurfaceRoot variant="solid" elevation="raised"><div class="px-4 py-2 text-xs font-bold">Raised · rest</div></BrutalistSurfaceRoot>
    <BrutalistSurfaceRoot variant="solid" elevation="raised" :pressed="true"><div class="px-4 py-2 text-xs font-bold">Raised · pressed</div></BrutalistSurfaceRoot>
  </div>
</template>

<script>
import { BrutalistSurfaceRoot } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistSurfaceRoot },
};
</script>
    `),
    'demo-brutalist-surface-composition': formatCode(`
<template>
  <BrutalistSurfaceRoot variant="solid" elevation="raised">
    <div class="p-4">
      <BrutalistTextRoot tone="inherit" size="sm" weight="bold">Inherited foreground contrast</BrutalistTextRoot>
    </div>
  </BrutalistSurfaceRoot>
</template>

<script>
import { BrutalistSurfaceRoot, BrutalistTextRoot } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistSurfaceRoot, BrutalistTextRoot },
};
</script>
    `),
    'demo-bootstrap-2-3-2-surface': formatCode(`
<template>
  <div class="flex max-w-lg flex-col gap-4">
    <Bootstrap232SurfaceRoot variant="outline" elevation="raised"><div class="p-4 text-sm">Thumbnail frame</div></Bootstrap232SurfaceRoot>
    <Bootstrap232SurfaceRoot variant="solid" action-profile="button">Primary Action</Bootstrap232SurfaceRoot>
  </div>
</template>

<script>
import { Bootstrap232SurfaceRoot } from '../proto-ui/components/vue2';

export default {
  components: { Bootstrap232SurfaceRoot },
};
</script>
    `),
    'demo-bootstrap-2-3-2-surface-variants': formatCode(`
<template>
  <div class="grid max-w-xl grid-cols-2 gap-3">
    <Bootstrap232SurfaceRoot variant="outline" elevation="raised"><div class="p-3 text-sm">Thumbnail</div></Bootstrap232SurfaceRoot>
    <Bootstrap232SurfaceRoot variant="muted"><div class="p-3 text-sm">Well</div></Bootstrap232SurfaceRoot>
  </div>
</template>

<script>
import { Bootstrap232SurfaceRoot } from '../proto-ui/components/vue2';

export default {
  components: { Bootstrap232SurfaceRoot },
};
</script>
    `),
    'demo-bootstrap-2-3-2-surface-navbar': formatCode(`
<template>
  <div class="flex items-center gap-2 rounded-[4px] bg-[#0044cc] px-4 py-2.5">
    <Bootstrap232SurfaceRoot variant="transparent" color-context="navbar" border="none" :current="true">
      <div class="px-3 py-1.5 text-sm">Current</div>
    </Bootstrap232SurfaceRoot>
  </div>
</template>

<script>
import { Bootstrap232SurfaceRoot } from '../proto-ui/components/vue2';

export default {
  components: { Bootstrap232SurfaceRoot },
};
</script>
    `),
    'demo-bootstrap-2-3-2-surface-action': formatCode(`
<template>
  <div class="flex flex-wrap gap-3">
    <Bootstrap232SurfaceRoot action-profile="button" variant="secondary">Default .btn</Bootstrap232SurfaceRoot>
    <Bootstrap232SurfaceRoot action-profile="button" variant="solid">Primary</Bootstrap232SurfaceRoot>
  </div>
</template>

<script>
import { Bootstrap232SurfaceRoot } from '../proto-ui/components/vue2';

export default {
  components: { Bootstrap232SurfaceRoot },
};
</script>
    `),
    'demo-liquid-glass-surface': formatCode(`
<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassSurfaceRoot variant="outline" material="auto" radius="default" elevation="raised">
      <div class="p-1">
        <LiquidGlassSurfaceRoot variant="secondary" material="opaque" radius="lg" border="none">
          <div class="p-3 text-sm">Opaque content card with concentric corners.</div>
        </LiquidGlassSurfaceRoot>
      </div>
    </LiquidGlassSurfaceRoot>
  </div>
</template>

<script>
import { LiquidGlassSurfaceRoot } from '../proto-ui/components/vue2';

export default {
  components: { LiquidGlassSurfaceRoot },
};
</script>
    `),
    'demo-liquid-glass-surface-material': formatCode(`
<template>
  <div class="grid grid-cols-2 gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassSurfaceRoot variant="outline" material="auto" radius="xl"><div class="p-4 text-sm">material="auto"</div></LiquidGlassSurfaceRoot>
    <LiquidGlassSurfaceRoot variant="outline" material="opaque" radius="xl"><div class="p-4 text-sm">material="opaque"</div></LiquidGlassSurfaceRoot>
  </div>
</template>

<script>
import { LiquidGlassSurfaceRoot } from '../proto-ui/components/vue2';

export default {
  components: { LiquidGlassSurfaceRoot },
};
</script>
    `),
    'demo-liquid-glass-surface-variants': formatCode(`
<template>
  <div class="grid max-w-xl grid-cols-2 gap-3">
    <LiquidGlassSurfaceRoot variant="outline"><div class="p-3 text-sm">outline</div></LiquidGlassSurfaceRoot>
    <LiquidGlassSurfaceRoot variant="secondary"><div class="p-3 text-sm">secondary</div></LiquidGlassSurfaceRoot>
  </div>
</template>

<script>
import { LiquidGlassSurfaceRoot } from '../proto-ui/components/vue2';

export default {
  components: { LiquidGlassSurfaceRoot },
};
</script>
    `),
    'demo-liquid-glass-surface-states': formatCode(`
<template>
  <div class="grid grid-cols-2 gap-3 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassSurfaceRoot variant="outline" material="auto" :hovered="true"><div class="p-3 text-sm">Glass · hovered</div></LiquidGlassSurfaceRoot>
    <LiquidGlassSurfaceRoot variant="outline" material="auto" :pressed="true"><div class="p-3 text-sm">Glass · pressed</div></LiquidGlassSurfaceRoot>
  </div>
</template>

<script>
import { LiquidGlassSurfaceRoot } from '../proto-ui/components/vue2';

export default {
  components: { LiquidGlassSurfaceRoot },
};
</script>
    `),
  },
};
