import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

const wcProfile = (prefix: string, extraResetProps = '') =>
  formatCode(`
<div class="w-full max-w-md">
  <proto-ui-${prefix}-form-root id="${prefix}-profile-form">
    <proto-ui-${prefix}-fieldset-root>
      <proto-ui-${prefix}-fieldset-legend>Profile</proto-ui-${prefix}-fieldset-legend>
      <proto-ui-${prefix}-fieldset-description>
        This information appears on your public profile and invoices.
      </proto-ui-${prefix}-fieldset-description>
      <proto-ui-${prefix}-form-field id="${prefix}-username-field">
        <proto-ui-${prefix}-field-label>Username</proto-ui-${prefix}-field-label>
        <proto-ui-${prefix}-field-control id="${prefix}-username-control"></proto-ui-${prefix}-field-control>
        <proto-ui-${prefix}-field-description>Choose a unique username for your account.</proto-ui-${prefix}-field-description>
        <proto-ui-${prefix}-field-error></proto-ui-${prefix}-field-error>
      </proto-ui-${prefix}-form-field>
      <proto-ui-${prefix}-form-field id="${prefix}-bio-field">
        <proto-ui-${prefix}-field-label>Bio</proto-ui-${prefix}-field-label>
        <proto-ui-${prefix}-field-textarea id="${prefix}-bio-control"></proto-ui-${prefix}-field-textarea>
      </proto-ui-${prefix}-form-field>
    </proto-ui-${prefix}-fieldset-root>
    <div class="flex flex-wrap items-center gap-2 pt-1">
      <proto-ui-${prefix}-form-submit>Save profile</proto-ui-${prefix}-form-submit>
      <proto-ui-${prefix}-form-reset id="${prefix}-profile-reset">Reset</proto-ui-${prefix}-form-reset>
    </div>
  </proto-ui-${prefix}-form-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#${prefix}-username-field'), { name: 'username', required: true });
  setElementProps(document.querySelector('#${prefix}-username-control'), { placeholder: 'ada_lovelace' });
  setElementProps(document.querySelector('#${prefix}-bio-field'), { name: 'bio' });
  setElementProps(document.querySelector('#${prefix}-bio-control'), { placeholder: 'Tell us a little about yourself...', rows: 3 });${extraResetProps ? `\n  setElementProps(document.querySelector('#${prefix}-profile-reset'), ${extraResetProps});` : ''}
  setElementProps(document.querySelector('#${prefix}-profile-form'), {
    ariaLabel: 'Profile settings',
    onSubmit: ({ values }) => console.log(values),
  });
</script>
`);

const reactProfile = (pkgPrefix: string, styleAttr = '', resetVariant = '') =>
  formatCode(`
import {
  ${pkgPrefix}FormRoot,
  ${pkgPrefix}FormField,
  ${pkgPrefix}FormSubmit,
  ${pkgPrefix}FormReset,
  ${pkgPrefix}FieldsetRoot,
  ${pkgPrefix}FieldsetLegend,
  ${pkgPrefix}FieldsetDescription,
  ${pkgPrefix}FieldLabel,
  ${pkgPrefix}FieldControl,
  ${pkgPrefix}FieldTextarea,
  ${pkgPrefix}FieldDescription,
  ${pkgPrefix}FieldError,
} from '../proto-ui/components/react';

export function ProfileFormDemo() {
  return (
    <div className="w-full max-w-md">
      <${pkgPrefix}FormRoot${styleAttr} ariaLabel="Profile settings" onSubmit={({ values }) => console.log(values)}>
        <${pkgPrefix}FieldsetRoot${styleAttr}>
          <${pkgPrefix}FieldsetLegend${styleAttr}>Profile</${pkgPrefix}FieldsetLegend>
          <${pkgPrefix}FieldsetDescription${styleAttr}>
            This information appears on your public profile and invoices.
          </${pkgPrefix}FieldsetDescription>
          <${pkgPrefix}FormField${styleAttr} name="username" required>
            <${pkgPrefix}FieldLabel${styleAttr}>Username</${pkgPrefix}FieldLabel>
            <${pkgPrefix}FieldControl${styleAttr} placeholder="ada_lovelace" />
            <${pkgPrefix}FieldDescription${styleAttr}>Choose a unique username for your account.</${pkgPrefix}FieldDescription>
            <${pkgPrefix}FieldError${styleAttr} />
          </${pkgPrefix}FormField>
          <${pkgPrefix}FormField${styleAttr} name="bio">
            <${pkgPrefix}FieldLabel${styleAttr}>Bio</${pkgPrefix}FieldLabel>
            <${pkgPrefix}FieldTextarea${styleAttr} placeholder="Tell us a little about yourself..." rows={3} />
          </${pkgPrefix}FormField>
        </${pkgPrefix}FieldsetRoot>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <${pkgPrefix}FormSubmit${styleAttr}>Save profile</${pkgPrefix}FormSubmit>
          <${pkgPrefix}FormReset${styleAttr}${resetVariant}>Reset</${pkgPrefix}FormReset>
        </div>
      </${pkgPrefix}FormRoot>
    </div>
  );
}
`);

const vueProfile = (pkgPrefix: string, styleAttr = '', resetVariant = '') =>
  formatCode(`
<script setup lang="ts">
import {
  ${pkgPrefix}FormRoot,
  ${pkgPrefix}FormField,
  ${pkgPrefix}FormSubmit,
  ${pkgPrefix}FormReset,
  ${pkgPrefix}FieldsetRoot,
  ${pkgPrefix}FieldsetLegend,
  ${pkgPrefix}FieldsetDescription,
  ${pkgPrefix}FieldLabel,
  ${pkgPrefix}FieldControl,
  ${pkgPrefix}FieldTextarea,
  ${pkgPrefix}FieldDescription,
  ${pkgPrefix}FieldError,
} from '../proto-ui/components/vue';

function onSubmit(detail: { values: Record<string, unknown> }) {
  console.log(detail.values);
}
</script>

<template>
  <div class="w-full max-w-md">
    <${pkgPrefix}FormRoot${styleAttr} ariaLabel="Profile settings" @submit="onSubmit">
      <${pkgPrefix}FieldsetRoot${styleAttr}>
        <${pkgPrefix}FieldsetLegend${styleAttr}>Profile</${pkgPrefix}FieldsetLegend>
        <${pkgPrefix}FieldsetDescription${styleAttr}>
          This information appears on your public profile and invoices.
        </${pkgPrefix}FieldsetDescription>
        <${pkgPrefix}FormField${styleAttr} name="username" :required="true">
          <${pkgPrefix}FieldLabel${styleAttr}>Username</${pkgPrefix}FieldLabel>
          <${pkgPrefix}FieldControl${styleAttr} placeholder="ada_lovelace" />
          <${pkgPrefix}FieldDescription${styleAttr}>Choose a unique username for your account.</${pkgPrefix}FieldDescription>
          <${pkgPrefix}FieldError${styleAttr} />
        </${pkgPrefix}FormField>
        <${pkgPrefix}FormField${styleAttr} name="bio">
          <${pkgPrefix}FieldLabel${styleAttr}>Bio</${pkgPrefix}FieldLabel>
          <${pkgPrefix}FieldTextarea${styleAttr} placeholder="Tell us a little about yourself..." :rows="3" />
        </${pkgPrefix}FormField>
      </${pkgPrefix}FieldsetRoot>
      <div class="flex flex-wrap items-center gap-2 pt-1">
        <${pkgPrefix}FormSubmit${styleAttr}>Save profile</${pkgPrefix}FormSubmit>
        <${pkgPrefix}FormReset${styleAttr}${resetVariant}>Reset</${pkgPrefix}FormReset>
      </div>
    </${pkgPrefix}FormRoot>
  </div>
</template>
`);

const vue2Profile = (pkgPrefix: string, styleAttr = '', resetVariant = '') =>
  formatCode(`
<template>
  <div class="w-full max-w-md">
    <${pkgPrefix}FormRoot${styleAttr} ariaLabel="Profile settings" @submit="onSubmit">
      <${pkgPrefix}FieldsetRoot${styleAttr}>
        <${pkgPrefix}FieldsetLegend${styleAttr}>Profile</${pkgPrefix}FieldsetLegend>
        <${pkgPrefix}FieldsetDescription${styleAttr}>
          This information appears on your public profile and invoices.
        </${pkgPrefix}FieldsetDescription>
        <${pkgPrefix}FormField${styleAttr} name="username" :required="true">
          <${pkgPrefix}FieldLabel${styleAttr}>Username</${pkgPrefix}FieldLabel>
          <${pkgPrefix}FieldControl${styleAttr} placeholder="ada_lovelace" />
          <${pkgPrefix}FieldDescription${styleAttr}>Choose a unique username for your account.</${pkgPrefix}FieldDescription>
          <${pkgPrefix}FieldError${styleAttr} />
        </${pkgPrefix}FormField>
        <${pkgPrefix}FormField${styleAttr} name="bio">
          <${pkgPrefix}FieldLabel${styleAttr}>Bio</${pkgPrefix}FieldLabel>
          <${pkgPrefix}FieldTextarea${styleAttr} placeholder="Tell us a little about yourself..." :rows="3" />
        </${pkgPrefix}FormField>
      </${pkgPrefix}FieldsetRoot>
      <div class="flex flex-wrap items-center gap-2 pt-1">
        <${pkgPrefix}FormSubmit${styleAttr}>Save profile</${pkgPrefix}FormSubmit>
        <${pkgPrefix}FormReset${styleAttr}${resetVariant}>Reset</${pkgPrefix}FormReset>
      </div>
    </${pkgPrefix}FormRoot>
  </div>
</template>

<script>
import {
  ${pkgPrefix}FormRoot,
  ${pkgPrefix}FormField,
  ${pkgPrefix}FormSubmit,
  ${pkgPrefix}FormReset,
  ${pkgPrefix}FieldsetRoot,
  ${pkgPrefix}FieldsetLegend,
  ${pkgPrefix}FieldsetDescription,
  ${pkgPrefix}FieldLabel,
  ${pkgPrefix}FieldControl,
  ${pkgPrefix}FieldTextarea,
  ${pkgPrefix}FieldDescription,
  ${pkgPrefix}FieldError,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${pkgPrefix}FormRoot,
    ${pkgPrefix}FormField,
    ${pkgPrefix}FormSubmit,
    ${pkgPrefix}FormReset,
    ${pkgPrefix}FieldsetRoot,
    ${pkgPrefix}FieldsetLegend,
    ${pkgPrefix}FieldsetDescription,
    ${pkgPrefix}FieldLabel,
    ${pkgPrefix}FieldControl,
    ${pkgPrefix}FieldTextarea,
    ${pkgPrefix}FieldDescription,
    ${pkgPrefix}FieldError,
  },
  methods: {
    onSubmit(detail) {
      console.log(detail.values);
    },
  },
};
</script>
`);

const wcHero = (prefix: string) =>
  formatCode(`
<div class="w-full max-w-md">
  <proto-ui-${prefix}-form-root id="${prefix}-hero-form">
    <proto-ui-${prefix}-form-field id="${prefix}-display-name">
      <proto-ui-${prefix}-field-label>Display name</proto-ui-${prefix}-field-label>
      <proto-ui-${prefix}-field-control id="${prefix}-display-input"></proto-ui-${prefix}-field-control>
      <proto-ui-${prefix}-field-error></proto-ui-${prefix}-field-error>
    </proto-ui-${prefix}-form-field>
    <proto-ui-${prefix}-form-field id="${prefix}-quantity">
      <proto-ui-${prefix}-field-label>Team seats</proto-ui-${prefix}-field-label>
      <proto-ui-${prefix}-number-field-root id="${prefix}-number">
        <proto-ui-${prefix}-number-field-decrement>−</proto-ui-${prefix}-number-field-decrement>
        <proto-ui-${prefix}-number-field-control></proto-ui-${prefix}-number-field-control>
        <proto-ui-${prefix}-number-field-increment>+</proto-ui-${prefix}-number-field-increment>
      </proto-ui-${prefix}-number-field-root>
    </proto-ui-${prefix}-form-field>
    <proto-ui-${prefix}-form-field id="${prefix}-channels">
      <proto-ui-${prefix}-field-label>Notification channels</proto-ui-${prefix}-field-label>
      <proto-ui-${prefix}-checkbox-group-root id="${prefix}-channels-group">
        <proto-ui-${prefix}-checkbox-group-item id="${prefix}-ch-email">Email</proto-ui-${prefix}-checkbox-group-item>
        <proto-ui-${prefix}-checkbox-group-item id="${prefix}-ch-sms">SMS</proto-ui-${prefix}-checkbox-group-item>
      </proto-ui-${prefix}-checkbox-group-root>
    </proto-ui-${prefix}-form-field>
    <div class="flex flex-wrap items-center gap-2 pt-1">
      <proto-ui-${prefix}-form-submit>Save changes</proto-ui-${prefix}-form-submit>
      <proto-ui-${prefix}-form-reset>Reset</proto-ui-${prefix}-form-reset>
    </div>
  </proto-ui-${prefix}-form-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#${prefix}-display-name'), { name: 'displayName', required: true });
  setElementProps(document.querySelector('#${prefix}-display-input'), { placeholder: 'Ada Lovelace' });
  setElementProps(document.querySelector('#${prefix}-quantity'), { name: 'quantity' });
  setElementProps(document.querySelector('#${prefix}-number'), { defaultValue: 2 });
  setElementProps(document.querySelector('#${prefix}-channels'), { name: 'channels' });
  setElementProps(document.querySelector('#${prefix}-channels-group'), { defaultValue: ['email'] });
  setElementProps(document.querySelector('#${prefix}-ch-email'), { value: 'email' });
  setElementProps(document.querySelector('#${prefix}-ch-sms'), { value: 'sms' });
  setElementProps(document.querySelector('#${prefix}-hero-form'), {
    ariaLabel: 'Account preferences form',
    onSubmit: ({ values }) => console.log(values),
  });
</script>
`);

const reactHero = (pkgPrefix: string, styleAttr = '', resetVariant = '') =>
  formatCode(`
import {
  ${pkgPrefix}FormRoot,
  ${pkgPrefix}FormField,
  ${pkgPrefix}FormSubmit,
  ${pkgPrefix}FormReset,
  ${pkgPrefix}FieldLabel,
  ${pkgPrefix}FieldControl,
  ${pkgPrefix}FieldError,
  ${pkgPrefix}NumberFieldRoot,
  ${pkgPrefix}NumberFieldDecrement,
  ${pkgPrefix}NumberFieldControl,
  ${pkgPrefix}NumberFieldIncrement,
  ${pkgPrefix}CheckboxGroupRoot,
  ${pkgPrefix}CheckboxGroupItem,
} from '../proto-ui/components/react';

export function FormDemo() {
  return (
    <div className="w-full max-w-md">
      <${pkgPrefix}FormRoot${styleAttr} ariaLabel="Account preferences form" onSubmit={({ values }) => console.log(values)}>
        <${pkgPrefix}FormField${styleAttr} name="displayName" required>
          <${pkgPrefix}FieldLabel${styleAttr}>Display name</${pkgPrefix}FieldLabel>
          <${pkgPrefix}FieldControl${styleAttr} placeholder="Ada Lovelace" />
          <${pkgPrefix}FieldError${styleAttr} />
        </${pkgPrefix}FormField>
        <${pkgPrefix}FormField${styleAttr} name="quantity">
          <${pkgPrefix}FieldLabel${styleAttr}>Team seats</${pkgPrefix}FieldLabel>
          <${pkgPrefix}NumberFieldRoot${styleAttr} defaultValue={2}>
            <${pkgPrefix}NumberFieldDecrement${styleAttr}>−</${pkgPrefix}NumberFieldDecrement>
            <${pkgPrefix}NumberFieldControl${styleAttr} />
            <${pkgPrefix}NumberFieldIncrement${styleAttr}>+</${pkgPrefix}NumberFieldIncrement>
          </${pkgPrefix}NumberFieldRoot>
        </${pkgPrefix}FormField>
        <${pkgPrefix}FormField${styleAttr} name="channels">
          <${pkgPrefix}FieldLabel${styleAttr}>Notification channels</${pkgPrefix}FieldLabel>
          <${pkgPrefix}CheckboxGroupRoot${styleAttr} defaultValue={['email']}>
            <${pkgPrefix}CheckboxGroupItem${styleAttr} value="email">Email</${pkgPrefix}CheckboxGroupItem>
            <${pkgPrefix}CheckboxGroupItem${styleAttr} value="sms">SMS</${pkgPrefix}CheckboxGroupItem>
          </${pkgPrefix}CheckboxGroupRoot>
        </${pkgPrefix}FormField>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <${pkgPrefix}FormSubmit${styleAttr}>Save changes</${pkgPrefix}FormSubmit>
          <${pkgPrefix}FormReset${styleAttr}${resetVariant}>Reset</${pkgPrefix}FormReset>
        </div>
      </${pkgPrefix}FormRoot>
    </div>
  );
}
`);

const vueHero = (pkgPrefix: string, styleAttr = '', resetVariant = '') =>
  formatCode(`
<script setup lang="ts">
import {
  ${pkgPrefix}FormRoot,
  ${pkgPrefix}FormField,
  ${pkgPrefix}FormSubmit,
  ${pkgPrefix}FormReset,
  ${pkgPrefix}FieldLabel,
  ${pkgPrefix}FieldControl,
  ${pkgPrefix}FieldError,
  ${pkgPrefix}CheckboxGroupRoot,
  ${pkgPrefix}CheckboxGroupItem,
} from '../proto-ui/components/vue';

function onSubmit(detail: { values: Record<string, unknown> }) {
  console.log(detail.values);
}
</script>

<template>
  <div class="w-full max-w-md">
    <${pkgPrefix}FormRoot${styleAttr} ariaLabel="Account preferences form" @submit="onSubmit">
      <${pkgPrefix}FormField${styleAttr} name="displayName" :required="true">
        <${pkgPrefix}FieldLabel${styleAttr}>Display name</${pkgPrefix}FieldLabel>
        <${pkgPrefix}FieldControl${styleAttr} placeholder="Ada Lovelace" />
        <${pkgPrefix}FieldError${styleAttr} />
      </${pkgPrefix}FormField>
      <${pkgPrefix}FormField${styleAttr} name="channels">
        <${pkgPrefix}FieldLabel${styleAttr}>Notification channels</${pkgPrefix}FieldLabel>
        <${pkgPrefix}CheckboxGroupRoot${styleAttr} :defaultValue="['email']">
          <${pkgPrefix}CheckboxGroupItem${styleAttr} value="email">Email</${pkgPrefix}CheckboxGroupItem>
          <${pkgPrefix}CheckboxGroupItem${styleAttr} value="sms">SMS</${pkgPrefix}CheckboxGroupItem>
        </${pkgPrefix}CheckboxGroupRoot>
      </${pkgPrefix}FormField>
      <div class="flex flex-wrap items-center gap-2 pt-1">
        <${pkgPrefix}FormSubmit${styleAttr}>Save changes</${pkgPrefix}FormSubmit>
        <${pkgPrefix}FormReset${styleAttr}${resetVariant}>Reset</${pkgPrefix}FormReset>
      </div>
    </${pkgPrefix}FormRoot>
  </div>
</template>
`);

const vue2Hero = (pkgPrefix: string, styleAttr = '', resetVariant = '') =>
  formatCode(`
<template>
  <div class="w-full max-w-md">
    <${pkgPrefix}FormRoot${styleAttr} ariaLabel="Account preferences form" @submit="onSubmit">
      <${pkgPrefix}FormField${styleAttr} name="displayName" :required="true">
        <${pkgPrefix}FieldLabel${styleAttr}>Display name</${pkgPrefix}FieldLabel>
        <${pkgPrefix}FieldControl${styleAttr} placeholder="Ada Lovelace" />
        <${pkgPrefix}FieldError${styleAttr} />
      </${pkgPrefix}FormField>
      <${pkgPrefix}FormField${styleAttr} name="channels">
        <${pkgPrefix}FieldLabel${styleAttr}>Notification channels</${pkgPrefix}FieldLabel>
        <${pkgPrefix}CheckboxGroupRoot${styleAttr} :defaultValue="['email']">
          <${pkgPrefix}CheckboxGroupItem${styleAttr} value="email">Email</${pkgPrefix}CheckboxGroupItem>
          <${pkgPrefix}CheckboxGroupItem${styleAttr} value="sms">SMS</${pkgPrefix}CheckboxGroupItem>
        </${pkgPrefix}CheckboxGroupRoot>
      </${pkgPrefix}FormField>
      <div class="flex flex-wrap items-center gap-2 pt-1">
        <${pkgPrefix}FormSubmit${styleAttr}>Save changes</${pkgPrefix}FormSubmit>
        <${pkgPrefix}FormReset${styleAttr}${resetVariant}>Reset</${pkgPrefix}FormReset>
      </div>
    </${pkgPrefix}FormRoot>
  </div>
</template>

<script>
import {
  ${pkgPrefix}FormRoot,
  ${pkgPrefix}FormField,
  ${pkgPrefix}FormSubmit,
  ${pkgPrefix}FormReset,
  ${pkgPrefix}FieldLabel,
  ${pkgPrefix}FieldControl,
  ${pkgPrefix}FieldError,
  ${pkgPrefix}CheckboxGroupRoot,
  ${pkgPrefix}CheckboxGroupItem,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${pkgPrefix}FormRoot,
    ${pkgPrefix}FormField,
    ${pkgPrefix}FormSubmit,
    ${pkgPrefix}FormReset,
    ${pkgPrefix}FieldLabel,
    ${pkgPrefix}FieldControl,
    ${pkgPrefix}FieldError,
    ${pkgPrefix}CheckboxGroupRoot,
    ${pkgPrefix}CheckboxGroupItem,
  },
  methods: {
    onSubmit(detail) {
      console.log(detail.values);
    },
  },
};
</script>
`);

const wcValidation = (prefix: string) =>
  formatCode(`
<div class="w-full max-w-md">
  <proto-ui-${prefix}-form-root id="${prefix}-async-form">
    <proto-ui-${prefix}-form-field id="${prefix}-account-field">
      <proto-ui-${prefix}-field-label>Username</proto-ui-${prefix}-field-label>
      <proto-ui-${prefix}-field-control id="${prefix}-account-control"></proto-ui-${prefix}-field-control>
      <proto-ui-${prefix}-field-error></proto-ui-${prefix}-field-error>
    </proto-ui-${prefix}-form-field>
    <div class="flex flex-wrap items-center gap-2 pt-1">
      <proto-ui-${prefix}-form-submit>Submit</proto-ui-${prefix}-form-submit>
      <proto-ui-${prefix}-form-reset>Reset</proto-ui-${prefix}-form-reset>
    </div>
  </proto-ui-${prefix}-form-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const field = document.querySelector('#${prefix}-account-field');
  const control = document.querySelector('#${prefix}-account-control');
  setElementProps(control, {
    value: 'ada',
    onValueChange: ({ value }) => setElementProps(control, { value }),
  });
  setElementProps(field, {
    name: 'account',
    required: true,
    externalValidation: true,
    validationMode: 'onChange',
    onValidationRequest: (req) => {
      const taken = req.value === 'admin';
      field.getExposes().resolveValidation(req.requestId, {
        invalid: taken,
        errors: taken ? ['This username is already taken.'] : [],
      });
    },
  });
</script>
`);

const reactValidation = (pkgPrefix: string, styleAttr = '') =>
  formatCode(`
import { useRef, useState } from 'react';
import {
  ${pkgPrefix}FormRoot,
  ${pkgPrefix}FormField,
  ${pkgPrefix}FormSubmit,
  ${pkgPrefix}FormReset,
  ${pkgPrefix}FieldLabel,
  ${pkgPrefix}FieldControl,
  ${pkgPrefix}FieldError,
} from '../proto-ui/components/react';

export function AsyncValidationFormDemo() {
  const [account, setAccount] = useState('ada');
  const fieldRef = useRef<{ resolveValidation(id: number, res: { invalid: boolean; errors: string[] }): boolean }>(null);

  return (
    <div className="w-full max-w-md">
      <${pkgPrefix}FormRoot${styleAttr} onSubmit={({ values }) => console.log(values)}>
        <${pkgPrefix}FormField${styleAttr}
          ref={fieldRef}
          name="account"
          required
          externalValidation
          validationMode="onChange"
          onValidationRequest={(req) => {
            const taken = req.value === 'admin';
            fieldRef.current?.resolveValidation(req.requestId, {
              invalid: taken,
              errors: taken ? ['This username is already taken.'] : [],
            });
          }}
        >
          <${pkgPrefix}FieldLabel${styleAttr}>Username</${pkgPrefix}FieldLabel>
          <${pkgPrefix}FieldControl${styleAttr} value={account} onValueChange={({ value }) => setAccount(value)} />
          <${pkgPrefix}FieldError${styleAttr} />
        </${pkgPrefix}FormField>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <${pkgPrefix}FormSubmit${styleAttr}>Submit</${pkgPrefix}FormSubmit>
          <${pkgPrefix}FormReset${styleAttr}>Reset</${pkgPrefix}FormReset>
        </div>
      </${pkgPrefix}FormRoot>
    </div>
  );
}
`);

const vueValidation = (pkgPrefix: string, styleAttr = '') =>
  formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  ${pkgPrefix}FormRoot,
  ${pkgPrefix}FormField,
  ${pkgPrefix}FormSubmit,
  ${pkgPrefix}FormReset,
  ${pkgPrefix}FieldLabel,
  ${pkgPrefix}FieldControl,
  ${pkgPrefix}FieldError,
} from '../proto-ui/components/vue';

const account = ref('ada');
const fieldRef = ref<any>(null);

function handleValidation(req: { requestId: number; value: unknown }) {
  const taken = req.value === 'admin';
  fieldRef.value?.resolveValidation(req.requestId, {
    invalid: taken,
    errors: taken ? ['This username is already taken.'] : [],
  });
}
</script>

<template>
  <div class="w-full max-w-md">
    <${pkgPrefix}FormRoot${styleAttr}>
      <${pkgPrefix}FormField${styleAttr}
        ref="fieldRef"
        name="account"
        :required="true"
        :externalValidation="true"
        validationMode="onChange"
        @validationRequest="handleValidation"
      >
        <${pkgPrefix}FieldLabel${styleAttr}>Username</${pkgPrefix}FieldLabel>
        <${pkgPrefix}FieldControl${styleAttr} :value="account" @valueChange="({ value }) => (account = value)" />
        <${pkgPrefix}FieldError${styleAttr} />
      </${pkgPrefix}FormField>
      <div class="flex flex-wrap items-center gap-2 pt-1">
        <${pkgPrefix}FormSubmit${styleAttr}>Submit</${pkgPrefix}FormSubmit>
        <${pkgPrefix}FormReset${styleAttr}>Reset</${pkgPrefix}FormReset>
      </div>
    </${pkgPrefix}FormRoot>
  </div>
</template>
`);

const vue2Validation = (pkgPrefix: string, styleAttr = '') =>
  formatCode(`
<template>
  <div class="w-full max-w-md">
    <${pkgPrefix}FormRoot${styleAttr}>
      <${pkgPrefix}FormField${styleAttr}
        ref="accountField"
        name="account"
        :required="true"
        :externalValidation="true"
        validationMode="onChange"
        @validationRequest="handleValidation"
      >
        <${pkgPrefix}FieldLabel${styleAttr}>Username</${pkgPrefix}FieldLabel>
        <${pkgPrefix}FieldControl${styleAttr} :value="account" @valueChange="onValueChange" />
        <${pkgPrefix}FieldError${styleAttr} />
      </${pkgPrefix}FormField>
      <div class="flex flex-wrap items-center gap-2 pt-1">
        <${pkgPrefix}FormSubmit${styleAttr}>Submit</${pkgPrefix}FormSubmit>
        <${pkgPrefix}FormReset${styleAttr}>Reset</${pkgPrefix}FormReset>
      </div>
    </${pkgPrefix}FormRoot>
  </div>
</template>

<script>
import {
  ${pkgPrefix}FormRoot,
  ${pkgPrefix}FormField,
  ${pkgPrefix}FormSubmit,
  ${pkgPrefix}FormReset,
  ${pkgPrefix}FieldLabel,
  ${pkgPrefix}FieldControl,
  ${pkgPrefix}FieldError,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${pkgPrefix}FormRoot,
    ${pkgPrefix}FormField,
    ${pkgPrefix}FormSubmit,
    ${pkgPrefix}FormReset,
    ${pkgPrefix}FieldLabel,
    ${pkgPrefix}FieldControl,
    ${pkgPrefix}FieldError,
  },
  data() {
    return { account: 'ada' };
  },
  methods: {
    onValueChange({ value }) {
      this.account = value;
    },
    handleValidation(req) {
      const taken = req.value === 'admin';
      this.$refs.accountField.resolveValidation(req.requestId, {
        invalid: taken,
        errors: taken ? ['This username is already taken.'] : [],
      });
    },
  },
};
</script>
`);

const wcDisabled = (prefix: string) =>
  formatCode(`
<div class="w-full max-w-md">
  <proto-ui-${prefix}-form-root id="${prefix}-disabled-form">
    <proto-ui-${prefix}-form-field id="${prefix}-email-field">
      <proto-ui-${prefix}-field-label>Contact email</proto-ui-${prefix}-field-label>
      <proto-ui-${prefix}-field-control id="${prefix}-email-control"></proto-ui-${prefix}-field-control>
    </proto-ui-${prefix}-form-field>
    <proto-ui-${prefix}-fieldset-root id="${prefix}-billing-group">
      <proto-ui-${prefix}-fieldset-legend>Billing details</proto-ui-${prefix}-fieldset-legend>
      <proto-ui-${prefix}-form-field id="${prefix}-company-field">
        <proto-ui-${prefix}-field-label>Company</proto-ui-${prefix}-field-label>
        <proto-ui-${prefix}-field-control id="${prefix}-company-control"></proto-ui-${prefix}-field-control>
      </proto-ui-${prefix}-form-field>
    </proto-ui-${prefix}-fieldset-root>
    <div class="flex flex-wrap items-center gap-2 pt-1">
      <proto-ui-${prefix}-form-submit>Submit</proto-ui-${prefix}-form-submit>
      <proto-ui-${prefix}-form-reset>Reset</proto-ui-${prefix}-form-reset>
    </div>
  </proto-ui-${prefix}-form-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#${prefix}-email-field'), { name: 'email', required: true });
  setElementProps(document.querySelector('#${prefix}-email-control'), { defaultValue: 'ada@example.com' });
  setElementProps(document.querySelector('#${prefix}-billing-group'), { disabled: true });
  setElementProps(document.querySelector('#${prefix}-company-field'), { name: 'company' });
  setElementProps(document.querySelector('#${prefix}-company-control'), { defaultValue: 'Analytical Engine Co.' });
</script>
`);

const reactDisabled = (pkgPrefix: string, styleAttr = '') =>
  formatCode(`
import {
  ${pkgPrefix}FormRoot,
  ${pkgPrefix}FormField,
  ${pkgPrefix}FormSubmit,
  ${pkgPrefix}FormReset,
  ${pkgPrefix}FieldsetRoot,
  ${pkgPrefix}FieldsetLegend,
  ${pkgPrefix}FieldLabel,
  ${pkgPrefix}FieldControl,
} from '../proto-ui/components/react';

export function DisabledFieldsetFormDemo() {
  return (
    <div className="w-full max-w-md">
      <${pkgPrefix}FormRoot${styleAttr} onSubmit={({ values }) => console.log(values)}>
        <${pkgPrefix}FormField${styleAttr} name="email" required>
          <${pkgPrefix}FieldLabel${styleAttr}>Contact email</${pkgPrefix}FieldLabel>
          <${pkgPrefix}FieldControl${styleAttr} defaultValue="ada@example.com" />
        </${pkgPrefix}FormField>
        <${pkgPrefix}FieldsetRoot${styleAttr} disabled>
          <${pkgPrefix}FieldsetLegend${styleAttr}>Billing details</${pkgPrefix}FieldsetLegend>
          <${pkgPrefix}FormField${styleAttr} name="company">
            <${pkgPrefix}FieldLabel${styleAttr}>Company</${pkgPrefix}FieldLabel>
            <${pkgPrefix}FieldControl${styleAttr} defaultValue="Analytical Engine Co." />
          </${pkgPrefix}FormField>
        </${pkgPrefix}FieldsetRoot>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <${pkgPrefix}FormSubmit${styleAttr}>Submit</${pkgPrefix}FormSubmit>
          <${pkgPrefix}FormReset${styleAttr}>Reset</${pkgPrefix}FormReset>
        </div>
      </${pkgPrefix}FormRoot>
    </div>
  );
}
`);

const vueDisabled = (pkgPrefix: string, styleAttr = '') =>
  formatCode(`
<script setup lang="ts">
import {
  ${pkgPrefix}FormRoot,
  ${pkgPrefix}FormField,
  ${pkgPrefix}FormSubmit,
  ${pkgPrefix}FormReset,
  ${pkgPrefix}FieldsetRoot,
  ${pkgPrefix}FieldsetLegend,
  ${pkgPrefix}FieldLabel,
  ${pkgPrefix}FieldControl,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="w-full max-w-md">
    <${pkgPrefix}FormRoot${styleAttr}>
      <${pkgPrefix}FormField${styleAttr} name="email" :required="true">
        <${pkgPrefix}FieldLabel${styleAttr}>Contact email</${pkgPrefix}FieldLabel>
        <${pkgPrefix}FieldControl${styleAttr} defaultValue="ada@example.com" />
      </${pkgPrefix}FormField>
      <${pkgPrefix}FieldsetRoot${styleAttr} :disabled="true">
        <${pkgPrefix}FieldsetLegend${styleAttr}>Billing details</${pkgPrefix}FieldsetLegend>
        <${pkgPrefix}FormField${styleAttr} name="company">
          <${pkgPrefix}FieldLabel${styleAttr}>Company</${pkgPrefix}FieldLabel>
          <${pkgPrefix}FieldControl${styleAttr} defaultValue="Analytical Engine Co." />
        </${pkgPrefix}FormField>
      </${pkgPrefix}FieldsetRoot>
      <div class="flex flex-wrap items-center gap-2 pt-1">
        <${pkgPrefix}FormSubmit${styleAttr}>Submit</${pkgPrefix}FormSubmit>
        <${pkgPrefix}FormReset${styleAttr}>Reset</${pkgPrefix}FormReset>
      </div>
    </${pkgPrefix}FormRoot>
  </div>
</template>
`);

const vue2Disabled = (pkgPrefix: string, styleAttr = '') =>
  formatCode(`
<template>
  <div class="w-full max-w-md">
    <${pkgPrefix}FormRoot${styleAttr}>
      <${pkgPrefix}FormField${styleAttr} name="email" :required="true">
        <${pkgPrefix}FieldLabel${styleAttr}>Contact email</${pkgPrefix}FieldLabel>
        <${pkgPrefix}FieldControl${styleAttr} defaultValue="ada@example.com" />
      </${pkgPrefix}FormField>
      <${pkgPrefix}FieldsetRoot${styleAttr} :disabled="true">
        <${pkgPrefix}FieldsetLegend${styleAttr}>Billing details</${pkgPrefix}FieldsetLegend>
        <${pkgPrefix}FormField${styleAttr} name="company">
          <${pkgPrefix}FieldLabel${styleAttr}>Company</${pkgPrefix}FieldLabel>
          <${pkgPrefix}FieldControl${styleAttr} defaultValue="Analytical Engine Co." />
        </${pkgPrefix}FormField>
      </${pkgPrefix}FieldsetRoot>
      <div class="flex flex-wrap items-center gap-2 pt-1">
        <${pkgPrefix}FormSubmit${styleAttr}>Submit</${pkgPrefix}FormSubmit>
        <${pkgPrefix}FormReset${styleAttr}>Reset</${pkgPrefix}FormReset>
      </div>
    </${pkgPrefix}FormRoot>
  </div>
</template>

<script>
import {
  ${pkgPrefix}FormRoot,
  ${pkgPrefix}FormField,
  ${pkgPrefix}FormSubmit,
  ${pkgPrefix}FormReset,
  ${pkgPrefix}FieldsetRoot,
  ${pkgPrefix}FieldsetLegend,
  ${pkgPrefix}FieldLabel,
  ${pkgPrefix}FieldControl,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${pkgPrefix}FormRoot,
    ${pkgPrefix}FormField,
    ${pkgPrefix}FormSubmit,
    ${pkgPrefix}FormReset,
    ${pkgPrefix}FieldsetRoot,
    ${pkgPrefix}FieldsetLegend,
    ${pkgPrefix}FieldLabel,
    ${pkgPrefix}FieldControl,
  },
};
</script>
`);

const wcChoices = (prefix: string) =>
  formatCode(`
<proto-ui-${prefix}-form-root id="${prefix}-choice-form">
  <proto-ui-${prefix}-form-field id="${prefix}-agree-field">
    <proto-ui-${prefix}-field-label>Accept updates</proto-ui-${prefix}-field-label>
    <proto-ui-${prefix}-field-checkbox id="${prefix}-agree">
      <proto-ui-${prefix}-checkbox-indicator></proto-ui-${prefix}-checkbox-indicator>
    </proto-ui-${prefix}-field-checkbox>
    <proto-ui-${prefix}-field-error></proto-ui-${prefix}-field-error>
  </proto-ui-${prefix}-form-field>
  <proto-ui-${prefix}-form-field id="${prefix}-alerts-field">
    <proto-ui-${prefix}-field-label>Alerts</proto-ui-${prefix}-field-label>
    <proto-ui-${prefix}-field-switch id="${prefix}-alerts">
      <proto-ui-${prefix}-switch-thumb></proto-ui-${prefix}-switch-thumb>
    </proto-ui-${prefix}-field-switch>
  </proto-ui-${prefix}-form-field>
  <div class="flex flex-wrap gap-2">
    <proto-ui-${prefix}-form-submit>Submit</proto-ui-${prefix}-form-submit>
    <proto-ui-${prefix}-form-reset>Reset</proto-ui-${prefix}-form-reset>
  </div>
</proto-ui-${prefix}-form-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#${prefix}-agree-field'), { name: 'agreement', required: true });
  setElementProps(document.querySelector('#${prefix}-alerts-field'), { name: 'alerts' });
</script>
`);

const reactChoices = (pkgPrefix: string, styleAttr = '') =>
  formatCode(`
import {
  ${pkgPrefix}FormRoot,
  ${pkgPrefix}FormField,
  ${pkgPrefix}FormSubmit,
  ${pkgPrefix}FormReset,
  ${pkgPrefix}FieldLabel,
  ${pkgPrefix}FieldError,
  ${pkgPrefix}FieldCheckbox,
  ${pkgPrefix}CheckboxIndicator,
  ${pkgPrefix}FieldSwitch,
  ${pkgPrefix}SwitchThumb,
} from '../proto-ui/components/react';

export function FieldChoicesFormDemo() {
  return (
    <${pkgPrefix}FormRoot${styleAttr} onSubmit={({ values }) => console.log(values)}>
      <${pkgPrefix}FormField${styleAttr} name="agreement" required>
        <${pkgPrefix}FieldLabel${styleAttr}>Accept updates</${pkgPrefix}FieldLabel>
        <${pkgPrefix}FieldCheckbox${styleAttr}>
          <${pkgPrefix}CheckboxIndicator${styleAttr} />
        </${pkgPrefix}FieldCheckbox>
        <${pkgPrefix}FieldError${styleAttr} />
      </${pkgPrefix}FormField>
      <${pkgPrefix}FormField${styleAttr} name="alerts">
        <${pkgPrefix}FieldLabel${styleAttr}>Alerts</${pkgPrefix}FieldLabel>
        <${pkgPrefix}FieldSwitch${styleAttr} defaultChecked={false}>
          <${pkgPrefix}SwitchThumb${styleAttr} />
        </${pkgPrefix}FieldSwitch>
      </${pkgPrefix}FormField>
      <div className="flex flex-wrap gap-2">
        <${pkgPrefix}FormSubmit${styleAttr}>Submit</${pkgPrefix}FormSubmit>
        <${pkgPrefix}FormReset${styleAttr}>Reset</${pkgPrefix}FormReset>
      </div>
    </${pkgPrefix}FormRoot>
  );
}
`);

const vueChoices = (pkgPrefix: string, styleAttr = '') =>
  formatCode(`
<script setup lang="ts">
import {
  ${pkgPrefix}FormRoot,
  ${pkgPrefix}FormField,
  ${pkgPrefix}FormSubmit,
  ${pkgPrefix}FormReset,
  ${pkgPrefix}FieldLabel,
  ${pkgPrefix}FieldError,
  ${pkgPrefix}FieldCheckbox,
  ${pkgPrefix}CheckboxIndicator,
  ${pkgPrefix}FieldSwitch,
  ${pkgPrefix}SwitchThumb,
} from '../proto-ui/components/vue';
</script>

<template>
  <${pkgPrefix}FormRoot${styleAttr}>
    <${pkgPrefix}FormField${styleAttr} name="agreement" :required="true">
      <${pkgPrefix}FieldLabel${styleAttr}>Accept updates</${pkgPrefix}FieldLabel>
      <${pkgPrefix}FieldCheckbox${styleAttr}>
        <${pkgPrefix}CheckboxIndicator${styleAttr} />
      </${pkgPrefix}FieldCheckbox>
      <${pkgPrefix}FieldError${styleAttr} />
    </${pkgPrefix}FormField>
    <${pkgPrefix}FormField${styleAttr} name="alerts">
      <${pkgPrefix}FieldLabel${styleAttr}>Alerts</${pkgPrefix}FieldLabel>
      <${pkgPrefix}FieldSwitch${styleAttr} :defaultChecked="false">
        <${pkgPrefix}SwitchThumb${styleAttr} />
      </${pkgPrefix}FieldSwitch>
    </${pkgPrefix}FormField>
    <div class="flex flex-wrap gap-2">
      <${pkgPrefix}FormSubmit${styleAttr}>Submit</${pkgPrefix}FormSubmit>
      <${pkgPrefix}FormReset${styleAttr}>Reset</${pkgPrefix}FormReset>
    </div>
  </${pkgPrefix}FormRoot>
</template>
`);

const vue2Choices = (pkgPrefix: string, styleAttr = '') =>
  formatCode(`
<template>
  <${pkgPrefix}FormRoot${styleAttr}>
    <${pkgPrefix}FormField${styleAttr} name="agreement" :required="true">
      <${pkgPrefix}FieldLabel${styleAttr}>Accept updates</${pkgPrefix}FieldLabel>
      <${pkgPrefix}FieldCheckbox${styleAttr}>
        <${pkgPrefix}CheckboxIndicator${styleAttr} />
      </${pkgPrefix}FieldCheckbox>
      <${pkgPrefix}FieldError${styleAttr} />
    </${pkgPrefix}FormField>
    <${pkgPrefix}FormField${styleAttr} name="alerts">
      <${pkgPrefix}FieldLabel${styleAttr}>Alerts</${pkgPrefix}FieldLabel>
      <${pkgPrefix}FieldSwitch${styleAttr} :defaultChecked="false">
        <${pkgPrefix}SwitchThumb${styleAttr} />
      </${pkgPrefix}FieldSwitch>
    </${pkgPrefix}FormField>
    <div class="flex flex-wrap gap-2">
      <${pkgPrefix}FormSubmit${styleAttr}>Submit</${pkgPrefix}FormSubmit>
      <${pkgPrefix}FormReset${styleAttr}>Reset</${pkgPrefix}FormReset>
    </div>
  </${pkgPrefix}FormRoot>
</template>

<script>
import {
  ${pkgPrefix}FormRoot,
  ${pkgPrefix}FormField,
  ${pkgPrefix}FormSubmit,
  ${pkgPrefix}FormReset,
  ${pkgPrefix}FieldLabel,
  ${pkgPrefix}FieldError,
  ${pkgPrefix}FieldCheckbox,
  ${pkgPrefix}CheckboxIndicator,
  ${pkgPrefix}FieldSwitch,
  ${pkgPrefix}SwitchThumb,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${pkgPrefix}FormRoot,
    ${pkgPrefix}FormField,
    ${pkgPrefix}FormSubmit,
    ${pkgPrefix}FormReset,
    ${pkgPrefix}FieldLabel,
    ${pkgPrefix}FieldError,
    ${pkgPrefix}FieldCheckbox,
    ${pkgPrefix}CheckboxIndicator,
    ${pkgPrefix}FieldSwitch,
    ${pkgPrefix}SwitchThumb,
  },
};
</script>
`);

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-form': wcHero('shadcn'),
    'demo-shadcn-form-profile': wcProfile('shadcn', "{ styleProfile: 'rhea', variant: 'outline' }"),
    'demo-shadcn-form-actions': formatCode(`
<div class="w-full max-w-md">
  <proto-ui-shadcn-form-root id="shadcn-actions-form">
    <proto-ui-shadcn-form-field id="shadcn-project-field">
      <proto-ui-shadcn-field-label>Project name</proto-ui-shadcn-field-label>
      <proto-ui-shadcn-field-control id="shadcn-project-control"></proto-ui-shadcn-field-control>
    </proto-ui-shadcn-form-field>
    <div class="flex flex-wrap items-center gap-2">
      <proto-ui-shadcn-form-submit id="shadcn-submit-default">Save</proto-ui-shadcn-form-submit>
      <proto-ui-shadcn-form-reset id="shadcn-reset-outline">Reset</proto-ui-shadcn-form-reset>
      <proto-ui-shadcn-form-submit id="shadcn-submit-destructive">Delete</proto-ui-shadcn-form-submit>
      <proto-ui-shadcn-form-reset id="shadcn-reset-ghost">Cancel</proto-ui-shadcn-form-reset>
    </div>
  </proto-ui-shadcn-form-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#shadcn-project-field'), { name: 'project', required: true });
  setElementProps(document.querySelector('#shadcn-project-control'), { defaultValue: 'proto-ui-docs' });
  setElementProps(document.querySelector('#shadcn-submit-default'), { styleProfile: 'rhea', variant: 'default' });
  setElementProps(document.querySelector('#shadcn-reset-outline'), { styleProfile: 'rhea', variant: 'outline' });
  setElementProps(document.querySelector('#shadcn-submit-destructive'), { styleProfile: 'rhea', variant: 'destructive', size: 'sm' });
  setElementProps(document.querySelector('#shadcn-reset-ghost'), { styleProfile: 'rhea', variant: 'ghost', size: 'sm' });
</script>
`),
    'demo-shadcn-form-disabled': wcDisabled('shadcn'),
    'demo-shadcn-form-validation': wcValidation('shadcn'),
    'demo-shadcn-field-choices': wcChoices('shadcn'),

    'demo-brutalist-form': wcHero('brutalist'),
    'demo-brutalist-form-profile': wcProfile('brutalist'),
    'demo-brutalist-form-bug-report': formatCode(`
<div class="w-full max-w-md">
  <proto-ui-brutalist-form-root id="brutalist-bug-form">
    <proto-ui-brutalist-fieldset-root>
      <proto-ui-brutalist-fieldset-legend>Bug Report</proto-ui-brutalist-fieldset-legend>
      <proto-ui-brutalist-form-field id="bug-title-field">
        <proto-ui-brutalist-field-label>Bug title</proto-ui-brutalist-field-label>
        <proto-ui-brutalist-field-control id="bug-title-input"></proto-ui-brutalist-field-control>
        <proto-ui-brutalist-field-error></proto-ui-brutalist-field-error>
      </proto-ui-brutalist-form-field>
      <proto-ui-brutalist-form-field id="bug-desc-field">
        <proto-ui-brutalist-field-label>Description</proto-ui-brutalist-field-label>
        <proto-ui-brutalist-field-textarea id="bug-desc-input"></proto-ui-brutalist-field-textarea>
        <proto-ui-brutalist-field-error></proto-ui-brutalist-field-error>
      </proto-ui-brutalist-form-field>
    </proto-ui-brutalist-fieldset-root>
    <div class="flex flex-wrap items-center gap-2 pt-1">
      <proto-ui-brutalist-form-submit>Submit report</proto-ui-brutalist-form-submit>
      <proto-ui-brutalist-form-reset>Reset</proto-ui-brutalist-form-reset>
    </div>
  </proto-ui-brutalist-form-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#bug-title-field'), { name: 'title', required: true });
  setElementProps(document.querySelector('#bug-desc-field'), { name: 'description', required: true });
</script>
`),
    'demo-brutalist-form-disabled': wcDisabled('brutalist'),
    'demo-brutalist-form-validation': wcValidation('brutalist'),
    'demo-brutalist-field-choices': wcChoices('brutalist'),

    'demo-bootstrap-2-3-2-form': wcHero('bootstrap-2-3-2'),
    'demo-bootstrap-2-3-2-form-profile': wcProfile('bootstrap-2-3-2'),
    'demo-bootstrap-2-3-2-form-actions': formatCode(`
<div class="w-full max-w-md">
  <proto-ui-bootstrap-2-3-2-form-root id="bs-actions-form">
    <proto-ui-bootstrap-2-3-2-form-field id="bs-env-field">
      <proto-ui-bootstrap-2-3-2-field-label>Target environment</proto-ui-bootstrap-2-3-2-field-label>
      <proto-ui-bootstrap-2-3-2-field-control id="bs-env-control"></proto-ui-bootstrap-2-3-2-field-control>
    </proto-ui-bootstrap-2-3-2-form-field>
    <div class="flex flex-wrap items-center gap-2 border-t border-border bg-muted/40 p-3">
      <proto-ui-bootstrap-2-3-2-form-submit id="bs-save">Save changes</proto-ui-bootstrap-2-3-2-form-submit>
      <proto-ui-bootstrap-2-3-2-form-submit id="bs-purge">Purge cache</proto-ui-bootstrap-2-3-2-form-submit>
      <proto-ui-bootstrap-2-3-2-form-reset>Cancel</proto-ui-bootstrap-2-3-2-form-reset>
    </div>
  </proto-ui-bootstrap-2-3-2-form-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#bs-env-field'), { name: 'environment', required: true });
  setElementProps(document.querySelector('#bs-env-control'), { defaultValue: 'production' });
  setElementProps(document.querySelector('#bs-save'), { variant: 'primary' });
  setElementProps(document.querySelector('#bs-purge'), { variant: 'danger' });
</script>
`),
    'demo-bootstrap-2-3-2-form-validation': wcValidation('bootstrap-2-3-2'),

    'demo-liquid-glass-form': wcHero('liquid-glass'),
    'demo-liquid-glass-form-profile': wcProfile('liquid-glass'),
    'demo-liquid-glass-form-material': formatCode(`
<div class="rounded-2xl bg-gradient-to-br from-sky-500/25 via-indigo-500/20 to-fuchsia-500/25 p-6">
  <div class="mx-auto max-w-md rounded-2xl border border-border bg-background/85 p-5">
    <proto-ui-liquid-glass-form-root id="lg-material-form">
      <proto-ui-liquid-glass-form-field id="lg-workspace-field">
        <proto-ui-liquid-glass-field-label>Workspace name</proto-ui-liquid-glass-field-label>
        <proto-ui-liquid-glass-field-control id="lg-workspace-control"></proto-ui-liquid-glass-field-control>
      </proto-ui-liquid-glass-form-field>
      <div class="flex flex-wrap items-center gap-2">
        <proto-ui-liquid-glass-form-submit id="lg-submit-auto">Save workspace</proto-ui-liquid-glass-form-submit>
        <proto-ui-liquid-glass-form-reset id="lg-reset-auto">Reset</proto-ui-liquid-glass-form-reset>
        <proto-ui-liquid-glass-form-submit id="lg-submit-opaque">Archive</proto-ui-liquid-glass-form-submit>
      </div>
    </proto-ui-liquid-glass-form-root>
  </div>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#lg-workspace-field'), { name: 'workspace', required: true });
  setElementProps(document.querySelector('#lg-workspace-control'), { defaultValue: 'Design Systems' });
  setElementProps(document.querySelector('#lg-submit-auto'), { variant: 'prominent', material: 'auto' });
  setElementProps(document.querySelector('#lg-reset-auto'), { variant: 'regular', material: 'auto' });
  setElementProps(document.querySelector('#lg-submit-opaque'), { variant: 'destructive', material: 'opaque' });
</script>
`),
    'demo-liquid-glass-form-validation': wcValidation('liquid-glass'),
  },
  react: {
    'demo-shadcn-form': reactHero('Shadcn', ' styleProfile="rhea"', ' variant="outline"'),
    'demo-shadcn-form-profile': reactProfile(
      'Shadcn',
      ' styleProfile="rhea"',
      ' variant="outline"'
    ),
    'demo-shadcn-form-actions': formatCode(`
import {
  ShadcnFormRoot,
  ShadcnFormField,
  ShadcnFormSubmit,
  ShadcnFormReset,
  ShadcnFieldLabel,
  ShadcnFieldControl,
} from '../proto-ui/components/react';

export function FormActionsDemo() {
  return (
    <div className="w-full max-w-md">
      <ShadcnFormRoot styleProfile="rhea" ariaLabel="Action variants form">
        <ShadcnFormField styleProfile="rhea" name="project" required>
          <ShadcnFieldLabel styleProfile="rhea">Project name</ShadcnFieldLabel>
          <ShadcnFieldControl styleProfile="rhea" defaultValue="proto-ui-docs" />
        </ShadcnFormField>
        <div className="flex flex-wrap items-center gap-2">
          <ShadcnFormSubmit styleProfile="rhea" variant="default">Save</ShadcnFormSubmit>
          <ShadcnFormReset styleProfile="rhea" variant="outline">Reset</ShadcnFormReset>
          <ShadcnFormSubmit styleProfile="rhea" variant="destructive" size="sm">Delete</ShadcnFormSubmit>
          <ShadcnFormReset styleProfile="rhea" variant="ghost" size="sm">Cancel</ShadcnFormReset>
        </div>
      </ShadcnFormRoot>
    </div>
  );
}
`),
    'demo-shadcn-form-disabled': reactDisabled('Shadcn', ' styleProfile="rhea"'),
    'demo-shadcn-form-validation': reactValidation('Shadcn', ' styleProfile="rhea"'),
    'demo-shadcn-field-choices': reactChoices('Shadcn', ' styleProfile="rhea"'),

    'demo-brutalist-form': reactHero('Brutalist'),
    'demo-brutalist-form-profile': reactProfile('Brutalist'),
    'demo-brutalist-form-bug-report': formatCode(`
import {
  BrutalistFormRoot,
  BrutalistFormField,
  BrutalistFormSubmit,
  BrutalistFormReset,
  BrutalistFieldsetRoot,
  BrutalistFieldsetLegend,
  BrutalistFieldLabel,
  BrutalistFieldControl,
  BrutalistFieldTextarea,
  BrutalistFieldError,
} from '../proto-ui/components/react';

export function BrutalistBugReportDemo() {
  return (
    <div className="w-full max-w-md">
      <BrutalistFormRoot ariaLabel="Bug report form" onSubmit={({ values }) => console.log(values)}>
        <BrutalistFieldsetRoot>
          <BrutalistFieldsetLegend>Bug Report</BrutalistFieldsetLegend>
          <BrutalistFormField name="title" required>
            <BrutalistFieldLabel>Bug title</BrutalistFieldLabel>
            <BrutalistFieldControl placeholder="Submit button alignment in narrow card" />
            <BrutalistFieldError />
          </BrutalistFormField>
          <BrutalistFormField name="description" required>
            <BrutalistFieldLabel>Description</BrutalistFieldLabel>
            <BrutalistFieldTextarea placeholder="Include steps to reproduce and expected behavior." rows={3} />
            <BrutalistFieldError />
          </BrutalistFormField>
        </BrutalistFieldsetRoot>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <BrutalistFormSubmit>Submit report</BrutalistFormSubmit>
          <BrutalistFormReset>Reset</BrutalistFormReset>
        </div>
      </BrutalistFormRoot>
    </div>
  );
}
`),
    'demo-brutalist-form-disabled': reactDisabled('Brutalist'),
    'demo-brutalist-form-validation': reactValidation('Brutalist'),
    'demo-brutalist-field-choices': reactChoices('Brutalist'),

    'demo-bootstrap-2-3-2-form': reactHero('Bootstrap232'),
    'demo-bootstrap-2-3-2-form-profile': reactProfile('Bootstrap232'),
    'demo-bootstrap-2-3-2-form-actions': formatCode(`
import {
  Bootstrap232FormRoot,
  Bootstrap232FormField,
  Bootstrap232FormSubmit,
  Bootstrap232FormReset,
  Bootstrap232FieldLabel,
  Bootstrap232FieldControl,
} from '../proto-ui/components/react';

export function BootstrapFormActionsDemo() {
  return (
    <div className="w-full max-w-md">
      <Bootstrap232FormRoot ariaLabel="Deployment settings">
        <Bootstrap232FormField name="environment" required>
          <Bootstrap232FieldLabel>Target environment</Bootstrap232FieldLabel>
          <Bootstrap232FieldControl defaultValue="production" />
        </Bootstrap232FormField>
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/40 p-3">
          <Bootstrap232FormSubmit variant="primary">Save changes</Bootstrap232FormSubmit>
          <Bootstrap232FormSubmit variant="danger">Purge cache</Bootstrap232FormSubmit>
          <Bootstrap232FormReset variant="default">Cancel</Bootstrap232FormReset>
        </div>
      </Bootstrap232FormRoot>
    </div>
  );
}
`),
    'demo-bootstrap-2-3-2-form-validation': reactValidation('Bootstrap232'),

    'demo-liquid-glass-form': reactHero('LiquidGlass'),
    'demo-liquid-glass-form-profile': reactProfile('LiquidGlass'),
    'demo-liquid-glass-form-material': formatCode(`
import {
  LiquidGlassFormRoot,
  LiquidGlassFormField,
  LiquidGlassFormSubmit,
  LiquidGlassFormReset,
  LiquidGlassFieldLabel,
  LiquidGlassFieldControl,
} from '../proto-ui/components/react';

export function LiquidGlassFormMaterialDemo() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-sky-500/25 via-indigo-500/20 to-fuchsia-500/25 p-6">
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-background/85 p-5">
        <LiquidGlassFormRoot ariaLabel="Workspace settings">
          <LiquidGlassFormField name="workspace" required>
            <LiquidGlassFieldLabel>Workspace name</LiquidGlassFieldLabel>
            <LiquidGlassFieldControl defaultValue="Design Systems" />
          </LiquidGlassFormField>
          <div className="flex flex-wrap items-center gap-2">
            <LiquidGlassFormSubmit variant="prominent" material="auto">Save workspace</LiquidGlassFormSubmit>
            <LiquidGlassFormReset variant="regular" material="auto">Reset</LiquidGlassFormReset>
            <LiquidGlassFormSubmit variant="destructive" material="opaque">Archive</LiquidGlassFormSubmit>
          </div>
        </LiquidGlassFormRoot>
      </div>
    </div>
  );
}
`),
    'demo-liquid-glass-form-validation': reactValidation('LiquidGlass'),
  },
  vue: {
    'demo-shadcn-form': vueHero('Shadcn', ' styleProfile="rhea"', ' variant="outline"'),
    'demo-shadcn-form-profile': vueProfile('Shadcn', ' styleProfile="rhea"', ' variant="outline"'),
    'demo-shadcn-form-actions': formatCode(`
<script setup lang="ts">
import {
  ShadcnFormRoot,
  ShadcnFormField,
  ShadcnFormSubmit,
  ShadcnFormReset,
  ShadcnFieldLabel,
  ShadcnFieldControl,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="w-full max-w-md">
    <ShadcnFormRoot styleProfile="rhea" ariaLabel="Action variants form">
      <ShadcnFormField styleProfile="rhea" name="project" :required="true">
        <ShadcnFieldLabel styleProfile="rhea">Project name</ShadcnFieldLabel>
        <ShadcnFieldControl styleProfile="rhea" defaultValue="proto-ui-docs" />
      </ShadcnFormField>
      <div class="flex flex-wrap items-center gap-2">
        <ShadcnFormSubmit styleProfile="rhea" variant="default">Save</ShadcnFormSubmit>
        <ShadcnFormReset styleProfile="rhea" variant="outline">Reset</ShadcnFormReset>
        <ShadcnFormSubmit styleProfile="rhea" variant="destructive" size="sm">Delete</ShadcnFormSubmit>
        <ShadcnFormReset styleProfile="rhea" variant="ghost" size="sm">Cancel</ShadcnFormReset>
      </div>
    </ShadcnFormRoot>
  </div>
</template>
`),
    'demo-shadcn-form-disabled': vueDisabled('Shadcn', ' styleProfile="rhea"'),
    'demo-shadcn-form-validation': vueValidation('Shadcn', ' styleProfile="rhea"'),
    'demo-shadcn-field-choices': vueChoices('Shadcn', ' styleProfile="rhea"'),

    'demo-brutalist-form': vueHero('Brutalist'),
    'demo-brutalist-form-profile': vueProfile('Brutalist'),
    'demo-brutalist-form-bug-report': formatCode(`
<script setup lang="ts">
import {
  BrutalistFormRoot,
  BrutalistFormField,
  BrutalistFormSubmit,
  BrutalistFormReset,
  BrutalistFieldsetRoot,
  BrutalistFieldsetLegend,
  BrutalistFieldLabel,
  BrutalistFieldControl,
  BrutalistFieldTextarea,
  BrutalistFieldError,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="w-full max-w-md">
    <BrutalistFormRoot ariaLabel="Bug report form">
      <BrutalistFieldsetRoot>
        <BrutalistFieldsetLegend>Bug Report</BrutalistFieldsetLegend>
        <BrutalistFormField name="title" :required="true">
          <BrutalistFieldLabel>Bug title</BrutalistFieldLabel>
          <BrutalistFieldControl placeholder="Submit button alignment in narrow card" />
          <BrutalistFieldError />
        </BrutalistFormField>
        <BrutalistFormField name="description" :required="true">
          <BrutalistFieldLabel>Description</BrutalistFieldLabel>
          <BrutalistFieldTextarea placeholder="Include steps to reproduce and expected behavior." :rows="3" />
          <BrutalistFieldError />
        </BrutalistFormField>
      </BrutalistFieldsetRoot>
      <div class="flex flex-wrap items-center gap-2 pt-1">
        <BrutalistFormSubmit>Submit report</BrutalistFormSubmit>
        <BrutalistFormReset>Reset</BrutalistFormReset>
      </div>
    </BrutalistFormRoot>
  </div>
</template>
`),
    'demo-brutalist-form-disabled': vueDisabled('Brutalist'),
    'demo-brutalist-form-validation': vueValidation('Brutalist'),
    'demo-brutalist-field-choices': vueChoices('Brutalist'),

    'demo-bootstrap-2-3-2-form': vueHero('Bootstrap232'),
    'demo-bootstrap-2-3-2-form-profile': vueProfile('Bootstrap232'),
    'demo-bootstrap-2-3-2-form-actions': formatCode(`
<script setup lang="ts">
import {
  Bootstrap232FormRoot,
  Bootstrap232FormField,
  Bootstrap232FormSubmit,
  Bootstrap232FormReset,
  Bootstrap232FieldLabel,
  Bootstrap232FieldControl,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="w-full max-w-md">
    <Bootstrap232FormRoot ariaLabel="Deployment settings">
      <Bootstrap232FormField name="environment" :required="true">
        <Bootstrap232FieldLabel>Target environment</Bootstrap232FieldLabel>
        <Bootstrap232FieldControl defaultValue="production" />
      </Bootstrap232FormField>
      <div class="flex flex-wrap items-center gap-2 border-t border-border bg-muted/40 p-3">
        <Bootstrap232FormSubmit variant="primary">Save changes</Bootstrap232FormSubmit>
        <Bootstrap232FormSubmit variant="danger">Purge cache</Bootstrap232FormSubmit>
        <Bootstrap232FormReset variant="default">Cancel</Bootstrap232FormReset>
      </div>
    </Bootstrap232FormRoot>
  </div>
</template>
`),
    'demo-bootstrap-2-3-2-form-validation': vueValidation('Bootstrap232'),

    'demo-liquid-glass-form': vueHero('LiquidGlass'),
    'demo-liquid-glass-form-profile': vueProfile('LiquidGlass'),
    'demo-liquid-glass-form-material': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassFormRoot,
  LiquidGlassFormField,
  LiquidGlassFormSubmit,
  LiquidGlassFormReset,
  LiquidGlassFieldLabel,
  LiquidGlassFieldControl,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/25 via-indigo-500/20 to-fuchsia-500/25 p-6">
    <div class="mx-auto max-w-md rounded-2xl border border-border bg-background/85 p-5">
      <LiquidGlassFormRoot ariaLabel="Workspace settings">
        <LiquidGlassFormField name="workspace" :required="true">
          <LiquidGlassFieldLabel>Workspace name</LiquidGlassFieldLabel>
          <LiquidGlassFieldControl defaultValue="Design Systems" />
        </LiquidGlassFormField>
        <div class="flex flex-wrap items-center gap-2">
          <LiquidGlassFormSubmit variant="prominent" material="auto">Save workspace</LiquidGlassFormSubmit>
          <LiquidGlassFormReset variant="regular" material="auto">Reset</LiquidGlassFormReset>
          <LiquidGlassFormSubmit variant="destructive" material="opaque">Archive</LiquidGlassFormSubmit>
        </div>
      </LiquidGlassFormRoot>
    </div>
  </div>
</template>
`),
    'demo-liquid-glass-form-validation': vueValidation('LiquidGlass'),
  },
  vue2: {
    'demo-shadcn-form': vue2Hero('Shadcn', ' styleProfile="rhea"', ' variant="outline"'),
    'demo-shadcn-form-profile': vue2Profile('Shadcn', ' styleProfile="rhea"', ' variant="outline"'),
    'demo-shadcn-form-actions': formatCode(`
<template>
  <div class="w-full max-w-md">
    <ShadcnFormRoot styleProfile="rhea" ariaLabel="Action variants form">
      <ShadcnFormField styleProfile="rhea" name="project" :required="true">
        <ShadcnFieldLabel styleProfile="rhea">Project name</ShadcnFieldLabel>
        <ShadcnFieldControl styleProfile="rhea" defaultValue="proto-ui-docs" />
      </ShadcnFormField>
      <div class="flex flex-wrap items-center gap-2">
        <ShadcnFormSubmit styleProfile="rhea" variant="default">Save</ShadcnFormSubmit>
        <ShadcnFormReset styleProfile="rhea" variant="outline">Reset</ShadcnFormReset>
        <ShadcnFormSubmit styleProfile="rhea" variant="destructive" size="sm">Delete</ShadcnFormSubmit>
        <ShadcnFormReset styleProfile="rhea" variant="ghost" size="sm">Cancel</ShadcnFormReset>
      </div>
    </ShadcnFormRoot>
  </div>
</template>

<script>
import {
  ShadcnFormRoot,
  ShadcnFormField,
  ShadcnFormSubmit,
  ShadcnFormReset,
  ShadcnFieldLabel,
  ShadcnFieldControl,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnFormRoot,
    ShadcnFormField,
    ShadcnFormSubmit,
    ShadcnFormReset,
    ShadcnFieldLabel,
    ShadcnFieldControl,
  },
};
</script>
`),
    'demo-shadcn-form-disabled': vue2Disabled('Shadcn', ' styleProfile="rhea"'),
    'demo-shadcn-form-validation': vue2Validation('Shadcn', ' styleProfile="rhea"'),
    'demo-shadcn-field-choices': vue2Choices('Shadcn', ' styleProfile="rhea"'),

    'demo-brutalist-form': vue2Hero('Brutalist'),
    'demo-brutalist-form-profile': vue2Profile('Brutalist'),
    'demo-brutalist-form-bug-report': formatCode(`
<template>
  <div class="w-full max-w-md">
    <BrutalistFormRoot ariaLabel="Bug report form">
      <BrutalistFieldsetRoot>
        <BrutalistFieldsetLegend>Bug Report</BrutalistFieldsetLegend>
        <BrutalistFormField name="title" :required="true">
          <BrutalistFieldLabel>Bug title</BrutalistFieldLabel>
          <BrutalistFieldControl placeholder="Submit button alignment in narrow card" />
          <BrutalistFieldError />
        </BrutalistFormField>
        <BrutalistFormField name="description" :required="true">
          <BrutalistFieldLabel>Description</BrutalistFieldLabel>
          <BrutalistFieldTextarea placeholder="Include steps to reproduce and expected behavior." :rows="3" />
          <BrutalistFieldError />
        </BrutalistFormField>
      </BrutalistFieldsetRoot>
      <div class="flex flex-wrap items-center gap-2 pt-1">
        <BrutalistFormSubmit>Submit report</BrutalistFormSubmit>
        <BrutalistFormReset>Reset</BrutalistFormReset>
      </div>
    </BrutalistFormRoot>
  </div>
</template>

<script>
import {
  BrutalistFormRoot,
  BrutalistFormField,
  BrutalistFormSubmit,
  BrutalistFormReset,
  BrutalistFieldsetRoot,
  BrutalistFieldsetLegend,
  BrutalistFieldLabel,
  BrutalistFieldControl,
  BrutalistFieldTextarea,
  BrutalistFieldError,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistFormRoot,
    BrutalistFormField,
    BrutalistFormSubmit,
    BrutalistFormReset,
    BrutalistFieldsetRoot,
    BrutalistFieldsetLegend,
    BrutalistFieldLabel,
    BrutalistFieldControl,
    BrutalistFieldTextarea,
    BrutalistFieldError,
  },
};
</script>
`),
    'demo-brutalist-form-disabled': vue2Disabled('Brutalist'),
    'demo-brutalist-form-validation': vue2Validation('Brutalist'),
    'demo-brutalist-field-choices': vue2Choices('Brutalist'),

    'demo-bootstrap-2-3-2-form': vue2Hero('Bootstrap232'),
    'demo-bootstrap-2-3-2-form-profile': vue2Profile('Bootstrap232'),
    'demo-bootstrap-2-3-2-form-actions': formatCode(`
<template>
  <div class="w-full max-w-md">
    <Bootstrap232FormRoot ariaLabel="Deployment settings">
      <Bootstrap232FormField name="environment" :required="true">
        <Bootstrap232FieldLabel>Target environment</Bootstrap232FieldLabel>
        <Bootstrap232FieldControl defaultValue="production" />
      </Bootstrap232FormField>
      <div class="flex flex-wrap items-center gap-2 border-t border-border bg-muted/40 p-3">
        <Bootstrap232FormSubmit variant="primary">Save changes</Bootstrap232FormSubmit>
        <Bootstrap232FormSubmit variant="danger">Purge cache</Bootstrap232FormSubmit>
        <Bootstrap232FormReset variant="default">Cancel</Bootstrap232FormReset>
      </div>
    </Bootstrap232FormRoot>
  </div>
</template>

<script>
import {
  Bootstrap232FormRoot,
  Bootstrap232FormField,
  Bootstrap232FormSubmit,
  Bootstrap232FormReset,
  Bootstrap232FieldLabel,
  Bootstrap232FieldControl,
} from '../proto-ui/components/vue2';

export default {
  components: {
    Bootstrap232FormRoot,
    Bootstrap232FormField,
    Bootstrap232FormSubmit,
    Bootstrap232FormReset,
    Bootstrap232FieldLabel,
    Bootstrap232FieldControl,
  },
};
</script>
`),
    'demo-bootstrap-2-3-2-form-validation': vue2Validation('Bootstrap232'),

    'demo-liquid-glass-form': vue2Hero('LiquidGlass'),
    'demo-liquid-glass-form-profile': vue2Profile('LiquidGlass'),
    'demo-liquid-glass-form-material': formatCode(`
<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/25 via-indigo-500/20 to-fuchsia-500/25 p-6">
    <div class="mx-auto max-w-md rounded-2xl border border-border bg-background/85 p-5">
      <LiquidGlassFormRoot ariaLabel="Workspace settings">
        <LiquidGlassFormField name="workspace" :required="true">
          <LiquidGlassFieldLabel>Workspace name</LiquidGlassFieldLabel>
          <LiquidGlassFieldControl defaultValue="Design Systems" />
        </LiquidGlassFormField>
        <div class="flex flex-wrap items-center gap-2">
          <LiquidGlassFormSubmit variant="prominent" material="auto">Save workspace</LiquidGlassFormSubmit>
          <LiquidGlassFormReset variant="regular" material="auto">Reset</LiquidGlassFormReset>
          <LiquidGlassFormSubmit variant="destructive" material="opaque">Archive</LiquidGlassFormSubmit>
        </div>
      </LiquidGlassFormRoot>
    </div>
  </div>
</template>

<script>
import {
  LiquidGlassFormRoot,
  LiquidGlassFormField,
  LiquidGlassFormSubmit,
  LiquidGlassFormReset,
  LiquidGlassFieldLabel,
  LiquidGlassFieldControl,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassFormRoot,
    LiquidGlassFormField,
    LiquidGlassFormSubmit,
    LiquidGlassFormReset,
    LiquidGlassFieldLabel,
    LiquidGlassFieldControl,
  },
};
</script>
`),
    'demo-liquid-glass-form-validation': vue2Validation('LiquidGlass'),
  },
};
