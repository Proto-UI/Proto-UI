import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

function wcAddressSnippet(family: string, extraStyleScope = false): string {
  const inner = `
<proto-ui-${family}-fieldset-root>
  <proto-ui-${family}-fieldset-legend>Address Information</proto-ui-${family}-fieldset-legend>
  <proto-ui-${family}-fieldset-description>
    We need your address to deliver your order.
  </proto-ui-${family}-fieldset-description>
  <div class="grid gap-4">
    <proto-ui-${family}-field-root>
      <proto-ui-${family}-field-label>Street Address</proto-ui-${family}-field-label>
      <proto-ui-${family}-field-control></proto-ui-${family}-field-control>
      <proto-ui-${family}-field-error></proto-ui-${family}-field-error>
    </proto-ui-${family}-field-root>
    <div class="grid grid-cols-2 gap-4">
      <proto-ui-${family}-field-root>
        <proto-ui-${family}-field-label>City</proto-ui-${family}-field-label>
        <proto-ui-${family}-field-control></proto-ui-${family}-field-control>
      </proto-ui-${family}-field-root>
      <proto-ui-${family}-field-root>
        <proto-ui-${family}-field-label>Postal Code</proto-ui-${family}-field-label>
        <proto-ui-${family}-field-control></proto-ui-${family}-field-control>
      </proto-ui-${family}-field-root>
    </div>
  </div>
</proto-ui-${family}-fieldset-root>`;
  return formatCode(
    extraStyleScope
      ? `<proto-ui-shadcn-style-scope>${inner}\n</proto-ui-shadcn-style-scope>`
      : inner
  );
}

function reactAddressSnippet(pkg: string): string {
  return formatCode(`
import {
  FieldsetRoot,
  FieldsetLegend,
  FieldsetDescription,
  FieldRoot,
  FieldLabel,
  FieldControl,
  FieldError,
} from '${pkg}';

export function AddressFieldset() {
  return (
    <FieldsetRoot>
      <FieldsetLegend>Address Information</FieldsetLegend>
      <FieldsetDescription>
        We need your address to deliver your order.
      </FieldsetDescription>
      <div className="grid gap-4">
        <FieldRoot required>
          <FieldLabel>Street Address</FieldLabel>
          <FieldControl placeholder="123 Main St" />
          <FieldError />
        </FieldRoot>
        <div className="grid grid-cols-2 gap-4">
          <FieldRoot>
            <FieldLabel>City</FieldLabel>
            <FieldControl placeholder="New York" />
          </FieldRoot>
          <FieldRoot>
            <FieldLabel>Postal Code</FieldLabel>
            <FieldControl placeholder="90502" />
          </FieldRoot>
        </div>
      </div>
    </FieldsetRoot>
  );
}
`);
}

function vueAddressSnippet(pkg: string): string {
  return formatCode(`
<script setup lang="ts">
import {
  FieldsetRoot,
  FieldsetLegend,
  FieldsetDescription,
  FieldRoot,
  FieldLabel,
  FieldControl,
  FieldError,
} from '${pkg}';
</script>

<template>
  <FieldsetRoot>
    <FieldsetLegend>Address Information</FieldsetLegend>
    <FieldsetDescription>
      We need your address to deliver your order.
    </FieldsetDescription>
    <div class="grid gap-4">
      <FieldRoot :required="true">
        <FieldLabel>Street Address</FieldLabel>
        <FieldControl placeholder="123 Main St" />
        <FieldError />
      </FieldRoot>
      <div class="grid grid-cols-2 gap-4">
        <FieldRoot>
          <FieldLabel>City</FieldLabel>
          <FieldControl placeholder="New York" />
        </FieldRoot>
        <FieldRoot>
          <FieldLabel>Postal Code</FieldLabel>
          <FieldControl placeholder="90502" />
        </FieldRoot>
      </div>
    </div>
  </FieldsetRoot>
</template>
`);
}

function vue2AddressSnippet(pkg: string): string {
  return formatCode(`
<template>
  <FieldsetRoot>
    <FieldsetLegend>Address Information</FieldsetLegend>
    <FieldsetDescription>
      We need your address to deliver your order.
    </FieldsetDescription>
    <div class="grid gap-4">
      <FieldRoot :required="true">
        <FieldLabel>Street Address</FieldLabel>
        <FieldControl placeholder="123 Main St" />
        <FieldError />
      </FieldRoot>
      <div class="grid grid-cols-2 gap-4">
        <FieldRoot>
          <FieldLabel>City</FieldLabel>
          <FieldControl placeholder="New York" />
        </FieldRoot>
        <FieldRoot>
          <FieldLabel>Postal Code</FieldLabel>
          <FieldControl placeholder="90502" />
        </FieldRoot>
      </div>
    </div>
  </FieldsetRoot>
</template>

<script>
import {
  FieldsetRoot,
  FieldsetLegend,
  FieldsetDescription,
  FieldRoot,
  FieldLabel,
  FieldControl,
  FieldError,
} from '${pkg}';

export default {
  components: {
    FieldsetRoot,
    FieldsetLegend,
    FieldsetDescription,
    FieldRoot,
    FieldLabel,
    FieldControl,
    FieldError,
  },
};
</script>
`);
}

function wcCheckboxGroupSnippet(family: string, hasLegendVariant: boolean): string {
  return formatCode(`
<proto-ui-${family}-fieldset-root>
  <proto-ui-${family}-fieldset-legend id="desktop-legend">Desktop items</proto-ui-${family}-fieldset-legend>
  <proto-ui-${family}-fieldset-description>
    Select the items you want to show on the desktop.
  </proto-ui-${family}-fieldset-description>
  <proto-ui-${family}-checkbox-group-root id="desktop-group">
    <proto-ui-${family}-checkbox-group-all>Select all</proto-ui-${family}-checkbox-group-all>
    <proto-ui-${family}-checkbox-group-item>Hard disks</proto-ui-${family}-checkbox-group-item>
    <proto-ui-${family}-checkbox-group-item>External disks</proto-ui-${family}-checkbox-group-item>
    <proto-ui-${family}-checkbox-group-item>Connected servers</proto-ui-${family}-checkbox-group-item>
  </proto-ui-${family}-checkbox-group-root>
</proto-ui-${family}-fieldset-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';${
    hasLegendVariant
      ? "\n  setElementProps(document.querySelector('#desktop-legend'), { variant: 'label' });"
      : ''
  }
  setElementProps(document.querySelector('#desktop-group'), {
    defaultValue: ['hard-disks', 'connected-servers'],
    ariaLabel: 'Desktop items',
  });
</script>
`);
}

function reactCheckboxGroupSnippet(pkg: string, hasLegendVariant: boolean): string {
  return formatCode(`
import {
  FieldsetRoot,
  FieldsetLegend,
  FieldsetDescription,
  CheckboxGroupRoot,
  CheckboxGroupAll,
  CheckboxGroupItem,
} from '${pkg}';

export function DesktopItemsFieldset() {
  return (
    <FieldsetRoot>
      <FieldsetLegend${hasLegendVariant ? ' variant="label"' : ''}>Desktop items</FieldsetLegend>
      <FieldsetDescription>
        Select the items you want to show on the desktop.
      </FieldsetDescription>
      <CheckboxGroupRoot
        defaultValue={['hard-disks', 'connected-servers']}
        ariaLabel="Desktop items"
      >
        <CheckboxGroupAll>Select all</CheckboxGroupAll>
        <CheckboxGroupItem value="hard-disks">Hard disks</CheckboxGroupItem>
        <CheckboxGroupItem value="external-disks">External disks</CheckboxGroupItem>
        <CheckboxGroupItem value="connected-servers">Connected servers</CheckboxGroupItem>
      </CheckboxGroupRoot>
    </FieldsetRoot>
  );
}
`);
}

function vueCheckboxGroupSnippet(pkg: string, hasLegendVariant: boolean): string {
  return formatCode(`
<script setup lang="ts">
import {
  FieldsetRoot,
  FieldsetLegend,
  FieldsetDescription,
  CheckboxGroupRoot,
  CheckboxGroupAll,
  CheckboxGroupItem,
} from '${pkg}';
</script>

<template>
  <FieldsetRoot>
    <FieldsetLegend${hasLegendVariant ? ' variant="label"' : ''}>Desktop items</FieldsetLegend>
    <FieldsetDescription>
      Select the items you want to show on the desktop.
    </FieldsetDescription>
    <CheckboxGroupRoot
      :default-value="['hard-disks', 'connected-servers']"
      aria-label="Desktop items"
    >
      <CheckboxGroupAll>Select all</CheckboxGroupAll>
      <CheckboxGroupItem value="hard-disks">Hard disks</CheckboxGroupItem>
      <CheckboxGroupItem value="external-disks">External disks</CheckboxGroupItem>
      <CheckboxGroupItem value="connected-servers">Connected servers</CheckboxGroupItem>
    </CheckboxGroupRoot>
  </FieldsetRoot>
</template>
`);
}

function vue2CheckboxGroupSnippet(pkg: string, hasLegendVariant: boolean): string {
  return formatCode(`
<template>
  <FieldsetRoot>
    <FieldsetLegend${hasLegendVariant ? ' variant="label"' : ''}>Desktop items</FieldsetLegend>
    <FieldsetDescription>
      Select the items you want to show on the desktop.
    </FieldsetDescription>
    <CheckboxGroupRoot
      :default-value="['hard-disks', 'connected-servers']"
      aria-label="Desktop items"
    >
      <CheckboxGroupAll>Select all</CheckboxGroupAll>
      <CheckboxGroupItem value="hard-disks">Hard disks</CheckboxGroupItem>
      <CheckboxGroupItem value="external-disks">External disks</CheckboxGroupItem>
      <CheckboxGroupItem value="connected-servers">Connected servers</CheckboxGroupItem>
    </CheckboxGroupRoot>
  </FieldsetRoot>
</template>

<script>
import {
  FieldsetRoot,
  FieldsetLegend,
  FieldsetDescription,
  CheckboxGroupRoot,
  CheckboxGroupAll,
  CheckboxGroupItem,
} from '${pkg}';

export default {
  components: {
    FieldsetRoot,
    FieldsetLegend,
    FieldsetDescription,
    CheckboxGroupRoot,
    CheckboxGroupAll,
    CheckboxGroupItem,
  },
};
</script>
`);
}

function wcNestedDisabledSnippet(family: string): string {
  return formatCode(`
<div class="grid gap-4">
  <div class="flex gap-2">
    <proto-ui-${family}-button id="toggle-outer">Toggle outer disabled</proto-ui-${family}-button>
    <proto-ui-${family}-button id="toggle-middle">Toggle middle disabled</proto-ui-${family}-button>
  </div>
  <proto-ui-${family}-fieldset-root id="outer-group">
    <proto-ui-${family}-fieldset-legend>Workspace Policy (Outer)</proto-ui-${family}-fieldset-legend>
    <proto-ui-${family}-fieldset-description>
      Disabling an outer group cascades into every nested group and field.
    </proto-ui-${family}-fieldset-description>
    <proto-ui-${family}-fieldset-root id="middle-group">
      <proto-ui-${family}-fieldset-legend>Billing Department (Middle)</proto-ui-${family}-fieldset-legend>
      <proto-ui-${family}-fieldset-root id="inner-group">
        <proto-ui-${family}-fieldset-legend>Invoice Overrides (Inner)</proto-ui-${family}-fieldset-legend>
        <proto-ui-${family}-field-root>
          <proto-ui-${family}-field-label>Purchase order</proto-ui-${family}-field-label>
          <proto-ui-${family}-field-control></proto-ui-${family}-field-control>
        </proto-ui-${family}-field-root>
      </proto-ui-${family}-fieldset-root>
    </proto-ui-${family}-fieldset-root>
  </proto-ui-${family}-fieldset-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  let outer = false;
  let middle = false;
  document.querySelector('#toggle-outer')?.addEventListener('click', () => {
    outer = !outer;
    setElementProps(document.querySelector('#outer-group'), { disabled: outer });
  });
  document.querySelector('#toggle-middle')?.addEventListener('click', () => {
    middle = !middle;
    setElementProps(document.querySelector('#middle-group'), { disabled: middle });
  });
</script>
`);
}

function reactNestedDisabledSnippet(pkg: string): string {
  return formatCode(`
import { useState } from 'react';
import {
  Button,
  FieldsetRoot,
  FieldsetLegend,
  FieldsetDescription,
  FieldRoot,
  FieldLabel,
  FieldControl,
} from '${pkg}';

export function NestedDisabledFieldset() {
  const [outerDisabled, setOuterDisabled] = useState(false);
  const [middleDisabled, setMiddleDisabled] = useState(false);

  return (
    <div className="grid gap-4">
      <div className="flex gap-2">
        <Button onClick={() => setOuterDisabled((v) => !v)}>Toggle outer disabled</Button>
        <Button onClick={() => setMiddleDisabled((v) => !v)}>Toggle middle disabled</Button>
      </div>
      <FieldsetRoot disabled={outerDisabled}>
        <FieldsetLegend>Workspace Policy (Outer)</FieldsetLegend>
        <FieldsetDescription>
          Disabling an outer group cascades into every nested group and field.
        </FieldsetDescription>
        <FieldsetRoot disabled={middleDisabled}>
          <FieldsetLegend>Billing Department (Middle)</FieldsetLegend>
          <FieldsetRoot>
            <FieldsetLegend>Invoice Overrides (Inner)</FieldsetLegend>
            <FieldRoot>
              <FieldLabel>Purchase order</FieldLabel>
              <FieldControl defaultValue="PO-2026-041" />
            </FieldRoot>
          </FieldsetRoot>
        </FieldsetRoot>
      </FieldsetRoot>
    </div>
  );
}
`);
}

function vueNestedDisabledSnippet(pkg: string): string {
  return formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  Button,
  FieldsetRoot,
  FieldsetLegend,
  FieldsetDescription,
  FieldRoot,
  FieldLabel,
  FieldControl,
} from '${pkg}';

const outerDisabled = ref(false);
const middleDisabled = ref(false);
</script>

<template>
  <div class="grid gap-4">
    <div class="flex gap-2">
      <Button @click="outerDisabled = !outerDisabled">Toggle outer disabled</Button>
      <Button @click="middleDisabled = !middleDisabled">Toggle middle disabled</Button>
    </div>
    <FieldsetRoot :disabled="outerDisabled">
      <FieldsetLegend>Workspace Policy (Outer)</FieldsetLegend>
      <FieldsetDescription>
        Disabling an outer group cascades into every nested group and field.
      </FieldsetDescription>
      <FieldsetRoot :disabled="middleDisabled">
        <FieldsetLegend>Billing Department (Middle)</FieldsetLegend>
        <FieldsetRoot>
          <FieldsetLegend>Invoice Overrides (Inner)</FieldsetLegend>
          <FieldRoot>
            <FieldLabel>Purchase order</FieldLabel>
            <FieldControl default-value="PO-2026-041" />
          </FieldRoot>
        </FieldsetRoot>
      </FieldsetRoot>
    </FieldsetRoot>
  </div>
</template>
`);
}

function vue2NestedDisabledSnippet(pkg: string): string {
  return formatCode(`
<template>
  <div class="grid gap-4">
    <div class="flex gap-2">
      <Button @click="outerDisabled = !outerDisabled">Toggle outer disabled</Button>
      <Button @click="middleDisabled = !middleDisabled">Toggle middle disabled</Button>
    </div>
    <FieldsetRoot :disabled="outerDisabled">
      <FieldsetLegend>Workspace Policy (Outer)</FieldsetLegend>
      <FieldsetDescription>
        Disabling an outer group cascades into every nested group and field.
      </FieldsetDescription>
      <FieldsetRoot :disabled="middleDisabled">
        <FieldsetLegend>Billing Department (Middle)</FieldsetLegend>
        <FieldsetRoot>
          <FieldsetLegend>Invoice Overrides (Inner)</FieldsetLegend>
          <FieldRoot>
            <FieldLabel>Purchase order</FieldLabel>
            <FieldControl default-value="PO-2026-041" />
          </FieldRoot>
        </FieldsetRoot>
      </FieldsetRoot>
    </FieldsetRoot>
  </div>
</template>

<script>
import {
  Button,
  FieldsetRoot,
  FieldsetLegend,
  FieldsetDescription,
  FieldRoot,
  FieldLabel,
  FieldControl,
} from '${pkg}';

export default {
  components: {
    Button,
    FieldsetRoot,
    FieldsetLegend,
    FieldsetDescription,
    FieldRoot,
    FieldLabel,
    FieldControl,
  },
  data() {
    return {
      outerDisabled: false,
      middleDisabled: false,
    };
  },
};
</script>
`);
}

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-fieldset': wcAddressSnippet('shadcn', true),
    'demo-shadcn-fieldset-legend-label': wcCheckboxGroupSnippet('shadcn', true),
    'demo-shadcn-fieldset-radio-group': formatCode(`
<proto-ui-shadcn-style-scope>
  <proto-ui-shadcn-fieldset-root>
    <proto-ui-shadcn-fieldset-legend id="plan-legend">Subscription Plan</proto-ui-shadcn-fieldset-legend>
    <proto-ui-shadcn-fieldset-description>
      Yearly and lifetime plans offer significant savings.
    </proto-ui-shadcn-fieldset-description>
    <proto-ui-shadcn-radio-group-root id="plan-group">
      <div class="flex items-center gap-2">
        <proto-ui-shadcn-radio-group-item>
          <proto-ui-shadcn-radio-group-indicator></proto-ui-shadcn-radio-group-indicator>
        </proto-ui-shadcn-radio-group-item>
        <proto-ui-shadcn-label-root>Monthly ($9.99/month)</proto-ui-shadcn-label-root>
      </div>
      <div class="flex items-center gap-2">
        <proto-ui-shadcn-radio-group-item>
          <proto-ui-shadcn-radio-group-indicator></proto-ui-shadcn-radio-group-indicator>
        </proto-ui-shadcn-radio-group-item>
        <proto-ui-shadcn-label-root>Yearly ($99.99/year)</proto-ui-shadcn-label-root>
      </div>
      <div class="flex items-center gap-2">
        <proto-ui-shadcn-radio-group-item>
          <proto-ui-shadcn-radio-group-indicator></proto-ui-shadcn-radio-group-indicator>
        </proto-ui-shadcn-radio-group-item>
        <proto-ui-shadcn-label-root>Lifetime ($299.99)</proto-ui-shadcn-label-root>
      </div>
    </proto-ui-shadcn-radio-group-root>
  </proto-ui-shadcn-fieldset-root>
</proto-ui-shadcn-style-scope>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#plan-legend'), { variant: 'label' });
  setElementProps(document.querySelector('#plan-group'), {
    defaultValue: 'monthly',
    a11yLabel: 'Subscription Plan',
  });
</script>
    `),
    'demo-shadcn-fieldset-nested-disabled': wcNestedDisabledSnippet('shadcn'),
    'demo-shadcn-fieldset-aria-label': formatCode(`
<div class="grid gap-6">
  <proto-ui-shadcn-fieldset-root id="delivery-group">
    <proto-ui-shadcn-fieldset-description>
      Named via ariaLabel without rendering a visible Legend.
    </proto-ui-shadcn-fieldset-description>
    <proto-ui-shadcn-field-root>
      <proto-ui-shadcn-field-label>Delivery notes</proto-ui-shadcn-field-label>
      <proto-ui-shadcn-field-control></proto-ui-shadcn-field-control>
    </proto-ui-shadcn-field-root>
  </proto-ui-shadcn-fieldset-root>
  <proto-ui-shadcn-separator-root></proto-ui-shadcn-separator-root>
  <proto-ui-shadcn-fieldset-root>
    <proto-ui-shadcn-fieldset-legend>Billing Contact</proto-ui-shadcn-fieldset-legend>
    <proto-ui-shadcn-fieldset-description>
      Receipts and tax invoices are sent to this recipient.
    </proto-ui-shadcn-fieldset-description>
    <proto-ui-shadcn-field-root>
      <proto-ui-shadcn-field-label>Contact email</proto-ui-shadcn-field-label>
      <proto-ui-shadcn-field-control></proto-ui-shadcn-field-control>
    </proto-ui-shadcn-field-root>
  </proto-ui-shadcn-fieldset-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#delivery-group'), {
    ariaLabel: 'Delivery preferences',
  });
</script>
    `),
    'demo-brutalist-fieldset': wcAddressSnippet('brutalist'),
    'demo-brutalist-fieldset-checkbox-group': wcCheckboxGroupSnippet('brutalist', true),
    'demo-brutalist-fieldset-nested-disabled': wcNestedDisabledSnippet('brutalist'),
    'demo-bootstrap-2-3-2-fieldset': wcAddressSnippet('bootstrap-2-3-2'),
    'demo-bootstrap-2-3-2-fieldset-checkbox-group': wcCheckboxGroupSnippet(
      'bootstrap-2-3-2',
      false
    ),
    'demo-bootstrap-2-3-2-fieldset-nested-disabled': wcNestedDisabledSnippet('bootstrap-2-3-2'),
    'demo-liquid-glass-fieldset': wcAddressSnippet('liquid-glass'),
    'demo-liquid-glass-fieldset-checkbox-group': wcCheckboxGroupSnippet('liquid-glass', true),
    'demo-liquid-glass-fieldset-nested-disabled': wcNestedDisabledSnippet('liquid-glass'),
  },
  react: {
    'demo-shadcn-fieldset': reactAddressSnippet('@/components/shadcn/fieldset'),
    'demo-shadcn-fieldset-legend-label': reactCheckboxGroupSnippet(
      '@/components/shadcn/fieldset',
      true
    ),
    'demo-shadcn-fieldset-radio-group': formatCode(`
import {
  FieldsetRoot,
  FieldsetLegend,
  FieldsetDescription,
  RadioGroupRoot,
  RadioGroupItem,
  RadioGroupIndicator,
  LabelRoot,
} from '@/components/shadcn/fieldset';

export function SubscriptionPlanFieldset() {
  return (
    <FieldsetRoot>
      <FieldsetLegend variant="label">Subscription Plan</FieldsetLegend>
      <FieldsetDescription>
        Yearly and lifetime plans offer significant savings.
      </FieldsetDescription>
      <RadioGroupRoot defaultValue="monthly" a11yLabel="Subscription Plan">
        <div className="flex items-center gap-2">
          <RadioGroupItem value="monthly"><RadioGroupIndicator /></RadioGroupItem>
          <LabelRoot>Monthly ($9.99/month)</LabelRoot>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="yearly"><RadioGroupIndicator /></RadioGroupItem>
          <LabelRoot>Yearly ($99.99/year)</LabelRoot>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="lifetime"><RadioGroupIndicator /></RadioGroupItem>
          <LabelRoot>Lifetime ($299.99)</LabelRoot>
        </div>
      </RadioGroupRoot>
    </FieldsetRoot>
  );
}
    `),
    'demo-shadcn-fieldset-nested-disabled': reactNestedDisabledSnippet(
      '@/components/shadcn/fieldset'
    ),
    'demo-shadcn-fieldset-aria-label': formatCode(`
import {
  FieldsetRoot,
  FieldsetLegend,
  FieldsetDescription,
  FieldRoot,
  FieldLabel,
  FieldControl,
  SeparatorRoot,
} from '@/components/shadcn/fieldset';

export function MultiSectionFieldset() {
  return (
    <div className="grid gap-6">
      <FieldsetRoot ariaLabel="Delivery preferences">
        <FieldsetDescription>
          Named via ariaLabel without rendering a visible Legend.
        </FieldsetDescription>
        <FieldRoot>
          <FieldLabel>Delivery notes</FieldLabel>
          <FieldControl placeholder="Leave package at front desk" />
        </FieldRoot>
      </FieldsetRoot>
      <SeparatorRoot />
      <FieldsetRoot>
        <FieldsetLegend>Billing Contact</FieldsetLegend>
        <FieldsetDescription>
          Receipts and tax invoices are sent to this recipient.
        </FieldsetDescription>
        <FieldRoot>
          <FieldLabel>Contact email</FieldLabel>
          <FieldControl placeholder="finance@example.com" />
        </FieldRoot>
      </FieldsetRoot>
    </div>
  );
}
    `),
    'demo-brutalist-fieldset': reactAddressSnippet('@/components/brutalist/fieldset'),
    'demo-brutalist-fieldset-checkbox-group': reactCheckboxGroupSnippet(
      '@/components/brutalist/fieldset',
      true
    ),
    'demo-brutalist-fieldset-nested-disabled': reactNestedDisabledSnippet(
      '@/components/brutalist/fieldset'
    ),
    'demo-bootstrap-2-3-2-fieldset': reactAddressSnippet('@/components/bootstrap-2-3-2/fieldset'),
    'demo-bootstrap-2-3-2-fieldset-checkbox-group': reactCheckboxGroupSnippet(
      '@/components/bootstrap-2-3-2/fieldset',
      false
    ),
    'demo-bootstrap-2-3-2-fieldset-nested-disabled': reactNestedDisabledSnippet(
      '@/components/bootstrap-2-3-2/fieldset'
    ),
    'demo-liquid-glass-fieldset': reactAddressSnippet('@/components/liquid-glass/fieldset'),
    'demo-liquid-glass-fieldset-checkbox-group': reactCheckboxGroupSnippet(
      '@/components/liquid-glass/fieldset',
      true
    ),
    'demo-liquid-glass-fieldset-nested-disabled': reactNestedDisabledSnippet(
      '@/components/liquid-glass/fieldset'
    ),
  },
  vue: {
    'demo-shadcn-fieldset': vueAddressSnippet('@/components/shadcn/fieldset'),
    'demo-shadcn-fieldset-legend-label': vueCheckboxGroupSnippet(
      '@/components/shadcn/fieldset',
      true
    ),
    'demo-shadcn-fieldset-radio-group': formatCode(`
<script setup lang="ts">
import {
  FieldsetRoot,
  FieldsetLegend,
  FieldsetDescription,
  RadioGroupRoot,
  RadioGroupItem,
  RadioGroupIndicator,
  LabelRoot,
} from '@/components/shadcn/fieldset';
</script>

<template>
  <FieldsetRoot>
    <FieldsetLegend variant="label">Subscription Plan</FieldsetLegend>
    <FieldsetDescription>
      Yearly and lifetime plans offer significant savings.
    </FieldsetDescription>
    <RadioGroupRoot default-value="monthly" a11y-label="Subscription Plan">
      <div class="flex items-center gap-2">
        <RadioGroupItem value="monthly"><RadioGroupIndicator /></RadioGroupItem>
        <LabelRoot>Monthly ($9.99/month)</LabelRoot>
      </div>
      <div class="flex items-center gap-2">
        <RadioGroupItem value="yearly"><RadioGroupIndicator /></RadioGroupItem>
        <LabelRoot>Yearly ($99.99/year)</LabelRoot>
      </div>
      <div class="flex items-center gap-2">
        <RadioGroupItem value="lifetime"><RadioGroupIndicator /></RadioGroupItem>
        <LabelRoot>Lifetime ($299.99)</LabelRoot>
      </div>
    </RadioGroupRoot>
  </FieldsetRoot>
</template>
    `),
    'demo-shadcn-fieldset-nested-disabled': vueNestedDisabledSnippet(
      '@/components/shadcn/fieldset'
    ),
    'demo-shadcn-fieldset-aria-label': formatCode(`
<script setup lang="ts">
import {
  FieldsetRoot,
  FieldsetLegend,
  FieldsetDescription,
  FieldRoot,
  FieldLabel,
  FieldControl,
  SeparatorRoot,
} from '@/components/shadcn/fieldset';
</script>

<template>
  <div class="grid gap-6">
    <FieldsetRoot aria-label="Delivery preferences">
      <FieldsetDescription>
        Named via ariaLabel without rendering a visible Legend.
      </FieldsetDescription>
      <FieldRoot>
        <FieldLabel>Delivery notes</FieldLabel>
        <FieldControl placeholder="Leave package at front desk" />
      </FieldRoot>
    </FieldsetRoot>
    <SeparatorRoot />
    <FieldsetRoot>
      <FieldsetLegend>Billing Contact</FieldsetLegend>
      <FieldsetDescription>
        Receipts and tax invoices are sent to this recipient.
      </FieldsetDescription>
      <FieldRoot>
        <FieldLabel>Contact email</FieldLabel>
        <FieldControl placeholder="finance@example.com" />
      </FieldRoot>
    </FieldsetRoot>
  </div>
</template>
    `),
    'demo-brutalist-fieldset': vueAddressSnippet('@/components/brutalist/fieldset'),
    'demo-brutalist-fieldset-checkbox-group': vueCheckboxGroupSnippet(
      '@/components/brutalist/fieldset',
      true
    ),
    'demo-brutalist-fieldset-nested-disabled': vueNestedDisabledSnippet(
      '@/components/brutalist/fieldset'
    ),
    'demo-bootstrap-2-3-2-fieldset': vueAddressSnippet('@/components/bootstrap-2-3-2/fieldset'),
    'demo-bootstrap-2-3-2-fieldset-checkbox-group': vueCheckboxGroupSnippet(
      '@/components/bootstrap-2-3-2/fieldset',
      false
    ),
    'demo-bootstrap-2-3-2-fieldset-nested-disabled': vueNestedDisabledSnippet(
      '@/components/bootstrap-2-3-2/fieldset'
    ),
    'demo-liquid-glass-fieldset': vueAddressSnippet('@/components/liquid-glass/fieldset'),
    'demo-liquid-glass-fieldset-checkbox-group': vueCheckboxGroupSnippet(
      '@/components/liquid-glass/fieldset',
      true
    ),
    'demo-liquid-glass-fieldset-nested-disabled': vueNestedDisabledSnippet(
      '@/components/liquid-glass/fieldset'
    ),
  },
  vue2: {
    'demo-shadcn-fieldset': vue2AddressSnippet('@/components/shadcn/fieldset'),
    'demo-shadcn-fieldset-legend-label': vue2CheckboxGroupSnippet(
      '@/components/shadcn/fieldset',
      true
    ),
    'demo-shadcn-fieldset-radio-group': formatCode(`
<template>
  <FieldsetRoot>
    <FieldsetLegend variant="label">Subscription Plan</FieldsetLegend>
    <FieldsetDescription>
      Yearly and lifetime plans offer significant savings.
    </FieldsetDescription>
    <RadioGroupRoot default-value="monthly" a11y-label="Subscription Plan">
      <div class="flex items-center gap-2">
        <RadioGroupItem value="monthly"><RadioGroupIndicator /></RadioGroupItem>
        <LabelRoot>Monthly ($9.99/month)</LabelRoot>
      </div>
      <div class="flex items-center gap-2">
        <RadioGroupItem value="yearly"><RadioGroupIndicator /></RadioGroupItem>
        <LabelRoot>Yearly ($99.99/year)</LabelRoot>
      </div>
      <div class="flex items-center gap-2">
        <RadioGroupItem value="lifetime"><RadioGroupIndicator /></RadioGroupItem>
        <LabelRoot>Lifetime ($299.99)</LabelRoot>
      </div>
    </RadioGroupRoot>
  </FieldsetRoot>
</template>

<script>
import {
  FieldsetRoot,
  FieldsetLegend,
  FieldsetDescription,
  RadioGroupRoot,
  RadioGroupItem,
  RadioGroupIndicator,
  LabelRoot,
} from '@/components/shadcn/fieldset';

export default {
  components: {
    FieldsetRoot,
    FieldsetLegend,
    FieldsetDescription,
    RadioGroupRoot,
    RadioGroupItem,
    RadioGroupIndicator,
    LabelRoot,
  },
};
</script>
    `),
    'demo-shadcn-fieldset-nested-disabled': vue2NestedDisabledSnippet(
      '@/components/shadcn/fieldset'
    ),
    'demo-shadcn-fieldset-aria-label': formatCode(`
<template>
  <div class="grid gap-6">
    <FieldsetRoot aria-label="Delivery preferences">
      <FieldsetDescription>
        Named via ariaLabel without rendering a visible Legend.
      </FieldsetDescription>
      <FieldRoot>
        <FieldLabel>Delivery notes</FieldLabel>
        <FieldControl placeholder="Leave package at front desk" />
      </FieldRoot>
    </FieldsetRoot>
    <SeparatorRoot />
    <FieldsetRoot>
      <FieldsetLegend>Billing Contact</FieldsetLegend>
      <FieldsetDescription>
        Receipts and tax invoices are sent to this recipient.
      </FieldsetDescription>
      <FieldRoot>
        <FieldLabel>Contact email</FieldLabel>
        <FieldControl placeholder="finance@example.com" />
      </FieldRoot>
    </FieldsetRoot>
  </div>
</template>

<script>
import {
  FieldsetRoot,
  FieldsetLegend,
  FieldsetDescription,
  FieldRoot,
  FieldLabel,
  FieldControl,
  SeparatorRoot,
} from '@/components/shadcn/fieldset';

export default {
  components: {
    FieldsetRoot,
    FieldsetLegend,
    FieldsetDescription,
    FieldRoot,
    FieldLabel,
    FieldControl,
    SeparatorRoot,
  },
};
</script>
    `),
    'demo-brutalist-fieldset': vue2AddressSnippet('@/components/brutalist/fieldset'),
    'demo-brutalist-fieldset-checkbox-group': vue2CheckboxGroupSnippet(
      '@/components/brutalist/fieldset',
      true
    ),
    'demo-brutalist-fieldset-nested-disabled': vue2NestedDisabledSnippet(
      '@/components/brutalist/fieldset'
    ),
    'demo-bootstrap-2-3-2-fieldset': vue2AddressSnippet('@/components/bootstrap-2-3-2/fieldset'),
    'demo-bootstrap-2-3-2-fieldset-checkbox-group': vue2CheckboxGroupSnippet(
      '@/components/bootstrap-2-3-2/fieldset',
      false
    ),
    'demo-bootstrap-2-3-2-fieldset-nested-disabled': vue2NestedDisabledSnippet(
      '@/components/bootstrap-2-3-2/fieldset'
    ),
    'demo-liquid-glass-fieldset': vue2AddressSnippet('@/components/liquid-glass/fieldset'),
    'demo-liquid-glass-fieldset-checkbox-group': vue2CheckboxGroupSnippet(
      '@/components/liquid-glass/fieldset',
      true
    ),
    'demo-liquid-glass-fieldset-nested-disabled': vue2NestedDisabledSnippet(
      '@/components/liquid-glass/fieldset'
    ),
  },
};
