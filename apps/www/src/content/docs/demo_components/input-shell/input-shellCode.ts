import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Partial<Record<RuntimeId, Record<string, string>>> = {
  wc: {
    'demo-shadcn-input-shell-rhea': formatCode(`
<wc-shadcn-style-scope style-profile="rhea">
  <wc-shadcn-input-shell id="shell" focus-indicator="ring">
    <wc-shadcn-input-shell-control
      id="control"
      aria-label="Workspace search"
      placeholder="Search projects, teams, or docs…"
    ></wc-shadcn-input-shell-control>
  </wc-shadcn-input-shell>
</wc-shadcn-style-scope>

<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  import { bindInputShellControl } from '@proto.ui/prototypes-shadcn/input-shell';

  const shell = document.getElementById('shell');
  const control = document.getElementById('control');
  const shellProps = { styleProfile: 'inherit', focusIndicator: 'ring' };

  let current = true;
  const cleanups = new Set();
  bindInputShellControl(
    {
      isCurrent: () => current,
      onDispose(fn) {
        cleanups.add(fn);
        return () => cleanups.delete(fn);
      },
    },
    {
      instance: shell,
      setFacts(facts) {
        setElementProps(shell, { ...shellProps, ...facts });
      },
    },
    control
  );
</script>
    `),
    'demo-shadcn-input-shell-profiles': formatCode(`
<wc-shadcn-style-scope id="scope" style-profile="rhea">
  <wc-shadcn-input-shell id="shell" focus-indicator="ring">
    <wc-shadcn-input-shell-control
      id="control"
      default-value="Q4 Launch Plan"
      placeholder="Document title…"
      aria-label="Document title"
    ></wc-shadcn-input-shell-control>
  </wc-shadcn-input-shell>
</wc-shadcn-style-scope>

<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  import { bindInputShellControl } from '@proto.ui/prototypes-shadcn/input-shell';

  const scope = document.getElementById('scope');
  const shell = document.getElementById('shell');
  const control = document.getElementById('control');
  const shellProps = { styleProfile: 'inherit', focusIndicator: 'ring' };

  let current = true;
  const cleanups = new Set();
  bindInputShellControl(
    {
      isCurrent: () => current,
      onDispose(fn) {
        cleanups.add(fn);
        return () => cleanups.delete(fn);
      },
    },
    {
      instance: shell,
      setFacts(facts) {
        setElementProps(shell, { ...shellProps, ...facts });
      },
    },
    control
  );

  // Switch presets live without recreating the editor node:
  setElementProps(scope, { styleProfile: 'nova' });
</script>
    `),
    'demo-shadcn-input-shell-states': formatCode(`
<wc-shadcn-style-scope style-profile="rhea">
  <wc-shadcn-input-shell invalid focus-indicator="ring">
    <wc-shadcn-input-shell-control
      default-value="alex@company"
      placeholder="name@company.com"
      input-mode="email"
      aria-label="Work email"
    ></wc-shadcn-input-shell-control>
  </wc-shadcn-input-shell>

  <wc-shadcn-input-shell focus-indicator="ring">
    <wc-shadcn-input-shell-control
      read-only
      default-value="https://proto-ui.dev/docs"
      aria-label="Share URL"
    ></wc-shadcn-input-shell-control>
  </wc-shadcn-input-shell>

  <wc-shadcn-input-shell focus-indicator="ring">
    <wc-shadcn-input-shell-control
      disabled
      default-value="org_29a8f1c0"
      aria-label="Organization ID"
    ></wc-shadcn-input-shell-control>
  </wc-shadcn-input-shell>
</wc-shadcn-style-scope>
    `),
    'demo-shadcn-input-shell-command': formatCode(`
<wc-shadcn-style-scope style-profile="rhea">
  <wc-shadcn-command-root a11y-label="Quick actions">
    <wc-shadcn-input-shell id="cmd-shell" focus-indicator="none">
      <wc-shadcn-command-input
        id="cmd-input"
        placeholder="Type a command or search…"
        a11y-label="Command search"
      ></wc-shadcn-command-input>
    </wc-shadcn-input-shell>
    <wc-shadcn-command-content>
      <wc-shadcn-command-item value="calendar" text-value="Calendar">Calendar</wc-shadcn-command-item>
      <wc-shadcn-command-item value="billing" text-value="Billing">Billing</wc-shadcn-command-item>
      <wc-shadcn-command-item value="settings" text-value="Settings">Settings</wc-shadcn-command-item>
      <wc-shadcn-command-empty>No matching commands.</wc-shadcn-command-empty>
    </wc-shadcn-command-content>
  </wc-shadcn-command-root>
</wc-shadcn-style-scope>
    `),
    'demo-shadcn-input-shell-controlled': formatCode(`
<wc-shadcn-style-scope style-profile="rhea">
  <wc-shadcn-input-shell id="slug-shell" focus-indicator="ring">
    <wc-shadcn-input-shell-control
      id="slug-control"
      default-value="design-system"
      max-length="32"
      aria-label="Project slug"
    ></wc-shadcn-input-shell-control>
  </wc-shadcn-input-shell>
</wc-shadcn-style-scope>

<script type="module">
  const control = document.getElementById('slug-control');
  const exposes = control.getExposes();
  exposes.focusSelf();
  exposes.resetValue('design-system');
</script>
    `),
    'demo-shadcn-input-shell': formatCode(`
<wc-shadcn-style-scope style-profile="rhea">
  <wc-shadcn-input-shell id="shell" focus-indicator="ring">
    <wc-shadcn-input-shell-control
      id="control"
      aria-label="Search messages"
      placeholder="Search messages…"
    ></wc-shadcn-input-shell-control>
  </wc-shadcn-input-shell>
</wc-shadcn-style-scope>

<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  import { bindInputShellControl } from '@proto.ui/prototypes-shadcn/input-shell';

  const shell = document.getElementById('shell');
  const control = document.getElementById('control');
  const shellProps = { focusIndicator: 'ring' };

  let current = true;
  const cleanups = new Set();
  bindInputShellControl(
    {
      isCurrent: () => current,
      onDispose(fn) {
        cleanups.add(fn);
        return () => cleanups.delete(fn);
      },
    },
    {
      instance: shell,
      setFacts(facts) {
        setElementProps(shell, { ...shellProps, ...facts });
      },
    },
    control
  );
</script>
    `),
  },
  react: {
    'demo-shadcn-input-shell-rhea': formatCode(`
import { useEffect, useRef, useState } from 'react';
import {
  bindInputShellControl,
  type InputShellControlInstance,
} from '@proto.ui/prototypes-shadcn/input-shell';
import {
  ShadcnInputShell,
  ShadcnInputShellControl,
  ShadcnStyleScope,
} from '../proto-ui/components/react';

export function InputShellRheaDemo() {
  const shellRef = useRef<HTMLElement | null>(null);
  const controlRef = useRef<InputShellControlInstance | null>(null);
  const [facts, setFacts] = useState({ focusVisible: false, disabled: false });

  useEffect(() => {
    const shell = shellRef.current;
    const control = controlRef.current;
    if (!shell || !control) return;
    let current = true;
    const cleanups = new Set<VoidFunction>();
    const binding = bindInputShellControl(
      {
        isCurrent: () => current,
        onDispose(fn) {
          cleanups.add(fn);
          return () => cleanups.delete(fn);
        },
      },
      { instance: shell, setFacts },
      control
    );
    return () => {
      current = false;
      binding.dispose();
      for (const fn of [...cleanups]) fn();
    };
  }, []);

  return (
    <ShadcnStyleScope styleProfile="rhea">
      <ShadcnInputShell
        ref={shellRef}
        focusIndicator="ring"
        focusVisible={facts.focusVisible}
        disabled={facts.disabled}
      >
        <ShadcnInputShellControl
          ref={controlRef}
          ariaLabel="Workspace search"
          placeholder="Search projects, teams, or docs…"
        />
      </ShadcnInputShell>
    </ShadcnStyleScope>
  );
}
    `),
    'demo-shadcn-input-shell-profiles': formatCode(`
import { useState } from 'react';
import type { ShadcnStyleId } from '@proto.ui/prototypes-shadcn/style-scope';
import {
  ShadcnButton,
  ShadcnInputShell,
  ShadcnInputShellControl,
  ShadcnStyleScope,
} from '../proto-ui/components/react';

const PRESETS: ShadcnStyleId[] = ['rhea', 'new-york-v4', 'nova', 'maia', 'lyra', 'sera'];

export function InputShellProfilesDemo() {
  const [preset, setPreset] = useState<ShadcnStyleId>('rhea');

  return (
    <div className="grid max-w-md gap-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((item) => (
          <ShadcnButton
            key={item}
            size="sm"
            variant={item === preset ? 'default' : 'outline'}
            onClick={() => setPreset(item)}
          >
            {item}
          </ShadcnButton>
        ))}
      </div>
      <ShadcnStyleScope styleProfile={preset}>
        <ShadcnInputShell focusIndicator="ring">
          <ShadcnInputShellControl
            defaultValue="Q4 Launch Plan"
            placeholder="Document title…"
            ariaLabel="Document title"
          />
        </ShadcnInputShell>
      </ShadcnStyleScope>
    </div>
  );
}
    `),
    'demo-shadcn-input-shell-states': formatCode(`
import {
  ShadcnInputShell,
  ShadcnInputShellControl,
  ShadcnStyleScope,
} from '../proto-ui/components/react';

export function InputShellStatesDemo() {
  return (
    <ShadcnStyleScope styleProfile="rhea">
      <div className="grid max-w-sm gap-4">
        <ShadcnInputShell focusIndicator="ring" invalid>
          <ShadcnInputShellControl
            defaultValue="alex@company"
            placeholder="name@company.com"
            inputMode="email"
            ariaLabel="Work email"
          />
        </ShadcnInputShell>

        <ShadcnInputShell focusIndicator="ring">
          <ShadcnInputShellControl
            readOnly
            defaultValue="https://proto-ui.dev/docs"
            ariaLabel="Share URL"
          />
        </ShadcnInputShell>

        <ShadcnInputShell focusIndicator="ring" disabled>
          <ShadcnInputShellControl
            disabled
            defaultValue="org_29a8f1c0"
            ariaLabel="Organization ID"
          />
        </ShadcnInputShell>
      </div>
    </ShadcnStyleScope>
  );
}
    `),
    'demo-shadcn-input-shell-command': formatCode(`
import {
  ShadcnCommandContent,
  ShadcnCommandEmpty,
  ShadcnCommandInput,
  ShadcnCommandItem,
  ShadcnCommandRoot,
  ShadcnInputShell,
  ShadcnStyleScope,
} from '../proto-ui/components/react';

export function InputShellCommandDemo() {
  return (
    <ShadcnStyleScope styleProfile="rhea">
      <ShadcnCommandRoot a11yLabel="Quick actions">
        <ShadcnInputShell focusIndicator="none">
          <ShadcnCommandInput
            placeholder="Type a command or search…"
            a11yLabel="Command search"
          />
        </ShadcnInputShell>
        <ShadcnCommandContent>
          <ShadcnCommandItem value="calendar" textValue="Calendar">
            Calendar
          </ShadcnCommandItem>
          <ShadcnCommandItem value="billing" textValue="Billing">
            Billing
          </ShadcnCommandItem>
          <ShadcnCommandItem value="settings" textValue="Settings">
            Settings
          </ShadcnCommandItem>
          <ShadcnCommandEmpty>No matching commands.</ShadcnCommandEmpty>
        </ShadcnCommandContent>
      </ShadcnCommandRoot>
    </ShadcnStyleScope>
  );
}
    `),
    'demo-shadcn-input-shell-controlled': formatCode(`
import { useRef } from 'react';
import type { InputShellControlExposes } from '@proto.ui/prototypes-shadcn/input-shell';
import {
  ShadcnButton,
  ShadcnInputShell,
  ShadcnInputShellControl,
  ShadcnStyleScope,
} from '../proto-ui/components/react';

export function InputShellControlledDemo() {
  const controlRef = useRef<{ getExposes(): InputShellControlExposes } | null>(null);

  return (
    <ShadcnStyleScope styleProfile="rhea">
      <div className="grid max-w-sm gap-3">
        <ShadcnInputShell focusIndicator="ring">
          <ShadcnInputShellControl
            ref={controlRef}
            defaultValue="design-system"
            maxLength={32}
            ariaLabel="Project slug"
          />
        </ShadcnInputShell>
        <div className="flex gap-2">
          <ShadcnButton
            variant="outline"
            size="sm"
            onClick={() => controlRef.current?.getExposes().focusSelf()}
          >
            Focus input
          </ShadcnButton>
          <ShadcnButton
            variant="outline"
            size="sm"
            onClick={() => controlRef.current?.getExposes().resetValue('design-system')}
          >
            Reset value
          </ShadcnButton>
        </div>
      </div>
    </ShadcnStyleScope>
  );
}
    `),
    'demo-shadcn-input-shell': formatCode(`
import { useState } from 'react';
import {
  ShadcnButton,
  ShadcnInputShell,
  ShadcnInputShellControl,
  ShadcnStyleScope,
} from '../proto-ui/components/react';

export function InputShellToggleDisabledDemo() {
  const [disabled, setDisabled] = useState(false);

  return (
    <ShadcnStyleScope styleProfile="rhea">
      <div className="grid max-w-sm gap-3">
        <ShadcnInputShell focusIndicator="ring" disabled={disabled}>
          <ShadcnInputShellControl
            disabled={disabled}
            ariaLabel="Search messages"
            placeholder="Search messages…"
          />
        </ShadcnInputShell>
        <ShadcnButton variant="outline" size="sm" onClick={() => setDisabled((v) => !v)}>
          {disabled ? 'Enable input' : 'Disable input'}
        </ShadcnButton>
      </div>
    </ShadcnStyleScope>
  );
}
    `),
  },
  vue: {
    'demo-shadcn-input-shell-rhea': formatCode(`
<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import {
  bindInputShellControl,
  type InputShellControlInstance,
} from '@proto.ui/prototypes-shadcn/input-shell';
import {
  ShadcnInputShell,
  ShadcnInputShellControl,
  ShadcnStyleScope,
} from '../proto-ui/components/vue';

const shellRef = ref<object | null>(null);
const controlRef = ref<InputShellControlInstance | null>(null);
const facts = reactive({ focusVisible: false, disabled: false });
let dispose = () => {};

onMounted(() => {
  if (!shellRef.value || !controlRef.value) return;
  let current = true;
  const cleanups = new Set<VoidFunction>();
  const binding = bindInputShellControl(
    {
      isCurrent: () => current,
      onDispose(fn) {
        cleanups.add(fn);
        return () => cleanups.delete(fn);
      },
    },
    {
      instance: shellRef.value,
      setFacts(next) {
        facts.focusVisible = next.focusVisible;
        facts.disabled = next.disabled;
      },
    },
    controlRef.value
  );
  dispose = () => {
    current = false;
    binding.dispose();
    for (const fn of [...cleanups]) fn();
  };
});

onBeforeUnmount(() => dispose());
</script>

<template>
  <ShadcnStyleScope styleProfile="rhea">
    <ShadcnInputShell
      ref="shellRef"
      focusIndicator="ring"
      :focusVisible="facts.focusVisible"
      :disabled="facts.disabled"
    >
      <ShadcnInputShellControl
        ref="controlRef"
        ariaLabel="Workspace search"
        placeholder="Search projects, teams, or docs…"
      />
    </ShadcnInputShell>
  </ShadcnStyleScope>
</template>
    `),
    'demo-shadcn-input-shell-profiles': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import type { ShadcnStyleId } from '@proto.ui/prototypes-shadcn/style-scope';
import {
  ShadcnButton,
  ShadcnInputShell,
  ShadcnInputShellControl,
  ShadcnStyleScope,
} from '../proto-ui/components/vue';

const presets: ShadcnStyleId[] = ['rhea', 'new-york-v4', 'nova', 'maia', 'lyra', 'sera'];
const preset = ref<ShadcnStyleId>('rhea');
</script>

<template>
  <div class="grid max-w-md gap-4">
    <div class="flex flex-wrap gap-2">
      <ShadcnButton
        v-for="item in presets"
        :key="item"
        size="sm"
        :variant="item === preset ? 'default' : 'outline'"
        @click="preset = item"
      >
        {{ item }}
      </ShadcnButton>
    </div>
    <ShadcnStyleScope :styleProfile="preset">
      <ShadcnInputShell focusIndicator="ring">
        <ShadcnInputShellControl
          defaultValue="Q4 Launch Plan"
          placeholder="Document title…"
          ariaLabel="Document title"
        />
      </ShadcnInputShell>
    </ShadcnStyleScope>
  </div>
</template>
    `),
    'demo-shadcn-input-shell-states': formatCode(`
<script setup lang="ts">
import {
  ShadcnInputShell,
  ShadcnInputShellControl,
  ShadcnStyleScope,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnStyleScope styleProfile="rhea">
    <div class="grid max-w-sm gap-4">
      <ShadcnInputShell focusIndicator="ring" invalid>
        <ShadcnInputShellControl
          defaultValue="alex@company"
          placeholder="name@company.com"
          inputMode="email"
          ariaLabel="Work email"
        />
      </ShadcnInputShell>
      <ShadcnInputShell focusIndicator="ring">
        <ShadcnInputShellControl
          readOnly
          defaultValue="https://proto-ui.dev/docs"
          ariaLabel="Share URL"
        />
      </ShadcnInputShell>
      <ShadcnInputShell focusIndicator="ring" disabled>
        <ShadcnInputShellControl
          disabled
          defaultValue="org_29a8f1c0"
          ariaLabel="Organization ID"
        />
      </ShadcnInputShell>
    </div>
  </ShadcnStyleScope>
</template>
    `),
    'demo-shadcn-input-shell-command': formatCode(`
<script setup lang="ts">
import {
  ShadcnCommandContent,
  ShadcnCommandEmpty,
  ShadcnCommandInput,
  ShadcnCommandItem,
  ShadcnCommandRoot,
  ShadcnInputShell,
  ShadcnStyleScope,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnStyleScope styleProfile="rhea">
    <ShadcnCommandRoot a11yLabel="Quick actions">
      <ShadcnInputShell focusIndicator="none">
        <ShadcnCommandInput placeholder="Type a command or search…" a11yLabel="Command search" />
      </ShadcnInputShell>
      <ShadcnCommandContent>
        <ShadcnCommandItem value="calendar" textValue="Calendar">Calendar</ShadcnCommandItem>
        <ShadcnCommandItem value="billing" textValue="Billing">Billing</ShadcnCommandItem>
        <ShadcnCommandItem value="settings" textValue="Settings">Settings</ShadcnCommandItem>
        <ShadcnCommandEmpty>No matching commands.</ShadcnCommandEmpty>
      </ShadcnCommandContent>
    </ShadcnCommandRoot>
  </ShadcnStyleScope>
</template>
    `),
    'demo-shadcn-input-shell-controlled': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import type { InputShellControlExposes } from '@proto.ui/prototypes-shadcn/input-shell';
import {
  ShadcnButton,
  ShadcnInputShell,
  ShadcnInputShellControl,
  ShadcnStyleScope,
} from '../proto-ui/components/vue';

const controlRef = ref<{ getExposes(): InputShellControlExposes } | null>(null);
</script>

<template>
  <ShadcnStyleScope styleProfile="rhea">
    <div class="grid max-w-sm gap-3">
      <ShadcnInputShell focusIndicator="ring">
        <ShadcnInputShellControl
          ref="controlRef"
          defaultValue="design-system"
          :maxLength="32"
          ariaLabel="Project slug"
        />
      </ShadcnInputShell>
      <div class="flex gap-2">
        <ShadcnButton variant="outline" size="sm" @click="controlRef?.getExposes().focusSelf()">
          Focus input
        </ShadcnButton>
        <ShadcnButton
          variant="outline"
          size="sm"
          @click="controlRef?.getExposes().resetValue('design-system')"
        >
          Reset value
        </ShadcnButton>
      </div>
    </div>
  </ShadcnStyleScope>
</template>
    `),
    'demo-shadcn-input-shell': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  ShadcnButton,
  ShadcnInputShell,
  ShadcnInputShellControl,
  ShadcnStyleScope,
} from '../proto-ui/components/vue';

const disabled = ref(false);
</script>

<template>
  <ShadcnStyleScope styleProfile="rhea">
    <div class="grid max-w-sm gap-3">
      <ShadcnInputShell focusIndicator="ring" :disabled="disabled">
        <ShadcnInputShellControl
          :disabled="disabled"
          ariaLabel="Search messages"
          placeholder="Search messages…"
        />
      </ShadcnInputShell>
      <ShadcnButton variant="outline" size="sm" @click="disabled = !disabled">
        {{ disabled ? 'Enable input' : 'Disable input' }}
      </ShadcnButton>
    </div>
  </ShadcnStyleScope>
</template>
    `),
  },
  vue2: {
    'demo-shadcn-input-shell-rhea': formatCode(`
<template>
  <ShadcnStyleScope styleProfile="rhea">
    <ShadcnInputShell focusIndicator="ring">
      <ShadcnInputShellControl
        ariaLabel="Workspace search"
        placeholder="Search projects, teams, or docs…"
      />
    </ShadcnInputShell>
  </ShadcnStyleScope>
</template>

<script>
import {
  ShadcnInputShell,
  ShadcnInputShellControl,
  ShadcnStyleScope,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnInputShell,
    ShadcnInputShellControl,
    ShadcnStyleScope,
  },
};
</script>
    `),
    'demo-shadcn-input-shell-profiles': formatCode(`
<template>
  <div class="grid max-w-md gap-4">
    <div class="flex flex-wrap gap-2">
      <ShadcnButton
        v-for="item in presets"
        :key="item"
        size="sm"
        :variant="item === preset ? 'default' : 'outline'"
        @click="preset = item"
      >
        {{ item }}
      </ShadcnButton>
    </div>
    <ShadcnStyleScope :styleProfile="preset">
      <ShadcnInputShell focusIndicator="ring">
        <ShadcnInputShellControl
          defaultValue="Q4 Launch Plan"
          placeholder="Document title…"
          ariaLabel="Document title"
        />
      </ShadcnInputShell>
    </ShadcnStyleScope>
  </div>
</template>

<script>
import {
  ShadcnButton,
  ShadcnInputShell,
  ShadcnInputShellControl,
  ShadcnStyleScope,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnButton,
    ShadcnInputShell,
    ShadcnInputShellControl,
    ShadcnStyleScope,
  },
  data() {
    return {
      presets: ['rhea', 'new-york-v4', 'nova', 'maia', 'lyra', 'sera'],
      preset: 'rhea',
    };
  },
};
</script>
    `),
    'demo-shadcn-input-shell-states': formatCode(`
<template>
  <ShadcnStyleScope styleProfile="rhea">
    <div class="grid max-w-sm gap-4">
      <ShadcnInputShell focusIndicator="ring" invalid>
        <ShadcnInputShellControl
          defaultValue="alex@company"
          placeholder="name@company.com"
          inputMode="email"
          ariaLabel="Work email"
        />
      </ShadcnInputShell>
      <ShadcnInputShell focusIndicator="ring">
        <ShadcnInputShellControl
          readOnly
          defaultValue="https://proto-ui.dev/docs"
          ariaLabel="Share URL"
        />
      </ShadcnInputShell>
      <ShadcnInputShell focusIndicator="ring" disabled>
        <ShadcnInputShellControl
          disabled
          defaultValue="org_29a8f1c0"
          ariaLabel="Organization ID"
        />
      </ShadcnInputShell>
    </div>
  </ShadcnStyleScope>
</template>

<script>
import {
  ShadcnInputShell,
  ShadcnInputShellControl,
  ShadcnStyleScope,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnInputShell,
    ShadcnInputShellControl,
    ShadcnStyleScope,
  },
};
</script>
    `),
    'demo-shadcn-input-shell-command': formatCode(`
<template>
  <ShadcnStyleScope styleProfile="rhea">
    <ShadcnCommandRoot a11yLabel="Quick actions">
      <ShadcnInputShell focusIndicator="none">
        <ShadcnCommandInput placeholder="Type a command or search…" a11yLabel="Command search" />
      </ShadcnInputShell>
      <ShadcnCommandContent>
        <ShadcnCommandItem value="calendar" textValue="Calendar">Calendar</ShadcnCommandItem>
        <ShadcnCommandItem value="billing" textValue="Billing">Billing</ShadcnCommandItem>
        <ShadcnCommandItem value="settings" textValue="Settings">Settings</ShadcnCommandItem>
        <ShadcnCommandEmpty>No matching commands.</ShadcnCommandEmpty>
      </ShadcnCommandContent>
    </ShadcnCommandRoot>
  </ShadcnStyleScope>
</template>

<script>
import {
  ShadcnCommandContent,
  ShadcnCommandEmpty,
  ShadcnCommandInput,
  ShadcnCommandItem,
  ShadcnCommandRoot,
  ShadcnInputShell,
  ShadcnStyleScope,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnCommandContent,
    ShadcnCommandEmpty,
    ShadcnCommandInput,
    ShadcnCommandItem,
    ShadcnCommandRoot,
    ShadcnInputShell,
    ShadcnStyleScope,
  },
};
</script>
    `),
    'demo-shadcn-input-shell-controlled': formatCode(`
<template>
  <ShadcnStyleScope styleProfile="rhea">
    <div class="grid max-w-sm gap-3">
      <ShadcnInputShell focusIndicator="ring">
        <ShadcnInputShellControl
          ref="control"
          defaultValue="design-system"
          :maxLength="32"
          ariaLabel="Project slug"
        />
      </ShadcnInputShell>
      <div class="flex gap-2">
        <ShadcnButton variant="outline" size="sm" @click="focusInput">Focus input</ShadcnButton>
        <ShadcnButton variant="outline" size="sm" @click="resetInput">Reset value</ShadcnButton>
      </div>
    </div>
  </ShadcnStyleScope>
</template>

<script>
import {
  ShadcnButton,
  ShadcnInputShell,
  ShadcnInputShellControl,
  ShadcnStyleScope,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnButton,
    ShadcnInputShell,
    ShadcnInputShellControl,
    ShadcnStyleScope,
  },
  methods: {
    focusInput() {
      this.$refs.control && this.$refs.control.getExposes().focusSelf();
    },
    resetInput() {
      this.$refs.control && this.$refs.control.getExposes().resetValue('design-system');
    },
  },
};
</script>
    `),
    'demo-shadcn-input-shell': formatCode(`
<template>
  <ShadcnStyleScope styleProfile="rhea">
    <div class="grid max-w-sm gap-3">
      <ShadcnInputShell focusIndicator="ring" :disabled="disabled">
        <ShadcnInputShellControl
          :disabled="disabled"
          ariaLabel="Search messages"
          placeholder="Search messages…"
        />
      </ShadcnInputShell>
      <ShadcnButton variant="outline" size="sm" @click="disabled = !disabled">
        {{ disabled ? 'Enable input' : 'Disable input' }}
      </ShadcnButton>
    </div>
  </ShadcnStyleScope>
</template>

<script>
import {
  ShadcnButton,
  ShadcnInputShell,
  ShadcnInputShellControl,
  ShadcnStyleScope,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnButton,
    ShadcnInputShell,
    ShadcnInputShellControl,
    ShadcnStyleScope,
  },
  data() {
    return { disabled: false };
  },
};
</script>
    `),
  },
};
