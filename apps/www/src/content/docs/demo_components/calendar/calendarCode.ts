import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

type FamilyId = 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass';

const FAMILIES: ReadonlyArray<{
  id: FamilyId;
  pkg: string;
  tagPrefix: string;
  classAttr: string;
  styleProfileProp: string;
  styleProfileJs: string;
}> = [
  {
    id: 'shadcn',
    pkg: '@proto.ui/prototypes-shadcn/calendar',
    tagPrefix: 'proto-ui-shadcn',
    classAttr: ' class="rounded-lg border border-border"',
    styleProfileProp: ' styleProfile="rhea"',
    styleProfileJs: "styleProfile: 'rhea', ",
  },
  {
    id: 'brutalist',
    pkg: '@proto.ui/prototypes-brutalist/calendar',
    tagPrefix: 'proto-ui-brutalist',
    classAttr: '',
    styleProfileProp: '',
    styleProfileJs: '',
  },
  {
    id: 'bootstrap-2-3-2',
    pkg: '@proto.ui/prototypes-bootstrap-2-3-2/calendar',
    tagPrefix: 'proto-ui-bootstrap-2-3-2',
    classAttr: '',
    styleProfileProp: '',
    styleProfileJs: '',
  },
  {
    id: 'liquid-glass',
    pkg: '@proto.ui/prototypes-liquid-glass/calendar',
    tagPrefix: 'proto-ui-liquid-glass',
    classAttr: '',
    styleProfileProp: '',
    styleProfileJs: '',
  },
];

function wcGridMarkup(tagPrefix: string): string {
  return `  <${tagPrefix}-calendar-grid>
    <${tagPrefix}-calendar-weekdays>
      <!-- 7 Weekday slots with offset 0..6 -->
    </${tagPrefix}-calendar-weekdays>
    <!-- 6 Row slots (index 0..5), each with 7 Day slots (offset 0..41) -->
  </${tagPrefix}-calendar-grid>`;
}

function buildFamilyCode(f: (typeof FAMILIES)[number]) {
  const wc: Record<string, string> = {};
  const react: Record<string, string> = {};
  const vue: Record<string, string> = {};
  const vue2: Record<string, string> = {};
  const p = f.tagPrefix;

  // 1. Hero (Month & Year Selector)
  wc[`demo-${f.id}-calendar`] = formatCode(`
<${p}-calendar-root id="calendar-caption-demo"${f.classAttr}>
  <${p}-calendar-caption>
    <${p}-calendar-previous aria-label="Previous month">‹</${p}-calendar-previous>
    <${p}-select-root id="calendar-month"><!-- Month Select --></${p}-select-root>
    <${p}-select-root id="calendar-year"><!-- Year Select --></${p}-select-root>
    <${p}-calendar-next aria-label="Next month">›</${p}-calendar-next>
  </${p}-calendar-caption>
  <${p}-calendar-heading class="sr-only"></${p}-calendar-heading>
${wcGridMarkup(p)}
</${p}-calendar-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  import { bindCalendarCaption } from '@proto.ui/prototypes-base/calendar';

  const root = document.querySelector('#calendar-caption-demo');
  setElementProps(root, { ${f.styleProfileJs}locale: 'en-US', weekStartsOn: 0, today: '2026-10-08' });
  // Connect month/year Select controls via bindCalendarCaption(source, { month, year })
</script>
  `);
  react[`demo-${f.id}-calendar`] = formatCode(`
import { useState } from 'react';
import { CalendarRoot, CalendarCaption, CalendarPrevious, CalendarNext, CalendarHeading, CalendarGrid, CalendarWeekdays, CalendarWeekday, CalendarRow, CalendarDay } from '${f.pkg}';

export function CalendarWithDropdowns() {
  const [date, setDate] = useState('2026-10-08');
  const [month, setMonth] = useState('2026-10');

  return (
    <CalendarRoot${f.styleProfileProp}${f.classAttr.replace('class=', 'className=')} value={date} month={month} today="2026-10-08" onValueChange={({ value }) => setDate(value)} onMonthChange={({ month: next }) => setMonth(next)}>
      <CalendarCaption>
        <CalendarPrevious a11yLabel="Previous month" />
        {/* Bind month & year Select controls with bindCalendarCaption */}
        <CalendarHeading className="sr-only" />
        <CalendarNext a11yLabel="Next month" />
      </CalendarCaption>
      <CalendarGrid>
        <CalendarWeekdays>{Array.from({ length: 7 }, (_, offset) => <CalendarWeekday key={offset} offset={offset} />)}</CalendarWeekdays>
        {Array.from({ length: 6 }, (_, row) => (
          <CalendarRow key={row} index={row}>
            {Array.from({ length: 7 }, (_, col) => <CalendarDay key={col} offset={row * 7 + col} />)}
          </CalendarRow>
        ))}
      </CalendarGrid>
    </CalendarRoot>
  );
}
  `);
  vue[`demo-${f.id}-calendar`] = formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
const value = ref('2026-10-08');
const month = ref('2026-10');
</script>

<template>
  <CalendarRoot${f.styleProfileProp}${f.classAttr} :value="value" :month="month" today="2026-10-08" @value-change="(e) => (value = e.value)" @month-change="(e) => (month = e.month)">
    <CalendarCaption>
      <CalendarPrevious a11y-label="Previous month" />
      <!-- Bind month & year Select controls with bindCalendarCaption -->
      <CalendarHeading class="sr-only" />
      <CalendarNext a11y-label="Next month" />
    </CalendarCaption>
    <CalendarGrid>
      <CalendarWeekdays><CalendarWeekday v-for="i in 7" :key="i" :offset="i - 1" /></CalendarWeekdays>
      <CalendarRow v-for="row in 6" :key="row" :index="row - 1">
        <CalendarDay v-for="col in 7" :key="col" :offset="(row - 1) * 7 + (col - 1)" />
      </CalendarRow>
    </CalendarGrid>
  </CalendarRoot>
</template>
  `);
  vue2[`demo-${f.id}-calendar`] = formatCode(`
<template>
  <CalendarRoot${f.styleProfileProp}${f.classAttr} :value="value" :month="month" today="2026-10-08" @value-change="onValueChange" @month-change="onMonthChange">
    <CalendarCaption>
      <CalendarPrevious a11y-label="Previous month" />
      <CalendarHeading class="sr-only" />
      <CalendarNext a11y-label="Next month" />
    </CalendarCaption>
    <CalendarGrid>
      <CalendarWeekdays><CalendarWeekday v-for="i in 7" :key="i" :offset="i - 1" /></CalendarWeekdays>
      <CalendarRow v-for="row in 6" :key="row" :index="row - 1">
        <CalendarDay v-for="col in 7" :key="col" :offset="(row - 1) * 7 + (col - 1)" />
      </CalendarRow>
    </CalendarGrid>
  </CalendarRoot>
</template>
<script>
export default {
  data() {
    return { value: '2026-10-08', month: '2026-10' };
  },
  methods: {
    onValueChange({ value }) { this.value = value; },
    onMonthChange({ month }) { this.month = month; },
  },
};
</script>
  `);

  // 2. Basic
  wc[`demo-${f.id}-calendar-basic`] = formatCode(`
<${p}-calendar-root id="calendar-basic"${f.classAttr}>
  <${p}-calendar-caption>
    <${p}-calendar-previous aria-label="Previous month">‹</${p}-calendar-previous>
    <${p}-calendar-heading></${p}-calendar-heading>
    <${p}-calendar-next aria-label="Next month">›</${p}-calendar-next>
  </${p}-calendar-caption>
${wcGridMarkup(p)}
</${p}-calendar-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#calendar-basic'), {
    ${f.styleProfileJs}mode: 'single',
    defaultMonth: '2026-10',
    defaultValue: '2026-10-12',
    today: '2026-10-08',
  });
</script>
  `);
  react[`demo-${f.id}-calendar-basic`] = formatCode(`
import { CalendarRoot, CalendarCaption, CalendarPrevious, CalendarHeading, CalendarNext, CalendarGrid, CalendarWeekdays, CalendarWeekday, CalendarRow, CalendarDay } from '${f.pkg}';

export function CalendarBasic() {
  return (
    <CalendarRoot${f.styleProfileProp}${f.classAttr.replace('class=', 'className=')} mode="single" defaultMonth="2026-10" defaultValue="2026-10-12" today="2026-10-08">
      <CalendarCaption>
        <CalendarPrevious a11yLabel="Previous month" />
        <CalendarHeading />
        <CalendarNext a11yLabel="Next month" />
      </CalendarCaption>
      <CalendarGrid>
        <CalendarWeekdays>{Array.from({ length: 7 }, (_, offset) => <CalendarWeekday key={offset} offset={offset} />)}</CalendarWeekdays>
        {Array.from({ length: 6 }, (_, row) => (
          <CalendarRow key={row} index={row}>
            {Array.from({ length: 7 }, (_, col) => <CalendarDay key={col} offset={row * 7 + col} />)}
          </CalendarRow>
        ))}
      </CalendarGrid>
    </CalendarRoot>
  );
}
  `);
  vue[`demo-${f.id}-calendar-basic`] = formatCode(`
<template>
  <CalendarRoot${f.styleProfileProp}${f.classAttr} mode="single" default-month="2026-10" default-value="2026-10-12" today="2026-10-08">
    <CalendarCaption>
      <CalendarPrevious a11y-label="Previous month" />
      <CalendarHeading />
      <CalendarNext a11y-label="Next month" />
    </CalendarCaption>
    <CalendarGrid>
      <CalendarWeekdays><CalendarWeekday v-for="i in 7" :key="i" :offset="i - 1" /></CalendarWeekdays>
      <CalendarRow v-for="row in 6" :key="row" :index="row - 1">
        <CalendarDay v-for="col in 7" :key="col" :offset="(row - 1) * 7 + (col - 1)" />
      </CalendarRow>
    </CalendarGrid>
  </CalendarRoot>
</template>
  `);
  vue2[`demo-${f.id}-calendar-basic`] = vue[`demo-${f.id}-calendar-basic`];

  // 3. Range
  wc[`demo-${f.id}-calendar-range`] = formatCode(`
<${p}-calendar-root id="calendar-range"${f.classAttr}>
  <${p}-calendar-caption>
    <${p}-calendar-previous aria-label="Previous month">‹</${p}-calendar-previous>
    <${p}-calendar-heading></${p}-calendar-heading>
    <${p}-calendar-next aria-label="Next month">›</${p}-calendar-next>
  </${p}-calendar-caption>
${wcGridMarkup(p)}
</${p}-calendar-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#calendar-range'), {
    ${f.styleProfileJs}mode: 'range',
    defaultMonth: '2026-10',
    defaultRange: { from: '2026-10-08', to: '2026-10-16' },
    today: '2026-10-04',
  });
</script>
  `);
  react[`demo-${f.id}-calendar-range`] = formatCode(`
import { useState } from 'react';
import { CalendarRoot, CalendarCaption, CalendarPrevious, CalendarHeading, CalendarNext, CalendarGrid, CalendarWeekdays, CalendarWeekday, CalendarRow, CalendarDay, type CalendarRange } from '${f.pkg}';

export function CalendarRangeDemo() {
  const [range, setRange] = useState<CalendarRange>({ from: '2026-10-08', to: '2026-10-16' });
  return (
    <CalendarRoot${f.styleProfileProp}${f.classAttr.replace('class=', 'className=')} mode="range" defaultMonth="2026-10" range={range} onRangeChange={({ range: next }) => setRange(next)}>
      <CalendarCaption>
        <CalendarPrevious a11yLabel="Previous month" />
        <CalendarHeading />
        <CalendarNext a11yLabel="Next month" />
      </CalendarCaption>
      <CalendarGrid>
        <CalendarWeekdays>{Array.from({ length: 7 }, (_, offset) => <CalendarWeekday key={offset} offset={offset} />)}</CalendarWeekdays>
        {Array.from({ length: 6 }, (_, row) => (
          <CalendarRow key={row} index={row}>
            {Array.from({ length: 7 }, (_, col) => <CalendarDay key={col} offset={row * 7 + col} />)}
          </CalendarRow>
        ))}
      </CalendarGrid>
    </CalendarRoot>
  );
}
  `);
  vue[`demo-${f.id}-calendar-range`] = formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
const range = ref({ from: '2026-10-08', to: '2026-10-16' });
</script>

<template>
  <CalendarRoot${f.styleProfileProp}${f.classAttr} mode="range" default-month="2026-10" :range="range" @range-change="(e) => (range = e.range)">
    <CalendarCaption>
      <CalendarPrevious a11y-label="Previous month" />
      <CalendarHeading />
      <CalendarNext a11y-label="Next month" />
    </CalendarCaption>
    <CalendarGrid>
      <CalendarWeekdays><CalendarWeekday v-for="i in 7" :key="i" :offset="i - 1" /></CalendarWeekdays>
      <CalendarRow v-for="row in 6" :key="row" :index="row - 1">
        <CalendarDay v-for="col in 7" :key="col" :offset="(row - 1) * 7 + (col - 1)" />
      </CalendarRow>
    </CalendarGrid>
  </CalendarRoot>
</template>
  `);
  vue2[`demo-${f.id}-calendar-range`] = formatCode(`
<template>
  <CalendarRoot${f.styleProfileProp}${f.classAttr} mode="range" default-month="2026-10" :range="range" @range-change="onRangeChange">
    <CalendarCaption>
      <CalendarPrevious a11y-label="Previous month" />
      <CalendarHeading />
      <CalendarNext a11y-label="Next month" />
    </CalendarCaption>
    <CalendarGrid>
      <CalendarWeekdays><CalendarWeekday v-for="i in 7" :key="i" :offset="i - 1" /></CalendarWeekdays>
      <CalendarRow v-for="row in 6" :key="row" :index="row - 1">
        <CalendarDay v-for="col in 7" :key="col" :offset="(row - 1) * 7 + (col - 1)" />
      </CalendarRow>
    </CalendarGrid>
  </CalendarRoot>
</template>
<script>
export default {
  data() { return { range: { from: '2026-10-08', to: '2026-10-16' } }; },
  methods: { onRangeChange({ range }) { this.range = range; } },
};
</script>
  `);

  // 4. Selection (Range + Multiple with constraints)
  wc[`demo-${f.id}-calendar-selection`] = formatCode(`
<div class="flex flex-wrap items-start gap-8">
  <${p}-calendar-root id="calendar-range-constrained"${f.classAttr}><!-- Range (1–14 nights) --></${p}-calendar-root>
  <${p}-calendar-root id="calendar-multiple"${f.classAttr}><!-- Multiple (max 4 dates) --></${p}-calendar-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#calendar-range-constrained'), {
    ${f.styleProfileJs}mode: 'range',
    defaultMonth: '2026-10',
    defaultRange: { from: '2026-10-10', to: '2026-10-14' },
    min: '2026-10-01',
    max: '2026-11-30',
    unavailable: ['2026-10-18'],
    minNights: 1,
    maxNights: 14,
  });
  setElementProps(document.querySelector('#calendar-multiple'), {
    ${f.styleProfileJs}mode: 'multiple',
    defaultMonth: '2026-10',
    defaultValues: ['2026-10-03', '2026-10-08', '2026-10-12'],
    min: '2026-10-01',
    max: '2026-11-30',
    unavailable: ['2026-10-18'],
    maxSelected: 4,
  });
</script>
  `);
  react[`demo-${f.id}-calendar-selection`] = formatCode(`
import { CalendarRoot } from '${f.pkg}';

export function CalendarSelectionModes() {
  return (
    <div className="flex flex-wrap items-start gap-8">
      <CalendarRoot${f.styleProfileProp}${f.classAttr.replace('class=', 'className=')} mode="range" defaultMonth="2026-10" defaultRange={{ from: '2026-10-10', to: '2026-10-14' }} min="2026-10-01" max="2026-11-30" unavailable={['2026-10-18']} minNights={1} maxNights={14}>
        {/* Caption + Grid */}
      </CalendarRoot>
      <CalendarRoot${f.styleProfileProp}${f.classAttr.replace('class=', 'className=')} mode="multiple" defaultMonth="2026-10" defaultValues={['2026-10-03', '2026-10-08', '2026-10-12']} min="2026-10-01" max="2026-11-30" unavailable={['2026-10-18']} maxSelected={4}>
        {/* Caption + Grid */}
      </CalendarRoot>
    </div>
  );
}
  `);
  vue[`demo-${f.id}-calendar-selection`] = formatCode(`
<template>
  <div class="flex flex-wrap items-start gap-8">
    <CalendarRoot${f.styleProfileProp}${f.classAttr} mode="range" default-month="2026-10" :default-range="{ from: '2026-10-10', to: '2026-10-14' }" min="2026-10-01" max="2026-11-30" :unavailable="['2026-10-18']" :min-nights="1" :max-nights="14">
      <!-- Caption + Grid -->
    </CalendarRoot>
    <CalendarRoot${f.styleProfileProp}${f.classAttr} mode="multiple" default-month="2026-10" :default-values="['2026-10-03', '2026-10-08', '2026-10-12']" min="2026-10-01" max="2026-11-30" :unavailable="['2026-10-18']" :max-selected="4">
      <!-- Caption + Grid -->
    </CalendarRoot>
  </div>
</template>
  `);
  vue2[`demo-${f.id}-calendar-selection`] = vue[`demo-${f.id}-calendar-selection`];

  // 5. Presets
  wc[`demo-${f.id}-calendar-presets`] = formatCode(`
<div class="inline-flex flex-col items-center gap-3">
  <${p}-calendar-root id="calendar-presets"${f.classAttr}>
    <!-- Caption + 6-week fixed Grid -->
  </${p}-calendar-root>
  <div class="flex max-w-[300px] flex-wrap gap-2">
    <${p}-button data-offset="0">Today</${p}-button>
    <${p}-button data-offset="1">Tomorrow</${p}-button>
    <${p}-button data-offset="3">In 3 days</${p}-button>
    <${p}-button data-offset="7">In a week</${p}-button>
    <${p}-button data-offset="14">In 2 weeks</${p}-button>
  </div>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#calendar-presets');
  setElementProps(root, { ${f.styleProfileJs}fixedWeeks: true, value: '2026-10-12', month: '2026-10', today: '2026-10-10' });
</script>
  `);
  react[`demo-${f.id}-calendar-presets`] = formatCode(`
import { useState } from 'react';
import { CalendarRoot } from '${f.pkg}';

const PRESETS = [
  { label: 'Today', date: '2026-10-10' },
  { label: 'Tomorrow', date: '2026-10-11' },
  { label: 'In 3 days', date: '2026-10-13' },
  { label: 'In a week', date: '2026-10-17' },
  { label: 'In 2 weeks', date: '2026-10-24' },
];

export function CalendarWithPresets() {
  const [value, setValue] = useState('2026-10-12');
  const [month, setMonth] = useState('2026-10');
  return (
    <div className="inline-flex flex-col items-center gap-3">
      <CalendarRoot${f.styleProfileProp}${f.classAttr.replace('class=', 'className=')} fixedWeeks value={value} month={month} today="2026-10-10" onValueChange={({ value: next }) => setValue(next)} onMonthChange={({ month: next }) => setMonth(next)}>
        {/* Caption + Grid */}
      </CalendarRoot>
      <div className="flex max-w-[300px] flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button key={preset.label} type="button" onClick={() => { setValue(preset.date); setMonth(preset.date.slice(0, 7)); }}>
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
  `);
  vue[`demo-${f.id}-calendar-presets`] = formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
const value = ref('2026-10-12');
const month = ref('2026-10');
const presets = [
  { label: 'Today', date: '2026-10-10' },
  { label: 'Tomorrow', date: '2026-10-11' },
  { label: 'In 3 days', date: '2026-10-13' },
  { label: 'In a week', date: '2026-10-17' },
  { label: 'In 2 weeks', date: '2026-10-24' },
];
function pick(date: string) { value.value = date; month.value = date.slice(0, 7); }
</script>

<template>
  <div class="inline-flex flex-col items-center gap-3">
    <CalendarRoot${f.styleProfileProp}${f.classAttr} fixed-weeks :value="value" :month="month" today="2026-10-10" @value-change="(e) => (value = e.value)" @month-change="(e) => (month = e.month)">
      <!-- Caption + Grid -->
    </CalendarRoot>
    <div class="flex max-w-[300px] flex-wrap gap-2">
      <button v-for="p in presets" :key="p.label" type="button" @click="pick(p.date)">{{ p.label }}</button>
    </div>
  </div>
</template>
  `);
  vue2[`demo-${f.id}-calendar-presets`] = vue[`demo-${f.id}-calendar-presets`];

  // 6. Booked dates
  wc[`demo-${f.id}-calendar-booked-dates`] = formatCode(`
<${p}-calendar-root id="calendar-booked"${f.classAttr}>
  <!-- Caption + Grid -->
</${p}-calendar-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#calendar-booked'), {
    ${f.styleProfileJs}defaultMonth: '2026-10',
    defaultValue: '2026-10-06',
    today: '2026-10-06',
    min: '2026-10-01',
    max: '2026-10-31',
    unavailable: ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20'],
  });
</script>
  `);
  react[`demo-${f.id}-calendar-booked-dates`] = formatCode(`
import { CalendarRoot } from '${f.pkg}';

const bookedDates = Array.from({ length: 9 }, (_, i) => \`2026-10-\${String(12 + i).padStart(2, '0')}\`);

export function CalendarBookedDates() {
  return (
    <CalendarRoot${f.styleProfileProp}${f.classAttr.replace('class=', 'className=')} defaultMonth="2026-10" defaultValue="2026-10-06" today="2026-10-06" min="2026-10-01" max="2026-10-31" unavailable={bookedDates}>
      {/* Caption + Grid */}
    </CalendarRoot>
  );
}
  `);
  vue[`demo-${f.id}-calendar-booked-dates`] = formatCode(`
<script setup lang="ts">
const bookedDates = Array.from({ length: 9 }, (_, i) => \`2026-10-\${String(12 + i).padStart(2, '0')}\`);
</script>

<template>
  <CalendarRoot${f.styleProfileProp}${f.classAttr} default-month="2026-10" default-value="2026-10-06" today="2026-10-06" min="2026-10-01" max="2026-10-31" :unavailable="bookedDates">
    <!-- Caption + Grid -->
  </CalendarRoot>
</template>
  `);
  vue2[`demo-${f.id}-calendar-booked-dates`] = vue[`demo-${f.id}-calendar-booked-dates`];

  // 7. RTL
  wc[`demo-${f.id}-calendar-rtl`] = formatCode(`
<${p}-calendar-root id="calendar-rtl"${f.classAttr}>
  <!-- Caption + Grid -->
</${p}-calendar-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#calendar-rtl'), {
    ${f.styleProfileJs}defaultMonth: '2026-10',
    defaultValue: '2026-10-12',
    today: '2026-10-08',
    locale: 'ar-SA',
    direction: 'rtl',
    weekStartsOn: 6,
    a11yLabel: 'اختر تاريخاً',
  });
</script>
  `);
  react[`demo-${f.id}-calendar-rtl`] = formatCode(`
import { CalendarRoot } from '${f.pkg}';

export function CalendarRtl() {
  return (
    <CalendarRoot${f.styleProfileProp}${f.classAttr.replace('class=', 'className=')} defaultMonth="2026-10" defaultValue="2026-10-12" today="2026-10-08" locale="ar-SA" direction="rtl" weekStartsOn={6} a11yLabel="اختر تاريخاً">
      {/* Caption + Grid */}
    </CalendarRoot>
  );
}
  `);
  vue[`demo-${f.id}-calendar-rtl`] = formatCode(`
<template>
  <CalendarRoot${f.styleProfileProp}${f.classAttr} default-month="2026-10" default-value="2026-10-12" today="2026-10-08" locale="ar-SA" direction="rtl" :week-starts-on="6" a11y-label="اختر تاريخاً">
    <!-- Caption + Grid -->
  </CalendarRoot>
</template>
  `);
  vue2[`demo-${f.id}-calendar-rtl`] = vue[`demo-${f.id}-calendar-rtl`];

  return { wc, react, vue, vue2 };
}

const wcMap: Record<string, string> = {};
const reactMap: Record<string, string> = {};
const vueMap: Record<string, string> = {};
const vue2Map: Record<string, string> = {};

for (const family of FAMILIES) {
  const built = buildFamilyCode(family);
  Object.assign(wcMap, built.wc);
  Object.assign(reactMap, built.react);
  Object.assign(vueMap, built.vue);
  Object.assign(vue2Map, built.vue2);
}

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: wcMap,
  react: reactMap,
  vue: vueMap,
  vue2: vue2Map,
};
