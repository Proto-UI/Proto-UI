import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '../../../../components/PrototypePreviewer/runtimes/ids';

const shadcnSnippets = {
  wc: {
    'demo-shadcn-checkbox': formatCode(`
<div class="flex max-w-sm flex-col gap-5">
  <div class="flex items-center gap-3">
    <wc-shadcn-checkbox-root style-profile="rhea">
      <wc-shadcn-checkbox-indicator style-profile="rhea"></wc-shadcn-checkbox-indicator>
    </wc-shadcn-checkbox-root>
    <wc-shadcn-label-root style-profile="rhea">Accept terms and conditions</wc-shadcn-label-root>
  </div>
  <div class="flex items-start gap-3">
    <wc-shadcn-checkbox-root style-profile="rhea" default-checked>
      <wc-shadcn-checkbox-indicator style-profile="rhea"></wc-shadcn-checkbox-indicator>
    </wc-shadcn-checkbox-root>
    <div class="grid gap-1.5 leading-none">
      <wc-shadcn-label-root style-profile="rhea">Accept terms and conditions</wc-shadcn-label-root>
      <p class="text-sm text-muted-foreground">By clicking this checkbox, you agree to the terms and conditions.</p>
    </div>
  </div>
  <div class="flex items-center gap-3 opacity-60">
    <wc-shadcn-checkbox-root style-profile="rhea" disabled>
      <wc-shadcn-checkbox-indicator style-profile="rhea"></wc-shadcn-checkbox-indicator>
    </wc-shadcn-checkbox-root>
    <wc-shadcn-label-root style-profile="rhea">Enable notifications</wc-shadcn-label-root>
  </div>
  <div class="flex items-start gap-3 rounded-lg border p-3">
    <wc-shadcn-checkbox-root style-profile="rhea" default-checked>
      <wc-shadcn-checkbox-indicator style-profile="rhea"></wc-shadcn-checkbox-indicator>
    </wc-shadcn-checkbox-root>
    <div class="grid gap-1.5 leading-none">
      <wc-shadcn-label-root style-profile="rhea">Enable notifications</wc-shadcn-label-root>
      <p class="text-sm text-muted-foreground">You can enable or disable notifications at any time.</p>
    </div>
  </div>
</div>
    `),
    'demo-shadcn-checkbox-description': formatCode(`
<div class="flex items-start gap-3">
  <wc-shadcn-checkbox-root style-profile="rhea" default-checked>
    <wc-shadcn-checkbox-indicator style-profile="rhea"></wc-shadcn-checkbox-indicator>
  </wc-shadcn-checkbox-root>
  <div class="grid gap-1.5 leading-none">
    <wc-shadcn-label-root style-profile="rhea">Accept terms and conditions</wc-shadcn-label-root>
    <p class="text-sm text-muted-foreground">By clicking this checkbox, you agree to the terms and conditions.</p>
  </div>
</div>
    `),
    'demo-shadcn-checkbox-disabled': formatCode(`
<div class="flex flex-col gap-3.5">
  <div class="flex items-center gap-3 opacity-60">
    <wc-shadcn-checkbox-root style-profile="rhea" disabled>
      <wc-shadcn-checkbox-indicator style-profile="rhea"></wc-shadcn-checkbox-indicator>
    </wc-shadcn-checkbox-root>
    <wc-shadcn-label-root style-profile="rhea">Enable notifications</wc-shadcn-label-root>
  </div>
  <div class="flex items-center gap-3 opacity-60">
    <wc-shadcn-checkbox-root style-profile="rhea" disabled default-checked>
      <wc-shadcn-checkbox-indicator style-profile="rhea"></wc-shadcn-checkbox-indicator>
    </wc-shadcn-checkbox-root>
    <wc-shadcn-label-root style-profile="rhea">Audit logging enabled (locked)</wc-shadcn-label-root>
  </div>
  <div class="flex items-center gap-3">
    <wc-shadcn-checkbox-root style-profile="rhea" read-only default-checked>
      <wc-shadcn-checkbox-indicator style-profile="rhea"></wc-shadcn-checkbox-indicator>
    </wc-shadcn-checkbox-root>
    <wc-shadcn-label-root style-profile="rhea">Read-only consent (focusable, cannot toggle)</wc-shadcn-label-root>
  </div>
</div>
    `),
    'demo-shadcn-checkbox-invalid': formatCode(`
<wc-shadcn-field-root style-profile="rhea" invalid required>
  <div class="flex items-center gap-3">
    <wc-shadcn-field-checkbox style-profile="rhea">
      <wc-shadcn-checkbox-indicator style-profile="rhea"></wc-shadcn-checkbox-indicator>
    </wc-shadcn-field-checkbox>
    <wc-shadcn-field-label style-profile="rhea">Accept terms and conditions</wc-shadcn-field-label>
  </div>
  <wc-shadcn-field-error style-profile="rhea">
    You must accept the terms and conditions before continuing.
  </wc-shadcn-field-error>
</wc-shadcn-field-root>
    `),
    'demo-shadcn-checkbox-controlled': formatCode(`
<div class="flex items-center gap-3">
  <wc-shadcn-checkbox-root id="sync-checkbox" style-profile="rhea" indeterminate>
    <wc-shadcn-checkbox-indicator style-profile="rhea"></wc-shadcn-checkbox-indicator>
  </wc-shadcn-checkbox-root>
  <wc-shadcn-label-root style-profile="rhea">Sync workspace preferences</wc-shadcn-label-root>
</div>
    `),
    'demo-shadcn-checkbox-checklist': formatCode(`
<div class="flex flex-col gap-3">
  <wc-shadcn-checkbox-root style-profile="rhea" default-checked>
    <wc-shadcn-checkbox-indicator style-profile="rhea"></wc-shadcn-checkbox-indicator>
  </wc-shadcn-checkbox-root>
  <wc-shadcn-checkbox-root style-profile="rhea" default-checked>
    <wc-shadcn-checkbox-indicator style-profile="rhea"></wc-shadcn-checkbox-indicator>
  </wc-shadcn-checkbox-root>
  <wc-shadcn-checkbox-root style-profile="rhea">
    <wc-shadcn-checkbox-indicator style-profile="rhea"></wc-shadcn-checkbox-indicator>
  </wc-shadcn-checkbox-root>
  <wc-shadcn-checkbox-root style-profile="rhea">
    <wc-shadcn-checkbox-indicator style-profile="rhea"></wc-shadcn-checkbox-indicator>
  </wc-shadcn-checkbox-root>
</div>
    `),
    'demo-shadcn-checkbox-table': formatCode(`
<wc-shadcn-checkbox-root style-profile="rhea" indeterminate>
  <wc-shadcn-checkbox-indicator style-profile="rhea"></wc-shadcn-checkbox-indicator>
</wc-shadcn-checkbox-root>
    `),
    'demo-shadcn-checkbox-rtl': formatCode(`
<div dir="rtl" class="flex max-w-sm flex-col gap-4">
  <div class="flex items-center gap-3">
    <wc-shadcn-checkbox-root style-profile="rhea">
      <wc-shadcn-checkbox-indicator style-profile="rhea"></wc-shadcn-checkbox-indicator>
    </wc-shadcn-checkbox-root>
    <wc-shadcn-label-root style-profile="rhea">قبول الشروط والأحكام</wc-shadcn-label-root>
  </div>
</div>
    `),
  },
  react: {
    'demo-shadcn-checkbox': formatCode(`
import {
  ShadcnCheckboxIndicator,
  ShadcnCheckboxRoot,
  ShadcnLabelRoot,
} from '../proto-ui/components/react';

export function CheckboxDemo() {
  return (
    <div className="flex max-w-sm flex-col gap-5">
      <div className="flex items-center gap-3">
        <ShadcnCheckboxRoot styleProfile="rhea">
          <ShadcnCheckboxIndicator styleProfile="rhea" />
        </ShadcnCheckboxRoot>
        <ShadcnLabelRoot styleProfile="rhea">Accept terms and conditions</ShadcnLabelRoot>
      </div>
      <div className="flex items-start gap-3">
        <ShadcnCheckboxRoot styleProfile="rhea" defaultChecked>
          <ShadcnCheckboxIndicator styleProfile="rhea" />
        </ShadcnCheckboxRoot>
        <div className="grid gap-1.5 leading-none">
          <ShadcnLabelRoot styleProfile="rhea">Accept terms and conditions</ShadcnLabelRoot>
          <p className="text-sm text-muted-foreground">
            By clicking this checkbox, you agree to the terms and conditions.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 opacity-60">
        <ShadcnCheckboxRoot styleProfile="rhea" disabled>
          <ShadcnCheckboxIndicator styleProfile="rhea" />
        </ShadcnCheckboxRoot>
        <ShadcnLabelRoot styleProfile="rhea">Enable notifications</ShadcnLabelRoot>
      </div>
      <div className="flex items-start gap-3 rounded-lg border p-3">
        <ShadcnCheckboxRoot styleProfile="rhea" defaultChecked>
          <ShadcnCheckboxIndicator styleProfile="rhea" />
        </ShadcnCheckboxRoot>
        <div className="grid gap-1.5 leading-none">
          <ShadcnLabelRoot styleProfile="rhea">Enable notifications</ShadcnLabelRoot>
          <p className="text-sm text-muted-foreground">
            You can enable or disable notifications at any time.
          </p>
        </div>
      </div>
    </div>
  );
}
    `),
    'demo-shadcn-checkbox-description': formatCode(`
import {
  ShadcnCheckboxIndicator,
  ShadcnCheckboxRoot,
  ShadcnLabelRoot,
} from '../proto-ui/components/react';

export function CheckboxDescriptionDemo() {
  return (
    <div className="flex items-start gap-3">
      <ShadcnCheckboxRoot styleProfile="rhea" defaultChecked>
        <ShadcnCheckboxIndicator styleProfile="rhea" />
      </ShadcnCheckboxRoot>
      <div className="grid gap-1.5 leading-none">
        <ShadcnLabelRoot styleProfile="rhea">Accept terms and conditions</ShadcnLabelRoot>
        <p className="text-sm text-muted-foreground">
          By clicking this checkbox, you agree to the terms and conditions.
        </p>
      </div>
    </div>
  );
}
    `),
    'demo-shadcn-checkbox-disabled': formatCode(`
import {
  ShadcnCheckboxIndicator,
  ShadcnCheckboxRoot,
  ShadcnLabelRoot,
} from '../proto-ui/components/react';

export function CheckboxDisabledDemo() {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3 opacity-60">
        <ShadcnCheckboxRoot styleProfile="rhea" disabled>
          <ShadcnCheckboxIndicator styleProfile="rhea" />
        </ShadcnCheckboxRoot>
        <ShadcnLabelRoot styleProfile="rhea">Enable notifications</ShadcnLabelRoot>
      </div>
      <div className="flex items-center gap-3">
        <ShadcnCheckboxRoot styleProfile="rhea" readOnly defaultChecked>
          <ShadcnCheckboxIndicator styleProfile="rhea" />
        </ShadcnCheckboxRoot>
        <ShadcnLabelRoot styleProfile="rhea">Read-only consent (focusable, cannot toggle)</ShadcnLabelRoot>
      </div>
    </div>
  );
}
    `),
    'demo-shadcn-checkbox-invalid': formatCode(`
import {
  ShadcnCheckboxIndicator,
  ShadcnFieldCheckbox,
  ShadcnFieldError,
  ShadcnFieldLabel,
  ShadcnFieldRoot,
} from '../proto-ui/components/react';

export function CheckboxInvalidDemo() {
  return (
    <ShadcnFieldRoot styleProfile="rhea" invalid required>
      <div className="flex items-center gap-3">
        <ShadcnFieldCheckbox styleProfile="rhea">
          <ShadcnCheckboxIndicator styleProfile="rhea" />
        </ShadcnFieldCheckbox>
        <ShadcnFieldLabel styleProfile="rhea">Accept terms and conditions</ShadcnFieldLabel>
      </div>
      <ShadcnFieldError styleProfile="rhea">
        You must accept the terms and conditions before continuing.
      </ShadcnFieldError>
    </ShadcnFieldRoot>
  );
}
    `),
    'demo-shadcn-checkbox-controlled': formatCode(`
import * as React from 'react';
import {
  ShadcnCheckboxIndicator,
  ShadcnCheckboxRoot,
  ShadcnLabelRoot,
} from '../proto-ui/components/react';

export function CheckboxControlledDemo() {
  const [checked, setChecked] = React.useState(false);
  const [indeterminate, setIndeterminate] = React.useState(true);

  return (
    <div className="flex items-center gap-3">
      <ShadcnCheckboxRoot
        styleProfile="rhea"
        checked={checked}
        indeterminate={indeterminate}
        onCheckedChange={(detail) => {
          setChecked(detail.checked);
          setIndeterminate(detail.indeterminate);
        }}
      >
        <ShadcnCheckboxIndicator styleProfile="rhea" />
      </ShadcnCheckboxRoot>
      <ShadcnLabelRoot styleProfile="rhea">Sync workspace preferences</ShadcnLabelRoot>
    </div>
  );
}
    `),
    'demo-shadcn-checkbox-checklist': formatCode(`
import {
  ShadcnCheckboxIndicator,
  ShadcnCheckboxRoot,
  ShadcnLabelRoot,
} from '../proto-ui/components/react';

const items = [
  { id: 'hard-disks', label: 'Hard disks', defaultChecked: true },
  { id: 'external-disks', label: 'External disks', defaultChecked: true },
  { id: 'cds-dvds', label: 'CDs, DVDs, and iPods', defaultChecked: false },
  { id: 'connected-servers', label: 'Connected servers', defaultChecked: false },
];

export function CheckboxGroupDemo() {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3">
          <ShadcnCheckboxRoot styleProfile="rhea" defaultChecked={item.defaultChecked}>
            <ShadcnCheckboxIndicator styleProfile="rhea" />
          </ShadcnCheckboxRoot>
          <ShadcnLabelRoot styleProfile="rhea">{item.label}</ShadcnLabelRoot>
        </div>
      ))}
    </div>
  );
}
    `),
    'demo-shadcn-checkbox-table': formatCode(`
import * as React from 'react';
import {
  ShadcnCheckboxIndicator,
  ShadcnCheckboxRoot,
} from '../proto-ui/components/react';

const rows = ['1', '2', '3', '4'];

export function CheckboxTableDemo() {
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(['1']));
  const allSelected = selected.size === rows.length;
  const someSelected = selected.size > 0 && !allSelected;

  return (
    <ShadcnCheckboxRoot
      styleProfile="rhea"
      checked={allSelected}
      indeterminate={someSelected}
      onCheckedChange={({ checked }) =>
        setSelected(checked ? new Set(rows) : new Set())
      }
    >
      <ShadcnCheckboxIndicator styleProfile="rhea" />
    </ShadcnCheckboxRoot>
  );
}
    `),
    'demo-shadcn-checkbox-rtl': formatCode(`
import {
  ShadcnCheckboxIndicator,
  ShadcnCheckboxRoot,
  ShadcnLabelRoot,
} from '../proto-ui/components/react';

export function CheckboxRtlDemo() {
  return (
    <div dir="rtl" className="flex max-w-sm flex-col gap-4">
      <div className="flex items-center gap-3">
        <ShadcnCheckboxRoot styleProfile="rhea">
          <ShadcnCheckboxIndicator styleProfile="rhea" />
        </ShadcnCheckboxRoot>
        <ShadcnLabelRoot styleProfile="rhea">قبول الشروط والأحكام</ShadcnLabelRoot>
      </div>
    </div>
  );
}
    `),
  },
  vue: {
    'demo-shadcn-checkbox': formatCode(`
<script setup lang="ts">
import {
  ShadcnCheckboxIndicator,
  ShadcnCheckboxRoot,
  ShadcnLabelRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex max-w-sm flex-col gap-5">
    <div class="flex items-center gap-3">
      <ShadcnCheckboxRoot styleProfile="rhea">
        <ShadcnCheckboxIndicator styleProfile="rhea" />
      </ShadcnCheckboxRoot>
      <ShadcnLabelRoot styleProfile="rhea">Accept terms and conditions</ShadcnLabelRoot>
    </div>
    <div class="flex items-start gap-3">
      <ShadcnCheckboxRoot styleProfile="rhea" defaultChecked>
        <ShadcnCheckboxIndicator styleProfile="rhea" />
      </ShadcnCheckboxRoot>
      <div class="grid gap-1.5 leading-none">
        <ShadcnLabelRoot styleProfile="rhea">Accept terms and conditions</ShadcnLabelRoot>
        <p class="text-sm text-muted-foreground">
          By clicking this checkbox, you agree to the terms and conditions.
        </p>
      </div>
    </div>
    <div class="flex items-center gap-3 opacity-60">
      <ShadcnCheckboxRoot styleProfile="rhea" disabled>
        <ShadcnCheckboxIndicator styleProfile="rhea" />
      </ShadcnCheckboxRoot>
      <ShadcnLabelRoot styleProfile="rhea">Enable notifications</ShadcnLabelRoot>
    </div>
  </div>
</template>
    `),
    'demo-shadcn-checkbox-description': formatCode(`
<script setup lang="ts">
import {
  ShadcnCheckboxIndicator,
  ShadcnCheckboxRoot,
  ShadcnLabelRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex items-start gap-3">
    <ShadcnCheckboxRoot styleProfile="rhea" defaultChecked>
      <ShadcnCheckboxIndicator styleProfile="rhea" />
    </ShadcnCheckboxRoot>
    <div class="grid gap-1.5 leading-none">
      <ShadcnLabelRoot styleProfile="rhea">Accept terms and conditions</ShadcnLabelRoot>
      <p class="text-sm text-muted-foreground">
        By clicking this checkbox, you agree to the terms and conditions.
      </p>
    </div>
  </div>
</template>
    `),
    'demo-shadcn-checkbox-disabled': formatCode(`
<script setup lang="ts">
import {
  ShadcnCheckboxIndicator,
  ShadcnCheckboxRoot,
  ShadcnLabelRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-col gap-3.5">
    <div class="flex items-center gap-3 opacity-60">
      <ShadcnCheckboxRoot styleProfile="rhea" disabled>
        <ShadcnCheckboxIndicator styleProfile="rhea" />
      </ShadcnCheckboxRoot>
      <ShadcnLabelRoot styleProfile="rhea">Enable notifications</ShadcnLabelRoot>
    </div>
    <div class="flex items-center gap-3">
      <ShadcnCheckboxRoot styleProfile="rhea" readOnly defaultChecked>
        <ShadcnCheckboxIndicator styleProfile="rhea" />
      </ShadcnCheckboxRoot>
      <ShadcnLabelRoot styleProfile="rhea">Read-only consent (focusable, cannot toggle)</ShadcnLabelRoot>
    </div>
  </div>
</template>
    `),
    'demo-shadcn-checkbox-invalid': formatCode(`
<script setup lang="ts">
import {
  ShadcnCheckboxIndicator,
  ShadcnFieldCheckbox,
  ShadcnFieldError,
  ShadcnFieldLabel,
  ShadcnFieldRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnFieldRoot styleProfile="rhea" invalid required>
    <div class="flex items-center gap-3">
      <ShadcnFieldCheckbox styleProfile="rhea">
        <ShadcnCheckboxIndicator styleProfile="rhea" />
      </ShadcnFieldCheckbox>
      <ShadcnFieldLabel styleProfile="rhea">Accept terms and conditions</ShadcnFieldLabel>
    </div>
    <ShadcnFieldError styleProfile="rhea">
      You must accept the terms and conditions before continuing.
    </ShadcnFieldError>
  </ShadcnFieldRoot>
</template>
    `),
    'demo-shadcn-checkbox-controlled': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  ShadcnCheckboxIndicator,
  ShadcnCheckboxRoot,
  ShadcnLabelRoot,
} from '../proto-ui/components/vue';

const checked = ref(false);
const indeterminate = ref(true);
</script>

<template>
  <div class="flex items-center gap-3">
    <ShadcnCheckboxRoot
      styleProfile="rhea"
      :checked="checked"
      :indeterminate="indeterminate"
      @checkedChange="(detail) => { checked = detail.checked; indeterminate = detail.indeterminate; }"
    >
      <ShadcnCheckboxIndicator styleProfile="rhea" />
    </ShadcnCheckboxRoot>
    <ShadcnLabelRoot styleProfile="rhea">Sync workspace preferences</ShadcnLabelRoot>
  </div>
</template>
    `),
    'demo-shadcn-checkbox-checklist': formatCode(`
<script setup lang="ts">
import {
  ShadcnCheckboxIndicator,
  ShadcnCheckboxRoot,
  ShadcnLabelRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center gap-3">
      <ShadcnCheckboxRoot styleProfile="rhea" defaultChecked>
        <ShadcnCheckboxIndicator styleProfile="rhea" />
      </ShadcnCheckboxRoot>
      <ShadcnLabelRoot styleProfile="rhea">Hard disks</ShadcnLabelRoot>
    </div>
    <div class="flex items-center gap-3">
      <ShadcnCheckboxRoot styleProfile="rhea" defaultChecked>
        <ShadcnCheckboxIndicator styleProfile="rhea" />
      </ShadcnCheckboxRoot>
      <ShadcnLabelRoot styleProfile="rhea">External disks</ShadcnLabelRoot>
    </div>
  </div>
</template>
    `),
    'demo-shadcn-checkbox-table': formatCode(`
<script setup lang="ts">
import {
  ShadcnCheckboxIndicator,
  ShadcnCheckboxRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnCheckboxRoot styleProfile="rhea" :checked="false" :indeterminate="true">
    <ShadcnCheckboxIndicator styleProfile="rhea" />
  </ShadcnCheckboxRoot>
</template>
    `),
    'demo-shadcn-checkbox-rtl': formatCode(`
<script setup lang="ts">
import {
  ShadcnCheckboxIndicator,
  ShadcnCheckboxRoot,
  ShadcnLabelRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <div dir="rtl" class="flex max-w-sm flex-col gap-4">
    <div class="flex items-center gap-3">
      <ShadcnCheckboxRoot styleProfile="rhea">
        <ShadcnCheckboxIndicator styleProfile="rhea" />
      </ShadcnCheckboxRoot>
      <ShadcnLabelRoot styleProfile="rhea">قبول الشروط والأحكام</ShadcnLabelRoot>
    </div>
  </div>
</template>
    `),
  },
  vue2: {
    'demo-shadcn-checkbox': formatCode(`
<template>
  <div class="flex max-w-sm flex-col gap-5">
    <div class="flex items-center gap-3">
      <ShadcnCheckboxRoot styleProfile="rhea">
        <ShadcnCheckboxIndicator styleProfile="rhea" />
      </ShadcnCheckboxRoot>
      <ShadcnLabelRoot styleProfile="rhea">Accept terms and conditions</ShadcnLabelRoot>
    </div>
    <div class="flex items-center gap-3">
      <ShadcnCheckboxRoot styleProfile="rhea" :defaultChecked="true">
        <ShadcnCheckboxIndicator styleProfile="rhea" />
      </ShadcnCheckboxRoot>
      <ShadcnLabelRoot styleProfile="rhea">Enable notifications</ShadcnLabelRoot>
    </div>
  </div>
</template>

<script>
import {
  ShadcnCheckboxIndicator,
  ShadcnCheckboxRoot,
  ShadcnLabelRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnCheckboxIndicator,
    ShadcnCheckboxRoot,
    ShadcnLabelRoot,
  },
};
</script>
    `),
    'demo-shadcn-checkbox-description': formatCode(`
<template>
  <div class="flex items-start gap-3">
    <ShadcnCheckboxRoot styleProfile="rhea" :defaultChecked="true">
      <ShadcnCheckboxIndicator styleProfile="rhea" />
    </ShadcnCheckboxRoot>
    <div class="grid gap-1.5 leading-none">
      <ShadcnLabelRoot styleProfile="rhea">Accept terms and conditions</ShadcnLabelRoot>
      <p class="text-sm text-muted-foreground">
        By clicking this checkbox, you agree to the terms and conditions.
      </p>
    </div>
  </div>
</template>

<script>
import {
  ShadcnCheckboxIndicator,
  ShadcnCheckboxRoot,
  ShadcnLabelRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnCheckboxIndicator,
    ShadcnCheckboxRoot,
    ShadcnLabelRoot,
  },
};
</script>
    `),
    'demo-shadcn-checkbox-disabled': formatCode(`
<template>
  <div class="flex flex-col gap-3.5">
    <div class="flex items-center gap-3 opacity-60">
      <ShadcnCheckboxRoot styleProfile="rhea" :disabled="true">
        <ShadcnCheckboxIndicator styleProfile="rhea" />
      </ShadcnCheckboxRoot>
      <ShadcnLabelRoot styleProfile="rhea">Enable notifications</ShadcnLabelRoot>
    </div>
    <div class="flex items-center gap-3">
      <ShadcnCheckboxRoot styleProfile="rhea" :readOnly="true" :defaultChecked="true">
        <ShadcnCheckboxIndicator styleProfile="rhea" />
      </ShadcnCheckboxRoot>
      <ShadcnLabelRoot styleProfile="rhea">Read-only consent (focusable, cannot toggle)</ShadcnLabelRoot>
    </div>
  </div>
</template>

<script>
import {
  ShadcnCheckboxIndicator,
  ShadcnCheckboxRoot,
  ShadcnLabelRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnCheckboxIndicator,
    ShadcnCheckboxRoot,
    ShadcnLabelRoot,
  },
};
</script>
    `),
    'demo-shadcn-checkbox-invalid': formatCode(`
<template>
  <ShadcnFieldRoot styleProfile="rhea" :invalid="true" :required="true">
    <div class="flex items-center gap-3">
      <ShadcnFieldCheckbox styleProfile="rhea">
        <ShadcnCheckboxIndicator styleProfile="rhea" />
      </ShadcnFieldCheckbox>
      <ShadcnFieldLabel styleProfile="rhea">Accept terms and conditions</ShadcnFieldLabel>
    </div>
    <ShadcnFieldError styleProfile="rhea">
      You must accept the terms and conditions before continuing.
    </ShadcnFieldError>
  </ShadcnFieldRoot>
</template>

<script>
import {
  ShadcnCheckboxIndicator,
  ShadcnFieldCheckbox,
  ShadcnFieldError,
  ShadcnFieldLabel,
  ShadcnFieldRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnCheckboxIndicator,
    ShadcnFieldCheckbox,
    ShadcnFieldError,
    ShadcnFieldLabel,
    ShadcnFieldRoot,
  },
};
</script>
    `),
    'demo-shadcn-checkbox-controlled': formatCode(`
<template>
  <div class="flex items-center gap-3">
    <ShadcnCheckboxRoot
      styleProfile="rhea"
      :checked="checked"
      :indeterminate="indeterminate"
      @checkedChange="onCheckedChange"
    >
      <ShadcnCheckboxIndicator styleProfile="rhea" />
    </ShadcnCheckboxRoot>
    <ShadcnLabelRoot styleProfile="rhea">Sync workspace preferences</ShadcnLabelRoot>
  </div>
</template>

<script>
import {
  ShadcnCheckboxIndicator,
  ShadcnCheckboxRoot,
  ShadcnLabelRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnCheckboxIndicator,
    ShadcnCheckboxRoot,
    ShadcnLabelRoot,
  },
  data() {
    return { checked: false, indeterminate: true };
  },
  methods: {
    onCheckedChange(detail) {
      this.checked = detail.checked;
      this.indeterminate = detail.indeterminate;
    },
  },
};
</script>
    `),
    'demo-shadcn-checkbox-checklist': formatCode(`
<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center gap-3">
      <ShadcnCheckboxRoot styleProfile="rhea" :defaultChecked="true">
        <ShadcnCheckboxIndicator styleProfile="rhea" />
      </ShadcnCheckboxRoot>
      <ShadcnLabelRoot styleProfile="rhea">Hard disks</ShadcnLabelRoot>
    </div>
    <div class="flex items-center gap-3">
      <ShadcnCheckboxRoot styleProfile="rhea" :defaultChecked="true">
        <ShadcnCheckboxIndicator styleProfile="rhea" />
      </ShadcnCheckboxRoot>
      <ShadcnLabelRoot styleProfile="rhea">External disks</ShadcnLabelRoot>
    </div>
  </div>
</template>

<script>
import {
  ShadcnCheckboxIndicator,
  ShadcnCheckboxRoot,
  ShadcnLabelRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnCheckboxIndicator,
    ShadcnCheckboxRoot,
    ShadcnLabelRoot,
  },
};
</script>
    `),
    'demo-shadcn-checkbox-table': formatCode(`
<template>
  <ShadcnCheckboxRoot styleProfile="rhea" :checked="false" :indeterminate="true">
    <ShadcnCheckboxIndicator styleProfile="rhea" />
  </ShadcnCheckboxRoot>
</template>

<script>
import {
  ShadcnCheckboxIndicator,
  ShadcnCheckboxRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnCheckboxIndicator,
    ShadcnCheckboxRoot,
  },
};
</script>
    `),
    'demo-shadcn-checkbox-rtl': formatCode(`
<template>
  <div dir="rtl" class="flex max-w-sm flex-col gap-4">
    <div class="flex items-center gap-3">
      <ShadcnCheckboxRoot styleProfile="rhea">
        <ShadcnCheckboxIndicator styleProfile="rhea" />
      </ShadcnCheckboxRoot>
      <ShadcnLabelRoot styleProfile="rhea">قبول الشروط والأحكام</ShadcnLabelRoot>
    </div>
  </div>
</template>

<script>
import {
  ShadcnCheckboxIndicator,
  ShadcnCheckboxRoot,
  ShadcnLabelRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnCheckboxIndicator,
    ShadcnCheckboxRoot,
    ShadcnLabelRoot,
  },
};
</script>
    `),
  },
};

function familyExampleCode(
  prefix: 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass',
  pascal: 'Brutalist' | 'Bootstrap232' | 'LiquidGlass',
  pkg: string,
  extraProps: { wc?: string; jsx?: string } = {},
  label = 'Accept terms and conditions'
) {
  const wcAttr = extraProps.wc ? ` ${extraProps.wc}` : '';
  const jsxAttr = extraProps.jsx ? ` ${extraProps.jsx}` : '';
  return {
    wc: formatCode(`
<div class="flex items-center gap-3">
  <wc-${prefix}-checkbox-root${wcAttr}>
    <wc-${prefix}-checkbox-indicator></wc-${prefix}-checkbox-indicator>
  </wc-${prefix}-checkbox-root>
  <wc-${prefix}-label-root>${label}</wc-${prefix}-label-root>
</div>
    `),
    react: formatCode(`
import {
  ${pascal}CheckboxIndicator,
  ${pascal}CheckboxRoot,
  ${pascal}LabelRoot,
} from '${pkg}';

export function CheckboxExample() {
  return (
    <div className="flex items-center gap-3">
      <${pascal}CheckboxRoot${jsxAttr}>
        <${pascal}CheckboxIndicator />
      </${pascal}CheckboxRoot>
      <${pascal}LabelRoot>${label}</${pascal}LabelRoot>
    </div>
  );
}
    `),
    vue: formatCode(`
<script setup lang="ts">
import {
  ${pascal}CheckboxIndicator,
  ${pascal}CheckboxRoot,
  ${pascal}LabelRoot,
} from '${pkg}';
</script>

<template>
  <div class="flex items-center gap-3">
    <${pascal}CheckboxRoot${jsxAttr}>
      <${pascal}CheckboxIndicator />
    </${pascal}CheckboxRoot>
    <${pascal}LabelRoot>${label}</${pascal}LabelRoot>
  </div>
</template>
    `),
    vue2: formatCode(`
<template>
  <div class="flex items-center gap-3">
    <${pascal}CheckboxRoot${jsxAttr}>
      <${pascal}CheckboxIndicator />
    </${pascal}CheckboxRoot>
    <${pascal}LabelRoot>${label}</${pascal}LabelRoot>
  </div>
</template>

<script>
import {
  ${pascal}CheckboxIndicator,
  ${pascal}CheckboxRoot,
  ${pascal}LabelRoot,
} from '${pkg}';

export default {
  components: {
    ${pascal}CheckboxIndicator,
    ${pascal}CheckboxRoot,
    ${pascal}LabelRoot,
  },
};
</script>
    `),
  };
}

const brutalistHero = familyExampleCode(
  'brutalist',
  'Brutalist',
  '@proto.ui/prototypes-brutalist/checkbox',
  { wc: 'default-checked', jsx: 'defaultChecked' }
);
const brutalistDesc = familyExampleCode(
  'brutalist',
  'Brutalist',
  '@proto.ui/prototypes-brutalist/checkbox',
  { wc: 'default-checked', jsx: 'defaultChecked' },
  'Accept terms and conditions'
);
const brutalistDisabled = familyExampleCode(
  'brutalist',
  'Brutalist',
  '@proto.ui/prototypes-brutalist/checkbox',
  { wc: 'disabled', jsx: 'disabled' },
  'Enable notifications'
);
const brutalistInvalid = {
  wc: formatCode(`
<wc-brutalist-field-root invalid required>
  <div class="flex items-center gap-3">
    <wc-brutalist-field-checkbox>
      <wc-brutalist-checkbox-indicator></wc-brutalist-checkbox-indicator>
    </wc-brutalist-field-checkbox>
    <wc-brutalist-field-label>Accept terms and conditions</wc-brutalist-field-label>
  </div>
  <wc-brutalist-field-error>
    You must accept the terms and conditions before continuing.
  </wc-brutalist-field-error>
</wc-brutalist-field-root>
  `),
  react: formatCode(`
import {
  BrutalistCheckboxIndicator,
  BrutalistFieldCheckbox,
  BrutalistFieldError,
  BrutalistFieldLabel,
  BrutalistFieldRoot,
} from '@proto.ui/prototypes-brutalist';

export function BrutalistCheckboxInvalid() {
  return (
    <BrutalistFieldRoot invalid required>
      <div className="flex items-center gap-3">
        <BrutalistFieldCheckbox>
          <BrutalistCheckboxIndicator />
        </BrutalistFieldCheckbox>
        <BrutalistFieldLabel>Accept terms and conditions</BrutalistFieldLabel>
      </div>
      <BrutalistFieldError>
        You must accept the terms and conditions before continuing.
      </BrutalistFieldError>
    </BrutalistFieldRoot>
  );
}
  `),
  vue: formatCode(`
<script setup lang="ts">
import {
  BrutalistCheckboxIndicator,
  BrutalistFieldCheckbox,
  BrutalistFieldError,
  BrutalistFieldLabel,
  BrutalistFieldRoot,
} from '@proto.ui/prototypes-brutalist';
</script>

<template>
  <BrutalistFieldRoot invalid required>
    <div class="flex items-center gap-3">
      <BrutalistFieldCheckbox>
        <BrutalistCheckboxIndicator />
      </BrutalistFieldCheckbox>
      <BrutalistFieldLabel>Accept terms and conditions</BrutalistFieldLabel>
    </div>
    <BrutalistFieldError>
      You must accept the terms and conditions before continuing.
    </BrutalistFieldError>
  </BrutalistFieldRoot>
</template>
  `),
  vue2: formatCode(`
<template>
  <BrutalistFieldRoot :invalid="true" :required="true">
    <div class="flex items-center gap-3">
      <BrutalistFieldCheckbox>
        <BrutalistCheckboxIndicator />
      </BrutalistFieldCheckbox>
      <BrutalistFieldLabel>Accept terms and conditions</BrutalistFieldLabel>
    </div>
    <BrutalistFieldError>
      You must accept the terms and conditions before continuing.
    </BrutalistFieldError>
  </BrutalistFieldRoot>
</template>

<script>
import {
  BrutalistCheckboxIndicator,
  BrutalistFieldCheckbox,
  BrutalistFieldError,
  BrutalistFieldLabel,
  BrutalistFieldRoot,
} from '@proto.ui/prototypes-brutalist';

export default {
  components: {
    BrutalistCheckboxIndicator,
    BrutalistFieldCheckbox,
    BrutalistFieldError,
    BrutalistFieldLabel,
    BrutalistFieldRoot,
  },
};
</script>
  `),
};
const brutalistGroup = familyExampleCode(
  'brutalist',
  'Brutalist',
  '@proto.ui/prototypes-brutalist/checkbox',
  { wc: 'default-checked', jsx: 'defaultChecked' },
  'Hard disks'
);
const brutalistTable = familyExampleCode(
  'brutalist',
  'Brutalist',
  '@proto.ui/prototypes-brutalist/checkbox',
  { wc: 'indeterminate', jsx: 'indeterminate' },
  'Select all rows'
);

const bootstrapHero = familyExampleCode(
  'bootstrap-2-3-2',
  'Bootstrap232',
  '@proto.ui/prototypes-bootstrap-2-3-2/checkbox',
  { wc: 'default-checked', jsx: 'defaultChecked' }
);
const bootstrapDesc = familyExampleCode(
  'bootstrap-2-3-2',
  'Bootstrap232',
  '@proto.ui/prototypes-bootstrap-2-3-2/checkbox',
  { wc: 'default-checked', jsx: 'defaultChecked' },
  'Accept terms and conditions'
);
const bootstrapDisabled = familyExampleCode(
  'bootstrap-2-3-2',
  'Bootstrap232',
  '@proto.ui/prototypes-bootstrap-2-3-2/checkbox',
  { wc: 'disabled', jsx: 'disabled' },
  'Enable notifications'
);
const bootstrapControlled = familyExampleCode(
  'bootstrap-2-3-2',
  'Bootstrap232',
  '@proto.ui/prototypes-bootstrap-2-3-2/checkbox',
  { wc: 'indeterminate', jsx: 'checked={false} indeterminate={true}' },
  'Sync workspace preferences'
);
const bootstrapGroup = familyExampleCode(
  'bootstrap-2-3-2',
  'Bootstrap232',
  '@proto.ui/prototypes-bootstrap-2-3-2/checkbox',
  { wc: 'default-checked', jsx: 'defaultChecked' },
  'Hard disks'
);
const bootstrapTable = familyExampleCode(
  'bootstrap-2-3-2',
  'Bootstrap232',
  '@proto.ui/prototypes-bootstrap-2-3-2/checkbox',
  { wc: 'indeterminate', jsx: 'indeterminate' },
  'Select all rows'
);

const liquidHero = familyExampleCode(
  'liquid-glass',
  'LiquidGlass',
  '@proto.ui/prototypes-liquid-glass/checkbox',
  { wc: 'default-checked', jsx: 'defaultChecked' },
  'Subscribe to release notes'
);
const liquidDesc = familyExampleCode(
  'liquid-glass',
  'LiquidGlass',
  '@proto.ui/prototypes-liquid-glass/checkbox',
  { wc: 'default-checked', jsx: 'defaultChecked' },
  'Accept terms and conditions'
);
const liquidDisabled = familyExampleCode(
  'liquid-glass',
  'LiquidGlass',
  '@proto.ui/prototypes-liquid-glass/checkbox',
  { wc: 'disabled default-checked', jsx: 'disabled defaultChecked' },
  'Audit logging enabled (locked)'
);
const liquidMaterial = familyExampleCode(
  'liquid-glass',
  'LiquidGlass',
  '@proto.ui/prototypes-liquid-glass/checkbox',
  { wc: 'material="opaque" default-checked', jsx: 'material="opaque" defaultChecked' },
  'Opaque surface (opaque)'
);
const liquidControlled = familyExampleCode(
  'liquid-glass',
  'LiquidGlass',
  '@proto.ui/prototypes-liquid-glass/checkbox',
  { wc: 'indeterminate', jsx: 'checked={false} indeterminate={true}' },
  'Sync workspace preferences'
);
const liquidTable = familyExampleCode(
  'liquid-glass',
  'LiquidGlass',
  '@proto.ui/prototypes-liquid-glass/checkbox',
  { wc: 'indeterminate', jsx: 'indeterminate' },
  'Select all rows'
);

const otherEntries = {
  'demo-brutalist-checkbox': brutalistHero,
  'demo-brutalist-checkbox-description': brutalistDesc,
  'demo-brutalist-checkbox-disabled': brutalistDisabled,
  'demo-brutalist-checkbox-invalid': brutalistInvalid,
  'demo-brutalist-checkbox-checklist': brutalistGroup,
  'demo-brutalist-checkbox-table': brutalistTable,
  'demo-bootstrap-2-3-2-checkbox': bootstrapHero,
  'demo-bootstrap-2-3-2-checkbox-description': bootstrapDesc,
  'demo-bootstrap-2-3-2-checkbox-disabled': bootstrapDisabled,
  'demo-bootstrap-2-3-2-checkbox-controlled': bootstrapControlled,
  'demo-bootstrap-2-3-2-checkbox-checklist': bootstrapGroup,
  'demo-bootstrap-2-3-2-checkbox-table': bootstrapTable,
  'demo-liquid-glass-checkbox': liquidHero,
  'demo-liquid-glass-checkbox-description': liquidDesc,
  'demo-liquid-glass-checkbox-disabled': liquidDisabled,
  'demo-liquid-glass-checkbox-material': liquidMaterial,
  'demo-liquid-glass-checkbox-controlled': liquidControlled,
  'demo-liquid-glass-checkbox-table': liquidTable,
};

function mergeRuntime(runtime: 'wc' | 'react' | 'vue' | 'vue2'): Record<string, string> {
  const merged: Record<string, string> = { ...shadcnSnippets[runtime] };
  for (const [id, entry] of Object.entries(otherEntries)) {
    merged[id] = entry[runtime];
  }
  return merged;
}

export const codeMap: Partial<Record<RuntimeId, Record<string, string>>> = {
  wc: mergeRuntime('wc'),
  react: mergeRuntime('react'),
  vue: mergeRuntime('vue'),
  vue2: mergeRuntime('vue2'),
};
