import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

type FamilyConfig = Readonly<{
  id: 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass';
  pkg: string;
  exportName: string;
  tagName: string;
  componentName: string;
}>;

const FAMILIES: readonly FamilyConfig[] = [
  {
    id: 'shadcn',
    pkg: '@proto.ui/prototypes-shadcn/live-region',
    exportName: 'liveRegionRoot',
    tagName: 'shadcn-live-region-root',
    componentName: 'LiveRegionRoot',
  },
  {
    id: 'brutalist',
    pkg: '@proto.ui/prototypes-brutalist/live-region',
    exportName: 'BrutalistLiveRegionRoot',
    tagName: 'brutalist-live-region-root',
    componentName: 'BrutalistLiveRegionRoot',
  },
  {
    id: 'bootstrap-2-3-2',
    pkg: '@proto.ui/prototypes-bootstrap-2-3-2/live-region',
    exportName: 'liveRegionRoot',
    tagName: 'bootstrap-2-3-2-live-region-root',
    componentName: 'BootstrapLiveRegionRoot',
  },
  {
    id: 'liquid-glass',
    pkg: '@proto.ui/prototypes-liquid-glass/live-region',
    exportName: 'liveRegionRoot',
    tagName: 'liquid-glass-live-region-root',
    componentName: 'LiquidGlassLiveRegionRoot',
  },
];

function wcBasic(f: FamilyConfig): string {
  return formatCode(`
<${f.tagName} id="inbox-status">No unread messages</${f.tagName}>
<${f.tagName} id="service-alert">All systems operational</${f.tagName}>

<script type="module">
  import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
  import { ${f.exportName} } from '${f.pkg}';

  AdaptToWebComponent(${f.exportName});

  const status = document.querySelector('#inbox-status');
  const alert = document.querySelector('#service-alert');
  setElementProps(status, { politeness: 'polite', atomic: true });
  setElementProps(alert, { politeness: 'assertive', atomic: true });

  // Update authored text content to trigger a screen-reader announcement.
  status.textContent = '1 unread message';
</script>
  `);
}

function wcAtomic(f: FamilyConfig): string {
  return formatCode(`
<${f.tagName} id="upload-atomic">
  Upload progress: <span id="step-atomic">25% (1 of 4 files)</span>
</${f.tagName}>
<${f.tagName} id="upload-incremental">
  Upload progress: <span id="step-incremental">25% (1 of 4 files)</span>
</${f.tagName}>

<script type="module">
  import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
  import { ${f.exportName} } from '${f.pkg}';

  AdaptToWebComponent(${f.exportName});

  setElementProps(document.querySelector('#upload-atomic'), {
    politeness: 'polite',
    atomic: true,
  });
  setElementProps(document.querySelector('#upload-incremental'), {
    politeness: 'polite',
    atomic: false,
  });
</script>
  `);
}

function wcDynamic(f: FamilyConfig): string {
  return formatCode(`
<${f.tagName} id="deploy-region">Release v2.4.1 queued for production deploy</${f.tagName}>

<script type="module">
  import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
  import { ${f.exportName} } from '${f.pkg}';

  AdaptToWebComponent(${f.exportName});

  const region = document.querySelector('#deploy-region');
  // Toggle politeness and atomic without replacing authored descendants.
  setElementProps(region, { politeness: 'assertive', atomic: false });
</script>
  `);
}

function wcFeedback(f: FamilyConfig): string {
  return formatCode(`
<${f.tagName} id="save-status">All changes saved</${f.tagName}>
<${f.tagName} id="form-error">No validation errors</${f.tagName}>

<script type="module">
  import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
  import { ${f.exportName} } from '${f.pkg}';

  AdaptToWebComponent(${f.exportName});

  const saveStatus = document.querySelector('#save-status');
  const formError = document.querySelector('#form-error');
  setElementProps(saveStatus, { politeness: 'polite', atomic: true });
  setElementProps(formError, { politeness: 'assertive', atomic: true });

  saveStatus.textContent = 'Draft saved (revision #2)';
  formError.textContent = 'Billing email is required before publishing changes.';
</script>
  `);
}

function wcSrOnly(f: FamilyConfig): string {
  return formatCode(`
<div class="sr-only">
  <${f.tagName} id="sr-announcer"></${f.tagName}>
</div>

<script type="module">
  import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
  import { ${f.exportName} } from '${f.pkg}';

  AdaptToWebComponent(${f.exportName});

  const announcer = document.querySelector('#sr-announcer');
  setElementProps(announcer, { politeness: 'polite', atomic: true });
  announcer.textContent = 'API key copied to clipboard';
</script>
  `);
}

function reactBasic(f: FamilyConfig): string {
  return formatCode(`
import { useState } from 'react';
import { AdaptToReact } from '@proto.ui/adapter-react';
import { ${f.exportName} } from '${f.pkg}';

const ${f.componentName} = AdaptToReact(${f.exportName});

export function LiveRegionDemo() {
  const [unread, setUnread] = useState(0);
  const [degraded, setDegraded] = useState(false);

  return (
    <div className="grid gap-4">
      <${f.componentName} politeness="polite" atomic>
        {unread === 0 ? 'No unread messages' : \`\${unread} unread message\${unread === 1 ? '' : 's'}\`}
      </${f.componentName}>
      <${f.componentName} politeness="assertive" atomic>
        {degraded ? 'API latency elevated — automatic retries active' : 'All systems operational'}
      </${f.componentName}>
      <div className="flex gap-2">
        <button type="button" onClick={() => setUnread((n) => n + 1)}>Check inbox</button>
        <button type="button" onClick={() => setDegraded((d) => !d)}>
          {degraded ? 'Resolve outage' : 'Simulate outage'}
        </button>
      </div>
    </div>
  );
}
  `);
}

function reactAtomic(f: FamilyConfig): string {
  return formatCode(`
import { useState } from 'react';
import { AdaptToReact } from '@proto.ui/adapter-react';
import { ${f.exportName} } from '${f.pkg}';

const ${f.componentName} = AdaptToReact(${f.exportName});
const steps = ['25% (1 of 4 files)', '50% (2 of 4 files)', '75% (3 of 4 files)', '100% (4 of 4 files)'];

export function AtomicComparisonDemo() {
  const [index, setIndex] = useState(0);

  return (
    <div className="grid gap-4">
      <${f.componentName} politeness="polite" atomic={true}>
        Upload progress: <span>{steps[index]}</span>
      </${f.componentName}>
      <${f.componentName} politeness="polite" atomic={false}>
        Upload progress: <span>{steps[index]}</span>
      </${f.componentName}>
      <button type="button" onClick={() => setIndex((i) => (i + 1) % steps.length)}>
        Advance upload
      </button>
    </div>
  );
}
  `);
}

function reactDynamic(f: FamilyConfig): string {
  return formatCode(`
import { useState } from 'react';
import { AdaptToReact } from '@proto.ui/adapter-react';
import { ${f.exportName} } from '${f.pkg}';

const ${f.componentName} = AdaptToReact(${f.exportName});

export function DynamicPolitenessDemo() {
  const [politeness, setPoliteness] = useState<'polite' | 'assertive'>('polite');
  const [atomic, setAtomic] = useState(true);

  return (
    <div className="grid gap-4">
      <${f.componentName} politeness={politeness} atomic={atomic}>
        Release v2.4.1 queued for production deploy
      </${f.componentName}>
      <div className="flex gap-2">
        <button type="button" onClick={() => setPoliteness((p) => (p === 'polite' ? 'assertive' : 'polite'))}>
          Switch politeness
        </button>
        <button type="button" onClick={() => setAtomic((a) => !a)}>
          Toggle atomic
        </button>
      </div>
    </div>
  );
}
  `);
}

function reactFeedback(f: FamilyConfig): string {
  return formatCode(`
import { useState } from 'react';
import { AdaptToReact } from '@proto.ui/adapter-react';
import { ${f.exportName} } from '${f.pkg}';

const ${f.componentName} = AdaptToReact(${f.exportName});

export function FormFeedbackDemo() {
  const [status, setStatus] = useState('All changes saved');
  const [error, setError] = useState('No validation errors');

  return (
    <div className="grid gap-4">
      <${f.componentName} politeness="polite">{status}</${f.componentName}>
      <${f.componentName} politeness="assertive">{error}</${f.componentName}>
      <div className="flex gap-2">
        <button type="button" onClick={() => { setStatus('Draft saved (revision #2)'); setError('No validation errors'); }}>
          Save draft
        </button>
        <button type="button" onClick={() => setError('Billing email is required before publishing changes.')}>
          Trigger validation error
        </button>
      </div>
    </div>
  );
}
  `);
}

function reactSrOnly(f: FamilyConfig): string {
  return formatCode(`
import { useState } from 'react';
import { AdaptToReact } from '@proto.ui/adapter-react';
import { ${f.exportName} } from '${f.pkg}';

const ${f.componentName} = AdaptToReact(${f.exportName});

export function VisuallyHiddenAnnouncementDemo() {
  const [announcement, setAnnouncement] = useState('');

  return (
    <div className="grid gap-3">
      <button type="button" onClick={() => setAnnouncement('API key copied to clipboard')}>
        Copy API key
      </button>
      <div className="sr-only">
        <${f.componentName} politeness="polite" atomic>
          {announcement}
        </${f.componentName}>
      </div>
    </div>
  );
}
  `);
}

function vueBasic(f: FamilyConfig): string {
  return formatCode(`
<template>
  <div class="grid gap-4">
    <${f.componentName} politeness="polite" :atomic="true">
      {{ unread === 0 ? 'No unread messages' : \`\${unread} unread message\${unread === 1 ? '' : 's'}\` }}
    </${f.componentName}>
    <${f.componentName} politeness="assertive" :atomic="true">
      {{ degraded ? 'API latency elevated — automatic retries active' : 'All systems operational' }}
    </${f.componentName}>
    <div class="flex gap-2">
      <button type="button" @click="unread += 1">Check inbox</button>
      <button type="button" @click="degraded = !degraded">
        {{ degraded ? 'Resolve outage' : 'Simulate outage' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { AdaptToVue } from '@proto.ui/adapter-vue';
import { ${f.exportName} } from '${f.pkg}';

const ${f.componentName} = AdaptToVue(${f.exportName});
const unread = ref(0);
const degraded = ref(false);
</script>
  `);
}

function vueAtomic(f: FamilyConfig): string {
  return formatCode(`
<template>
  <div class="grid gap-4">
    <${f.componentName} politeness="polite" :atomic="true">
      Upload progress: <span>{{ steps[index] }}</span>
    </${f.componentName}>
    <${f.componentName} politeness="polite" :atomic="false">
      Upload progress: <span>{{ steps[index] }}</span>
    </${f.componentName}>
    <button type="button" @click="index = (index + 1) % steps.length">Advance upload</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { AdaptToVue } from '@proto.ui/adapter-vue';
import { ${f.exportName} } from '${f.pkg}';

const ${f.componentName} = AdaptToVue(${f.exportName});
const steps = ['25% (1 of 4 files)', '50% (2 of 4 files)', '75% (3 of 4 files)', '100% (4 of 4 files)'];
const index = ref(0);
</script>
  `);
}

function vueDynamic(f: FamilyConfig): string {
  return formatCode(`
<template>
  <div class="grid gap-4">
    <${f.componentName} :politeness="politeness" :atomic="atomic">
      Release v2.4.1 queued for production deploy
    </${f.componentName}>
    <div class="flex gap-2">
      <button type="button" @click="politeness = politeness === 'polite' ? 'assertive' : 'polite'">
        Switch politeness
      </button>
      <button type="button" @click="atomic = !atomic">Toggle atomic</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { AdaptToVue } from '@proto.ui/adapter-vue';
import { ${f.exportName} } from '${f.pkg}';

const ${f.componentName} = AdaptToVue(${f.exportName});
const politeness = ref<'polite' | 'assertive'>('polite');
const atomic = ref(true);
</script>
  `);
}

function vueFeedback(f: FamilyConfig): string {
  return formatCode(`
<template>
  <div class="grid gap-4">
    <${f.componentName} politeness="polite">{{ status }}</${f.componentName}>
    <${f.componentName} politeness="assertive">{{ error }}</${f.componentName}>
    <div class="flex gap-2">
      <button type="button" @click="save">Save draft</button>
      <button type="button" @click="error = 'Billing email is required before publishing changes.'">
        Trigger validation error
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { AdaptToVue } from '@proto.ui/adapter-vue';
import { ${f.exportName} } from '${f.pkg}';

const ${f.componentName} = AdaptToVue(${f.exportName});
const status = ref('All changes saved');
const error = ref('No validation errors');

function save() {
  status.value = 'Draft saved (revision #2)';
  error.value = 'No validation errors';
}
</script>
  `);
}

function vueSrOnly(f: FamilyConfig): string {
  return formatCode(`
<template>
  <div class="grid gap-3">
    <button type="button" @click="announcement = 'API key copied to clipboard'">
      Copy API key
    </button>
    <div class="sr-only">
      <${f.componentName} politeness="polite" :atomic="true">{{ announcement }}</${f.componentName}>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { AdaptToVue } from '@proto.ui/adapter-vue';
import { ${f.exportName} } from '${f.pkg}';

const ${f.componentName} = AdaptToVue(${f.exportName});
const announcement = ref('');
</script>
  `);
}

function vue2Wrap(f: FamilyConfig, templateBody: string, dataBody: string): string {
  return formatCode(`
<template>
${templateBody}
</template>

<script>
import Vue from 'vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { ${f.exportName} } from '${f.pkg}';

const adapt = createVue2Adapter({
  extend: Vue.extend.bind(Vue),
  nextTick: Vue.nextTick.bind(Vue),
  set: Vue.set.bind(Vue),
  delete: Vue.delete.bind(Vue),
});
const ${f.componentName} = adapt(${f.exportName});

export default {
  components: { ${f.componentName} },
  data() {
    return ${dataBody};
  },
};
</script>
  `);
}

function vue2Basic(f: FamilyConfig): string {
  return vue2Wrap(
    f,
    `  <div class="grid gap-4">
    <${f.componentName} politeness="polite" :atomic="true">{{ status }}</${f.componentName}>
    <${f.componentName} politeness="assertive" :atomic="true">{{ alert }}</${f.componentName}>
    <button type="button" @click="status = '1 unread message'">Check inbox</button>
  </div>`,
    `{
      status: 'No unread messages',
      alert: 'All systems operational',
    }`
  );
}

function vue2Atomic(f: FamilyConfig): string {
  return vue2Wrap(
    f,
    `  <div class="grid gap-4">
    <${f.componentName} politeness="polite" :atomic="true">
      Upload progress: <span>{{ progress }}</span>
    </${f.componentName}>
    <${f.componentName} politeness="polite" :atomic="false">
      Upload progress: <span>{{ progress }}</span>
    </${f.componentName}>
    <button type="button" @click="progress = '50% (2 of 4 files)'">Advance upload</button>
  </div>`,
    `{
      progress: '25% (1 of 4 files)',
    }`
  );
}

function vue2Dynamic(f: FamilyConfig): string {
  return vue2Wrap(
    f,
    `  <div class="grid gap-4">
    <${f.componentName} :politeness="politeness" :atomic="atomic">
      Release v2.4.1 queued for production deploy
    </${f.componentName}>
    <button type="button" @click="politeness = politeness === 'polite' ? 'assertive' : 'polite'">
      Switch politeness
    </button>
  </div>`,
    `{
      politeness: 'polite',
      atomic: true,
    }`
  );
}

function vue2Feedback(f: FamilyConfig): string {
  return vue2Wrap(
    f,
    `  <div class="grid gap-4">
    <${f.componentName} politeness="polite">{{ status }}</${f.componentName}>
    <${f.componentName} politeness="assertive">{{ error }}</${f.componentName}>
    <button type="button" @click="error = 'Billing email is required before publishing changes.'">
      Trigger validation error
    </button>
  </div>`,
    `{
      status: 'All changes saved',
      error: 'No validation errors',
    }`
  );
}

function vue2SrOnly(f: FamilyConfig): string {
  return vue2Wrap(
    f,
    `  <div class="grid gap-3">
    <button type="button" @click="announcement = 'API key copied to clipboard'">
      Copy API key
    </button>
    <div class="sr-only">
      <${f.componentName} politeness="polite" :atomic="true">{{ announcement }}</${f.componentName}>
    </div>
  </div>`,
    `{
      announcement: '',
    }`
  );
}

const wc: Record<string, string> = {};
const react: Record<string, string> = {};
const vue: Record<string, string> = {};
const vue2: Record<string, string> = {};

for (const family of FAMILIES) {
  const baseId = `demo-${family.id}-live-region`;
  wc[baseId] = wcBasic(family);
  wc[`${baseId}-atomic`] = wcAtomic(family);
  wc[`${baseId}-dynamic`] = wcDynamic(family);
  wc[`${baseId}-feedback`] = wcFeedback(family);
  wc[`${baseId}-sr-only`] = wcSrOnly(family);

  react[baseId] = reactBasic(family);
  react[`${baseId}-atomic`] = reactAtomic(family);
  react[`${baseId}-dynamic`] = reactDynamic(family);
  react[`${baseId}-feedback`] = reactFeedback(family);
  react[`${baseId}-sr-only`] = reactSrOnly(family);

  vue[baseId] = vueBasic(family);
  vue[`${baseId}-atomic`] = vueAtomic(family);
  vue[`${baseId}-dynamic`] = vueDynamic(family);
  vue[`${baseId}-feedback`] = vueFeedback(family);
  vue[`${baseId}-sr-only`] = vueSrOnly(family);

  vue2[baseId] = vue2Basic(family);
  vue2[`${baseId}-atomic`] = vue2Atomic(family);
  vue2[`${baseId}-dynamic`] = vue2Dynamic(family);
  vue2[`${baseId}-feedback`] = vue2Feedback(family);
  vue2[`${baseId}-sr-only`] = vue2SrOnly(family);
}

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc,
  react,
  vue,
  vue2,
};
