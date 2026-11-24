import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

type FamilyMeta = {
  id: 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass';
  pascal: string;
  tag: string;
  rheaAttr: string;
  rheaProp: string;
  rheaJsProp: string;
  tableClass: string;
  nextProp: string;
};

const FAMILIES: FamilyMeta[] = [
  {
    id: 'shadcn',
    pascal: 'Shadcn',
    tag: 'proto-ui-shadcn',
    rheaAttr: ' styleProfile="rhea"',
    rheaProp: ' styleProfile="rhea"',
    rheaJsProp: "styleProfile: 'rhea', ",
    tableClass: ' class="rounded-md border border-border"',
    nextProp: '',
  },
  {
    id: 'brutalist',
    pascal: 'Brutalist',
    tag: 'proto-ui-brutalist',
    rheaAttr: '',
    rheaProp: '',
    rheaJsProp: '',
    tableClass: '',
    nextProp: '',
  },
  {
    id: 'bootstrap-2-3-2',
    pascal: 'Bootstrap232',
    tag: 'proto-ui-bootstrap-2-3-2',
    rheaAttr: '',
    rheaProp: '',
    rheaJsProp: '',
    tableClass: '',
    nextProp: '',
  },
  {
    id: 'liquid-glass',
    pascal: 'LiquidGlass',
    tag: 'proto-ui-liquid-glass',
    rheaAttr: '',
    rheaProp: '',
    rheaJsProp: '',
    tableClass: '',
    nextProp: ' variant="prominent"',
  },
];

function heroSnippets(f: FamilyMeta): Record<RuntimeId, string> {
  const P = f.pascal;
  const T = f.tag;
  const jsxClass = f.id === 'shadcn' ? ' className="rounded-md border border-border"' : '';
  return {
    wc: formatCode(`
<div class="grid w-full max-w-2xl gap-4">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <${T}-input-root id="email-filter" class="w-full max-w-xs"></${T}-input-root>
    <div class="flex gap-2">
      <${T}-button id="toggle-status">Toggle Status</${T}-button>
      <${T}-button id="select-page">Select page</${T}-button>
    </div>
  </div>
  <${T}-data-table-root id="payments-table"${f.tableClass}>
    <${T}-data-table-caption>Recent payments.</${T}-data-table-caption>
    <${T}-data-table-header-row>
      <${T}-data-table-header data-key="status">Status</${T}-data-table-header>
      <${T}-data-table-header data-key="email">Email</${T}-data-table-header>
      <${T}-data-table-header data-key="amount" class="text-right">Amount</${T}-data-table-header>
    </${T}-data-table-header-row>
    <${T}-data-table-row data-index="0">
      <${T}-data-table-cell data-col="status"></${T}-data-table-cell>
      <${T}-data-table-cell data-col="email"></${T}-data-table-cell>
      <${T}-data-table-cell data-col="amount" class="text-right font-medium"></${T}-data-table-cell>
    </${T}-data-table-row>
    <div class="table-caption caption-bottom">
      <div class="flex items-center justify-between pt-3">
        <span id="summary" class="text-sm text-muted-foreground">0 of 5 row(s) selected.</span>
        <div class="flex gap-2">
          <${T}-data-table-previous>Previous</${T}-data-table-previous>
          <${T}-data-table-next>Next</${T}-data-table-next>
        </div>
      </div>
    </div>
  </${T}-data-table-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const rows = [
    { id: 'm5gr84i9', status: 'Success', email: 'ken99@example.com', amount: 316 },
    { id: '3u1reuv4', status: 'Success', email: 'abe45@example.com', amount: 242 },
    { id: 'derv1ws0', status: 'Processing', email: 'monserrat44@example.com', amount: 837 },
    { id: '5kma53ae', status: 'Success', email: 'silas22@example.com', amount: 874 },
    { id: 'bhqecj4p', status: 'Failed', email: 'carmella@example.com', amount: 721 },
  ];
  const table = document.querySelector('#payments-table');
  setElementProps(table, { ${f.rheaJsProp}rows, pageSize: 4 });
  setElementProps(document.querySelector('#email-filter'), {
    ${f.rheaJsProp}placeholder: 'Filter emails...',
    onValueChange: ({ value }) => setElementProps(table, { columnFilters: { email: value } }),
  });
</script>
    `),
    react: formatCode(`
import { useRef, useState } from 'react';
import {
  ${P}Button,
  ${P}DataTableCaption,
  ${P}DataTableCell,
  ${P}DataTableHeader,
  ${P}DataTableHeaderRow,
  ${P}DataTableNext,
  ${P}DataTablePrevious,
  ${P}DataTableRoot,
  ${P}DataTableRow,
  ${P}InputRoot,
} from '../proto-ui/components/react';

const payments = [
  { id: 'm5gr84i9', status: 'Success', email: 'ken99@example.com', amount: 316 },
  { id: '3u1reuv4', status: 'Success', email: 'abe45@example.com', amount: 242 },
  { id: 'derv1ws0', status: 'Processing', email: 'monserrat44@example.com', amount: 837 },
  { id: '5kma53ae', status: 'Success', email: 'silas22@example.com', amount: 874 },
  { id: 'bhqecj4p', status: 'Failed', email: 'carmella@example.com', amount: 721 },
];

export function PaymentsDataTableDemo() {
  const tableRef = useRef<any>(null);
  const [emailFilter, setEmailFilter] = useState('');
  const [showStatus, setShowStatus] = useState(true);
  const [selectedCount, setSelectedCount] = useState(0);

  return (
    <div className="grid w-full max-w-2xl gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <${P}InputRoot${f.rheaProp}
          className="w-full max-w-xs"
          placeholder="Filter emails..."
          onValueChange={({ value }) => setEmailFilter(value)}
        />
        <div className="flex gap-2">
          <${P}Button${f.rheaProp} onClick={() => setShowStatus((v) => !v)}>Toggle Status</${P}Button>
          <${P}Button${f.rheaProp} onClick={() => tableRef.current?.requestPageSelection()}>
            Select page
          </${P}Button>
        </div>
      </div>
      <${P}DataTableRoot${f.rheaProp}
        ref={tableRef}${jsxClass}
        rows={payments}
        pageSize={4}
        columnFilters={{ email: emailFilter }}
        columnVisibility={{ status: showStatus }}
        onSelectionChange={({ selectedKeys }) => setSelectedCount(selectedKeys.length)}
      >
        <${P}DataTableCaption>Recent payments.</${P}DataTableCaption>
        <${P}DataTableHeaderRow>
          <${P}DataTableHeader headerKey="status">Status</${P}DataTableHeader>
          <${P}DataTableHeader headerKey="email">Email</${P}DataTableHeader>
          <${P}DataTableHeader headerKey="amount" className="text-right">Amount</${P}DataTableHeader>
        </${P}DataTableHeaderRow>
        {[0, 1, 2, 3].map((index) => (
          <${P}DataTableRow key={index} index={index}>
            <${P}DataTableCell columnKey="status" headers={['status']} />
            <${P}DataTableCell columnKey="email" headers={['email']} />
            <${P}DataTableCell columnKey="amount" headers={['amount']} className="text-right font-medium" />
          </${P}DataTableRow>
        ))}
        <div className="table-caption caption-bottom">
          <div className="flex items-center justify-between pt-3">
            <span className="text-sm text-muted-foreground">
              {selectedCount} of {payments.length} row(s) selected.
            </span>
            <div className="flex gap-2">
              <${P}DataTablePrevious>Previous</${P}DataTablePrevious>
              <${P}DataTableNext${f.nextProp}>Next</${P}DataTableNext>
            </div>
          </div>
        </div>
      </${P}DataTableRoot>
    </div>
  );
}
    `),
    vue: formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  ${P}Button,
  ${P}DataTableCaption,
  ${P}DataTableCell,
  ${P}DataTableHeader,
  ${P}DataTableHeaderRow,
  ${P}DataTableNext,
  ${P}DataTablePrevious,
  ${P}DataTableRoot,
  ${P}DataTableRow,
  ${P}InputRoot,
} from '../proto-ui/components/vue';

const payments = [
  { id: 'm5gr84i9', status: 'Success', email: 'ken99@example.com', amount: 316 },
  { id: '3u1reuv4', status: 'Success', email: 'abe45@example.com', amount: 242 },
  { id: 'derv1ws0', status: 'Processing', email: 'monserrat44@example.com', amount: 837 },
  { id: '5kma53ae', status: 'Success', email: 'silas22@example.com', amount: 874 },
  { id: 'bhqecj4p', status: 'Failed', email: 'carmella@example.com', amount: 721 },
];
const emailFilter = ref('');
const showStatus = ref(true);
const selectedCount = ref(0);
</script>

<template>
  <div class="grid w-full max-w-2xl gap-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <${P}InputRoot${f.rheaAttr} class="w-full max-w-xs" placeholder="Filter emails..." @valueChange="emailFilter = $event.value" />
      <${P}Button${f.rheaAttr} @click="showStatus = !showStatus">Toggle Status</${P}Button>
    </div>
    <${P}DataTableRoot${f.rheaAttr}${f.tableClass} :rows="payments" :pageSize="4" :columnFilters="{ email: emailFilter }" :columnVisibility="{ status: showStatus }" @selectionChange="selectedCount = $event.selectedKeys.length">
      <${P}DataTableCaption>Recent payments.</${P}DataTableCaption>
      <${P}DataTableHeaderRow>
        <${P}DataTableHeader headerKey="status">Status</${P}DataTableHeader>
        <${P}DataTableHeader headerKey="email">Email</${P}DataTableHeader>
        <${P}DataTableHeader headerKey="amount" class="text-right">Amount</${P}DataTableHeader>
      </${P}DataTableHeaderRow>
      <${P}DataTableRow v-for="index in [0, 1, 2, 3]" :key="index" :index="index">
        <${P}DataTableCell columnKey="status" :headers="['status']" />
        <${P}DataTableCell columnKey="email" :headers="['email']" />
        <${P}DataTableCell columnKey="amount" :headers="['amount']" class="text-right font-medium" />
      </${P}DataTableRow>
      <div class="table-caption caption-bottom">
        <div class="flex items-center justify-between pt-3">
          <span class="text-sm text-muted-foreground">{{ selectedCount }} of {{ payments.length }} row(s) selected.</span>
          <div class="flex gap-2">
            <${P}DataTablePrevious>Previous</${P}DataTablePrevious>
            <${P}DataTableNext${f.nextProp}>Next</${P}DataTableNext>
          </div>
        </div>
      </div>
    </${P}DataTableRoot>
  </div>
</template>
    `),
    vue2: formatCode(`
<template>
  <div class="grid w-full max-w-2xl gap-4">
    <${P}DataTableRoot${f.rheaAttr}${f.tableClass} :rows="payments" :pageSize="4" :columnFilters="{ email: emailFilter }" :columnVisibility="{ status: showStatus }">
      <${P}DataTableCaption>Recent payments.</${P}DataTableCaption>
      <${P}DataTableHeaderRow>
        <${P}DataTableHeader headerKey="status">Status</${P}DataTableHeader>
        <${P}DataTableHeader headerKey="email">Email</${P}DataTableHeader>
        <${P}DataTableHeader headerKey="amount" class="text-right">Amount</${P}DataTableHeader>
      </${P}DataTableHeaderRow>
      <${P}DataTableRow v-for="index in [0, 1, 2, 3]" :key="index" :index="index">
        <${P}DataTableCell columnKey="status" :headers="['status']" />
        <${P}DataTableCell columnKey="email" :headers="['email']" />
        <${P}DataTableCell columnKey="amount" :headers="['amount']" class="text-right font-medium" />
      </${P}DataTableRow>
      <div class="table-caption caption-bottom">
        <div class="flex items-center justify-end gap-2 pt-3">
          <${P}DataTablePrevious>Previous</${P}DataTablePrevious>
          <${P}DataTableNext${f.nextProp}>Next</${P}DataTableNext>
        </div>
      </div>
    </${P}DataTableRoot>
  </div>
</template>

<script>
import {
  ${P}DataTableCaption,
  ${P}DataTableCell,
  ${P}DataTableHeader,
  ${P}DataTableHeaderRow,
  ${P}DataTableNext,
  ${P}DataTablePrevious,
  ${P}DataTableRoot,
  ${P}DataTableRow,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${P}DataTableCaption,
    ${P}DataTableCell,
    ${P}DataTableHeader,
    ${P}DataTableHeaderRow,
    ${P}DataTableNext,
    ${P}DataTablePrevious,
    ${P}DataTableRoot,
    ${P}DataTableRow,
  },
  data() {
    return {
      emailFilter: '',
      showStatus: true,
      payments: [
        { id: 'm5gr84i9', status: 'Success', email: 'ken99@example.com', amount: 316 },
        { id: '3u1reuv4', status: 'Success', email: 'abe45@example.com', amount: 242 },
        { id: 'derv1ws0', status: 'Processing', email: 'monserrat44@example.com', amount: 837 },
        { id: '5kma53ae', status: 'Success', email: 'silas22@example.com', amount: 874 },
        { id: 'bhqecj4p', status: 'Failed', email: 'carmella@example.com', amount: 721 },
      ],
    };
  },
};
</script>
    `),
  };
}

function basicSnippets(f: FamilyMeta): Record<RuntimeId, string> {
  const P = f.pascal;
  const T = f.tag;
  const jsxClass = f.id === 'shadcn' ? ' className="rounded-md border border-border"' : '';
  return {
    wc: formatCode(`
<${T}-data-table-root id="basic-table"${f.tableClass}>
  <${T}-data-table-caption>A list of your recent invoices.</${T}-data-table-caption>
  <${T}-data-table-header-row>
    <${T}-data-table-header>Invoice</${T}-data-table-header>
    <${T}-data-table-header>Status</${T}-data-table-header>
    <${T}-data-table-header>Method</${T}-data-table-header>
    <${T}-data-table-header class="text-right">Amount (USD)</${T}-data-table-header>
  </${T}-data-table-header-row>
  <${T}-data-table-row>
    <${T}-data-table-cell></${T}-data-table-cell>
    <${T}-data-table-cell></${T}-data-table-cell>
    <${T}-data-table-cell></${T}-data-table-cell>
    <${T}-data-table-cell class="text-right font-medium"></${T}-data-table-cell>
  </${T}-data-table-row>
</${T}-data-table-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#basic-table'), {
    ${f.rheaJsProp}defaultSortKey: 'invoice',
    defaultSortDirection: 'ascending',
    pageSize: 4,
    rows: [
      { id: 'inv-001', invoice: 'INV001', status: 'Paid', method: 'Credit Card', amount: 250 },
      { id: 'inv-002', invoice: 'INV002', status: 'Pending', method: 'PayPal', amount: 150 },
    ],
  });
</script>
    `),
    react: formatCode(`
import {
  ${P}DataTableCaption,
  ${P}DataTableCell,
  ${P}DataTableHeader,
  ${P}DataTableHeaderRow,
  ${P}DataTableRoot,
  ${P}DataTableRow,
} from '../proto-ui/components/react';

const invoices = [
  { id: 'inv-001', invoice: 'INV001', status: 'Paid', method: 'Credit Card', amount: 250 },
  { id: 'inv-002', invoice: 'INV002', status: 'Pending', method: 'PayPal', amount: 150 },
  { id: 'inv-003', invoice: 'INV003', status: 'Unpaid', method: 'Bank Transfer', amount: 350 },
  { id: 'inv-004', invoice: 'INV004', status: 'Paid', method: 'Credit Card', amount: 450 },
];

export function BasicDataTableDemo() {
  return (
    <${P}DataTableRoot${f.rheaProp}${jsxClass} rows={invoices} pageSize={4} defaultSortKey="invoice" defaultSortDirection="ascending">
      <${P}DataTableCaption>A list of your recent invoices.</${P}DataTableCaption>
      <${P}DataTableHeaderRow>
        <${P}DataTableHeader headerKey="invoice" sortable>Invoice</${P}DataTableHeader>
        <${P}DataTableHeader headerKey="status" sortable={false}>Status</${P}DataTableHeader>
        <${P}DataTableHeader headerKey="method" sortable>Method</${P}DataTableHeader>
        <${P}DataTableHeader headerKey="amount" sortable className="text-right">Amount (USD)</${P}DataTableHeader>
      </${P}DataTableHeaderRow>
      {[0, 1, 2, 3].map((index) => (
        <${P}DataTableRow key={index} index={index}>
          <${P}DataTableCell columnKey="invoice" headers={['invoice']} className="font-medium" />
          <${P}DataTableCell columnKey="status" headers={['status']} />
          <${P}DataTableCell columnKey="method" headers={['method']} />
          <${P}DataTableCell columnKey="amount" headers={['amount']} className="text-right font-medium" />
        </${P}DataTableRow>
      ))}
    </${P}DataTableRoot>
  );
}
    `),
    vue: formatCode(`
<script setup lang="ts">
import {
  ${P}DataTableCaption,
  ${P}DataTableCell,
  ${P}DataTableHeader,
  ${P}DataTableHeaderRow,
  ${P}DataTableRoot,
  ${P}DataTableRow,
} from '../proto-ui/components/vue';

const invoices = [
  { id: 'inv-001', invoice: 'INV001', status: 'Paid', method: 'Credit Card', amount: 250 },
  { id: 'inv-002', invoice: 'INV002', status: 'Pending', method: 'PayPal', amount: 150 },
  { id: 'inv-003', invoice: 'INV003', status: 'Unpaid', method: 'Bank Transfer', amount: 350 },
  { id: 'inv-004', invoice: 'INV004', status: 'Paid', method: 'Credit Card', amount: 450 },
];
</script>

<template>
  <${P}DataTableRoot${f.rheaAttr}${f.tableClass} :rows="invoices" :pageSize="4" defaultSortKey="invoice" defaultSortDirection="ascending">
    <${P}DataTableCaption>A list of your recent invoices.</${P}DataTableCaption>
    <${P}DataTableHeaderRow>
      <${P}DataTableHeader headerKey="invoice" :sortable="true">Invoice</${P}DataTableHeader>
      <${P}DataTableHeader headerKey="status" :sortable="false">Status</${P}DataTableHeader>
      <${P}DataTableHeader headerKey="method" :sortable="true">Method</${P}DataTableHeader>
      <${P}DataTableHeader headerKey="amount" :sortable="true" class="text-right">Amount (USD)</${P}DataTableHeader>
    </${P}DataTableHeaderRow>
    <${P}DataTableRow v-for="index in [0, 1, 2, 3]" :key="index" :index="index">
      <${P}DataTableCell columnKey="invoice" :headers="['invoice']" class="font-medium" />
      <${P}DataTableCell columnKey="status" :headers="['status']" />
      <${P}DataTableCell columnKey="method" :headers="['method']" />
      <${P}DataTableCell columnKey="amount" :headers="['amount']" class="text-right font-medium" />
    </${P}DataTableRow>
  </${P}DataTableRoot>
</template>
    `),
    vue2: formatCode(`
<template>
  <${P}DataTableRoot${f.rheaAttr}${f.tableClass} :rows="invoices" :pageSize="4" defaultSortKey="invoice" defaultSortDirection="ascending">
    <${P}DataTableCaption>A list of your recent invoices.</${P}DataTableCaption>
    <${P}DataTableHeaderRow>
      <${P}DataTableHeader headerKey="invoice" :sortable="true">Invoice</${P}DataTableHeader>
      <${P}DataTableHeader headerKey="status" :sortable="false">Status</${P}DataTableHeader>
      <${P}DataTableHeader headerKey="method" :sortable="true">Method</${P}DataTableHeader>
      <${P}DataTableHeader headerKey="amount" :sortable="true" class="text-right">Amount (USD)</${P}DataTableHeader>
    </${P}DataTableHeaderRow>
    <${P}DataTableRow v-for="index in [0, 1, 2, 3]" :key="index" :index="index">
      <${P}DataTableCell columnKey="invoice" :headers="['invoice']" />
      <${P}DataTableCell columnKey="status" :headers="['status']" />
      <${P}DataTableCell columnKey="method" :headers="['method']" />
      <${P}DataTableCell columnKey="amount" :headers="['amount']" class="text-right font-medium" />
    </${P}DataTableRow>
  </${P}DataTableRoot>
</template>

<script>
import {
  ${P}DataTableCaption,
  ${P}DataTableCell,
  ${P}DataTableHeader,
  ${P}DataTableHeaderRow,
  ${P}DataTableRoot,
  ${P}DataTableRow,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${P}DataTableCaption,
    ${P}DataTableCell,
    ${P}DataTableHeader,
    ${P}DataTableHeaderRow,
    ${P}DataTableRoot,
    ${P}DataTableRow,
  },
  data() {
    return {
      invoices: [
        { id: 'inv-001', invoice: 'INV001', status: 'Paid', method: 'Credit Card', amount: 250 },
        { id: 'inv-002', invoice: 'INV002', status: 'Pending', method: 'PayPal', amount: 150 },
      ],
    };
  },
};
</script>
    `),
  };
}

function filteringSnippets(f: FamilyMeta): Record<RuntimeId, string> {
  const P = f.pascal;
  const T = f.tag;
  const jsxClass = f.id === 'shadcn' ? ' className="rounded-md border border-border"' : '';
  return {
    wc: formatCode(`
<div class="grid gap-3">
  <div class="flex flex-wrap gap-2">
    <${T}-input-root id="global-filter"></${T}-input-root>
    <${T}-input-root id="status-filter"></${T}-input-root>
    <${T}-button id="toggle-method">Toggle Method</${T}-button>
  </div>
  <${T}-data-table-root id="filter-table"${f.tableClass}>
    <${T}-data-table-header-row>
      <${T}-data-table-header>Invoice</${T}-data-table-header>
      <${T}-data-table-header>Status</${T}-data-table-header>
      <${T}-data-table-header>Method</${T}-data-table-header>
    </${T}-data-table-header-row>
  </${T}-data-table-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const table = document.querySelector('#filter-table');
  let showMethod = true;
  setElementProps(document.querySelector('#global-filter'), {
    ${f.rheaJsProp}placeholder: 'Search all...',
    onValueChange: ({ value }) => setElementProps(table, { filter: value }),
  });
  setElementProps(document.querySelector('#status-filter'), {
    ${f.rheaJsProp}placeholder: 'Status...',
    onValueChange: ({ value }) => setElementProps(table, { columnFilters: { status: value } }),
  });
  setElementProps(document.querySelector('#toggle-method'), {
    onClick: () => {
      showMethod = !showMethod;
      setElementProps(table, { columnVisibility: { method: showMethod } });
    },
  });
</script>
    `),
    react: formatCode(`
import { useState } from 'react';
import {
  ${P}Button,
  ${P}DataTableCell,
  ${P}DataTableHeader,
  ${P}DataTableHeaderRow,
  ${P}DataTableRoot,
  ${P}DataTableRow,
  ${P}InputRoot,
} from '../proto-ui/components/react';

export function FilteringDataTableDemo({ rows }: { rows: Array<{ id: string; invoice: string; status: string; method: string; amount: number }> }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [showMethod, setShowMethod] = useState(true);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <${P}InputRoot${f.rheaProp} placeholder="Search all..." onValueChange={({ value }) => setQuery(value)} />
        <${P}InputRoot${f.rheaProp} placeholder="Status (e.g. Paid)..." onValueChange={({ value }) => setStatus(value)} />
        <${P}Button${f.rheaProp} onClick={() => setShowMethod((v) => !v)}>Toggle Method</${P}Button>
      </div>
      <${P}DataTableRoot${f.rheaProp}${jsxClass} rows={rows} filter={query} columnFilters={{ status }} columnVisibility={{ method: showMethod }}>
        <${P}DataTableHeaderRow>
          <${P}DataTableHeader headerKey="invoice">Invoice</${P}DataTableHeader>
          <${P}DataTableHeader headerKey="status">Status</${P}DataTableHeader>
          <${P}DataTableHeader headerKey="method">Method</${P}DataTableHeader>
        </${P}DataTableHeaderRow>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <${P}DataTableRow key={index} index={index}>
            <${P}DataTableCell columnKey="invoice" headers={['invoice']} />
            <${P}DataTableCell columnKey="status" headers={['status']} />
            <${P}DataTableCell columnKey="method" headers={['method']} />
          </${P}DataTableRow>
        ))}
      </${P}DataTableRoot>
    </div>
  );
}
    `),
    vue: formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import { ${P}Button, ${P}DataTableCell, ${P}DataTableHeader, ${P}DataTableHeaderRow, ${P}DataTableRoot, ${P}DataTableRow, ${P}InputRoot } from '../proto-ui/components/vue';

const query = ref('');
const status = ref('');
const showMethod = ref(true);
const rows = [
  { id: 'inv-001', invoice: 'INV001', status: 'Paid', method: 'Credit Card' },
  { id: 'inv-002', invoice: 'INV002', status: 'Pending', method: 'PayPal' },
];
</script>

<template>
  <div class="grid gap-3">
    <div class="flex flex-wrap gap-2">
      <${P}InputRoot${f.rheaAttr} placeholder="Search all..." @valueChange="query = $event.value" />
      <${P}InputRoot${f.rheaAttr} placeholder="Status..." @valueChange="status = $event.value" />
      <${P}Button${f.rheaAttr} @click="showMethod = !showMethod">Toggle Method</${P}Button>
    </div>
    <${P}DataTableRoot${f.rheaAttr}${f.tableClass} :rows="rows" :filter="query" :columnFilters="{ status }" :columnVisibility="{ method: showMethod }">
      <${P}DataTableHeaderRow>
        <${P}DataTableHeader headerKey="invoice">Invoice</${P}DataTableHeader>
        <${P}DataTableHeader headerKey="status">Status</${P}DataTableHeader>
        <${P}DataTableHeader headerKey="method">Method</${P}DataTableHeader>
      </${P}DataTableHeaderRow>
      <${P}DataTableRow v-for="index in [0, 1]" :key="index" :index="index">
        <${P}DataTableCell columnKey="invoice" :headers="['invoice']" />
        <${P}DataTableCell columnKey="status" :headers="['status']" />
        <${P}DataTableCell columnKey="method" :headers="['method']" />
      </${P}DataTableRow>
    </${P}DataTableRoot>
  </div>
</template>
    `),
    vue2: formatCode(`
<template>
  <${P}DataTableRoot${f.rheaAttr}${f.tableClass} :rows="rows" :filter="query" :columnFilters="{ status }" :columnVisibility="{ method: showMethod }">
    <${P}DataTableHeaderRow>
      <${P}DataTableHeader headerKey="invoice">Invoice</${P}DataTableHeader>
      <${P}DataTableHeader headerKey="status">Status</${P}DataTableHeader>
      <${P}DataTableHeader headerKey="method">Method</${P}DataTableHeader>
    </${P}DataTableHeaderRow>
    <${P}DataTableRow v-for="index in [0, 1]" :key="index" :index="index">
      <${P}DataTableCell columnKey="invoice" :headers="['invoice']" />
      <${P}DataTableCell columnKey="status" :headers="['status']" />
      <${P}DataTableCell columnKey="method" :headers="['method']" />
    </${P}DataTableRow>
  </${P}DataTableRoot>
</template>

<script>
import { ${P}DataTableCell, ${P}DataTableHeader, ${P}DataTableHeaderRow, ${P}DataTableRoot, ${P}DataTableRow } from '../proto-ui/components/vue2';
export default {
  components: { ${P}DataTableCell, ${P}DataTableHeader, ${P}DataTableHeaderRow, ${P}DataTableRoot, ${P}DataTableRow },
  data() {
    return { query: '', status: '', showMethod: true, rows: [{ id: 'inv-001', invoice: 'INV001', status: 'Paid', method: 'Credit Card' }] };
  },
};
</script>
    `),
  };
}

function paginationSnippets(f: FamilyMeta): Record<RuntimeId, string> {
  const P = f.pascal;
  const T = f.tag;
  const jsxClass = f.id === 'shadcn' ? ' className="rounded-md border border-border"' : '';
  return {
    wc: formatCode(`
<${T}-data-table-root id="paged-table"${f.tableClass}>
  <${T}-data-table-header-row>
    <${T}-data-table-header>Invoice</${T}-data-table-header>
    <${T}-data-table-header>Status</${T}-data-table-header>
    <${T}-data-table-header>Method</${T}-data-table-header>
  </${T}-data-table-header-row>
  <div class="table-caption caption-bottom">
    <div class="flex items-center justify-end gap-2 pt-3">
      <${T}-data-table-previous>Previous</${T}-data-table-previous>
      <${T}-data-table-next>Next</${T}-data-table-next>
    </div>
  </div>
</${T}-data-table-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#paged-table'), {
    ${f.rheaJsProp}pageSize: 3,
    defaultSelectedKeys: ['inv-001'],
    rows: [
      { id: 'inv-001', invoice: 'INV001', status: 'Paid', method: 'Credit Card' },
      { id: 'inv-002', invoice: 'INV002', status: 'Pending', method: 'PayPal' },
      { id: 'inv-003', invoice: 'INV003', status: 'Unpaid', method: 'Bank Transfer' },
      { id: 'inv-004', invoice: 'INV004', status: 'Paid', method: 'Credit Card' },
    ],
  });
</script>
    `),
    react: formatCode(`
import { useRef, useState } from 'react';
import {
  ${P}Button,
  ${P}DataTableCell,
  ${P}DataTableHeader,
  ${P}DataTableHeaderRow,
  ${P}DataTableNext,
  ${P}DataTablePrevious,
  ${P}DataTableRoot,
  ${P}DataTableRow,
} from '../proto-ui/components/react';

export function PaginationDataTableDemo({ rows }: { rows: Array<{ id: string; invoice: string; status: string; method: string }> }) {
  const tableRef = useRef<any>(null);
  const [selectedCount, setSelectedCount] = useState(1);

  return (
    <div className="grid gap-3">
      <${P}Button${f.rheaProp} onClick={() => tableRef.current?.requestPageSelection()}>
        Select / clear current page
      </${P}Button>
      <${P}DataTableRoot${f.rheaProp}
        ref={tableRef}${jsxClass}
        rows={rows}
        pageSize={3}
        defaultSelectedKeys={['inv-001']}
        onSelectionChange={({ selectedKeys }) => setSelectedCount(selectedKeys.length)}
      >
        <${P}DataTableHeaderRow>
          <${P}DataTableHeader headerKey="invoice">Invoice</${P}DataTableHeader>
          <${P}DataTableHeader headerKey="status">Status</${P}DataTableHeader>
          <${P}DataTableHeader headerKey="method">Method</${P}DataTableHeader>
        </${P}DataTableHeaderRow>
        {[0, 1, 2].map((index) => (
          <${P}DataTableRow key={index} index={index}>
            <${P}DataTableCell columnKey="invoice" headers={['invoice']} />
            <${P}DataTableCell columnKey="status" headers={['status']} />
            <${P}DataTableCell columnKey="method" headers={['method']} />
          </${P}DataTableRow>
        ))}
        <div className="table-caption caption-bottom">
          <div className="flex items-center justify-between pt-3">
            <span className="text-sm text-muted-foreground">{selectedCount} of {rows.length} row(s) selected.</span>
            <div className="flex gap-2">
              <${P}DataTablePrevious>Previous</${P}DataTablePrevious>
              <${P}DataTableNext${f.nextProp}>Next</${P}DataTableNext>
            </div>
          </div>
        </div>
      </${P}DataTableRoot>
    </div>
  );
}
    `),
    vue: formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import { ${P}DataTableCell, ${P}DataTableHeader, ${P}DataTableHeaderRow, ${P}DataTableNext, ${P}DataTablePrevious, ${P}DataTableRoot, ${P}DataTableRow } from '../proto-ui/components/vue';

const selectedCount = ref(1);
const rows = [
  { id: 'inv-001', invoice: 'INV001', status: 'Paid', method: 'Credit Card' },
  { id: 'inv-002', invoice: 'INV002', status: 'Pending', method: 'PayPal' },
  { id: 'inv-003', invoice: 'INV003', status: 'Unpaid', method: 'Bank Transfer' },
  { id: 'inv-004', invoice: 'INV004', status: 'Paid', method: 'Credit Card' },
];
</script>

<template>
  <${P}DataTableRoot${f.rheaAttr}${f.tableClass} :rows="rows" :pageSize="3" :defaultSelectedKeys="['inv-001']" @selectionChange="selectedCount = $event.selectedKeys.length">
    <${P}DataTableHeaderRow>
      <${P}DataTableHeader headerKey="invoice">Invoice</${P}DataTableHeader>
      <${P}DataTableHeader headerKey="status">Status</${P}DataTableHeader>
      <${P}DataTableHeader headerKey="method">Method</${P}DataTableHeader>
    </${P}DataTableHeaderRow>
    <${P}DataTableRow v-for="index in [0, 1, 2]" :key="index" :index="index">
      <${P}DataTableCell columnKey="invoice" :headers="['invoice']" />
      <${P}DataTableCell columnKey="status" :headers="['status']" />
      <${P}DataTableCell columnKey="method" :headers="['method']" />
    </${P}DataTableRow>
    <div class="table-caption caption-bottom">
      <div class="flex items-center justify-between pt-3">
        <span class="text-sm text-muted-foreground">{{ selectedCount }} of {{ rows.length }} row(s) selected.</span>
        <div class="flex gap-2">
          <${P}DataTablePrevious>Previous</${P}DataTablePrevious>
          <${P}DataTableNext${f.nextProp}>Next</${P}DataTableNext>
        </div>
      </div>
    </div>
  </${P}DataTableRoot>
</template>
    `),
    vue2: formatCode(`
<template>
  <${P}DataTableRoot${f.rheaAttr}${f.tableClass} :rows="rows" :pageSize="3" :defaultSelectedKeys="['inv-001']">
    <${P}DataTableHeaderRow>
      <${P}DataTableHeader headerKey="invoice">Invoice</${P}DataTableHeader>
      <${P}DataTableHeader headerKey="status">Status</${P}DataTableHeader>
      <${P}DataTableHeader headerKey="method">Method</${P}DataTableHeader>
    </${P}DataTableHeaderRow>
    <${P}DataTableRow v-for="index in [0, 1, 2]" :key="index" :index="index">
      <${P}DataTableCell columnKey="invoice" :headers="['invoice']" />
      <${P}DataTableCell columnKey="status" :headers="['status']" />
      <${P}DataTableCell columnKey="method" :headers="['method']" />
    </${P}DataTableRow>
    <div class="table-caption caption-bottom">
      <div class="flex items-center justify-end gap-2 pt-3">
        <${P}DataTablePrevious>Previous</${P}DataTablePrevious>
        <${P}DataTableNext${f.nextProp}>Next</${P}DataTableNext>
      </div>
    </div>
  </${P}DataTableRoot>
</template>

<script>
import { ${P}DataTableCell, ${P}DataTableHeader, ${P}DataTableHeaderRow, ${P}DataTableNext, ${P}DataTablePrevious, ${P}DataTableRoot, ${P}DataTableRow } from '../proto-ui/components/vue2';
export default {
  components: { ${P}DataTableCell, ${P}DataTableHeader, ${P}DataTableHeaderRow, ${P}DataTableNext, ${P}DataTablePrevious, ${P}DataTableRoot, ${P}DataTableRow },
  data() {
    return {
      rows: [
        { id: 'inv-001', invoice: 'INV001', status: 'Paid', method: 'Credit Card' },
        { id: 'inv-002', invoice: 'INV002', status: 'Pending', method: 'PayPal' },
        { id: 'inv-003', invoice: 'INV003', status: 'Unpaid', method: 'Bank Transfer' },
        { id: 'inv-004', invoice: 'INV004', status: 'Paid', method: 'Credit Card' },
      ],
    };
  },
};
</script>
    `),
  };
}

function statesSnippets(f: FamilyMeta): Record<RuntimeId, string> {
  const P = f.pascal;
  const T = f.tag;
  const jsxClass = f.id === 'shadcn' ? ' className="rounded-md border border-border"' : '';
  return {
    wc: formatCode(`
<${T}-data-table-root id="readonly-table"${f.tableClass}></${T}-data-table-root>
<${T}-data-table-root id="disabled-table"${f.tableClass}></${T}-data-table-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const rows = [
    { id: 'm5gr84i9', status: 'Success', email: 'ken99@example.com' },
    { id: '3u1reuv4', status: 'Success', email: 'abe45@example.com' },
  ];
  setElementProps(document.querySelector('#readonly-table'), { ${f.rheaJsProp}rows, readOnly: true });
  setElementProps(document.querySelector('#disabled-table'), { ${f.rheaJsProp}rows, disabled: true });
</script>
    `),
    react: formatCode(`
import { ${P}DataTableCell, ${P}DataTableHeader, ${P}DataTableHeaderRow, ${P}DataTableRoot, ${P}DataTableRow } from '../proto-ui/components/react';

export function DataTableStatesDemo({ rows }: { rows: Array<{ id: string; status: string; email: string }> }) {
  return (
    <div className="grid gap-4">
      <${P}DataTableRoot${f.rheaProp}${jsxClass} rows={rows} pageSize={2} defaultSelectedKeys={['m5gr84i9']} readOnly>
        <${P}DataTableHeaderRow>
          <${P}DataTableHeader headerKey="status">Status</${P}DataTableHeader>
          <${P}DataTableHeader headerKey="email">Email</${P}DataTableHeader>
        </${P}DataTableHeaderRow>
        {[0, 1].map((index) => (
          <${P}DataTableRow key={index} index={index}>
            <${P}DataTableCell columnKey="status" headers={['status']} />
            <${P}DataTableCell columnKey="email" headers={['email']} />
          </${P}DataTableRow>
        ))}
      </${P}DataTableRoot>
      <${P}DataTableRoot${f.rheaProp}${jsxClass} rows={rows} pageSize={2} disabled>
        <${P}DataTableHeaderRow>
          <${P}DataTableHeader headerKey="status">Status</${P}DataTableHeader>
          <${P}DataTableHeader headerKey="email">Email</${P}DataTableHeader>
        </${P}DataTableHeaderRow>
        {[0, 1].map((index) => (
          <${P}DataTableRow key={index} index={index}>
            <${P}DataTableCell columnKey="status" headers={['status']} />
            <${P}DataTableCell columnKey="email" headers={['email']} />
          </${P}DataTableRow>
        ))}
      </${P}DataTableRoot>
    </div>
  );
}
    `),
    vue: formatCode(`
<script setup lang="ts">
import { ${P}DataTableCell, ${P}DataTableHeader, ${P}DataTableHeaderRow, ${P}DataTableRoot, ${P}DataTableRow } from '../proto-ui/components/vue';
const rows = [
  { id: 'm5gr84i9', status: 'Success', email: 'ken99@example.com' },
  { id: '3u1reuv4', status: 'Success', email: 'abe45@example.com' },
];
</script>

<template>
  <div class="grid gap-4">
    <${P}DataTableRoot${f.rheaAttr}${f.tableClass} :rows="rows" :readOnly="true">
      <${P}DataTableHeaderRow>
        <${P}DataTableHeader headerKey="status">Status</${P}DataTableHeader>
        <${P}DataTableHeader headerKey="email">Email</${P}DataTableHeader>
      </${P}DataTableHeaderRow>
      <${P}DataTableRow v-for="index in [0, 1]" :key="index" :index="index">
        <${P}DataTableCell columnKey="status" :headers="['status']" />
        <${P}DataTableCell columnKey="email" :headers="['email']" />
      </${P}DataTableRow>
    </${P}DataTableRoot>
    <${P}DataTableRoot${f.rheaAttr}${f.tableClass} :rows="rows" :disabled="true">
      <${P}DataTableHeaderRow>
        <${P}DataTableHeader headerKey="status">Status</${P}DataTableHeader>
        <${P}DataTableHeader headerKey="email">Email</${P}DataTableHeader>
      </${P}DataTableHeaderRow>
      <${P}DataTableRow v-for="index in [0, 1]" :key="index" :index="index">
        <${P}DataTableCell columnKey="status" :headers="['status']" />
        <${P}DataTableCell columnKey="email" :headers="['email']" />
      </${P}DataTableRow>
    </${P}DataTableRoot>
  </div>
</template>
    `),
    vue2: formatCode(`
<template>
  <${P}DataTableRoot${f.rheaAttr}${f.tableClass} :rows="rows" :readOnly="true">
    <${P}DataTableHeaderRow>
      <${P}DataTableHeader headerKey="status">Status</${P}DataTableHeader>
      <${P}DataTableHeader headerKey="email">Email</${P}DataTableHeader>
    </${P}DataTableHeaderRow>
    <${P}DataTableRow v-for="index in [0, 1]" :key="index" :index="index">
      <${P}DataTableCell columnKey="status" :headers="['status']" />
      <${P}DataTableCell columnKey="email" :headers="['email']" />
    </${P}DataTableRow>
  </${P}DataTableRoot>
</template>

<script>
import { ${P}DataTableCell, ${P}DataTableHeader, ${P}DataTableHeaderRow, ${P}DataTableRoot, ${P}DataTableRow } from '../proto-ui/components/vue2';
export default {
  components: { ${P}DataTableCell, ${P}DataTableHeader, ${P}DataTableHeaderRow, ${P}DataTableRoot, ${P}DataTableRow },
  data() {
    return { rows: [{ id: 'm5gr84i9', status: 'Success', email: 'ken99@example.com' }] };
  },
};
</script>
    `),
  };
}

function recipesSnippets(f: FamilyMeta): Record<RuntimeId, string> {
  const P = f.pascal;
  const T = f.tag;
  return {
    wc: formatCode(`
<div class="grid w-full max-w-xl gap-3">
  <${T}-input-root id="service-filter"></${T}-input-root>
  <div class="flex flex-wrap gap-2">
    <${T}-button id="toggle-col">Show / hide status</${T}-button>
    <${T}-button id="select-current-page">Select / clear current page</${T}-button>
  </div>
  <${T}-data-table-root id="recipes-table">
    <${T}-data-table-caption>Service inventory</${T}-data-table-caption>
    <${T}-data-table-header-row>
      <${T}-data-table-header>Service</${T}-data-table-header>
      <${T}-data-table-header>Status</${T}-data-table-header>
    </${T}-data-table-header-row>
    <${T}-data-table-row>
      <${T}-data-table-cell></${T}-data-table-cell>
      <${T}-data-table-cell id="custom-cell-0"><span></span></${T}-data-table-cell>
    </${T}-data-table-row>
    <div class="flex gap-2">
      <${T}-data-table-previous>Previous</${T}-data-table-previous>
      <${T}-data-table-next>Next</${T}-data-table-next>
    </div>
  </${T}-data-table-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#custom-cell-0'), {
    columnKey: 'state',
    headers: ['state'],
    renderValue: false,
  });
</script>
    `),
    react: formatCode(`
import { useState } from 'react';
import {
  ${P}Button,
  ${P}DataTableCell,
  ${P}DataTableHeader,
  ${P}DataTableHeaderRow,
  ${P}DataTableNext,
  ${P}DataTablePrevious,
  ${P}DataTableRoot,
  ${P}DataTableRow,
  ${P}InputRoot,
} from '../proto-ui/components/react';

export function CustomCellRecipeDemo() {
  const [nameFilter, setNameFilter] = useState('');
  const [showState, setShowState] = useState(true);
  const rows = [
    { id: 'api', name: 'API', state: 'ready' },
    { id: 'web', name: 'Website', state: 'busy' },
    { id: 'docs', name: 'Docs', state: 'ready' },
  ];

  return (
    <div className="grid w-full max-w-xl gap-3">
      <${P}InputRoot${f.rheaProp} placeholder="Filter services by name" onValueChange={({ value }) => setNameFilter(value)} />
      <${P}Button${f.rheaProp} onClick={() => setShowState((v) => !v)}>Show / hide status</${P}Button>
      <${P}DataTableRoot${f.rheaProp} rows={rows} pageSize={2} columnFilters={{ name: nameFilter }} columnVisibility={{ state: showState }}>
        <${P}DataTableHeaderRow>
          <${P}DataTableHeader headerKey="name">Service</${P}DataTableHeader>
          <${P}DataTableHeader headerKey="state">Status</${P}DataTableHeader>
        </${P}DataTableHeaderRow>
        {[0, 1].map((index) => (
          <${P}DataTableRow key={index} index={index}>
            <${P}DataTableCell columnKey="name" headers={['name']} />
            <${P}DataTableCell columnKey="state" headers={['state']} renderValue={false}>
              <span className="font-mono text-xs">{/* format from displayValue */}</span>
            </${P}DataTableCell>
          </${P}DataTableRow>
        ))}
        <div className="flex gap-2">
          <${P}DataTablePrevious>Previous</${P}DataTablePrevious>
          <${P}DataTableNext>Next</${P}DataTableNext>
        </div>
      </${P}DataTableRoot>
    </div>
  );
}
    `),
    vue: formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import { ${P}Button, ${P}DataTableCell, ${P}DataTableHeader, ${P}DataTableHeaderRow, ${P}DataTableRoot, ${P}DataTableRow, ${P}InputRoot } from '../proto-ui/components/vue';

const nameFilter = ref('');
const showState = ref(true);
const rows = [
  { id: 'api', name: 'API', state: 'ready' },
  { id: 'web', name: 'Website', state: 'busy' },
  { id: 'docs', name: 'Docs', state: 'ready' },
];
</script>

<template>
  <div class="grid w-full max-w-xl gap-3">
    <${P}InputRoot${f.rheaAttr} placeholder="Filter services by name" @valueChange="nameFilter = $event.value" />
    <${P}Button${f.rheaAttr} @click="showState = !showState">Show / hide status</${P}Button>
    <${P}DataTableRoot${f.rheaAttr} :rows="rows" :pageSize="2" :columnFilters="{ name: nameFilter }" :columnVisibility="{ state: showState }">
      <${P}DataTableHeaderRow>
        <${P}DataTableHeader headerKey="name">Service</${P}DataTableHeader>
        <${P}DataTableHeader headerKey="state">Status</${P}DataTableHeader>
      </${P}DataTableHeaderRow>
      <${P}DataTableRow v-for="index in [0, 1]" :key="index" :index="index">
        <${P}DataTableCell columnKey="name" :headers="['name']" />
        <${P}DataTableCell columnKey="state" :headers="['state']" :renderValue="false">
          <span class="font-mono text-xs" />
        </${P}DataTableCell>
      </${P}DataTableRow>
    </${P}DataTableRoot>
  </div>
</template>
    `),
    vue2: formatCode(`
<template>
  <${P}DataTableRoot${f.rheaAttr} :rows="rows" :pageSize="2" :columnFilters="{ name: nameFilter }" :columnVisibility="{ state: showState }">
    <${P}DataTableHeaderRow>
      <${P}DataTableHeader headerKey="name">Service</${P}DataTableHeader>
      <${P}DataTableHeader headerKey="state">Status</${P}DataTableHeader>
    </${P}DataTableHeaderRow>
    <${P}DataTableRow v-for="index in [0, 1]" :key="index" :index="index">
      <${P}DataTableCell columnKey="name" :headers="['name']" />
      <${P}DataTableCell columnKey="state" :headers="['state']" :renderValue="false">
        <span class="font-mono text-xs" />
      </${P}DataTableCell>
    </${P}DataTableRow>
  </${P}DataTableRoot>
</template>

<script>
import { ${P}DataTableCell, ${P}DataTableHeader, ${P}DataTableHeaderRow, ${P}DataTableRoot, ${P}DataTableRow } from '../proto-ui/components/vue2';
export default {
  components: { ${P}DataTableCell, ${P}DataTableHeader, ${P}DataTableHeaderRow, ${P}DataTableRoot, ${P}DataTableRow },
  data() {
    return {
      nameFilter: '',
      showState: true,
      rows: [
        { id: 'api', name: 'API', state: 'ready' },
        { id: 'web', name: 'Website', state: 'busy' },
      ],
    };
  },
};
</script>
    `),
  };
}

const wc: Record<string, string> = {};
const react: Record<string, string> = {};
const vue: Record<string, string> = {};
const vue2: Record<string, string> = {};

for (const family of FAMILIES) {
  const entries: Array<[string, Record<RuntimeId, string>]> = [
    [`demo-${family.id}-data-table`, heroSnippets(family)],
    [`demo-${family.id}-data-table-basic`, basicSnippets(family)],
    [`demo-${family.id}-data-table-filtering`, filteringSnippets(family)],
    [`demo-${family.id}-data-table-pagination`, paginationSnippets(family)],
    [`demo-${family.id}-data-table-states`, statesSnippets(family)],
  ];
  if (family.id === 'shadcn' || family.id === 'brutalist') {
    entries.push([`demo-${family.id}-data-table-recipes`, recipesSnippets(family)]);
  }
  for (const [id, snippets] of entries) {
    wc[id] = snippets.wc;
    react[id] = snippets.react;
    vue[id] = snippets.vue;
    vue2[id] = snippets.vue2;
  }
}

export const codeMap: Record<RuntimeId, Record<string, string>> = { wc, react, vue, vue2 };
