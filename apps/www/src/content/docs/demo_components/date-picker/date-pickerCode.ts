import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';
import type { DatePickerDemoFamily } from './date-picker-demo.shared';

interface FamilyMeta {
  prefix: DatePickerDemoFamily;
  pascal: string;
  isShadcn: boolean;
  isLiquidGlass: boolean;
}

const FAMILIES: readonly FamilyMeta[] = [
  { prefix: 'shadcn', pascal: 'Shadcn', isShadcn: true, isLiquidGlass: false },
  { prefix: 'brutalist', pascal: 'Brutalist', isShadcn: false, isLiquidGlass: false },
  { prefix: 'bootstrap-2-3-2', pascal: 'Bootstrap232', isShadcn: false, isLiquidGlass: false },
  { prefix: 'liquid-glass', pascal: 'LiquidGlass', isShadcn: false, isLiquidGlass: true },
];

type ExampleKind = 'hero' | 'basic' | 'range' | 'multiple' | 'selection' | 'rtl';

interface ExampleSpec {
  kind: ExampleKind;
  suffix: string;
  fnSuffix: string;
  label?: string;
  placeholder: string;
  triggerClass: string;
  wcProps: string;
  reactProps: string;
  vueProps: string;
  triggerExtraReact?: (f: FamilyMeta) => string;
  triggerExtraVue?: (f: FamilyMeta) => string;
  triggerExtraWc?: (f: FamilyMeta) => string;
}

const EXAMPLES: readonly ExampleSpec[] = [
  {
    kind: 'hero',
    suffix: '',
    fnSuffix: 'Demo',
    placeholder: 'Pick a date',
    triggerClass: 'w-56',
    wcProps: "{ defaultMonth: '2026-10', today: '2026-10-15' }",
    reactProps: 'defaultMonth="2026-10" today="2026-10-15"',
    vueProps: 'default-month="2026-10" today="2026-10-15"',
  },
  {
    kind: 'basic',
    suffix: '-basic',
    fnSuffix: 'BasicDemo',
    label: 'Date',
    placeholder: 'Pick a date',
    triggerClass: 'w-56',
    wcProps:
      "{ defaultMonth: '2026-10', defaultValue: '2026-10-15', min: '2026-10-01', max: '2026-11-30' }",
    reactProps:
      'defaultMonth="2026-10" defaultValue="2026-10-15" min="2026-10-01" max="2026-11-30"',
    vueProps:
      'default-month="2026-10" default-value="2026-10-15" min="2026-10-01" max="2026-11-30"',
  },
  {
    kind: 'range',
    suffix: '-range',
    fnSuffix: 'RangeDemo',
    label: 'Date Picker Range',
    placeholder: 'Pick a date range',
    triggerClass: 'w-64',
    wcProps:
      "{ mode: 'range', defaultMonth: '2026-10', defaultRange: { from: '2026-10-10', to: '2026-10-16' }, unavailable: ['2026-10-18'], minNights: 1, maxNights: 14 }",
    reactProps:
      'mode="range" defaultMonth="2026-10" defaultRange={{ from: "2026-10-10", to: "2026-10-16" }} unavailable={["2026-10-18"]} minNights={1} maxNights={14}',
    vueProps:
      'mode="range" default-month="2026-10" :default-range="{ from: \'2026-10-10\', to: \'2026-10-16\' }" :unavailable="[\'2026-10-18\']" :min-nights="1" :max-nights="14"',
  },
  {
    kind: 'multiple',
    suffix: '-multiple',
    fnSuffix: 'MultipleDemo',
    label: 'Multiple Dates',
    placeholder: 'Pick dates',
    triggerClass: 'w-64',
    wcProps:
      "{ mode: 'multiple', defaultMonth: '2026-10', defaultValues: ['2026-10-05', '2026-10-12'], maxSelected: 4, unavailable: ['2026-10-18', '2026-10-19'] }",
    reactProps:
      'mode="multiple" defaultMonth="2026-10" defaultValues={["2026-10-05", "2026-10-12"]} maxSelected={4} unavailable={["2026-10-18", "2026-10-19"]}',
    vueProps:
      'mode="multiple" default-month="2026-10" :default-values="[\'2026-10-05\', \'2026-10-12\']" :max-selected="4" :unavailable="[\'2026-10-18\', \'2026-10-19\']"',
    triggerExtraReact: (f) => (f.isLiquidGlass ? ' variant="prominent"' : ''),
    triggerExtraVue: (f) => (f.isLiquidGlass ? ' variant="prominent"' : ''),
    triggerExtraWc: (f) => (f.isLiquidGlass ? ", variant: 'prominent'" : ''),
  },
  {
    kind: 'selection',
    suffix: '-selection',
    fnSuffix: 'SelectionDemo',
    label: 'Date Range & Multiple Dates',
    placeholder: 'Pick dates',
    triggerClass: 'w-64',
    wcProps:
      "{ mode: 'range', defaultMonth: '2026-10', defaultRange: { from: '2026-10-10', to: '2026-10-14' }, unavailable: ['2026-10-18'], minNights: 1, maxNights: 14 }",
    reactProps:
      'mode="range" defaultMonth="2026-10" defaultRange={{ from: "2026-10-10", to: "2026-10-14" }} unavailable={["2026-10-18"]} minNights={1} maxNights={14}',
    vueProps:
      'mode="range" default-month="2026-10" :default-range="{ from: \'2026-10-10\', to: \'2026-10-14\' }" :unavailable="[\'2026-10-18\']" :min-nights="1" :max-nights="14"',
  },
  {
    kind: 'rtl',
    suffix: '-rtl',
    fnSuffix: 'RtlDemo',
    label: 'تاريخ الموعد (RTL · ar-SA)',
    placeholder: 'اختر تاريخًا',
    triggerClass: 'w-56',
    wcProps: "{ defaultMonth: '2026-10', locale: 'ar-SA', direction: 'rtl' }",
    reactProps: 'defaultMonth="2026-10" locale="ar-SA" direction="rtl"',
    vueProps: 'default-month="2026-10" locale="ar-SA" direction="rtl"',
  },
];

function buildWcCode(family: FamilyMeta, spec: ExampleSpec): string {
  const p = `proto-ui-${family.prefix}`;
  const id = `dp-${family.prefix}${spec.suffix}`;
  const styleProp = family.isShadcn ? ", styleProfile: 'rhea'" : '';
  const rootPropsObj = spec.wcProps.replace(/\}$/, `${styleProp} }`);
  const triggerExtra = spec.triggerExtraWc?.(family) ?? '';
  return formatCode(`
<div class="flex flex-col items-start gap-2">
  ${spec.label ? `<span class="text-sm font-medium">${spec.label}</span>` : ''}
  <${p}-date-picker-root id="${id}">
    <${p}-date-picker-trigger class="${spec.triggerClass}">
      <${p}-date-picker-value></${p}-date-picker-value>
      <span aria-hidden="true">▾</span>
    </${p}-date-picker-trigger>
    <${p}-date-picker-content>
      <${p}-calendar-caption>
        <${p}-calendar-previous>‹</${p}-calendar-previous>
        <${p}-calendar-heading></${p}-calendar-heading>
        <${p}-calendar-next>›</${p}-calendar-next>
      </${p}-calendar-caption>
      <${p}-calendar-grid>
        <${p}-calendar-weekdays></${p}-calendar-weekdays>
      </${p}-calendar-grid>
    </${p}-date-picker-content>
  </${p}-date-picker-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';

  const root = document.querySelector('#${id}');
  setElementProps(root, ${rootPropsObj});
  ${triggerExtra ? `setElementProps(root.querySelector('${p}-date-picker-trigger'), { ${triggerExtra.slice(2)} });` : ''}
  setElementProps(root.querySelector('${p}-date-picker-value'), { placeholder: '${spec.placeholder}' });
  setElementProps(root.querySelector('${p}-date-picker-content'), { side: 'bottom', align: 'start', sideOffset: 6 });

  const weekdays = root.querySelector('${p}-calendar-weekdays');
  for (let offset = 0; offset < 7; offset++) {
    const cell = document.createElement('${p}-calendar-weekday');
    setElementProps(cell, { offset });
    weekdays.append(cell);
  }
  const grid = root.querySelector('${p}-calendar-grid');
  for (let rowIndex = 0; rowIndex < 6; rowIndex++) {
    const row = document.createElement('${p}-calendar-row');
    setElementProps(row, { index: rowIndex });
    for (let col = 0; col < 7; col++) {
      const day = document.createElement('${p}-date-picker-day');
      setElementProps(day, { offset: rowIndex * 7 + col });
      row.append(day);
    }
    grid.append(row);
  }
</script>
  `);
}

function buildReactCode(family: FamilyMeta, spec: ExampleSpec): string {
  const P = family.pascal;
  const styleAttr = family.isShadcn ? ' styleProfile="rhea"' : '';
  const triggerExtra = spec.triggerExtraReact?.(family) ?? '';
  return formatCode(`
import {
  ${P}DatePickerRoot,
  ${P}DatePickerTrigger,
  ${P}DatePickerValue,
  ${P}DatePickerContent,
  ${P}DatePickerDay,
  ${P}CalendarCaption,
  ${P}CalendarPrevious,
  ${P}CalendarHeading,
  ${P}CalendarNext,
  ${P}CalendarGrid,
  ${P}CalendarWeekdays,
  ${P}CalendarWeekday,
  ${P}CalendarRow,
} from '../proto-ui/components/react';

export function ${P}DatePicker${spec.fnSuffix}() {
  return (
    <div className="flex flex-col items-start gap-2">
      ${spec.label ? `<span className="text-sm font-medium">${spec.label}</span>` : ''}
      <${P}DatePickerRoot ${spec.reactProps}${styleAttr}>
        <${P}DatePickerTrigger className="${spec.triggerClass}"${triggerExtra}>
          <${P}DatePickerValue placeholder="${spec.placeholder}" />
          <span aria-hidden="true">▾</span>
        </${P}DatePickerTrigger>
        <${P}DatePickerContent side="bottom" align="start" sideOffset={6}>
          <${P}CalendarCaption>
            <${P}CalendarPrevious a11yLabel="Previous month">‹</${P}CalendarPrevious>
            <${P}CalendarHeading />
            <${P}CalendarNext a11yLabel="Next month">›</${P}CalendarNext>
          </${P}CalendarCaption>
          <${P}CalendarGrid>
            <${P}CalendarWeekdays>
              {[0, 1, 2, 3, 4, 5, 6].map((offset) => (
                <${P}CalendarWeekday key={offset} offset={offset} />
              ))}
            </${P}CalendarWeekdays>
            {[0, 1, 2, 3, 4, 5].map((row) => (
              <${P}CalendarRow key={row} index={row}>
                {[0, 1, 2, 3, 4, 5, 6].map((col) => (
                  <${P}DatePickerDay key={col} offset={row * 7 + col} />
                ))}
              </${P}CalendarRow>
            ))}
          </${P}CalendarGrid>
        </${P}DatePickerContent>
      </${P}DatePickerRoot>
    </div>
  );
}
  `);
}

function buildVueCode(family: FamilyMeta, spec: ExampleSpec): string {
  const P = family.pascal;
  const styleAttr = family.isShadcn ? ' style-profile="rhea"' : '';
  const triggerExtra = spec.triggerExtraVue?.(family) ?? '';
  return formatCode(`
<script setup lang="ts">
import {
  ${P}DatePickerRoot,
  ${P}DatePickerTrigger,
  ${P}DatePickerValue,
  ${P}DatePickerContent,
  ${P}DatePickerDay,
  ${P}CalendarCaption,
  ${P}CalendarPrevious,
  ${P}CalendarHeading,
  ${P}CalendarNext,
  ${P}CalendarGrid,
  ${P}CalendarWeekdays,
  ${P}CalendarWeekday,
  ${P}CalendarRow,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-col items-start gap-2">
    ${spec.label ? `<span class="text-sm font-medium">${spec.label}</span>` : ''}
    <${P}DatePickerRoot ${spec.vueProps}${styleAttr}>
      <${P}DatePickerTrigger class="${spec.triggerClass}"${triggerExtra}>
        <${P}DatePickerValue placeholder="${spec.placeholder}" />
        <span aria-hidden="true">▾</span>
      </${P}DatePickerTrigger>
      <${P}DatePickerContent side="bottom" align="start" :side-offset="6">
        <${P}CalendarCaption>
          <${P}CalendarPrevious a11y-label="Previous month">‹</${P}CalendarPrevious>
          <${P}CalendarHeading />
          <${P}CalendarNext a11y-label="Next month">›</${P}CalendarNext>
        </${P}CalendarCaption>
        <${P}CalendarGrid>
          <${P}CalendarWeekdays>
            <${P}CalendarWeekday v-for="offset in 7" :key="offset" :offset="offset - 1" />
          </${P}CalendarWeekdays>
          <${P}CalendarRow v-for="row in 6" :key="row" :index="row - 1">
            <${P}DatePickerDay v-for="col in 7" :key="col" :offset="(row - 1) * 7 + (col - 1)" />
          </${P}CalendarRow>
        </${P}CalendarGrid>
      </${P}DatePickerContent>
    </${P}DatePickerRoot>
  </div>
</template>
  `);
}

function buildVue2Code(family: FamilyMeta, spec: ExampleSpec): string {
  const P = family.pascal;
  const styleAttr = family.isShadcn ? ' style-profile="rhea"' : '';
  const triggerExtra = spec.triggerExtraVue?.(family) ?? '';
  return formatCode(`
<template>
  <div class="flex flex-col items-start gap-2">
    ${spec.label ? `<span class="text-sm font-medium">${spec.label}</span>` : ''}
    <${P}DatePickerRoot ${spec.vueProps}${styleAttr}>
      <${P}DatePickerTrigger class="${spec.triggerClass}"${triggerExtra}>
        <${P}DatePickerValue placeholder="${spec.placeholder}" />
        <span aria-hidden="true">▾</span>
      </${P}DatePickerTrigger>
      <${P}DatePickerContent side="bottom" align="start" :side-offset="6">
        <${P}CalendarCaption>
          <${P}CalendarPrevious a11y-label="Previous month">‹</${P}CalendarPrevious>
          <${P}CalendarHeading />
          <${P}CalendarNext a11y-label="Next month">›</${P}CalendarNext>
        </${P}CalendarCaption>
        <${P}CalendarGrid>
          <${P}CalendarWeekdays>
            <${P}CalendarWeekday v-for="offset in 7" :key="offset" :offset="offset - 1" />
          </${P}CalendarWeekdays>
          <${P}CalendarRow v-for="row in 6" :key="row" :index="row - 1">
            <${P}DatePickerDay v-for="col in 7" :key="col" :offset="(row - 1) * 7 + (col - 1)" />
          </${P}CalendarRow>
        </${P}CalendarGrid>
      </${P}DatePickerContent>
    </${P}DatePickerRoot>
  </div>
</template>

<script>
import {
  ${P}DatePickerRoot,
  ${P}DatePickerTrigger,
  ${P}DatePickerValue,
  ${P}DatePickerContent,
  ${P}DatePickerDay,
  ${P}CalendarCaption,
  ${P}CalendarPrevious,
  ${P}CalendarHeading,
  ${P}CalendarNext,
  ${P}CalendarGrid,
  ${P}CalendarWeekdays,
  ${P}CalendarWeekday,
  ${P}CalendarRow,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${P}DatePickerRoot,
    ${P}DatePickerTrigger,
    ${P}DatePickerValue,
    ${P}DatePickerContent,
    ${P}DatePickerDay,
    ${P}CalendarCaption,
    ${P}CalendarPrevious,
    ${P}CalendarHeading,
    ${P}CalendarNext,
    ${P}CalendarGrid,
    ${P}CalendarWeekdays,
    ${P}CalendarWeekday,
    ${P}CalendarRow,
  },
};
</script>
  `);
}

function buildCodeMap(): Record<RuntimeId, Record<string, string>> {
  const wc: Record<string, string> = {};
  const react: Record<string, string> = {};
  const vue: Record<string, string> = {};
  const vue2: Record<string, string> = {};

  for (const family of FAMILIES) {
    for (const spec of EXAMPLES) {
      const demoId = `demo-${family.prefix}-date-picker${spec.suffix}`;
      wc[demoId] = buildWcCode(family, spec);
      react[demoId] = buildReactCode(family, spec);
      vue[demoId] = buildVueCode(family, spec);
      vue2[demoId] = buildVue2Code(family, spec);
    }
  }

  return { wc, react, vue, vue2 };
}

export const codeMap: Record<RuntimeId, Record<string, string>> = buildCodeMap();
