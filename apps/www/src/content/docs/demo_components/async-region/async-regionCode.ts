import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

interface FamilySnippetConfig {
  readonly pkg: string;
  readonly tagPrefix: string;
  readonly componentPrefix: string;
  readonly styleProfileAttrWc: string;
  readonly styleProfileAttrJsx: string;
  readonly primaryVariantAttr: string;
  readonly secondaryVariantAttr: string;
}

const FAMILIES: Record<
  'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass',
  FamilySnippetConfig
> = {
  shadcn: {
    pkg: '@proto.ui/prototypes-shadcn',
    tagPrefix: 'shadcn',
    componentPrefix: 'Shadcn',
    styleProfileAttrWc: ' style-profile="rhea"',
    styleProfileAttrJsx: ' styleProfile="rhea"',
    primaryVariantAttr: ' size="sm"',
    secondaryVariantAttr: ' variant="outline" size="sm"',
  },
  brutalist: {
    pkg: '@proto.ui/prototypes-brutalist',
    tagPrefix: 'brutalist',
    componentPrefix: 'Brutalist',
    styleProfileAttrWc: '',
    styleProfileAttrJsx: '',
    primaryVariantAttr: '',
    secondaryVariantAttr: '',
  },
  'bootstrap-2-3-2': {
    pkg: '@proto.ui/prototypes-bootstrap-2-3-2',
    tagPrefix: 'bootstrap-2-3-2',
    componentPrefix: 'Bootstrap',
    styleProfileAttrWc: '',
    styleProfileAttrJsx: '',
    primaryVariantAttr: ' variant="primary"',
    secondaryVariantAttr: ' variant="default"',
  },
  'liquid-glass': {
    pkg: '@proto.ui/prototypes-liquid-glass',
    tagPrefix: 'liquid-glass',
    componentPrefix: 'LiquidGlass',
    styleProfileAttrWc: '',
    styleProfileAttrJsx: '',
    primaryVariantAttr: ' variant="prominent"',
    secondaryVariantAttr: ' variant="regular"',
  },
};

function heroWc(f: FamilySnippetConfig): string {
  return formatCode(`
<${f.tagPrefix}-async-region-root id="activity-region">
  <p>Production deployment v2.4.1 completed cleanly.</p>
</${f.tagPrefix}-async-region-root>

<${f.tagPrefix}-button id="refresh-btn"${f.styleProfileAttrWc}${f.primaryVariantAttr}>Refresh Activity</${f.tagPrefix}-button>
<${f.tagPrefix}-button id="done-btn"${f.styleProfileAttrWc}${f.secondaryVariantAttr}>Finish Refresh</${f.tagPrefix}-button>

<script type="module">
  import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
  import { asyncRegionRoot } from '${f.pkg}/async-region';
  import button from '${f.pkg}/button';

  AdaptToWebComponent(asyncRegionRoot);
  AdaptToWebComponent(button);

  const region = document.querySelector('#activity-region');
  document.querySelector('#refresh-btn')?.addEventListener('click', () => {
    setElementProps(region, { busy: true });
  });
  document.querySelector('#done-btn')?.addEventListener('click', () => {
    setElementProps(region, { busy: false });
  });
</script>
  `);
}

function heroReact(f: FamilySnippetConfig): string {
  return formatCode(`
import { useState } from 'react';
import { AdaptToReact } from '@proto.ui/adapter-react';
import { asyncRegionRoot } from '${f.pkg}/async-region';
import button from '${f.pkg}/button';

const ${f.componentPrefix}AsyncRegionRoot = AdaptToReact(asyncRegionRoot);
const ${f.componentPrefix}Button = AdaptToReact(button);

export function AsyncRegionDemo() {
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid gap-4">
      <${f.componentPrefix}AsyncRegionRoot busy={busy}>
        <p>Production deployment v2.4.1 completed cleanly.</p>
      </${f.componentPrefix}AsyncRegionRoot>
      <div className="flex gap-2">
        <${f.componentPrefix}Button${f.styleProfileAttrJsx}${f.primaryVariantAttr} onClick={() => setBusy(true)}>
          Refresh Activity
        </${f.componentPrefix}Button>
        <${f.componentPrefix}Button${f.styleProfileAttrJsx}${f.secondaryVariantAttr} onClick={() => setBusy(false)}>
          Finish Refresh
        </${f.componentPrefix}Button>
      </div>
    </div>
  );
}
  `);
}

function heroVue(f: FamilySnippetConfig): string {
  return formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import { AdaptToVue } from '@proto.ui/adapter-vue';
import { asyncRegionRoot } from '${f.pkg}/async-region';
import button from '${f.pkg}/button';

const ${f.componentPrefix}AsyncRegionRoot = AdaptToVue(asyncRegionRoot);
const ${f.componentPrefix}Button = AdaptToVue(button);
const busy = ref(false);
</script>

<template>
  <div class="grid gap-4">
    <${f.componentPrefix}AsyncRegionRoot :busy="busy">
      <p>Production deployment v2.4.1 completed cleanly.</p>
    </${f.componentPrefix}AsyncRegionRoot>
    <div class="flex gap-2">
      <${f.componentPrefix}Button${f.styleProfileAttrJsx}${f.primaryVariantAttr} @click="busy = true">Refresh Activity</${f.componentPrefix}Button>
      <${f.componentPrefix}Button${f.styleProfileAttrJsx}${f.secondaryVariantAttr} @click="busy = false">Finish Refresh</${f.componentPrefix}Button>
    </div>
  </div>
</template>
  `);
}

function heroVue2(f: FamilySnippetConfig): string {
  return formatCode(`
<template>
  <div class="grid gap-4">
    <${f.componentPrefix}AsyncRegionRoot :busy="busy">
      <p>Production deployment v2.4.1 completed cleanly.</p>
    </${f.componentPrefix}AsyncRegionRoot>
    <div class="flex gap-2">
      <${f.componentPrefix}Button${f.styleProfileAttrJsx}${f.primaryVariantAttr} @click="busy = true">Refresh Activity</${f.componentPrefix}Button>
      <${f.componentPrefix}Button${f.styleProfileAttrJsx}${f.secondaryVariantAttr} @click="busy = false">Finish Refresh</${f.componentPrefix}Button>
    </div>
  </div>
</template>

<script>
import Vue from 'vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { asyncRegionRoot } from '${f.pkg}/async-region';
import button from '${f.pkg}/button';

const adapt = createVue2Adapter({
  extend: Vue.extend.bind(Vue),
  nextTick: Vue.nextTick.bind(Vue),
  set: Vue.set.bind(Vue),
  delete: Vue.delete.bind(Vue),
});

export default {
  components: {
    ${f.componentPrefix}AsyncRegionRoot: adapt(asyncRegionRoot),
    ${f.componentPrefix}Button: adapt(button),
  },
  data() {
    return { busy: false };
  },
};
</script>
  `);
}

function focusWc(f: FamilySnippetConfig): string {
  return formatCode(`
<${f.tagPrefix}-async-region-root id="draft-region">
  <${f.tagPrefix}-input-root${f.styleProfileAttrWc} default-value="Looks good — ready to ship." aria-label="Draft reply"></${f.tagPrefix}-input-root>
</${f.tagPrefix}-async-region-root>

<${f.tagPrefix}-button id="toggle-refresh"${f.styleProfileAttrWc}${f.primaryVariantAttr}>Toggle Refresh</${f.tagPrefix}-button>

<script type="module">
  import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
  import { asyncRegionRoot } from '${f.pkg}/async-region';
  import inputRoot from '${f.pkg}/input';
  import button from '${f.pkg}/button';

  AdaptToWebComponent(asyncRegionRoot);
  AdaptToWebComponent(inputRoot);
  AdaptToWebComponent(button);

  const region = document.querySelector('#draft-region');
  let busy = false;
  document.querySelector('#toggle-refresh')?.addEventListener('click', () => {
    busy = !busy;
    setElementProps(region, { busy });
  });
</script>
  `);
}

function focusReact(f: FamilySnippetConfig): string {
  return formatCode(`
import { useState } from 'react';
import { AdaptToReact } from '@proto.ui/adapter-react';
import { asyncRegionRoot } from '${f.pkg}/async-region';
import inputRoot from '${f.pkg}/input';
import button from '${f.pkg}/button';

const ${f.componentPrefix}AsyncRegionRoot = AdaptToReact(asyncRegionRoot);
const ${f.componentPrefix}InputRoot = AdaptToReact(inputRoot);
const ${f.componentPrefix}Button = AdaptToReact(button);

export function FocusPreservingRefresh() {
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid gap-4">
      <${f.componentPrefix}AsyncRegionRoot busy={busy}>
        <${f.componentPrefix}InputRoot${f.styleProfileAttrJsx}
          defaultValue="Looks good — ready to ship."
          ariaLabel="Draft reply"
        />
      </${f.componentPrefix}AsyncRegionRoot>
      <${f.componentPrefix}Button${f.styleProfileAttrJsx}${f.primaryVariantAttr} onClick={() => setBusy((prev) => !prev)}>
        Toggle Refresh
      </${f.componentPrefix}Button>
    </div>
  );
}
  `);
}

function focusVue(f: FamilySnippetConfig): string {
  return formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import { AdaptToVue } from '@proto.ui/adapter-vue';
import { asyncRegionRoot } from '${f.pkg}/async-region';
import inputRoot from '${f.pkg}/input';
import button from '${f.pkg}/button';

const ${f.componentPrefix}AsyncRegionRoot = AdaptToVue(asyncRegionRoot);
const ${f.componentPrefix}InputRoot = AdaptToVue(inputRoot);
const ${f.componentPrefix}Button = AdaptToVue(button);
const busy = ref(false);
</script>

<template>
  <div class="grid gap-4">
    <${f.componentPrefix}AsyncRegionRoot :busy="busy">
      <${f.componentPrefix}InputRoot${f.styleProfileAttrJsx} default-value="Looks good — ready to ship." aria-label="Draft reply" />
    </${f.componentPrefix}AsyncRegionRoot>
    <${f.componentPrefix}Button${f.styleProfileAttrJsx}${f.primaryVariantAttr} @click="busy = !busy">Toggle Refresh</${f.componentPrefix}Button>
  </div>
</template>
  `);
}

function focusVue2(f: FamilySnippetConfig): string {
  return formatCode(`
<template>
  <div class="grid gap-4">
    <${f.componentPrefix}AsyncRegionRoot :busy="busy">
      <${f.componentPrefix}InputRoot${f.styleProfileAttrJsx} default-value="Looks good — ready to ship." aria-label="Draft reply" />
    </${f.componentPrefix}AsyncRegionRoot>
    <${f.componentPrefix}Button${f.styleProfileAttrJsx}${f.primaryVariantAttr} @click="busy = !busy">Toggle Refresh</${f.componentPrefix}Button>
  </div>
</template>

<script>
import Vue from 'vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { asyncRegionRoot } from '${f.pkg}/async-region';
import inputRoot from '${f.pkg}/input';
import button from '${f.pkg}/button';

const adapt = createVue2Adapter({
  extend: Vue.extend.bind(Vue),
  nextTick: Vue.nextTick.bind(Vue),
  set: Vue.set.bind(Vue),
  delete: Vue.delete.bind(Vue),
});

export default {
  components: {
    ${f.componentPrefix}AsyncRegionRoot: adapt(asyncRegionRoot),
    ${f.componentPrefix}InputRoot: adapt(inputRoot),
    ${f.componentPrefix}Button: adapt(button),
  },
  data() {
    return { busy: false };
  },
};
</script>
  `);
}

function liveRegionWc(f: FamilySnippetConfig): string {
  return formatCode(`
<${f.tagPrefix}-async-region-root id="metrics-region">
  <p id="metrics-value">$124,800 · +12.4% month over month</p>
</${f.tagPrefix}-async-region-root>

<${f.tagPrefix}-live-region-root id="metrics-status" politeness="polite" atomic>
  Status: Monthly revenue is up to date.
</${f.tagPrefix}-live-region-root>

<${f.tagPrefix}-button id="reload-metrics"${f.styleProfileAttrWc}${f.primaryVariantAttr}>Reload Metrics</${f.tagPrefix}-button>
<${f.tagPrefix}-button id="apply-metrics"${f.styleProfileAttrWc}${f.secondaryVariantAttr}>Apply Update</${f.tagPrefix}-button>

<script type="module">
  import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
  import { asyncRegionRoot } from '${f.pkg}/async-region';
  import { liveRegionRoot } from '${f.pkg}/live-region';
  import button from '${f.pkg}/button';

  AdaptToWebComponent(asyncRegionRoot);
  AdaptToWebComponent(liveRegionRoot);
  AdaptToWebComponent(button);

  const region = document.querySelector('#metrics-region');
  const status = document.querySelector('#metrics-status');
  document.querySelector('#reload-metrics')?.addEventListener('click', () => {
    setElementProps(region, { busy: true });
    status.textContent = 'Status: Refreshing monthly revenue metrics…';
  });
  document.querySelector('#apply-metrics')?.addEventListener('click', () => {
    setElementProps(region, { busy: false });
    status.textContent = 'Status: Monthly revenue updated.';
  });
</script>
  `);
}

function liveRegionReact(f: FamilySnippetConfig): string {
  return formatCode(`
import { useState } from 'react';
import { AdaptToReact } from '@proto.ui/adapter-react';
import { asyncRegionRoot } from '${f.pkg}/async-region';
import { liveRegionRoot } from '${f.pkg}/live-region';
import button from '${f.pkg}/button';

const ${f.componentPrefix}AsyncRegionRoot = AdaptToReact(asyncRegionRoot);
const ${f.componentPrefix}LiveRegionRoot = AdaptToReact(liveRegionRoot);
const ${f.componentPrefix}Button = AdaptToReact(button);

export function AsyncWithLiveRegion() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Status: Monthly revenue is up to date.');

  return (
    <div className="grid gap-4">
      <${f.componentPrefix}AsyncRegionRoot busy={busy}>
        <p>$124,800 · +12.4% month over month</p>
      </${f.componentPrefix}AsyncRegionRoot>
      <${f.componentPrefix}LiveRegionRoot politeness="polite" atomic>
        {status}
      </${f.componentPrefix}LiveRegionRoot>
      <div className="flex gap-2">
        <${f.componentPrefix}Button${f.styleProfileAttrJsx}${f.primaryVariantAttr} onClick={() => { setBusy(true); setStatus('Status: Refreshing monthly revenue metrics…'); }}>
          Reload Metrics
        </${f.componentPrefix}Button>
        <${f.componentPrefix}Button${f.styleProfileAttrJsx}${f.secondaryVariantAttr} onClick={() => { setBusy(false); setStatus('Status: Monthly revenue updated.'); }}>
          Apply Update
        </${f.componentPrefix}Button>
      </div>
    </div>
  );
}
  `);
}

function liveRegionVue(f: FamilySnippetConfig): string {
  return formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import { AdaptToVue } from '@proto.ui/adapter-vue';
import { asyncRegionRoot } from '${f.pkg}/async-region';
import { liveRegionRoot } from '${f.pkg}/live-region';
import button from '${f.pkg}/button';

const ${f.componentPrefix}AsyncRegionRoot = AdaptToVue(asyncRegionRoot);
const ${f.componentPrefix}LiveRegionRoot = AdaptToVue(liveRegionRoot);
const ${f.componentPrefix}Button = AdaptToVue(button);
const busy = ref(false);
const status = ref('Status: Monthly revenue is up to date.');
</script>

<template>
  <div class="grid gap-4">
    <${f.componentPrefix}AsyncRegionRoot :busy="busy">
      <p>$124,800 · +12.4% month over month</p>
    </${f.componentPrefix}AsyncRegionRoot>
    <${f.componentPrefix}LiveRegionRoot politeness="polite" :atomic="true">
      {{ status }}
    </${f.componentPrefix}LiveRegionRoot>
    <div class="flex gap-2">
      <${f.componentPrefix}Button${f.styleProfileAttrJsx}${f.primaryVariantAttr} @click="busy = true; status = 'Status: Refreshing monthly revenue metrics…'">Reload Metrics</${f.componentPrefix}Button>
      <${f.componentPrefix}Button${f.styleProfileAttrJsx}${f.secondaryVariantAttr} @click="busy = false; status = 'Status: Monthly revenue updated.'">Apply Update</${f.componentPrefix}Button>
    </div>
  </div>
</template>
  `);
}

function liveRegionVue2(f: FamilySnippetConfig): string {
  return formatCode(`
<template>
  <div class="grid gap-4">
    <${f.componentPrefix}AsyncRegionRoot :busy="busy">
      <p>$124,800 · +12.4% month over month</p>
    </${f.componentPrefix}AsyncRegionRoot>
    <${f.componentPrefix}LiveRegionRoot politeness="polite" :atomic="true">
      {{ status }}
    </${f.componentPrefix}LiveRegionRoot>
    <div class="flex gap-2">
      <${f.componentPrefix}Button${f.styleProfileAttrJsx}${f.primaryVariantAttr} @click="startReload">Reload Metrics</${f.componentPrefix}Button>
      <${f.componentPrefix}Button${f.styleProfileAttrJsx}${f.secondaryVariantAttr} @click="finishReload">Apply Update</${f.componentPrefix}Button>
    </div>
  </div>
</template>

<script>
import Vue from 'vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { asyncRegionRoot } from '${f.pkg}/async-region';
import { liveRegionRoot } from '${f.pkg}/live-region';
import button from '${f.pkg}/button';

const adapt = createVue2Adapter({
  extend: Vue.extend.bind(Vue),
  nextTick: Vue.nextTick.bind(Vue),
  set: Vue.set.bind(Vue),
  delete: Vue.delete.bind(Vue),
});

export default {
  components: {
    ${f.componentPrefix}AsyncRegionRoot: adapt(asyncRegionRoot),
    ${f.componentPrefix}LiveRegionRoot: adapt(liveRegionRoot),
    ${f.componentPrefix}Button: adapt(button),
  },
  data() {
    return { busy: false, status: 'Status: Monthly revenue is up to date.' };
  },
  methods: {
    startReload() {
      this.busy = true;
      this.status = 'Status: Refreshing monthly revenue metrics…';
    },
    finishReload() {
      this.busy = false;
      this.status = 'Status: Monthly revenue updated.';
    },
  },
};
</script>
  `);
}

const shadcnIndicatorWc = formatCode(`
<shadcn-async-region-root id="invoices-region">
  <p>INV-1042 · Annual Workspace Plan · $480.00</p>
  <shadcn-button style-profile="rhea" variant="outline" size="sm">Download Receipt</shadcn-button>
</shadcn-async-region-root>

<shadcn-button id="sync-btn" style-profile="rhea" size="sm">Sync Invoices</shadcn-button>
<shadcn-button id="complete-btn" style-profile="rhea" variant="outline" size="sm">Complete Sync</shadcn-button>

<script type="module">
  import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
  import { asyncRegionRoot } from '@proto.ui/prototypes-shadcn/async-region';
  import button from '@proto.ui/prototypes-shadcn/button';

  AdaptToWebComponent(asyncRegionRoot);
  AdaptToWebComponent(button);

  const region = document.querySelector('#invoices-region');
  const syncBtn = document.querySelector('#sync-btn');
  syncBtn?.addEventListener('click', () => {
    setElementProps(region, { busy: true });
    setElementProps(syncBtn, { disabled: true });
  });
  document.querySelector('#complete-btn')?.addEventListener('click', () => {
    setElementProps(region, { busy: false });
    setElementProps(syncBtn, { disabled: false });
  });
</script>
`);

const shadcnIndicatorReact = formatCode(`
import { useState } from 'react';
import { AdaptToReact } from '@proto.ui/adapter-react';
import { asyncRegionRoot } from '@proto.ui/prototypes-shadcn/async-region';
import button from '@proto.ui/prototypes-shadcn/button';

const ShadcnAsyncRegionRoot = AdaptToReact(asyncRegionRoot);
const ShadcnButton = AdaptToReact(button);

export function CustomIndicatorAndSelectiveDisable() {
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid gap-4">
      <ShadcnAsyncRegionRoot busy={busy}>
        <div className="grid gap-2">
          {busy && <span className="text-xs font-medium text-primary">Refreshing…</span>}
          <p className={busy ? 'opacity-60' : ''}>INV-1042 · Annual Workspace Plan · $480.00</p>
          <ShadcnButton styleProfile="rhea" variant="outline" size="sm">
            Download Receipt
          </ShadcnButton>
        </div>
      </ShadcnAsyncRegionRoot>
      <div className="flex gap-2">
        <ShadcnButton styleProfile="rhea" size="sm" disabled={busy} onClick={() => setBusy(true)}>
          Sync Invoices
        </ShadcnButton>
        <ShadcnButton styleProfile="rhea" variant="outline" size="sm" onClick={() => setBusy(false)}>
          Complete Sync
        </ShadcnButton>
      </div>
    </div>
  );
}
`);

const shadcnIndicatorVue = formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import { AdaptToVue } from '@proto.ui/adapter-vue';
import { asyncRegionRoot } from '@proto.ui/prototypes-shadcn/async-region';
import button from '@proto.ui/prototypes-shadcn/button';

const ShadcnAsyncRegionRoot = AdaptToVue(asyncRegionRoot);
const ShadcnButton = AdaptToVue(button);
const busy = ref(false);
</script>

<template>
  <div class="grid gap-4">
    <ShadcnAsyncRegionRoot :busy="busy">
      <div class="grid gap-2">
        <span v-if="busy" class="text-xs font-medium text-primary">Refreshing…</span>
        <p :class="{ 'opacity-60': busy }">INV-1042 · Annual Workspace Plan · $480.00</p>
        <ShadcnButton styleProfile="rhea" variant="outline" size="sm">Download Receipt</ShadcnButton>
      </div>
    </ShadcnAsyncRegionRoot>
    <div class="flex gap-2">
      <ShadcnButton styleProfile="rhea" size="sm" :disabled="busy" @click="busy = true">Sync Invoices</ShadcnButton>
      <ShadcnButton styleProfile="rhea" variant="outline" size="sm" @click="busy = false">Complete Sync</ShadcnButton>
    </div>
  </div>
</template>
`);

const shadcnIndicatorVue2 = formatCode(`
<template>
  <div class="grid gap-4">
    <ShadcnAsyncRegionRoot :busy="busy">
      <div class="grid gap-2">
        <span v-if="busy" class="text-xs font-medium text-primary">Refreshing…</span>
        <p :class="{ 'opacity-60': busy }">INV-1042 · Annual Workspace Plan · $480.00</p>
        <ShadcnButton styleProfile="rhea" variant="outline" size="sm">Download Receipt</ShadcnButton>
      </div>
    </ShadcnAsyncRegionRoot>
    <div class="flex gap-2">
      <ShadcnButton styleProfile="rhea" size="sm" :disabled="busy" @click="busy = true">Sync Invoices</ShadcnButton>
      <ShadcnButton styleProfile="rhea" variant="outline" size="sm" @click="busy = false">Complete Sync</ShadcnButton>
    </div>
  </div>
</template>

<script>
import Vue from 'vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { asyncRegionRoot } from '@proto.ui/prototypes-shadcn/async-region';
import button from '@proto.ui/prototypes-shadcn/button';

const adapt = createVue2Adapter({
  extend: Vue.extend.bind(Vue),
  nextTick: Vue.nextTick.bind(Vue),
  set: Vue.set.bind(Vue),
  delete: Vue.delete.bind(Vue),
});

export default {
  components: {
    ShadcnAsyncRegionRoot: adapt(asyncRegionRoot),
    ShadcnButton: adapt(button),
  },
  data() {
    return { busy: false };
  },
};
</script>
`);

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-async-region': heroWc(FAMILIES.shadcn),
    'demo-shadcn-async-region-focus': focusWc(FAMILIES.shadcn),
    'demo-shadcn-async-region-indicator': shadcnIndicatorWc,
    'demo-shadcn-async-region-live-region': liveRegionWc(FAMILIES.shadcn),
    'demo-brutalist-async-region': heroWc(FAMILIES.brutalist),
    'demo-brutalist-async-region-focus': focusWc(FAMILIES.brutalist),
    'demo-brutalist-async-region-live-region': liveRegionWc(FAMILIES.brutalist),
    'demo-bootstrap-2-3-2-async-region': heroWc(FAMILIES['bootstrap-2-3-2']),
    'demo-bootstrap-2-3-2-async-region-focus': focusWc(FAMILIES['bootstrap-2-3-2']),
    'demo-bootstrap-2-3-2-async-region-live-region': liveRegionWc(FAMILIES['bootstrap-2-3-2']),
    'demo-liquid-glass-async-region': heroWc(FAMILIES['liquid-glass']),
    'demo-liquid-glass-async-region-focus': focusWc(FAMILIES['liquid-glass']),
    'demo-liquid-glass-async-region-live-region': liveRegionWc(FAMILIES['liquid-glass']),
  },
  react: {
    'demo-shadcn-async-region': heroReact(FAMILIES.shadcn),
    'demo-shadcn-async-region-focus': focusReact(FAMILIES.shadcn),
    'demo-shadcn-async-region-indicator': shadcnIndicatorReact,
    'demo-shadcn-async-region-live-region': liveRegionReact(FAMILIES.shadcn),
    'demo-brutalist-async-region': heroReact(FAMILIES.brutalist),
    'demo-brutalist-async-region-focus': focusReact(FAMILIES.brutalist),
    'demo-brutalist-async-region-live-region': liveRegionReact(FAMILIES.brutalist),
    'demo-bootstrap-2-3-2-async-region': heroReact(FAMILIES['bootstrap-2-3-2']),
    'demo-bootstrap-2-3-2-async-region-focus': focusReact(FAMILIES['bootstrap-2-3-2']),
    'demo-bootstrap-2-3-2-async-region-live-region': liveRegionReact(FAMILIES['bootstrap-2-3-2']),
    'demo-liquid-glass-async-region': heroReact(FAMILIES['liquid-glass']),
    'demo-liquid-glass-async-region-focus': focusReact(FAMILIES['liquid-glass']),
    'demo-liquid-glass-async-region-live-region': liveRegionReact(FAMILIES['liquid-glass']),
  },
  vue: {
    'demo-shadcn-async-region': heroVue(FAMILIES.shadcn),
    'demo-shadcn-async-region-focus': focusVue(FAMILIES.shadcn),
    'demo-shadcn-async-region-indicator': shadcnIndicatorVue,
    'demo-shadcn-async-region-live-region': liveRegionVue(FAMILIES.shadcn),
    'demo-brutalist-async-region': heroVue(FAMILIES.brutalist),
    'demo-brutalist-async-region-focus': focusVue(FAMILIES.brutalist),
    'demo-brutalist-async-region-live-region': liveRegionVue(FAMILIES.brutalist),
    'demo-bootstrap-2-3-2-async-region': heroVue(FAMILIES['bootstrap-2-3-2']),
    'demo-bootstrap-2-3-2-async-region-focus': focusVue(FAMILIES['bootstrap-2-3-2']),
    'demo-bootstrap-2-3-2-async-region-live-region': liveRegionVue(FAMILIES['bootstrap-2-3-2']),
    'demo-liquid-glass-async-region': heroVue(FAMILIES['liquid-glass']),
    'demo-liquid-glass-async-region-focus': focusVue(FAMILIES['liquid-glass']),
    'demo-liquid-glass-async-region-live-region': liveRegionVue(FAMILIES['liquid-glass']),
  },
  vue2: {
    'demo-shadcn-async-region': heroVue2(FAMILIES.shadcn),
    'demo-shadcn-async-region-focus': focusVue2(FAMILIES.shadcn),
    'demo-shadcn-async-region-indicator': shadcnIndicatorVue2,
    'demo-shadcn-async-region-live-region': liveRegionVue2(FAMILIES.shadcn),
    'demo-brutalist-async-region': heroVue2(FAMILIES.brutalist),
    'demo-brutalist-async-region-focus': focusVue2(FAMILIES.brutalist),
    'demo-brutalist-async-region-live-region': liveRegionVue2(FAMILIES.brutalist),
    'demo-bootstrap-2-3-2-async-region': heroVue2(FAMILIES['bootstrap-2-3-2']),
    'demo-bootstrap-2-3-2-async-region-focus': focusVue2(FAMILIES['bootstrap-2-3-2']),
    'demo-bootstrap-2-3-2-async-region-live-region': liveRegionVue2(FAMILIES['bootstrap-2-3-2']),
    'demo-liquid-glass-async-region': heroVue2(FAMILIES['liquid-glass']),
    'demo-liquid-glass-async-region-focus': focusVue2(FAMILIES['liquid-glass']),
    'demo-liquid-glass-async-region-live-region': liveRegionVue2(FAMILIES['liquid-glass']),
  },
};
