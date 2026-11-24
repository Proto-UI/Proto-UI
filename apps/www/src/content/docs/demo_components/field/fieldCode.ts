import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

const wcInput = (family: string) =>
  formatCode(`
<div class="grid max-w-sm gap-5">
  <proto-ui-${family}-field-root required>
    <proto-ui-${family}-field-label>Username</proto-ui-${family}-field-label>
    <proto-ui-${family}-field-control placeholder="Max Leiter"></proto-ui-${family}-field-control>
    <proto-ui-${family}-field-description>Choose a unique username for your account.</proto-ui-${family}-field-description>
    <proto-ui-${family}-field-error></proto-ui-${family}-field-error>
  </proto-ui-${family}-field-root>

  <proto-ui-${family}-field-root required min-length="8">
    <proto-ui-${family}-field-label>Workspace token</proto-ui-${family}-field-label>
    <proto-ui-${family}-field-description>Must be at least 8 characters long.</proto-ui-${family}-field-description>
    <proto-ui-${family}-field-control placeholder="pui_live_••••••••"></proto-ui-${family}-field-control>
    <proto-ui-${family}-field-error></proto-ui-${family}-field-error>
  </proto-ui-${family}-field-root>
</div>
`);

const reactInput = (pkg: string) =>
  formatCode(`
import { FieldRoot, FieldLabel, FieldControl, FieldDescription, FieldError } from '${pkg}';

export function FieldInputExample() {
  return (
    <div className="grid max-w-sm gap-5">
      <FieldRoot required>
        <FieldLabel>Username</FieldLabel>
        <FieldControl placeholder="Max Leiter" />
        <FieldDescription>Choose a unique username for your account.</FieldDescription>
        <FieldError />
      </FieldRoot>
      <FieldRoot required minLength={8}>
        <FieldLabel>Workspace token</FieldLabel>
        <FieldDescription>Must be at least 8 characters long.</FieldDescription>
        <FieldControl placeholder="pui_live_••••••••" />
        <FieldError />
      </FieldRoot>
    </div>
  );
}
`);

const vueInput = (pkg: string) =>
  formatCode(`
<script setup lang="ts">
import { FieldRoot, FieldLabel, FieldControl, FieldDescription, FieldError } from '${pkg}';
</script>

<template>
  <div class="grid max-w-sm gap-5">
    <FieldRoot :required="true">
      <FieldLabel>Username</FieldLabel>
      <FieldControl placeholder="Max Leiter" />
      <FieldDescription>Choose a unique username for your account.</FieldDescription>
      <FieldError />
    </FieldRoot>
    <FieldRoot :required="true" :min-length="8">
      <FieldLabel>Workspace token</FieldLabel>
      <FieldDescription>Must be at least 8 characters long.</FieldDescription>
      <FieldControl placeholder="pui_live_••••••••" />
      <FieldError />
    </FieldRoot>
  </div>
</template>
`);

const vue2Input = (pkg: string) =>
  formatCode(`
<script>
import { FieldRoot, FieldLabel, FieldControl, FieldDescription, FieldError } from '${pkg}';

export default {
  components: { FieldRoot, FieldLabel, FieldControl, FieldDescription, FieldError },
};
</script>

<template>
  <div class="grid max-w-sm gap-5">
    <FieldRoot :required="true">
      <FieldLabel>Username</FieldLabel>
      <FieldControl placeholder="Max Leiter" />
      <FieldDescription>Choose a unique username for your account.</FieldDescription>
      <FieldError />
    </FieldRoot>
  </div>
</template>
`);

const wcTextarea = (family: string) =>
  formatCode(`
<proto-ui-${family}-field-root required min-length="10" class="max-w-sm">
  <proto-ui-${family}-field-label>Feedback</proto-ui-${family}-field-label>
  <proto-ui-${family}-field-textarea rows="4" placeholder="Your feedback helps us improve..."></proto-ui-${family}-field-textarea>
  <proto-ui-${family}-field-description>Share your thoughts about our service.</proto-ui-${family}-field-description>
  <proto-ui-${family}-field-error></proto-ui-${family}-field-error>
</proto-ui-${family}-field-root>
`);

const reactTextarea = (pkg: string) =>
  formatCode(`
import { FieldRoot, FieldLabel, FieldTextarea, FieldDescription, FieldError } from '${pkg}';

export function FieldTextareaExample() {
  return (
    <FieldRoot required minLength={10} className="max-w-sm">
      <FieldLabel>Feedback</FieldLabel>
      <FieldTextarea rows={4} placeholder="Your feedback helps us improve..." />
      <FieldDescription>Share your thoughts about our service.</FieldDescription>
      <FieldError />
    </FieldRoot>
  );
}
`);

const vueTextarea = (pkg: string) =>
  formatCode(`
<script setup lang="ts">
import { FieldRoot, FieldLabel, FieldTextarea, FieldDescription, FieldError } from '${pkg}';
</script>

<template>
  <FieldRoot :required="true" :min-length="10" class="max-w-sm">
    <FieldLabel>Feedback</FieldLabel>
    <FieldTextarea :rows="4" placeholder="Your feedback helps us improve..." />
    <FieldDescription>Share your thoughts about our service.</FieldDescription>
    <FieldError />
  </FieldRoot>
</template>
`);

const wcSelect = (family: string) =>
  formatCode(`
<proto-ui-${family}-field-root required class="max-w-sm">
  <proto-ui-${family}-field-label>Department</proto-ui-${family}-field-label>
  <proto-ui-${family}-select-root default-value="engineering">
    <proto-ui-${family}-field-select-trigger>
      <proto-ui-${family}-select-value placeholder="Choose department"></proto-ui-${family}-select-value>
    </proto-ui-${family}-field-select-trigger>
    <proto-ui-${family}-select-content>
      <proto-ui-${family}-select-surface>
        <proto-ui-${family}-select-viewport>
          <proto-ui-${family}-select-group>
            <proto-ui-${family}-select-label>Departments</proto-ui-${family}-select-label>
            <proto-ui-${family}-select-item value="engineering">
              <proto-ui-${family}-select-item-text>Engineering</proto-ui-${family}-select-item-text>
            </proto-ui-${family}-select-item>
            <proto-ui-${family}-select-item value="design">
              <proto-ui-${family}-select-item-text>Design</proto-ui-${family}-select-item-text>
            </proto-ui-${family}-select-item>
          </proto-ui-${family}-select-group>
        </proto-ui-${family}-select-viewport>
      </proto-ui-${family}-select-surface>
    </proto-ui-${family}-select-content>
  </proto-ui-${family}-select-root>
  <proto-ui-${family}-field-description>Select your department or primary area of work.</proto-ui-${family}-field-description>
  <proto-ui-${family}-field-error></proto-ui-${family}-field-error>
</proto-ui-${family}-field-root>
`);

const reactSelect = (pkg: string) =>
  formatCode(`
import { FieldRoot, FieldLabel, FieldSelectTrigger, FieldDescription, FieldError } from '${pkg}';
import { SelectRoot, SelectValue, SelectContent, SelectSurface, SelectViewport, SelectGroup, SelectLabel, SelectItem, SelectItemText } from '${pkg.replace('/field', '/select')}';

export function FieldSelectExample() {
  return (
    <FieldRoot required className="max-w-sm">
      <FieldLabel>Department</FieldLabel>
      <SelectRoot defaultValue="engineering">
        <FieldSelectTrigger>
          <SelectValue placeholder="Choose department" />
        </FieldSelectTrigger>
        <SelectContent>
          <SelectSurface>
            <SelectViewport>
              <SelectGroup>
                <SelectLabel>Departments</SelectLabel>
                <SelectItem value="engineering"><SelectItemText>Engineering</SelectItemText></SelectItem>
                <SelectItem value="design"><SelectItemText>Design</SelectItemText></SelectItem>
              </SelectGroup>
            </SelectViewport>
          </SelectSurface>
        </SelectContent>
      </SelectRoot>
      <FieldDescription>Select your department or primary area of work.</FieldDescription>
      <FieldError />
    </FieldRoot>
  );
}
`);

const vueSelect = (pkg: string) =>
  formatCode(`
<script setup lang="ts">
import { FieldRoot, FieldLabel, FieldSelectTrigger, FieldDescription, FieldError } from '${pkg}';
import { SelectRoot, SelectValue, SelectContent, SelectSurface, SelectViewport, SelectGroup, SelectLabel, SelectItem, SelectItemText } from '${pkg.replace('/field', '/select')}';
</script>

<template>
  <FieldRoot :required="true" class="max-w-sm">
    <FieldLabel>Department</FieldLabel>
    <SelectRoot default-value="engineering">
      <FieldSelectTrigger>
        <SelectValue placeholder="Choose department" />
      </FieldSelectTrigger>
      <SelectContent>
        <SelectSurface>
          <SelectViewport>
            <SelectGroup>
              <SelectLabel>Departments</SelectLabel>
              <SelectItem value="engineering"><SelectItemText>Engineering</SelectItemText></SelectItem>
              <SelectItem value="design"><SelectItemText>Design</SelectItemText></SelectItem>
            </SelectGroup>
          </SelectViewport>
        </SelectSurface>
      </SelectContent>
    </SelectRoot>
    <FieldDescription>Select your department or primary area of work.</FieldDescription>
    <FieldError />
  </FieldRoot>
</template>
`);

const wcChoice = (family: string) =>
  formatCode(`
<div class="grid max-w-sm gap-6">
  <proto-ui-${family}-field-root required>
    <proto-ui-${family}-field-label>Subscription plan</proto-ui-${family}-field-label>
    <proto-ui-${family}-field-description>Yearly and team plans include priority support.</proto-ui-${family}-field-description>
    <proto-ui-${family}-field-radio-group default-value="pro">
      <proto-ui-${family}-radio-group-item value="free"><proto-ui-${family}-radio-group-indicator></proto-ui-${family}-radio-group-indicator></proto-ui-${family}-radio-group-item>
      <proto-ui-${family}-radio-group-item value="pro"><proto-ui-${family}-radio-group-indicator></proto-ui-${family}-radio-group-indicator></proto-ui-${family}-radio-group-item>
      <proto-ui-${family}-radio-group-item value="team"><proto-ui-${family}-radio-group-indicator></proto-ui-${family}-radio-group-indicator></proto-ui-${family}-radio-group-item>
    </proto-ui-${family}-field-radio-group>
    <proto-ui-${family}-field-error></proto-ui-${family}-field-error>
  </proto-ui-${family}-field-root>

  <proto-ui-${family}-field-root orientation="horizontal">
    <proto-ui-${family}-field-label>Sync desktop &amp; documents</proto-ui-${family}-field-label>
    <proto-ui-${family}-field-checkbox default-checked>
      <proto-ui-${family}-checkbox-indicator></proto-ui-${family}-checkbox-indicator>
    </proto-ui-${family}-field-checkbox>
  </proto-ui-${family}-field-root>

  <proto-ui-${family}-field-root orientation="horizontal">
    <proto-ui-${family}-field-label>Multi-factor authentication</proto-ui-${family}-field-label>
    <proto-ui-${family}-field-switch default-checked>
      <proto-ui-${family}-switch-thumb></proto-ui-${family}-switch-thumb>
    </proto-ui-${family}-field-switch>
  </proto-ui-${family}-field-root>
</div>
`);

const reactChoice = (pkg: string) =>
  formatCode(`
import { FieldRoot, FieldLabel, FieldDescription, FieldCheckbox, FieldRadioGroup, FieldSwitch, FieldError } from '${pkg}';

export function FieldChoiceExample() {
  return (
    <div className="grid max-w-sm gap-6">
      <FieldRoot required>
        <FieldLabel>Subscription plan</FieldLabel>
        <FieldDescription>Yearly and team plans include priority support.</FieldDescription>
        <FieldRadioGroup defaultValue="pro">{/* RadioGroupItem + Label rows */}</FieldRadioGroup>
        <FieldError />
      </FieldRoot>
      <FieldRoot orientation="horizontal">
        <FieldLabel>Sync desktop &amp; documents</FieldLabel>
        <FieldCheckbox defaultChecked />
      </FieldRoot>
      <FieldRoot orientation="horizontal">
        <FieldLabel>Multi-factor authentication</FieldLabel>
        <FieldSwitch defaultChecked />
      </FieldRoot>
    </div>
  );
}
`);

const vueChoice = (pkg: string) =>
  formatCode(`
<script setup lang="ts">
import { FieldRoot, FieldLabel, FieldDescription, FieldCheckbox, FieldSwitch } from '${pkg}';
</script>

<template>
  <div class="grid max-w-sm gap-6">
    <FieldRoot orientation="horizontal">
      <FieldLabel>Sync desktop &amp; documents</FieldLabel>
      <FieldCheckbox :default-checked="true" />
    </FieldRoot>
    <FieldRoot orientation="horizontal">
      <FieldLabel>Multi-factor authentication</FieldLabel>
      <FieldSwitch :default-checked="true" />
    </FieldRoot>
  </div>
</template>
`);

const wcValidation = (family: string) =>
  formatCode(`
<div class="grid max-w-sm gap-5">
  <proto-ui-${family}-field-root id="field-user" required min-length="4" validation-mode="onBlur">
    <proto-ui-${family}-field-label>Username</proto-ui-${family}-field-label>
    <proto-ui-${family}-field-control placeholder="At least 4 characters"></proto-ui-${family}-field-control>
    <proto-ui-${family}-field-description>Validated automatically on blur.</proto-ui-${family}-field-description>
    <proto-ui-${family}-field-error></proto-ui-${family}-field-error>
  </proto-ui-${family}-field-root>

  <proto-ui-${family}-field-root id="field-async" external-validation validation-mode="onChange">
    <proto-ui-${family}-field-label>Subdomain</proto-ui-${family}-field-label>
    <proto-ui-${family}-field-control default-value="studio" placeholder='Try "taken"'></proto-ui-${family}-field-control>
    <proto-ui-${family}-field-description>Type "taken" to trigger an async availability error.</proto-ui-${family}-field-description>
    <proto-ui-${family}-field-error></proto-ui-${family}-field-error>
  </proto-ui-${family}-field-root>
</div>
<script type="module">
  const asyncField = document.querySelector('#field-async');
  asyncField?.addEventListener('validationRequest', (event) => {
    const { requestId, value } = event.detail;
    setTimeout(() => {
      const invalid = value === 'taken';
      asyncField.getExposes().resolveValidation(requestId, {
        invalid,
        errors: invalid ? ['This subdomain is already reserved.'] : [],
      });
    }, 350);
  });
</script>
`);

const reactValidation = (pkg: string) =>
  formatCode(`
import { useRef } from 'react';
import { FieldRoot, FieldLabel, FieldControl, FieldDescription, FieldError } from '${pkg}';

export function FieldValidationExample() {
  const asyncRef = useRef<any>(null);

  return (
    <div className="grid max-w-sm gap-5">
      <FieldRoot required minLength={4} validationMode="onBlur">
        <FieldLabel>Username</FieldLabel>
        <FieldControl placeholder="At least 4 characters" />
        <FieldDescription>Validated automatically on blur.</FieldDescription>
        <FieldError />
      </FieldRoot>
      <FieldRoot
        ref={asyncRef}
        externalValidation
        validationMode="onChange"
        onValidationRequest={({ requestId, value }) => {
          setTimeout(() => {
            const invalid = value === 'taken';
            asyncRef.current?.resolveValidation(requestId, {
              invalid,
              errors: invalid ? ['This subdomain is already reserved.'] : [],
            });
          }, 350);
        }}
      >
        <FieldLabel>Subdomain</FieldLabel>
        <FieldControl defaultValue="studio" placeholder='Try "taken"' />
        <FieldDescription>Type "taken" to trigger an async availability error.</FieldDescription>
        <FieldError />
      </FieldRoot>
    </div>
  );
}
`);

const vueValidation = (pkg: string) =>
  formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import { FieldRoot, FieldLabel, FieldControl, FieldDescription, FieldError } from '${pkg}';

const asyncField = ref();
function handleValidationRequest({ requestId, value }: { requestId: string; value: unknown }) {
  setTimeout(() => {
    const invalid = value === 'taken';
    asyncField.value?.resolveValidation(requestId, {
      invalid,
      errors: invalid ? ['This subdomain is already reserved.'] : [],
    });
  }, 350);
}
</script>

<template>
  <FieldRoot ref="asyncField" :external-validation="true" validation-mode="onChange" @validation-request="handleValidationRequest">
    <FieldLabel>Subdomain</FieldLabel>
    <FieldControl default-value="studio" placeholder='Try "taken"' />
    <FieldDescription>Type "taken" to trigger an async availability error.</FieldDescription>
    <FieldError />
  </FieldRoot>
</template>
`);

const wcHorizontal = (family: string) =>
  formatCode(`
<div class="grid max-w-sm gap-4">
  <proto-ui-${family}-field-root orientation="horizontal">
    <proto-ui-${family}-field-label>Airplane Mode</proto-ui-${family}-field-label>
    <proto-ui-${family}-field-switch>
      <proto-ui-${family}-switch-thumb></proto-ui-${family}-switch-thumb>
    </proto-ui-${family}-field-switch>
  </proto-ui-${family}-field-root>
</div>
`);

const reactHorizontal = (pkg: string) =>
  formatCode(`
import { FieldRoot, FieldLabel, FieldSwitch } from '${pkg}';

export function FieldHorizontalExample() {
  return (
    <FieldRoot orientation="horizontal" className="max-w-sm">
      <FieldLabel>Airplane Mode</FieldLabel>
      <FieldSwitch />
    </FieldRoot>
  );
}
`);

const vueHorizontal = (pkg: string) =>
  formatCode(`
<script setup lang="ts">
import { FieldRoot, FieldLabel, FieldSwitch } from '${pkg}';
</script>

<template>
  <FieldRoot orientation="horizontal" class="max-w-sm">
    <FieldLabel>Airplane Mode</FieldLabel>
    <FieldSwitch />
  </FieldRoot>
</template>
`);

const wcBrutalistContact = formatCode(`
<div class="grid max-w-sm gap-4">
  <proto-ui-brutalist-field-root required>
    <proto-ui-brutalist-field-label>Name</proto-ui-brutalist-field-label>
    <proto-ui-brutalist-field-control placeholder="Jane Doe"></proto-ui-brutalist-field-control>
    <proto-ui-brutalist-field-error></proto-ui-brutalist-field-error>
  </proto-ui-brutalist-field-root>
  <proto-ui-brutalist-field-root required>
    <proto-ui-brutalist-field-label>Email</proto-ui-brutalist-field-label>
    <proto-ui-brutalist-field-control input-mode="email" placeholder="jane@example.com"></proto-ui-brutalist-field-control>
    <proto-ui-brutalist-field-description>We will never share your email with anyone.</proto-ui-brutalist-field-description>
    <proto-ui-brutalist-field-error></proto-ui-brutalist-field-error>
  </proto-ui-brutalist-field-root>
  <proto-ui-brutalist-field-root required>
    <proto-ui-brutalist-field-label>Message</proto-ui-brutalist-field-label>
    <proto-ui-brutalist-field-textarea rows="3" placeholder="Tell us about your project..."></proto-ui-brutalist-field-textarea>
    <proto-ui-brutalist-field-error></proto-ui-brutalist-field-error>
  </proto-ui-brutalist-field-root>
</div>
`);

const reactBrutalistContact = formatCode(`
import { FieldRoot, FieldLabel, FieldControl, FieldTextarea, FieldDescription, FieldError } from '@proto.ui/prototypes-brutalist/field';

export function BrutalistContactExample() {
  return (
    <div className="grid max-w-sm gap-4">
      <FieldRoot required>
        <FieldLabel>Name</FieldLabel>
        <FieldControl placeholder="Jane Doe" />
        <FieldError />
      </FieldRoot>
      <FieldRoot required>
        <FieldLabel>Email</FieldLabel>
        <FieldControl inputMode="email" placeholder="jane@example.com" />
        <FieldDescription>We will never share your email with anyone.</FieldDescription>
        <FieldError />
      </FieldRoot>
      <FieldRoot required>
        <FieldLabel>Message</FieldLabel>
        <FieldTextarea rows={3} placeholder="Tell us about your project..." />
        <FieldError />
      </FieldRoot>
    </div>
  );
}
`);

const wcBrutalistError = formatCode(`
<proto-ui-brutalist-field-root required min-length="3" default-invalid validation-mode="onChange" class="max-w-sm">
  <proto-ui-brutalist-field-label>Username</proto-ui-brutalist-field-label>
  <proto-ui-brutalist-field-control default-value="ab" placeholder="Pick a username"></proto-ui-brutalist-field-control>
  <proto-ui-brutalist-field-description>Pick a unique username.</proto-ui-brutalist-field-description>
  <proto-ui-brutalist-field-error></proto-ui-brutalist-field-error>
</proto-ui-brutalist-field-root>
`);

const reactBrutalistError = formatCode(`
import { FieldRoot, FieldLabel, FieldControl, FieldDescription, FieldError } from '@proto.ui/prototypes-brutalist/field';

export function BrutalistErrorExample() {
  return (
    <FieldRoot
      required
      minLength={3}
      defaultInvalid
      defaultErrors={['Username must be at least 3 characters.']}
      validationMode="onChange"
      className="max-w-sm"
    >
      <FieldLabel>Username</FieldLabel>
      <FieldControl defaultValue="ab" placeholder="Pick a username" />
      <FieldDescription>Pick a unique username.</FieldDescription>
      <FieldError />
    </FieldRoot>
  );
}
`);

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-field': wcValidation('shadcn'),
    'demo-shadcn-field-input': wcInput('shadcn'),
    'demo-shadcn-field-textarea': wcTextarea('shadcn'),
    'demo-shadcn-field-select': wcSelect('shadcn'),
    'demo-shadcn-field-choice': wcChoice('shadcn'),
    'demo-shadcn-field-validation': wcValidation('shadcn'),
    'demo-brutalist-field': wcValidation('brutalist'),
    'demo-brutalist-field-contact': wcBrutalistContact,
    'demo-brutalist-field-horizontal': wcHorizontal('brutalist'),
    'demo-brutalist-field-choice': wcChoice('brutalist'),
    'demo-brutalist-field-error': wcBrutalistError,
    'demo-bootstrap-2-3-2-field': wcValidation('bootstrap-2-3-2'),
    'demo-bootstrap-2-3-2-field-input': wcInput('bootstrap-2-3-2'),
    'demo-bootstrap-2-3-2-field-textarea': wcTextarea('bootstrap-2-3-2'),
    'demo-bootstrap-2-3-2-field-select': wcSelect('bootstrap-2-3-2'),
    'demo-bootstrap-2-3-2-field-validation': wcValidation('bootstrap-2-3-2'),
    'demo-liquid-glass-field': wcValidation('liquid-glass'),
    'demo-liquid-glass-field-input': wcInput('liquid-glass'),
    'demo-liquid-glass-field-textarea': wcTextarea('liquid-glass'),
    'demo-liquid-glass-field-select': wcSelect('liquid-glass'),
    'demo-liquid-glass-field-horizontal': wcHorizontal('liquid-glass'),
  },
  react: {
    'demo-shadcn-field': reactValidation('@/components/ui/shadcn-field'),
    'demo-shadcn-field-input': reactInput('@/components/ui/shadcn-field'),
    'demo-shadcn-field-textarea': reactTextarea('@/components/ui/shadcn-field'),
    'demo-shadcn-field-select': reactSelect('@/components/ui/shadcn-field'),
    'demo-shadcn-field-choice': reactChoice('@/components/ui/shadcn-field'),
    'demo-shadcn-field-validation': reactValidation('@/components/ui/shadcn-field'),
    'demo-brutalist-field': reactValidation('@proto.ui/prototypes-brutalist/field'),
    'demo-brutalist-field-contact': reactBrutalistContact,
    'demo-brutalist-field-horizontal': reactHorizontal('@proto.ui/prototypes-brutalist/field'),
    'demo-brutalist-field-choice': reactChoice('@proto.ui/prototypes-brutalist/field'),
    'demo-brutalist-field-error': reactBrutalistError,
    'demo-bootstrap-2-3-2-field': reactValidation('@proto.ui/prototypes-bootstrap-2-3-2/field'),
    'demo-bootstrap-2-3-2-field-input': reactInput('@proto.ui/prototypes-bootstrap-2-3-2/field'),
    'demo-bootstrap-2-3-2-field-textarea': reactTextarea(
      '@proto.ui/prototypes-bootstrap-2-3-2/field'
    ),
    'demo-bootstrap-2-3-2-field-select': reactSelect('@proto.ui/prototypes-bootstrap-2-3-2/field'),
    'demo-bootstrap-2-3-2-field-validation': reactValidation(
      '@proto.ui/prototypes-bootstrap-2-3-2/field'
    ),
    'demo-liquid-glass-field': reactValidation('@proto.ui/prototypes-liquid-glass/field'),
    'demo-liquid-glass-field-input': reactInput('@proto.ui/prototypes-liquid-glass/field'),
    'demo-liquid-glass-field-textarea': reactTextarea('@proto.ui/prototypes-liquid-glass/field'),
    'demo-liquid-glass-field-select': reactSelect('@proto.ui/prototypes-liquid-glass/field'),
    'demo-liquid-glass-field-horizontal': reactHorizontal(
      '@proto.ui/prototypes-liquid-glass/field'
    ),
  },
  vue: {
    'demo-shadcn-field': vueValidation('@/components/ui/shadcn-field'),
    'demo-shadcn-field-input': vueInput('@/components/ui/shadcn-field'),
    'demo-shadcn-field-textarea': vueTextarea('@/components/ui/shadcn-field'),
    'demo-shadcn-field-select': vueSelect('@/components/ui/shadcn-field'),
    'demo-shadcn-field-choice': vueChoice('@/components/ui/shadcn-field'),
    'demo-shadcn-field-validation': vueValidation('@/components/ui/shadcn-field'),
    'demo-brutalist-field': vueValidation('@proto.ui/prototypes-brutalist/field'),
    'demo-brutalist-field-contact': vueInput('@proto.ui/prototypes-brutalist/field'),
    'demo-brutalist-field-horizontal': vueHorizontal('@proto.ui/prototypes-brutalist/field'),
    'demo-brutalist-field-choice': vueChoice('@proto.ui/prototypes-brutalist/field'),
    'demo-brutalist-field-error': vueValidation('@proto.ui/prototypes-brutalist/field'),
    'demo-bootstrap-2-3-2-field': vueValidation('@proto.ui/prototypes-bootstrap-2-3-2/field'),
    'demo-bootstrap-2-3-2-field-input': vueInput('@proto.ui/prototypes-bootstrap-2-3-2/field'),
    'demo-bootstrap-2-3-2-field-textarea': vueTextarea(
      '@proto.ui/prototypes-bootstrap-2-3-2/field'
    ),
    'demo-bootstrap-2-3-2-field-select': vueSelect('@proto.ui/prototypes-bootstrap-2-3-2/field'),
    'demo-bootstrap-2-3-2-field-validation': vueValidation(
      '@proto.ui/prototypes-bootstrap-2-3-2/field'
    ),
    'demo-liquid-glass-field': vueValidation('@proto.ui/prototypes-liquid-glass/field'),
    'demo-liquid-glass-field-input': vueInput('@proto.ui/prototypes-liquid-glass/field'),
    'demo-liquid-glass-field-textarea': vueTextarea('@proto.ui/prototypes-liquid-glass/field'),
    'demo-liquid-glass-field-select': vueSelect('@proto.ui/prototypes-liquid-glass/field'),
    'demo-liquid-glass-field-horizontal': vueHorizontal('@proto.ui/prototypes-liquid-glass/field'),
  },
  vue2: {
    'demo-shadcn-field': vue2Input('@/components/ui/shadcn-field'),
    'demo-shadcn-field-input': vue2Input('@/components/ui/shadcn-field'),
    'demo-shadcn-field-textarea': vueTextarea('@/components/ui/shadcn-field'),
    'demo-shadcn-field-select': vueSelect('@/components/ui/shadcn-field'),
    'demo-shadcn-field-choice': vueChoice('@/components/ui/shadcn-field'),
    'demo-shadcn-field-validation': vue2Input('@/components/ui/shadcn-field'),
    'demo-brutalist-field': vue2Input('@proto.ui/prototypes-brutalist/field'),
    'demo-brutalist-field-contact': vue2Input('@proto.ui/prototypes-brutalist/field'),
    'demo-brutalist-field-horizontal': vueHorizontal('@proto.ui/prototypes-brutalist/field'),
    'demo-brutalist-field-choice': vueChoice('@proto.ui/prototypes-brutalist/field'),
    'demo-brutalist-field-error': vue2Input('@proto.ui/prototypes-brutalist/field'),
    'demo-bootstrap-2-3-2-field': vue2Input('@proto.ui/prototypes-bootstrap-2-3-2/field'),
    'demo-bootstrap-2-3-2-field-input': vue2Input('@proto.ui/prototypes-bootstrap-2-3-2/field'),
    'demo-bootstrap-2-3-2-field-textarea': vueTextarea(
      '@proto.ui/prototypes-bootstrap-2-3-2/field'
    ),
    'demo-bootstrap-2-3-2-field-select': vueSelect('@proto.ui/prototypes-bootstrap-2-3-2/field'),
    'demo-bootstrap-2-3-2-field-validation': vue2Input(
      '@proto.ui/prototypes-bootstrap-2-3-2/field'
    ),
    'demo-liquid-glass-field': vue2Input('@proto.ui/prototypes-liquid-glass/field'),
    'demo-liquid-glass-field-input': vue2Input('@proto.ui/prototypes-liquid-glass/field'),
    'demo-liquid-glass-field-textarea': vueTextarea('@proto.ui/prototypes-liquid-glass/field'),
    'demo-liquid-glass-field-select': vueSelect('@proto.ui/prototypes-liquid-glass/field'),
    'demo-liquid-glass-field-horizontal': vueHorizontal('@proto.ui/prototypes-liquid-glass/field'),
  },
};
