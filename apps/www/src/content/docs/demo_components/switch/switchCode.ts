import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

const shadcnBasic = (runtime: RuntimeId) => {
  if (runtime === 'wc') {
    return formatCode(`
<div class="flex items-center gap-2">
  <proto-ui-shadcn-switch id="airplane-mode">
    <span class="sr-only">Airplane Mode</span>
  </proto-ui-shadcn-switch>
  <span class="text-sm font-medium leading-none">Airplane Mode</span>
</div>
    `);
  }
  if (runtime === 'react') {
    return formatCode(`
import { ShadcnSwitch } from '@/components/ui/switch';

export function SwitchDemo() {
  return (
    <div className="flex items-center gap-2">
      <ShadcnSwitch id="airplane-mode" styleProfile="rhea">
        <span className="sr-only">Airplane Mode</span>
      </ShadcnSwitch>
      <span className="text-sm font-medium leading-none">Airplane Mode</span>
    </div>
  );
}
    `);
  }
  if (runtime === 'vue') {
    return formatCode(`
<script setup lang="ts">
import { ShadcnSwitch } from '@/components/ui/switch';
</script>

<template>
  <div class="flex items-center gap-2">
    <ShadcnSwitch id="airplane-mode" style-profile="rhea">
      <span class="sr-only">Airplane Mode</span>
    </ShadcnSwitch>
    <span class="text-sm font-medium leading-none">Airplane Mode</span>
  </div>
</template>
    `);
  }
  return formatCode(`
<script>
import { ShadcnSwitch } from '@/components/ui/switch';

export default {
  components: { ShadcnSwitch },
};
</script>

<template>
  <div class="flex items-center gap-2">
    <ShadcnSwitch id="airplane-mode" style-profile="rhea">
      <span class="sr-only">Airplane Mode</span>
    </ShadcnSwitch>
    <span class="text-sm font-medium leading-none">Airplane Mode</span>
  </div>
</template>
  `);
};

const fieldSwitchSnippet = (
  family: 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass',
  runtime: RuntimeId,
  options: {
    fieldProps?: string;
    switchProps?: string;
    label: string;
    description?: string;
    dir?: 'rtl';
    extraCard?: boolean;
  }
) => {
  const prefix =
    family === 'shadcn'
      ? 'Shadcn'
      : family === 'brutalist'
        ? 'Brutalist'
        : family === 'bootstrap-2-3-2'
          ? 'Bootstrap'
          : 'LiquidGlass';
  const tagPrefix = `proto-ui-${family}`;
  const dirAttr = options.dir ? ` dir="${options.dir}"` : '';
  const fieldProps = options.fieldProps ? ` ${options.fieldProps}` : '';
  const switchProps = options.switchProps ? ` ${options.switchProps}` : '';

  if (runtime === 'wc') {
    const desc = options.description
      ? `\n      <${tagPrefix}-field-description>${options.description}</${tagPrefix}-field-description>`
      : '';
    return formatCode(`
<${tagPrefix}-field-root${dirAttr}${fieldProps} class="flex max-w-sm flex-row items-center justify-between gap-4">
  <div class="flex min-w-0 flex-1 flex-col gap-1">
    <${tagPrefix}-field-label>${options.label}</${tagPrefix}-field-label>${desc}
  </div>
  <${tagPrefix}-field-switch${switchProps}>
    <${tagPrefix}-switch-thumb></${tagPrefix}-switch-thumb>
  </${tagPrefix}-field-switch>
</${tagPrefix}-field-root>
    `);
  }

  const imports = [
    `${prefix}FieldRoot`,
    `${prefix}FieldLabel`,
    ...(options.description ? [`${prefix}FieldDescription`] : []),
    `${prefix}FieldSwitch`,
    `${prefix}SwitchThumb`,
  ];
  const pkg =
    family === 'shadcn' ? '@/components/ui/switch' : `@proto.ui/prototypes-${family}/field`;

  if (runtime === 'react') {
    const desc = options.description
      ? `\n        <${prefix}FieldDescription>${options.description}</${prefix}FieldDescription>`
      : '';
    return formatCode(`
import { ${imports.join(', ')} } from '${pkg}';

export function SwitchExample() {
  return (
    <${prefix}FieldRoot${dirAttr}${fieldProps} className="flex max-w-sm flex-row items-center justify-between gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <${prefix}FieldLabel>${options.label}</${prefix}FieldLabel>${desc}
      </div>
      <${prefix}FieldSwitch${switchProps}>
        <${prefix}SwitchThumb />
      </${prefix}FieldSwitch>
    </${prefix}FieldRoot>
  );
}
    `);
  }

  const desc = options.description
    ? `\n        <${prefix}FieldDescription>${options.description}</${prefix}FieldDescription>`
    : '';
  if (runtime === 'vue') {
    return formatCode(`
<script setup lang="ts">
import { ${imports.join(', ')} } from '${pkg}';
</script>

<template>
  <${prefix}FieldRoot${dirAttr}${fieldProps} class="flex max-w-sm flex-row items-center justify-between gap-4">
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <${prefix}FieldLabel>${options.label}</${prefix}FieldLabel>${desc}
    </div>
    <${prefix}FieldSwitch${switchProps}>
      <${prefix}SwitchThumb />
    </${prefix}FieldSwitch>
  </${prefix}FieldRoot>
</template>
    `);
  }
  return formatCode(`
<script>
import { ${imports.join(', ')} } from '${pkg}';

export default {
  components: { ${imports.join(', ')} },
};
</script>

<template>
  <${prefix}FieldRoot${dirAttr}${fieldProps} class="flex max-w-sm flex-row items-center justify-between gap-4">
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <${prefix}FieldLabel>${options.label}</${prefix}FieldLabel>${desc}
    </div>
    <${prefix}FieldSwitch${switchProps}>
      <${prefix}SwitchThumb />
    </${prefix}FieldSwitch>
  </${prefix}FieldRoot>
</template>
  `);
};

const sizesSnippet = (family: 'shadcn' | 'brutalist', runtime: RuntimeId) => {
  const prefix = family === 'shadcn' ? 'Shadcn' : 'Brutalist';
  const tagPrefix = `proto-ui-${family}`;
  if (runtime === 'wc') {
    return formatCode(`
<div class="flex flex-col gap-4">
  <${tagPrefix}-field-root class="flex flex-row items-center gap-3">
    <${tagPrefix}-field-switch size="sm">
      <${tagPrefix}-switch-thumb></${tagPrefix}-switch-thumb>
    </${tagPrefix}-field-switch>
    <${tagPrefix}-field-label>Small</${tagPrefix}-field-label>
  </${tagPrefix}-field-root>
  <${tagPrefix}-field-root class="flex flex-row items-center gap-3">
    <${tagPrefix}-field-switch size="default" default-checked>
      <${tagPrefix}-switch-thumb></${tagPrefix}-switch-thumb>
    </${tagPrefix}-field-switch>
    <${tagPrefix}-field-label>Default</${tagPrefix}-field-label>
  </${tagPrefix}-field-root>
</div>
    `);
  }
  const imports = `${prefix}FieldRoot, ${prefix}FieldLabel, ${prefix}FieldSwitch, ${prefix}SwitchThumb`;
  if (runtime === 'react') {
    return formatCode(`
import { ${imports} } from '@/components/ui/switch';

export function SwitchSizes() {
  return (
    <div className="flex flex-col gap-4">
      <${prefix}FieldRoot className="flex flex-row items-center gap-3">
        <${prefix}FieldSwitch size="sm">
          <${prefix}SwitchThumb />
        </${prefix}FieldSwitch>
        <${prefix}FieldLabel>Small</${prefix}FieldLabel>
      </${prefix}FieldRoot>
      <${prefix}FieldRoot className="flex flex-row items-center gap-3">
        <${prefix}FieldSwitch size="default" defaultChecked>
          <${prefix}SwitchThumb />
        </${prefix}FieldSwitch>
        <${prefix}FieldLabel>Default</${prefix}FieldLabel>
      </${prefix}FieldRoot>
    </div>
  );
}
    `);
  }
  if (runtime === 'vue') {
    return formatCode(`
<script setup lang="ts">
import { ${imports} } from '@/components/ui/switch';
</script>

<template>
  <div class="flex flex-col gap-4">
    <${prefix}FieldRoot class="flex flex-row items-center gap-3">
      <${prefix}FieldSwitch size="sm">
        <${prefix}SwitchThumb />
      </${prefix}FieldSwitch>
      <${prefix}FieldLabel>Small</${prefix}FieldLabel>
    </${prefix}FieldRoot>
    <${prefix}FieldRoot class="flex flex-row items-center gap-3">
      <${prefix}FieldSwitch size="default" :default-checked="true">
        <${prefix}SwitchThumb />
      </${prefix}FieldSwitch>
      <${prefix}FieldLabel>Default</${prefix}FieldLabel>
    </${prefix}FieldRoot>
  </div>
</template>
    `);
  }
  return formatCode(`
<script>
import { ${imports} } from '@/components/ui/switch';

export default {
  components: { ${imports} },
};
</script>

<template>
  <div class="flex flex-col gap-4">
    <${prefix}FieldRoot class="flex flex-row items-center gap-3">
      <${prefix}FieldSwitch size="sm">
        <${prefix}SwitchThumb />
      </${prefix}FieldSwitch>
      <${prefix}FieldLabel>Small</${prefix}FieldLabel>
    </${prefix}FieldRoot>
    <${prefix}FieldRoot class="flex flex-row items-center gap-3">
      <${prefix}FieldSwitch size="default" :default-checked="true">
        <${prefix}SwitchThumb />
      </${prefix}FieldSwitch>
      <${prefix}FieldLabel>Default</${prefix}FieldLabel>
    </${prefix}FieldRoot>
  </div>
</template>
  `);
};

const heroRowSnippet = (
  family: 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass',
  runtime: RuntimeId
) => {
  const prefix =
    family === 'brutalist'
      ? 'Brutalist'
      : family === 'bootstrap-2-3-2'
        ? 'Bootstrap'
        : 'LiquidGlass';
  const tagPrefix = `proto-ui-${family}`;
  const extraProps = family === 'liquid-glass' ? ' material="auto"' : '';

  if (runtime === 'wc') {
    return formatCode(`
<div class="flex flex-wrap items-center gap-6">
  <div class="inline-flex items-center gap-2.5">
    <${tagPrefix}-switch-root${extraProps}>
      <${tagPrefix}-switch-thumb></${tagPrefix}-switch-thumb>
      <span class="sr-only">Airplane Mode</span>
    </${tagPrefix}-switch-root>
    <span class="text-sm font-medium">Airplane Mode</span>
  </div>
  <div class="inline-flex items-center gap-2.5">
    <${tagPrefix}-switch-root default-checked${extraProps}>
      <${tagPrefix}-switch-thumb></${tagPrefix}-switch-thumb>
      <span class="sr-only">Release alerts</span>
    </${tagPrefix}-switch-root>
    <span class="text-sm font-medium">Release alerts</span>
  </div>
  <div class="inline-flex items-center gap-2.5">
    <${tagPrefix}-switch-root disabled>
      <${tagPrefix}-switch-thumb></${tagPrefix}-switch-thumb>
      <span class="sr-only">Archived alerts</span>
    </${tagPrefix}-switch-root>
    <span class="text-sm font-medium">Archived alerts</span>
  </div>
</div>
    `);
  }

  const imports = `${prefix}SwitchRoot, ${prefix}SwitchThumb`;
  const pkg = `@proto.ui/prototypes-${family}/switch`;
  if (runtime === 'react') {
    return formatCode(`
import { ${imports} } from '${pkg}';

export function SwitchDemo() {
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="inline-flex items-center gap-2.5">
        <${prefix}SwitchRoot${extraProps}>
          <${prefix}SwitchThumb />
          <span className="sr-only">Airplane Mode</span>
        </${prefix}SwitchRoot>
        <span className="text-sm font-medium">Airplane Mode</span>
      </div>
      <div className="inline-flex items-center gap-2.5">
        <${prefix}SwitchRoot defaultChecked${extraProps}>
          <${prefix}SwitchThumb />
          <span className="sr-only">Release alerts</span>
        </${prefix}SwitchRoot>
        <span className="text-sm font-medium">Release alerts</span>
      </div>
      <div className="inline-flex items-center gap-2.5">
        <${prefix}SwitchRoot disabled>
          <${prefix}SwitchThumb />
          <span className="sr-only">Archived alerts</span>
        </${prefix}SwitchRoot>
        <span className="text-sm font-medium">Archived alerts</span>
      </div>
    </div>
  );
}
    `);
  }
  if (runtime === 'vue') {
    return formatCode(`
<script setup lang="ts">
import { ${imports} } from '${pkg}';
</script>

<template>
  <div class="flex flex-wrap items-center gap-6">
    <div class="inline-flex items-center gap-2.5">
      <${prefix}SwitchRoot${extraProps}>
        <${prefix}SwitchThumb />
        <span class="sr-only">Airplane Mode</span>
      </${prefix}SwitchRoot>
      <span class="text-sm font-medium">Airplane Mode</span>
    </div>
    <div class="inline-flex items-center gap-2.5">
      <${prefix}SwitchRoot :default-checked="true"${extraProps}>
        <${prefix}SwitchThumb />
        <span class="sr-only">Release alerts</span>
      </${prefix}SwitchRoot>
      <span class="text-sm font-medium">Release alerts</span>
    </div>
    <div class="inline-flex items-center gap-2.5">
      <${prefix}SwitchRoot :disabled="true">
        <${prefix}SwitchThumb />
        <span class="sr-only">Archived alerts</span>
      </${prefix}SwitchRoot>
      <span class="text-sm font-medium">Archived alerts</span>
    </div>
  </div>
</template>
    `);
  }
  return formatCode(`
<script>
import { ${imports} } from '${pkg}';

export default {
  components: { ${imports} },
};
</script>

<template>
  <div class="flex flex-wrap items-center gap-6">
    <div class="inline-flex items-center gap-2.5">
      <${prefix}SwitchRoot${extraProps}>
        <${prefix}SwitchThumb />
        <span class="sr-only">Airplane Mode</span>
      </${prefix}SwitchRoot>
      <span class="text-sm font-medium">Airplane Mode</span>
    </div>
    <div class="inline-flex items-center gap-2.5">
      <${prefix}SwitchRoot :default-checked="true"${extraProps}>
        <${prefix}SwitchThumb />
        <span class="sr-only">Release alerts</span>
      </${prefix}SwitchRoot>
      <span class="text-sm font-medium">Release alerts</span>
    </div>
    <div class="inline-flex items-center gap-2.5">
      <${prefix}SwitchRoot :disabled="true">
        <${prefix}SwitchThumb />
        <span class="sr-only">Archived alerts</span>
      </${prefix}SwitchRoot>
      <span class="text-sm font-medium">Archived alerts</span>
    </div>
  </div>
</template>
  `);
};

function buildRuntimeMap(runtime: RuntimeId): Record<string, string> {
  return {
    'demo-shadcn-switch': shadcnBasic(runtime),
    'demo-shadcn-switch-description': fieldSwitchSnippet('shadcn', runtime, {
      label: 'Share across devices',
      description: 'Focus is shared across devices, and turns off when you leave the app.',
    }),
    'demo-shadcn-switch-choice-card': fieldSwitchSnippet('shadcn', runtime, {
      label: 'Enable notifications',
      description: 'Receive notifications when focus mode is enabled or disabled.',
      switchProps: runtime === 'wc' ? 'default-checked' : 'defaultChecked',
    }),
    'demo-shadcn-switch-disabled': fieldSwitchSnippet('shadcn', runtime, {
      fieldProps: runtime === 'wc' ? 'disabled' : 'disabled',
      label: 'Disabled (off)',
    }),
    'demo-shadcn-switch-invalid': fieldSwitchSnippet('shadcn', runtime, {
      fieldProps: runtime === 'wc' ? 'invalid' : 'invalid',
      label: 'Accept terms and conditions',
      description: 'You must accept the terms and conditions to continue.',
    }),
    'demo-shadcn-switch-sizes': sizesSnippet('shadcn', runtime),
    'demo-shadcn-switch-rtl': fieldSwitchSnippet('shadcn', runtime, {
      dir: 'rtl',
      label: 'المشاركة عبر الأجهزة',
      description: 'يتم مشاركة التركيز عبر الأجهزة، ويتم إيقاف تشغيله عند مغادرة التطبيق.',
      switchProps:
        runtime === 'wc' ? 'direction="rtl" default-checked' : 'direction="rtl" defaultChecked',
    }),
    'demo-shadcn-switch-compositions': fieldSwitchSnippet('shadcn', runtime, {
      label: 'Draggable switch',
      description: 'Hold and drag the thumb across the track, then release to toggle.',
      switchProps: runtime === 'wc' ? 'draggable' : 'draggable',
    }),

    'demo-brutalist-switch': heroRowSnippet('brutalist', runtime),
    'demo-brutalist-switch-description': fieldSwitchSnippet('brutalist', runtime, {
      label: 'Share across devices',
      description: 'Focus is shared across devices, and turns off when you leave the app.',
    }),
    'demo-brutalist-switch-choice-card': fieldSwitchSnippet('brutalist', runtime, {
      label: 'Enable notifications',
      description: 'Receive notifications when focus mode is enabled or disabled.',
      switchProps: runtime === 'wc' ? 'default-checked' : 'defaultChecked',
    }),
    'demo-brutalist-switch-disabled': fieldSwitchSnippet('brutalist', runtime, {
      fieldProps: 'disabled',
      label: 'Disabled (off)',
    }),
    'demo-brutalist-switch-invalid': fieldSwitchSnippet('brutalist', runtime, {
      fieldProps: 'invalid',
      label: 'Accept terms and conditions',
      description: 'You must accept the terms and conditions to continue.',
    }),
    'demo-brutalist-switch-sizes': sizesSnippet('brutalist', runtime),

    'demo-bootstrap-2-3-2-switch': heroRowSnippet('bootstrap-2-3-2', runtime),
    'demo-bootstrap-2-3-2-switch-description': fieldSwitchSnippet('bootstrap-2-3-2', runtime, {
      label: 'Share across devices',
      description: 'Focus is shared across devices, and turns off when you leave the app.',
    }),
    'demo-bootstrap-2-3-2-switch-disabled': fieldSwitchSnippet('bootstrap-2-3-2', runtime, {
      fieldProps: 'disabled',
      label: 'Disabled (off)',
    }),
    'demo-bootstrap-2-3-2-switch-invalid': fieldSwitchSnippet('bootstrap-2-3-2', runtime, {
      fieldProps: 'invalid',
      label: 'Accept terms and conditions',
      description: 'You must accept the terms and conditions to continue.',
    }),
    'demo-bootstrap-2-3-2-switch-rtl-drag': fieldSwitchSnippet('bootstrap-2-3-2', runtime, {
      dir: 'rtl',
      label: 'المشاركة عبر الأجهزة',
      description: 'يتم مشاركة التركيز عبر الأجهزة، ويتم إيقاف تشغيله عند مغادرة التطبيق.',
      switchProps:
        runtime === 'wc'
          ? 'direction="rtl" draggable default-checked'
          : 'direction="rtl" draggable defaultChecked',
    }),

    'demo-liquid-glass-switch': heroRowSnippet('liquid-glass', runtime),
    'demo-liquid-glass-switch-description': fieldSwitchSnippet('liquid-glass', runtime, {
      label: 'Share across devices',
      description: 'Focus is shared across devices, and turns off when you leave the app.',
    }),
    'demo-liquid-glass-switch-material': fieldSwitchSnippet('liquid-glass', runtime, {
      label: 'Opaque surface',
      description: 'Opts out of translucency for dense forms or glass containers.',
      switchProps:
        runtime === 'wc' ? 'material="opaque" default-checked' : 'material="opaque" defaultChecked',
    }),
    'demo-liquid-glass-switch-disabled': fieldSwitchSnippet('liquid-glass', runtime, {
      fieldProps: 'disabled',
      label: 'Disabled (off)',
    }),
    'demo-liquid-glass-switch-invalid': fieldSwitchSnippet('liquid-glass', runtime, {
      fieldProps: 'invalid',
      label: 'Accept terms and conditions',
      description: 'You must accept the terms and conditions to continue.',
    }),
    'demo-liquid-glass-switch-rtl-drag': fieldSwitchSnippet('liquid-glass', runtime, {
      dir: 'rtl',
      label: 'المشاركة عبر الأجهزة',
      description: 'يتم مشاركة التركيز عبر الأجهزة، ويتم إيقاف تشغيله عند مغادرة التطبيق.',
      switchProps:
        runtime === 'wc'
          ? 'direction="rtl" draggable default-checked'
          : 'direction="rtl" draggable defaultChecked',
    }),
  };
}

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: buildRuntimeMap('wc'),
  react: buildRuntimeMap('react'),
  vue: buildRuntimeMap('vue'),
  vue2: buildRuntimeMap('vue2'),
};
