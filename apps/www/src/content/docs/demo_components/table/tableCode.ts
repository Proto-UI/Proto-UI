import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

type FamilyCodeMeta = {
  prefix: string;
  pkg: string;
  componentPrefix: string;
  hasStyleProfile?: boolean;
  hasLastInSection?: boolean;
  hasDestructiveItem?: boolean;
  liquidGlassBackdrop?: boolean;
};

const FAMILIES: Record<string, FamilyCodeMeta> = {
  shadcn: {
    prefix: 'shadcn',
    pkg: '@proto.ui/prototypes-shadcn',
    componentPrefix: 'Shadcn',
    hasStyleProfile: true,
    hasLastInSection: true,
    hasDestructiveItem: true,
  },
  brutalist: {
    prefix: 'brutalist',
    pkg: '@proto.ui/prototypes-brutalist',
    componentPrefix: 'Brutalist',
    hasLastInSection: true,
    hasDestructiveItem: true,
  },
  'bootstrap-2-3-2': {
    prefix: 'bootstrap-2-3-2',
    pkg: '@proto.ui/prototypes-bootstrap-2-3-2',
    componentPrefix: 'Bootstrap',
  },
  'liquid-glass': {
    prefix: 'liquid-glass',
    pkg: '@proto.ui/prototypes-liquid-glass',
    componentPrefix: 'LiquidGlass',
    hasLastInSection: true,
    liquidGlassBackdrop: true,
  },
};

function invoiceWcSnippet(meta: FamilyCodeMeta, compact: boolean): string {
  const p = meta.prefix;
  const rows = compact
    ? [
        ['inv001', 'INV001', 'Paid', 'Credit Card', '$250.00'],
        ['inv002', 'INV002', 'Pending', 'PayPal', '$150.00'],
        ['inv003', 'INV003', 'Unpaid', 'Bank Transfer', '$350.00'],
      ]
    : [
        ['inv001', 'INV001', 'Paid', 'Credit Card', '$250.00'],
        ['inv002', 'INV002', 'Pending', 'PayPal', '$150.00'],
        ['inv003', 'INV003', 'Unpaid', 'Bank Transfer', '$350.00'],
        ['inv004', 'INV004', 'Paid', 'Credit Card', '$450.00'],
        ['inv005', 'INV005', 'Paid', 'PayPal', '$550.00'],
        ['inv006', 'INV006', 'Pending', 'Bank Transfer', '$200.00'],
        ['inv007', 'INV007', 'Unpaid', 'Credit Card', '$300.00'],
      ];
  const total = compact ? '$750.00' : '$2,500.00';
  const lastAttr = meta.hasLastInSection ? ' last-in-section' : '';
  const styleAttr = meta.hasStyleProfile ? ' style-profile="rhea"' : '';

  const bodyHtml = rows
    .map(
      (
        [key, inv, status, method, amount],
        index
      ) => `    <${p}-table-row section="body"${index === rows.length - 1 ? lastAttr : ''}>
      <${p}-table-header-cell header-key="${key}" header-kind="row">${inv}</${p}-table-header-cell>
      <${p}-table-cell>${status}</${p}-table-cell>
      <${p}-table-cell>${method}</${p}-table-cell>
      <${p}-table-cell style="text-align: end">${amount}</${p}-table-cell>
    </${p}-table-row>`
    )
    .join('\n');

  const tableHtml = `<div class="w-full overflow-x-auto">
  <${p}-table-root${styleAttr}>
    <${p}-table-caption>A list of your recent invoices.</${p}-table-caption>
    <${p}-table-row section="header"${lastAttr}>
      <${p}-table-header-cell header-key="invoice" header-kind="column" style="width: 100px">Invoice</${p}-table-header-cell>
      <${p}-table-header-cell header-key="status" header-kind="column">Status</${p}-table-header-cell>
      <${p}-table-header-cell header-key="method" header-kind="column">Method</${p}-table-header-cell>
      <${p}-table-header-cell header-key="amount" header-kind="column" style="text-align: end">Amount</${p}-table-header-cell>
    </${p}-table-row>
${bodyHtml}
    <${p}-table-row section="footer"${lastAttr}>
      <${p}-table-header-cell header-key="total" header-kind="row">Total</${p}-table-header-cell>
      <${p}-table-cell></${p}-table-cell>
      <${p}-table-cell></${p}-table-cell>
      <${p}-table-cell style="text-align: end">${total}</${p}-table-cell>
    </${p}-table-row>
  </${p}-table-root>
</div>`;

  return formatCode(tableHtml);
}

function invoiceReactSnippet(meta: FamilyCodeMeta, compact: boolean): string {
  const c = meta.componentPrefix;
  const total = compact ? '$750.00' : '$2,500.00';
  const styleProp = meta.hasStyleProfile ? ' styleProfile="rhea"' : '';
  const lastBodyProp = meta.hasLastInSection
    ? ' lastInSection={index === invoices.length - 1}'
    : '';
  const lastStaticProp = meta.hasLastInSection ? ' lastInSection' : '';
  const sliceLine = compact
    ? 'const invoices = allInvoices.slice(0, 3);'
    : 'const invoices = allInvoices;';

  return formatCode(`
import {
  ${c}TableRoot,
  ${c}TableCaption,
  ${c}TableRow,
  ${c}TableHeaderCell,
  ${c}TableCell,
} from '../proto-ui/components/react';

const allInvoices = [
  { key: 'inv001', invoice: 'INV001', status: 'Paid', method: 'Credit Card', amount: '$250.00' },
  { key: 'inv002', invoice: 'INV002', status: 'Pending', method: 'PayPal', amount: '$150.00' },
  { key: 'inv003', invoice: 'INV003', status: 'Unpaid', method: 'Bank Transfer', amount: '$350.00' },
  { key: 'inv004', invoice: 'INV004', status: 'Paid', method: 'Credit Card', amount: '$450.00' },
  { key: 'inv005', invoice: 'INV005', status: 'Paid', method: 'PayPal', amount: '$550.00' },
  { key: 'inv006', invoice: 'INV006', status: 'Pending', method: 'Bank Transfer', amount: '$200.00' },
  { key: 'inv007', invoice: 'INV007', status: 'Unpaid', method: 'Credit Card', amount: '$300.00' },
];

${sliceLine}

export function TableDemo() {
  return (
    <div className="w-full overflow-x-auto">
      <${c}TableRoot${styleProp}>
        <${c}TableCaption>A list of your recent invoices.</${c}TableCaption>
        <${c}TableRow section="header"${lastStaticProp}>
          <${c}TableHeaderCell headerKey="invoice" headerKind="column" style={{ width: '100px' }}>Invoice</${c}TableHeaderCell>
          <${c}TableHeaderCell headerKey="status" headerKind="column">Status</${c}TableHeaderCell>
          <${c}TableHeaderCell headerKey="method" headerKind="column">Method</${c}TableHeaderCell>
          <${c}TableHeaderCell headerKey="amount" headerKind="column" style={{ textAlign: 'end' }}>Amount</${c}TableHeaderCell>
        </${c}TableRow>
        {invoices.map((item, index) => (
          <${c}TableRow key={item.key} section="body"${lastBodyProp}>
            <${c}TableHeaderCell headerKey={item.key} headerKind="row" className="font-medium">
              {item.invoice}
            </${c}TableHeaderCell>
            <${c}TableCell headers={['status', item.key]}>{item.status}</${c}TableCell>
            <${c}TableCell headers={['method', item.key]}>{item.method}</${c}TableCell>
            <${c}TableCell headers={['amount', item.key]} style={{ textAlign: 'end' }}>
              {item.amount}
            </${c}TableCell>
          </${c}TableRow>
        ))}
        <${c}TableRow section="footer"${lastStaticProp}>
          <${c}TableHeaderCell headerKey="total" headerKind="row">Total</${c}TableHeaderCell>
          <${c}TableCell headers={['status', 'total']} />
          <${c}TableCell headers={['method', 'total']} />
          <${c}TableCell headers={['amount', 'total']} style={{ textAlign: 'end' }}>${total}</${c}TableCell>
        </${c}TableRow>
      </${c}TableRoot>
    </div>
  );
}
  `);
}

function invoiceVueSnippet(meta: FamilyCodeMeta, compact: boolean, vue2: boolean): string {
  const c = meta.componentPrefix;
  const total = compact ? '$750.00' : '$2,500.00';
  const styleProp = meta.hasStyleProfile ? ' style-profile="rhea"' : '';
  const lastBodyProp = meta.hasLastInSection
    ? ' :last-in-section="index === invoices.length - 1"'
    : '';
  const lastStaticProp = meta.hasLastInSection ? ' :last-in-section="true"' : '';
  const sliceExpr = compact ? '.slice(0, 3)' : '';

  const template = `<template>
  <div class="w-full overflow-x-auto">
    <${c}TableRoot${styleProp}>
      <${c}TableCaption>A list of your recent invoices.</${c}TableCaption>
      <${c}TableRow section="header"${lastStaticProp}>
        <${c}TableHeaderCell header-key="invoice" header-kind="column" style="width: 100px">Invoice</${c}TableHeaderCell>
        <${c}TableHeaderCell header-key="status" header-kind="column">Status</${c}TableHeaderCell>
        <${c}TableHeaderCell header-key="method" header-kind="column">Method</${c}TableHeaderCell>
        <${c}TableHeaderCell header-key="amount" header-kind="column" style="text-align: end">Amount</${c}TableHeaderCell>
      </${c}TableRow>
      <${c}TableRow v-for="(item, index) in invoices" :key="item.key" section="body"${lastBodyProp}>
        <${c}TableHeaderCell :header-key="item.key" header-kind="row">{{ item.invoice }}</${c}TableHeaderCell>
        <${c}TableCell :headers="['status', item.key]">{{ item.status }}</${c}TableCell>
        <${c}TableCell :headers="['method', item.key]">{{ item.method }}</${c}TableCell>
        <${c}TableCell :headers="['amount', item.key]" style="text-align: end">{{ item.amount }}</${c}TableCell>
      </${c}TableRow>
      <${c}TableRow section="footer"${lastStaticProp}>
        <${c}TableHeaderCell header-key="total" header-kind="row">Total</${c}TableHeaderCell>
        <${c}TableCell :headers="['status', 'total']" />
        <${c}TableCell :headers="['method', 'total']" />
        <${c}TableCell :headers="['amount', 'total']" style="text-align: end">${total}</${c}TableCell>
      </${c}TableRow>
    </${c}TableRoot>
  </div>
</template>`;

  if (vue2) {
    return formatCode(`
${template}

<script>
import {
  ${c}TableRoot,
  ${c}TableCaption,
  ${c}TableRow,
  ${c}TableHeaderCell,
  ${c}TableCell,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${c}TableRoot,
    ${c}TableCaption,
    ${c}TableRow,
    ${c}TableHeaderCell,
    ${c}TableCell,
  },
  data() {
    return {
      invoices: [
        { key: 'inv001', invoice: 'INV001', status: 'Paid', method: 'Credit Card', amount: '$250.00' },
        { key: 'inv002', invoice: 'INV002', status: 'Pending', method: 'PayPal', amount: '$150.00' },
        { key: 'inv003', invoice: 'INV003', status: 'Unpaid', method: 'Bank Transfer', amount: '$350.00' },
        { key: 'inv004', invoice: 'INV004', status: 'Paid', method: 'Credit Card', amount: '$450.00' },
        { key: 'inv005', invoice: 'INV005', status: 'Paid', method: 'PayPal', amount: '$550.00' },
        { key: 'inv006', invoice: 'INV006', status: 'Pending', method: 'Bank Transfer', amount: '$200.00' },
        { key: 'inv007', invoice: 'INV007', status: 'Unpaid', method: 'Credit Card', amount: '$300.00' },
      ]${sliceExpr},
    };
  },
};
</script>
    `);
  }

  return formatCode(`
${template}

<script setup>
import {
  ${c}TableRoot,
  ${c}TableCaption,
  ${c}TableRow,
  ${c}TableHeaderCell,
  ${c}TableCell,
} from '../proto-ui/components/vue';

const invoices = [
  { key: 'inv001', invoice: 'INV001', status: 'Paid', method: 'Credit Card', amount: '$250.00' },
  { key: 'inv002', invoice: 'INV002', status: 'Pending', method: 'PayPal', amount: '$150.00' },
  { key: 'inv003', invoice: 'INV003', status: 'Unpaid', method: 'Bank Transfer', amount: '$350.00' },
  { key: 'inv004', invoice: 'INV004', status: 'Paid', method: 'Credit Card', amount: '$450.00' },
  { key: 'inv005', invoice: 'INV005', status: 'Paid', method: 'PayPal', amount: '$550.00' },
  { key: 'inv006', invoice: 'INV006', status: 'Pending', method: 'Bank Transfer', amount: '$200.00' },
  { key: 'inv007', invoice: 'INV007', status: 'Unpaid', method: 'Credit Card', amount: '$300.00' },
]${sliceExpr};
</script>
  `);
}

function actionsWcSnippet(meta: FamilyCodeMeta): string {
  const p = meta.prefix;
  const styleAttr = meta.hasStyleProfile ? ' style-profile="rhea"' : '';
  const lastAttr = meta.hasLastInSection ? ' last-in-section' : '';
  const destructiveAttr = meta.hasDestructiveItem ? ' variant="destructive"' : '';
  return formatCode(`
<div class="w-full overflow-x-auto">
  <${p}-table-root${styleAttr}>
    <${p}-table-row section="header"${lastAttr}>
      <${p}-table-header-cell header-key="product" header-kind="column">Product</${p}-table-header-cell>
      <${p}-table-header-cell header-key="price" header-kind="column">Price</${p}-table-header-cell>
      <${p}-table-header-cell header-key="actions" header-kind="column" style="text-align: end">Actions</${p}-table-header-cell>
    </${p}-table-row>
    <${p}-table-row section="body">
      <${p}-table-header-cell header-key="mouse" header-kind="row">Wireless Mouse</${p}-table-header-cell>
      <${p}-table-cell>$29.99</${p}-table-cell>
      <${p}-table-cell style="text-align: end">
        <${p}-dropdown-root>
          <${p}-dropdown-trigger>
            <span aria-hidden="true">⋯</span>
            <span class="sr-only">Open menu</span>
          </${p}-dropdown-trigger>
          <${p}-dropdown-content align="end">
            <${p}-dropdown-item value="edit">Edit</${p}-dropdown-item>
            <${p}-dropdown-item value="duplicate">Duplicate</${p}-dropdown-item>
            <${p}-dropdown-separator></${p}-dropdown-separator>
            <${p}-dropdown-item value="delete"${destructiveAttr}>Delete</${p}-dropdown-item>
          </${p}-dropdown-content>
        </${p}-dropdown-root>
      </${p}-table-cell>
    </${p}-table-row>
  </${p}-table-root>
</div>
  `);
}

function actionsReactSnippet(meta: FamilyCodeMeta): string {
  const c = meta.componentPrefix;
  const styleProp = meta.hasStyleProfile ? ' styleProfile="rhea"' : '';
  const lastStatic = meta.hasLastInSection ? ' lastInSection' : '';
  const lastBody = meta.hasLastInSection ? ' lastInSection={index === products.length - 1}' : '';
  const destructiveProp = meta.hasDestructiveItem ? ' variant="destructive"' : '';
  return formatCode(`
import {
  ${c}TableRoot,
  ${c}TableRow,
  ${c}TableHeaderCell,
  ${c}TableCell,
  ${c}DropdownRoot,
  ${c}DropdownTrigger,
  ${c}DropdownContent,
  ${c}DropdownItem,
  ${c}DropdownSeparator,
} from '../proto-ui/components/react';

const products = [
  { key: 'mouse', name: 'Wireless Mouse', price: '$29.99' },
  { key: 'keyboard', name: 'Mechanical Keyboard', price: '$129.99' },
  { key: 'hub', name: 'USB-C Hub', price: '$49.99' },
];

export function TableActions() {
  return (
    <div className="w-full overflow-x-auto">
      <${c}TableRoot${styleProp}>
        <${c}TableRow section="header"${lastStatic}>
          <${c}TableHeaderCell headerKey="product" headerKind="column">Product</${c}TableHeaderCell>
          <${c}TableHeaderCell headerKey="price" headerKind="column">Price</${c}TableHeaderCell>
          <${c}TableHeaderCell headerKey="actions" headerKind="column" style={{ textAlign: 'end' }}>Actions</${c}TableHeaderCell>
        </${c}TableRow>
        {products.map((product, index) => (
          <${c}TableRow key={product.key} section="body"${lastBody}>
            <${c}TableHeaderCell headerKey={product.key} headerKind="row" className="font-medium">
              {product.name}
            </${c}TableHeaderCell>
            <${c}TableCell headers={['price', product.key]}>{product.price}</${c}TableCell>
            <${c}TableCell headers={['actions', product.key]} style={{ textAlign: 'end' }}>
              <${c}DropdownRoot>
                <${c}DropdownTrigger>
                  <span aria-hidden="true">⋯</span>
                  <span className="sr-only">Open menu</span>
                </${c}DropdownTrigger>
                <${c}DropdownContent align="end">
                  <${c}DropdownItem value="edit">Edit</${c}DropdownItem>
                  <${c}DropdownItem value="duplicate">Duplicate</${c}DropdownItem>
                  <${c}DropdownSeparator />
                  <${c}DropdownItem value="delete"${destructiveProp}>Delete</${c}DropdownItem>
                </${c}DropdownContent>
              </${c}DropdownRoot>
            </${c}TableCell>
          </${c}TableRow>
        ))}
      </${c}TableRoot>
    </div>
  );
}
  `);
}

function actionsVueSnippet(meta: FamilyCodeMeta, vue2: boolean): string {
  const c = meta.componentPrefix;
  const styleProp = meta.hasStyleProfile ? ' style-profile="rhea"' : '';
  const lastStatic = meta.hasLastInSection ? ' :last-in-section="true"' : '';
  const lastBody = meta.hasLastInSection ? ' :last-in-section="index === products.length - 1"' : '';
  const destructiveProp = meta.hasDestructiveItem ? ' variant="destructive"' : '';
  const template = `<template>
  <div class="w-full overflow-x-auto">
    <${c}TableRoot${styleProp}>
      <${c}TableRow section="header"${lastStatic}>
        <${c}TableHeaderCell header-key="product" header-kind="column">Product</${c}TableHeaderCell>
        <${c}TableHeaderCell header-key="price" header-kind="column">Price</${c}TableHeaderCell>
        <${c}TableHeaderCell header-key="actions" header-kind="column" style="text-align: end">Actions</${c}TableHeaderCell>
      </${c}TableRow>
      <${c}TableRow v-for="(product, index) in products" :key="product.key" section="body"${lastBody}>
        <${c}TableHeaderCell :header-key="product.key" header-kind="row">{{ product.name }}</${c}TableHeaderCell>
        <${c}TableCell :headers="['price', product.key]">{{ product.price }}</${c}TableCell>
        <${c}TableCell :headers="['actions', product.key]" style="text-align: end">
          <${c}DropdownRoot>
            <${c}DropdownTrigger>
              <span aria-hidden="true">⋯</span>
              <span class="sr-only">Open menu</span>
            </${c}DropdownTrigger>
            <${c}DropdownContent align="end">
              <${c}DropdownItem value="edit">Edit</${c}DropdownItem>
              <${c}DropdownItem value="duplicate">Duplicate</${c}DropdownItem>
              <${c}DropdownSeparator />
              <${c}DropdownItem value="delete"${destructiveProp}>Delete</${c}DropdownItem>
            </${c}DropdownContent>
          </${c}DropdownRoot>
        </${c}TableCell>
      </${c}TableRow>
    </${c}TableRoot>
  </div>
</template>`;

  if (vue2) {
    return formatCode(`
${template}

<script>
import {
  ${c}TableRoot,
  ${c}TableRow,
  ${c}TableHeaderCell,
  ${c}TableCell,
  ${c}DropdownRoot,
  ${c}DropdownTrigger,
  ${c}DropdownContent,
  ${c}DropdownItem,
  ${c}DropdownSeparator,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${c}TableRoot,
    ${c}TableRow,
    ${c}TableHeaderCell,
    ${c}TableCell,
    ${c}DropdownRoot,
    ${c}DropdownTrigger,
    ${c}DropdownContent,
    ${c}DropdownItem,
    ${c}DropdownSeparator,
  },
  data() {
    return {
      products: [
        { key: 'mouse', name: 'Wireless Mouse', price: '$29.99' },
        { key: 'keyboard', name: 'Mechanical Keyboard', price: '$129.99' },
        { key: 'hub', name: 'USB-C Hub', price: '$49.99' },
      ],
    };
  },
};
</script>
    `);
  }

  return formatCode(`
${template}

<script setup>
import {
  ${c}TableRoot,
  ${c}TableRow,
  ${c}TableHeaderCell,
  ${c}TableCell,
  ${c}DropdownRoot,
  ${c}DropdownTrigger,
  ${c}DropdownContent,
  ${c}DropdownItem,
  ${c}DropdownSeparator,
} from '../proto-ui/components/vue';

const products = [
  { key: 'mouse', name: 'Wireless Mouse', price: '$29.99' },
  { key: 'keyboard', name: 'Mechanical Keyboard', price: '$129.99' },
  { key: 'hub', name: 'USB-C Hub', price: '$49.99' },
];
</script>
  `);
}

function rtlWcSnippet(meta: FamilyCodeMeta): string {
  const p = meta.prefix;
  const styleAttr = meta.hasStyleProfile ? ' style-profile="rhea"' : '';
  return formatCode(`
<div dir="rtl" class="w-full overflow-x-auto">
  <${p}-table-root${styleAttr}>
    <${p}-table-caption>قائمة بفواتيرك الأخيرة.</${p}-table-caption>
    <${p}-table-row section="header" last-in-section>
      <${p}-table-header-cell header-key="invoice" header-kind="column" style="width: 100px">الفاتورة</${p}-table-header-cell>
      <${p}-table-header-cell header-key="status" header-kind="column">الحالة</${p}-table-header-cell>
      <${p}-table-header-cell header-key="method" header-kind="column">الطريقة</${p}-table-header-cell>
      <${p}-table-header-cell header-key="amount" header-kind="column" style="text-align: end">المبلغ</${p}-table-header-cell>
    </${p}-table-row>
    <${p}-table-row section="body">
      <${p}-table-header-cell header-key="inv001" header-kind="row">INV001</${p}-table-header-cell>
      <${p}-table-cell>مدفوع</${p}-table-cell>
      <${p}-table-cell>بطاقة ائتمانية</${p}-table-cell>
      <${p}-table-cell style="text-align: end">$250.00</${p}-table-cell>
    </${p}-table-row>
    <${p}-table-row section="footer" last-in-section>
      <${p}-table-header-cell header-key="total" header-kind="row">المجموع</${p}-table-header-cell>
      <${p}-table-cell></${p}-table-cell>
      <${p}-table-cell></${p}-table-cell>
      <${p}-table-cell style="text-align: end">$1,200.00</${p}-table-cell>
    </${p}-table-row>
  </${p}-table-root>
</div>
  `);
}

function rtlReactSnippet(meta: FamilyCodeMeta): string {
  const c = meta.componentPrefix;
  const styleProp = meta.hasStyleProfile ? ' styleProfile="rhea"' : '';
  return formatCode(`
import {
  ${c}TableRoot,
  ${c}TableCaption,
  ${c}TableRow,
  ${c}TableHeaderCell,
  ${c}TableCell,
} from '../proto-ui/components/react';

export function TableRtl() {
  return (
    <div dir="rtl" className="w-full overflow-x-auto">
      <${c}TableRoot${styleProp}>
        <${c}TableCaption>قائمة بفواتيرك الأخيرة.</${c}TableCaption>
        <${c}TableRow section="header" lastInSection>
          <${c}TableHeaderCell headerKey="invoice" headerKind="column" style={{ width: '100px' }}>الفاتورة</${c}TableHeaderCell>
          <${c}TableHeaderCell headerKey="status" headerKind="column">الحالة</${c}TableHeaderCell>
          <${c}TableHeaderCell headerKey="method" headerKind="column">الطريقة</${c}TableHeaderCell>
          <${c}TableHeaderCell headerKey="amount" headerKind="column" style={{ textAlign: 'end' }}>المبلغ</${c}TableHeaderCell>
        </${c}TableRow>
        <${c}TableRow section="body" lastInSection>
          <${c}TableHeaderCell headerKey="inv001" headerKind="row">INV001</${c}TableHeaderCell>
          <${c}TableCell headers={['status', 'inv001']}>مدفوع</${c}TableCell>
          <${c}TableCell headers={['method', 'inv001']}>بطاقة ائتمانية</${c}TableCell>
          <${c}TableCell headers={['amount', 'inv001']} style={{ textAlign: 'end' }}>$250.00</${c}TableCell>
        </${c}TableRow>
        <${c}TableRow section="footer" lastInSection>
          <${c}TableHeaderCell headerKey="total" headerKind="row">المجموع</${c}TableHeaderCell>
          <${c}TableCell headers={['status', 'total']} />
          <${c}TableCell headers={['method', 'total']} />
          <${c}TableCell headers={['amount', 'total']} style={{ textAlign: 'end' }}>$1,200.00</${c}TableCell>
        </${c}TableRow>
      </${c}TableRoot>
    </div>
  );
}
  `);
}

function rtlVueSnippet(meta: FamilyCodeMeta, vue2: boolean): string {
  const c = meta.componentPrefix;
  const styleProp = meta.hasStyleProfile ? ' style-profile="rhea"' : '';
  const pkgPath = vue2 ? '../proto-ui/components/vue2' : '../proto-ui/components/vue';
  const scriptBlock = vue2
    ? `<script>
import {
  ${c}TableRoot,
  ${c}TableCaption,
  ${c}TableRow,
  ${c}TableHeaderCell,
  ${c}TableCell,
} from '${pkgPath}';

export default {
  components: { ${c}TableRoot, ${c}TableCaption, ${c}TableRow, ${c}TableHeaderCell, ${c}TableCell },
};
</script>`
    : `<script setup>
import {
  ${c}TableRoot,
  ${c}TableCaption,
  ${c}TableRow,
  ${c}TableHeaderCell,
  ${c}TableCell,
} from '${pkgPath}';
</script>`;

  return formatCode(`
<template>
  <div dir="rtl" class="w-full overflow-x-auto">
    <${c}TableRoot${styleProp}>
      <${c}TableCaption>قائمة بفواتيرك الأخيرة.</${c}TableCaption>
      <${c}TableRow section="header" :last-in-section="true">
        <${c}TableHeaderCell header-key="invoice" header-kind="column" style="width: 100px">الفاتورة</${c}TableHeaderCell>
        <${c}TableHeaderCell header-key="status" header-kind="column">الحالة</${c}TableHeaderCell>
        <${c}TableHeaderCell header-key="method" header-kind="column">الطريقة</${c}TableHeaderCell>
        <${c}TableHeaderCell header-key="amount" header-kind="column" style="text-align: end">المبلغ</${c}TableHeaderCell>
      </${c}TableRow>
      <${c}TableRow section="body" :last-in-section="true">
        <${c}TableHeaderCell header-key="inv001" header-kind="row">INV001</${c}TableHeaderCell>
        <${c}TableCell :headers="['status', 'inv001']">مدفوع</${c}TableCell>
        <${c}TableCell :headers="['method', 'inv001']">بطاقة ائتمانية</${c}TableCell>
        <${c}TableCell :headers="['amount', 'inv001']" style="text-align: end">$250.00</${c}TableCell>
      </${c}TableRow>
      <${c}TableRow section="footer" :last-in-section="true">
        <${c}TableHeaderCell header-key="total" header-kind="row">المجموع</${c}TableHeaderCell>
        <${c}TableCell :headers="['status', 'total']" />
        <${c}TableCell :headers="['method', 'total']" />
        <${c}TableCell :headers="['amount', 'total']" style="text-align: end">$1,200.00</${c}TableCell>
      </${c}TableRow>
    </${c}TableRoot>
  </div>
</template>

${scriptBlock}
  `);
}

const bootstrapVariantsWc = formatCode(`
<div class="w-full overflow-x-auto">
  <bootstrap-2-3-2-table-root bordered>
    <bootstrap-2-3-2-table-caption>Service health summary</bootstrap-2-3-2-table-caption>
    <bootstrap-2-3-2-table-row section="header">
      <bootstrap-2-3-2-table-header-cell header-key="service" header-kind="column" condensed>Service</bootstrap-2-3-2-table-header-cell>
      <bootstrap-2-3-2-table-header-cell header-key="region" header-kind="column" condensed bordered>Region</bootstrap-2-3-2-table-header-cell>
      <bootstrap-2-3-2-table-header-cell header-key="status" header-kind="column" condensed bordered>Status</bootstrap-2-3-2-table-header-cell>
    </bootstrap-2-3-2-table-row>
    <bootstrap-2-3-2-table-row hoverable tone="info">
      <bootstrap-2-3-2-table-header-cell header-key="billing" header-kind="row" condensed>Billing</bootstrap-2-3-2-table-header-cell>
      <bootstrap-2-3-2-table-cell condensed bordered>eu-west-1</bootstrap-2-3-2-table-cell>
      <bootstrap-2-3-2-table-cell condensed bordered>Maintenance scheduled</bootstrap-2-3-2-table-cell>
    </bootstrap-2-3-2-table-row>
    <bootstrap-2-3-2-table-row hoverable tone="warning">
      <bootstrap-2-3-2-table-header-cell header-key="webhooks" header-kind="row" condensed>Webhooks</bootstrap-2-3-2-table-header-cell>
      <bootstrap-2-3-2-table-cell condensed bordered>us-west-2</bootstrap-2-3-2-table-cell>
      <bootstrap-2-3-2-table-cell condensed bordered>Elevated latency</bootstrap-2-3-2-table-cell>
    </bootstrap-2-3-2-table-row>
    <bootstrap-2-3-2-table-row hoverable striped>
      <bootstrap-2-3-2-table-header-cell header-key="archive" header-kind="row" condensed>Cold Archive</bootstrap-2-3-2-table-header-cell>
      <bootstrap-2-3-2-table-cell condensed bordered>ap-east-1</bootstrap-2-3-2-table-cell>
      <bootstrap-2-3-2-table-cell condensed bordered>Sync retrying</bootstrap-2-3-2-table-cell>
    </bootstrap-2-3-2-table-row>
    <bootstrap-2-3-2-table-row hoverable tone="error">
      <bootstrap-2-3-2-table-header-cell header-key="smtp" header-kind="row" condensed>SMTP Relay</bootstrap-2-3-2-table-header-cell>
      <bootstrap-2-3-2-table-cell condensed bordered>eu-central-1</bootstrap-2-3-2-table-cell>
      <bootstrap-2-3-2-table-cell condensed bordered>Degraded delivery</bootstrap-2-3-2-table-cell>
    </bootstrap-2-3-2-table-row>
  </bootstrap-2-3-2-table-root>
</div>
`);

const bootstrapVariantsReact = formatCode(`
import {
  BootstrapTableRoot,
  BootstrapTableCaption,
  BootstrapTableRow,
  BootstrapTableHeaderCell,
  BootstrapTableCell,
} from '../proto-ui/components/react';

export function BootstrapTableVariants() {
  return (
    <div className="w-full overflow-x-auto">
      <BootstrapTableRoot bordered>
        <BootstrapTableCaption>Service health summary</BootstrapTableCaption>
        <BootstrapTableRow section="header">
          <BootstrapTableHeaderCell headerKey="service" headerKind="column" condensed>Service</BootstrapTableHeaderCell>
          <BootstrapTableHeaderCell headerKey="region" headerKind="column" condensed bordered>Region</BootstrapTableHeaderCell>
          <BootstrapTableHeaderCell headerKey="status" headerKind="column" condensed bordered>Status</BootstrapTableHeaderCell>
        </BootstrapTableRow>
        <BootstrapTableRow hoverable tone="info">
          <BootstrapTableHeaderCell headerKey="billing" headerKind="row" condensed>Billing</BootstrapTableHeaderCell>
          <BootstrapTableCell headers={['region', 'billing']} condensed bordered>eu-west-1</BootstrapTableCell>
          <BootstrapTableCell headers={['status', 'billing']} condensed bordered>Maintenance scheduled</BootstrapTableCell>
        </BootstrapTableRow>
        <BootstrapTableRow hoverable tone="warning">
          <BootstrapTableHeaderCell headerKey="webhooks" headerKind="row" condensed>Webhooks</BootstrapTableHeaderCell>
          <BootstrapTableCell headers={['region', 'webhooks']} condensed bordered>us-west-2</BootstrapTableCell>
          <BootstrapTableCell headers={['status', 'webhooks']} condensed bordered>Elevated latency</BootstrapTableCell>
        </BootstrapTableRow>
        <BootstrapTableRow hoverable striped>
          <BootstrapTableHeaderCell headerKey="archive" headerKind="row" condensed>Cold Archive</BootstrapTableHeaderCell>
          <BootstrapTableCell headers={['region', 'archive']} condensed bordered>ap-east-1</BootstrapTableCell>
          <BootstrapTableCell headers={['status', 'archive']} condensed bordered>Sync retrying</BootstrapTableCell>
        </BootstrapTableRow>
        <BootstrapTableRow hoverable tone="error">
          <BootstrapTableHeaderCell headerKey="smtp" headerKind="row" condensed>SMTP Relay</BootstrapTableHeaderCell>
          <BootstrapTableCell headers={['region', 'smtp']} condensed bordered>eu-central-1</BootstrapTableCell>
          <BootstrapTableCell headers={['status', 'smtp']} condensed bordered>Degraded delivery</BootstrapTableCell>
        </BootstrapTableRow>
      </BootstrapTableRoot>
    </div>
  );
}
`);

const bootstrapVariantsVue = (vue2: boolean) =>
  formatCode(`
<template>
  <div class="w-full overflow-x-auto">
    <BootstrapTableRoot :bordered="true">
      <BootstrapTableCaption>Service health summary</BootstrapTableCaption>
      <BootstrapTableRow section="header">
        <BootstrapTableHeaderCell header-key="service" header-kind="column" :condensed="true">Service</BootstrapTableHeaderCell>
        <BootstrapTableHeaderCell header-key="region" header-kind="column" :condensed="true" :bordered="true">Region</BootstrapTableHeaderCell>
        <BootstrapTableHeaderCell header-key="status" header-kind="column" :condensed="true" :bordered="true">Status</BootstrapTableHeaderCell>
      </BootstrapTableRow>
      <BootstrapTableRow :hoverable="true" tone="info">
        <BootstrapTableHeaderCell header-key="billing" header-kind="row" :condensed="true">Billing</BootstrapTableHeaderCell>
        <BootstrapTableCell :headers="['region', 'billing']" :condensed="true" :bordered="true">eu-west-1</BootstrapTableCell>
        <BootstrapTableCell :headers="['status', 'billing']" :condensed="true" :bordered="true">Maintenance scheduled</BootstrapTableCell>
      </BootstrapTableRow>
      <BootstrapTableRow :hoverable="true" tone="warning">
        <BootstrapTableHeaderCell header-key="webhooks" header-kind="row" :condensed="true">Webhooks</BootstrapTableHeaderCell>
        <BootstrapTableCell :headers="['region', 'webhooks']" :condensed="true" :bordered="true">us-west-2</BootstrapTableCell>
        <BootstrapTableCell :headers="['status', 'webhooks']" :condensed="true" :bordered="true">Elevated latency</BootstrapTableCell>
      </BootstrapTableRow>
      <BootstrapTableRow :hoverable="true" :striped="true">
        <BootstrapTableHeaderCell header-key="archive" header-kind="row" :condensed="true">Cold Archive</BootstrapTableHeaderCell>
        <BootstrapTableCell :headers="['region', 'archive']" :condensed="true" :bordered="true">ap-east-1</BootstrapTableCell>
        <BootstrapTableCell :headers="['status', 'archive']" :condensed="true" :bordered="true">Sync retrying</BootstrapTableCell>
      </BootstrapTableRow>
      <BootstrapTableRow :hoverable="true" tone="error">
        <BootstrapTableHeaderCell header-key="smtp" header-kind="row" :condensed="true">SMTP Relay</BootstrapTableHeaderCell>
        <BootstrapTableCell :headers="['region', 'smtp']" :condensed="true" :bordered="true">eu-central-1</BootstrapTableCell>
        <BootstrapTableCell :headers="['status', 'smtp']" :condensed="true" :bordered="true">Degraded delivery</BootstrapTableCell>
      </BootstrapTableRow>
    </BootstrapTableRoot>
  </div>
</template>

${
  vue2
    ? `<script>
import {
  BootstrapTableRoot,
  BootstrapTableCaption,
  BootstrapTableRow,
  BootstrapTableHeaderCell,
  BootstrapTableCell,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BootstrapTableRoot,
    BootstrapTableCaption,
    BootstrapTableRow,
    BootstrapTableHeaderCell,
    BootstrapTableCell,
  },
};
</script>`
    : `<script setup>
import {
  BootstrapTableRoot,
  BootstrapTableCaption,
  BootstrapTableRow,
  BootstrapTableHeaderCell,
  BootstrapTableCell,
} from '../proto-ui/components/vue';
</script>`
}
`);

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-table': invoiceWcSnippet(FAMILIES.shadcn, false),
    'demo-shadcn-table-footer': invoiceWcSnippet(FAMILIES.shadcn, true),
    'demo-shadcn-table-actions': actionsWcSnippet(FAMILIES.shadcn),
    'demo-shadcn-table-rtl': rtlWcSnippet(FAMILIES.shadcn),

    'demo-brutalist-table': invoiceWcSnippet(FAMILIES.brutalist, false),
    'demo-brutalist-table-footer': invoiceWcSnippet(FAMILIES.brutalist, true),
    'demo-brutalist-table-actions': actionsWcSnippet(FAMILIES.brutalist),

    'demo-bootstrap-2-3-2-table': invoiceWcSnippet(FAMILIES['bootstrap-2-3-2'], false),
    'demo-bootstrap-2-3-2-table-footer': invoiceWcSnippet(FAMILIES['bootstrap-2-3-2'], true),
    'demo-bootstrap-2-3-2-table-variants': bootstrapVariantsWc,
    'demo-bootstrap-2-3-2-table-actions': actionsWcSnippet(FAMILIES['bootstrap-2-3-2']),

    'demo-liquid-glass-table': invoiceWcSnippet(FAMILIES['liquid-glass'], false),
    'demo-liquid-glass-table-footer': invoiceWcSnippet(FAMILIES['liquid-glass'], true),
    'demo-liquid-glass-table-actions': actionsWcSnippet(FAMILIES['liquid-glass']),
    'demo-liquid-glass-table-rtl': rtlWcSnippet(FAMILIES['liquid-glass']),
  },
  react: {
    'demo-shadcn-table': invoiceReactSnippet(FAMILIES.shadcn, false),
    'demo-shadcn-table-footer': invoiceReactSnippet(FAMILIES.shadcn, true),
    'demo-shadcn-table-actions': actionsReactSnippet(FAMILIES.shadcn),
    'demo-shadcn-table-rtl': rtlReactSnippet(FAMILIES.shadcn),

    'demo-brutalist-table': invoiceReactSnippet(FAMILIES.brutalist, false),
    'demo-brutalist-table-footer': invoiceReactSnippet(FAMILIES.brutalist, true),
    'demo-brutalist-table-actions': actionsReactSnippet(FAMILIES.brutalist),

    'demo-bootstrap-2-3-2-table': invoiceReactSnippet(FAMILIES['bootstrap-2-3-2'], false),
    'demo-bootstrap-2-3-2-table-footer': invoiceReactSnippet(FAMILIES['bootstrap-2-3-2'], true),
    'demo-bootstrap-2-3-2-table-variants': bootstrapVariantsReact,
    'demo-bootstrap-2-3-2-table-actions': actionsReactSnippet(FAMILIES['bootstrap-2-3-2']),

    'demo-liquid-glass-table': invoiceReactSnippet(FAMILIES['liquid-glass'], false),
    'demo-liquid-glass-table-footer': invoiceReactSnippet(FAMILIES['liquid-glass'], true),
    'demo-liquid-glass-table-actions': actionsReactSnippet(FAMILIES['liquid-glass']),
    'demo-liquid-glass-table-rtl': rtlReactSnippet(FAMILIES['liquid-glass']),
  },
  vue: {
    'demo-shadcn-table': invoiceVueSnippet(FAMILIES.shadcn, false, false),
    'demo-shadcn-table-footer': invoiceVueSnippet(FAMILIES.shadcn, true, false),
    'demo-shadcn-table-actions': actionsVueSnippet(FAMILIES.shadcn, false),
    'demo-shadcn-table-rtl': rtlVueSnippet(FAMILIES.shadcn, false),

    'demo-brutalist-table': invoiceVueSnippet(FAMILIES.brutalist, false, false),
    'demo-brutalist-table-footer': invoiceVueSnippet(FAMILIES.brutalist, true, false),
    'demo-brutalist-table-actions': actionsVueSnippet(FAMILIES.brutalist, false),

    'demo-bootstrap-2-3-2-table': invoiceVueSnippet(FAMILIES['bootstrap-2-3-2'], false, false),
    'demo-bootstrap-2-3-2-table-footer': invoiceVueSnippet(
      FAMILIES['bootstrap-2-3-2'],
      true,
      false
    ),
    'demo-bootstrap-2-3-2-table-variants': bootstrapVariantsVue(false),
    'demo-bootstrap-2-3-2-table-actions': actionsVueSnippet(FAMILIES['bootstrap-2-3-2'], false),

    'demo-liquid-glass-table': invoiceVueSnippet(FAMILIES['liquid-glass'], false, false),
    'demo-liquid-glass-table-footer': invoiceVueSnippet(FAMILIES['liquid-glass'], true, false),
    'demo-liquid-glass-table-actions': actionsVueSnippet(FAMILIES['liquid-glass'], false),
    'demo-liquid-glass-table-rtl': rtlVueSnippet(FAMILIES['liquid-glass'], false),
  },
  vue2: {
    'demo-shadcn-table': invoiceVueSnippet(FAMILIES.shadcn, false, true),
    'demo-shadcn-table-footer': invoiceVueSnippet(FAMILIES.shadcn, true, true),
    'demo-shadcn-table-actions': actionsVueSnippet(FAMILIES.shadcn, true),
    'demo-shadcn-table-rtl': rtlVueSnippet(FAMILIES.shadcn, true),

    'demo-brutalist-table': invoiceVueSnippet(FAMILIES.brutalist, false, true),
    'demo-brutalist-table-footer': invoiceVueSnippet(FAMILIES.brutalist, true, true),
    'demo-brutalist-table-actions': actionsVueSnippet(FAMILIES.brutalist, true),

    'demo-bootstrap-2-3-2-table': invoiceVueSnippet(FAMILIES['bootstrap-2-3-2'], false, true),
    'demo-bootstrap-2-3-2-table-footer': invoiceVueSnippet(FAMILIES['bootstrap-2-3-2'], true, true),
    'demo-bootstrap-2-3-2-table-variants': bootstrapVariantsVue(true),
    'demo-bootstrap-2-3-2-table-actions': actionsVueSnippet(FAMILIES['bootstrap-2-3-2'], true),

    'demo-liquid-glass-table': invoiceVueSnippet(FAMILIES['liquid-glass'], false, true),
    'demo-liquid-glass-table-footer': invoiceVueSnippet(FAMILIES['liquid-glass'], true, true),
    'demo-liquid-glass-table-actions': actionsVueSnippet(FAMILIES['liquid-glass'], true),
    'demo-liquid-glass-table-rtl': rtlVueSnippet(FAMILIES['liquid-glass'], true),
  },
};
