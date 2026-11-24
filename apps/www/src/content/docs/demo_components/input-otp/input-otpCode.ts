import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';
import type { InputOtpDemoFamily } from './input-otp-demo.shared';

type ExampleKind =
  | 'hero'
  | 'separator'
  | 'alphanumeric'
  | 'disabled'
  | 'invalid'
  | 'controlled'
  | 'form';

const FAMILY_META: Record<
  InputOtpDemoFamily,
  { prefix: string; tagPrefix: string; isShadcn: boolean }
> = {
  shadcn: { prefix: 'Shadcn', tagPrefix: 'proto-ui-shadcn', isShadcn: true },
  brutalist: { prefix: 'Brutalist', tagPrefix: 'proto-ui-brutalist', isShadcn: false },
  'bootstrap-2-3-2': {
    prefix: 'Bootstrap232',
    tagPrefix: 'proto-ui-bootstrap-2-3-2',
    isShadcn: false,
  },
  'liquid-glass': {
    prefix: 'LiquidGlass',
    tagPrefix: 'proto-ui-liquid-glass',
    isShadcn: false,
  },
};

function demoIdFor(family: InputOtpDemoFamily, kind: ExampleKind): string {
  return kind === 'hero' ? `demo-${family}-input-otp` : `demo-${family}-input-otp-${kind}`;
}

function buildWc(family: InputOtpDemoFamily, kind: ExampleKind): string {
  const { tagPrefix, isShadcn } = FAMILY_META[family];
  const rootTag = `${tagPrefix}-input-otp-root`;
  const inputTag = `${tagPrefix}-input-otp-input`;
  const controlTag = `${tagPrefix}-input-otp-control`;
  const slotTag = `${tagPrefix}-input-otp-slot`;
  const sepTag = `${tagPrefix}-input-otp-separator`;
  const profileLine = isShadcn ? `  styleProfile: 'rhea',\n` : '';
  const profileInline = isShadcn ? ` styleProfile: 'rhea',` : '';

  if (kind === 'hero') {
    return formatCode(`
<${rootTag} id="otp-hero">
  <${inputTag}></${inputTag}>
  <div class="inline-flex items-center">
    <${slotTag}></${slotTag}>
    <${slotTag}></${slotTag}>
    <${slotTag}></${slotTag}>
    <${slotTag}></${slotTag}>
    <${slotTag}></${slotTag}>
    <${slotTag}></${slotTag}>
  </div>
</${rootTag}>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#otp-hero');
  setElementProps(root, {
${profileLine}    defaultValue: '123456',
    length: 6,
    ariaLabel: 'One-time verification code',
  });
  setElementProps(root.querySelector('${inputTag}'), {${profileInline} placeholder: '123456' });
  root.querySelectorAll('${slotTag}').forEach((slot, index) => {
    setElementProps(slot, {${profileInline} index });
  });
</script>
    `);
  }

  if (kind === 'separator') {
    return formatCode(`
<${rootTag} id="otp-separator">
  <${inputTag}></${inputTag}>
  <div class="inline-flex items-center">
    <${slotTag}></${slotTag}><${slotTag}></${slotTag}>
  </div>
  <${sepTag}>–</${sepTag}>
  <div class="inline-flex items-center">
    <${slotTag}></${slotTag}><${slotTag}></${slotTag}>
  </div>
  <${sepTag}>–</${sepTag}>
  <div class="inline-flex items-center">
    <${slotTag}></${slotTag}><${slotTag}></${slotTag}>
  </div>
</${rootTag}>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#otp-separator');
  setElementProps(root, {${profileInline} defaultValue: '429183', length: 6 });
  setElementProps(root.querySelector('${inputTag}'), {${profileInline} placeholder: '429183' });
  root.querySelectorAll('${slotTag}').forEach((slot, index) => {
    setElementProps(slot, {${profileInline} index${isShadcn ? ', first: index % 2 === 0, last: index % 2 === 1' : ''} });
  });
</script>
    `);
  }

  if (kind === 'alphanumeric') {
    return formatCode(`
<${rootTag} id="otp-alphanumeric">
  <${inputTag}></${inputTag}>
  <div class="inline-flex items-center">
    <${slotTag}></${slotTag}><${slotTag}></${slotTag}><${slotTag}></${slotTag}>
  </div>
  <${sepTag}>–</${sepTag}>
  <div class="inline-flex items-center">
    <${slotTag}></${slotTag}><${slotTag}></${slotTag}><${slotTag}></${slotTag}>
  </div>
</${rootTag}>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#otp-alphanumeric');
  setElementProps(root, {${profileInline} length: 6, pattern: 'alphanumeric' });
  setElementProps(root.querySelector('${inputTag}'), {${profileInline} placeholder: 'A1B2C3' });
  root.querySelectorAll('${slotTag}').forEach((slot, index) => {
    setElementProps(slot, {${profileInline} index${isShadcn ? ', first: index === 0 || index === 3, last: index === 2 || index === 5' : ''} });
  });
</script>
    `);
  }

  if (kind === 'disabled') {
    return formatCode(`
<${rootTag} id="otp-disabled">
  <${inputTag}></${inputTag}>
  <div class="inline-flex items-center">
    <${slotTag}></${slotTag}><${slotTag}></${slotTag}><${slotTag}></${slotTag}>
  </div>
  <${sepTag}>–</${sepTag}>
  <div class="inline-flex items-center">
    <${slotTag}></${slotTag}><${slotTag}></${slotTag}><${slotTag}></${slotTag}>
  </div>
</${rootTag}>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#otp-disabled');
  setElementProps(root, {${profileInline} defaultValue: '123456', length: 6, disabled: true });
  root.querySelectorAll('${slotTag}').forEach((slot, index) => {
    setElementProps(slot, {${profileInline} index${isShadcn ? ', first: index === 0 || index === 3, last: index === 2 || index === 5' : ''} });
  });
</script>
    `);
  }

  if (kind === 'invalid') {
    return formatCode(`
<${rootTag} id="otp-invalid">
  <${inputTag}></${inputTag}>
  <div class="inline-flex items-center">
    <${slotTag}></${slotTag}><${slotTag}></${slotTag}>
  </div>
  <${sepTag}>–</${sepTag}>
  <div class="inline-flex items-center">
    <${slotTag}></${slotTag}><${slotTag}></${slotTag}>
  </div>
  <${sepTag}>–</${sepTag}>
  <div class="inline-flex items-center">
    <${slotTag}></${slotTag}><${slotTag}></${slotTag}>
  </div>
</${rootTag}>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#otp-invalid');
  setElementProps(root, {${profileInline} defaultValue: '000000', length: 6, invalid: true });
  root.querySelectorAll('${slotTag}').forEach((slot, index) => {
    setElementProps(slot, {${profileInline} index, invalid: true${isShadcn ? ', first: index % 2 === 0, last: index % 2 === 1' : ''} });
  });
</script>
    `);
  }

  if (kind === 'controlled') {
    return formatCode(`
<div class="grid gap-3">
  <${rootTag} id="otp-controlled">
    <${inputTag}></${inputTag}>
    <div class="inline-flex items-center">
      <${slotTag}></${slotTag}><${slotTag}></${slotTag}><${slotTag}></${slotTag}>
      <${slotTag}></${slotTag}><${slotTag}></${slotTag}><${slotTag}></${slotTag}>
    </div>
  </${rootTag}>
  <div id="otp-status" aria-live="polite">Enter your one-time password.</div>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#otp-controlled');
  const status = document.querySelector('#otp-status');
  setElementProps(root, {${profileInline} value: '', length: 6 });
  root.querySelectorAll('${slotTag}').forEach((slot, index) => {
    setElementProps(slot, {${profileInline} index });
  });
  root.addEventListener('valueChange', (event) => {
    const next = event.detail.value;
    setElementProps(root, {${profileInline} value: next, length: 6 });
    status.textContent = next ? 'You entered: ' + next : 'Enter your one-time password.';
  });
</script>
    `);
  }

  return formatCode(`
<${tagPrefix}-field-root id="otp-field">
  <${tagPrefix}-field-label>4-digit PIN</${tagPrefix}-field-label>
  <${rootTag} id="otp-form">
    <${controlTag}></${controlTag}>
    <div class="inline-flex items-center">
      <${slotTag}></${slotTag}><${slotTag}></${slotTag}><${slotTag}></${slotTag}><${slotTag}></${slotTag}>
    </div>
  </${rootTag}>
  <${tagPrefix}-field-description>Enter the 4-digit code sent to your device.</${tagPrefix}-field-description>
  <${tagPrefix}-field-error></${tagPrefix}-field-error>
</${tagPrefix}-field-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const field = document.querySelector('#otp-field');
  const root = document.querySelector('#otp-form');
  setElementProps(field, {${profileInline} required: true, validationMode: 'manual' });
  setElementProps(root, {${profileInline} length: 4, name: 'pin' });
  setElementProps(root.querySelector('${controlTag}'), {${profileInline} placeholder: '0000' });
  root.querySelectorAll('${slotTag}').forEach((slot, index) => {
    setElementProps(slot, {${profileInline} index });
  });
</script>
  `);
}

function buildReact(family: InputOtpDemoFamily, kind: ExampleKind): string {
  const { prefix, isShadcn } = FAMILY_META[family];
  const sp = isShadcn ? ' styleProfile="rhea"' : '';
  const Root = `${prefix}InputOtpRoot`;
  const Input = `${prefix}InputOtpInput`;
  const Control = `${prefix}InputOtpControl`;
  const Slot = `${prefix}InputOtpSlot`;
  const Sep = `${prefix}InputOtpSeparator`;
  const FieldRoot = `${prefix}FieldRoot`;
  const FieldLabel = `${prefix}FieldLabel`;
  const FieldDesc = `${prefix}FieldDescription`;
  const FieldError = `${prefix}FieldError`;
  const Btn = `${prefix}Button`;

  if (kind === 'hero') {
    return formatCode(`
import { ${Root}, ${Input}, ${Slot} } from '../proto-ui/components/react';

export function InputOtpHeroDemo() {
  return (
    <${Root}${sp} defaultValue="123456" length={6} ariaLabel="One-time verification code">
      <${Input}${sp} placeholder="123456" />
      <div className="inline-flex items-center">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <${Slot}${sp} key={index} index={index} />
        ))}
      </div>
    </${Root}>
  );
}
    `);
  }

  if (kind === 'separator') {
    return formatCode(`
import { ${Root}, ${Input}, ${Slot}, ${Sep} } from '../proto-ui/components/react';

export function InputOtpSeparatorDemo() {
  return (
    <${Root}${sp} defaultValue="429183" length={6}>
      <${Input}${sp} placeholder="429183" />
      <div className="inline-flex items-center">
        <${Slot}${sp} index={0}${isShadcn ? ' first' : ''} />
        <${Slot}${sp} index={1}${isShadcn ? ' last' : ''} />
      </div>
      <${Sep}${sp}>–</${Sep}>
      <div className="inline-flex items-center">
        <${Slot}${sp} index={2}${isShadcn ? ' first' : ''} />
        <${Slot}${sp} index={3}${isShadcn ? ' last' : ''} />
      </div>
      <${Sep}${sp}>–</${Sep}>
      <div className="inline-flex items-center">
        <${Slot}${sp} index={4}${isShadcn ? ' first' : ''} />
        <${Slot}${sp} index={5}${isShadcn ? ' last' : ''} />
      </div>
    </${Root}>
  );
}
    `);
  }

  if (kind === 'alphanumeric') {
    return formatCode(`
import { ${Root}, ${Input}, ${Slot}, ${Sep} } from '../proto-ui/components/react';

export function InputOtpAlphanumericDemo() {
  return (
    <${Root}${sp} length={6} pattern="alphanumeric">
      <${Input}${sp} placeholder="A1B2C3" />
      <div className="inline-flex items-center">
        <${Slot}${sp} index={0}${isShadcn ? ' first' : ''} />
        <${Slot}${sp} index={1} />
        <${Slot}${sp} index={2}${isShadcn ? ' last' : ''} />
      </div>
      <${Sep}${sp}>–</${Sep}>
      <div className="inline-flex items-center">
        <${Slot}${sp} index={3}${isShadcn ? ' first' : ''} />
        <${Slot}${sp} index={4} />
        <${Slot}${sp} index={5}${isShadcn ? ' last' : ''} />
      </div>
    </${Root}>
  );
}
    `);
  }

  if (kind === 'disabled') {
    return formatCode(`
import { ${Root}, ${Input}, ${Slot}, ${Sep} } from '../proto-ui/components/react';

export function InputOtpDisabledDemo() {
  return (
    <${Root}${sp} defaultValue="123456" length={6} disabled>
      <${Input}${sp} placeholder="123456" />
      <div className="inline-flex items-center">
        <${Slot}${sp} index={0}${isShadcn ? ' first' : ''} />
        <${Slot}${sp} index={1} />
        <${Slot}${sp} index={2}${isShadcn ? ' last' : ''} />
      </div>
      <${Sep}${sp}>–</${Sep}>
      <div className="inline-flex items-center">
        <${Slot}${sp} index={3}${isShadcn ? ' first' : ''} />
        <${Slot}${sp} index={4} />
        <${Slot}${sp} index={5}${isShadcn ? ' last' : ''} />
      </div>
    </${Root}>
  );
}
    `);
  }

  if (kind === 'invalid') {
    return formatCode(`
import { ${Root}, ${Input}, ${Slot}, ${Sep} } from '../proto-ui/components/react';

export function InputOtpInvalidDemo() {
  return (
    <${Root}${sp} defaultValue="000000" length={6} invalid>
      <${Input}${sp} placeholder="000000" />
      <div className="inline-flex items-center">
        <${Slot}${sp} index={0} invalid${isShadcn ? ' first' : ''} />
        <${Slot}${sp} index={1} invalid${isShadcn ? ' last' : ''} />
      </div>
      <${Sep}${sp}>–</${Sep}>
      <div className="inline-flex items-center">
        <${Slot}${sp} index={2} invalid${isShadcn ? ' first' : ''} />
        <${Slot}${sp} index={3} invalid${isShadcn ? ' last' : ''} />
      </div>
      <${Sep}${sp}>–</${Sep}>
      <div className="inline-flex items-center">
        <${Slot}${sp} index={4} invalid${isShadcn ? ' first' : ''} />
        <${Slot}${sp} index={5} invalid${isShadcn ? ' last' : ''} />
      </div>
    </${Root}>
  );
}
    `);
  }

  if (kind === 'controlled') {
    return formatCode(`
import { useState } from 'react';
import { ${Root}, ${Input}, ${Slot} } from '../proto-ui/components/react';

export function InputOtpControlledDemo() {
  const [value, setValue] = useState('');
  return (
    <div className="grid gap-3">
      <${Root}${sp} value={value} length={6} onValueChange={({ value: next }) => setValue(next)}>
        <${Input}${sp} placeholder="000000" />
        <div className="inline-flex items-center">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <${Slot}${sp} key={index} index={index} />
          ))}
        </div>
      </${Root}>
      <div aria-live="polite">
        {value === '' ? 'Enter your one-time password.' : \`You entered: \${value}\`}
      </div>
    </div>
  );
}
    `);
  }

  return formatCode(`
import { useState } from 'react';
import {
  ${Btn},
  ${FieldDesc},
  ${FieldError},
  ${FieldLabel},
  ${FieldRoot},
  ${Root},
  ${Control},
  ${Slot},
} from '../proto-ui/components/react';

export function InputOtpFormDemo() {
  const [code, setCode] = useState('');
  const [invalid, setInvalid] = useState(false);

  return (
    <div className="grid gap-3">
      <${FieldRoot}${sp} required invalid={invalid} errors={invalid ? ['Please enter all 4 digits.'] : []}>
        <${FieldLabel}${sp}>4-digit PIN</${FieldLabel}>
        <${Root}${sp} value={code} length={4} name="pin" invalid={invalid} onValueChange={({ value }) => { setCode(value); if (value.length === 4) setInvalid(false); }}>
          <${Control}${sp} placeholder="0000" />
          <div className="inline-flex items-center">
            {[0, 1, 2, 3].map((index) => (
              <${Slot}${sp} key={index} index={index} />
            ))}
          </div>
        </${Root}>
        <${FieldDesc}${sp}>Enter the 4-digit code sent to your device.</${FieldDesc}>
        <${FieldError}${sp} />
      </${FieldRoot}>
      <${Btn}${sp} onClick={() => setInvalid(code.length < 4)}>Verify</${Btn}>
    </div>
  );
}
  `);
}

function buildVue(family: InputOtpDemoFamily, kind: ExampleKind): string {
  const { prefix, isShadcn } = FAMILY_META[family];
  const sp = isShadcn ? ' styleProfile="rhea"' : '';
  const Root = `${prefix}InputOtpRoot`;
  const Input = `${prefix}InputOtpInput`;
  const Control = `${prefix}InputOtpControl`;
  const Slot = `${prefix}InputOtpSlot`;
  const Sep = `${prefix}InputOtpSeparator`;
  const FieldRoot = `${prefix}FieldRoot`;
  const FieldLabel = `${prefix}FieldLabel`;
  const FieldDesc = `${prefix}FieldDescription`;
  const FieldError = `${prefix}FieldError`;
  const Btn = `${prefix}Button`;

  if (kind === 'hero') {
    return formatCode(`
<script setup lang="ts">
import { ${Root}, ${Input}, ${Slot} } from '../proto-ui/components/vue';
</script>

<template>
  <${Root}${sp} defaultValue="123456" :length="6" ariaLabel="One-time verification code">
    <${Input}${sp} placeholder="123456" />
    <div class="inline-flex items-center">
      <${Slot}${sp} v-for="index in 6" :key="index - 1" :index="index - 1" />
    </div>
  </${Root}>
</template>
    `);
  }

  if (kind === 'separator') {
    return formatCode(`
<script setup lang="ts">
import { ${Root}, ${Input}, ${Slot}, ${Sep} } from '../proto-ui/components/vue';
</script>

<template>
  <${Root}${sp} defaultValue="429183" :length="6">
    <${Input}${sp} placeholder="429183" />
    <div class="inline-flex items-center">
      <${Slot}${sp} :index="0"${isShadcn ? ' :first="true"' : ''} />
      <${Slot}${sp} :index="1"${isShadcn ? ' :last="true"' : ''} />
    </div>
    <${Sep}${sp}>–</${Sep}>
    <div class="inline-flex items-center">
      <${Slot}${sp} :index="2"${isShadcn ? ' :first="true"' : ''} />
      <${Slot}${sp} :index="3"${isShadcn ? ' :last="true"' : ''} />
    </div>
    <${Sep}${sp}>–</${Sep}>
    <div class="inline-flex items-center">
      <${Slot}${sp} :index="4"${isShadcn ? ' :first="true"' : ''} />
      <${Slot}${sp} :index="5"${isShadcn ? ' :last="true"' : ''} />
    </div>
  </${Root}>
</template>
    `);
  }

  if (kind === 'alphanumeric') {
    return formatCode(`
<script setup lang="ts">
import { ${Root}, ${Input}, ${Slot}, ${Sep} } from '../proto-ui/components/vue';
</script>

<template>
  <${Root}${sp} :length="6" pattern="alphanumeric">
    <${Input}${sp} placeholder="A1B2C3" />
    <div class="inline-flex items-center">
      <${Slot}${sp} :index="0"${isShadcn ? ' :first="true"' : ''} />
      <${Slot}${sp} :index="1" />
      <${Slot}${sp} :index="2"${isShadcn ? ' :last="true"' : ''} />
    </div>
    <${Sep}${sp}>–</${Sep}>
    <div class="inline-flex items-center">
      <${Slot}${sp} :index="3"${isShadcn ? ' :first="true"' : ''} />
      <${Slot}${sp} :index="4" />
      <${Slot}${sp} :index="5"${isShadcn ? ' :last="true"' : ''} />
    </div>
  </${Root}>
</template>
    `);
  }

  if (kind === 'disabled') {
    return formatCode(`
<script setup lang="ts">
import { ${Root}, ${Input}, ${Slot}, ${Sep} } from '../proto-ui/components/vue';
</script>

<template>
  <${Root}${sp} defaultValue="123456" :length="6" :disabled="true">
    <${Input}${sp} placeholder="123456" />
    <div class="inline-flex items-center">
      <${Slot}${sp} :index="0"${isShadcn ? ' :first="true"' : ''} />
      <${Slot}${sp} :index="1" />
      <${Slot}${sp} :index="2"${isShadcn ? ' :last="true"' : ''} />
    </div>
    <${Sep}${sp}>–</${Sep}>
    <div class="inline-flex items-center">
      <${Slot}${sp} :index="3"${isShadcn ? ' :first="true"' : ''} />
      <${Slot}${sp} :index="4" />
      <${Slot}${sp} :index="5"${isShadcn ? ' :last="true"' : ''} />
    </div>
  </${Root}>
</template>
    `);
  }

  if (kind === 'invalid') {
    return formatCode(`
<script setup lang="ts">
import { ${Root}, ${Input}, ${Slot}, ${Sep} } from '../proto-ui/components/vue';
</script>

<template>
  <${Root}${sp} defaultValue="000000" :length="6" :invalid="true">
    <${Input}${sp} placeholder="000000" />
    <div class="inline-flex items-center">
      <${Slot}${sp} :index="0" :invalid="true"${isShadcn ? ' :first="true"' : ''} />
      <${Slot}${sp} :index="1" :invalid="true"${isShadcn ? ' :last="true"' : ''} />
    </div>
    <${Sep}${sp}>–</${Sep}>
    <div class="inline-flex items-center">
      <${Slot}${sp} :index="2" :invalid="true"${isShadcn ? ' :first="true"' : ''} />
      <${Slot}${sp} :index="3" :invalid="true"${isShadcn ? ' :last="true"' : ''} />
    </div>
    <${Sep}${sp}>–</${Sep}>
    <div class="inline-flex items-center">
      <${Slot}${sp} :index="4" :invalid="true"${isShadcn ? ' :first="true"' : ''} />
      <${Slot}${sp} :index="5" :invalid="true"${isShadcn ? ' :last="true"' : ''} />
    </div>
  </${Root}>
</template>
    `);
  }

  if (kind === 'controlled') {
    return formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import { ${Root}, ${Input}, ${Slot} } from '../proto-ui/components/vue';
const code = ref('');
</script>

<template>
  <div class="grid gap-3">
    <${Root}${sp} :value="code" :length="6" @valueChange="code = $event.value">
      <${Input}${sp} placeholder="000000" />
      <div class="inline-flex items-center">
        <${Slot}${sp} v-for="index in 6" :key="index - 1" :index="index - 1" />
      </div>
    </${Root}>
    <div aria-live="polite">
      {{ code ? 'You entered: ' + code : 'Enter your one-time password.' }}
    </div>
  </div>
</template>
    `);
  }

  return formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import { ${Btn}, ${FieldDesc}, ${FieldError}, ${FieldLabel}, ${FieldRoot}, ${Root}, ${Control}, ${Slot} } from '../proto-ui/components/vue';
const code = ref('');
const invalid = ref(false);
</script>

<template>
  <div class="grid gap-3">
    <${FieldRoot}${sp} :required="true" :invalid="invalid" :errors="invalid ? ['Please enter all 4 digits.'] : []">
      <${FieldLabel}${sp}>4-digit PIN</${FieldLabel}>
      <${Root}${sp} :value="code" :length="4" name="pin" :invalid="invalid" @valueChange="code = $event.value; if (code.length === 4) invalid = false">
        <${Control}${sp} placeholder="0000" />
        <div class="inline-flex items-center">
          <${Slot}${sp} v-for="index in 4" :key="index - 1" :index="index - 1" />
        </div>
      </${Root}>
      <${FieldDesc}${sp}>Enter the 4-digit code sent to your device.</${FieldDesc}>
      <${FieldError}${sp} />
    </${FieldRoot}>
    <${Btn}${sp} @click="invalid = code.length < 4">Verify</${Btn}>
  </div>
</template>
  `);
}

function buildVue2(family: InputOtpDemoFamily, kind: ExampleKind): string {
  const { prefix, isShadcn } = FAMILY_META[family];
  const sp = isShadcn ? ' styleProfile="rhea"' : '';
  const Root = `${prefix}InputOtpRoot`;
  const Input = `${prefix}InputOtpInput`;
  const Control = `${prefix}InputOtpControl`;
  const Slot = `${prefix}InputOtpSlot`;
  const Sep = `${prefix}InputOtpSeparator`;
  const FieldRoot = `${prefix}FieldRoot`;
  const FieldLabel = `${prefix}FieldLabel`;
  const FieldDesc = `${prefix}FieldDescription`;
  const FieldError = `${prefix}FieldError`;
  const Btn = `${prefix}Button`;

  if (kind === 'hero') {
    return formatCode(`
<template>
  <${Root}${sp} defaultValue="123456" :length="6" ariaLabel="One-time verification code">
    <${Input}${sp} placeholder="123456" />
    <div class="inline-flex items-center">
      <${Slot}${sp} v-for="index in 6" :key="index - 1" :index="index - 1" />
    </div>
  </${Root}>
</template>

<script>
import { ${Root}, ${Input}, ${Slot} } from '../proto-ui/components/vue2';

export default {
  components: { ${Root}, ${Input}, ${Slot} },
};
</script>
    `);
  }

  if (kind === 'separator') {
    return formatCode(`
<template>
  <${Root}${sp} defaultValue="429183" :length="6">
    <${Input}${sp} placeholder="429183" />
    <div class="inline-flex items-center">
      <${Slot}${sp} :index="0"${isShadcn ? ' :first="true"' : ''} />
      <${Slot}${sp} :index="1"${isShadcn ? ' :last="true"' : ''} />
    </div>
    <${Sep}${sp}>–</${Sep}>
    <div class="inline-flex items-center">
      <${Slot}${sp} :index="2"${isShadcn ? ' :first="true"' : ''} />
      <${Slot}${sp} :index="3"${isShadcn ? ' :last="true"' : ''} />
    </div>
    <${Sep}${sp}>–</${Sep}>
    <div class="inline-flex items-center">
      <${Slot}${sp} :index="4"${isShadcn ? ' :first="true"' : ''} />
      <${Slot}${sp} :index="5"${isShadcn ? ' :last="true"' : ''} />
    </div>
  </${Root}>
</template>

<script>
import { ${Root}, ${Input}, ${Slot}, ${Sep} } from '../proto-ui/components/vue2';

export default {
  components: { ${Root}, ${Input}, ${Slot}, ${Sep} },
};
</script>
    `);
  }

  if (kind === 'alphanumeric') {
    return formatCode(`
<template>
  <${Root}${sp} :length="6" pattern="alphanumeric">
    <${Input}${sp} placeholder="A1B2C3" />
    <div class="inline-flex items-center">
      <${Slot}${sp} :index="0"${isShadcn ? ' :first="true"' : ''} />
      <${Slot}${sp} :index="1" />
      <${Slot}${sp} :index="2"${isShadcn ? ' :last="true"' : ''} />
    </div>
    <${Sep}${sp}>–</${Sep}>
    <div class="inline-flex items-center">
      <${Slot}${sp} :index="3"${isShadcn ? ' :first="true"' : ''} />
      <${Slot}${sp} :index="4" />
      <${Slot}${sp} :index="5"${isShadcn ? ' :last="true"' : ''} />
    </div>
  </${Root}>
</template>

<script>
import { ${Root}, ${Input}, ${Slot}, ${Sep} } from '../proto-ui/components/vue2';

export default {
  components: { ${Root}, ${Input}, ${Slot}, ${Sep} },
};
</script>
    `);
  }

  if (kind === 'disabled') {
    return formatCode(`
<template>
  <${Root}${sp} defaultValue="123456" :length="6" :disabled="true">
    <${Input}${sp} placeholder="123456" />
    <div class="inline-flex items-center">
      <${Slot}${sp} :index="0"${isShadcn ? ' :first="true"' : ''} />
      <${Slot}${sp} :index="1" />
      <${Slot}${sp} :index="2"${isShadcn ? ' :last="true"' : ''} />
    </div>
    <${Sep}${sp}>–</${Sep}>
    <div class="inline-flex items-center">
      <${Slot}${sp} :index="3"${isShadcn ? ' :first="true"' : ''} />
      <${Slot}${sp} :index="4" />
      <${Slot}${sp} :index="5"${isShadcn ? ' :last="true"' : ''} />
    </div>
  </${Root}>
</template>

<script>
import { ${Root}, ${Input}, ${Slot}, ${Sep} } from '../proto-ui/components/vue2';

export default {
  components: { ${Root}, ${Input}, ${Slot}, ${Sep} },
};
</script>
    `);
  }

  if (kind === 'invalid') {
    return formatCode(`
<template>
  <${Root}${sp} defaultValue="000000" :length="6" :invalid="true">
    <${Input}${sp} placeholder="000000" />
    <div class="inline-flex items-center">
      <${Slot}${sp} :index="0" :invalid="true"${isShadcn ? ' :first="true"' : ''} />
      <${Slot}${sp} :index="1" :invalid="true"${isShadcn ? ' :last="true"' : ''} />
    </div>
    <${Sep}${sp}>–</${Sep}>
    <div class="inline-flex items-center">
      <${Slot}${sp} :index="2" :invalid="true"${isShadcn ? ' :first="true"' : ''} />
      <${Slot}${sp} :index="3" :invalid="true"${isShadcn ? ' :last="true"' : ''} />
    </div>
    <${Sep}${sp}>–</${Sep}>
    <div class="inline-flex items-center">
      <${Slot}${sp} :index="4" :invalid="true"${isShadcn ? ' :first="true"' : ''} />
      <${Slot}${sp} :index="5" :invalid="true"${isShadcn ? ' :last="true"' : ''} />
    </div>
  </${Root}>
</template>

<script>
import { ${Root}, ${Input}, ${Slot}, ${Sep} } from '../proto-ui/components/vue2';

export default {
  components: { ${Root}, ${Input}, ${Slot}, ${Sep} },
};
</script>
    `);
  }

  if (kind === 'controlled') {
    return formatCode(`
<template>
  <div class="grid gap-3">
    <${Root}${sp} :value="code" :length="6" @valueChange="code = $event.value">
      <${Input}${sp} placeholder="000000" />
      <div class="inline-flex items-center">
        <${Slot}${sp} v-for="index in 6" :key="index - 1" :index="index - 1" />
      </div>
    </${Root}>
    <div aria-live="polite">
      {{ code ? 'You entered: ' + code : 'Enter your one-time password.' }}
    </div>
  </div>
</template>

<script>
import { ${Root}, ${Input}, ${Slot} } from '../proto-ui/components/vue2';

export default {
  components: { ${Root}, ${Input}, ${Slot} },
  data() {
    return { code: '' };
  },
};
</script>
    `);
  }

  return formatCode(`
<template>
  <div class="grid gap-3">
    <${FieldRoot}${sp} :required="true" :invalid="invalid" :errors="invalid ? ['Please enter all 4 digits.'] : []">
      <${FieldLabel}${sp}>4-digit PIN</${FieldLabel}>
      <${Root}${sp} :value="code" :length="4" name="pin" :invalid="invalid" @valueChange="onCodeChange">
        <${Control}${sp} placeholder="0000" />
        <div class="inline-flex items-center">
          <${Slot}${sp} v-for="index in 4" :key="index - 1" :index="index - 1" />
        </div>
      </${Root}>
      <${FieldDesc}${sp}>Enter the 4-digit code sent to your device.</${FieldDesc}>
      <${FieldError}${sp} />
    </${FieldRoot}>
    <${Btn}${sp} @click="invalid = code.length < 4">Verify</${Btn}>
  </div>
</template>

<script>
import { ${Btn}, ${FieldDesc}, ${FieldError}, ${FieldLabel}, ${FieldRoot}, ${Root}, ${Control}, ${Slot} } from '../proto-ui/components/vue2';

export default {
  components: { ${Btn}, ${FieldDesc}, ${FieldError}, ${FieldLabel}, ${FieldRoot}, ${Root}, ${Control}, ${Slot} },
  data() {
    return { code: '', invalid: false };
  },
  methods: {
    onCodeChange(event) {
      this.code = event.value;
      if (this.code.length === 4) this.invalid = false;
    },
  },
};
</script>
  `);
}

const FAMILIES: readonly InputOtpDemoFamily[] = [
  'shadcn',
  'brutalist',
  'bootstrap-2-3-2',
  'liquid-glass',
];
const KINDS: readonly ExampleKind[] = [
  'hero',
  'separator',
  'alphanumeric',
  'disabled',
  'invalid',
  'controlled',
  'form',
];

function buildRuntimeMap(builder: (family: InputOtpDemoFamily, kind: ExampleKind) => string) {
  const entries: Record<string, string> = {};
  for (const family of FAMILIES) {
    for (const kind of KINDS) {
      entries[demoIdFor(family, kind)] = builder(family, kind);
    }
  }
  return entries;
}

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: buildRuntimeMap(buildWc),
  react: buildRuntimeMap(buildReact),
  vue: buildRuntimeMap(buildVue),
  vue2: buildRuntimeMap(buildVue2),
};
