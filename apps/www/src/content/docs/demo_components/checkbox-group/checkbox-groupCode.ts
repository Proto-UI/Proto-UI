import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

type FamilyMeta = Readonly<{
  slug: 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass';
  pascal: string;
  rhea: boolean;
}>;

const FAMILIES: readonly FamilyMeta[] = [
  { slug: 'shadcn', pascal: 'Shadcn', rhea: true },
  { slug: 'brutalist', pascal: 'Brutalist', rhea: false },
  { slug: 'bootstrap-2-3-2', pascal: 'Bootstrap232', rhea: false },
  { slug: 'liquid-glass', pascal: 'LiquidGlass', rhea: false },
];

function buildFamilyCode(family: FamilyMeta): Record<RuntimeId, Record<string, string>> {
  const { slug, pascal, rhea } = family;
  const tag = (part: string) => `proto-ui-${slug}-${part}`;
  const comp = (part: string) => `${pascal}${part}`;
  const rheaAttr = rhea ? ' styleProfile="rhea"' : '';
  const rheaProp = rhea ? "styleProfile: 'rhea', " : '';

  const rootTag = tag('checkbox-group-root');
  const allTag = tag('checkbox-group-all');
  const itemTag = tag('checkbox-group-item');
  const formRootTag = tag('form-root');
  const formFieldTag = tag('form-field');
  const fieldLabelTag = tag('field-label');
  const fieldErrorTag = tag('field-error');
  const formSubmitTag = tag('form-submit');
  const formResetTag = tag('form-reset');

  const Root = comp('CheckboxGroupRoot');
  const All = comp('CheckboxGroupAll');
  const Item = comp('CheckboxGroupItem');
  const FormRoot = comp('FormRoot');
  const FormField = comp('FormField');
  const FieldLabel = comp('FieldLabel');
  const FieldError = comp('FieldError');
  const FormSubmit = comp('FormSubmit');
  const FormReset = comp('FormReset');

  const id = (suffix = '') => `demo-${slug}-checkbox-group${suffix}`;

  return {
    wc: {
      [id()]: formatCode(`
<${rootTag} id="${slug}-cg-hero">
  <${allTag}>All notifications</${allTag}>
  <${itemTag}>Email updates</${itemTag}>
  <${itemTag}>SMS alerts</${itemTag}>
  <${itemTag}>Push notifications (unavailable)</${itemTag}>
</${rootTag}>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#${slug}-cg-hero');
  setElementProps(root, { ${rheaProp}defaultValue: ['email'], ariaLabel: 'Notification channels' });
  const items = root.querySelectorAll('${itemTag}');
  setElementProps(items[0], { value: 'email' });
  setElementProps(items[1], { value: 'sms' });
  setElementProps(items[2], { value: 'push', disabled: true });
</script>
      `),
      [id('-basic')]: formatCode(`
<${rootTag} id="${slug}-cg-basic">
  <${itemTag}>Recents</${itemTag}>
  <${itemTag}>Home</${itemTag}>
  <${itemTag}>Applications</${itemTag}>
  <${itemTag}>Desktop</${itemTag}>
</${rootTag}>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#${slug}-cg-basic');
  setElementProps(root, { ${rheaProp}defaultValue: ['recents', 'home'], ariaLabel: 'Sidebar items' });
  const values = ['recents', 'home', 'applications', 'desktop'];
  root.querySelectorAll('${itemTag}').forEach((item, index) => {
    setElementProps(item, { value: values[index] });
  });
</script>
      `),
      [id('-horizontal')]: formatCode(`
<${rootTag} id="${slug}-cg-horizontal">
  <${itemTag}>Email</${itemTag}>
  <${itemTag}>SMS</${itemTag}>
  <${itemTag}>In-app</${itemTag}>
  <${itemTag}>Weekly digest</${itemTag}>
</${rootTag}>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#${slug}-cg-horizontal');
  setElementProps(root, {
    ${rheaProp}defaultValue: ['email', 'in-app'],
    orientation: 'horizontal',
    ariaLabel: 'Delivery channels',
  });
  const values = ['email', 'sms', 'in-app', 'digest'];
  root.querySelectorAll('${itemTag}').forEach((item, index) => {
    setElementProps(item, { value: values[index] });
  });
</script>
      `),
      [id('-disabled')]: formatCode(`
<div class="grid gap-4">
  <${rootTag} id="${slug}-cg-disabled">
    <${itemTag}>Email</${itemTag}>
    <${itemTag}>SMS</${itemTag}>
  </${rootTag}>
  <${rootTag} id="${slug}-cg-readonly">
    <${itemTag}>Email</${itemTag}>
    <${itemTag}>SMS</${itemTag}>
  </${rootTag}>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const disabledRoot = document.querySelector('#${slug}-cg-disabled');
  setElementProps(disabledRoot, { ${rheaProp}defaultValue: ['email'], disabled: true, ariaLabel: 'Disabled channels' });
  const readOnlyRoot = document.querySelector('#${slug}-cg-readonly');
  setElementProps(readOnlyRoot, { ${rheaProp}defaultValue: ['email'], readOnly: true, ariaLabel: 'Read-only channels' });
  for (const group of [disabledRoot, readOnlyRoot]) {
    const items = group.querySelectorAll('${itemTag}');
    setElementProps(items[0], { value: 'email' });
    setElementProps(items[1], { value: 'sms' });
  }
</script>
      `),
      [id('-controlled')]: formatCode(`
<div class="grid gap-3">
  <${rootTag} id="${slug}-cg-controlled">
    <${allTag}>All channels</${allTag}>
    <${itemTag}>Email</${itemTag}>
    <${itemTag}>SMS</${itemTag}>
    <${itemTag}>Webhook</${itemTag}>
  </${rootTag}>
  <div id="${slug}-cg-status" role="status" aria-live="polite">Selected: email</div>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#${slug}-cg-controlled');
  const status = document.querySelector('#${slug}-cg-status');
  const values = ['email', 'sms', 'webhook'];
  root.querySelectorAll('${itemTag}').forEach((item, index) => {
    setElementProps(item, { value: values[index] });
  });
  let selected = ['email'];
  const sync = () => {
    setElementProps(root, { ${rheaProp}value: selected, ariaLabel: 'Release channels' });
    status.textContent = selected.length ? 'Selected: ' + selected.join(', ') : 'Selected: none';
  };
  root.addEventListener('valueChange', (event) => {
    selected = [...event.detail.value];
    sync();
  });
  sync();
</script>
      `),
      [id('-form')]: formatCode(`
<${formRootTag} id="${slug}-cg-form">
  <${formFieldTag} id="${slug}-cg-field">
    <${fieldLabelTag}>Notification channels</${fieldLabelTag}>
    <${rootTag} id="${slug}-cg-form-group">
      <${itemTag}>Email</${itemTag}>
      <${itemTag}>SMS</${itemTag}>
      <${itemTag}>In-app</${itemTag}>
    </${rootTag}>
    <${fieldErrorTag}></${fieldErrorTag}>
  </${formFieldTag}>
  <div class="flex gap-2">
    <${formSubmitTag}>Save preferences</${formSubmitTag}>
    <${formResetTag}>Reset</${formResetTag}>
  </div>
</${formRootTag}>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const form = document.querySelector('#${slug}-cg-form');
  const field = document.querySelector('#${slug}-cg-field');
  const group = document.querySelector('#${slug}-cg-form-group');
  setElementProps(form, { ${rheaProp}ariaLabel: 'Notification preferences' });
  setElementProps(field, { name: 'channels', required: true });
  setElementProps(group, { ${rheaProp}defaultValue: ['email'] });
  const values = ['email', 'sms', 'in-app'];
  group.querySelectorAll('${itemTag}').forEach((item, index) => {
    setElementProps(item, { value: values[index] });
  });
</script>
      `),
    },
    react: {
      [id()]: formatCode(`
import { ${Root}, ${All}, ${Item} } from '../proto-ui/components/react';

export function CheckboxGroupDemo() {
  return (
    <${Root}${rheaAttr} defaultValue={['email']} ariaLabel="Notification channels">
      <${All}>All notifications</${All}>
      <${Item} value="email">Email updates</${Item}>
      <${Item} value="sms">SMS alerts</${Item}>
      <${Item} value="push" disabled>Push notifications (unavailable)</${Item}>
    </${Root}>
  );
}
      `),
      [id('-basic')]: formatCode(`
import { ${Root}, ${Item} } from '../proto-ui/components/react';

export function CheckboxGroupBasicDemo() {
  return (
    <${Root}${rheaAttr} defaultValue={['recents', 'home']} ariaLabel="Sidebar items">
      <${Item} value="recents">Recents</${Item}>
      <${Item} value="home">Home</${Item}>
      <${Item} value="applications">Applications</${Item}>
      <${Item} value="desktop">Desktop</${Item}>
    </${Root}>
  );
}
      `),
      [id('-horizontal')]: formatCode(`
import { ${Root}, ${Item} } from '../proto-ui/components/react';

export function CheckboxGroupHorizontalDemo() {
  return (
    <${Root}${rheaAttr} defaultValue={['email', 'in-app']} orientation="horizontal" ariaLabel="Delivery channels">
      <${Item} value="email">Email</${Item}>
      <${Item} value="sms">SMS</${Item}>
      <${Item} value="in-app">In-app</${Item}>
      <${Item} value="digest">Weekly digest</${Item}>
    </${Root}>
  );
}
      `),
      [id('-disabled')]: formatCode(`
import { ${Root}, ${Item} } from '../proto-ui/components/react';

export function CheckboxGroupDisabledDemo() {
  return (
    <div className="grid gap-4">
      <${Root}${rheaAttr} defaultValue={['email']} disabled ariaLabel="Disabled channels">
        <${Item} value="email">Email</${Item}>
        <${Item} value="sms">SMS</${Item}>
      </${Root}>
      <${Root}${rheaAttr} defaultValue={['email']} readOnly ariaLabel="Read-only channels">
        <${Item} value="email">Email</${Item}>
        <${Item} value="sms">SMS</${Item}>
      </${Root}>
    </div>
  );
}
      `),
      [id('-controlled')]: formatCode(`
import { useState } from 'react';
import { ${Root}, ${All}, ${Item} } from '../proto-ui/components/react';

export function CheckboxGroupControlledDemo() {
  const [value, setValue] = useState<string[]>(['email']);

  return (
    <div className="grid gap-3">
      <${Root}${rheaAttr} value={value} onValueChange={(detail) => setValue(detail.value)} ariaLabel="Release channels">
        <${All}>All channels</${All}>
        <${Item} value="email">Email</${Item}>
        <${Item} value="sms">SMS</${Item}>
        <${Item} value="webhook">Webhook</${Item}>
      </${Root}>
      <div role="status" aria-live="polite">
        Selected: {value.length > 0 ? value.join(', ') : 'none'}
      </div>
    </div>
  );
}
      `),
      [id('-form')]: formatCode(`
import { useState } from 'react';
import {
  ${FormRoot},
  ${FormField},
  ${FieldLabel},
  ${FieldError},
  ${FormSubmit},
  ${FormReset},
  ${Root},
  ${Item},
} from '../proto-ui/components/react';

export function CheckboxGroupFormDemo() {
  const [status, setStatus] = useState('Submit to inspect serialized values.');

  return (
    <div className="grid gap-3">
      <${FormRoot}${rheaAttr}
        ariaLabel="Notification preferences"
        onSubmit={(detail) => setStatus('Submitted: ' + JSON.stringify(detail.values))}
        onReset={() => setStatus('Reset to initial selection.')}
      >
        <${FormField} name="channels" required>
          <${FieldLabel}>Notification channels</${FieldLabel}>
          <${Root}${rheaAttr} defaultValue={['email']}>
            <${Item} value="email">Email</${Item}>
            <${Item} value="sms">SMS</${Item}>
            <${Item} value="in-app">In-app</${Item}>
          </${Root}>
          <${FieldError} />
        </${FormField}>
        <div className="flex gap-2">
          <${FormSubmit}>Save preferences</${FormSubmit}>
          <${FormReset}>Reset</${FormReset}>
        </div>
      </${FormRoot}>
      <div role="status" aria-live="polite">{status}</div>
    </div>
  );
}
      `),
    },
    vue: {
      [id()]: formatCode(`
<script setup lang="ts">
import { ${Root}, ${All}, ${Item} } from '../proto-ui/components/vue';
</script>

<template>
  <${Root}${rheaAttr} :defaultValue="['email']" ariaLabel="Notification channels">
    <${All}>All notifications</${All}>
    <${Item} value="email">Email updates</${Item}>
    <${Item} value="sms">SMS alerts</${Item}>
    <${Item} value="push" :disabled="true">Push notifications (unavailable)</${Item}>
  </${Root}>
</template>
      `),
      [id('-basic')]: formatCode(`
<script setup lang="ts">
import { ${Root}, ${Item} } from '../proto-ui/components/vue';
</script>

<template>
  <${Root}${rheaAttr} :defaultValue="['recents', 'home']" ariaLabel="Sidebar items">
    <${Item} value="recents">Recents</${Item}>
    <${Item} value="home">Home</${Item}>
    <${Item} value="applications">Applications</${Item}>
    <${Item} value="desktop">Desktop</${Item}>
  </${Root}>
</template>
      `),
      [id('-horizontal')]: formatCode(`
<script setup lang="ts">
import { ${Root}, ${Item} } from '../proto-ui/components/vue';
</script>

<template>
  <${Root}${rheaAttr} :defaultValue="['email', 'in-app']" orientation="horizontal" ariaLabel="Delivery channels">
    <${Item} value="email">Email</${Item}>
    <${Item} value="sms">SMS</${Item}>
    <${Item} value="in-app">In-app</${Item}>
    <${Item} value="digest">Weekly digest</${Item}>
  </${Root}>
</template>
      `),
      [id('-disabled')]: formatCode(`
<script setup lang="ts">
import { ${Root}, ${Item} } from '../proto-ui/components/vue';
</script>

<template>
  <div class="grid gap-4">
    <${Root}${rheaAttr} :defaultValue="['email']" :disabled="true" ariaLabel="Disabled channels">
      <${Item} value="email">Email</${Item}>
      <${Item} value="sms">SMS</${Item}>
    </${Root}>
    <${Root}${rheaAttr} :defaultValue="['email']" :readOnly="true" ariaLabel="Read-only channels">
      <${Item} value="email">Email</${Item}>
      <${Item} value="sms">SMS</${Item}>
    </${Root}>
  </div>
</template>
      `),
      [id('-controlled')]: formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import { ${Root}, ${All}, ${Item} } from '../proto-ui/components/vue';

const value = ref<string[]>(['email']);
const onValueChange = (detail: { value: string[] }) => {
  value.value = [...detail.value];
};
</script>

<template>
  <div class="grid gap-3">
    <${Root}${rheaAttr} :value="value" ariaLabel="Release channels" @value-change="onValueChange">
      <${All}>All channels</${All}>
      <${Item} value="email">Email</${Item}>
      <${Item} value="sms">SMS</${Item}>
      <${Item} value="webhook">Webhook</${Item}>
    </${Root}>
    <div role="status" aria-live="polite">
      Selected: {{ value.length ? value.join(', ') : 'none' }}
    </div>
  </div>
</template>
      `),
      [id('-form')]: formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  ${FormRoot},
  ${FormField},
  ${FieldLabel},
  ${FieldError},
  ${FormSubmit},
  ${FormReset},
  ${Root},
  ${Item},
} from '../proto-ui/components/vue';

const status = ref('Submit to inspect serialized values.');
const onSubmit = (detail: { values: unknown }) => {
  status.value = 'Submitted: ' + JSON.stringify(detail.values);
};
</script>

<template>
  <div class="grid gap-3">
    <${FormRoot}${rheaAttr} ariaLabel="Notification preferences" @submit="onSubmit" @reset="status = 'Reset to initial selection.'">
      <${FormField} name="channels" :required="true">
        <${FieldLabel}>Notification channels</${FieldLabel}>
        <${Root}${rheaAttr} :defaultValue="['email']">
          <${Item} value="email">Email</${Item}>
          <${Item} value="sms">SMS</${Item}>
          <${Item} value="in-app">In-app</${Item}>
        </${Root}>
        <${FieldError} />
      </${FormField}>
      <div class="flex gap-2">
        <${FormSubmit}>Save preferences</${FormSubmit}>
        <${FormReset}>Reset</${FormReset}>
      </div>
    </${FormRoot}>
    <div role="status" aria-live="polite">{{ status }}</div>
  </div>
</template>
      `),
    },
    vue2: {
      [id()]: formatCode(`
<template>
  <${Root}${rheaAttr} :defaultValue="['email']" ariaLabel="Notification channels">
    <${All}>All notifications</${All}>
    <${Item} value="email">Email updates</${Item}>
    <${Item} value="sms">SMS alerts</${Item}>
    <${Item} value="push" :disabled="true">Push notifications (unavailable)</${Item}>
  </${Root}>
</template>

<script>
import { ${Root}, ${All}, ${Item} } from '../proto-ui/components/vue2';

export default {
  components: {
    ${Root},
    ${All},
    ${Item},
  },
};
</script>
      `),
      [id('-basic')]: formatCode(`
<template>
  <${Root}${rheaAttr} :defaultValue="['recents', 'home']" ariaLabel="Sidebar items">
    <${Item} value="recents">Recents</${Item}>
    <${Item} value="home">Home</${Item}>
    <${Item} value="applications">Applications</${Item}>
    <${Item} value="desktop">Desktop</${Item}>
  </${Root}>
</template>

<script>
import { ${Root}, ${Item} } from '../proto-ui/components/vue2';

export default {
  components: {
    ${Root},
    ${Item},
  },
};
</script>
      `),
      [id('-horizontal')]: formatCode(`
<template>
  <${Root}${rheaAttr} :defaultValue="['email', 'in-app']" orientation="horizontal" ariaLabel="Delivery channels">
    <${Item} value="email">Email</${Item}>
    <${Item} value="sms">SMS</${Item}>
    <${Item} value="in-app">In-app</${Item}>
    <${Item} value="digest">Weekly digest</${Item}>
  </${Root}>
</template>

<script>
import { ${Root}, ${Item} } from '../proto-ui/components/vue2';

export default {
  components: {
    ${Root},
    ${Item},
  },
};
</script>
      `),
      [id('-disabled')]: formatCode(`
<template>
  <div class="grid gap-4">
    <${Root}${rheaAttr} :defaultValue="['email']" :disabled="true" ariaLabel="Disabled channels">
      <${Item} value="email">Email</${Item}>
      <${Item} value="sms">SMS</${Item}>
    </${Root}>
    <${Root}${rheaAttr} :defaultValue="['email']" :readOnly="true" ariaLabel="Read-only channels">
      <${Item} value="email">Email</${Item}>
      <${Item} value="sms">SMS</${Item}>
    </${Root}>
  </div>
</template>

<script>
import { ${Root}, ${Item} } from '../proto-ui/components/vue2';

export default {
  components: {
    ${Root},
    ${Item},
  },
};
</script>
      `),
      [id('-controlled')]: formatCode(`
<template>
  <div class="grid gap-3">
    <${Root}${rheaAttr} :value="value" ariaLabel="Release channels" @value-change="onValueChange">
      <${All}>All channels</${All}>
      <${Item} value="email">Email</${Item}>
      <${Item} value="sms">SMS</${Item}>
      <${Item} value="webhook">Webhook</${Item}>
    </${Root}>
    <div role="status" aria-live="polite">
      Selected: {{ value.length ? value.join(', ') : 'none' }}
    </div>
  </div>
</template>

<script>
import { ${Root}, ${All}, ${Item} } from '../proto-ui/components/vue2';

export default {
  components: {
    ${Root},
    ${All},
    ${Item},
  },
  data() {
    return { value: ['email'] };
  },
  methods: {
    onValueChange(detail) {
      this.value = [...detail.value];
    },
  },
};
</script>
      `),
      [id('-form')]: formatCode(`
<template>
  <div class="grid gap-3">
    <${FormRoot}${rheaAttr} ariaLabel="Notification preferences" @submit="onSubmit" @reset="onReset">
      <${FormField} name="channels" :required="true">
        <${FieldLabel}>Notification channels</${FieldLabel}>
        <${Root}${rheaAttr} :defaultValue="['email']">
          <${Item} value="email">Email</${Item}>
          <${Item} value="sms">SMS</${Item}>
          <${Item} value="in-app">In-app</${Item}>
        </${Root}>
        <${FieldError} />
      </${FormField}>
      <div class="flex gap-2">
        <${FormSubmit}>Save preferences</${FormSubmit}>
        <${FormReset}>Reset</${FormReset}>
      </div>
    </${FormRoot}>
    <div role="status" aria-live="polite">{{ status }}</div>
  </div>
</template>

<script>
import {
  ${FormRoot},
  ${FormField},
  ${FieldLabel},
  ${FieldError},
  ${FormSubmit},
  ${FormReset},
  ${Root},
  ${Item},
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${FormRoot},
    ${FormField},
    ${FieldLabel},
    ${FieldError},
    ${FormSubmit},
    ${FormReset},
    ${Root},
    ${Item},
  },
  data() {
    return { status: 'Submit to inspect serialized values.' };
  },
  methods: {
    onSubmit(detail) {
      this.status = 'Submitted: ' + JSON.stringify(detail.values);
    },
    onReset() {
      this.status = 'Reset to initial selection.';
    },
  },
};
</script>
      `),
    },
  };
}

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {},
  react: {},
  vue: {},
  vue2: {},
};

for (const family of FAMILIES) {
  const generated = buildFamilyCode(family);
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    Object.assign(codeMap[runtime], generated[runtime]);
  }
}
