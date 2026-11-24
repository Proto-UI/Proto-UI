import { formatCode } from '@/utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

type FamilyCodeConfig = Readonly<{
  prefix: string;
  wcTag: string;
  wcButtonTag: string;
  componentName: string;
  buttonName: string;
  packageName: string;
  cardClass: string;
  transitionClass: string;
  wrapShadcnRhea?: boolean;
}>;

const FAMILIES: Record<
  'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass',
  FamilyCodeConfig
> = {
  shadcn: {
    prefix: 'demo-shadcn-transition',
    wcTag: 'wc-shadcn-transition',
    wcButtonTag: 'wc-shadcn-button',
    componentName: 'ShadcnTransition',
    buttonName: 'ShadcnButton',
    packageName: '@proto.ui/prototypes-shadcn/transition',
    cardClass: 'rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm',
    transitionClass: 'block transition-opacity duration-300 ease-out motion-reduce:transition-none',
    wrapShadcnRhea: true,
  },
  brutalist: {
    prefix: 'demo-brutalist-transition',
    wcTag: 'wc-brutalist-transition',
    wcButtonTag: 'wc-brutalist-button',
    componentName: 'BrutalistTransition',
    buttonName: 'BrutalistButton',
    packageName: '@proto.ui/prototypes-brutalist/transition',
    cardClass:
      'rounded-[5px] border-2 border-black bg-[#dcebfe] p-5 font-sans font-medium text-black shadow-[4px_4px_0_0_#000]',
    transitionClass:
      'block transition-opacity duration-150 ease-linear motion-reduce:transition-none',
  },
  'bootstrap-2-3-2': {
    prefix: 'demo-bootstrap-2-3-2-transition',
    wcTag: 'wc-bootstrap-2-3-2-transition',
    wcButtonTag: 'wc-bootstrap-2-3-2-button',
    componentName: 'BootstrapTransition',
    buttonName: 'BootstrapButton',
    packageName: '@proto.ui/prototypes-bootstrap-2-3-2/transition',
    cardClass: 'rounded-[4px] border border-[#bce8f1] bg-[#d9edf7] px-4 py-3.5 text-[#3a87ad]',
    transitionClass:
      'block transition-opacity duration-150 ease-linear motion-reduce:transition-none',
  },
  'liquid-glass': {
    prefix: 'demo-liquid-glass-transition',
    wcTag: 'wc-liquid-glass-transition',
    wcButtonTag: 'wc-liquid-glass-button',
    componentName: 'LiquidGlassTransition',
    buttonName: 'LiquidGlassButton',
    packageName: '@proto.ui/prototypes-liquid-glass/transition',
    cardClass:
      'rounded-2xl border border-white/55 bg-white/70 p-4 text-foreground shadow-lg backdrop-blur-xl',
    transitionClass: 'block transition-opacity duration-300 ease-out motion-reduce:transition-none',
  },
};

function buildHeroSnippets(cfg: FamilyCodeConfig) {
  const wcBtnAttr = cfg.wrapShadcnRhea ? ' style-profile="rhea"' : '';
  const reactBtnAttr = cfg.wrapShadcnRhea ? ' styleProfile="rhea"' : '';
  const vueBtnAttr = cfg.wrapShadcnRhea ? ' style-profile="rhea"' : '';

  const wcBody = `
<${cfg.wcTag} id="release-banner" default-open appear class="${cfg.transitionClass}">
  <div class="${cfg.cardClass}">
    <strong>Workspace synced</strong>
    <p>Your project tokens and preview artifacts are up to date.</p>
  </div>
</${cfg.wcTag}>

<div class="flex gap-2">
  <${cfg.wcButtonTag}${wcBtnAttr} id="enter-btn">Enter</${cfg.wcButtonTag}>
  <${cfg.wcButtonTag}${wcBtnAttr} id="leave-btn">Leave</${cfg.wcButtonTag}>
  <${cfg.wcButtonTag}${wcBtnAttr} id="complete-btn">Complete</${cfg.wcButtonTag}>
</div>

<script type="module">
  const el = document.querySelector('#release-banner');
  document.querySelector('#enter-btn')?.addEventListener('click', () => el?.getExposes().controls.enter());
  document.querySelector('#leave-btn')?.addEventListener('click', () => el?.getExposes().controls.leave());
  document.querySelector('#complete-btn')?.addEventListener('click', () => el?.getExposes().controls.complete());
</script>`.trim();

  const wc = cfg.wrapShadcnRhea
    ? formatCode(
        `<wc-shadcn-style-scope style-profile="rhea" class="contents">\n${wcBody}\n</wc-shadcn-style-scope>`
      )
    : formatCode(wcBody);

  const react = formatCode(`
import { useRef } from 'react';
import { ${cfg.componentName}, ${cfg.buttonName}${cfg.wrapShadcnRhea ? ', ShadcnStyleScope' : ''} } from '../proto-ui/components/react';

export function TransitionDemo() {
  const ref = useRef<any>(null);

  return (
    ${cfg.wrapShadcnRhea ? '<ShadcnStyleScope styleProfile="rhea" className="contents">' : ''}
    <div className="flex flex-col items-center gap-4">
      <${cfg.componentName} ref={ref} defaultOpen appear className="${cfg.transitionClass}">
        <div className="${cfg.cardClass}">
          <strong>Workspace synced</strong>
          <p>Your project tokens and preview artifacts are up to date.</p>
        </div>
      </${cfg.componentName}>
      <div className="flex gap-2">
        <${cfg.buttonName}${reactBtnAttr} onClick={() => ref.current?.controls.enter()}>Enter</${cfg.buttonName}>
        <${cfg.buttonName}${reactBtnAttr} onClick={() => ref.current?.controls.leave()}>Leave</${cfg.buttonName}>
        <${cfg.buttonName}${reactBtnAttr} onClick={() => ref.current?.controls.complete()}>Complete</${cfg.buttonName}>
      </div>
    </div>
    ${cfg.wrapShadcnRhea ? '</ShadcnStyleScope>' : ''}
  );
}
  `);

  const vue = formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import { ${cfg.componentName}, ${cfg.buttonName}${cfg.wrapShadcnRhea ? ', ShadcnStyleScope' : ''} } from '../proto-ui/components/vue';

const transitionRef = ref<any>(null);
</script>

<template>
  ${cfg.wrapShadcnRhea ? '<ShadcnStyleScope style-profile="rhea" class="contents">' : ''}
  <div class="flex flex-col items-center gap-4">
    <${cfg.componentName} ref="transitionRef" default-open appear class="${cfg.transitionClass}">
      <div class="${cfg.cardClass}">
        <strong>Workspace synced</strong>
        <p>Your project tokens and preview artifacts are up to date.</p>
      </div>
    </${cfg.componentName}>
    <div class="flex gap-2">
      <${cfg.buttonName}${vueBtnAttr} @click="transitionRef?.controls.enter()">Enter</${cfg.buttonName}>
      <${cfg.buttonName}${vueBtnAttr} @click="transitionRef?.controls.leave()">Leave</${cfg.buttonName}>
      <${cfg.buttonName}${vueBtnAttr} @click="transitionRef?.controls.complete()">Complete</${cfg.buttonName}>
    </div>
  </div>
  ${cfg.wrapShadcnRhea ? '</ShadcnStyleScope>' : ''}
</template>
  `);

  const vue2 = formatCode(`
<template>
  ${cfg.wrapShadcnRhea ? '<ShadcnStyleScope style-profile="rhea" class="contents">' : ''}
  <div class="flex flex-col items-center gap-4">
    <${cfg.componentName} ref="transition" default-open appear class="${cfg.transitionClass}">
      <div class="${cfg.cardClass}">
        <strong>Workspace synced</strong>
        <p>Your project tokens and preview artifacts are up to date.</p>
      </div>
    </${cfg.componentName}>
    <div class="flex gap-2">
      <${cfg.buttonName}${vueBtnAttr} @click="enter">Enter</${cfg.buttonName}>
      <${cfg.buttonName}${vueBtnAttr} @click="leave">Leave</${cfg.buttonName}>
      <${cfg.buttonName}${vueBtnAttr} @click="complete">Complete</${cfg.buttonName}>
    </div>
  </div>
  ${cfg.wrapShadcnRhea ? '</ShadcnStyleScope>' : ''}
</template>

<script>
import { ${cfg.componentName}, ${cfg.buttonName}${cfg.wrapShadcnRhea ? ', ShadcnStyleScope' : ''} } from '../proto-ui/components/vue2';

export default {
  components: { ${cfg.componentName}, ${cfg.buttonName}${cfg.wrapShadcnRhea ? ', ShadcnStyleScope' : ''} },
  methods: {
    enter() { this.$refs.transition.controls.enter(); },
    leave() { this.$refs.transition.controls.leave(); },
    complete() { this.$refs.transition.controls.complete(); },
  },
};
</script>
  `);

  return { wc, react, vue, vue2 };
}

function buildControlledSnippets(cfg: FamilyCodeConfig) {
  const wcBtnAttr = cfg.wrapShadcnRhea ? ' style-profile="rhea"' : '';
  const reactBtnAttr = cfg.wrapShadcnRhea ? ' styleProfile="rhea"' : '';
  const vueBtnAttr = cfg.wrapShadcnRhea ? ' style-profile="rhea"' : '';

  const wcBody = `
<${cfg.wcTag} id="controlled-banner" enter-duration="450" leave-duration="350" class="${cfg.transitionClass}">
  <div class="${cfg.cardClass}">Scheduled maintenance at 02:00 UTC.</div>
</${cfg.wcTag}>

<${cfg.wcButtonTag}${wcBtnAttr} id="toggle-btn">Toggle open</${cfg.wcButtonTag}>

<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';

  const el = document.querySelector('#controlled-banner');
  let open = false;

  document.querySelector('#toggle-btn')?.addEventListener('click', () => {
    open = !open;
    setElementProps(el, { open });
  });

  el?.addEventListener('transitionend', () => {
    el.getExposes().controls.complete();
  });
</script>`.trim();

  const wc = cfg.wrapShadcnRhea
    ? formatCode(
        `<wc-shadcn-style-scope style-profile="rhea" class="contents">\n${wcBody}\n</wc-shadcn-style-scope>`
      )
    : formatCode(wcBody);

  const react = formatCode(`
import { useRef, useState } from 'react';
import { ${cfg.componentName}, ${cfg.buttonName}${cfg.wrapShadcnRhea ? ', ShadcnStyleScope' : ''} } from '../proto-ui/components/react';

export function ControlledTransitionDemo() {
  const [open, setOpen] = useState(false);
  const ref = useRef<any>(null);

  return (
    ${cfg.wrapShadcnRhea ? '<ShadcnStyleScope styleProfile="rhea" className="contents">' : ''}
    <div className="flex flex-col items-center gap-4">
      <${cfg.componentName}
        ref={ref}
        open={open}
        enterDuration={450}
        leaveDuration={350}
        className="${cfg.transitionClass}"
        onTransitionEnd={() => ref.current?.controls.complete()}
      >
        <div className="${cfg.cardClass}">Scheduled maintenance at 02:00 UTC.</div>
      </${cfg.componentName}>
      <${cfg.buttonName}${reactBtnAttr} onClick={() => setOpen((value) => !value)}>
        Toggle open
      </${cfg.buttonName}>
    </div>
    ${cfg.wrapShadcnRhea ? '</ShadcnStyleScope>' : ''}
  );
}
  `);

  const vue = formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import { ${cfg.componentName}, ${cfg.buttonName}${cfg.wrapShadcnRhea ? ', ShadcnStyleScope' : ''} } from '../proto-ui/components/vue';

const open = ref(false);
const transitionRef = ref<any>(null);
</script>

<template>
  ${cfg.wrapShadcnRhea ? '<ShadcnStyleScope style-profile="rhea" class="contents">' : ''}
  <div class="flex flex-col items-center gap-4">
    <${cfg.componentName}
      ref="transitionRef"
      :open="open"
      :enter-duration="450"
      :leave-duration="350"
      class="${cfg.transitionClass}"
      @transitionend="transitionRef?.controls.complete()"
    >
      <div class="${cfg.cardClass}">Scheduled maintenance at 02:00 UTC.</div>
    </${cfg.componentName}>
    <${cfg.buttonName}${vueBtnAttr} @click="open = !open">Toggle open</${cfg.buttonName}>
  </div>
  ${cfg.wrapShadcnRhea ? '</ShadcnStyleScope>' : ''}
</template>
  `);

  const vue2 = formatCode(`
<template>
  ${cfg.wrapShadcnRhea ? '<ShadcnStyleScope style-profile="rhea" class="contents">' : ''}
  <div class="flex flex-col items-center gap-4">
    <${cfg.componentName}
      ref="transition"
      :open="open"
      :enter-duration="450"
      :leave-duration="350"
      class="${cfg.transitionClass}"
      @transitionend.native="onTransitionEnd"
    >
      <div class="${cfg.cardClass}">Scheduled maintenance at 02:00 UTC.</div>
    </${cfg.componentName}>
    <${cfg.buttonName}${vueBtnAttr} @click="open = !open">Toggle open</${cfg.buttonName}>
  </div>
  ${cfg.wrapShadcnRhea ? '</ShadcnStyleScope>' : ''}
</template>

<script>
import { ${cfg.componentName}, ${cfg.buttonName}${cfg.wrapShadcnRhea ? ', ShadcnStyleScope' : ''} } from '../proto-ui/components/vue2';

export default {
  components: { ${cfg.componentName}, ${cfg.buttonName}${cfg.wrapShadcnRhea ? ', ShadcnStyleScope' : ''} },
  data() {
    return { open: false };
  },
  methods: {
    onTransitionEnd() {
      this.$refs.transition.controls.complete();
    },
  },
};
</script>
  `);

  return { wc, react, vue, vue2 };
}

function buildInterruptSnippets(cfg: FamilyCodeConfig) {
  const wcBtnAttr = cfg.wrapShadcnRhea ? ' style-profile="rhea"' : '';
  const reactBtnAttr = cfg.wrapShadcnRhea ? ' styleProfile="rhea"' : '';
  const vueBtnAttr = cfg.wrapShadcnRhea ? ' style-profile="rhea"' : '';

  const wcBody = `
<${cfg.wcTag}
  id="interrupt-demo"
  default-open
  appear
  enter-duration="900"
  leave-duration="900"
  interrupt="reverse"
  class="${cfg.transitionClass}"
>
  <div class="${cfg.cardClass}">Compare reverse, wait, and immediate interruption policies.</div>
</${cfg.wcTag}>

<${cfg.wcButtonTag}${wcBtnAttr} id="set-wait">Switch to wait</${cfg.wcButtonTag}>`.trim();

  const wc = cfg.wrapShadcnRhea
    ? formatCode(
        `<wc-shadcn-style-scope style-profile="rhea" class="contents">\n${wcBody}\n</wc-shadcn-style-scope>`
      )
    : formatCode(wcBody);

  const react = formatCode(`
import { useState } from 'react';
import { ${cfg.componentName}, ${cfg.buttonName}${cfg.wrapShadcnRhea ? ', ShadcnStyleScope' : ''} } from '../proto-ui/components/react';

export function InterruptPolicyDemo() {
  const [interrupt, setInterrupt] = useState<'reverse' | 'wait' | 'immediate'>('reverse');
  const [open, setOpen] = useState(true);

  return (
    ${cfg.wrapShadcnRhea ? '<ShadcnStyleScope styleProfile="rhea" className="contents">' : ''}
    <div className="flex flex-col items-center gap-4">
      <${cfg.componentName}
        open={open}
        appear
        enterDuration={900}
        leaveDuration={900}
        interrupt={interrupt}
        className="${cfg.transitionClass}"
      >
        <div className="${cfg.cardClass}">Active policy: {interrupt}</div>
      </${cfg.componentName}>
      <div className="flex gap-2">
        <${cfg.buttonName}${reactBtnAttr} onClick={() => setInterrupt('reverse')}>Reverse</${cfg.buttonName}>
        <${cfg.buttonName}${reactBtnAttr} onClick={() => setInterrupt('wait')}>Wait</${cfg.buttonName}>
        <${cfg.buttonName}${reactBtnAttr} onClick={() => setInterrupt('immediate')}>Immediate</${cfg.buttonName}>
        <${cfg.buttonName}${reactBtnAttr} onClick={() => setOpen((v) => !v)}>Toggle</${cfg.buttonName}>
      </div>
    </div>
    ${cfg.wrapShadcnRhea ? '</ShadcnStyleScope>' : ''}
  );
}
  `);

  const vue = formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import { ${cfg.componentName}, ${cfg.buttonName}${cfg.wrapShadcnRhea ? ', ShadcnStyleScope' : ''} } from '../proto-ui/components/vue';

const interrupt = ref<'reverse' | 'wait' | 'immediate'>('reverse');
const open = ref(true);
</script>

<template>
  ${cfg.wrapShadcnRhea ? '<ShadcnStyleScope style-profile="rhea" class="contents">' : ''}
  <div class="flex flex-col items-center gap-4">
    <${cfg.componentName}
      :open="open"
      appear
      :enter-duration="900"
      :leave-duration="900"
      :interrupt="interrupt"
      class="${cfg.transitionClass}"
    >
      <div class="${cfg.cardClass}">Active policy: {{ interrupt }}</div>
    </${cfg.componentName}>
    <div class="flex gap-2">
      <${cfg.buttonName}${vueBtnAttr} @click="interrupt = 'reverse'">Reverse</${cfg.buttonName}>
      <${cfg.buttonName}${vueBtnAttr} @click="interrupt = 'wait'">Wait</${cfg.buttonName}>
      <${cfg.buttonName}${vueBtnAttr} @click="interrupt = 'immediate'">Immediate</${cfg.buttonName}>
      <${cfg.buttonName}${vueBtnAttr} @click="open = !open">Toggle</${cfg.buttonName}>
    </div>
  </div>
  ${cfg.wrapShadcnRhea ? '</ShadcnStyleScope>' : ''}
</template>
  `);

  const vue2 = formatCode(`
<template>
  ${cfg.wrapShadcnRhea ? '<ShadcnStyleScope style-profile="rhea" class="contents">' : ''}
  <div class="flex flex-col items-center gap-4">
    <${cfg.componentName}
      :open="open"
      appear
      :enter-duration="900"
      :leave-duration="900"
      :interrupt="interrupt"
      class="${cfg.transitionClass}"
    >
      <div class="${cfg.cardClass}">Active policy: {{ interrupt }}</div>
    </${cfg.componentName}>
    <div class="flex gap-2">
      <${cfg.buttonName}${vueBtnAttr} @click="interrupt = 'reverse'">Reverse</${cfg.buttonName}>
      <${cfg.buttonName}${vueBtnAttr} @click="interrupt = 'wait'">Wait</${cfg.buttonName}>
      <${cfg.buttonName}${vueBtnAttr} @click="interrupt = 'immediate'">Immediate</${cfg.buttonName}>
      <${cfg.buttonName}${vueBtnAttr} @click="open = !open">Toggle</${cfg.buttonName}>
    </div>
  </div>
  ${cfg.wrapShadcnRhea ? '</ShadcnStyleScope>' : ''}
</template>

<script>
import { ${cfg.componentName}, ${cfg.buttonName}${cfg.wrapShadcnRhea ? ', ShadcnStyleScope' : ''} } from '../proto-ui/components/vue2';

export default {
  components: { ${cfg.componentName}, ${cfg.buttonName}${cfg.wrapShadcnRhea ? ', ShadcnStyleScope' : ''} },
  data() {
    return { interrupt: 'reverse', open: true };
  },
};
</script>
  `);

  return { wc, react, vue, vue2 };
}

function buildLifecycleSnippets(cfg: FamilyCodeConfig) {
  const wcBody = `
<${cfg.wcTag}
  id="lifecycle-demo"
  default-open
  appear
  enter-duration="350"
  leave-duration="250"
  class="${cfg.transitionClass}"
>
  <div class="${cfg.cardClass}">Observe beforeEnter, afterEnter, beforeLeave, and afterLeave.</div>
</${cfg.wcTag}>

<script type="module">
  const el = document.querySelector('#lifecycle-demo');
  for (const name of ['beforeEnter', 'afterEnter', 'beforeLeave', 'afterLeave']) {
    el?.addEventListener(name, () => console.log(name, el.getExposes().isPresent.get()));
  }
</script>`.trim();

  const wc = cfg.wrapShadcnRhea
    ? formatCode(
        `<wc-shadcn-style-scope style-profile="rhea" class="contents">\n${wcBody}\n</wc-shadcn-style-scope>`
      )
    : formatCode(wcBody);

  const react = formatCode(`
import { useState } from 'react';
import { ${cfg.componentName}${cfg.wrapShadcnRhea ? ', ShadcnStyleScope' : ''} } from '../proto-ui/components/react';

export function LifecycleTransitionDemo() {
  const [events, setEvents] = useState<string[]>([]);
  const push = (name: string) => setEvents((prev) => [...prev.slice(-5), name]);

  return (
    ${cfg.wrapShadcnRhea ? '<ShadcnStyleScope styleProfile="rhea" className="contents">' : ''}
    <${cfg.componentName}
      defaultOpen
      appear
      enterDuration={350}
      leaveDuration={250}
      className="${cfg.transitionClass}"
      onBeforeEnter={() => push('beforeEnter')}
      onAfterEnter={() => push('afterEnter')}
      onBeforeLeave={() => push('beforeLeave')}
      onAfterLeave={() => push('afterLeave')}
    >
      <div className="${cfg.cardClass}">Recorded: {events.join(' → ')}</div>
    </${cfg.componentName}>
    ${cfg.wrapShadcnRhea ? '</ShadcnStyleScope>' : ''}
  );
}
  `);

  const vue = formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import { ${cfg.componentName}${cfg.wrapShadcnRhea ? ', ShadcnStyleScope' : ''} } from '../proto-ui/components/vue';

const events = ref<string[]>([]);
const push = (name: string) => {
  events.value = [...events.value.slice(-5), name];
};
</script>

<template>
  ${cfg.wrapShadcnRhea ? '<ShadcnStyleScope style-profile="rhea" class="contents">' : ''}
  <${cfg.componentName}
    default-open
    appear
    :enter-duration="350"
    :leave-duration="250"
    class="${cfg.transitionClass}"
    @beforeEnter="push('beforeEnter')"
    @afterEnter="push('afterEnter')"
    @beforeLeave="push('beforeLeave')"
    @afterLeave="push('afterLeave')"
  >
    <div class="${cfg.cardClass}">Recorded: {{ events.join(' → ') }}</div>
  </${cfg.componentName}>
  ${cfg.wrapShadcnRhea ? '</ShadcnStyleScope>' : ''}
</template>
  `);

  const vue2 = formatCode(`
<template>
  ${cfg.wrapShadcnRhea ? '<ShadcnStyleScope style-profile="rhea" class="contents">' : ''}
  <${cfg.componentName}
    default-open
    appear
    :enter-duration="350"
    :leave-duration="250"
    class="${cfg.transitionClass}"
    @beforeEnter="push('beforeEnter')"
    @afterEnter="push('afterEnter')"
    @beforeLeave="push('beforeLeave')"
    @afterLeave="push('afterLeave')"
  >
    <div class="${cfg.cardClass}">Recorded: {{ events.join(' → ') }}</div>
  </${cfg.componentName}>
  ${cfg.wrapShadcnRhea ? '</ShadcnStyleScope>' : ''}
</template>

<script>
import { ${cfg.componentName}${cfg.wrapShadcnRhea ? ', ShadcnStyleScope' : ''} } from '../proto-ui/components/vue2';

export default {
  components: { ${cfg.componentName}${cfg.wrapShadcnRhea ? ', ShadcnStyleScope' : ''} },
  data() {
    return { events: [] };
  },
  methods: {
    push(name) {
      this.events = [...this.events.slice(-5), name];
    },
  },
};
</script>
  `);

  return { wc, react, vue, vue2 };
}

const liquidGlassAccessibility = {
  wc: formatCode(`
<div class="rounded-2xl bg-gradient-to-br from-sky-500/25 via-indigo-500/20 to-fuchsia-500/25 p-5">
  <wc-liquid-glass-transition open appear class="block transition-opacity duration-300 ease-out motion-reduce:transition-none">
    <div class="rounded-2xl border border-white/55 bg-white/70 p-4 shadow-lg backdrop-blur-xl">
      <span class="inline-flex rounded-xl bg-white/45 px-2.5 py-0.5 text-xs">Liquid Glass Surface</span>
      <p class="mt-2 text-sm">Keep Transition transparent so glass is never stacked on glass.</p>
    </div>
  </wc-liquid-glass-transition>

  <div class="mt-4 flex gap-2">
    <wc-liquid-glass-button variant="regular">Regular</wc-liquid-glass-button>
    <wc-liquid-glass-button variant="prominent">Prominent</wc-liquid-glass-button>
    <wc-liquid-glass-button variant="regular" material="opaque">Opaque Fallback</wc-liquid-glass-button>
  </div>
</div>
  `),
  react: formatCode(`
import { useState } from 'react';
import { LiquidGlassButton, LiquidGlassTransition } from '../proto-ui/components/react';

export function LiquidGlassTransitionAccessibilityDemo() {
  const [open, setOpen] = useState(true);
  const [opaque, setOpaque] = useState(false);

  return (
    <div className="rounded-2xl bg-gradient-to-br from-sky-500/25 via-indigo-500/20 to-fuchsia-500/25 p-5">
      <LiquidGlassTransition
        open={open}
        appear
        className="block transition-opacity duration-300 ease-out motion-reduce:transition-none"
      >
        <div
          className={
            opaque
              ? 'rounded-2xl border-2 border-zinc-900/40 bg-white p-4 text-zinc-950 shadow-md'
              : 'rounded-2xl border border-white/55 bg-white/70 p-4 shadow-lg backdrop-blur-xl'
          }
        >
          Floating overlay over backdrop content.
        </div>
      </LiquidGlassTransition>
      <div className="mt-4 flex gap-2">
        <LiquidGlassButton variant="prominent" material={opaque ? 'opaque' : 'auto'} onClick={() => setOpen((v) => !v)}>
          Toggle Panel
        </LiquidGlassButton>
        <LiquidGlassButton variant="regular" material="opaque" onClick={() => setOpaque((v) => !v)}>
          Toggle Opaque Fallback
        </LiquidGlassButton>
      </div>
    </div>
  );
}
  `),
  vue: formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import { LiquidGlassButton, LiquidGlassTransition } from '../proto-ui/components/vue';

const open = ref(true);
const opaque = ref(false);
</script>

<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/25 via-indigo-500/20 to-fuchsia-500/25 p-5">
    <LiquidGlassTransition
      :open="open"
      appear
      class="block transition-opacity duration-300 ease-out motion-reduce:transition-none"
    >
      <div
        :class="
          opaque
            ? 'rounded-2xl border-2 border-zinc-900/40 bg-white p-4 text-zinc-950 shadow-md'
            : 'rounded-2xl border border-white/55 bg-white/70 p-4 shadow-lg backdrop-blur-xl'
        "
      >
        Floating overlay over backdrop content.
      </div>
    </LiquidGlassTransition>
    <div class="mt-4 flex gap-2">
      <LiquidGlassButton variant="prominent" :material="opaque ? 'opaque' : 'auto'" @click="open = !open">
        Toggle Panel
      </LiquidGlassButton>
      <LiquidGlassButton variant="regular" material="opaque" @click="opaque = !opaque">
        Toggle Opaque Fallback
      </LiquidGlassButton>
    </div>
  </div>
</template>
  `),
  vue2: formatCode(`
<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/25 via-indigo-500/20 to-fuchsia-500/25 p-5">
    <LiquidGlassTransition
      :open="open"
      appear
      class="block transition-opacity duration-300 ease-out motion-reduce:transition-none"
    >
      <div
        :class="
          opaque
            ? 'rounded-2xl border-2 border-zinc-900/40 bg-white p-4 text-zinc-950 shadow-md'
            : 'rounded-2xl border border-white/55 bg-white/70 p-4 shadow-lg backdrop-blur-xl'
        "
      >
        Floating overlay over backdrop content.
      </div>
    </LiquidGlassTransition>
    <div class="mt-4 flex gap-2">
      <LiquidGlassButton variant="prominent" :material="opaque ? 'opaque' : 'auto'" @click="open = !open">
        Toggle Panel
      </LiquidGlassButton>
      <LiquidGlassButton variant="regular" material="opaque" @click="opaque = !opaque">
        Toggle Opaque Fallback
      </LiquidGlassButton>
    </div>
  </div>
</template>

<script>
import { LiquidGlassButton, LiquidGlassTransition } from '../proto-ui/components/vue2';

export default {
  components: { LiquidGlassButton, LiquidGlassTransition },
  data() {
    return { open: true, opaque: false };
  },
};
</script>
  `),
};

const wc: Record<string, string> = {};
const react: Record<string, string> = {};
const vue: Record<string, string> = {};
const vue2: Record<string, string> = {};

for (const cfg of Object.values(FAMILIES)) {
  const hero = buildHeroSnippets(cfg);
  const controlled = buildControlledSnippets(cfg);
  const interrupt = buildInterruptSnippets(cfg);
  const lifecycle = buildLifecycleSnippets(cfg);

  wc[cfg.prefix] = hero.wc;
  react[cfg.prefix] = hero.react;
  vue[cfg.prefix] = hero.vue;
  vue2[cfg.prefix] = hero.vue2;

  wc[`${cfg.prefix}-controlled`] = controlled.wc;
  react[`${cfg.prefix}-controlled`] = controlled.react;
  vue[`${cfg.prefix}-controlled`] = controlled.vue;
  vue2[`${cfg.prefix}-controlled`] = controlled.vue2;

  wc[`${cfg.prefix}-interrupt`] = interrupt.wc;
  react[`${cfg.prefix}-interrupt`] = interrupt.react;
  vue[`${cfg.prefix}-interrupt`] = interrupt.vue;
  vue2[`${cfg.prefix}-interrupt`] = interrupt.vue2;

  wc[`${cfg.prefix}-lifecycle`] = lifecycle.wc;
  react[`${cfg.prefix}-lifecycle`] = lifecycle.react;
  vue[`${cfg.prefix}-lifecycle`] = lifecycle.vue;
  vue2[`${cfg.prefix}-lifecycle`] = lifecycle.vue2;
}

wc['demo-liquid-glass-transition-accessibility'] = liquidGlassAccessibility.wc;
react['demo-liquid-glass-transition-accessibility'] = liquidGlassAccessibility.react;
vue['demo-liquid-glass-transition-accessibility'] = liquidGlassAccessibility.vue;
vue2['demo-liquid-glass-transition-accessibility'] = liquidGlassAccessibility.vue2;

export const codeMap: Partial<Record<RuntimeId, Record<string, string>>> = {
  wc,
  react,
  vue,
  vue2,
};
