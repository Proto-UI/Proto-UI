import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';
import type { LabelExampleFamily } from './label-examples.shared';

type FamilyCodeConfig = Readonly<{
  wcPrefix: string;
  compPrefix: string;
  wcStyleAttr: string;
  jsxStyleProp: string;
  vueStyleProp: string;
  secondaryToneAttr: string;
  secondaryToneProp: string;
  stageClass?: string;
}>;

const FAMILIES: Record<LabelExampleFamily, FamilyCodeConfig> = {
  shadcn: {
    wcPrefix: 'wc-shadcn',
    compPrefix: 'Shadcn',
    wcStyleAttr: ' style-profile="rhea"',
    jsxStyleProp: ' styleProfile="rhea"',
    vueStyleProp: ' styleProfile="rhea"',
    secondaryToneAttr: '',
    secondaryToneProp: '',
  },
  brutalist: {
    wcPrefix: 'wc-brutalist',
    compPrefix: 'Brutalist',
    wcStyleAttr: '',
    jsxStyleProp: '',
    vueStyleProp: '',
    secondaryToneAttr: '',
    secondaryToneProp: '',
  },
  'bootstrap-2-3-2': {
    wcPrefix: 'wc-bootstrap-2-3-2',
    compPrefix: 'Bootstrap',
    wcStyleAttr: '',
    jsxStyleProp: '',
    vueStyleProp: '',
    secondaryToneAttr: '',
    secondaryToneProp: '',
  },
  'liquid-glass': {
    wcPrefix: 'wc-liquid-glass',
    compPrefix: 'LiquidGlass',
    wcStyleAttr: '',
    jsxStyleProp: '',
    vueStyleProp: '',
    secondaryToneAttr: ' tone="secondary"',
    secondaryToneProp: ' tone="secondary"',
    stageClass:
      'rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
  },
};

function wrapHtmlStage(cfg: FamilyCodeConfig, inner: string): string {
  if (!cfg.stageClass) return inner;
  return `<div class="${cfg.stageClass}">\n${inner
    .split('\n')
    .map((line) => (line ? `  ${line}` : line))
    .join('\n')}\n</div>`;
}

function wrapJsxStage(cfg: FamilyCodeConfig, inner: string): string {
  if (!cfg.stageClass) return inner;
  return `<div className="${cfg.stageClass}">\n${inner
    .split('\n')
    .map((line) => (line ? `  ${line}` : line))
    .join('\n')}\n</div>`;
}

function buildOverviewWc(cfg: FamilyCodeConfig): string {
  const { wcPrefix: p, wcStyleAttr: s } = cfg;
  const body = wrapHtmlStage(
    cfg,
    `<div id="label-overview" class="flex w-full max-w-xl flex-col gap-4">
  <div class="flex items-center gap-2">
    <${p}-checkbox-root${s} data-pair="updates">
      <${p}-checkbox-indicator${s}></${p}-checkbox-indicator>
    </${p}-checkbox-root>
    <${p}-label-root${s} data-pair="updates">Community updates</${p}-label-root>
  </div>
  <div class="flex items-center gap-2">
    <${p}-switch-root${s} data-pair="notify">
      <${p}-switch-thumb${s}></${p}-switch-thumb>
    </${p}-switch-root>
    <${p}-label-root${s} data-pair="notify">Enable notifications</${p}-label-root>
  </div>
  <div class="flex flex-col gap-2">
    <${p}-label-root${s} data-pair="project">Project name</${p}-label-root>
    <${p}-input-root${s} data-pair="project" default-value="Proto UI"></${p}-input-root>
  </div>
  <div class="flex flex-col gap-2">
    <${p}-label-root${s} data-pair="notes">Project notes</${p}-label-root>
    <${p}-textarea-root${s} data-pair="notes" default-value="Share a brief summary of your project." rows="3"></${p}-textarea-root>
  </div>
  <div class="flex items-center gap-2">
    <${p}-checkbox-root${s} data-pair="passive">
      <${p}-checkbox-indicator${s}></${p}-checkbox-indicator>
    </${p}-checkbox-root>
    <${p}-label-root${s} data-pair="passive" activation="false">Naming-only label (selectable text)</${p}-label-root>
  </div>
</div>`
  );
  return formatCode(`
${body}
<script type="module">
  import { createControlLabelRef } from '@proto.ui/core';
  import { setElementAssociations } from '@proto.ui/adapter-web-component';

  const refs = new Map();
  document.querySelectorAll('#label-overview [data-pair]').forEach((el) => {
    const key = el.getAttribute('data-pair');
    if (!key) return;
    const ref = refs.get(key) ?? createControlLabelRef();
    refs.set(key, ref);
    setElementAssociations(el, { controlLabel: ref });
  });
</script>
  `);
}

function buildOverviewReact(cfg: FamilyCodeConfig): string {
  const { compPrefix: c, jsxStyleProp: s } = cfg;
  const body = wrapJsxStage(
    cfg,
    `<div className="flex w-full max-w-xl flex-col gap-4">
  <div className="flex items-center gap-2">
    <${c}CheckboxRoot${s} instanceAssociations={{ controlLabel: updatesRef }}>
      <${c}CheckboxIndicator${s} />
    </${c}CheckboxRoot>
    <${c}LabelRoot${s} instanceAssociations={{ controlLabel: updatesRef }}>
      Community updates
    </${c}LabelRoot>
  </div>
  <div className="flex items-center gap-2">
    <${c}SwitchRoot${s} instanceAssociations={{ controlLabel: notifyRef }}>
      <${c}SwitchThumb${s} />
    </${c}SwitchRoot>
    <${c}LabelRoot${s} instanceAssociations={{ controlLabel: notifyRef }}>
      Enable notifications
    </${c}LabelRoot>
  </div>
  <div className="flex flex-col gap-2">
    <${c}LabelRoot${s} instanceAssociations={{ controlLabel: projectRef }}>
      Project name
    </${c}LabelRoot>
    <${c}InputRoot${s} defaultValue="Proto UI" instanceAssociations={{ controlLabel: projectRef }} />
  </div>
  <div className="flex flex-col gap-2">
    <${c}LabelRoot${s} instanceAssociations={{ controlLabel: notesRef }}>
      Project notes
    </${c}LabelRoot>
    <${c}TextareaRoot${s} defaultValue="Share a brief summary of your project." rows={3} instanceAssociations={{ controlLabel: notesRef }} />
  </div>
  <div className="flex items-center gap-2">
    <${c}CheckboxRoot${s} instanceAssociations={{ controlLabel: passiveRef }}>
      <${c}CheckboxIndicator${s} />
    </${c}CheckboxRoot>
    <${c}LabelRoot${s} activation={false} instanceAssociations={{ controlLabel: passiveRef }}>
      Naming-only label (selectable text)
    </${c}LabelRoot>
  </div>
</div>`
  );
  return formatCode(`
import { useMemo } from 'react';
import { createControlLabelRef } from '@proto.ui/core';
import {
  ${c}CheckboxIndicator,
  ${c}CheckboxRoot,
  ${c}InputRoot,
  ${c}LabelRoot,
  ${c}SwitchRoot,
  ${c}SwitchThumb,
  ${c}TextareaRoot,
} from '../proto-ui/components/react';

export function LabelOverviewDemo() {
  const updatesRef = useMemo(() => createControlLabelRef(), []);
  const notifyRef = useMemo(() => createControlLabelRef(), []);
  const projectRef = useMemo(() => createControlLabelRef(), []);
  const notesRef = useMemo(() => createControlLabelRef(), []);
  const passiveRef = useMemo(() => createControlLabelRef(), []);

  return (
${body
  .split('\n')
  .map((line) => `    ${line}`)
  .join('\n')}
  );
}
  `);
}

function buildOverviewVue(cfg: FamilyCodeConfig): string {
  const { compPrefix: c, vueStyleProp: s } = cfg;
  const body = wrapHtmlStage(
    cfg,
    `<div class="flex w-full max-w-xl flex-col gap-4">
  <div class="flex items-center gap-2">
    <${c}CheckboxRoot${s} :instanceAssociations="{ controlLabel: updatesRef }">
      <${c}CheckboxIndicator${s} />
    </${c}CheckboxRoot>
    <${c}LabelRoot${s} :instanceAssociations="{ controlLabel: updatesRef }">
      Community updates
    </${c}LabelRoot>
  </div>
  <div class="flex items-center gap-2">
    <${c}SwitchRoot${s} :instanceAssociations="{ controlLabel: notifyRef }">
      <${c}SwitchThumb${s} />
    </${c}SwitchRoot>
    <${c}LabelRoot${s} :instanceAssociations="{ controlLabel: notifyRef }">
      Enable notifications
    </${c}LabelRoot>
  </div>
  <div class="flex flex-col gap-2">
    <${c}LabelRoot${s} :instanceAssociations="{ controlLabel: projectRef }">
      Project name
    </${c}LabelRoot>
    <${c}InputRoot${s} defaultValue="Proto UI" :instanceAssociations="{ controlLabel: projectRef }" />
  </div>
  <div class="flex flex-col gap-2">
    <${c}LabelRoot${s} :instanceAssociations="{ controlLabel: notesRef }">
      Project notes
    </${c}LabelRoot>
    <${c}TextareaRoot${s} defaultValue="Share a brief summary of your project." :rows="3" :instanceAssociations="{ controlLabel: notesRef }" />
  </div>
  <div class="flex items-center gap-2">
    <${c}CheckboxRoot${s} :instanceAssociations="{ controlLabel: passiveRef }">
      <${c}CheckboxIndicator${s} />
    </${c}CheckboxRoot>
    <${c}LabelRoot${s} :activation="false" :instanceAssociations="{ controlLabel: passiveRef }">
      Naming-only label (selectable text)
    </${c}LabelRoot>
  </div>
</div>`
  );
  return formatCode(`
<script setup lang="ts">
import { createControlLabelRef } from '@proto.ui/core';
import {
  ${c}CheckboxIndicator,
  ${c}CheckboxRoot,
  ${c}InputRoot,
  ${c}LabelRoot,
  ${c}SwitchRoot,
  ${c}SwitchThumb,
  ${c}TextareaRoot,
} from '../proto-ui/components/vue';

const updatesRef = createControlLabelRef();
const notifyRef = createControlLabelRef();
const projectRef = createControlLabelRef();
const notesRef = createControlLabelRef();
const passiveRef = createControlLabelRef();
</script>

<template>
${body
  .split('\n')
  .map((line) => `  ${line}`)
  .join('\n')}
</template>
  `);
}

function buildOverviewVue2(cfg: FamilyCodeConfig): string {
  const { compPrefix: c, vueStyleProp: s } = cfg;
  const body = wrapHtmlStage(
    cfg,
    `<div class="flex w-full max-w-xl flex-col gap-4">
  <div class="flex items-center gap-2">
    <${c}CheckboxRoot${s} :instanceAssociations="{ controlLabel: updatesRef }">
      <${c}CheckboxIndicator${s} />
    </${c}CheckboxRoot>
    <${c}LabelRoot${s} :instanceAssociations="{ controlLabel: updatesRef }">
      Community updates
    </${c}LabelRoot>
  </div>
  <div class="flex items-center gap-2">
    <${c}SwitchRoot${s} :instanceAssociations="{ controlLabel: notifyRef }">
      <${c}SwitchThumb${s} />
    </${c}SwitchRoot>
    <${c}LabelRoot${s} :instanceAssociations="{ controlLabel: notifyRef }">
      Enable notifications
    </${c}LabelRoot>
  </div>
  <div class="flex flex-col gap-2">
    <${c}LabelRoot${s} :instanceAssociations="{ controlLabel: projectRef }">
      Project name
    </${c}LabelRoot>
    <${c}InputRoot${s} defaultValue="Proto UI" :instanceAssociations="{ controlLabel: projectRef }" />
  </div>
  <div class="flex flex-col gap-2">
    <${c}LabelRoot${s} :instanceAssociations="{ controlLabel: notesRef }">
      Project notes
    </${c}LabelRoot>
    <${c}TextareaRoot${s} defaultValue="Share a brief summary of your project." :rows="3" :instanceAssociations="{ controlLabel: notesRef }" />
  </div>
  <div class="flex items-center gap-2">
    <${c}CheckboxRoot${s} :instanceAssociations="{ controlLabel: passiveRef }">
      <${c}CheckboxIndicator${s} />
    </${c}CheckboxRoot>
    <${c}LabelRoot${s} :activation="false" :instanceAssociations="{ controlLabel: passiveRef }">
      Naming-only label (selectable text)
    </${c}LabelRoot>
  </div>
</div>`
  );
  return formatCode(`
<template>
${body
  .split('\n')
  .map((line) => `  ${line}`)
  .join('\n')}
</template>

<script>
import { createControlLabelRef } from '@proto.ui/core';
import {
  ${c}CheckboxIndicator,
  ${c}CheckboxRoot,
  ${c}InputRoot,
  ${c}LabelRoot,
  ${c}SwitchRoot,
  ${c}SwitchThumb,
  ${c}TextareaRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${c}CheckboxIndicator,
    ${c}CheckboxRoot,
    ${c}InputRoot,
    ${c}LabelRoot,
    ${c}SwitchRoot,
    ${c}SwitchThumb,
    ${c}TextareaRoot,
  },
  data() {
    return {
      updatesRef: createControlLabelRef(),
      notifyRef: createControlLabelRef(),
      projectRef: createControlLabelRef(),
      notesRef: createControlLabelRef(),
      passiveRef: createControlLabelRef(),
    };
  },
};
</script>
  `);
}

function buildBasicWc(cfg: FamilyCodeConfig): string {
  const { wcPrefix: p, wcStyleAttr: s } = cfg;
  const body = wrapHtmlStage(
    cfg,
    `<div class="flex items-center gap-2">
  <${p}-checkbox-root${s} id="terms-checkbox">
    <${p}-checkbox-indicator${s}></${p}-checkbox-indicator>
  </${p}-checkbox-root>
  <${p}-label-root${s} id="terms-label">Accept terms and conditions</${p}-label-root>
</div>`
  );
  return formatCode(`
${body}
<script type="module">
  import { createControlLabelRef } from '@proto.ui/core';
  import { setElementAssociations } from '@proto.ui/adapter-web-component';

  const termsRef = createControlLabelRef();
  const checkbox = document.querySelector('#terms-checkbox');
  const label = document.querySelector('#terms-label');
  if (checkbox instanceof HTMLElement && label instanceof HTMLElement) {
    setElementAssociations(checkbox, { controlLabel: termsRef });
    setElementAssociations(label, { controlLabel: termsRef });
  }
</script>
  `);
}

function buildBasicReact(cfg: FamilyCodeConfig): string {
  const { compPrefix: c, jsxStyleProp: s } = cfg;
  const body = wrapJsxStage(
    cfg,
    `<div className="flex items-center gap-2">
  <${c}CheckboxRoot${s} instanceAssociations={{ controlLabel: termsRef }}>
    <${c}CheckboxIndicator${s} />
  </${c}CheckboxRoot>
  <${c}LabelRoot${s} instanceAssociations={{ controlLabel: termsRef }}>
    Accept terms and conditions
  </${c}LabelRoot>
</div>`
  );
  return formatCode(`
import { useMemo } from 'react';
import { createControlLabelRef } from '@proto.ui/core';
import {
  ${c}CheckboxIndicator,
  ${c}CheckboxRoot,
  ${c}LabelRoot,
} from '../proto-ui/components/react';

export function LabelDemo() {
  const termsRef = useMemo(() => createControlLabelRef(), []);

  return (
${body
  .split('\n')
  .map((line) => `    ${line}`)
  .join('\n')}
  );
}
  `);
}

function buildBasicVue(cfg: FamilyCodeConfig): string {
  const { compPrefix: c, vueStyleProp: s } = cfg;
  const body = wrapHtmlStage(
    cfg,
    `<div class="flex items-center gap-2">
  <${c}CheckboxRoot${s} :instanceAssociations="{ controlLabel: termsRef }">
    <${c}CheckboxIndicator${s} />
  </${c}CheckboxRoot>
  <${c}LabelRoot${s} :instanceAssociations="{ controlLabel: termsRef }">
    Accept terms and conditions
  </${c}LabelRoot>
</div>`
  );
  return formatCode(`
<script setup lang="ts">
import { createControlLabelRef } from '@proto.ui/core';
import {
  ${c}CheckboxIndicator,
  ${c}CheckboxRoot,
  ${c}LabelRoot,
} from '../proto-ui/components/vue';

const termsRef = createControlLabelRef();
</script>

<template>
${body
  .split('\n')
  .map((line) => `  ${line}`)
  .join('\n')}
</template>
  `);
}

function buildBasicVue2(cfg: FamilyCodeConfig): string {
  const { compPrefix: c, vueStyleProp: s } = cfg;
  const body = wrapHtmlStage(
    cfg,
    `<div class="flex items-center gap-2">
  <${c}CheckboxRoot${s} :instanceAssociations="{ controlLabel: termsRef }">
    <${c}CheckboxIndicator${s} />
  </${c}CheckboxRoot>
  <${c}LabelRoot${s} :instanceAssociations="{ controlLabel: termsRef }">
    Accept terms and conditions
  </${c}LabelRoot>
</div>`
  );
  return formatCode(`
<template>
${body
  .split('\n')
  .map((line) => `  ${line}`)
  .join('\n')}
</template>

<script>
import { createControlLabelRef } from '@proto.ui/core';
import {
  ${c}CheckboxIndicator,
  ${c}CheckboxRoot,
  ${c}LabelRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${c}CheckboxIndicator,
    ${c}CheckboxRoot,
    ${c}LabelRoot,
  },
  data() {
    return {
      termsRef: createControlLabelRef(),
    };
  },
};
</script>
  `);
}

function buildFieldWc(cfg: FamilyCodeConfig): string {
  const { wcPrefix: p, wcStyleAttr: s } = cfg;
  const body = wrapHtmlStage(
    cfg,
    `<div class="flex w-full max-w-md flex-col gap-5">
  <${p}-field-root${s} required validation-mode="onBlur">
    <${p}-field-label${s}>Email address</${p}-field-label>
    <${p}-field-control${s} placeholder="name@example.com"></${p}-field-control>
    <${p}-field-description${s}>We will use this address for account security notices.</${p}-field-description>
    <${p}-field-error${s}></${p}-field-error>
  </${p}-field-root>
  <${p}-field-root${s}>
    <${p}-field-label${s}>Display name</${p}-field-label>
    <${p}-field-control${s} default-value="Alex Chen"></${p}-field-control>
    <${p}-field-description${s}>Shown alongside your comments and reviews.</${p}-field-description>
  </${p}-field-root>
  <div class="flex items-center gap-2">
    <${p}-checkbox-root${s} id="field-updates-checkbox" default-checked>
      <${p}-checkbox-indicator${s}></${p}-checkbox-indicator>
    </${p}-checkbox-root>
    <${p}-label-root${s} id="field-updates-label">Send me product release notes</${p}-label-root>
  </div>
</div>`
  );
  return formatCode(`
${body}
<script type="module">
  import { createControlLabelRef } from '@proto.ui/core';
  import { setElementAssociations } from '@proto.ui/adapter-web-component';

  const updatesRef = createControlLabelRef();
  const checkbox = document.querySelector('#field-updates-checkbox');
  const label = document.querySelector('#field-updates-label');
  if (checkbox instanceof HTMLElement && label instanceof HTMLElement) {
    setElementAssociations(checkbox, { controlLabel: updatesRef });
    setElementAssociations(label, { controlLabel: updatesRef });
  }
</script>
  `);
}

function buildFieldReact(cfg: FamilyCodeConfig): string {
  const { compPrefix: c, jsxStyleProp: s } = cfg;
  const body = wrapJsxStage(
    cfg,
    `<div className="flex w-full max-w-md flex-col gap-5">
  <${c}FieldRoot${s} required validationMode="onBlur">
    <${c}FieldLabel${s}>Email address</${c}FieldLabel>
    <${c}FieldControl${s} placeholder="name@example.com" />
    <${c}FieldDescription${s}>We will use this address for account security notices.</${c}FieldDescription>
    <${c}FieldError${s} />
  </${c}FieldRoot>
  <${c}FieldRoot${s}>
    <${c}FieldLabel${s}>Display name</${c}FieldLabel>
    <${c}FieldControl${s} defaultValue="Alex Chen" />
    <${c}FieldDescription${s}>Shown alongside your comments and reviews.</${c}FieldDescription>
  </${c}FieldRoot>
  <div className="flex items-center gap-2">
    <${c}CheckboxRoot${s} defaultChecked instanceAssociations={{ controlLabel: updatesRef }}>
      <${c}CheckboxIndicator${s} />
    </${c}CheckboxRoot>
    <${c}LabelRoot${s} instanceAssociations={{ controlLabel: updatesRef }}>
      Send me product release notes
    </${c}LabelRoot>
  </div>
</div>`
  );
  return formatCode(`
import { useMemo } from 'react';
import { createControlLabelRef } from '@proto.ui/core';
import {
  ${c}CheckboxIndicator,
  ${c}CheckboxRoot,
  ${c}FieldControl,
  ${c}FieldDescription,
  ${c}FieldError,
  ${c}FieldLabel,
  ${c}FieldRoot,
  ${c}LabelRoot,
} from '../proto-ui/components/react';

export function LabelInFieldDemo() {
  const updatesRef = useMemo(() => createControlLabelRef(), []);

  return (
${body
  .split('\n')
  .map((line) => `    ${line}`)
  .join('\n')}
  );
}
  `);
}

function buildFieldVue(cfg: FamilyCodeConfig): string {
  const { compPrefix: c, vueStyleProp: s } = cfg;
  const body = wrapHtmlStage(
    cfg,
    `<div class="flex w-full max-w-md flex-col gap-5">
  <${c}FieldRoot${s} :required="true" validationMode="onBlur">
    <${c}FieldLabel${s}>Email address</${c}FieldLabel>
    <${c}FieldControl${s} placeholder="name@example.com" />
    <${c}FieldDescription${s}>We will use this address for account security notices.</${c}FieldDescription>
    <${c}FieldError${s} />
  </${c}FieldRoot>
  <${c}FieldRoot${s}>
    <${c}FieldLabel${s}>Display name</${c}FieldLabel>
    <${c}FieldControl${s} defaultValue="Alex Chen" />
    <${c}FieldDescription${s}>Shown alongside your comments and reviews.</${c}FieldDescription>
  </${c}FieldRoot>
  <div class="flex items-center gap-2">
    <${c}CheckboxRoot${s} :defaultChecked="true" :instanceAssociations="{ controlLabel: updatesRef }">
      <${c}CheckboxIndicator${s} />
    </${c}CheckboxRoot>
    <${c}LabelRoot${s} :instanceAssociations="{ controlLabel: updatesRef }">
      Send me product release notes
    </${c}LabelRoot>
  </div>
</div>`
  );
  return formatCode(`
<script setup lang="ts">
import { createControlLabelRef } from '@proto.ui/core';
import {
  ${c}CheckboxIndicator,
  ${c}CheckboxRoot,
  ${c}FieldControl,
  ${c}FieldDescription,
  ${c}FieldError,
  ${c}FieldLabel,
  ${c}FieldRoot,
  ${c}LabelRoot,
} from '../proto-ui/components/vue';

const updatesRef = createControlLabelRef();
</script>

<template>
${body
  .split('\n')
  .map((line) => `  ${line}`)
  .join('\n')}
</template>
  `);
}

function buildFieldVue2(cfg: FamilyCodeConfig): string {
  const { compPrefix: c, vueStyleProp: s } = cfg;
  const body = wrapHtmlStage(
    cfg,
    `<div class="flex w-full max-w-md flex-col gap-5">
  <${c}FieldRoot${s} :required="true" validationMode="onBlur">
    <${c}FieldLabel${s}>Email address</${c}FieldLabel>
    <${c}FieldControl${s} placeholder="name@example.com" />
    <${c}FieldDescription${s}>We will use this address for account security notices.</${c}FieldDescription>
    <${c}FieldError${s} />
  </${c}FieldRoot>
  <${c}FieldRoot${s}>
    <${c}FieldLabel${s}>Display name</${c}FieldLabel>
    <${c}FieldControl${s} defaultValue="Alex Chen" />
    <${c}FieldDescription${s}>Shown alongside your comments and reviews.</${c}FieldDescription>
  </${c}FieldRoot>
  <div class="flex items-center gap-2">
    <${c}CheckboxRoot${s} :defaultChecked="true" :instanceAssociations="{ controlLabel: updatesRef }">
      <${c}CheckboxIndicator${s} />
    </${c}CheckboxRoot>
    <${c}LabelRoot${s} :instanceAssociations="{ controlLabel: updatesRef }">
      Send me product release notes
    </${c}LabelRoot>
  </div>
</div>`
  );
  return formatCode(`
<template>
${body
  .split('\n')
  .map((line) => `  ${line}`)
  .join('\n')}
</template>

<script>
import { createControlLabelRef } from '@proto.ui/core';
import {
  ${c}CheckboxIndicator,
  ${c}CheckboxRoot,
  ${c}FieldControl,
  ${c}FieldDescription,
  ${c}FieldError,
  ${c}FieldLabel,
  ${c}FieldRoot,
  ${c}LabelRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${c}CheckboxIndicator,
    ${c}CheckboxRoot,
    ${c}FieldControl,
    ${c}FieldDescription,
    ${c}FieldError,
    ${c}FieldLabel,
    ${c}FieldRoot,
    ${c}LabelRoot,
  },
  data() {
    return {
      updatesRef: createControlLabelRef(),
    };
  },
};
</script>
  `);
}

function buildModesWc(cfg: FamilyCodeConfig): string {
  const { wcPrefix: p, wcStyleAttr: s, secondaryToneAttr: t } = cfg;
  const body = wrapHtmlStage(
    cfg,
    `<div id="label-modes" class="flex w-full max-w-md flex-col gap-4">
  <div class="flex items-center gap-2">
    <${p}-checkbox-root${s} data-pair="copyable">
      <${p}-checkbox-indicator${s}></${p}-checkbox-indicator>
    </${p}-checkbox-root>
    <${p}-label-root${s} data-pair="copyable" selection="text">Weekly digest (clickable and selectable)</${p}-label-root>
  </div>
  <div class="flex items-center gap-2">
    <${p}-checkbox-root${s} data-pair="naming-only">
      <${p}-checkbox-indicator${s}></${p}-checkbox-indicator>
    </${p}-checkbox-root>
    <${p}-label-root${s} data-pair="naming-only" activation="false">Release policy notice (naming only)</${p}-label-root>
  </div>
  <div class="flex flex-col gap-2">
    <${p}-label-root${s}${t} data-pair="activation-only" naming="false">Quick filter (activation only)</${p}-label-root>
    <${p}-input-root${s} data-pair="activation-only" aria-label="Filter workspace items" placeholder="Filter workspace items..."></${p}-input-root>
  </div>
  <div class="flex items-center gap-2">
    <${p}-checkbox-root${s} data-pair="unavailable" disabled>
      <${p}-checkbox-indicator${s}></${p}-checkbox-indicator>
    </${p}-checkbox-root>
    <${p}-label-root${s} data-pair="unavailable">Unavailable option</${p}-label-root>
  </div>
</div>`
  );
  return formatCode(`
${body}
<script type="module">
  import { createControlLabelRef } from '@proto.ui/core';
  import { setElementAssociations } from '@proto.ui/adapter-web-component';

  const refs = new Map();
  document.querySelectorAll('#label-modes [data-pair]').forEach((el) => {
    const key = el.getAttribute('data-pair');
    if (!key) return;
    const ref = refs.get(key) ?? createControlLabelRef();
    refs.set(key, ref);
    setElementAssociations(el, { controlLabel: ref });
  });
</script>
  `);
}

function buildModesReact(cfg: FamilyCodeConfig): string {
  const { compPrefix: c, jsxStyleProp: s, secondaryToneProp: t } = cfg;
  const body = wrapJsxStage(
    cfg,
    `<div className="flex w-full max-w-md flex-col gap-4">
  <div className="flex items-center gap-2">
    <${c}CheckboxRoot${s} instanceAssociations={{ controlLabel: copyableRef }}>
      <${c}CheckboxIndicator${s} />
    </${c}CheckboxRoot>
    <${c}LabelRoot${s} selection="text" instanceAssociations={{ controlLabel: copyableRef }}>
      Weekly digest (clickable and selectable)
    </${c}LabelRoot>
  </div>
  <div className="flex items-center gap-2">
    <${c}CheckboxRoot${s} instanceAssociations={{ controlLabel: namingOnlyRef }}>
      <${c}CheckboxIndicator${s} />
    </${c}CheckboxRoot>
    <${c}LabelRoot${s} activation={false} instanceAssociations={{ controlLabel: namingOnlyRef }}>
      Release policy notice (naming only)
    </${c}LabelRoot>
  </div>
  <div className="flex flex-col gap-2">
    <${c}LabelRoot${s}${t} naming={false} instanceAssociations={{ controlLabel: activationOnlyRef }}>
      Quick filter (activation only)
    </${c}LabelRoot>
    <${c}InputRoot${s} ariaLabel="Filter workspace items" placeholder="Filter workspace items..." instanceAssociations={{ controlLabel: activationOnlyRef }} />
  </div>
  <div className="flex items-center gap-2">
    <${c}CheckboxRoot${s} disabled instanceAssociations={{ controlLabel: unavailableRef }}>
      <${c}CheckboxIndicator${s} />
    </${c}CheckboxRoot>
    <${c}LabelRoot${s} instanceAssociations={{ controlLabel: unavailableRef }}>
      Unavailable option
    </${c}LabelRoot>
  </div>
</div>`
  );
  return formatCode(`
import { useMemo } from 'react';
import { createControlLabelRef } from '@proto.ui/core';
import {
  ${c}CheckboxIndicator,
  ${c}CheckboxRoot,
  ${c}InputRoot,
  ${c}LabelRoot,
} from '../proto-ui/components/react';

export function LabelModesDemo() {
  const copyableRef = useMemo(() => createControlLabelRef(), []);
  const namingOnlyRef = useMemo(() => createControlLabelRef(), []);
  const activationOnlyRef = useMemo(() => createControlLabelRef(), []);
  const unavailableRef = useMemo(() => createControlLabelRef(), []);

  return (
${body
  .split('\n')
  .map((line) => `    ${line}`)
  .join('\n')}
  );
}
  `);
}

function buildModesVue(cfg: FamilyCodeConfig): string {
  const { compPrefix: c, vueStyleProp: s, secondaryToneProp: t } = cfg;
  const body = wrapHtmlStage(
    cfg,
    `<div class="flex w-full max-w-md flex-col gap-4">
  <div class="flex items-center gap-2">
    <${c}CheckboxRoot${s} :instanceAssociations="{ controlLabel: copyableRef }">
      <${c}CheckboxIndicator${s} />
    </${c}CheckboxRoot>
    <${c}LabelRoot${s} selection="text" :instanceAssociations="{ controlLabel: copyableRef }">
      Weekly digest (clickable and selectable)
    </${c}LabelRoot>
  </div>
  <div class="flex items-center gap-2">
    <${c}CheckboxRoot${s} :instanceAssociations="{ controlLabel: namingOnlyRef }">
      <${c}CheckboxIndicator${s} />
    </${c}CheckboxRoot>
    <${c}LabelRoot${s} :activation="false" :instanceAssociations="{ controlLabel: namingOnlyRef }">
      Release policy notice (naming only)
    </${c}LabelRoot>
  </div>
  <div class="flex flex-col gap-2">
    <${c}LabelRoot${s}${t} :naming="false" :instanceAssociations="{ controlLabel: activationOnlyRef }">
      Quick filter (activation only)
    </${c}LabelRoot>
    <${c}InputRoot${s} ariaLabel="Filter workspace items" placeholder="Filter workspace items..." :instanceAssociations="{ controlLabel: activationOnlyRef }" />
  </div>
  <div class="flex items-center gap-2">
    <${c}CheckboxRoot${s} :disabled="true" :instanceAssociations="{ controlLabel: unavailableRef }">
      <${c}CheckboxIndicator${s} />
    </${c}CheckboxRoot>
    <${c}LabelRoot${s} :instanceAssociations="{ controlLabel: unavailableRef }">
      Unavailable option
    </${c}LabelRoot>
  </div>
</div>`
  );
  return formatCode(`
<script setup lang="ts">
import { createControlLabelRef } from '@proto.ui/core';
import {
  ${c}CheckboxIndicator,
  ${c}CheckboxRoot,
  ${c}InputRoot,
  ${c}LabelRoot,
} from '../proto-ui/components/vue';

const copyableRef = createControlLabelRef();
const namingOnlyRef = createControlLabelRef();
const activationOnlyRef = createControlLabelRef();
const unavailableRef = createControlLabelRef();
</script>

<template>
${body
  .split('\n')
  .map((line) => `  ${line}`)
  .join('\n')}
</template>
  `);
}

function buildModesVue2(cfg: FamilyCodeConfig): string {
  const { compPrefix: c, vueStyleProp: s, secondaryToneProp: t } = cfg;
  const body = wrapHtmlStage(
    cfg,
    `<div class="flex w-full max-w-md flex-col gap-4">
  <div class="flex items-center gap-2">
    <${c}CheckboxRoot${s} :instanceAssociations="{ controlLabel: copyableRef }">
      <${c}CheckboxIndicator${s} />
    </${c}CheckboxRoot>
    <${c}LabelRoot${s} selection="text" :instanceAssociations="{ controlLabel: copyableRef }">
      Weekly digest (clickable and selectable)
    </${c}LabelRoot>
  </div>
  <div class="flex items-center gap-2">
    <${c}CheckboxRoot${s} :instanceAssociations="{ controlLabel: namingOnlyRef }">
      <${c}CheckboxIndicator${s} />
    </${c}CheckboxRoot>
    <${c}LabelRoot${s} :activation="false" :instanceAssociations="{ controlLabel: namingOnlyRef }">
      Release policy notice (naming only)
    </${c}LabelRoot>
  </div>
  <div class="flex flex-col gap-2">
    <${c}LabelRoot${s}${t} :naming="false" :instanceAssociations="{ controlLabel: activationOnlyRef }">
      Quick filter (activation only)
    </${c}LabelRoot>
    <${c}InputRoot${s} ariaLabel="Filter workspace items" placeholder="Filter workspace items..." :instanceAssociations="{ controlLabel: activationOnlyRef }" />
  </div>
  <div class="flex items-center gap-2">
    <${c}CheckboxRoot${s} :disabled="true" :instanceAssociations="{ controlLabel: unavailableRef }">
      <${c}CheckboxIndicator${s} />
    </${c}CheckboxRoot>
    <${c}LabelRoot${s} :instanceAssociations="{ controlLabel: unavailableRef }">
      Unavailable option
    </${c}LabelRoot>
  </div>
</div>`
  );
  return formatCode(`
<template>
${body
  .split('\n')
  .map((line) => `  ${line}`)
  .join('\n')}
</template>

<script>
import { createControlLabelRef } from '@proto.ui/core';
import {
  ${c}CheckboxIndicator,
  ${c}CheckboxRoot,
  ${c}InputRoot,
  ${c}LabelRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${c}CheckboxIndicator,
    ${c}CheckboxRoot,
    ${c}InputRoot,
    ${c}LabelRoot,
  },
  data() {
    return {
      copyableRef: createControlLabelRef(),
      namingOnlyRef: createControlLabelRef(),
      activationOnlyRef: createControlLabelRef(),
      unavailableRef: createControlLabelRef(),
    };
  },
};
</script>
  `);
}

function buildRtlWc(cfg: FamilyCodeConfig): string {
  const { wcPrefix: p, wcStyleAttr: s } = cfg;
  const body = wrapHtmlStage(
    cfg,
    `<div id="label-rtl" dir="rtl" class="flex w-full max-w-sm flex-col gap-4">
  <div class="flex items-center gap-2">
    <${p}-checkbox-root${s} data-pair="rtl-terms">
      <${p}-checkbox-indicator${s}></${p}-checkbox-indicator>
    </${p}-checkbox-root>
    <${p}-label-root${s} data-pair="rtl-terms">قبول الشروط والأحكام</${p}-label-root>
  </div>
  <div class="flex flex-col gap-2">
    <${p}-label-root${s} data-pair="rtl-email">البريد الإلكتروني</${p}-label-root>
    <${p}-input-root${s} data-pair="rtl-email" placeholder="name@example.com"></${p}-input-root>
  </div>
</div>`
  );
  return formatCode(`
${body}
<script type="module">
  import { createControlLabelRef } from '@proto.ui/core';
  import { setElementAssociations } from '@proto.ui/adapter-web-component';

  const refs = new Map();
  document.querySelectorAll('#label-rtl [data-pair]').forEach((el) => {
    const key = el.getAttribute('data-pair');
    if (!key) return;
    const ref = refs.get(key) ?? createControlLabelRef();
    refs.set(key, ref);
    setElementAssociations(el, { controlLabel: ref });
  });
</script>
  `);
}

function buildRtlReact(cfg: FamilyCodeConfig): string {
  const { compPrefix: c, jsxStyleProp: s } = cfg;
  const body = wrapJsxStage(
    cfg,
    `<div dir="rtl" className="flex w-full max-w-sm flex-col gap-4">
  <div className="flex items-center gap-2">
    <${c}CheckboxRoot${s} instanceAssociations={{ controlLabel: termsRef }}>
      <${c}CheckboxIndicator${s} />
    </${c}CheckboxRoot>
    <${c}LabelRoot${s} instanceAssociations={{ controlLabel: termsRef }}>
      قبول الشروط والأحكام
    </${c}LabelRoot>
  </div>
  <div className="flex flex-col gap-2">
    <${c}LabelRoot${s} instanceAssociations={{ controlLabel: emailRef }}>
      البريد الإلكتروني
    </${c}LabelRoot>
    <${c}InputRoot${s} placeholder="name@example.com" instanceAssociations={{ controlLabel: emailRef }} />
  </div>
</div>`
  );
  return formatCode(`
import { useMemo } from 'react';
import { createControlLabelRef } from '@proto.ui/core';
import {
  ${c}CheckboxIndicator,
  ${c}CheckboxRoot,
  ${c}InputRoot,
  ${c}LabelRoot,
} from '../proto-ui/components/react';

export function LabelRtlDemo() {
  const termsRef = useMemo(() => createControlLabelRef(), []);
  const emailRef = useMemo(() => createControlLabelRef(), []);

  return (
${body
  .split('\n')
  .map((line) => `    ${line}`)
  .join('\n')}
  );
}
  `);
}

function buildRtlVue(cfg: FamilyCodeConfig): string {
  const { compPrefix: c, vueStyleProp: s } = cfg;
  const body = wrapHtmlStage(
    cfg,
    `<div dir="rtl" class="flex w-full max-w-sm flex-col gap-4">
  <div class="flex items-center gap-2">
    <${c}CheckboxRoot${s} :instanceAssociations="{ controlLabel: termsRef }">
      <${c}CheckboxIndicator${s} />
    </${c}CheckboxRoot>
    <${c}LabelRoot${s} :instanceAssociations="{ controlLabel: termsRef }">
      قبول الشروط والأحكام
    </${c}LabelRoot>
  </div>
  <div class="flex flex-col gap-2">
    <${c}LabelRoot${s} :instanceAssociations="{ controlLabel: emailRef }">
      البريد الإلكتروني
    </${c}LabelRoot>
    <${c}InputRoot${s} placeholder="name@example.com" :instanceAssociations="{ controlLabel: emailRef }" />
  </div>
</div>`
  );
  return formatCode(`
<script setup lang="ts">
import { createControlLabelRef } from '@proto.ui/core';
import {
  ${c}CheckboxIndicator,
  ${c}CheckboxRoot,
  ${c}InputRoot,
  ${c}LabelRoot,
} from '../proto-ui/components/vue';

const termsRef = createControlLabelRef();
const emailRef = createControlLabelRef();
</script>

<template>
${body
  .split('\n')
  .map((line) => `  ${line}`)
  .join('\n')}
</template>
  `);
}

function buildRtlVue2(cfg: FamilyCodeConfig): string {
  const { compPrefix: c, vueStyleProp: s } = cfg;
  const body = wrapHtmlStage(
    cfg,
    `<div dir="rtl" class="flex w-full max-w-sm flex-col gap-4">
  <div class="flex items-center gap-2">
    <${c}CheckboxRoot${s} :instanceAssociations="{ controlLabel: termsRef }">
      <${c}CheckboxIndicator${s} />
    </${c}CheckboxRoot>
    <${c}LabelRoot${s} :instanceAssociations="{ controlLabel: termsRef }">
      قبول الشروط والأحكام
    </${c}LabelRoot>
  </div>
  <div class="flex flex-col gap-2">
    <${c}LabelRoot${s} :instanceAssociations="{ controlLabel: emailRef }">
      البريد الإلكتروني
    </${c}LabelRoot>
    <${c}InputRoot${s} placeholder="name@example.com" :instanceAssociations="{ controlLabel: emailRef }" />
  </div>
</div>`
  );
  return formatCode(`
<template>
${body
  .split('\n')
  .map((line) => `  ${line}`)
  .join('\n')}
</template>

<script>
import { createControlLabelRef } from '@proto.ui/core';
import {
  ${c}CheckboxIndicator,
  ${c}CheckboxRoot,
  ${c}InputRoot,
  ${c}LabelRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${c}CheckboxIndicator,
    ${c}CheckboxRoot,
    ${c}InputRoot,
    ${c}LabelRoot,
  },
  data() {
    return {
      termsRef: createControlLabelRef(),
      emailRef: createControlLabelRef(),
    };
  },
};
</script>
  `);
}

function buildRuntimeMap(runtime: RuntimeId): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const [family, cfg] of Object.entries(FAMILIES) as [
    LabelExampleFamily,
    FamilyCodeConfig,
  ][]) {
    if (runtime === 'wc') {
      entries[`demo-${family}-label`] = buildOverviewWc(cfg);
      entries[`demo-${family}-label-basic`] = buildBasicWc(cfg);
      entries[`demo-${family}-label-field`] = buildFieldWc(cfg);
      entries[`demo-${family}-label-modes`] = buildModesWc(cfg);
      entries[`demo-${family}-label-rtl`] = buildRtlWc(cfg);
    } else if (runtime === 'react') {
      entries[`demo-${family}-label`] = buildOverviewReact(cfg);
      entries[`demo-${family}-label-basic`] = buildBasicReact(cfg);
      entries[`demo-${family}-label-field`] = buildFieldReact(cfg);
      entries[`demo-${family}-label-modes`] = buildModesReact(cfg);
      entries[`demo-${family}-label-rtl`] = buildRtlReact(cfg);
    } else if (runtime === 'vue') {
      entries[`demo-${family}-label`] = buildOverviewVue(cfg);
      entries[`demo-${family}-label-basic`] = buildBasicVue(cfg);
      entries[`demo-${family}-label-field`] = buildFieldVue(cfg);
      entries[`demo-${family}-label-modes`] = buildModesVue(cfg);
      entries[`demo-${family}-label-rtl`] = buildRtlVue(cfg);
    } else {
      entries[`demo-${family}-label`] = buildOverviewVue2(cfg);
      entries[`demo-${family}-label-basic`] = buildBasicVue2(cfg);
      entries[`demo-${family}-label-field`] = buildFieldVue2(cfg);
      entries[`demo-${family}-label-modes`] = buildModesVue2(cfg);
      entries[`demo-${family}-label-rtl`] = buildRtlVue2(cfg);
    }
  }
  return entries;
}

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: buildRuntimeMap('wc'),
  react: buildRuntimeMap('react'),
  vue: buildRuntimeMap('vue'),
  vue2: buildRuntimeMap('vue2'),
};
