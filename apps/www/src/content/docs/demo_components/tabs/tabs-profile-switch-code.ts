import { formatCode } from '../../../../utils/conversionUtils';

const prototypes = `import { styleScope } from '@proto.ui/prototypes-shadcn/style-scope';
import { tabsRoot, tabsList, tabsTrigger, tabsContent } from '@proto.ui/prototypes-shadcn/tabs';`;
const profiles = "['nova', 'rhea', 'new-york-v4']";
const parts = ['StyleScope', 'TabsRoot', 'TabsList', 'TabsTrigger', 'TabsContent'];
const definitions = ['styleScope', 'tabsRoot', 'tabsList', 'tabsTrigger', 'tabsContent'];
const bindings = (adapter: string) =>
  parts.map((name, index) => `const ${name} = ${adapter}(${definitions[index]});`).join('\n');
const tabs = `<TabsRoot defaultValue="account">
  <TabsList>
    <TabsTrigger value="account">Account</TabsTrigger>
    <TabsTrigger value="password">Password</TabsTrigger>
    <TabsTrigger value="billing" disabled>Billing</TabsTrigger>
  </TabsList>
  <TabsContent value="account">Make changes to your account here.</TabsContent>
  <TabsContent value="password">Change your password here.</TabsContent>
</TabsRoot>`;

/** Ordinary host code: the scope prop changes; no key, remount or child replacement. */
export const tabsProfileSwitchCode = {
  react: formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
${prototypes}
const { useState } = React;
const AdaptToReact = createReactAdapter(React);
${bindings('AdaptToReact')}

export function TabsProfiles() {
  const [profile, setProfile] = useState('rhea');
  return <>
    <div role="group" aria-label="Tabs style profile">
      {${profiles}.map(value => <button key={value} onClick={() => setProfile(value)}>{value}</button>)}
    </div>
    <StyleScope styleProfile={profile}>
      ${tabs}
    </StyleScope>
  </>;
}
`),
  vue: formatCode(`
<script setup>
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
${prototypes}
const { ref } = Vue;
const AdaptToVue = createVueAdapter(Vue);
${bindings('AdaptToVue')}
const profile = ref('rhea');
const profiles = ${profiles};
</script>
<template>
  <div role="group" aria-label="Tabs style profile">
    <button v-for="value in profiles" :key="value" @click="profile = value">{{ value }}</button>
  </div>
  <StyleScope :styleProfile="profile">
    ${tabs}
  </StyleScope>
</template>
`),
  vue2: formatCode(`
<script>
import Vue from 'vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
${prototypes}
const AdaptToVue = createVue2Adapter(Vue);
${bindings('AdaptToVue')}
export default {
  components: { ${parts.join(', ')} },
  data: () => ({ profile: 'rhea', profiles: ${profiles} }),
};
</script>
<template>
  <div>
    <div role="group" aria-label="Tabs style profile">
      <button v-for="value in profiles" :key="value" @click="profile = value">{{ value }}</button>
    </div>
    <StyleScope :styleProfile="profile">
      ${tabs}
    </StyleScope>
  </div>
</template>
`),
  wc: formatCode(`
<div id="profiles" role="group" aria-label="Tabs style profile">
  <button data-profile="nova">nova</button>
  <button data-profile="rhea">rhea</button>
  <button data-profile="new-york-v4">new-york-v4</button>
</div>
<div id="tabs-profile-host"></div>
<script type="module">
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
${prototypes}
for (const [name, prototype] of [
  ['demo-style-scope', styleScope], ['demo-tabs-root', tabsRoot],
  ['demo-tabs-list', tabsList], ['demo-tabs-trigger', tabsTrigger],
  ['demo-tabs-content', tabsContent],
]) AdaptToWebComponent(prototype, { registerAs: name });
// Register before connecting the authored tree so parents own Context first.
const template = document.createElement('template');
template.innerHTML = \`
<demo-style-scope>
  <demo-tabs-root default-value="account">
    <demo-tabs-list>
      <demo-tabs-trigger value="account">Account</demo-tabs-trigger>
      <demo-tabs-trigger value="password">Password</demo-tabs-trigger>
      <demo-tabs-trigger value="billing" disabled>Billing</demo-tabs-trigger>
    </demo-tabs-list>
    <demo-tabs-content value="account">Make changes to your account here.</demo-tabs-content>
    <demo-tabs-content value="password">Change your password here.</demo-tabs-content>
  </demo-tabs-root>
</demo-style-scope>
\`;
const fragment = template.content;
const scope = fragment.querySelector('demo-style-scope');
setElementProps(scope, { styleProfile: 'rhea' });
document.querySelector('#tabs-profile-host').append(fragment);
const controls = document.querySelector('#profiles');
const select = event => {
  const button = event.target.closest('button[data-profile]');
  if (button) setElementProps(scope, { styleProfile: button.dataset.profile });
};
controls.addEventListener('click', select);
// Remove this listener when the surrounding application disposes this view.
const dispose = () => {
  controls.removeEventListener('click', select);
  scope.remove();
};
</script>
`),
};
