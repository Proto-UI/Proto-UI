import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-button-link': formatCode(`
<div class="flex flex-wrap items-center gap-3">
  <proto-ui-shadcn-button id="link-button">Link</proto-ui-shadcn-button>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const button = document.querySelector('#link-button');
  if (button instanceof HTMLElement) {
    setElementProps(button, { styleProfile: 'rhea', variant: 'link' });
  }
</script>
    `),
    'demo-shadcn-button-icon': formatCode(`
<div class="flex flex-wrap items-center gap-3">
  <proto-ui-shadcn-button id="icon-button">
    <proto-ui-lucide-arrow-right-icon size="16"></proto-ui-lucide-arrow-right-icon>
    <span class="sr-only">Continue</span>
  </proto-ui-shadcn-button>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const button = document.querySelector('#icon-button');
  if (button instanceof HTMLElement) {
    setElementProps(button, { styleProfile: 'rhea', variant: 'outline', size: 'icon' });
  }
</script>
    `),
    'demo-shadcn-button-with-icon': formatCode(`
<div id="button-with-icon-demo" class="flex flex-wrap items-center gap-3">
  <proto-ui-shadcn-button>
    <proto-ui-lucide-pencil-icon size="16"></proto-ui-lucide-pencil-icon>
    Edit
  </proto-ui-shadcn-button>
  <proto-ui-shadcn-button>
    Continue
    <proto-ui-lucide-arrow-right-icon size="16"></proto-ui-lucide-arrow-right-icon>
  </proto-ui-shadcn-button>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  document.querySelectorAll('#button-with-icon-demo proto-ui-shadcn-button').forEach((button) => {
    if (button instanceof HTMLElement) {
      setElementProps(button, { styleProfile: 'rhea', variant: 'outline' });
    }
  });
</script>
    `),
    'demo-shadcn-button-loading': formatCode(`
<div id="button-loading-demo" class="flex flex-wrap items-center gap-3">
  <proto-ui-shadcn-button>
    <proto-ui-lucide-loader-circle-icon class="animate-spin" size="16"></proto-ui-lucide-loader-circle-icon>
    Generating
  </proto-ui-shadcn-button>
  <proto-ui-shadcn-button>
    <proto-ui-lucide-loader-circle-icon class="animate-spin" size="16"></proto-ui-lucide-loader-circle-icon>
    Downloading
  </proto-ui-shadcn-button>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const props = [
    { styleProfile: 'rhea', variant: 'outline', disabled: true },
    { styleProfile: 'rhea', variant: 'secondary', disabled: true },
  ];
  document.querySelectorAll('#button-loading-demo proto-ui-shadcn-button').forEach((button, index) => {
    if (button instanceof HTMLElement) {
      setElementProps(button, props[index]);
    }
  });
</script>
    `),
    'demo-shadcn-button-wrap': formatCode(`
<div id="button-wrap-demo" class="flex w-full max-w-52 flex-col items-start gap-3">
  <proto-ui-shadcn-button>Confirm and continue with current workspace settings</proto-ui-shadcn-button>
  <proto-ui-shadcn-button>Save changes and notify reviewers</proto-ui-shadcn-button>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const props = [
    { styleProfile: 'rhea', variant: 'outline', wrap: true },
    { styleProfile: 'rhea', size: 'sm', wrap: true },
  ];
  document.querySelectorAll('#button-wrap-demo proto-ui-shadcn-button').forEach((button, index) => {
    if (button instanceof HTMLElement) {
      setElementProps(button, props[index]);
    }
  });
</script>
    `),
    'demo-shadcn-button-style-profiles': formatCode(`
<proto-ui-shadcn-style-scope id="button-profile-scope">
  <div class="flex flex-wrap items-center gap-3">
    <proto-ui-shadcn-button>Primary</proto-ui-shadcn-button>
    <proto-ui-shadcn-button>Outline</proto-ui-shadcn-button>
    <proto-ui-shadcn-button>Secondary</proto-ui-shadcn-button>
    <proto-ui-shadcn-button>Delete</proto-ui-shadcn-button>
  </div>
</proto-ui-shadcn-style-scope>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const scope = document.querySelector('#button-profile-scope');
  if (scope instanceof HTMLElement) setElementProps(scope, { styleProfile: 'rhea' });
  const variants = ['default', 'outline', 'secondary', 'destructive'];
  document.querySelectorAll('#button-profile-scope proto-ui-shadcn-button').forEach((button, i) => {
    if (button instanceof HTMLElement) setElementProps(button, { variant: variants[i] });
  });
</script>
    `),
    'demo-shadcn-button-rtl': formatCode(`
<div id="button-rtl-demo" dir="rtl" class="flex flex-wrap items-center gap-3">
  <proto-ui-shadcn-button>زر</proto-ui-shadcn-button>
  <proto-ui-shadcn-button>حذف</proto-ui-shadcn-button>
  <proto-ui-shadcn-button>
    إرسال
    <proto-ui-lucide-arrow-right-icon class="rtl:rotate-180" size="16"></proto-ui-lucide-arrow-right-icon>
  </proto-ui-shadcn-button>
  <proto-ui-shadcn-button>
    <proto-ui-lucide-loader-circle-icon class="animate-spin" size="16"></proto-ui-lucide-loader-circle-icon>
    جاري التحميل
  </proto-ui-shadcn-button>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const props = [
    { styleProfile: 'rhea', variant: 'outline' },
    { styleProfile: 'rhea', variant: 'destructive' },
    { styleProfile: 'rhea', variant: 'outline' },
    { styleProfile: 'rhea', variant: 'secondary', disabled: true },
  ];
  document.querySelectorAll('#button-rtl-demo proto-ui-shadcn-button').forEach((button, index) => {
    if (button instanceof HTMLElement) setElementProps(button, props[index]);
  });
</script>
    `),
    'demo-bootstrap-2-3-2-button': formatCode(`
<div class="flex flex-wrap items-center gap-3">
  <proto-ui-bootstrap-2-3-2-button>Back</proto-ui-bootstrap-2-3-2-button>
  <proto-ui-bootstrap-2-3-2-button variant="primary">Continue</proto-ui-bootstrap-2-3-2-button>
  <proto-ui-bootstrap-2-3-2-button disabled>Unavailable</proto-ui-bootstrap-2-3-2-button>
</div>
    `),
    'demo-bootstrap-2-3-2-button-variants': formatCode(`
<div class="flex flex-wrap items-center gap-3">
  <proto-ui-bootstrap-2-3-2-button>Default</proto-ui-bootstrap-2-3-2-button>
  <proto-ui-bootstrap-2-3-2-button variant="primary">Primary</proto-ui-bootstrap-2-3-2-button>
  <proto-ui-bootstrap-2-3-2-button variant="info">Info</proto-ui-bootstrap-2-3-2-button>
  <proto-ui-bootstrap-2-3-2-button variant="success">Success</proto-ui-bootstrap-2-3-2-button>
  <proto-ui-bootstrap-2-3-2-button variant="warning">Warning</proto-ui-bootstrap-2-3-2-button>
  <proto-ui-bootstrap-2-3-2-button variant="danger">Danger</proto-ui-bootstrap-2-3-2-button>
  <proto-ui-bootstrap-2-3-2-button variant="inverse">Inverse</proto-ui-bootstrap-2-3-2-button>
</div>
    `),
    'demo-bootstrap-2-3-2-button-sizes': formatCode(`
<div class="flex flex-col items-start gap-3">
  <div class="flex gap-2">
    <proto-ui-bootstrap-2-3-2-button variant="primary" size="large">Large primary</proto-ui-bootstrap-2-3-2-button>
    <proto-ui-bootstrap-2-3-2-button size="large">Large default</proto-ui-bootstrap-2-3-2-button>
  </div>
  <div class="flex gap-2">
    <proto-ui-bootstrap-2-3-2-button variant="primary">Default primary</proto-ui-bootstrap-2-3-2-button>
    <proto-ui-bootstrap-2-3-2-button>Default</proto-ui-bootstrap-2-3-2-button>
  </div>
  <div class="flex gap-2">
    <proto-ui-bootstrap-2-3-2-button variant="primary" size="small">Small primary</proto-ui-bootstrap-2-3-2-button>
    <proto-ui-bootstrap-2-3-2-button size="small">Small default</proto-ui-bootstrap-2-3-2-button>
  </div>
  <div class="flex gap-2">
    <proto-ui-bootstrap-2-3-2-button variant="primary" size="mini">Mini primary</proto-ui-bootstrap-2-3-2-button>
    <proto-ui-bootstrap-2-3-2-button size="mini">Mini default</proto-ui-bootstrap-2-3-2-button>
  </div>
</div>
    `),
    'demo-bootstrap-2-3-2-button-navbar': formatCode(`
<div class="flex flex-wrap items-center gap-2 rounded bg-[#006dcc] px-3 py-2">
  <proto-ui-bootstrap-2-3-2-button color-context="navbar">Overview</proto-ui-bootstrap-2-3-2-button>
  <proto-ui-bootstrap-2-3-2-button color-context="navbar">Components</proto-ui-bootstrap-2-3-2-button>
  <proto-ui-bootstrap-2-3-2-button color-context="navbar" disabled>Archive</proto-ui-bootstrap-2-3-2-button>
</div>
    `),
    'demo-bootstrap-2-3-2-button-with-icon': formatCode(`
<div class="flex flex-wrap items-center gap-3">
  <proto-ui-bootstrap-2-3-2-button>
    <proto-ui-lucide-pencil-icon size="14"></proto-ui-lucide-pencil-icon>
    Edit
  </proto-ui-bootstrap-2-3-2-button>
  <proto-ui-bootstrap-2-3-2-button variant="success">
    <proto-ui-lucide-check-icon size="14"></proto-ui-lucide-check-icon>
    Confirm
  </proto-ui-bootstrap-2-3-2-button>
  <proto-ui-bootstrap-2-3-2-button variant="danger">
    <proto-ui-lucide-trash-icon size="14"></proto-ui-lucide-trash-icon>
    Delete
  </proto-ui-bootstrap-2-3-2-button>
</div>
    `),
    'demo-bootstrap-2-3-2-button-wrap': formatCode(`
<div class="flex w-full max-w-48 flex-col items-start gap-3">
  <proto-ui-bootstrap-2-3-2-button variant="primary" wrap>
    Save changes and return to the project dashboard
  </proto-ui-bootstrap-2-3-2-button>
  <proto-ui-bootstrap-2-3-2-button size="small" wrap>
    Download archived release notes
  </proto-ui-bootstrap-2-3-2-button>
</div>
    `),
    'demo-bootstrap-2-3-2-button-disabled': formatCode(`
<div class="flex flex-wrap items-center gap-3">
  <proto-ui-bootstrap-2-3-2-button disabled>Default disabled</proto-ui-bootstrap-2-3-2-button>
  <proto-ui-bootstrap-2-3-2-button variant="primary" disabled>Primary disabled</proto-ui-bootstrap-2-3-2-button>
  <proto-ui-bootstrap-2-3-2-button variant="danger" disabled>Danger disabled</proto-ui-bootstrap-2-3-2-button>
</div>
    `),
    'demo-liquid-glass-button': formatCode(`
<div class="flex flex-wrap items-center gap-6">
  <proto-ui-liquid-glass-button>Back</proto-ui-liquid-glass-button>
  <proto-ui-liquid-glass-button variant="prominent">Continue</proto-ui-liquid-glass-button>
  <proto-ui-liquid-glass-button disabled>Unavailable</proto-ui-liquid-glass-button>
</div>
    `),
    'demo-liquid-glass-button-regular': formatCode(`
<div class="flex flex-wrap items-center gap-4">
  <proto-ui-liquid-glass-button>Back</proto-ui-liquid-glass-button>
  <proto-ui-liquid-glass-button>Details</proto-ui-liquid-glass-button>
  <proto-ui-liquid-glass-button>Share</proto-ui-liquid-glass-button>
</div>
    `),
    'demo-liquid-glass-button-prominent': formatCode(`
<div class="flex flex-wrap items-center gap-4">
  <proto-ui-liquid-glass-button>Cancel</proto-ui-liquid-glass-button>
  <proto-ui-liquid-glass-button variant="prominent">Continue</proto-ui-liquid-glass-button>
</div>
    `),
    'demo-liquid-glass-button-destructive': formatCode(`
<div class="flex flex-wrap items-center gap-4">
  <proto-ui-liquid-glass-button>Keep Item</proto-ui-liquid-glass-button>
  <proto-ui-liquid-glass-button variant="destructive">Delete</proto-ui-liquid-glass-button>
</div>
    `),
    'demo-liquid-glass-button-sizes': formatCode(`
<div class="flex flex-wrap items-center gap-4">
  <proto-ui-liquid-glass-button size="sm">Small</proto-ui-liquid-glass-button>
  <proto-ui-liquid-glass-button>Default</proto-ui-liquid-glass-button>
  <proto-ui-liquid-glass-button size="lg" variant="prominent">Large</proto-ui-liquid-glass-button>
  <proto-ui-liquid-glass-button size="icon">
    <proto-ui-lucide-arrow-right-icon size="16"></proto-ui-lucide-arrow-right-icon>
    <span class="sr-only">Continue</span>
  </proto-ui-liquid-glass-button>
</div>
    `),
    'demo-liquid-glass-button-material': formatCode(`
<div class="flex flex-wrap items-center gap-4">
  <proto-ui-liquid-glass-button material="auto">Auto Glass</proto-ui-liquid-glass-button>
  <proto-ui-liquid-glass-button material="opaque">Opaque</proto-ui-liquid-glass-button>
  <proto-ui-liquid-glass-button variant="prominent" material="opaque">Prominent Opaque</proto-ui-liquid-glass-button>
</div>
    `),
    'demo-liquid-glass-button-disabled': formatCode(`
<div class="flex flex-wrap items-center gap-4">
  <proto-ui-liquid-glass-button disabled>Unavailable</proto-ui-liquid-glass-button>
  <proto-ui-liquid-glass-button variant="prominent" disabled>Submitting</proto-ui-liquid-glass-button>
</div>
    `),
  },
  react: {
    'demo-shadcn-button-link': formatCode(`
import { ShadcnButton } from '../proto-ui/components/react';

export function ButtonLinkDemo() {
  return <ShadcnButton styleProfile="rhea" variant="link">Link</ShadcnButton>;
}
    `),
    'demo-shadcn-button-icon': formatCode(`
import { ShadcnButton, LucideArrowRightIcon } from '../proto-ui/components/react';

export function ButtonIconDemo() {
  return (
    <ShadcnButton styleProfile="rhea" variant="outline" size="icon">
      <LucideArrowRightIcon size={16} />
      <span className="sr-only">Continue</span>
    </ShadcnButton>
  );
}
    `),
    'demo-shadcn-button-with-icon': formatCode(`
import {
  ShadcnButton,
  LucidePencilIcon,
  LucideArrowRightIcon,
} from '../proto-ui/components/react';

export function ButtonWithIconDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ShadcnButton styleProfile="rhea" variant="outline">
        <LucidePencilIcon size={16} />
        Edit
      </ShadcnButton>
      <ShadcnButton styleProfile="rhea" variant="outline">
        Continue
        <LucideArrowRightIcon size={16} />
      </ShadcnButton>
    </div>
  );
}
    `),
    'demo-shadcn-button-loading': formatCode(`
import { ShadcnButton, LucideLoaderCircleIcon } from '../proto-ui/components/react';

export function ButtonLoadingDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ShadcnButton styleProfile="rhea" variant="outline" disabled>
        <LucideLoaderCircleIcon className="animate-spin" size={16} />
        Generating
      </ShadcnButton>
      <ShadcnButton styleProfile="rhea" variant="secondary" disabled>
        <LucideLoaderCircleIcon className="animate-spin" size={16} />
        Downloading
      </ShadcnButton>
    </div>
  );
}
    `),
    'demo-shadcn-button-wrap': formatCode(`
import { ShadcnButton } from '../proto-ui/components/react';

export function ButtonWrapDemo() {
  return (
    <div className="flex w-full max-w-52 flex-col items-start gap-3">
      <ShadcnButton styleProfile="rhea" variant="outline" wrap>
        Confirm and continue with current workspace settings
      </ShadcnButton>
      <ShadcnButton styleProfile="rhea" size="sm" wrap>
        Save changes and notify reviewers
      </ShadcnButton>
    </div>
  );
}
    `),
    'demo-shadcn-button-style-profiles': formatCode(`
import { useState } from 'react';
import { ShadcnButton, ShadcnStyleScope } from '../proto-ui/components/react';

const profiles = ['rhea', 'nova', 'vega', 'maia', 'lyra', 'luma', 'new-york-v4'] as const;

export function ButtonStyleProfilesDemo() {
  const [profile, setProfile] = useState<(typeof profiles)[number]>('rhea');
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {profiles.map((item) => (
          <ShadcnButton key={item} styleProfile="rhea" variant="outline" size="sm" onClick={() => setProfile(item)}>
            {item}
          </ShadcnButton>
        ))}
      </div>
      <ShadcnStyleScope styleProfile={profile} className="contents">
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4">
          <ShadcnButton>Primary</ShadcnButton>
          <ShadcnButton variant="outline">Outline</ShadcnButton>
          <ShadcnButton variant="secondary">Secondary</ShadcnButton>
          <ShadcnButton variant="destructive">Delete</ShadcnButton>
        </div>
      </ShadcnStyleScope>
    </div>
  );
}
    `),
    'demo-shadcn-button-rtl': formatCode(`
import {
  ShadcnButton,
  LucideArrowRightIcon,
  LucideLoaderCircleIcon,
} from '../proto-ui/components/react';

export function ButtonRtlDemo() {
  return (
    <div dir="rtl" className="flex flex-wrap items-center gap-3">
      <ShadcnButton styleProfile="rhea" variant="outline">زر</ShadcnButton>
      <ShadcnButton styleProfile="rhea" variant="destructive">حذف</ShadcnButton>
      <ShadcnButton styleProfile="rhea" variant="outline">
        إرسال
        <LucideArrowRightIcon className="rtl:rotate-180" size={16} />
      </ShadcnButton>
      <ShadcnButton styleProfile="rhea" variant="secondary" disabled>
        <LucideLoaderCircleIcon className="animate-spin" size={16} />
        جاري التحميل
      </ShadcnButton>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-button': formatCode(`
import { BootstrapButton } from '../proto-ui/components/react';

export function BootstrapButtonDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <BootstrapButton>Back</BootstrapButton>
      <BootstrapButton variant="primary">Continue</BootstrapButton>
      <BootstrapButton disabled>Unavailable</BootstrapButton>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-button-variants': formatCode(`
import { BootstrapButton } from '../proto-ui/components/react';

export function BootstrapButtonVariantsDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <BootstrapButton>Default</BootstrapButton>
      <BootstrapButton variant="primary">Primary</BootstrapButton>
      <BootstrapButton variant="info">Info</BootstrapButton>
      <BootstrapButton variant="success">Success</BootstrapButton>
      <BootstrapButton variant="warning">Warning</BootstrapButton>
      <BootstrapButton variant="danger">Danger</BootstrapButton>
      <BootstrapButton variant="inverse">Inverse</BootstrapButton>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-button-sizes': formatCode(`
import { BootstrapButton } from '../proto-ui/components/react';

export function BootstrapButtonSizesDemo() {
  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex gap-2">
        <BootstrapButton variant="primary" size="large">Large primary</BootstrapButton>
        <BootstrapButton size="large">Large default</BootstrapButton>
      </div>
      <div className="flex gap-2">
        <BootstrapButton variant="primary">Default primary</BootstrapButton>
        <BootstrapButton>Default</BootstrapButton>
      </div>
      <div className="flex gap-2">
        <BootstrapButton variant="primary" size="small">Small primary</BootstrapButton>
        <BootstrapButton size="small">Small default</BootstrapButton>
      </div>
      <div className="flex gap-2">
        <BootstrapButton variant="primary" size="mini">Mini primary</BootstrapButton>
        <BootstrapButton size="mini">Mini default</BootstrapButton>
      </div>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-button-navbar': formatCode(`
import { BootstrapButton } from '../proto-ui/components/react';

export function BootstrapButtonNavbarDemo() {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded bg-[#006dcc] px-3 py-2">
      <BootstrapButton colorContext="navbar">Overview</BootstrapButton>
      <BootstrapButton colorContext="navbar">Components</BootstrapButton>
      <BootstrapButton colorContext="navbar" disabled>Archive</BootstrapButton>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-button-with-icon': formatCode(`
import {
  BootstrapButton,
  LucidePencilIcon,
  LucideCheckIcon,
  LucideTrashIcon,
} from '../proto-ui/components/react';

export function BootstrapButtonWithIconDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <BootstrapButton>
        <LucidePencilIcon className="mr-1.5" size={14} />
        Edit
      </BootstrapButton>
      <BootstrapButton variant="success">
        <LucideCheckIcon className="mr-1.5" size={14} />
        Confirm
      </BootstrapButton>
      <BootstrapButton variant="danger">
        <LucideTrashIcon className="mr-1.5" size={14} />
        Delete
      </BootstrapButton>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-button-wrap': formatCode(`
import { BootstrapButton } from '../proto-ui/components/react';

export function BootstrapButtonWrapDemo() {
  return (
    <div className="flex w-full max-w-48 flex-col items-start gap-3">
      <BootstrapButton variant="primary" wrap>
        Save changes and return to the project dashboard
      </BootstrapButton>
      <BootstrapButton size="small" wrap>
        Download archived release notes
      </BootstrapButton>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-button-disabled': formatCode(`
import { BootstrapButton } from '../proto-ui/components/react';

export function BootstrapButtonDisabledDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <BootstrapButton disabled>Default disabled</BootstrapButton>
      <BootstrapButton variant="primary" disabled>Primary disabled</BootstrapButton>
      <BootstrapButton variant="danger" disabled>Danger disabled</BootstrapButton>
    </div>
  );
}
    `),
    'demo-liquid-glass-button': formatCode(`
import { LiquidGlassButton } from '../proto-ui/components/react';

export function LiquidGlassButtonDemo() {
  return (
    <div className="flex flex-wrap items-center gap-6">
      <LiquidGlassButton>Back</LiquidGlassButton>
      <LiquidGlassButton variant="prominent">Continue</LiquidGlassButton>
      <LiquidGlassButton disabled>Unavailable</LiquidGlassButton>
    </div>
  );
}
    `),
    'demo-liquid-glass-button-regular': formatCode(`
import { LiquidGlassButton } from '../proto-ui/components/react';

export function LiquidGlassButtonRegularDemo() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <LiquidGlassButton>Back</LiquidGlassButton>
      <LiquidGlassButton>Details</LiquidGlassButton>
      <LiquidGlassButton>Share</LiquidGlassButton>
    </div>
  );
}
    `),
    'demo-liquid-glass-button-prominent': formatCode(`
import { LiquidGlassButton } from '../proto-ui/components/react';

export function LiquidGlassButtonProminentDemo() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <LiquidGlassButton>Cancel</LiquidGlassButton>
      <LiquidGlassButton variant="prominent">Continue</LiquidGlassButton>
    </div>
  );
}
    `),
    'demo-liquid-glass-button-destructive': formatCode(`
import { LiquidGlassButton } from '../proto-ui/components/react';

export function LiquidGlassButtonDestructiveDemo() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <LiquidGlassButton>Keep Item</LiquidGlassButton>
      <LiquidGlassButton variant="destructive">Delete</LiquidGlassButton>
    </div>
  );
}
    `),
    'demo-liquid-glass-button-sizes': formatCode(`
import { LiquidGlassButton, LucideArrowRightIcon } from '../proto-ui/components/react';

export function LiquidGlassButtonSizesDemo() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <LiquidGlassButton size="sm">Small</LiquidGlassButton>
      <LiquidGlassButton>Default</LiquidGlassButton>
      <LiquidGlassButton size="lg" variant="prominent">Large</LiquidGlassButton>
      <LiquidGlassButton size="icon">
        <LucideArrowRightIcon size={16} />
        <span className="sr-only">Continue</span>
      </LiquidGlassButton>
    </div>
  );
}
    `),
    'demo-liquid-glass-button-material': formatCode(`
import { LiquidGlassButton } from '../proto-ui/components/react';

export function LiquidGlassButtonMaterialDemo() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <LiquidGlassButton material="auto">Auto Glass</LiquidGlassButton>
      <LiquidGlassButton material="opaque">Opaque</LiquidGlassButton>
      <LiquidGlassButton variant="prominent" material="opaque">Prominent Opaque</LiquidGlassButton>
    </div>
  );
}
    `),
    'demo-liquid-glass-button-disabled': formatCode(`
import { LiquidGlassButton } from '../proto-ui/components/react';

export function LiquidGlassButtonDisabledDemo() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <LiquidGlassButton disabled>Unavailable</LiquidGlassButton>
      <LiquidGlassButton variant="prominent" disabled>Submitting</LiquidGlassButton>
    </div>
  );
}
    `),
  },
  vue: {
    'demo-shadcn-button-link': formatCode(`
<script setup lang="ts">
import { ShadcnButton } from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnButton styleProfile="rhea" variant="link">Link</ShadcnButton>
</template>
    `),
    'demo-shadcn-button-icon': formatCode(`
<script setup lang="ts">
import { ShadcnButton, LucideArrowRightIcon } from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnButton styleProfile="rhea" variant="outline" size="icon">
    <LucideArrowRightIcon :size="16" />
    <span class="sr-only">Continue</span>
  </ShadcnButton>
</template>
    `),
    'demo-shadcn-button-with-icon': formatCode(`
<script setup lang="ts">
import {
  ShadcnButton,
  LucidePencilIcon,
  LucideArrowRightIcon,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <ShadcnButton styleProfile="rhea" variant="outline">
      <LucidePencilIcon :size="16" />
      Edit
    </ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="outline">
      Continue
      <LucideArrowRightIcon :size="16" />
    </ShadcnButton>
  </div>
</template>
    `),
    'demo-shadcn-button-loading': formatCode(`
<script setup lang="ts">
import { ShadcnButton, LucideLoaderCircleIcon } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <ShadcnButton styleProfile="rhea" variant="outline" :disabled="true">
      <LucideLoaderCircleIcon class="animate-spin" :size="16" />
      Generating
    </ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="secondary" :disabled="true">
      <LucideLoaderCircleIcon class="animate-spin" :size="16" />
      Downloading
    </ShadcnButton>
  </div>
</template>
    `),
    'demo-shadcn-button-wrap': formatCode(`
<script setup lang="ts">
import { ShadcnButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex w-full max-w-52 flex-col items-start gap-3">
    <ShadcnButton styleProfile="rhea" variant="outline" :wrap="true">
      Confirm and continue with current workspace settings
    </ShadcnButton>
    <ShadcnButton styleProfile="rhea" size="sm" :wrap="true">
      Save changes and notify reviewers
    </ShadcnButton>
  </div>
</template>
    `),
    'demo-shadcn-button-style-profiles': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import { ShadcnButton, ShadcnStyleScope } from '../proto-ui/components/vue';

const profiles = ['rhea', 'nova', 'vega', 'maia', 'lyra', 'luma', 'new-york-v4'] as const;
const profile = ref<(typeof profiles)[number]>('rhea');
</script>

<template>
  <div class="grid gap-4">
    <div class="flex flex-wrap gap-2">
      <ShadcnButton
        v-for="item in profiles"
        :key="item"
        styleProfile="rhea"
        variant="outline"
        size="sm"
        @click="profile = item"
      >
        {{ item }}
      </ShadcnButton>
    </div>
    <ShadcnStyleScope :styleProfile="profile" class="contents">
      <div class="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4">
        <ShadcnButton>Primary</ShadcnButton>
        <ShadcnButton variant="outline">Outline</ShadcnButton>
        <ShadcnButton variant="secondary">Secondary</ShadcnButton>
        <ShadcnButton variant="destructive">Delete</ShadcnButton>
      </div>
    </ShadcnStyleScope>
  </div>
</template>
    `),
    'demo-shadcn-button-rtl': formatCode(`
<script setup lang="ts">
import {
  ShadcnButton,
  LucideArrowRightIcon,
  LucideLoaderCircleIcon,
} from '../proto-ui/components/vue';
</script>

<template>
  <div dir="rtl" class="flex flex-wrap items-center gap-3">
    <ShadcnButton styleProfile="rhea" variant="outline">زر</ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="destructive">حذف</ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="outline">
      إرسال
      <LucideArrowRightIcon class="rtl:rotate-180" :size="16" />
    </ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="secondary" :disabled="true">
      <LucideLoaderCircleIcon class="animate-spin" :size="16" />
      جاري التحميل
    </ShadcnButton>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-button': formatCode(`
<script setup lang="ts">
import { BootstrapButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <BootstrapButton>Back</BootstrapButton>
    <BootstrapButton variant="primary">Continue</BootstrapButton>
    <BootstrapButton :disabled="true">Unavailable</BootstrapButton>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-button-variants': formatCode(`
<script setup lang="ts">
import { BootstrapButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <BootstrapButton>Default</BootstrapButton>
    <BootstrapButton variant="primary">Primary</BootstrapButton>
    <BootstrapButton variant="info">Info</BootstrapButton>
    <BootstrapButton variant="success">Success</BootstrapButton>
    <BootstrapButton variant="warning">Warning</BootstrapButton>
    <BootstrapButton variant="danger">Danger</BootstrapButton>
    <BootstrapButton variant="inverse">Inverse</BootstrapButton>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-button-sizes': formatCode(`
<script setup lang="ts">
import { BootstrapButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-col items-start gap-3">
    <div class="flex gap-2">
      <BootstrapButton variant="primary" size="large">Large primary</BootstrapButton>
      <BootstrapButton size="large">Large default</BootstrapButton>
    </div>
    <div class="flex gap-2">
      <BootstrapButton variant="primary">Default primary</BootstrapButton>
      <BootstrapButton>Default</BootstrapButton>
    </div>
    <div class="flex gap-2">
      <BootstrapButton variant="primary" size="small">Small primary</BootstrapButton>
      <BootstrapButton size="small">Small default</BootstrapButton>
    </div>
    <div class="flex gap-2">
      <BootstrapButton variant="primary" size="mini">Mini primary</BootstrapButton>
      <BootstrapButton size="mini">Mini default</BootstrapButton>
    </div>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-button-navbar': formatCode(`
<script setup lang="ts">
import { BootstrapButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 rounded bg-[#006dcc] px-3 py-2">
    <BootstrapButton colorContext="navbar">Overview</BootstrapButton>
    <BootstrapButton colorContext="navbar">Components</BootstrapButton>
    <BootstrapButton colorContext="navbar" :disabled="true">Archive</BootstrapButton>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-button-with-icon': formatCode(`
<script setup lang="ts">
import {
  BootstrapButton,
  LucidePencilIcon,
  LucideCheckIcon,
  LucideTrashIcon,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <BootstrapButton>
      <LucidePencilIcon class="mr-1.5" :size="14" />
      Edit
    </BootstrapButton>
    <BootstrapButton variant="success">
      <LucideCheckIcon class="mr-1.5" :size="14" />
      Confirm
    </BootstrapButton>
    <BootstrapButton variant="danger">
      <LucideTrashIcon class="mr-1.5" :size="14" />
      Delete
    </BootstrapButton>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-button-wrap': formatCode(`
<script setup lang="ts">
import { BootstrapButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex w-full max-w-48 flex-col items-start gap-3">
    <BootstrapButton variant="primary" :wrap="true">
      Save changes and return to the project dashboard
    </BootstrapButton>
    <BootstrapButton size="small" :wrap="true">
      Download archived release notes
    </BootstrapButton>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-button-disabled': formatCode(`
<script setup lang="ts">
import { BootstrapButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <BootstrapButton :disabled="true">Default disabled</BootstrapButton>
    <BootstrapButton variant="primary" :disabled="true">Primary disabled</BootstrapButton>
    <BootstrapButton variant="danger" :disabled="true">Danger disabled</BootstrapButton>
  </div>
</template>
    `),
    'demo-liquid-glass-button': formatCode(`
<script setup lang="ts">
import { LiquidGlassButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-6">
    <LiquidGlassButton>Back</LiquidGlassButton>
    <LiquidGlassButton variant="prominent">Continue</LiquidGlassButton>
    <LiquidGlassButton :disabled="true">Unavailable</LiquidGlassButton>
  </div>
</template>
    `),
    'demo-liquid-glass-button-regular': formatCode(`
<script setup lang="ts">
import { LiquidGlassButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-4">
    <LiquidGlassButton>Back</LiquidGlassButton>
    <LiquidGlassButton>Details</LiquidGlassButton>
    <LiquidGlassButton>Share</LiquidGlassButton>
  </div>
</template>
    `),
    'demo-liquid-glass-button-prominent': formatCode(`
<script setup lang="ts">
import { LiquidGlassButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-4">
    <LiquidGlassButton>Cancel</LiquidGlassButton>
    <LiquidGlassButton variant="prominent">Continue</LiquidGlassButton>
  </div>
</template>
    `),
    'demo-liquid-glass-button-destructive': formatCode(`
<script setup lang="ts">
import { LiquidGlassButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-4">
    <LiquidGlassButton>Keep Item</LiquidGlassButton>
    <LiquidGlassButton variant="destructive">Delete</LiquidGlassButton>
  </div>
</template>
    `),
    'demo-liquid-glass-button-sizes': formatCode(`
<script setup lang="ts">
import { LiquidGlassButton, LucideArrowRightIcon } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-4">
    <LiquidGlassButton size="sm">Small</LiquidGlassButton>
    <LiquidGlassButton>Default</LiquidGlassButton>
    <LiquidGlassButton size="lg" variant="prominent">Large</LiquidGlassButton>
    <LiquidGlassButton size="icon">
      <LucideArrowRightIcon :size="16" />
      <span class="sr-only">Continue</span>
    </LiquidGlassButton>
  </div>
</template>
    `),
    'demo-liquid-glass-button-material': formatCode(`
<script setup lang="ts">
import { LiquidGlassButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-4">
    <LiquidGlassButton material="auto">Auto Glass</LiquidGlassButton>
    <LiquidGlassButton material="opaque">Opaque</LiquidGlassButton>
    <LiquidGlassButton variant="prominent" material="opaque">Prominent Opaque</LiquidGlassButton>
  </div>
</template>
    `),
    'demo-liquid-glass-button-disabled': formatCode(`
<script setup lang="ts">
import { LiquidGlassButton } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-4">
    <LiquidGlassButton :disabled="true">Unavailable</LiquidGlassButton>
    <LiquidGlassButton variant="prominent" :disabled="true">Submitting</LiquidGlassButton>
  </div>
</template>
    `),
  },
  vue2: {
    'demo-shadcn-button-link': formatCode(`
<template>
  <ShadcnButton styleProfile="rhea" variant="link">Link</ShadcnButton>
</template>

<script>
import { ShadcnButton } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnButton },
};
</script>
    `),
    'demo-shadcn-button-icon': formatCode(`
<template>
  <ShadcnButton styleProfile="rhea" variant="outline" size="icon">
    <LucideArrowRightIcon :size="16" />
    <span class="sr-only">Continue</span>
  </ShadcnButton>
</template>

<script>
import { ShadcnButton, LucideArrowRightIcon } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnButton, LucideArrowRightIcon },
};
</script>
    `),
    'demo-shadcn-button-with-icon': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-3">
    <ShadcnButton styleProfile="rhea" variant="outline">
      <LucidePencilIcon :size="16" />
      Edit
    </ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="outline">
      Continue
      <LucideArrowRightIcon :size="16" />
    </ShadcnButton>
  </div>
</template>

<script>
import {
  ShadcnButton,
  LucidePencilIcon,
  LucideArrowRightIcon,
} from '../proto-ui/components/vue2';

export default {
  components: { ShadcnButton, LucidePencilIcon, LucideArrowRightIcon },
};
</script>
    `),
    'demo-shadcn-button-loading': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-3">
    <ShadcnButton styleProfile="rhea" variant="outline" :disabled="true">
      <LucideLoaderCircleIcon class="animate-spin" :size="16" />
      Generating
    </ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="secondary" :disabled="true">
      <LucideLoaderCircleIcon class="animate-spin" :size="16" />
      Downloading
    </ShadcnButton>
  </div>
</template>

<script>
import { ShadcnButton, LucideLoaderCircleIcon } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnButton, LucideLoaderCircleIcon },
};
</script>
    `),
    'demo-shadcn-button-wrap': formatCode(`
<template>
  <div class="flex w-full max-w-52 flex-col items-start gap-3">
    <ShadcnButton styleProfile="rhea" variant="outline" :wrap="true">
      Confirm and continue with current workspace settings
    </ShadcnButton>
    <ShadcnButton styleProfile="rhea" size="sm" :wrap="true">
      Save changes and notify reviewers
    </ShadcnButton>
  </div>
</template>

<script>
import { ShadcnButton } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnButton },
};
</script>
    `),
    'demo-shadcn-button-style-profiles': formatCode(`
<template>
  <div class="grid gap-4">
    <div class="flex flex-wrap gap-2">
      <ShadcnButton
        v-for="item in profiles"
        :key="item"
        styleProfile="rhea"
        variant="outline"
        size="sm"
        @click="profile = item"
      >
        {{ item }}
      </ShadcnButton>
    </div>
    <ShadcnStyleScope :styleProfile="profile" class="contents">
      <div class="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4">
        <ShadcnButton>Primary</ShadcnButton>
        <ShadcnButton variant="outline">Outline</ShadcnButton>
        <ShadcnButton variant="secondary">Secondary</ShadcnButton>
        <ShadcnButton variant="destructive">Delete</ShadcnButton>
      </div>
    </ShadcnStyleScope>
  </div>
</template>

<script>
import { ShadcnButton, ShadcnStyleScope } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnButton, ShadcnStyleScope },
  data() {
    return {
      profiles: ['rhea', 'nova', 'vega', 'maia', 'lyra', 'luma', 'new-york-v4'],
      profile: 'rhea',
    };
  },
};
</script>
    `),
    'demo-shadcn-button-rtl': formatCode(`
<template>
  <div dir="rtl" class="flex flex-wrap items-center gap-3">
    <ShadcnButton styleProfile="rhea" variant="outline">زر</ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="destructive">حذف</ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="outline">
      إرسال
      <LucideArrowRightIcon class="rtl:rotate-180" :size="16" />
    </ShadcnButton>
    <ShadcnButton styleProfile="rhea" variant="secondary" :disabled="true">
      <LucideLoaderCircleIcon class="animate-spin" :size="16" />
      جاري التحميل
    </ShadcnButton>
  </div>
</template>

<script>
import {
  ShadcnButton,
  LucideArrowRightIcon,
  LucideLoaderCircleIcon,
} from '../proto-ui/components/vue2';

export default {
  components: { ShadcnButton, LucideArrowRightIcon, LucideLoaderCircleIcon },
};
</script>
    `),
    'demo-bootstrap-2-3-2-button': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-3">
    <BootstrapButton>Back</BootstrapButton>
    <BootstrapButton variant="primary">Continue</BootstrapButton>
    <BootstrapButton :disabled="true">Unavailable</BootstrapButton>
  </div>
</template>

<script>
import { BootstrapButton } from '../proto-ui/components/vue2';

export default {
  components: { BootstrapButton },
};
</script>
    `),
    'demo-bootstrap-2-3-2-button-variants': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-3">
    <BootstrapButton>Default</BootstrapButton>
    <BootstrapButton variant="primary">Primary</BootstrapButton>
    <BootstrapButton variant="info">Info</BootstrapButton>
    <BootstrapButton variant="success">Success</BootstrapButton>
    <BootstrapButton variant="warning">Warning</BootstrapButton>
    <BootstrapButton variant="danger">Danger</BootstrapButton>
    <BootstrapButton variant="inverse">Inverse</BootstrapButton>
  </div>
</template>

<script>
import { BootstrapButton } from '../proto-ui/components/vue2';

export default {
  components: { BootstrapButton },
};
</script>
    `),
    'demo-bootstrap-2-3-2-button-sizes': formatCode(`
<template>
  <div class="flex flex-col items-start gap-3">
    <div class="flex gap-2">
      <BootstrapButton variant="primary" size="large">Large primary</BootstrapButton>
      <BootstrapButton size="large">Large default</BootstrapButton>
    </div>
    <div class="flex gap-2">
      <BootstrapButton variant="primary">Default primary</BootstrapButton>
      <BootstrapButton>Default</BootstrapButton>
    </div>
    <div class="flex gap-2">
      <BootstrapButton variant="primary" size="small">Small primary</BootstrapButton>
      <BootstrapButton size="small">Small default</BootstrapButton>
    </div>
    <div class="flex gap-2">
      <BootstrapButton variant="primary" size="mini">Mini primary</BootstrapButton>
      <BootstrapButton size="mini">Mini default</BootstrapButton>
    </div>
  </div>
</template>

<script>
import { BootstrapButton } from '../proto-ui/components/vue2';

export default {
  components: { BootstrapButton },
};
</script>
    `),
    'demo-bootstrap-2-3-2-button-navbar': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-2 rounded bg-[#006dcc] px-3 py-2">
    <BootstrapButton colorContext="navbar">Overview</BootstrapButton>
    <BootstrapButton colorContext="navbar">Components</BootstrapButton>
    <BootstrapButton colorContext="navbar" :disabled="true">Archive</BootstrapButton>
  </div>
</template>

<script>
import { BootstrapButton } from '../proto-ui/components/vue2';

export default {
  components: { BootstrapButton },
};
</script>
    `),
    'demo-bootstrap-2-3-2-button-with-icon': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-3">
    <BootstrapButton>
      <LucidePencilIcon class="mr-1.5" :size="14" />
      Edit
    </BootstrapButton>
    <BootstrapButton variant="success">
      <LucideCheckIcon class="mr-1.5" :size="14" />
      Confirm
    </BootstrapButton>
    <BootstrapButton variant="danger">
      <LucideTrashIcon class="mr-1.5" :size="14" />
      Delete
    </BootstrapButton>
  </div>
</template>

<script>
import {
  BootstrapButton,
  LucidePencilIcon,
  LucideCheckIcon,
  LucideTrashIcon,
} from '../proto-ui/components/vue2';

export default {
  components: { BootstrapButton, LucidePencilIcon, LucideCheckIcon, LucideTrashIcon },
};
</script>
    `),
    'demo-bootstrap-2-3-2-button-wrap': formatCode(`
<template>
  <div class="flex w-full max-w-48 flex-col items-start gap-3">
    <BootstrapButton variant="primary" :wrap="true">
      Save changes and return to the project dashboard
    </BootstrapButton>
    <BootstrapButton size="small" :wrap="true">
      Download archived release notes
    </BootstrapButton>
  </div>
</template>

<script>
import { BootstrapButton } from '../proto-ui/components/vue2';

export default {
  components: { BootstrapButton },
};
</script>
    `),
    'demo-bootstrap-2-3-2-button-disabled': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-3">
    <BootstrapButton :disabled="true">Default disabled</BootstrapButton>
    <BootstrapButton variant="primary" :disabled="true">Primary disabled</BootstrapButton>
    <BootstrapButton variant="danger" :disabled="true">Danger disabled</BootstrapButton>
  </div>
</template>

<script>
import { BootstrapButton } from '../proto-ui/components/vue2';

export default {
  components: { BootstrapButton },
};
</script>
    `),
    'demo-liquid-glass-button': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-6">
    <LiquidGlassButton>Back</LiquidGlassButton>
    <LiquidGlassButton variant="prominent">Continue</LiquidGlassButton>
    <LiquidGlassButton :disabled="true">Unavailable</LiquidGlassButton>
  </div>
</template>

<script>
import { LiquidGlassButton } from '../proto-ui/components/vue2';

export default {
  components: { LiquidGlassButton },
};
</script>
    `),
    'demo-liquid-glass-button-regular': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-4">
    <LiquidGlassButton>Back</LiquidGlassButton>
    <LiquidGlassButton>Details</LiquidGlassButton>
    <LiquidGlassButton>Share</LiquidGlassButton>
  </div>
</template>

<script>
import { LiquidGlassButton } from '../proto-ui/components/vue2';

export default {
  components: { LiquidGlassButton },
};
</script>
    `),
    'demo-liquid-glass-button-prominent': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-4">
    <LiquidGlassButton>Cancel</LiquidGlassButton>
    <LiquidGlassButton variant="prominent">Continue</LiquidGlassButton>
  </div>
</template>

<script>
import { LiquidGlassButton } from '../proto-ui/components/vue2';

export default {
  components: { LiquidGlassButton },
};
</script>
    `),
    'demo-liquid-glass-button-destructive': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-4">
    <LiquidGlassButton>Keep Item</LiquidGlassButton>
    <LiquidGlassButton variant="destructive">Delete</LiquidGlassButton>
  </div>
</template>

<script>
import { LiquidGlassButton } from '../proto-ui/components/vue2';

export default {
  components: { LiquidGlassButton },
};
</script>
    `),
    'demo-liquid-glass-button-sizes': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-4">
    <LiquidGlassButton size="sm">Small</LiquidGlassButton>
    <LiquidGlassButton>Default</LiquidGlassButton>
    <LiquidGlassButton size="lg" variant="prominent">Large</LiquidGlassButton>
    <LiquidGlassButton size="icon">
      <LucideArrowRightIcon :size="16" />
      <span class="sr-only">Continue</span>
    </LiquidGlassButton>
  </div>
</template>

<script>
import { LiquidGlassButton, LucideArrowRightIcon } from '../proto-ui/components/vue2';

export default {
  components: { LiquidGlassButton, LucideArrowRightIcon },
};
</script>
    `),
    'demo-liquid-glass-button-material': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-4">
    <LiquidGlassButton material="auto">Auto Glass</LiquidGlassButton>
    <LiquidGlassButton material="opaque">Opaque</LiquidGlassButton>
    <LiquidGlassButton variant="prominent" material="opaque">Prominent Opaque</LiquidGlassButton>
  </div>
</template>

<script>
import { LiquidGlassButton } from '../proto-ui/components/vue2';

export default {
  components: { LiquidGlassButton },
};
</script>
    `),
    'demo-liquid-glass-button-disabled': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-4">
    <LiquidGlassButton :disabled="true">Unavailable</LiquidGlassButton>
    <LiquidGlassButton variant="prominent" :disabled="true">Submitting</LiquidGlassButton>
  </div>
</template>

<script>
import { LiquidGlassButton } from '../proto-ui/components/vue2';

export default {
  components: { LiquidGlassButton },
};
</script>
    `),
  },
};
