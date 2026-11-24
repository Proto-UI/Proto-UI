import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Partial<Record<RuntimeId, Record<string, string>>> = {
  wc: {
    'demo-brutalist-hover-card': formatCode(`
<wc-brutalist-hover-card-root open-delay="150" close-delay="200">
  <wc-brutalist-hover-card-trigger>@proto-ui</wc-brutalist-hover-card-trigger>
  <wc-brutalist-hover-card-content side="bottom" align="center">
    <div class="font-heading text-sm font-bold">@proto-ui</div>
    <p class="text-sm">Host-neutral interaction protocols with bold Neo-Brutalist borders and hard shadows.</p>
    <span class="text-xs text-muted-foreground">Joined December 2024</span>
  </wc-brutalist-hover-card-content>
</wc-brutalist-hover-card-root>
    `),
    'demo-brutalist-hover-card-sides': formatCode(`
<div class="flex flex-wrap items-center justify-center gap-3">
  <wc-brutalist-hover-card-root open-delay="100" close-delay="150">
    <wc-brutalist-hover-card-trigger>Left</wc-brutalist-hover-card-trigger>
    <wc-brutalist-hover-card-content side="left" align="center" side-offset="8">Opens on the left side.</wc-brutalist-hover-card-content>
  </wc-brutalist-hover-card-root>
  <wc-brutalist-hover-card-root open-delay="100" close-delay="150">
    <wc-brutalist-hover-card-trigger>Top</wc-brutalist-hover-card-trigger>
    <wc-brutalist-hover-card-content side="top" align="center" side-offset="8">Opens on the top side.</wc-brutalist-hover-card-content>
  </wc-brutalist-hover-card-root>
  <wc-brutalist-hover-card-root open-delay="100" close-delay="150">
    <wc-brutalist-hover-card-trigger>Bottom</wc-brutalist-hover-card-trigger>
    <wc-brutalist-hover-card-content side="bottom" align="center" side-offset="8">Opens on the bottom side.</wc-brutalist-hover-card-content>
  </wc-brutalist-hover-card-root>
  <wc-brutalist-hover-card-root open-delay="100" close-delay="150">
    <wc-brutalist-hover-card-trigger>Right</wc-brutalist-hover-card-trigger>
    <wc-brutalist-hover-card-content side="right" align="center" side-offset="8">Opens on the right side.</wc-brutalist-hover-card-content>
  </wc-brutalist-hover-card-root>
</div>
    `),
    'demo-brutalist-hover-card-delays': formatCode(`
<div class="flex flex-wrap items-center justify-center gap-6">
  <wc-brutalist-hover-card-root open-delay="50" close-delay="100">
    <wc-brutalist-hover-card-trigger>Fast (50ms / 100ms)</wc-brutalist-hover-card-trigger>
    <wc-brutalist-hover-card-content side="bottom" align="center" side-offset="8">
      Opens after 50ms and closes 100ms after leaving.
    </wc-brutalist-hover-card-content>
  </wc-brutalist-hover-card-root>
  <wc-brutalist-hover-card-root open-delay="400" close-delay="300">
    <wc-brutalist-hover-card-trigger>Standard (400ms / 300ms)</wc-brutalist-hover-card-trigger>
    <wc-brutalist-hover-card-content side="bottom" align="center" side-offset="8">
      Waits 400ms before opening to prevent stray hover cards.
    </wc-brutalist-hover-card-content>
  </wc-brutalist-hover-card-root>
</div>
    `),
    'demo-brutalist-hover-card-disabled': formatCode(`
<div class="flex flex-wrap items-center justify-center gap-6">
  <wc-brutalist-hover-card-root open-delay="100" close-delay="150">
    <wc-brutalist-hover-card-trigger>Active trigger</wc-brutalist-hover-card-trigger>
    <wc-brutalist-hover-card-content side="bottom" align="center" side-offset="8">
      Hover or focus the trigger to inspect this preview panel.
    </wc-brutalist-hover-card-content>
  </wc-brutalist-hover-card-root>
  <wc-brutalist-hover-card-root disabled open-delay="100" close-delay="150">
    <wc-brutalist-hover-card-trigger>Disabled trigger</wc-brutalist-hover-card-trigger>
    <wc-brutalist-hover-card-content side="bottom" align="center" side-offset="8">
      Disabled previews remain closed.
    </wc-brutalist-hover-card-content>
  </wc-brutalist-hover-card-root>
</div>
    `),
    'demo-bootstrap-2-3-2-hover-card': formatCode(`
<wc-bootstrap-2-3-2-hover-card-root open-delay="150" close-delay="250">
  <wc-bootstrap-2-3-2-hover-card-trigger>@proto-ui</wc-bootstrap-2-3-2-hover-card-trigger>
  <wc-bootstrap-2-3-2-hover-card-content side="bottom" align="center" side-offset="6">
    <div class="font-bold text-sm">Proto UI</div>
    <p class="text-sm">Host-neutral interaction protocols rendered with classic Bootstrap 2.3.2 popover chrome.</p>
    <span class="text-xs text-muted-foreground">Joined December 2024</span>
  </wc-bootstrap-2-3-2-hover-card-content>
</wc-bootstrap-2-3-2-hover-card-root>
    `),
    'demo-bootstrap-2-3-2-hover-card-sides': formatCode(`
<div class="flex flex-wrap items-center justify-center gap-4">
  <wc-bootstrap-2-3-2-hover-card-root open-delay="100" close-delay="150">
    <wc-bootstrap-2-3-2-hover-card-trigger>Left</wc-bootstrap-2-3-2-hover-card-trigger>
    <wc-bootstrap-2-3-2-hover-card-content side="left" align="center" side-offset="6">Opens on the left side.</wc-bootstrap-2-3-2-hover-card-content>
  </wc-bootstrap-2-3-2-hover-card-root>
  <wc-bootstrap-2-3-2-hover-card-root open-delay="100" close-delay="150">
    <wc-bootstrap-2-3-2-hover-card-trigger>Top</wc-bootstrap-2-3-2-hover-card-trigger>
    <wc-bootstrap-2-3-2-hover-card-content side="top" align="center" side-offset="6">Opens on the top side.</wc-bootstrap-2-3-2-hover-card-content>
  </wc-bootstrap-2-3-2-hover-card-root>
  <wc-bootstrap-2-3-2-hover-card-root open-delay="100" close-delay="150">
    <wc-bootstrap-2-3-2-hover-card-trigger>Bottom</wc-bootstrap-2-3-2-hover-card-trigger>
    <wc-bootstrap-2-3-2-hover-card-content side="bottom" align="center" side-offset="6">Opens on the bottom side.</wc-bootstrap-2-3-2-hover-card-content>
  </wc-bootstrap-2-3-2-hover-card-root>
  <wc-bootstrap-2-3-2-hover-card-root open-delay="100" close-delay="150">
    <wc-bootstrap-2-3-2-hover-card-trigger>Right</wc-bootstrap-2-3-2-hover-card-trigger>
    <wc-bootstrap-2-3-2-hover-card-content side="right" align="center" side-offset="6">Opens on the right side.</wc-bootstrap-2-3-2-hover-card-content>
  </wc-bootstrap-2-3-2-hover-card-root>
</div>
    `),
    'demo-bootstrap-2-3-2-hover-card-delays': formatCode(`
<div class="flex flex-wrap items-center justify-center gap-6">
  <wc-bootstrap-2-3-2-hover-card-root open-delay="50" close-delay="100">
    <wc-bootstrap-2-3-2-hover-card-trigger>Quick preview (50ms)</wc-bootstrap-2-3-2-hover-card-trigger>
    <wc-bootstrap-2-3-2-hover-card-content side="bottom" align="center" side-offset="6">
      Appears after 50ms with the classic 150ms linear fade.
    </wc-bootstrap-2-3-2-hover-card-content>
  </wc-bootstrap-2-3-2-hover-card-root>
  <wc-bootstrap-2-3-2-hover-card-root open-delay="450" close-delay="300">
    <wc-bootstrap-2-3-2-hover-card-trigger>Standard preview (450ms)</wc-bootstrap-2-3-2-hover-card-trigger>
    <wc-bootstrap-2-3-2-hover-card-content side="bottom" align="center" side-offset="6">
      Waits 450ms before opening and stays open while hovered.
    </wc-bootstrap-2-3-2-hover-card-content>
  </wc-bootstrap-2-3-2-hover-card-root>
</div>
    `),
    'demo-bootstrap-2-3-2-hover-card-disabled': formatCode(`
<div class="flex flex-wrap items-center justify-center gap-6">
  <wc-bootstrap-2-3-2-hover-card-root open-delay="100" close-delay="150">
    <wc-bootstrap-2-3-2-hover-card-trigger>Active link</wc-bootstrap-2-3-2-hover-card-trigger>
    <wc-bootstrap-2-3-2-hover-card-content side="bottom" align="center" side-offset="6">
      Hover or focus the link to show the Bootstrap 2.3.2 popover.
    </wc-bootstrap-2-3-2-hover-card-content>
  </wc-bootstrap-2-3-2-hover-card-root>
  <wc-bootstrap-2-3-2-hover-card-root disabled open-delay="100" close-delay="150">
    <wc-bootstrap-2-3-2-hover-card-trigger>Disabled link</wc-bootstrap-2-3-2-hover-card-trigger>
    <wc-bootstrap-2-3-2-hover-card-content side="bottom" align="center" side-offset="6">
      Disabled links do not open a hover card.
    </wc-bootstrap-2-3-2-hover-card-content>
  </wc-bootstrap-2-3-2-hover-card-root>
</div>
    `),
    'demo-liquid-glass-hover-card': formatCode(`
<div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
  <wc-liquid-glass-hover-card-root open-delay="150" close-delay="200">
    <wc-liquid-glass-hover-card-trigger>@proto-ui</wc-liquid-glass-hover-card-trigger>
    <wc-liquid-glass-hover-card-content side="bottom" align="center" side-offset="8">
      <div class="font-semibold">@proto-ui</div>
      <p class="text-muted-foreground">Host-neutral interaction protocols layered over translucent Liquid Glass surfaces.</p>
      <div class="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">Joined December 2024 · 4 framework adapters</div>
    </wc-liquid-glass-hover-card-content>
  </wc-liquid-glass-hover-card-root>
</div>
    `),
    'demo-liquid-glass-hover-card-sides': formatCode(`
<div class="flex flex-wrap justify-center gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
  <wc-liquid-glass-hover-card-root open-delay="100" close-delay="150">
    <wc-liquid-glass-hover-card-trigger>Left</wc-liquid-glass-hover-card-trigger>
    <wc-liquid-glass-hover-card-content side="left" align="center" side-offset="8">Floats on the left side.</wc-liquid-glass-hover-card-content>
  </wc-liquid-glass-hover-card-root>
  <wc-liquid-glass-hover-card-root open-delay="100" close-delay="150">
    <wc-liquid-glass-hover-card-trigger>Top</wc-liquid-glass-hover-card-trigger>
    <wc-liquid-glass-hover-card-content side="top" align="center" side-offset="8">Floats on the top side.</wc-liquid-glass-hover-card-content>
  </wc-liquid-glass-hover-card-root>
  <wc-liquid-glass-hover-card-root open-delay="100" close-delay="150">
    <wc-liquid-glass-hover-card-trigger>Bottom</wc-liquid-glass-hover-card-trigger>
    <wc-liquid-glass-hover-card-content side="bottom" align="center" side-offset="8">Floats on the bottom side.</wc-liquid-glass-hover-card-content>
  </wc-liquid-glass-hover-card-root>
  <wc-liquid-glass-hover-card-root open-delay="100" close-delay="150">
    <wc-liquid-glass-hover-card-trigger>Right</wc-liquid-glass-hover-card-trigger>
    <wc-liquid-glass-hover-card-content side="right" align="center" side-offset="8">Floats on the right side.</wc-liquid-glass-hover-card-content>
  </wc-liquid-glass-hover-card-root>
</div>
    `),
    'demo-liquid-glass-hover-card-material': formatCode(`
<div class="flex flex-wrap justify-center gap-6 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
  <wc-liquid-glass-hover-card-root open-delay="100" close-delay="150">
    <wc-liquid-glass-hover-card-trigger>Regular glass</wc-liquid-glass-hover-card-trigger>
    <wc-liquid-glass-hover-card-content variant="regular" material="auto" side="bottom" align="center" side-offset="8">
      Default floating translucency with concentric inner corner radii.
    </wc-liquid-glass-hover-card-content>
  </wc-liquid-glass-hover-card-root>
  <wc-liquid-glass-hover-card-root open-delay="100" close-delay="150">
    <wc-liquid-glass-hover-card-trigger>Prominent tint</wc-liquid-glass-hover-card-trigger>
    <wc-liquid-glass-hover-card-content variant="prominent" material="auto" side="bottom" align="center" side-offset="8">
      Selective tinted prominence for primary callout previews.
    </wc-liquid-glass-hover-card-content>
  </wc-liquid-glass-hover-card-root>
  <wc-liquid-glass-hover-card-root open-delay="100" close-delay="150">
    <wc-liquid-glass-hover-card-trigger>Opaque fallback</wc-liquid-glass-hover-card-trigger>
    <wc-liquid-glass-hover-card-content variant="regular" material="opaque" side="bottom" align="center" side-offset="8">
      Opts out of optical glass while keeping crisp contrast and depth.
    </wc-liquid-glass-hover-card-content>
  </wc-liquid-glass-hover-card-root>
</div>
    `),
    'demo-liquid-glass-hover-card-disabled': formatCode(`
<div class="flex flex-wrap justify-center gap-6 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
  <wc-liquid-glass-hover-card-root open-delay="100" close-delay="150">
    <wc-liquid-glass-hover-card-trigger>Active trigger</wc-liquid-glass-hover-card-trigger>
    <wc-liquid-glass-hover-card-content side="bottom" align="center" side-offset="8">
      Non-glass trigger avoids glass-on-glass stacking over the card.
    </wc-liquid-glass-hover-card-content>
  </wc-liquid-glass-hover-card-root>
  <wc-liquid-glass-hover-card-root disabled open-delay="100" close-delay="150">
    <wc-liquid-glass-hover-card-trigger>Disabled trigger</wc-liquid-glass-hover-card-trigger>
    <wc-liquid-glass-hover-card-content side="bottom" align="center" side-offset="8">
      Disabled cards stay closed without reducing text legibility.
    </wc-liquid-glass-hover-card-content>
  </wc-liquid-glass-hover-card-root>
</div>
    `),
  },
  react: {
    'demo-brutalist-hover-card': formatCode(`
import {
  BrutalistHoverCardRoot,
  BrutalistHoverCardTrigger,
  BrutalistHoverCardContent,
} from '../proto-ui/components/react';

export function BrutalistHoverCardDemo() {
  return (
    <BrutalistHoverCardRoot openDelay={150} closeDelay={200}>
      <BrutalistHoverCardTrigger>@proto-ui</BrutalistHoverCardTrigger>
      <BrutalistHoverCardContent side="bottom" align="center">
        <div className="font-heading text-sm font-bold">@proto-ui</div>
        <p className="text-sm">
          Host-neutral interaction protocols with bold Neo-Brutalist borders and hard shadows.
        </p>
        <span className="text-xs text-muted-foreground">Joined December 2024</span>
      </BrutalistHoverCardContent>
    </BrutalistHoverCardRoot>
  );
}
    `),
    'demo-brutalist-hover-card-sides': formatCode(`
import {
  BrutalistHoverCardRoot,
  BrutalistHoverCardTrigger,
  BrutalistHoverCardContent,
} from '../proto-ui/components/react';

const SIDES = ['left', 'top', 'bottom', 'right'] as const;

export function BrutalistHoverCardSidesDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {SIDES.map((side) => (
        <BrutalistHoverCardRoot key={side} openDelay={100} closeDelay={150}>
          <BrutalistHoverCardTrigger className="capitalize">{side}</BrutalistHoverCardTrigger>
          <BrutalistHoverCardContent side={side} align="center" sideOffset={8}>
            <div className="font-heading text-sm font-bold">Hover Card</div>
            <p className="text-sm">This preview panel opens on the {side} side of the trigger.</p>
          </BrutalistHoverCardContent>
        </BrutalistHoverCardRoot>
      ))}
    </div>
  );
}
    `),
    'demo-brutalist-hover-card-delays': formatCode(`
import {
  BrutalistHoverCardRoot,
  BrutalistHoverCardTrigger,
  BrutalistHoverCardContent,
} from '../proto-ui/components/react';

export function BrutalistHoverCardDelaysDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <BrutalistHoverCardRoot openDelay={50} closeDelay={100}>
        <BrutalistHoverCardTrigger>Fast (50ms / 100ms)</BrutalistHoverCardTrigger>
        <BrutalistHoverCardContent side="bottom" align="center" sideOffset={8}>
          Opens after 50ms and closes 100ms after leaving.
        </BrutalistHoverCardContent>
      </BrutalistHoverCardRoot>
      <BrutalistHoverCardRoot openDelay={400} closeDelay={300}>
        <BrutalistHoverCardTrigger>Standard (400ms / 300ms)</BrutalistHoverCardTrigger>
        <BrutalistHoverCardContent side="bottom" align="center" sideOffset={8}>
          Waits 400ms before opening to prevent stray hover cards.
        </BrutalistHoverCardContent>
      </BrutalistHoverCardRoot>
    </div>
  );
}
    `),
    'demo-brutalist-hover-card-disabled': formatCode(`
import {
  BrutalistHoverCardRoot,
  BrutalistHoverCardTrigger,
  BrutalistHoverCardContent,
} from '../proto-ui/components/react';

export function BrutalistHoverCardDisabledDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <BrutalistHoverCardRoot openDelay={100} closeDelay={150}>
        <BrutalistHoverCardTrigger>Active trigger</BrutalistHoverCardTrigger>
        <BrutalistHoverCardContent side="bottom" align="center" sideOffset={8}>
          Hover or focus the trigger to inspect this preview panel.
        </BrutalistHoverCardContent>
      </BrutalistHoverCardRoot>
      <BrutalistHoverCardRoot disabled openDelay={100} closeDelay={150}>
        <BrutalistHoverCardTrigger>Disabled trigger</BrutalistHoverCardTrigger>
        <BrutalistHoverCardContent side="bottom" align="center" sideOffset={8}>
          Disabled previews remain closed.
        </BrutalistHoverCardContent>
      </BrutalistHoverCardRoot>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-hover-card': formatCode(`
import {
  BootstrapHoverCardRoot,
  BootstrapHoverCardTrigger,
  BootstrapHoverCardContent,
} from '../proto-ui/components/react';

export function BootstrapHoverCardDemo() {
  return (
    <BootstrapHoverCardRoot openDelay={150} closeDelay={250}>
      <BootstrapHoverCardTrigger>@proto-ui</BootstrapHoverCardTrigger>
      <BootstrapHoverCardContent side="bottom" align="center" sideOffset={6}>
        <div className="font-bold text-sm">Proto UI</div>
        <p className="text-sm">
          Host-neutral interaction protocols rendered with classic Bootstrap 2.3.2 popover chrome.
        </p>
        <span className="text-xs text-muted-foreground">Joined December 2024</span>
      </BootstrapHoverCardContent>
    </BootstrapHoverCardRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-hover-card-sides': formatCode(`
import {
  BootstrapHoverCardRoot,
  BootstrapHoverCardTrigger,
  BootstrapHoverCardContent,
} from '../proto-ui/components/react';

const SIDES = ['left', 'top', 'bottom', 'right'] as const;

export function BootstrapHoverCardSidesDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      {SIDES.map((side) => (
        <BootstrapHoverCardRoot key={side} openDelay={100} closeDelay={150}>
          <BootstrapHoverCardTrigger className="capitalize">{side}</BootstrapHoverCardTrigger>
          <BootstrapHoverCardContent side={side} align="center" sideOffset={6}>
            <div className="font-bold text-sm">Hover Card</div>
            <p className="text-sm">Opens on the {side} side of the link trigger.</p>
          </BootstrapHoverCardContent>
        </BootstrapHoverCardRoot>
      ))}
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-hover-card-delays': formatCode(`
import {
  BootstrapHoverCardRoot,
  BootstrapHoverCardTrigger,
  BootstrapHoverCardContent,
} from '../proto-ui/components/react';

export function BootstrapHoverCardDelaysDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <BootstrapHoverCardRoot openDelay={50} closeDelay={100}>
        <BootstrapHoverCardTrigger>Quick preview (50ms)</BootstrapHoverCardTrigger>
        <BootstrapHoverCardContent side="bottom" align="center" sideOffset={6}>
          Appears after 50ms with the classic 150ms linear fade.
        </BootstrapHoverCardContent>
      </BootstrapHoverCardRoot>
      <BootstrapHoverCardRoot openDelay={450} closeDelay={300}>
        <BootstrapHoverCardTrigger>Standard preview (450ms)</BootstrapHoverCardTrigger>
        <BootstrapHoverCardContent side="bottom" align="center" sideOffset={6}>
          Waits 450ms before opening and stays open while hovered.
        </BootstrapHoverCardContent>
      </BootstrapHoverCardRoot>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-hover-card-disabled': formatCode(`
import {
  BootstrapHoverCardRoot,
  BootstrapHoverCardTrigger,
  BootstrapHoverCardContent,
} from '../proto-ui/components/react';

export function BootstrapHoverCardDisabledDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <BootstrapHoverCardRoot openDelay={100} closeDelay={150}>
        <BootstrapHoverCardTrigger>Active link</BootstrapHoverCardTrigger>
        <BootstrapHoverCardContent side="bottom" align="center" sideOffset={6}>
          Hover or focus the link to show the Bootstrap 2.3.2 popover.
        </BootstrapHoverCardContent>
      </BootstrapHoverCardRoot>
      <BootstrapHoverCardRoot disabled openDelay={100} closeDelay={150}>
        <BootstrapHoverCardTrigger>Disabled link</BootstrapHoverCardTrigger>
        <BootstrapHoverCardContent side="bottom" align="center" sideOffset={6}>
          Disabled links do not open a hover card.
        </BootstrapHoverCardContent>
      </BootstrapHoverCardRoot>
    </div>
  );
}
    `),
    'demo-liquid-glass-hover-card': formatCode(`
import {
  LiquidGlassHoverCardRoot,
  LiquidGlassHoverCardTrigger,
  LiquidGlassHoverCardContent,
} from '../proto-ui/components/react';

export function LiquidGlassHoverCardDemo() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
      <LiquidGlassHoverCardRoot openDelay={150} closeDelay={200}>
        <LiquidGlassHoverCardTrigger>@proto-ui</LiquidGlassHoverCardTrigger>
        <LiquidGlassHoverCardContent side="bottom" align="center" sideOffset={8}>
          <div className="font-semibold">@proto-ui</div>
          <p className="text-muted-foreground">
            Host-neutral interaction protocols layered over translucent Liquid Glass surfaces.
          </p>
          <div className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
            Joined December 2024 · 4 framework adapters
          </div>
        </LiquidGlassHoverCardContent>
      </LiquidGlassHoverCardRoot>
    </div>
  );
}
    `),
    'demo-liquid-glass-hover-card-sides': formatCode(`
import {
  LiquidGlassHoverCardRoot,
  LiquidGlassHoverCardTrigger,
  LiquidGlassHoverCardContent,
} from '../proto-ui/components/react';

const SIDES = ['left', 'top', 'bottom', 'right'] as const;

export function LiquidGlassHoverCardSidesDemo() {
  return (
    <div className="flex flex-wrap justify-center gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
      {SIDES.map((side) => (
        <LiquidGlassHoverCardRoot key={side} openDelay={100} closeDelay={150}>
          <LiquidGlassHoverCardTrigger className="capitalize">{side}</LiquidGlassHoverCardTrigger>
          <LiquidGlassHoverCardContent side={side} align="center" sideOffset={8}>
            Floats on the {side} side of the trigger.
          </LiquidGlassHoverCardContent>
        </LiquidGlassHoverCardRoot>
      ))}
    </div>
  );
}
    `),
    'demo-liquid-glass-hover-card-material': formatCode(`
import {
  LiquidGlassHoverCardRoot,
  LiquidGlassHoverCardTrigger,
  LiquidGlassHoverCardContent,
} from '../proto-ui/components/react';

export function LiquidGlassHoverCardMaterialDemo() {
  return (
    <div className="flex flex-wrap justify-center gap-6 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
      <LiquidGlassHoverCardRoot openDelay={100} closeDelay={150}>
        <LiquidGlassHoverCardTrigger>Regular glass</LiquidGlassHoverCardTrigger>
        <LiquidGlassHoverCardContent variant="regular" material="auto" side="bottom" align="center" sideOffset={8}>
          Default floating translucency with concentric inner corner radii.
        </LiquidGlassHoverCardContent>
      </LiquidGlassHoverCardRoot>
      <LiquidGlassHoverCardRoot openDelay={100} closeDelay={150}>
        <LiquidGlassHoverCardTrigger>Prominent tint</LiquidGlassHoverCardTrigger>
        <LiquidGlassHoverCardContent variant="prominent" material="auto" side="bottom" align="center" sideOffset={8}>
          Selective tinted prominence for primary callout previews.
        </LiquidGlassHoverCardContent>
      </LiquidGlassHoverCardRoot>
      <LiquidGlassHoverCardRoot openDelay={100} closeDelay={150}>
        <LiquidGlassHoverCardTrigger>Opaque fallback</LiquidGlassHoverCardTrigger>
        <LiquidGlassHoverCardContent variant="regular" material="opaque" side="bottom" align="center" sideOffset={8}>
          Opts out of optical glass while keeping crisp contrast and depth.
        </LiquidGlassHoverCardContent>
      </LiquidGlassHoverCardRoot>
    </div>
  );
}
    `),
    'demo-liquid-glass-hover-card-disabled': formatCode(`
import {
  LiquidGlassHoverCardRoot,
  LiquidGlassHoverCardTrigger,
  LiquidGlassHoverCardContent,
} from '../proto-ui/components/react';

export function LiquidGlassHoverCardDisabledDemo() {
  return (
    <div className="flex flex-wrap justify-center gap-6 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
      <LiquidGlassHoverCardRoot openDelay={100} closeDelay={150}>
        <LiquidGlassHoverCardTrigger>Active trigger</LiquidGlassHoverCardTrigger>
        <LiquidGlassHoverCardContent side="bottom" align="center" sideOffset={8}>
          Non-glass trigger avoids glass-on-glass stacking over the card.
        </LiquidGlassHoverCardContent>
      </LiquidGlassHoverCardRoot>
      <LiquidGlassHoverCardRoot disabled openDelay={100} closeDelay={150}>
        <LiquidGlassHoverCardTrigger>Disabled trigger</LiquidGlassHoverCardTrigger>
        <LiquidGlassHoverCardContent side="bottom" align="center" sideOffset={8}>
          Disabled cards stay closed without reducing text legibility.
        </LiquidGlassHoverCardContent>
      </LiquidGlassHoverCardRoot>
    </div>
  );
}
    `),
  },
  vue: {
    'demo-brutalist-hover-card': formatCode(`
<script setup lang="ts">
import {
  BrutalistHoverCardRoot,
  BrutalistHoverCardTrigger,
  BrutalistHoverCardContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistHoverCardRoot :open-delay="150" :close-delay="200">
    <BrutalistHoverCardTrigger>@proto-ui</BrutalistHoverCardTrigger>
    <BrutalistHoverCardContent side="bottom" align="center">
      <div class="font-heading text-sm font-bold">@proto-ui</div>
      <p class="text-sm">Host-neutral interaction protocols with bold Neo-Brutalist borders and hard shadows.</p>
      <span class="text-xs text-muted-foreground">Joined December 2024</span>
    </BrutalistHoverCardContent>
  </BrutalistHoverCardRoot>
</template>
    `),
    'demo-brutalist-hover-card-sides': formatCode(`
<script setup lang="ts">
import {
  BrutalistHoverCardRoot,
  BrutalistHoverCardTrigger,
  BrutalistHoverCardContent,
} from '../proto-ui/components/vue';

const sides = ['left', 'top', 'bottom', 'right'] as const;
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-3">
    <BrutalistHoverCardRoot v-for="side in sides" :key="side" :open-delay="100" :close-delay="150">
      <BrutalistHoverCardTrigger class="capitalize">{{ side }}</BrutalistHoverCardTrigger>
      <BrutalistHoverCardContent :side="side" align="center" :side-offset="8">
        This preview panel opens on the {{ side }} side of the trigger.
      </BrutalistHoverCardContent>
    </BrutalistHoverCardRoot>
  </div>
</template>
    `),
    'demo-brutalist-hover-card-delays': formatCode(`
<script setup lang="ts">
import {
  BrutalistHoverCardRoot,
  BrutalistHoverCardTrigger,
  BrutalistHoverCardContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-6">
    <BrutalistHoverCardRoot :open-delay="50" :close-delay="100">
      <BrutalistHoverCardTrigger>Fast (50ms / 100ms)</BrutalistHoverCardTrigger>
      <BrutalistHoverCardContent side="bottom" align="center" :side-offset="8">
        Opens after 50ms and closes 100ms after leaving.
      </BrutalistHoverCardContent>
    </BrutalistHoverCardRoot>
    <BrutalistHoverCardRoot :open-delay="400" :close-delay="300">
      <BrutalistHoverCardTrigger>Standard (400ms / 300ms)</BrutalistHoverCardTrigger>
      <BrutalistHoverCardContent side="bottom" align="center" :side-offset="8">
        Waits 400ms before opening to prevent stray hover cards.
      </BrutalistHoverCardContent>
    </BrutalistHoverCardRoot>
  </div>
</template>
    `),
    'demo-brutalist-hover-card-disabled': formatCode(`
<script setup lang="ts">
import {
  BrutalistHoverCardRoot,
  BrutalistHoverCardTrigger,
  BrutalistHoverCardContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-6">
    <BrutalistHoverCardRoot :open-delay="100" :close-delay="150">
      <BrutalistHoverCardTrigger>Active trigger</BrutalistHoverCardTrigger>
      <BrutalistHoverCardContent side="bottom" align="center" :side-offset="8">
        Hover or focus the trigger to inspect this preview panel.
      </BrutalistHoverCardContent>
    </BrutalistHoverCardRoot>
    <BrutalistHoverCardRoot disabled :open-delay="100" :close-delay="150">
      <BrutalistHoverCardTrigger>Disabled trigger</BrutalistHoverCardTrigger>
      <BrutalistHoverCardContent side="bottom" align="center" :side-offset="8">
        Disabled previews remain closed.
      </BrutalistHoverCardContent>
    </BrutalistHoverCardRoot>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-hover-card': formatCode(`
<script setup lang="ts">
import {
  BootstrapHoverCardRoot,
  BootstrapHoverCardTrigger,
  BootstrapHoverCardContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <BootstrapHoverCardRoot :open-delay="150" :close-delay="250">
    <BootstrapHoverCardTrigger>@proto-ui</BootstrapHoverCardTrigger>
    <BootstrapHoverCardContent side="bottom" align="center" :side-offset="6">
      <div class="font-bold text-sm">Proto UI</div>
      <p class="text-sm">Host-neutral interaction protocols rendered with classic Bootstrap 2.3.2 popover chrome.</p>
      <span class="text-xs text-muted-foreground">Joined December 2024</span>
    </BootstrapHoverCardContent>
  </BootstrapHoverCardRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-hover-card-sides': formatCode(`
<script setup lang="ts">
import {
  BootstrapHoverCardRoot,
  BootstrapHoverCardTrigger,
  BootstrapHoverCardContent,
} from '../proto-ui/components/vue';

const sides = ['left', 'top', 'bottom', 'right'] as const;
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-4">
    <BootstrapHoverCardRoot v-for="side in sides" :key="side" :open-delay="100" :close-delay="150">
      <BootstrapHoverCardTrigger class="capitalize">{{ side }}</BootstrapHoverCardTrigger>
      <BootstrapHoverCardContent :side="side" align="center" :side-offset="6">
        Opens on the {{ side }} side of the link trigger.
      </BootstrapHoverCardContent>
    </BootstrapHoverCardRoot>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-hover-card-delays': formatCode(`
<script setup lang="ts">
import {
  BootstrapHoverCardRoot,
  BootstrapHoverCardTrigger,
  BootstrapHoverCardContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-6">
    <BootstrapHoverCardRoot :open-delay="50" :close-delay="100">
      <BootstrapHoverCardTrigger>Quick preview (50ms)</BootstrapHoverCardTrigger>
      <BootstrapHoverCardContent side="bottom" align="center" :side-offset="6">
        Appears after 50ms with the classic 150ms linear fade.
      </BootstrapHoverCardContent>
    </BootstrapHoverCardRoot>
    <BootstrapHoverCardRoot :open-delay="450" :close-delay="300">
      <BootstrapHoverCardTrigger>Standard preview (450ms)</BootstrapHoverCardTrigger>
      <BootstrapHoverCardContent side="bottom" align="center" :side-offset="6">
        Waits 450ms before opening and stays open while hovered.
      </BootstrapHoverCardContent>
    </BootstrapHoverCardRoot>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-hover-card-disabled': formatCode(`
<script setup lang="ts">
import {
  BootstrapHoverCardRoot,
  BootstrapHoverCardTrigger,
  BootstrapHoverCardContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-6">
    <BootstrapHoverCardRoot :open-delay="100" :close-delay="150">
      <BootstrapHoverCardTrigger>Active link</BootstrapHoverCardTrigger>
      <BootstrapHoverCardContent side="bottom" align="center" :side-offset="6">
        Hover or focus the link to show the Bootstrap 2.3.2 popover.
      </BootstrapHoverCardContent>
    </BootstrapHoverCardRoot>
    <BootstrapHoverCardRoot disabled :open-delay="100" :close-delay="150">
      <BootstrapHoverCardTrigger>Disabled link</BootstrapHoverCardTrigger>
      <BootstrapHoverCardContent side="bottom" align="center" :side-offset="6">
        Disabled links do not open a hover card.
      </BootstrapHoverCardContent>
    </BootstrapHoverCardRoot>
  </div>
</template>
    `),
    'demo-liquid-glass-hover-card': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassHoverCardRoot,
  LiquidGlassHoverCardTrigger,
  LiquidGlassHoverCardContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassHoverCardRoot :open-delay="150" :close-delay="200">
      <LiquidGlassHoverCardTrigger>@proto-ui</LiquidGlassHoverCardTrigger>
      <LiquidGlassHoverCardContent side="bottom" align="center" :side-offset="8">
        <div class="font-semibold">@proto-ui</div>
        <p class="text-muted-foreground">Host-neutral interaction protocols layered over translucent Liquid Glass surfaces.</p>
        <div class="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">Joined December 2024 · 4 framework adapters</div>
      </LiquidGlassHoverCardContent>
    </LiquidGlassHoverCardRoot>
  </div>
</template>
    `),
    'demo-liquid-glass-hover-card-sides': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassHoverCardRoot,
  LiquidGlassHoverCardTrigger,
  LiquidGlassHoverCardContent,
} from '../proto-ui/components/vue';

const sides = ['left', 'top', 'bottom', 'right'] as const;
</script>

<template>
  <div class="flex flex-wrap justify-center gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassHoverCardRoot v-for="side in sides" :key="side" :open-delay="100" :close-delay="150">
      <LiquidGlassHoverCardTrigger class="capitalize">{{ side }}</LiquidGlassHoverCardTrigger>
      <LiquidGlassHoverCardContent :side="side" align="center" :side-offset="8">
        Floats on the {{ side }} side of the trigger.
      </LiquidGlassHoverCardContent>
    </LiquidGlassHoverCardRoot>
  </div>
</template>
    `),
    'demo-liquid-glass-hover-card-material': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassHoverCardRoot,
  LiquidGlassHoverCardTrigger,
  LiquidGlassHoverCardContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap justify-center gap-6 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassHoverCardRoot :open-delay="100" :close-delay="150">
      <LiquidGlassHoverCardTrigger>Regular glass</LiquidGlassHoverCardTrigger>
      <LiquidGlassHoverCardContent variant="regular" material="auto" side="bottom" align="center" :side-offset="8">
        Default floating translucency with concentric inner corner radii.
      </LiquidGlassHoverCardContent>
    </LiquidGlassHoverCardRoot>
    <LiquidGlassHoverCardRoot :open-delay="100" :close-delay="150">
      <LiquidGlassHoverCardTrigger>Prominent tint</LiquidGlassHoverCardTrigger>
      <LiquidGlassHoverCardContent variant="prominent" material="auto" side="bottom" align="center" :side-offset="8">
        Selective tinted prominence for primary callout previews.
      </LiquidGlassHoverCardContent>
    </LiquidGlassHoverCardRoot>
    <LiquidGlassHoverCardRoot :open-delay="100" :close-delay="150">
      <LiquidGlassHoverCardTrigger>Opaque fallback</LiquidGlassHoverCardTrigger>
      <LiquidGlassHoverCardContent variant="regular" material="opaque" side="bottom" align="center" :side-offset="8">
        Opts out of optical glass while keeping crisp contrast and depth.
      </LiquidGlassHoverCardContent>
    </LiquidGlassHoverCardRoot>
  </div>
</template>
    `),
    'demo-liquid-glass-hover-card-disabled': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassHoverCardRoot,
  LiquidGlassHoverCardTrigger,
  LiquidGlassHoverCardContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap justify-center gap-6 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassHoverCardRoot :open-delay="100" :close-delay="150">
      <LiquidGlassHoverCardTrigger>Active trigger</LiquidGlassHoverCardTrigger>
      <LiquidGlassHoverCardContent side="bottom" align="center" :side-offset="8">
        Non-glass trigger avoids glass-on-glass stacking over the card.
      </LiquidGlassHoverCardContent>
    </LiquidGlassHoverCardRoot>
    <LiquidGlassHoverCardRoot disabled :open-delay="100" :close-delay="150">
      <LiquidGlassHoverCardTrigger>Disabled trigger</LiquidGlassHoverCardTrigger>
      <LiquidGlassHoverCardContent side="bottom" align="center" :side-offset="8">
        Disabled cards stay closed without reducing text legibility.
      </LiquidGlassHoverCardContent>
    </LiquidGlassHoverCardRoot>
  </div>
</template>
    `),
  },
  vue2: {
    'demo-brutalist-hover-card': formatCode(`
<template>
  <BrutalistHoverCardRoot :open-delay="150" :close-delay="200">
    <BrutalistHoverCardTrigger>@proto-ui</BrutalistHoverCardTrigger>
    <BrutalistHoverCardContent side="bottom" align="center">
      <div class="font-heading text-sm font-bold">@proto-ui</div>
      <p class="text-sm">Host-neutral interaction protocols with bold Neo-Brutalist borders and hard shadows.</p>
      <span class="text-xs text-muted-foreground">Joined December 2024</span>
    </BrutalistHoverCardContent>
  </BrutalistHoverCardRoot>
</template>

<script>
import {
  BrutalistHoverCardRoot,
  BrutalistHoverCardTrigger,
  BrutalistHoverCardContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistHoverCardRoot,
    BrutalistHoverCardTrigger,
    BrutalistHoverCardContent,
  },
};
</script>
    `),
    'demo-brutalist-hover-card-sides': formatCode(`
<template>
  <div class="flex flex-wrap items-center justify-center gap-3">
    <BrutalistHoverCardRoot v-for="side in sides" :key="side" :open-delay="100" :close-delay="150">
      <BrutalistHoverCardTrigger class="capitalize">{{ side }}</BrutalistHoverCardTrigger>
      <BrutalistHoverCardContent :side="side" align="center" :side-offset="8">
        This preview panel opens on the {{ side }} side of the trigger.
      </BrutalistHoverCardContent>
    </BrutalistHoverCardRoot>
  </div>
</template>

<script>
import {
  BrutalistHoverCardRoot,
  BrutalistHoverCardTrigger,
  BrutalistHoverCardContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistHoverCardRoot,
    BrutalistHoverCardTrigger,
    BrutalistHoverCardContent,
  },
  data() {
    return { sides: ['left', 'top', 'bottom', 'right'] };
  },
};
</script>
    `),
    'demo-brutalist-hover-card-delays': formatCode(`
<template>
  <div class="flex flex-wrap items-center justify-center gap-6">
    <BrutalistHoverCardRoot :open-delay="50" :close-delay="100">
      <BrutalistHoverCardTrigger>Fast (50ms / 100ms)</BrutalistHoverCardTrigger>
      <BrutalistHoverCardContent side="bottom" align="center" :side-offset="8">
        Opens after 50ms and closes 100ms after leaving.
      </BrutalistHoverCardContent>
    </BrutalistHoverCardRoot>
    <BrutalistHoverCardRoot :open-delay="400" :close-delay="300">
      <BrutalistHoverCardTrigger>Standard (400ms / 300ms)</BrutalistHoverCardTrigger>
      <BrutalistHoverCardContent side="bottom" align="center" :side-offset="8">
        Waits 400ms before opening to prevent stray hover cards.
      </BrutalistHoverCardContent>
    </BrutalistHoverCardRoot>
  </div>
</template>

<script>
import {
  BrutalistHoverCardRoot,
  BrutalistHoverCardTrigger,
  BrutalistHoverCardContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistHoverCardRoot,
    BrutalistHoverCardTrigger,
    BrutalistHoverCardContent,
  },
};
</script>
    `),
    'demo-brutalist-hover-card-disabled': formatCode(`
<template>
  <div class="flex flex-wrap items-center justify-center gap-6">
    <BrutalistHoverCardRoot :open-delay="100" :close-delay="150">
      <BrutalistHoverCardTrigger>Active trigger</BrutalistHoverCardTrigger>
      <BrutalistHoverCardContent side="bottom" align="center" :side-offset="8">
        Hover or focus the trigger to inspect this preview panel.
      </BrutalistHoverCardContent>
    </BrutalistHoverCardRoot>
    <BrutalistHoverCardRoot disabled :open-delay="100" :close-delay="150">
      <BrutalistHoverCardTrigger>Disabled trigger</BrutalistHoverCardTrigger>
      <BrutalistHoverCardContent side="bottom" align="center" :side-offset="8">
        Disabled previews remain closed.
      </BrutalistHoverCardContent>
    </BrutalistHoverCardRoot>
  </div>
</template>

<script>
import {
  BrutalistHoverCardRoot,
  BrutalistHoverCardTrigger,
  BrutalistHoverCardContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistHoverCardRoot,
    BrutalistHoverCardTrigger,
    BrutalistHoverCardContent,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-hover-card': formatCode(`
<template>
  <BootstrapHoverCardRoot :open-delay="150" :close-delay="250">
    <BootstrapHoverCardTrigger>@proto-ui</BootstrapHoverCardTrigger>
    <BootstrapHoverCardContent side="bottom" align="center" :side-offset="6">
      <div class="font-bold text-sm">Proto UI</div>
      <p class="text-sm">Host-neutral interaction protocols rendered with classic Bootstrap 2.3.2 popover chrome.</p>
      <span class="text-xs text-muted-foreground">Joined December 2024</span>
    </BootstrapHoverCardContent>
  </BootstrapHoverCardRoot>
</template>

<script>
import {
  BootstrapHoverCardRoot,
  BootstrapHoverCardTrigger,
  BootstrapHoverCardContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BootstrapHoverCardRoot,
    BootstrapHoverCardTrigger,
    BootstrapHoverCardContent,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-hover-card-sides': formatCode(`
<template>
  <div class="flex flex-wrap items-center justify-center gap-4">
    <BootstrapHoverCardRoot v-for="side in sides" :key="side" :open-delay="100" :close-delay="150">
      <BootstrapHoverCardTrigger class="capitalize">{{ side }}</BootstrapHoverCardTrigger>
      <BootstrapHoverCardContent :side="side" align="center" :side-offset="6">
        Opens on the {{ side }} side of the link trigger.
      </BootstrapHoverCardContent>
    </BootstrapHoverCardRoot>
  </div>
</template>

<script>
import {
  BootstrapHoverCardRoot,
  BootstrapHoverCardTrigger,
  BootstrapHoverCardContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BootstrapHoverCardRoot,
    BootstrapHoverCardTrigger,
    BootstrapHoverCardContent,
  },
  data() {
    return { sides: ['left', 'top', 'bottom', 'right'] };
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-hover-card-delays': formatCode(`
<template>
  <div class="flex flex-wrap items-center justify-center gap-6">
    <BootstrapHoverCardRoot :open-delay="50" :close-delay="100">
      <BootstrapHoverCardTrigger>Quick preview (50ms)</BootstrapHoverCardTrigger>
      <BootstrapHoverCardContent side="bottom" align="center" :side-offset="6">
        Appears after 50ms with the classic 150ms linear fade.
      </BootstrapHoverCardContent>
    </BootstrapHoverCardRoot>
    <BootstrapHoverCardRoot :open-delay="450" :close-delay="300">
      <BootstrapHoverCardTrigger>Standard preview (450ms)</BootstrapHoverCardTrigger>
      <BootstrapHoverCardContent side="bottom" align="center" :side-offset="6">
        Waits 450ms before opening and stays open while hovered.
      </BootstrapHoverCardContent>
    </BootstrapHoverCardRoot>
  </div>
</template>

<script>
import {
  BootstrapHoverCardRoot,
  BootstrapHoverCardTrigger,
  BootstrapHoverCardContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BootstrapHoverCardRoot,
    BootstrapHoverCardTrigger,
    BootstrapHoverCardContent,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-hover-card-disabled': formatCode(`
<template>
  <div class="flex flex-wrap items-center justify-center gap-6">
    <BootstrapHoverCardRoot :open-delay="100" :close-delay="150">
      <BootstrapHoverCardTrigger>Active link</BootstrapHoverCardTrigger>
      <BootstrapHoverCardContent side="bottom" align="center" :side-offset="6">
        Hover or focus the link to show the Bootstrap 2.3.2 popover.
      </BootstrapHoverCardContent>
    </BootstrapHoverCardRoot>
    <BootstrapHoverCardRoot disabled :open-delay="100" :close-delay="150">
      <BootstrapHoverCardTrigger>Disabled link</BootstrapHoverCardTrigger>
      <BootstrapHoverCardContent side="bottom" align="center" :side-offset="6">
        Disabled links do not open a hover card.
      </BootstrapHoverCardContent>
    </BootstrapHoverCardRoot>
  </div>
</template>

<script>
import {
  BootstrapHoverCardRoot,
  BootstrapHoverCardTrigger,
  BootstrapHoverCardContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BootstrapHoverCardRoot,
    BootstrapHoverCardTrigger,
    BootstrapHoverCardContent,
  },
};
</script>
    `),
    'demo-liquid-glass-hover-card': formatCode(`
<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassHoverCardRoot :open-delay="150" :close-delay="200">
      <LiquidGlassHoverCardTrigger>@proto-ui</LiquidGlassHoverCardTrigger>
      <LiquidGlassHoverCardContent side="bottom" align="center" :side-offset="8">
        <div class="font-semibold">@proto-ui</div>
        <p class="text-muted-foreground">Host-neutral interaction protocols layered over translucent Liquid Glass surfaces.</p>
        <div class="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">Joined December 2024 · 4 framework adapters</div>
      </LiquidGlassHoverCardContent>
    </LiquidGlassHoverCardRoot>
  </div>
</template>

<script>
import {
  LiquidGlassHoverCardRoot,
  LiquidGlassHoverCardTrigger,
  LiquidGlassHoverCardContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassHoverCardRoot,
    LiquidGlassHoverCardTrigger,
    LiquidGlassHoverCardContent,
  },
};
</script>
    `),
    'demo-liquid-glass-hover-card-sides': formatCode(`
<template>
  <div class="flex flex-wrap justify-center gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassHoverCardRoot v-for="side in sides" :key="side" :open-delay="100" :close-delay="150">
      <LiquidGlassHoverCardTrigger class="capitalize">{{ side }}</LiquidGlassHoverCardTrigger>
      <LiquidGlassHoverCardContent :side="side" align="center" :side-offset="8">
        Floats on the {{ side }} side of the trigger.
      </LiquidGlassHoverCardContent>
    </LiquidGlassHoverCardRoot>
  </div>
</template>

<script>
import {
  LiquidGlassHoverCardRoot,
  LiquidGlassHoverCardTrigger,
  LiquidGlassHoverCardContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassHoverCardRoot,
    LiquidGlassHoverCardTrigger,
    LiquidGlassHoverCardContent,
  },
  data() {
    return { sides: ['left', 'top', 'bottom', 'right'] };
  },
};
</script>
    `),
    'demo-liquid-glass-hover-card-material': formatCode(`
<template>
  <div class="flex flex-wrap justify-center gap-6 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassHoverCardRoot :open-delay="100" :close-delay="150">
      <LiquidGlassHoverCardTrigger>Regular glass</LiquidGlassHoverCardTrigger>
      <LiquidGlassHoverCardContent variant="regular" material="auto" side="bottom" align="center" :side-offset="8">
        Default floating translucency with concentric inner corner radii.
      </LiquidGlassHoverCardContent>
    </LiquidGlassHoverCardRoot>
    <LiquidGlassHoverCardRoot :open-delay="100" :close-delay="150">
      <LiquidGlassHoverCardTrigger>Prominent tint</LiquidGlassHoverCardTrigger>
      <LiquidGlassHoverCardContent variant="prominent" material="auto" side="bottom" align="center" :side-offset="8">
        Selective tinted prominence for primary callout previews.
      </LiquidGlassHoverCardContent>
    </LiquidGlassHoverCardRoot>
    <LiquidGlassHoverCardRoot :open-delay="100" :close-delay="150">
      <LiquidGlassHoverCardTrigger>Opaque fallback</LiquidGlassHoverCardTrigger>
      <LiquidGlassHoverCardContent variant="regular" material="opaque" side="bottom" align="center" :side-offset="8">
        Opts out of optical glass while keeping crisp contrast and depth.
      </LiquidGlassHoverCardContent>
    </LiquidGlassHoverCardRoot>
  </div>
</template>

<script>
import {
  LiquidGlassHoverCardRoot,
  LiquidGlassHoverCardTrigger,
  LiquidGlassHoverCardContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassHoverCardRoot,
    LiquidGlassHoverCardTrigger,
    LiquidGlassHoverCardContent,
  },
};
</script>
    `),
    'demo-liquid-glass-hover-card-disabled': formatCode(`
<template>
  <div class="flex flex-wrap justify-center gap-6 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassHoverCardRoot :open-delay="100" :close-delay="150">
      <LiquidGlassHoverCardTrigger>Active trigger</LiquidGlassHoverCardTrigger>
      <LiquidGlassHoverCardContent side="bottom" align="center" :side-offset="8">
        Non-glass trigger avoids glass-on-glass stacking over the card.
      </LiquidGlassHoverCardContent>
    </LiquidGlassHoverCardRoot>
    <LiquidGlassHoverCardRoot disabled :open-delay="100" :close-delay="150">
      <LiquidGlassHoverCardTrigger>Disabled trigger</LiquidGlassHoverCardTrigger>
      <LiquidGlassHoverCardContent side="bottom" align="center" :side-offset="8">
        Disabled cards stay closed without reducing text legibility.
      </LiquidGlassHoverCardContent>
    </LiquidGlassHoverCardRoot>
  </div>
</template>

<script>
import {
  LiquidGlassHoverCardRoot,
  LiquidGlassHoverCardTrigger,
  LiquidGlassHoverCardContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassHoverCardRoot,
    LiquidGlassHoverCardTrigger,
    LiquidGlassHoverCardContent,
  },
};
</script>
    `),
  },
};
