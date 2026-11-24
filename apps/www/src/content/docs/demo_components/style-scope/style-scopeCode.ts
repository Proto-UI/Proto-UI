import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-style-scope': formatCode(`
<div id="preset-bar" role="group" aria-label="Shadcn style profile">
  <button data-preset="rhea">rhea</button>
  <button data-preset="vega">vega</button>
  <button data-preset="nova">nova</button>
  <button data-preset="maia">maia</button>
  <button data-preset="lyra">lyra</button>
  <button data-preset="mira">mira</button>
  <button data-preset="luma">luma</button>
  <button data-preset="sera">sera</button>
  <button data-preset="new-york-v4">new-york-v4</button>
</div>
<div id="style-scope-host"></div>
<script type="module">
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleScope } from '@proto.ui/prototypes-shadcn/style-scope';
import { button } from '@proto.ui/prototypes-shadcn/button';
import { inputShell, inputShellControl } from '@proto.ui/prototypes-shadcn/input-shell';

// Register before connecting so parent scopes own Context first.
for (const [name, proto] of [
  ['demo-style-scope', styleScope],
  ['demo-button', button],
  ['demo-input-shell', inputShell],
  ['demo-input-shell-control', inputShellControl],
]) {
  AdaptToWebComponent(proto, { registerAs: name });
}

const template = document.createElement('template');
template.innerHTML = \`
<demo-style-scope class="contents">
  <demo-input-shell>
    <demo-input-shell-control placeholder="Filter deployments..." aria-label="Filter deployments"></demo-input-shell-control>
  </demo-input-shell>
  <div class="flex flex-wrap gap-2">
    <demo-button>Deploy</demo-button>
    <demo-button variant="outline">Preview</demo-button>
    <demo-button variant="secondary">Duplicate</demo-button>
    <demo-button variant="destructive">Archive</demo-button>
  </div>
</demo-style-scope>
\`;

const fragment = template.content;
const scope = fragment.querySelector('demo-style-scope');
setElementProps(scope, { styleProfile: 'rhea' });
document.querySelector('#style-scope-host').append(fragment);

document.querySelector('#preset-bar').addEventListener('click', (event) => {
  const trigger = event.target.closest('button[data-preset]');
  if (trigger) setElementProps(scope, { styleProfile: trigger.dataset.preset });
});
</script>
    `),
    'demo-shadcn-style-scope-nesting': formatCode(`
<div id="nesting-host"></div>
<script type="module">
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleScope } from '@proto.ui/prototypes-shadcn/style-scope';
import { ShadcnCardRoot, ShadcnCardHeader, ShadcnCardContent } from '@proto.ui/prototypes-shadcn/card';
import { button } from '@proto.ui/prototypes-shadcn/button';

for (const [name, proto] of [
  ['demo-style-scope', styleScope],
  ['demo-card', ShadcnCardRoot],
  ['demo-card-header', ShadcnCardHeader],
  ['demo-card-content', ShadcnCardContent],
  ['demo-button', button],
]) {
  AdaptToWebComponent(proto, { registerAs: name });
}

const template = document.createElement('template');
template.innerHTML = \`
<demo-style-scope id="outer" class="contents">
  <div class="grid gap-4 md:grid-cols-3">
    <demo-card>
      <demo-card-header>Outer scope</demo-card-header>
      <demo-card-content><demo-button variant="outline" size="sm">Inherited action</demo-button></demo-card-content>
    </demo-card>
    <demo-style-scope id="nested" class="contents">
      <demo-card>
        <demo-card-header>Nested scope</demo-card-header>
        <demo-card-content><demo-button variant="outline" size="sm">Scoped action</demo-button></demo-card-content>
      </demo-card>
    </demo-style-scope>
    <demo-card id="explicit">
      <demo-card-header>Explicit prop</demo-card-header>
      <demo-card-content><demo-button variant="outline" size="sm">Override action</demo-button></demo-card-content>
    </demo-card>
  </div>
</demo-style-scope>
\`;

const fragment = template.content;
setElementProps(fragment.querySelector('#outer'), { styleProfile: 'rhea' });
setElementProps(fragment.querySelector('#nested'), { styleProfile: 'new-york' });
setElementProps(fragment.querySelector('#explicit'), { styleProfile: 'new-york-v4' });
document.querySelector('#nesting-host').append(fragment);
</script>
    `),
    'demo-shadcn-style-scope-state-preservation': formatCode(`
<div id="state-presets" role="group" aria-label="Style profile">
  <button data-preset="rhea">rhea</button>
  <button data-preset="nova">nova</button>
  <button data-preset="lyra">lyra</button>
  <button data-preset="luma">luma</button>
  <button data-preset="new-york-v4">new-york-v4</button>
</div>
<div id="state-host"></div>
<script type="module">
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleScope } from '@proto.ui/prototypes-shadcn/style-scope';
import { tabsRoot, tabsList, tabsTrigger, tabsContent } from '@proto.ui/prototypes-shadcn/tabs';
import { inputShell, inputShellControl } from '@proto.ui/prototypes-shadcn/input-shell';

for (const [name, proto] of [
  ['demo-style-scope', styleScope],
  ['demo-tabs-root', tabsRoot],
  ['demo-tabs-list', tabsList],
  ['demo-tabs-trigger', tabsTrigger],
  ['demo-tabs-content', tabsContent],
  ['demo-input-shell', inputShell],
  ['demo-input-shell-control', inputShellControl],
]) {
  AdaptToWebComponent(proto, { registerAs: name });
}

const template = document.createElement('template');
template.innerHTML = \`
<demo-style-scope class="contents">
  <demo-tabs-root default-value="general">
    <demo-tabs-list>
      <demo-tabs-trigger value="general">General</demo-tabs-trigger>
      <demo-tabs-trigger value="security">Security</demo-tabs-trigger>
      <demo-tabs-trigger value="notifications">Notifications</demo-tabs-trigger>
    </demo-tabs-list>
    <demo-tabs-content value="general">General workspace configuration.</demo-tabs-content>
    <demo-tabs-content value="security">Security policies remain selected.</demo-tabs-content>
    <demo-tabs-content value="notifications">Notification preferences stay intact.</demo-tabs-content>
  </demo-tabs-root>
  <demo-input-shell>
    <demo-input-shell-control default-value="acme-studio" aria-label="Workspace slug"></demo-input-shell-control>
  </demo-input-shell>
</demo-style-scope>
\`;

const fragment = template.content;
const scope = fragment.querySelector('demo-style-scope');
setElementProps(scope, { styleProfile: 'rhea' });
document.querySelector('#state-host').append(fragment);

document.querySelector('#state-presets').addEventListener('click', (event) => {
  const trigger = event.target.closest('button[data-preset]');
  if (trigger) setElementProps(scope, { styleProfile: trigger.dataset.preset });
});
</script>
    `),
    'demo-shadcn-style-scope-composite': formatCode(`
<div id="composite-bar" role="group" aria-label="Composite scope choice">
  <button data-choice="rhea">rhea</button>
  <button data-choice="new-york">new-york</button>
  <button data-choice="new-york-v4">new-york-v4</button>
  <button data-choice="inherit">inherit</button>
</div>
<div id="composite-host"></div>
<script type="module">
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleScope } from '@proto.ui/prototypes-shadcn/style-scope';
import { ShadcnCardRoot, ShadcnCardHeader, ShadcnCardContent } from '@proto.ui/prototypes-shadcn/card';
import { inputShell, inputShellControl } from '@proto.ui/prototypes-shadcn/input-shell';
import { button } from '@proto.ui/prototypes-shadcn/button';

for (const [name, proto] of [
  ['demo-style-scope', styleScope],
  ['demo-card', ShadcnCardRoot],
  ['demo-card-header', ShadcnCardHeader],
  ['demo-card-content', ShadcnCardContent],
  ['demo-input-shell', inputShell],
  ['demo-input-shell-control', inputShellControl],
  ['demo-button', button],
]) {
  AdaptToWebComponent(proto, { registerAs: name });
}

const template = document.createElement('template');
template.innerHTML = \`
<demo-style-scope class="contents">
  <demo-card>
    <demo-card-header>Release notes</demo-card-header>
    <demo-card-content>
      <demo-input-shell>
        <demo-input-shell-control placeholder="Tag version (e.g. v1.4.0)" aria-label="Tag version"></demo-input-shell-control>
      </demo-input-shell>
      <demo-button size="sm">Publish</demo-button>
    </demo-card-content>
  </demo-card>
</demo-style-scope>
\`;

const fragment = template.content;
const scope = fragment.querySelector('demo-style-scope');
// Setting "inherit" without a concrete ancestor publishes { style: null }.
setElementProps(scope, { styleProfile: 'rhea' });
document.querySelector('#composite-host').append(fragment);

document.querySelector('#composite-bar').addEventListener('click', (event) => {
  const trigger = event.target.closest('button[data-choice]');
  if (trigger) setElementProps(scope, { styleProfile: trigger.dataset.choice });
});
</script>
    `),
  },
  react: {
    'demo-shadcn-style-scope': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import {
  styleScope,
  SHADCN_STYLE_IDS,
  type ShadcnStyleId,
} from '@proto.ui/prototypes-shadcn/style-scope';
import { button } from '@proto.ui/prototypes-shadcn/button';
import { inputShell, inputShellControl } from '@proto.ui/prototypes-shadcn/input-shell';

const adapt = createReactAdapter(React);
const StyleScope = adapt(styleScope);
const Button = adapt(button);
const InputShell = adapt(inputShell);
const InputShellControl = adapt(inputShellControl);

export function PresetSwitcher() {
  const [profile, setProfile] = React.useState<ShadcnStyleId>('rhea');

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Shadcn style profile">
        {SHADCN_STYLE_IDS.map((id) => (
          <Button
            key={id}
            size="sm"
            variant={profile === id ? 'default' : 'outline'}
            onClick={() => setProfile(id)}
          >
            {id}
          </Button>
        ))}
      </div>
      <StyleScope styleProfile={profile} className="contents">
        <InputShell focusIndicator="ring">
          <InputShellControl placeholder="Filter deployments..." ariaLabel="Filter deployments" />
        </InputShell>
        <div className="flex flex-wrap gap-2">
          <Button>Deploy</Button>
          <Button variant="outline">Preview</Button>
          <Button variant="secondary">Duplicate</Button>
          <Button variant="destructive">Archive</Button>
        </div>
      </StyleScope>
    </div>
  );
}
    `),
    'demo-shadcn-style-scope-nesting': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { styleScope, type ShadcnStyleChoice } from '@proto.ui/prototypes-shadcn/style-scope';
import {
  ShadcnCardRoot,
  ShadcnCardHeader,
  ShadcnCardContent,
} from '@proto.ui/prototypes-shadcn/card';
import { button } from '@proto.ui/prototypes-shadcn/button';

const adapt = createReactAdapter(React);
const StyleScope = adapt(styleScope);
const Card = adapt(ShadcnCardRoot);
const CardHeader = adapt(ShadcnCardHeader);
const CardContent = adapt(ShadcnCardContent);
const Button = adapt(button);

export function NestedScopes() {
  const [outer, setOuter] = React.useState<'rhea' | 'new-york-v4'>('rhea');
  const [nested, setNested] = React.useState<ShadcnStyleChoice>('new-york');
  const [cardOverride, setCardOverride] = React.useState<ShadcnStyleChoice>('new-york-v4');

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setOuter(outer === 'rhea' ? 'new-york-v4' : 'rhea')}>
          Switch outer scope
        </Button>
        <Button size="sm" variant="outline" onClick={() => setNested(nested === 'new-york' ? 'inherit' : 'new-york')}>
          Toggle nested inherit
        </Button>
        <Button size="sm" variant="outline" onClick={() => setCardOverride(cardOverride === 'new-york-v4' ? 'inherit' : 'new-york-v4')}>
          Toggle Card 3 inherit
        </Button>
      </div>
      <StyleScope styleProfile={outer} className="contents">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>Outer scope</CardHeader>
            <CardContent><Button variant="outline" size="sm">Inherited action</Button></CardContent>
          </Card>
          <StyleScope styleProfile={nested} className="contents">
            <Card>
              <CardHeader>Nested scope</CardHeader>
              <CardContent><Button variant="outline" size="sm">Scoped action</Button></CardContent>
            </Card>
          </StyleScope>
          <Card styleProfile={cardOverride}>
            <CardHeader>Explicit prop</CardHeader>
            <CardContent><Button variant="outline" size="sm">Override action</Button></CardContent>
          </Card>
        </div>
      </StyleScope>
    </div>
  );
}
    `),
    'demo-shadcn-style-scope-state-preservation': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { styleScope, type ShadcnStyleId } from '@proto.ui/prototypes-shadcn/style-scope';
import { tabsRoot, tabsList, tabsTrigger, tabsContent } from '@proto.ui/prototypes-shadcn/tabs';
import { inputShell, inputShellControl } from '@proto.ui/prototypes-shadcn/input-shell';
import { button } from '@proto.ui/prototypes-shadcn/button';

const adapt = createReactAdapter(React);
const StyleScope = adapt(styleScope);
const TabsRoot = adapt(tabsRoot);
const TabsList = adapt(tabsList);
const TabsTrigger = adapt(tabsTrigger);
const TabsContent = adapt(tabsContent);
const InputShell = adapt(inputShell);
const InputShellControl = adapt(inputShellControl);
const Button = adapt(button);

const PRESETS: readonly ShadcnStyleId[] = ['rhea', 'nova', 'lyra', 'luma', 'new-york-v4'];

export function StatePreservation() {
  const [profile, setProfile] = React.useState<ShadcnStyleId>('rhea');

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((id) => (
          <Button key={id} size="sm" variant={profile === id ? 'default' : 'outline'} onClick={() => setProfile(id)}>
            {id}
          </Button>
        ))}
      </div>
      {/* Update styleProfile in place; do not change key. */}
      <StyleScope styleProfile={profile} className="contents">
        <TabsRoot defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>
          <TabsContent value="general">General workspace configuration.</TabsContent>
          <TabsContent value="security">Security policies remain selected.</TabsContent>
          <TabsContent value="notifications">Notification preferences stay intact.</TabsContent>
        </TabsRoot>
        <InputShell focusIndicator="ring">
          <InputShellControl defaultValue="acme-studio" ariaLabel="Workspace slug" />
        </InputShell>
      </StyleScope>
    </div>
  );
}
    `),
    'demo-shadcn-style-scope-composite': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { styleScope, type ShadcnStyleChoice } from '@proto.ui/prototypes-shadcn/style-scope';
import { ShadcnCardRoot, ShadcnCardHeader, ShadcnCardContent } from '@proto.ui/prototypes-shadcn/card';
import { inputShell, inputShellControl } from '@proto.ui/prototypes-shadcn/input-shell';
import { button } from '@proto.ui/prototypes-shadcn/button';

const adapt = createReactAdapter(React);
const StyleScope = adapt(styleScope);
const Card = adapt(ShadcnCardRoot);
const CardHeader = adapt(ShadcnCardHeader);
const CardContent = adapt(ShadcnCardContent);
const InputShell = adapt(inputShell);
const InputShellControl = adapt(inputShellControl);
const Button = adapt(button);

export function CompositeScope() {
  const [profile, setProfile] = React.useState<ShadcnStyleChoice>('rhea');

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-1.5">
        {(['rhea', 'new-york', 'new-york-v4', 'inherit'] as const).map((choice) => (
          <Button key={choice} size="sm" variant={profile === choice ? 'default' : 'outline'} onClick={() => setProfile(choice)}>
            {choice}
          </Button>
        ))}
      </div>
      {/* "new-york" normalizes to "new-york-v4"; "inherit" with no concrete ancestor publishes { style: null }. */}
      <StyleScope styleProfile={profile} className="contents">
        <Card>
          <CardHeader>Release notes</CardHeader>
          <CardContent>
            <InputShell focusIndicator="ring">
              <InputShellControl placeholder="Tag version (e.g. v1.4.0)" ariaLabel="Tag version" />
            </InputShell>
            <Button size="sm">Publish</Button>
          </CardContent>
        </Card>
      </StyleScope>
    </div>
  );
}
    `),
  },
  vue: {
    'demo-shadcn-style-scope': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import {
  styleScope,
  SHADCN_STYLE_IDS,
  type ShadcnStyleId,
} from '@proto.ui/prototypes-shadcn/style-scope';
import { button } from '@proto.ui/prototypes-shadcn/button';
import { inputShell, inputShellControl } from '@proto.ui/prototypes-shadcn/input-shell';

const adapt = createVueAdapter(Vue);
const StyleScope = adapt(styleScope);
const Button = adapt(button);
const InputShell = adapt(inputShell);
const InputShellControl = adapt(inputShellControl);

const profile = Vue.ref<ShadcnStyleId>('rhea');
</script>

<template>
  <div class="grid gap-4">
    <div class="flex flex-wrap gap-1.5" role="group" aria-label="Shadcn style profile">
      <Button
        v-for="id in SHADCN_STYLE_IDS"
        :key="id"
        size="sm"
        :variant="profile === id ? 'default' : 'outline'"
        @click="profile = id"
      >
        {{ id }}
      </Button>
    </div>
    <StyleScope :styleProfile="profile" class="contents">
      <InputShell focusIndicator="ring">
        <InputShellControl placeholder="Filter deployments..." ariaLabel="Filter deployments" />
      </InputShell>
      <div class="flex flex-wrap gap-2">
        <Button>Deploy</Button>
        <Button variant="outline">Preview</Button>
        <Button variant="secondary">Duplicate</Button>
        <Button variant="destructive">Archive</Button>
      </div>
    </StyleScope>
  </div>
</template>
    `),
    'demo-shadcn-style-scope-nesting': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { styleScope, type ShadcnStyleChoice } from '@proto.ui/prototypes-shadcn/style-scope';
import { ShadcnCardRoot, ShadcnCardHeader, ShadcnCardContent } from '@proto.ui/prototypes-shadcn/card';
import { button } from '@proto.ui/prototypes-shadcn/button';

const adapt = createVueAdapter(Vue);
const StyleScope = adapt(styleScope);
const Card = adapt(ShadcnCardRoot);
const CardHeader = adapt(ShadcnCardHeader);
const CardContent = adapt(ShadcnCardContent);
const Button = adapt(button);

const outer = Vue.ref<'rhea' | 'new-york-v4'>('rhea');
const nested = Vue.ref<ShadcnStyleChoice>('new-york');
const cardOverride = Vue.ref<ShadcnStyleChoice>('new-york-v4');
</script>

<template>
  <StyleScope :styleProfile="outer" class="contents">
    <div class="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>Outer scope</CardHeader>
        <CardContent><Button variant="outline" size="sm">Inherited action</Button></CardContent>
      </Card>
      <StyleScope :styleProfile="nested" class="contents">
        <Card>
          <CardHeader>Nested scope</CardHeader>
          <CardContent><Button variant="outline" size="sm">Scoped action</Button></CardContent>
        </Card>
      </StyleScope>
      <Card :styleProfile="cardOverride">
        <CardHeader>Explicit prop</CardHeader>
        <CardContent><Button variant="outline" size="sm">Override action</Button></CardContent>
      </Card>
    </div>
  </StyleScope>
</template>
    `),
    'demo-shadcn-style-scope-state-preservation': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { styleScope, type ShadcnStyleId } from '@proto.ui/prototypes-shadcn/style-scope';
import { tabsRoot, tabsList, tabsTrigger, tabsContent } from '@proto.ui/prototypes-shadcn/tabs';
import { inputShell, inputShellControl } from '@proto.ui/prototypes-shadcn/input-shell';
import { button } from '@proto.ui/prototypes-shadcn/button';

const adapt = createVueAdapter(Vue);
const StyleScope = adapt(styleScope);
const TabsRoot = adapt(tabsRoot);
const TabsList = adapt(tabsList);
const TabsTrigger = adapt(tabsTrigger);
const TabsContent = adapt(tabsContent);
const InputShell = adapt(inputShell);
const InputShellControl = adapt(inputShellControl);
const Button = adapt(button);

const presets: readonly ShadcnStyleId[] = ['rhea', 'nova', 'lyra', 'luma', 'new-york-v4'];
const profile = Vue.ref<ShadcnStyleId>('rhea');
</script>

<template>
  <div class="grid gap-4">
    <div class="flex flex-wrap gap-1.5">
      <Button
        v-for="id in presets"
        :key="id"
        size="sm"
        :variant="profile === id ? 'default' : 'outline'"
        @click="profile = id"
      >
        {{ id }}
      </Button>
    </div>
    <StyleScope :styleProfile="profile" class="contents">
      <TabsRoot defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>
        <TabsContent value="general">General workspace configuration.</TabsContent>
        <TabsContent value="security">Security policies remain selected.</TabsContent>
        <TabsContent value="notifications">Notification preferences stay intact.</TabsContent>
      </TabsRoot>
      <InputShell focusIndicator="ring">
        <InputShellControl defaultValue="acme-studio" ariaLabel="Workspace slug" />
      </InputShell>
    </StyleScope>
  </div>
</template>
    `),
    'demo-shadcn-style-scope-composite': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { styleScope, type ShadcnStyleChoice } from '@proto.ui/prototypes-shadcn/style-scope';
import { ShadcnCardRoot, ShadcnCardHeader, ShadcnCardContent } from '@proto.ui/prototypes-shadcn/card';
import { inputShell, inputShellControl } from '@proto.ui/prototypes-shadcn/input-shell';
import { button } from '@proto.ui/prototypes-shadcn/button';

const adapt = createVueAdapter(Vue);
const StyleScope = adapt(styleScope);
const Card = adapt(ShadcnCardRoot);
const CardHeader = adapt(ShadcnCardHeader);
const CardContent = adapt(ShadcnCardContent);
const InputShell = adapt(inputShell);
const InputShellControl = adapt(inputShellControl);
const Button = adapt(button);

const profile = Vue.ref<ShadcnStyleChoice>('rhea');
const choices = ['rhea', 'new-york', 'new-york-v4', 'inherit'] as const;
</script>

<template>
  <div class="grid gap-4">
    <div class="flex flex-wrap gap-1.5">
      <Button
        v-for="choice in choices"
        :key="choice"
        size="sm"
        :variant="profile === choice ? 'default' : 'outline'"
        @click="profile = choice"
      >
        {{ choice }}
      </Button>
    </div>
    <StyleScope :styleProfile="profile" class="contents">
      <Card>
        <CardHeader>Release notes</CardHeader>
        <CardContent>
          <InputShell focusIndicator="ring">
            <InputShellControl placeholder="Tag version (e.g. v1.4.0)" ariaLabel="Tag version" />
          </InputShell>
          <Button size="sm">Publish</Button>
        </CardContent>
      </Card>
    </StyleScope>
  </div>
</template>
    `),
  },
  vue2: {
    'demo-shadcn-style-scope': formatCode(`
<template>
  <div class="grid gap-4">
    <div class="flex flex-wrap gap-1.5" role="group" aria-label="Shadcn style profile">
      <Button
        v-for="id in presets"
        :key="id"
        size="sm"
        :variant="profile === id ? 'default' : 'outline'"
        @click="profile = id"
      >
        {{ id }}
      </Button>
    </div>
    <StyleScope :styleProfile="profile" class="contents">
      <InputShell focusIndicator="ring">
        <InputShellControl placeholder="Filter deployments..." ariaLabel="Filter deployments" />
      </InputShell>
      <div class="flex flex-wrap gap-2">
        <Button>Deploy</Button>
        <Button variant="outline">Preview</Button>
        <Button variant="secondary">Duplicate</Button>
        <Button variant="destructive">Archive</Button>
      </div>
    </StyleScope>
  </div>
</template>

<script>
import Vue from 'vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { styleScope, SHADCN_STYLE_IDS } from '@proto.ui/prototypes-shadcn/style-scope';
import { button } from '@proto.ui/prototypes-shadcn/button';
import { inputShell, inputShellControl } from '@proto.ui/prototypes-shadcn/input-shell';

const adapt = createVue2Adapter(Vue);
const StyleScope = adapt(styleScope);
const Button = adapt(button);
const InputShell = adapt(inputShell);
const InputShellControl = adapt(inputShellControl);

export default {
  components: { StyleScope, Button, InputShell, InputShellControl },
  data() {
    return {
      profile: 'rhea',
      presets: SHADCN_STYLE_IDS,
    };
  },
};
</script>
    `),
    'demo-shadcn-style-scope-nesting': formatCode(`
<template>
  <StyleScope :styleProfile="outer" class="contents">
    <div class="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>Outer scope</CardHeader>
        <CardContent><Button variant="outline" size="sm">Inherited action</Button></CardContent>
      </Card>
      <StyleScope :styleProfile="nested" class="contents">
        <Card>
          <CardHeader>Nested scope</CardHeader>
          <CardContent><Button variant="outline" size="sm">Scoped action</Button></CardContent>
        </Card>
      </StyleScope>
      <Card :styleProfile="cardOverride">
        <CardHeader>Explicit prop</CardHeader>
        <CardContent><Button variant="outline" size="sm">Override action</Button></CardContent>
      </Card>
    </div>
  </StyleScope>
</template>

<script>
import Vue from 'vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { styleScope } from '@proto.ui/prototypes-shadcn/style-scope';
import { ShadcnCardRoot, ShadcnCardHeader, ShadcnCardContent } from '@proto.ui/prototypes-shadcn/card';
import { button } from '@proto.ui/prototypes-shadcn/button';

const adapt = createVue2Adapter(Vue);
const StyleScope = adapt(styleScope);
const Card = adapt(ShadcnCardRoot);
const CardHeader = adapt(ShadcnCardHeader);
const CardContent = adapt(ShadcnCardContent);
const Button = adapt(button);

export default {
  components: { StyleScope, Card, CardHeader, CardContent, Button },
  data() {
    return {
      outer: 'rhea',
      nested: 'new-york',
      cardOverride: 'new-york-v4',
    };
  },
};
</script>
    `),
    'demo-shadcn-style-scope-state-preservation': formatCode(`
<template>
  <div class="grid gap-4">
    <div class="flex flex-wrap gap-1.5">
      <Button
        v-for="id in presets"
        :key="id"
        size="sm"
        :variant="profile === id ? 'default' : 'outline'"
        @click="profile = id"
      >
        {{ id }}
      </Button>
    </div>
    <StyleScope :styleProfile="profile" class="contents">
      <TabsRoot defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>
        <TabsContent value="general">General workspace configuration.</TabsContent>
        <TabsContent value="security">Security policies remain selected.</TabsContent>
        <TabsContent value="notifications">Notification preferences stay intact.</TabsContent>
      </TabsRoot>
      <InputShell focusIndicator="ring">
        <InputShellControl defaultValue="acme-studio" ariaLabel="Workspace slug" />
      </InputShell>
    </StyleScope>
  </div>
</template>

<script>
import Vue from 'vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { styleScope } from '@proto.ui/prototypes-shadcn/style-scope';
import { tabsRoot, tabsList, tabsTrigger, tabsContent } from '@proto.ui/prototypes-shadcn/tabs';
import { inputShell, inputShellControl } from '@proto.ui/prototypes-shadcn/input-shell';
import { button } from '@proto.ui/prototypes-shadcn/button';

const adapt = createVue2Adapter(Vue);
const StyleScope = adapt(styleScope);
const TabsRoot = adapt(tabsRoot);
const TabsList = adapt(tabsList);
const TabsTrigger = adapt(tabsTrigger);
const TabsContent = adapt(tabsContent);
const InputShell = adapt(inputShell);
const InputShellControl = adapt(inputShellControl);
const Button = adapt(button);

export default {
  components: {
    StyleScope,
    TabsRoot,
    TabsList,
    TabsTrigger,
    TabsContent,
    InputShell,
    InputShellControl,
    Button,
  },
  data() {
    return {
      profile: 'rhea',
      presets: ['rhea', 'nova', 'lyra', 'luma', 'new-york-v4'],
    };
  },
};
</script>
    `),
    'demo-shadcn-style-scope-composite': formatCode(`
<template>
  <div class="grid gap-4">
    <div class="flex flex-wrap gap-1.5">
      <Button
        v-for="choice in choices"
        :key="choice"
        size="sm"
        :variant="profile === choice ? 'default' : 'outline'"
        @click="profile = choice"
      >
        {{ choice }}
      </Button>
    </div>
    <StyleScope :styleProfile="profile" class="contents">
      <Card>
        <CardHeader>Release notes</CardHeader>
        <CardContent>
          <InputShell focusIndicator="ring">
            <InputShellControl placeholder="Tag version (e.g. v1.4.0)" ariaLabel="Tag version" />
          </InputShell>
          <Button size="sm">Publish</Button>
        </CardContent>
      </Card>
    </StyleScope>
  </div>
</template>

<script>
import Vue from 'vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { styleScope } from '@proto.ui/prototypes-shadcn/style-scope';
import { ShadcnCardRoot, ShadcnCardHeader, ShadcnCardContent } from '@proto.ui/prototypes-shadcn/card';
import { inputShell, inputShellControl } from '@proto.ui/prototypes-shadcn/input-shell';
import { button } from '@proto.ui/prototypes-shadcn/button';

const adapt = createVue2Adapter(Vue);
const StyleScope = adapt(styleScope);
const Card = adapt(ShadcnCardRoot);
const CardHeader = adapt(ShadcnCardHeader);
const CardContent = adapt(ShadcnCardContent);
const InputShell = adapt(inputShell);
const InputShellControl = adapt(inputShellControl);
const Button = adapt(button);

export default {
  components: { StyleScope, Card, CardHeader, CardContent, InputShell, InputShellControl, Button },
  data() {
    return {
      profile: 'rhea',
      choices: ['rhea', 'new-york', 'new-york-v4', 'inherit'],
    };
  },
};
</script>
    `),
  },
};
