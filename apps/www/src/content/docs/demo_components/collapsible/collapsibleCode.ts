import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-collapsible': formatCode(`
<div class="grid w-full max-w-lg gap-4">
  <proto-ui-shadcn-collapsible-root id="shipping-disclosure">
    <proto-ui-shadcn-collapsible-trigger>Order #4189 — Shipping & delivery details</proto-ui-shadcn-collapsible-trigger>
    <proto-ui-shadcn-collapsible-content>
      100 Market St, San Francisco, CA · 2x Studio Headphones · Standard Express (estimated arrival Friday).
    </proto-ui-shadcn-collapsible-content>
  </proto-ui-shadcn-collapsible-root>

  <proto-ui-shadcn-collapsible-root id="summary-disclosure">
    <proto-ui-shadcn-collapsible-trigger>Order summary (2 items)</proto-ui-shadcn-collapsible-trigger>
    <proto-ui-shadcn-collapsible-content id="summary-content">
      Studio Headphones (x2) — $398.00 · Free shipping applied.
    </proto-ui-shadcn-collapsible-content>
  </proto-ui-shadcn-collapsible-root>

  <proto-ui-shadcn-collapsible-root id="warranty-disclosure">
    <proto-ui-shadcn-collapsible-trigger>Warranty coverage (locked)</proto-ui-shadcn-collapsible-trigger>
    <proto-ui-shadcn-collapsible-content>
      2-year hardware protection is included with this order and stays open while locked.
    </proto-ui-shadcn-collapsible-content>
  </proto-ui-shadcn-collapsible-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#shipping-disclosure'), { styleProfile: 'rhea' });
  setElementProps(document.querySelector('#summary-disclosure'), { styleProfile: 'rhea', defaultOpen: true });
  setElementProps(document.querySelector('#summary-content'), { keepMounted: true });
  setElementProps(document.querySelector('#warranty-disclosure'), { styleProfile: 'rhea', defaultOpen: true, disabled: true });
</script>
    `),
    'demo-shadcn-collapsible-basic': formatCode(`
<div class="mx-auto w-full max-w-sm rounded-xl border border-border bg-card p-4">
  <proto-ui-shadcn-collapsible-root id="order-root">
    <div class="flex items-center justify-between gap-4 px-1">
      <h4 class="text-sm font-semibold">Order #4189</h4>
      <proto-ui-shadcn-collapsible-trigger id="order-trigger">↕</proto-ui-shadcn-collapsible-trigger>
    </div>
    <div class="flex items-center justify-between rounded-lg border px-3.5 py-2 text-sm">
      <span class="text-muted-foreground">Status</span>
      <span class="font-medium">Shipped</span>
    </div>
    <proto-ui-shadcn-collapsible-content id="order-content">
      <div class="grid gap-2">
        <div class="rounded-lg border px-3.5 py-2 text-sm">
          <p class="font-medium">Shipping address</p>
          <p class="text-muted-foreground">100 Market St, San Francisco</p>
        </div>
        <div class="rounded-lg border px-3.5 py-2 text-sm">
          <p class="font-medium">Items</p>
          <p class="text-muted-foreground">2x Studio Headphones</p>
        </div>
      </div>
    </proto-ui-shadcn-collapsible-content>
  </proto-ui-shadcn-collapsible-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#order-root'), { styleProfile: 'rhea' });
  setElementProps(document.querySelector('#order-trigger'), { variant: 'ghost', size: 'icon' });
  setElementProps(document.querySelector('#order-content'), { variant: 'plain' });
</script>
    `),
    'demo-shadcn-collapsible-controlled': formatCode(`
<div class="mx-auto grid w-full max-w-sm gap-3 rounded-xl border p-4">
  <div class="flex items-center justify-between">
    <span id="controlled-status" class="text-xs text-muted-foreground">Panel state: Closed</span>
    <proto-ui-shadcn-button id="controlled-btn">Toggle externally</proto-ui-shadcn-button>
  </div>
  <proto-ui-shadcn-collapsible-root id="controlled-root">
    <proto-ui-shadcn-collapsible-trigger id="controlled-trigger">Product details</proto-ui-shadcn-collapsible-trigger>
    <proto-ui-shadcn-collapsible-content>
      This panel is controlled through open and onOpenChange.
    </proto-ui-shadcn-collapsible-content>
  </proto-ui-shadcn-collapsible-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#controlled-root');
  const btn = document.querySelector('#controlled-btn');
  const status = document.querySelector('#controlled-status');
  let open = false;
  const sync = (next) => {
    open = next;
    setElementProps(root, { styleProfile: 'rhea', open, onOpenChange: (req) => sync(req.open) });
    status.textContent = 'Panel state: ' + (open ? 'Open' : 'Closed');
  };
  setElementProps(document.querySelector('#controlled-trigger'), { variant: 'ghost' });
  setElementProps(btn, { styleProfile: 'rhea', variant: 'outline', size: 'sm', onClick: () => sync(!open) });
  sync(false);
</script>
    `),
    'demo-shadcn-collapsible-settings': formatCode(`
<div class="mx-auto grid w-full max-w-xs gap-3 rounded-xl border p-4">
  <div>
    <h4 class="text-sm font-semibold">Radius</h4>
    <p class="text-xs text-muted-foreground">Set the corner radius of the element.</p>
  </div>
  <proto-ui-shadcn-collapsible-root id="settings-root">
    <div class="flex items-center gap-2">
      <div class="grid flex-1 grid-cols-2 gap-2">
        <div class="rounded-lg border px-3 py-1.5 text-xs">TL: 8px</div>
        <div class="rounded-lg border px-3 py-1.5 text-xs">TR: 8px</div>
      </div>
      <proto-ui-shadcn-collapsible-trigger id="settings-trigger">+</proto-ui-shadcn-collapsible-trigger>
    </div>
    <proto-ui-shadcn-collapsible-content id="settings-content">
      <div class="grid grid-cols-2 gap-2">
        <div class="rounded-lg border px-3 py-1.5 text-xs">BL: 8px</div>
        <div class="rounded-lg border px-3 py-1.5 text-xs">BR: 8px</div>
      </div>
    </proto-ui-shadcn-collapsible-content>
  </proto-ui-shadcn-collapsible-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#settings-root'), { styleProfile: 'rhea' });
  setElementProps(document.querySelector('#settings-trigger'), { variant: 'outline', size: 'icon' });
  setElementProps(document.querySelector('#settings-content'), { variant: 'plain' });
</script>
    `),
    'demo-shadcn-collapsible-file-tree': formatCode(`
<div class="mx-auto grid w-full max-w-xs gap-1.5 rounded-xl border p-3">
  <proto-ui-shadcn-collapsible-root id="folder-components">
    <proto-ui-shadcn-collapsible-trigger class="folder-trigger">▸ components</proto-ui-shadcn-collapsible-trigger>
    <proto-ui-shadcn-collapsible-content class="folder-content">
      <div class="grid gap-1 pl-4">
        <proto-ui-shadcn-collapsible-root id="folder-ui">
          <proto-ui-shadcn-collapsible-trigger class="folder-trigger">▸ ui</proto-ui-shadcn-collapsible-trigger>
          <proto-ui-shadcn-collapsible-content class="folder-content">
            <div class="grid gap-0.5 pl-4 text-sm text-muted-foreground">
              <span>• button.tsx</span>
              <span>• collapsible.tsx</span>
              <span>• dialog.tsx</span>
            </div>
          </proto-ui-shadcn-collapsible-content>
        </proto-ui-shadcn-collapsible-root>
        <span class="px-2.5 py-1 text-sm text-muted-foreground">• login-form.tsx</span>
      </div>
    </proto-ui-shadcn-collapsible-content>
  </proto-ui-shadcn-collapsible-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#folder-components'), { styleProfile: 'rhea', defaultOpen: true });
  setElementProps(document.querySelector('#folder-ui'), { styleProfile: 'rhea', defaultOpen: true });
  document.querySelectorAll('.folder-trigger').forEach((el) => setElementProps(el, { variant: 'ghost', size: 'sm' }));
  document.querySelectorAll('.folder-content').forEach((el) => setElementProps(el, { variant: 'plain' }));
</script>
    `),
    'demo-shadcn-collapsible-rtl': formatCode(`
<div dir="rtl" lang="ar" class="mx-auto w-full max-w-sm rounded-xl border p-4 text-start">
  <proto-ui-shadcn-collapsible-root id="rtl-root">
    <div class="flex items-center justify-between gap-4 px-1">
      <h4 class="text-sm font-semibold">الطلب #4189</h4>
      <proto-ui-shadcn-collapsible-trigger id="rtl-trigger">↕</proto-ui-shadcn-collapsible-trigger>
    </div>
    <div class="flex items-center justify-between rounded-lg border px-3.5 py-2 text-sm">
      <span class="text-muted-foreground">الحالة</span>
      <span class="font-medium">تم الشحن</span>
    </div>
    <proto-ui-shadcn-collapsible-content id="rtl-content">
      <div class="grid gap-2 text-start">
        <div class="rounded-lg border px-3.5 py-2 text-sm">
          <p class="font-medium">عنوان الشحن</p>
          <p class="text-muted-foreground">100 Market St, San Francisco</p>
        </div>
      </div>
    </proto-ui-shadcn-collapsible-content>
  </proto-ui-shadcn-collapsible-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#rtl-root'), { styleProfile: 'rhea' });
  setElementProps(document.querySelector('#rtl-trigger'), { variant: 'ghost', size: 'icon' });
  setElementProps(document.querySelector('#rtl-content'), { variant: 'plain' });
</script>
    `),
    'demo-brutalist-collapsible': formatCode(`
<div class="grid w-full max-w-lg gap-4">
  <proto-ui-brutalist-collapsible-root>
    <proto-ui-brutalist-collapsible-trigger>Order #4189 — Shipping & delivery details</proto-ui-brutalist-collapsible-trigger>
    <proto-ui-brutalist-collapsible-content>
      100 Market St, San Francisco, CA · 2x Studio Headphones · Standard Express.
    </proto-ui-brutalist-collapsible-content>
  </proto-ui-brutalist-collapsible-root>
</div>
    `),
    'demo-brutalist-collapsible-repositories': formatCode(`
<proto-ui-brutalist-collapsible-root>
  <div class="flex items-center justify-between rounded-base border-2 border-border bg-background px-4 py-2">
    <h4 class="text-sm font-heading font-bold">@peduarte starred 3 repositories</h4>
    <proto-ui-brutalist-collapsible-trigger id="repo-trigger">Toggle</proto-ui-brutalist-collapsible-trigger>
  </div>
  <div class="rounded-base border-2 border-border bg-background px-4 py-3 font-mono text-sm">
    @radix-ui/primitives
  </div>
  <proto-ui-brutalist-collapsible-content>
    <div class="grid gap-2 font-mono text-sm">
      <div class="rounded-base border-2 border-border bg-background px-4 py-3">@radix-ui/colors</div>
      <div class="rounded-base border-2 border-border bg-background px-4 py-3">@stitches/react</div>
    </div>
  </proto-ui-brutalist-collapsible-content>
</proto-ui-brutalist-collapsible-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#repo-trigger'), { variant: 'noShadow' });
</script>
    `),
    'demo-brutalist-collapsible-basic': formatCode(`
<div class="rounded-base border-2 border-border bg-secondary-background p-4 shadow-[4px_4px_0_0_#000]">
  <proto-ui-brutalist-collapsible-root>
    <proto-ui-brutalist-collapsible-trigger>Product details</proto-ui-brutalist-collapsible-trigger>
    <proto-ui-brutalist-collapsible-content>
      This panel expands and collapses to reveal additional product specifications.
    </proto-ui-brutalist-collapsible-content>
  </proto-ui-brutalist-collapsible-root>
</div>
    `),
    'demo-brutalist-collapsible-settings': formatCode(`
<div class="grid max-w-xs gap-3 rounded-base border-2 border-border bg-secondary-background p-4">
  <h4 class="text-sm font-heading font-bold">Radius</h4>
  <proto-ui-brutalist-collapsible-root>
    <proto-ui-brutalist-collapsible-trigger id="brutalist-settings-trigger">Show bottom corners</proto-ui-brutalist-collapsible-trigger>
    <proto-ui-brutalist-collapsible-content>
      Bottom left: 5px · Bottom right: 5px
    </proto-ui-brutalist-collapsible-content>
  </proto-ui-brutalist-collapsible-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#brutalist-settings-trigger'), { variant: 'neutral' });
</script>
    `),
    'demo-bootstrap-2-3-2-collapsible': formatCode(`
<proto-ui-bootstrap-2-3-2-collapsible-root>
  <proto-ui-bootstrap-2-3-2-collapsible-trigger>Order #4189 — Shipping & delivery details</proto-ui-bootstrap-2-3-2-collapsible-trigger>
  <proto-ui-bootstrap-2-3-2-collapsible-content>
    100 Market St, San Francisco, CA · 2x Studio Headphones · Standard Express.
  </proto-ui-bootstrap-2-3-2-collapsible-content>
</proto-ui-bootstrap-2-3-2-collapsible-root>
    `),
    'demo-bootstrap-2-3-2-collapsible-basic': formatCode(`
<proto-ui-bootstrap-2-3-2-collapsible-root>
  <proto-ui-bootstrap-2-3-2-collapsible-trigger>Order #4189 — Product details</proto-ui-bootstrap-2-3-2-collapsible-trigger>
  <proto-ui-bootstrap-2-3-2-collapsible-content>
    Status: Shipped · 100 Market St, San Francisco · 2x Studio Headphones.
  </proto-ui-bootstrap-2-3-2-collapsible-content>
</proto-ui-bootstrap-2-3-2-collapsible-root>
    `),
    'demo-bootstrap-2-3-2-collapsible-controlled': formatCode(`
<proto-ui-bootstrap-2-3-2-collapsible-root id="bs-controlled">
  <proto-ui-bootstrap-2-3-2-collapsible-trigger>Release notes — Bootstrap 2.3.2 collapse</proto-ui-bootstrap-2-3-2-collapsible-trigger>
  <proto-ui-bootstrap-2-3-2-collapsible-content>
    Smooth 350ms height transition controlled by external state.
  </proto-ui-bootstrap-2-3-2-collapsible-content>
</proto-ui-bootstrap-2-3-2-collapsible-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#bs-controlled');
  const sync = (open) => setElementProps(root, { open, onOpenChange: (req) => sync(req.open) });
  sync(false);
</script>
    `),
    'demo-bootstrap-2-3-2-collapsible-file-tree': formatCode(`
<proto-ui-bootstrap-2-3-2-collapsible-root id="bs-components">
  <proto-ui-bootstrap-2-3-2-collapsible-trigger>components/</proto-ui-bootstrap-2-3-2-collapsible-trigger>
  <proto-ui-bootstrap-2-3-2-collapsible-content>
    <proto-ui-bootstrap-2-3-2-collapsible-root>
      <proto-ui-bootstrap-2-3-2-collapsible-trigger>ui/</proto-ui-bootstrap-2-3-2-collapsible-trigger>
      <proto-ui-bootstrap-2-3-2-collapsible-content>button.tsx · collapsible.tsx · dialog.tsx</proto-ui-bootstrap-2-3-2-collapsible-content>
    </proto-ui-bootstrap-2-3-2-collapsible-root>
  </proto-ui-bootstrap-2-3-2-collapsible-content>
</proto-ui-bootstrap-2-3-2-collapsible-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#bs-components'), { defaultOpen: true });
</script>
    `),
    'demo-liquid-glass-collapsible': formatCode(`
<div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-5">
  <proto-ui-liquid-glass-collapsible-root>
    <proto-ui-liquid-glass-collapsible-trigger>Order #4189 — Shipping & delivery details</proto-ui-liquid-glass-collapsible-trigger>
    <proto-ui-liquid-glass-collapsible-content>
      100 Market St, San Francisco, CA · 2x Studio Headphones · Standard Express.
    </proto-ui-liquid-glass-collapsible-content>
  </proto-ui-liquid-glass-collapsible-root>
</div>
    `),
    'demo-liquid-glass-collapsible-basic': formatCode(`
<div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-5">
  <proto-ui-liquid-glass-collapsible-root>
    <proto-ui-liquid-glass-collapsible-trigger>Order #4189 — Product details</proto-ui-liquid-glass-collapsible-trigger>
    <proto-ui-liquid-glass-collapsible-content>
      Status: Shipped · 100 Market St, San Francisco · Content stays opaque for crisp legibility.
    </proto-ui-liquid-glass-collapsible-content>
  </proto-ui-liquid-glass-collapsible-root>
</div>
    `),
    'demo-liquid-glass-collapsible-prominence': formatCode(`
<div class="grid gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-5">
  <proto-ui-liquid-glass-collapsible-root>
    <proto-ui-liquid-glass-collapsible-trigger id="lg-prominent">Prominent glass trigger</proto-ui-liquid-glass-collapsible-trigger>
    <proto-ui-liquid-glass-collapsible-content>Primary tinted emphasis for high-priority disclosure actions.</proto-ui-liquid-glass-collapsible-content>
  </proto-ui-liquid-glass-collapsible-root>
  <proto-ui-liquid-glass-collapsible-root>
    <proto-ui-liquid-glass-collapsible-trigger id="lg-opaque">Opaque opt-out trigger</proto-ui-liquid-glass-collapsible-trigger>
    <proto-ui-liquid-glass-collapsible-content>Withdraws optical material intent while keeping the complete opaque surface.</proto-ui-liquid-glass-collapsible-content>
  </proto-ui-liquid-glass-collapsible-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#lg-prominent'), { variant: 'prominent', material: 'auto' });
  setElementProps(document.querySelector('#lg-opaque'), { variant: 'regular', material: 'opaque' });
</script>
    `),
    'demo-liquid-glass-collapsible-controlled': formatCode(`
<div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-5">
  <proto-ui-liquid-glass-collapsible-root id="lg-controlled">
    <proto-ui-liquid-glass-collapsible-trigger>Display & transparency settings</proto-ui-liquid-glass-collapsible-trigger>
    <proto-ui-liquid-glass-collapsible-content>
      Controlled via open and onOpenChange over rich backdrops.
    </proto-ui-liquid-glass-collapsible-content>
  </proto-ui-liquid-glass-collapsible-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#lg-controlled');
  const sync = (open) => setElementProps(root, { open, onOpenChange: (req) => sync(req.open) });
  sync(false);
</script>
    `),
  },
  react: {
    'demo-shadcn-collapsible': formatCode(`
import { useState } from 'react';
import {
  ShadcnCollapsibleRoot,
  ShadcnCollapsibleTrigger,
  ShadcnCollapsibleContent,
  ShadcnButton,
} from '../proto-ui/components/react';

export function CollapsibleOverviewDemo() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<boolean | null>(null);

  return (
    <div className="grid w-full max-w-lg gap-4">
      <ShadcnCollapsibleRoot styleProfile="rhea">
        <ShadcnCollapsibleTrigger>Order #4189 — Shipping & delivery details</ShadcnCollapsibleTrigger>
        <ShadcnCollapsibleContent>
          100 Market St, San Francisco, CA · 2x Studio Headphones · Standard Express.
        </ShadcnCollapsibleContent>
      </ShadcnCollapsibleRoot>

      <ShadcnCollapsibleRoot styleProfile="rhea" defaultOpen>
        <ShadcnCollapsibleTrigger>Order summary (2 items)</ShadcnCollapsibleTrigger>
        <ShadcnCollapsibleContent keepMounted>
          Studio Headphones (x2) — $398.00 · Free shipping applied.
        </ShadcnCollapsibleContent>
      </ShadcnCollapsibleRoot>

      <ShadcnCollapsibleRoot styleProfile="rhea" defaultOpen disabled>
        <ShadcnCollapsibleTrigger>Warranty coverage (locked)</ShadcnCollapsibleTrigger>
        <ShadcnCollapsibleContent>
          2-year hardware protection is included with this order.
        </ShadcnCollapsibleContent>
      </ShadcnCollapsibleRoot>

      <ShadcnCollapsibleRoot
        styleProfile="rhea"
        open={open}
        onOpenChange={(req) => setPending(req.open)}
      >
        <ShadcnCollapsibleTrigger>Billing & invoice details</ShadcnCollapsibleTrigger>
        <ShadcnCollapsibleContent>
          Paid with Visa ending in 4242 · Invoice #INV-2026-4189 ready.
        </ShadcnCollapsibleContent>
      </ShadcnCollapsibleRoot>

      <ShadcnButton
        styleProfile="rhea"
        variant="outline"
        size="sm"
        onClick={() => {
          if (pending === null) return;
          setOpen(pending);
          setPending(null);
        }}
      >
        Accept
      </ShadcnButton>
    </div>
  );
}
    `),
    'demo-shadcn-collapsible-basic': formatCode(`
import {
  ShadcnCollapsibleRoot,
  ShadcnCollapsibleTrigger,
  ShadcnCollapsibleContent,
} from '../proto-ui/components/react';

export function CollapsibleBasicDemo() {
  return (
    <div className="mx-auto w-full max-w-sm rounded-xl border border-border bg-card p-4">
      <ShadcnCollapsibleRoot styleProfile="rhea">
        <div className="flex items-center justify-between gap-4 px-1">
          <h4 className="text-sm font-semibold">Order #4189</h4>
          <ShadcnCollapsibleTrigger variant="ghost" size="icon">
            ↕
          </ShadcnCollapsibleTrigger>
        </div>
        <div className="flex items-center justify-between rounded-lg border px-3.5 py-2 text-sm">
          <span className="text-muted-foreground">Status</span>
          <span className="font-medium">Shipped</span>
        </div>
        <ShadcnCollapsibleContent variant="plain">
          <div className="grid gap-2">
            <div className="rounded-lg border px-3.5 py-2 text-sm">
              <p className="font-medium">Shipping address</p>
              <p className="text-muted-foreground">100 Market St, San Francisco</p>
            </div>
            <div className="rounded-lg border px-3.5 py-2 text-sm">
              <p className="font-medium">Items</p>
              <p className="text-muted-foreground">2x Studio Headphones</p>
            </div>
          </div>
        </ShadcnCollapsibleContent>
      </ShadcnCollapsibleRoot>
    </div>
  );
}
    `),
    'demo-shadcn-collapsible-controlled': formatCode(`
import { useState } from 'react';
import {
  ShadcnCollapsibleRoot,
  ShadcnCollapsibleTrigger,
  ShadcnCollapsibleContent,
  ShadcnButton,
} from '../proto-ui/components/react';

export function CollapsibleControlledDemo() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto grid w-full max-w-sm gap-3 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Panel state: {open ? 'Open' : 'Closed'}
        </span>
        <ShadcnButton
          styleProfile="rhea"
          variant="outline"
          size="sm"
          onClick={() => setOpen((prev) => !prev)}
        >
          Toggle externally
        </ShadcnButton>
      </div>
      <ShadcnCollapsibleRoot
        styleProfile="rhea"
        open={open}
        onOpenChange={(request) => setOpen(request.open)}
      >
        <ShadcnCollapsibleTrigger variant="ghost">Product details</ShadcnCollapsibleTrigger>
        <ShadcnCollapsibleContent>
          This panel is controlled through the open prop and onOpenChange callback.
        </ShadcnCollapsibleContent>
      </ShadcnCollapsibleRoot>
    </div>
  );
}
    `),
    'demo-shadcn-collapsible-settings': formatCode(`
import { useState } from 'react';
import {
  ShadcnCollapsibleRoot,
  ShadcnCollapsibleTrigger,
  ShadcnCollapsibleContent,
} from '../proto-ui/components/react';

export function CollapsibleSettingsDemo() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto grid w-full max-w-xs gap-3 rounded-xl border p-4">
      <div>
        <h4 className="text-sm font-semibold">Radius</h4>
        <p className="text-xs text-muted-foreground">Set the corner radius of the element.</p>
      </div>
      <ShadcnCollapsibleRoot
        styleProfile="rhea"
        open={open}
        onOpenChange={(request) => setOpen(request.open)}
      >
        <div className="flex items-center gap-2">
          <div className="grid flex-1 grid-cols-2 gap-2">
            <div className="rounded-lg border px-3 py-1.5 text-xs">TL: 8px</div>
            <div className="rounded-lg border px-3 py-1.5 text-xs">TR: 8px</div>
          </div>
          <ShadcnCollapsibleTrigger variant="outline" size="icon">
            {open ? '−' : '+'}
          </ShadcnCollapsibleTrigger>
        </div>
        <ShadcnCollapsibleContent variant="plain">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border px-3 py-1.5 text-xs">BL: 8px</div>
            <div className="rounded-lg border px-3 py-1.5 text-xs">BR: 8px</div>
          </div>
        </ShadcnCollapsibleContent>
      </ShadcnCollapsibleRoot>
    </div>
  );
}
    `),
    'demo-shadcn-collapsible-file-tree': formatCode(`
import {
  ShadcnCollapsibleRoot,
  ShadcnCollapsibleTrigger,
  ShadcnCollapsibleContent,
} from '../proto-ui/components/react';

export function CollapsibleFileTreeDemo() {
  return (
    <div className="mx-auto grid w-full max-w-xs gap-1.5 rounded-xl border p-3">
      <ShadcnCollapsibleRoot styleProfile="rhea" defaultOpen>
        <ShadcnCollapsibleTrigger variant="ghost" size="sm">▸ components</ShadcnCollapsibleTrigger>
        <ShadcnCollapsibleContent variant="plain">
          <div className="grid gap-1 pl-4">
            <ShadcnCollapsibleRoot styleProfile="rhea" defaultOpen>
              <ShadcnCollapsibleTrigger variant="ghost" size="sm">▸ ui</ShadcnCollapsibleTrigger>
              <ShadcnCollapsibleContent variant="plain">
                <div className="grid gap-0.5 pl-4 text-sm text-muted-foreground">
                  <span>• button.tsx</span>
                  <span>• collapsible.tsx</span>
                  <span>• dialog.tsx</span>
                </div>
              </ShadcnCollapsibleContent>
            </ShadcnCollapsibleRoot>
            <span className="px-2.5 py-1 text-sm text-muted-foreground">• login-form.tsx</span>
          </div>
        </ShadcnCollapsibleContent>
      </ShadcnCollapsibleRoot>
    </div>
  );
}
    `),
    'demo-shadcn-collapsible-rtl': formatCode(`
import {
  ShadcnCollapsibleRoot,
  ShadcnCollapsibleTrigger,
  ShadcnCollapsibleContent,
} from '../proto-ui/components/react';

export function CollapsibleRtlDemo() {
  return (
    <div dir="rtl" lang="ar" className="mx-auto w-full max-w-sm rounded-xl border p-4 text-start">
      <ShadcnCollapsibleRoot styleProfile="rhea">
        <div className="flex items-center justify-between gap-4 px-1">
          <h4 className="text-sm font-semibold">الطلب #4189</h4>
          <ShadcnCollapsibleTrigger variant="ghost" size="icon">↕</ShadcnCollapsibleTrigger>
        </div>
        <div className="flex items-center justify-between rounded-lg border px-3.5 py-2 text-sm">
          <span className="text-muted-foreground">الحالة</span>
          <span className="font-medium">تم الشحن</span>
        </div>
        <ShadcnCollapsibleContent variant="plain">
          <div className="grid gap-2 text-start">
            <div className="rounded-lg border px-3.5 py-2 text-sm">
              <p className="font-medium">عنوان الشحن</p>
              <p className="text-muted-foreground">100 Market St, San Francisco</p>
            </div>
          </div>
        </ShadcnCollapsibleContent>
      </ShadcnCollapsibleRoot>
    </div>
  );
}
    `),
    'demo-brutalist-collapsible': formatCode(`
import {
  BrutalistCollapsibleRoot,
  BrutalistCollapsibleTrigger,
  BrutalistCollapsibleContent,
} from '../proto-ui/components/react';

export function BrutalistCollapsibleDemo() {
  return (
    <BrutalistCollapsibleRoot>
      <BrutalistCollapsibleTrigger>Order #4189 — Shipping & delivery details</BrutalistCollapsibleTrigger>
      <BrutalistCollapsibleContent>
        100 Market St, San Francisco, CA · 2x Studio Headphones · Standard Express.
      </BrutalistCollapsibleContent>
    </BrutalistCollapsibleRoot>
  );
}
    `),
    'demo-brutalist-collapsible-repositories': formatCode(`
import {
  BrutalistCollapsibleRoot,
  BrutalistCollapsibleTrigger,
  BrutalistCollapsibleContent,
} from '../proto-ui/components/react';

export function BrutalistRepositoriesDemo() {
  return (
    <BrutalistCollapsibleRoot>
      <div className="flex items-center justify-between rounded-base border-2 border-border bg-background px-4 py-2">
        <h4 className="text-sm font-heading font-bold">@peduarte starred 3 repositories</h4>
        <BrutalistCollapsibleTrigger variant="noShadow">Toggle</BrutalistCollapsibleTrigger>
      </div>
      <div className="rounded-base border-2 border-border bg-background px-4 py-3 font-mono text-sm">
        @radix-ui/primitives
      </div>
      <BrutalistCollapsibleContent>
        <div className="grid gap-2 font-mono text-sm">
          <div className="rounded-base border-2 border-border bg-background px-4 py-3">@radix-ui/colors</div>
          <div className="rounded-base border-2 border-border bg-background px-4 py-3">@stitches/react</div>
        </div>
      </BrutalistCollapsibleContent>
    </BrutalistCollapsibleRoot>
  );
}
    `),
    'demo-brutalist-collapsible-basic': formatCode(`
import {
  BrutalistCollapsibleRoot,
  BrutalistCollapsibleTrigger,
  BrutalistCollapsibleContent,
  BrutalistButton,
} from '../proto-ui/components/react';

export function BrutalistBasicDemo() {
  return (
    <div className="rounded-base border-2 border-border bg-secondary-background p-4 shadow-[4px_4px_0_0_#000]">
      <BrutalistCollapsibleRoot>
        <BrutalistCollapsibleTrigger>Product details</BrutalistCollapsibleTrigger>
        <BrutalistCollapsibleContent>
          <div className="grid gap-3">
            <p className="text-sm">This panel expands and collapses to reveal additional product specifications.</p>
            <BrutalistButton variant="neutral" size="sm">Learn More</BrutalistButton>
          </div>
        </BrutalistCollapsibleContent>
      </BrutalistCollapsibleRoot>
    </div>
  );
}
    `),
    'demo-brutalist-collapsible-settings': formatCode(`
import { useState } from 'react';
import {
  BrutalistCollapsibleRoot,
  BrutalistCollapsibleTrigger,
  BrutalistCollapsibleContent,
} from '../proto-ui/components/react';

export function BrutalistSettingsDemo() {
  const [open, setOpen] = useState(false);

  return (
    <div className="grid max-w-xs gap-3 rounded-base border-2 border-border bg-secondary-background p-4">
      <h4 className="text-sm font-heading font-bold">Radius</h4>
      <BrutalistCollapsibleRoot open={open} onOpenChange={(req) => setOpen(req.open)}>
        <BrutalistCollapsibleTrigger variant="neutral">
          {open ? 'Hide bottom corners' : 'Show bottom corners'}
        </BrutalistCollapsibleTrigger>
        <BrutalistCollapsibleContent>
          Bottom left: 5px · Bottom right: 5px
        </BrutalistCollapsibleContent>
      </BrutalistCollapsibleRoot>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-collapsible': formatCode(`
import {
  Bootstrap232CollapsibleRoot,
  Bootstrap232CollapsibleTrigger,
  Bootstrap232CollapsibleContent,
} from '../proto-ui/components/react';

export function BootstrapCollapsibleDemo() {
  return (
    <Bootstrap232CollapsibleRoot>
      <Bootstrap232CollapsibleTrigger>Order #4189 — Shipping & delivery details</Bootstrap232CollapsibleTrigger>
      <Bootstrap232CollapsibleContent>
        100 Market St, San Francisco, CA · 2x Studio Headphones · Standard Express.
      </Bootstrap232CollapsibleContent>
    </Bootstrap232CollapsibleRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-collapsible-basic': formatCode(`
import {
  Bootstrap232CollapsibleRoot,
  Bootstrap232CollapsibleTrigger,
  Bootstrap232CollapsibleContent,
  Bootstrap232Button,
} from '../proto-ui/components/react';

export function BootstrapBasicDemo() {
  return (
    <Bootstrap232CollapsibleRoot>
      <Bootstrap232CollapsibleTrigger>Order #4189 — Product details</Bootstrap232CollapsibleTrigger>
      <Bootstrap232CollapsibleContent>
        <div className="grid gap-3">
          <p>Status: Shipped · 100 Market St, San Francisco · 2x Studio Headphones.</p>
          <Bootstrap232Button variant="primary">View invoice</Bootstrap232Button>
        </div>
      </Bootstrap232CollapsibleContent>
    </Bootstrap232CollapsibleRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-collapsible-controlled': formatCode(`
import { useState } from 'react';
import {
  Bootstrap232CollapsibleRoot,
  Bootstrap232CollapsibleTrigger,
  Bootstrap232CollapsibleContent,
  Bootstrap232Button,
} from '../proto-ui/components/react';

export function BootstrapControlledDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-3">
      <Bootstrap232Button onClick={() => setOpen((prev) => !prev)}>
        {open ? 'Collapse panel' : 'Expand panel'}
      </Bootstrap232Button>
      <Bootstrap232CollapsibleRoot open={open} onOpenChange={(req) => setOpen(req.open)}>
        <Bootstrap232CollapsibleTrigger>Release notes — Bootstrap 2.3.2 collapse</Bootstrap232CollapsibleTrigger>
        <Bootstrap232CollapsibleContent>
          Smooth 350ms height transition controlled by external state.
        </Bootstrap232CollapsibleContent>
      </Bootstrap232CollapsibleRoot>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-collapsible-file-tree': formatCode(`
import {
  Bootstrap232CollapsibleRoot,
  Bootstrap232CollapsibleTrigger,
  Bootstrap232CollapsibleContent,
} from '../proto-ui/components/react';

export function BootstrapFileTreeDemo() {
  return (
    <Bootstrap232CollapsibleRoot defaultOpen>
      <Bootstrap232CollapsibleTrigger>components/</Bootstrap232CollapsibleTrigger>
      <Bootstrap232CollapsibleContent>
        <Bootstrap232CollapsibleRoot>
          <Bootstrap232CollapsibleTrigger>ui/</Bootstrap232CollapsibleTrigger>
          <Bootstrap232CollapsibleContent>
            button.tsx · collapsible.tsx · dialog.tsx
          </Bootstrap232CollapsibleContent>
        </Bootstrap232CollapsibleRoot>
      </Bootstrap232CollapsibleContent>
    </Bootstrap232CollapsibleRoot>
  );
}
    `),
    'demo-liquid-glass-collapsible': formatCode(`
import {
  LiquidGlassCollapsibleRoot,
  LiquidGlassCollapsibleTrigger,
  LiquidGlassCollapsibleContent,
} from '../proto-ui/components/react';

export function LiquidGlassCollapsibleDemo() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-5">
      <LiquidGlassCollapsibleRoot>
        <LiquidGlassCollapsibleTrigger>Order #4189 — Shipping & delivery details</LiquidGlassCollapsibleTrigger>
        <LiquidGlassCollapsibleContent>
          100 Market St, San Francisco, CA · 2x Studio Headphones · Standard Express.
        </LiquidGlassCollapsibleContent>
      </LiquidGlassCollapsibleRoot>
    </div>
  );
}
    `),
    'demo-liquid-glass-collapsible-basic': formatCode(`
import {
  LiquidGlassCollapsibleRoot,
  LiquidGlassCollapsibleTrigger,
  LiquidGlassCollapsibleContent,
  LiquidGlassButton,
} from '../proto-ui/components/react';

export function LiquidGlassBasicDemo() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-5">
      <LiquidGlassCollapsibleRoot>
        <LiquidGlassCollapsibleTrigger>Order #4189 — Product details</LiquidGlassCollapsibleTrigger>
        <LiquidGlassCollapsibleContent>
          <div className="grid gap-3">
            <p>Status: Shipped · Content stays opaque for crisp legibility.</p>
            <LiquidGlassButton variant="prominent">Learn More</LiquidGlassButton>
          </div>
        </LiquidGlassCollapsibleContent>
      </LiquidGlassCollapsibleRoot>
    </div>
  );
}
    `),
    'demo-liquid-glass-collapsible-prominence': formatCode(`
import {
  LiquidGlassCollapsibleRoot,
  LiquidGlassCollapsibleTrigger,
  LiquidGlassCollapsibleContent,
} from '../proto-ui/components/react';

export function LiquidGlassProminenceDemo() {
  return (
    <div className="grid gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-5">
      <LiquidGlassCollapsibleRoot>
        <LiquidGlassCollapsibleTrigger variant="regular" material="auto">
          Regular glass trigger
        </LiquidGlassCollapsibleTrigger>
        <LiquidGlassCollapsibleContent>Default neutral liquid-glass control.</LiquidGlassCollapsibleContent>
      </LiquidGlassCollapsibleRoot>
      <LiquidGlassCollapsibleRoot>
        <LiquidGlassCollapsibleTrigger variant="prominent" material="auto">
          Prominent glass trigger
        </LiquidGlassCollapsibleTrigger>
        <LiquidGlassCollapsibleContent>Primary tinted emphasis.</LiquidGlassCollapsibleContent>
      </LiquidGlassCollapsibleRoot>
      <LiquidGlassCollapsibleRoot>
        <LiquidGlassCollapsibleTrigger variant="regular" material="opaque">
          Opaque opt-out trigger
        </LiquidGlassCollapsibleTrigger>
        <LiquidGlassCollapsibleContent>Withdraws optical material intent cleanly.</LiquidGlassCollapsibleContent>
      </LiquidGlassCollapsibleRoot>
    </div>
  );
}
    `),
    'demo-liquid-glass-collapsible-controlled': formatCode(`
import { useState } from 'react';
import {
  LiquidGlassCollapsibleRoot,
  LiquidGlassCollapsibleTrigger,
  LiquidGlassCollapsibleContent,
  LiquidGlassButton,
} from '../proto-ui/components/react';

export function LiquidGlassControlledDemo() {
  const [open, setOpen] = useState(false);

  return (
    <div className="grid gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-5">
      <LiquidGlassButton onClick={() => setOpen((prev) => !prev)}>
        {open ? 'Collapse panel' : 'Expand panel'}
      </LiquidGlassButton>
      <LiquidGlassCollapsibleRoot open={open} onOpenChange={(req) => setOpen(req.open)}>
        <LiquidGlassCollapsibleTrigger>Display & transparency settings</LiquidGlassCollapsibleTrigger>
        <LiquidGlassCollapsibleContent>
          Controlled via open and onOpenChange over layered backdrops.
        </LiquidGlassCollapsibleContent>
      </LiquidGlassCollapsibleRoot>
    </div>
  );
}
    `),
  },
  vue: {
    'demo-shadcn-collapsible': formatCode(`
<script setup lang="ts">
import {
  ShadcnCollapsibleRoot,
  ShadcnCollapsibleTrigger,
  ShadcnCollapsibleContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="grid w-full max-w-lg gap-4">
    <ShadcnCollapsibleRoot styleProfile="rhea">
      <ShadcnCollapsibleTrigger>Order #4189 — Shipping & delivery details</ShadcnCollapsibleTrigger>
      <ShadcnCollapsibleContent>
        100 Market St, San Francisco, CA · 2x Studio Headphones · Standard Express.
      </ShadcnCollapsibleContent>
    </ShadcnCollapsibleRoot>
    <ShadcnCollapsibleRoot styleProfile="rhea" :defaultOpen="true">
      <ShadcnCollapsibleTrigger>Order summary (2 items)</ShadcnCollapsibleTrigger>
      <ShadcnCollapsibleContent :keepMounted="true">
        Studio Headphones (x2) — $398.00 · Free shipping applied.
      </ShadcnCollapsibleContent>
    </ShadcnCollapsibleRoot>
  </div>
</template>
    `),
    'demo-shadcn-collapsible-basic': formatCode(`
<script setup lang="ts">
import {
  ShadcnCollapsibleRoot,
  ShadcnCollapsibleTrigger,
  ShadcnCollapsibleContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="mx-auto w-full max-w-sm rounded-xl border bg-card p-4">
    <ShadcnCollapsibleRoot styleProfile="rhea">
      <div class="flex items-center justify-between gap-4 px-1">
        <h4 class="text-sm font-semibold">Order #4189</h4>
        <ShadcnCollapsibleTrigger variant="ghost" size="icon">↕</ShadcnCollapsibleTrigger>
      </div>
      <div class="flex items-center justify-between rounded-lg border px-3.5 py-2 text-sm">
        <span class="text-muted-foreground">Status</span>
        <span class="font-medium">Shipped</span>
      </div>
      <ShadcnCollapsibleContent variant="plain">
        <div class="rounded-lg border px-3.5 py-2 text-sm">
          <p class="font-medium">Shipping address</p>
          <p class="text-muted-foreground">100 Market St, San Francisco</p>
        </div>
      </ShadcnCollapsibleContent>
    </ShadcnCollapsibleRoot>
  </div>
</template>
    `),
    'demo-shadcn-collapsible-controlled': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  ShadcnCollapsibleRoot,
  ShadcnCollapsibleTrigger,
  ShadcnCollapsibleContent,
  ShadcnButton,
} from '../proto-ui/components/vue';

const open = ref(false);
</script>

<template>
  <div class="mx-auto grid w-full max-w-sm gap-3 rounded-xl border p-4">
    <ShadcnButton styleProfile="rhea" variant="outline" size="sm" @click="open = !open">
      Toggle externally
    </ShadcnButton>
    <ShadcnCollapsibleRoot styleProfile="rhea" :open="open" @openChange="(req) => (open = req.open)">
      <ShadcnCollapsibleTrigger variant="ghost">Product details</ShadcnCollapsibleTrigger>
      <ShadcnCollapsibleContent>Controlled via open and openChange.</ShadcnCollapsibleContent>
    </ShadcnCollapsibleRoot>
  </div>
</template>
    `),
    'demo-shadcn-collapsible-settings': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  ShadcnCollapsibleRoot,
  ShadcnCollapsibleTrigger,
  ShadcnCollapsibleContent,
} from '../proto-ui/components/vue';

const open = ref(false);
</script>

<template>
  <ShadcnCollapsibleRoot styleProfile="rhea" :open="open" @openChange="(req) => (open = req.open)">
    <div class="flex items-center gap-2">
      <div class="grid flex-1 grid-cols-2 gap-2 text-xs">
        <div class="rounded-lg border px-3 py-1.5">TL: 8px</div>
        <div class="rounded-lg border px-3 py-1.5">TR: 8px</div>
      </div>
      <ShadcnCollapsibleTrigger variant="outline" size="icon">{{ open ? '−' : '+' }}</ShadcnCollapsibleTrigger>
    </div>
    <ShadcnCollapsibleContent variant="plain">
      <div class="grid grid-cols-2 gap-2 text-xs">
        <div class="rounded-lg border px-3 py-1.5">BL: 8px</div>
        <div class="rounded-lg border px-3 py-1.5">BR: 8px</div>
      </div>
    </ShadcnCollapsibleContent>
  </ShadcnCollapsibleRoot>
</template>
    `),
    'demo-shadcn-collapsible-file-tree': formatCode(`
<script setup lang="ts">
import {
  ShadcnCollapsibleRoot,
  ShadcnCollapsibleTrigger,
  ShadcnCollapsibleContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnCollapsibleRoot styleProfile="rhea" :defaultOpen="true">
    <ShadcnCollapsibleTrigger variant="ghost" size="sm">▸ components</ShadcnCollapsibleTrigger>
    <ShadcnCollapsibleContent variant="plain">
      <div class="pl-4">
        <ShadcnCollapsibleRoot styleProfile="rhea" :defaultOpen="true">
          <ShadcnCollapsibleTrigger variant="ghost" size="sm">▸ ui</ShadcnCollapsibleTrigger>
          <ShadcnCollapsibleContent variant="plain">
            <div class="grid gap-0.5 pl-4 text-sm text-muted-foreground">
              <span>• button.tsx</span>
              <span>• collapsible.tsx</span>
            </div>
          </ShadcnCollapsibleContent>
        </ShadcnCollapsibleRoot>
      </div>
    </ShadcnCollapsibleContent>
  </ShadcnCollapsibleRoot>
</template>
    `),
    'demo-shadcn-collapsible-rtl': formatCode(`
<script setup lang="ts">
import {
  ShadcnCollapsibleRoot,
  ShadcnCollapsibleTrigger,
  ShadcnCollapsibleContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <div dir="rtl" lang="ar" class="mx-auto w-full max-w-sm rounded-xl border p-4 text-start">
    <ShadcnCollapsibleRoot styleProfile="rhea">
      <div class="flex items-center justify-between gap-4 px-1">
        <h4 class="text-sm font-semibold">الطلب #4189</h4>
        <ShadcnCollapsibleTrigger variant="ghost" size="icon">↕</ShadcnCollapsibleTrigger>
      </div>
      <ShadcnCollapsibleContent variant="plain">
        <div class="rounded-lg border px-3.5 py-2 text-sm">عنوان الشحن · 100 Market St</div>
      </ShadcnCollapsibleContent>
    </ShadcnCollapsibleRoot>
  </div>
</template>
    `),
    'demo-brutalist-collapsible': formatCode(`
<script setup lang="ts">
import {
  BrutalistCollapsibleRoot,
  BrutalistCollapsibleTrigger,
  BrutalistCollapsibleContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistCollapsibleRoot>
    <BrutalistCollapsibleTrigger>Order #4189 — Shipping & delivery details</BrutalistCollapsibleTrigger>
    <BrutalistCollapsibleContent>100 Market St, San Francisco, CA · 2x Studio Headphones.</BrutalistCollapsibleContent>
  </BrutalistCollapsibleRoot>
</template>
    `),
    'demo-brutalist-collapsible-repositories': formatCode(`
<script setup lang="ts">
import {
  BrutalistCollapsibleRoot,
  BrutalistCollapsibleTrigger,
  BrutalistCollapsibleContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistCollapsibleRoot>
    <div class="flex items-center justify-between rounded-base border-2 border-border bg-background px-4 py-2">
      <h4 class="text-sm font-heading font-bold">@peduarte starred 3 repositories</h4>
      <BrutalistCollapsibleTrigger variant="noShadow">Toggle</BrutalistCollapsibleTrigger>
    </div>
    <BrutalistCollapsibleContent>@radix-ui/colors · @stitches/react</BrutalistCollapsibleContent>
  </BrutalistCollapsibleRoot>
</template>
    `),
    'demo-brutalist-collapsible-basic': formatCode(`
<script setup lang="ts">
import {
  BrutalistCollapsibleRoot,
  BrutalistCollapsibleTrigger,
  BrutalistCollapsibleContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistCollapsibleRoot>
    <BrutalistCollapsibleTrigger>Product details</BrutalistCollapsibleTrigger>
    <BrutalistCollapsibleContent>Additional product specifications.</BrutalistCollapsibleContent>
  </BrutalistCollapsibleRoot>
</template>
    `),
    'demo-brutalist-collapsible-settings': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  BrutalistCollapsibleRoot,
  BrutalistCollapsibleTrigger,
  BrutalistCollapsibleContent,
} from '../proto-ui/components/vue';

const open = ref(false);
</script>

<template>
  <BrutalistCollapsibleRoot :open="open" @openChange="(req) => (open = req.open)">
    <BrutalistCollapsibleTrigger variant="neutral">
      {{ open ? 'Hide bottom corners' : 'Show bottom corners' }}
    </BrutalistCollapsibleTrigger>
    <BrutalistCollapsibleContent>Bottom left: 5px · Bottom right: 5px</BrutalistCollapsibleContent>
  </BrutalistCollapsibleRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-collapsible': formatCode(`
<script setup lang="ts">
import {
  Bootstrap232CollapsibleRoot,
  Bootstrap232CollapsibleTrigger,
  Bootstrap232CollapsibleContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <Bootstrap232CollapsibleRoot>
    <Bootstrap232CollapsibleTrigger>Order #4189 — Shipping & delivery details</Bootstrap232CollapsibleTrigger>
    <Bootstrap232CollapsibleContent>100 Market St, San Francisco, CA · 2x Studio Headphones.</Bootstrap232CollapsibleContent>
  </Bootstrap232CollapsibleRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-collapsible-basic': formatCode(`
<script setup lang="ts">
import {
  Bootstrap232CollapsibleRoot,
  Bootstrap232CollapsibleTrigger,
  Bootstrap232CollapsibleContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <Bootstrap232CollapsibleRoot>
    <Bootstrap232CollapsibleTrigger>Order #4189 — Product details</Bootstrap232CollapsibleTrigger>
    <Bootstrap232CollapsibleContent>Status: Shipped · 2x Studio Headphones.</Bootstrap232CollapsibleContent>
  </Bootstrap232CollapsibleRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-collapsible-controlled': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  Bootstrap232CollapsibleRoot,
  Bootstrap232CollapsibleTrigger,
  Bootstrap232CollapsibleContent,
} from '../proto-ui/components/vue';

const open = ref(false);
</script>

<template>
  <Bootstrap232CollapsibleRoot :open="open" @openChange="(req) => (open = req.open)">
    <Bootstrap232CollapsibleTrigger>Release notes — Bootstrap 2.3.2 collapse</Bootstrap232CollapsibleTrigger>
    <Bootstrap232CollapsibleContent>Smooth 350ms height transition.</Bootstrap232CollapsibleContent>
  </Bootstrap232CollapsibleRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-collapsible-file-tree': formatCode(`
<script setup lang="ts">
import {
  Bootstrap232CollapsibleRoot,
  Bootstrap232CollapsibleTrigger,
  Bootstrap232CollapsibleContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <Bootstrap232CollapsibleRoot :defaultOpen="true">
    <Bootstrap232CollapsibleTrigger>components/</Bootstrap232CollapsibleTrigger>
    <Bootstrap232CollapsibleContent>
      <Bootstrap232CollapsibleRoot>
        <Bootstrap232CollapsibleTrigger>ui/</Bootstrap232CollapsibleTrigger>
        <Bootstrap232CollapsibleContent>button.tsx · collapsible.tsx</Bootstrap232CollapsibleContent>
      </Bootstrap232CollapsibleRoot>
    </Bootstrap232CollapsibleContent>
  </Bootstrap232CollapsibleRoot>
</template>
    `),
    'demo-liquid-glass-collapsible': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassCollapsibleRoot,
  LiquidGlassCollapsibleTrigger,
  LiquidGlassCollapsibleContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-5">
    <LiquidGlassCollapsibleRoot>
      <LiquidGlassCollapsibleTrigger>Order #4189 — Shipping & delivery details</LiquidGlassCollapsibleTrigger>
      <LiquidGlassCollapsibleContent>100 Market St, San Francisco, CA.</LiquidGlassCollapsibleContent>
    </LiquidGlassCollapsibleRoot>
  </div>
</template>
    `),
    'demo-liquid-glass-collapsible-basic': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassCollapsibleRoot,
  LiquidGlassCollapsibleTrigger,
  LiquidGlassCollapsibleContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-5">
    <LiquidGlassCollapsibleRoot>
      <LiquidGlassCollapsibleTrigger>Order #4189 — Product details</LiquidGlassCollapsibleTrigger>
      <LiquidGlassCollapsibleContent>Opaque reading surface over layered backdrop.</LiquidGlassCollapsibleContent>
    </LiquidGlassCollapsibleRoot>
  </div>
</template>
    `),
    'demo-liquid-glass-collapsible-prominence': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassCollapsibleRoot,
  LiquidGlassCollapsibleTrigger,
  LiquidGlassCollapsibleContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="grid gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-5">
    <LiquidGlassCollapsibleRoot>
      <LiquidGlassCollapsibleTrigger variant="prominent">Prominent glass trigger</LiquidGlassCollapsibleTrigger>
      <LiquidGlassCollapsibleContent>Primary tinted emphasis.</LiquidGlassCollapsibleContent>
    </LiquidGlassCollapsibleRoot>
    <LiquidGlassCollapsibleRoot>
      <LiquidGlassCollapsibleTrigger material="opaque">Opaque opt-out trigger</LiquidGlassCollapsibleTrigger>
      <LiquidGlassCollapsibleContent>Opaque fallback surface.</LiquidGlassCollapsibleContent>
    </LiquidGlassCollapsibleRoot>
  </div>
</template>
    `),
    'demo-liquid-glass-collapsible-controlled': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  LiquidGlassCollapsibleRoot,
  LiquidGlassCollapsibleTrigger,
  LiquidGlassCollapsibleContent,
} from '../proto-ui/components/vue';

const open = ref(false);
</script>

<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-5">
    <LiquidGlassCollapsibleRoot :open="open" @openChange="(req) => (open = req.open)">
      <LiquidGlassCollapsibleTrigger>Display & transparency settings</LiquidGlassCollapsibleTrigger>
      <LiquidGlassCollapsibleContent>Controlled via open and openChange.</LiquidGlassCollapsibleContent>
    </LiquidGlassCollapsibleRoot>
  </div>
</template>
    `),
  },
  vue2: {
    'demo-shadcn-collapsible': formatCode(`
<template>
  <div class="grid w-full max-w-lg gap-4">
    <ShadcnCollapsibleRoot styleProfile="rhea">
      <ShadcnCollapsibleTrigger>Order #4189 — Shipping & delivery details</ShadcnCollapsibleTrigger>
      <ShadcnCollapsibleContent>100 Market St, San Francisco, CA · 2x Studio Headphones.</ShadcnCollapsibleContent>
    </ShadcnCollapsibleRoot>
  </div>
</template>

<script>
import {
  ShadcnCollapsibleRoot,
  ShadcnCollapsibleTrigger,
  ShadcnCollapsibleContent,
} from '../proto-ui/components/vue2';

export default {
  components: { ShadcnCollapsibleRoot, ShadcnCollapsibleTrigger, ShadcnCollapsibleContent },
};
</script>
    `),
    'demo-shadcn-collapsible-basic': formatCode(`
<template>
  <div class="mx-auto w-full max-w-sm rounded-xl border bg-card p-4">
    <ShadcnCollapsibleRoot styleProfile="rhea">
      <div class="flex items-center justify-between gap-4 px-1">
        <h4 class="text-sm font-semibold">Order #4189</h4>
        <ShadcnCollapsibleTrigger variant="ghost" size="icon">↕</ShadcnCollapsibleTrigger>
      </div>
      <ShadcnCollapsibleContent variant="plain">
        <div class="rounded-lg border px-3.5 py-2 text-sm">100 Market St, San Francisco</div>
      </ShadcnCollapsibleContent>
    </ShadcnCollapsibleRoot>
  </div>
</template>

<script>
import {
  ShadcnCollapsibleRoot,
  ShadcnCollapsibleTrigger,
  ShadcnCollapsibleContent,
} from '../proto-ui/components/vue2';

export default {
  components: { ShadcnCollapsibleRoot, ShadcnCollapsibleTrigger, ShadcnCollapsibleContent },
};
</script>
    `),
    'demo-shadcn-collapsible-controlled': formatCode(`
<template>
  <ShadcnCollapsibleRoot styleProfile="rhea" :open="open" @openChange="onOpenChange">
    <ShadcnCollapsibleTrigger variant="ghost">Product details</ShadcnCollapsibleTrigger>
    <ShadcnCollapsibleContent>Controlled via open and openChange.</ShadcnCollapsibleContent>
  </ShadcnCollapsibleRoot>
</template>

<script>
import {
  ShadcnCollapsibleRoot,
  ShadcnCollapsibleTrigger,
  ShadcnCollapsibleContent,
} from '../proto-ui/components/vue2';

export default {
  components: { ShadcnCollapsibleRoot, ShadcnCollapsibleTrigger, ShadcnCollapsibleContent },
  data() {
    return { open: false };
  },
  methods: {
    onOpenChange(req) {
      this.open = req.open;
    },
  },
};
</script>
    `),
    'demo-shadcn-collapsible-settings': formatCode(`
<template>
  <ShadcnCollapsibleRoot styleProfile="rhea" :open="open" @openChange="onOpenChange">
    <ShadcnCollapsibleTrigger variant="outline" size="icon">{{ open ? '−' : '+' }}</ShadcnCollapsibleTrigger>
    <ShadcnCollapsibleContent variant="plain">BL: 8px · BR: 8px</ShadcnCollapsibleContent>
  </ShadcnCollapsibleRoot>
</template>

<script>
import {
  ShadcnCollapsibleRoot,
  ShadcnCollapsibleTrigger,
  ShadcnCollapsibleContent,
} from '../proto-ui/components/vue2';

export default {
  components: { ShadcnCollapsibleRoot, ShadcnCollapsibleTrigger, ShadcnCollapsibleContent },
  data() {
    return { open: false };
  },
  methods: {
    onOpenChange(req) {
      this.open = req.open;
    },
  },
};
</script>
    `),
    'demo-shadcn-collapsible-file-tree': formatCode(`
<template>
  <ShadcnCollapsibleRoot styleProfile="rhea" :defaultOpen="true">
    <ShadcnCollapsibleTrigger variant="ghost" size="sm">▸ components</ShadcnCollapsibleTrigger>
    <ShadcnCollapsibleContent variant="plain">button.tsx · collapsible.tsx</ShadcnCollapsibleContent>
  </ShadcnCollapsibleRoot>
</template>

<script>
import {
  ShadcnCollapsibleRoot,
  ShadcnCollapsibleTrigger,
  ShadcnCollapsibleContent,
} from '../proto-ui/components/vue2';

export default {
  components: { ShadcnCollapsibleRoot, ShadcnCollapsibleTrigger, ShadcnCollapsibleContent },
};
</script>
    `),
    'demo-shadcn-collapsible-rtl': formatCode(`
<template>
  <div dir="rtl" lang="ar" class="mx-auto w-full max-w-sm rounded-xl border p-4 text-start">
    <ShadcnCollapsibleRoot styleProfile="rhea">
      <ShadcnCollapsibleTrigger variant="ghost" size="icon">↕</ShadcnCollapsibleTrigger>
      <ShadcnCollapsibleContent variant="plain">عنوان الشحن · 100 Market St</ShadcnCollapsibleContent>
    </ShadcnCollapsibleRoot>
  </div>
</template>

<script>
import {
  ShadcnCollapsibleRoot,
  ShadcnCollapsibleTrigger,
  ShadcnCollapsibleContent,
} from '../proto-ui/components/vue2';

export default {
  components: { ShadcnCollapsibleRoot, ShadcnCollapsibleTrigger, ShadcnCollapsibleContent },
};
</script>
    `),
    'demo-brutalist-collapsible': formatCode(`
<template>
  <BrutalistCollapsibleRoot>
    <BrutalistCollapsibleTrigger>Order #4189 — Shipping & delivery details</BrutalistCollapsibleTrigger>
    <BrutalistCollapsibleContent>100 Market St, San Francisco, CA.</BrutalistCollapsibleContent>
  </BrutalistCollapsibleRoot>
</template>

<script>
import {
  BrutalistCollapsibleRoot,
  BrutalistCollapsibleTrigger,
  BrutalistCollapsibleContent,
} from '../proto-ui/components/vue2';

export default {
  components: { BrutalistCollapsibleRoot, BrutalistCollapsibleTrigger, BrutalistCollapsibleContent },
};
</script>
    `),
    'demo-brutalist-collapsible-repositories': formatCode(`
<template>
  <BrutalistCollapsibleRoot>
    <BrutalistCollapsibleTrigger variant="noShadow">Toggle</BrutalistCollapsibleTrigger>
    <BrutalistCollapsibleContent>@radix-ui/colors · @stitches/react</BrutalistCollapsibleContent>
  </BrutalistCollapsibleRoot>
</template>

<script>
import {
  BrutalistCollapsibleRoot,
  BrutalistCollapsibleTrigger,
  BrutalistCollapsibleContent,
} from '../proto-ui/components/vue2';

export default {
  components: { BrutalistCollapsibleRoot, BrutalistCollapsibleTrigger, BrutalistCollapsibleContent },
};
</script>
    `),
    'demo-brutalist-collapsible-basic': formatCode(`
<template>
  <BrutalistCollapsibleRoot>
    <BrutalistCollapsibleTrigger>Product details</BrutalistCollapsibleTrigger>
    <BrutalistCollapsibleContent>Additional product specifications.</BrutalistCollapsibleContent>
  </BrutalistCollapsibleRoot>
</template>

<script>
import {
  BrutalistCollapsibleRoot,
  BrutalistCollapsibleTrigger,
  BrutalistCollapsibleContent,
} from '../proto-ui/components/vue2';

export default {
  components: { BrutalistCollapsibleRoot, BrutalistCollapsibleTrigger, BrutalistCollapsibleContent },
};
</script>
    `),
    'demo-brutalist-collapsible-settings': formatCode(`
<template>
  <BrutalistCollapsibleRoot :open="open" @openChange="onOpenChange">
    <BrutalistCollapsibleTrigger variant="neutral">
      {{ open ? 'Hide bottom corners' : 'Show bottom corners' }}
    </BrutalistCollapsibleTrigger>
    <BrutalistCollapsibleContent>Bottom left: 5px · Bottom right: 5px</BrutalistCollapsibleContent>
  </BrutalistCollapsibleRoot>
</template>

<script>
import {
  BrutalistCollapsibleRoot,
  BrutalistCollapsibleTrigger,
  BrutalistCollapsibleContent,
} from '../proto-ui/components/vue2';

export default {
  components: { BrutalistCollapsibleRoot, BrutalistCollapsibleTrigger, BrutalistCollapsibleContent },
  data() {
    return { open: false };
  },
  methods: {
    onOpenChange(req) {
      this.open = req.open;
    },
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-collapsible': formatCode(`
<template>
  <Bootstrap232CollapsibleRoot>
    <Bootstrap232CollapsibleTrigger>Order #4189 — Shipping & delivery details</Bootstrap232CollapsibleTrigger>
    <Bootstrap232CollapsibleContent>100 Market St, San Francisco, CA.</Bootstrap232CollapsibleContent>
  </Bootstrap232CollapsibleRoot>
</template>

<script>
import {
  Bootstrap232CollapsibleRoot,
  Bootstrap232CollapsibleTrigger,
  Bootstrap232CollapsibleContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    Bootstrap232CollapsibleRoot,
    Bootstrap232CollapsibleTrigger,
    Bootstrap232CollapsibleContent,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-collapsible-basic': formatCode(`
<template>
  <Bootstrap232CollapsibleRoot>
    <Bootstrap232CollapsibleTrigger>Order #4189 — Product details</Bootstrap232CollapsibleTrigger>
    <Bootstrap232CollapsibleContent>Status: Shipped · 2x Studio Headphones.</Bootstrap232CollapsibleContent>
  </Bootstrap232CollapsibleRoot>
</template>

<script>
import {
  Bootstrap232CollapsibleRoot,
  Bootstrap232CollapsibleTrigger,
  Bootstrap232CollapsibleContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    Bootstrap232CollapsibleRoot,
    Bootstrap232CollapsibleTrigger,
    Bootstrap232CollapsibleContent,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-collapsible-controlled': formatCode(`
<template>
  <Bootstrap232CollapsibleRoot :open="open" @openChange="onOpenChange">
    <Bootstrap232CollapsibleTrigger>Release notes — Bootstrap 2.3.2 collapse</Bootstrap232CollapsibleTrigger>
    <Bootstrap232CollapsibleContent>Smooth 350ms height transition.</Bootstrap232CollapsibleContent>
  </Bootstrap232CollapsibleRoot>
</template>

<script>
import {
  Bootstrap232CollapsibleRoot,
  Bootstrap232CollapsibleTrigger,
  Bootstrap232CollapsibleContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    Bootstrap232CollapsibleRoot,
    Bootstrap232CollapsibleTrigger,
    Bootstrap232CollapsibleContent,
  },
  data() {
    return { open: false };
  },
  methods: {
    onOpenChange(req) {
      this.open = req.open;
    },
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-collapsible-file-tree': formatCode(`
<template>
  <Bootstrap232CollapsibleRoot :defaultOpen="true">
    <Bootstrap232CollapsibleTrigger>components/</Bootstrap232CollapsibleTrigger>
    <Bootstrap232CollapsibleContent>ui/ · login-form.tsx</Bootstrap232CollapsibleContent>
  </Bootstrap232CollapsibleRoot>
</template>

<script>
import {
  Bootstrap232CollapsibleRoot,
  Bootstrap232CollapsibleTrigger,
  Bootstrap232CollapsibleContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    Bootstrap232CollapsibleRoot,
    Bootstrap232CollapsibleTrigger,
    Bootstrap232CollapsibleContent,
  },
};
</script>
    `),
    'demo-liquid-glass-collapsible': formatCode(`
<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-5">
    <LiquidGlassCollapsibleRoot>
      <LiquidGlassCollapsibleTrigger>Order #4189 — Shipping & delivery details</LiquidGlassCollapsibleTrigger>
      <LiquidGlassCollapsibleContent>100 Market St, San Francisco, CA.</LiquidGlassCollapsibleContent>
    </LiquidGlassCollapsibleRoot>
  </div>
</template>

<script>
import {
  LiquidGlassCollapsibleRoot,
  LiquidGlassCollapsibleTrigger,
  LiquidGlassCollapsibleContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassCollapsibleRoot,
    LiquidGlassCollapsibleTrigger,
    LiquidGlassCollapsibleContent,
  },
};
</script>
    `),
    'demo-liquid-glass-collapsible-basic': formatCode(`
<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-5">
    <LiquidGlassCollapsibleRoot>
      <LiquidGlassCollapsibleTrigger>Order #4189 — Product details</LiquidGlassCollapsibleTrigger>
      <LiquidGlassCollapsibleContent>Opaque reading surface over layered backdrop.</LiquidGlassCollapsibleContent>
    </LiquidGlassCollapsibleRoot>
  </div>
</template>

<script>
import {
  LiquidGlassCollapsibleRoot,
  LiquidGlassCollapsibleTrigger,
  LiquidGlassCollapsibleContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassCollapsibleRoot,
    LiquidGlassCollapsibleTrigger,
    LiquidGlassCollapsibleContent,
  },
};
</script>
    `),
    'demo-liquid-glass-collapsible-prominence': formatCode(`
<template>
  <div class="grid gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-5">
    <LiquidGlassCollapsibleRoot>
      <LiquidGlassCollapsibleTrigger variant="prominent">Prominent glass trigger</LiquidGlassCollapsibleTrigger>
      <LiquidGlassCollapsibleContent>Primary tinted emphasis.</LiquidGlassCollapsibleContent>
    </LiquidGlassCollapsibleRoot>
    <LiquidGlassCollapsibleRoot>
      <LiquidGlassCollapsibleTrigger material="opaque">Opaque opt-out trigger</LiquidGlassCollapsibleTrigger>
      <LiquidGlassCollapsibleContent>Opaque fallback surface.</LiquidGlassCollapsibleContent>
    </LiquidGlassCollapsibleRoot>
  </div>
</template>

<script>
import {
  LiquidGlassCollapsibleRoot,
  LiquidGlassCollapsibleTrigger,
  LiquidGlassCollapsibleContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassCollapsibleRoot,
    LiquidGlassCollapsibleTrigger,
    LiquidGlassCollapsibleContent,
  },
};
</script>
    `),
    'demo-liquid-glass-collapsible-controlled': formatCode(`
<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-5">
    <LiquidGlassCollapsibleRoot :open="open" @openChange="onOpenChange">
      <LiquidGlassCollapsibleTrigger>Display & transparency settings</LiquidGlassCollapsibleTrigger>
      <LiquidGlassCollapsibleContent>Controlled via open and openChange.</LiquidGlassCollapsibleContent>
    </LiquidGlassCollapsibleRoot>
  </div>
</template>

<script>
import {
  LiquidGlassCollapsibleRoot,
  LiquidGlassCollapsibleTrigger,
  LiquidGlassCollapsibleContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassCollapsibleRoot,
    LiquidGlassCollapsibleTrigger,
    LiquidGlassCollapsibleContent,
  },
  data() {
    return { open: false };
  },
  methods: {
    onOpenChange(req) {
      this.open = req.open;
    },
  },
};
</script>
    `),
  },
};
