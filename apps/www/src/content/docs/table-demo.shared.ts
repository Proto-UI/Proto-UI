import type {
  DemoSpec,
  DemoNode,
  DemoChild,
  DemoSurfaceStyle,
} from '@/components/PrototypePreviewer/demo-types';

type TableFamily = 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass';
type TablePart = 'root' | 'caption' | 'row' | 'header-cell' | 'cell';

interface InvoiceRecord {
  key: string;
  invoice: string;
  status: string;
  method: string;
  amount: string;
}

const INVOICES: readonly InvoiceRecord[] = [
  { key: 'inv001', invoice: 'INV001', status: 'Paid', method: 'Credit Card', amount: '$250.00' },
  { key: 'inv002', invoice: 'INV002', status: 'Pending', method: 'PayPal', amount: '$150.00' },
  {
    key: 'inv003',
    invoice: 'INV003',
    status: 'Unpaid',
    method: 'Bank Transfer',
    amount: '$350.00',
  },
  { key: 'inv004', invoice: 'INV004', status: 'Paid', method: 'Credit Card', amount: '$450.00' },
  { key: 'inv005', invoice: 'INV005', status: 'Paid', method: 'PayPal', amount: '$550.00' },
  {
    key: 'inv006',
    invoice: 'INV006',
    status: 'Pending',
    method: 'Bank Transfer',
    amount: '$200.00',
  },
  { key: 'inv007', invoice: 'INV007', status: 'Unpaid', method: 'Credit Card', amount: '$300.00' },
];

const RTL_INVOICES: readonly InvoiceRecord[] = [
  {
    key: 'inv001',
    invoice: 'INV001',
    status: 'مدفوع',
    method: 'بطاقة ائتمانية',
    amount: '$250.00',
  },
  { key: 'inv002', invoice: 'INV002', status: 'قيد الانتظار', method: 'PayPal', amount: '$150.00' },
  {
    key: 'inv003',
    invoice: 'INV003',
    status: 'غير مدفوع',
    method: 'تحويل بنكي',
    amount: '$350.00',
  },
  {
    key: 'inv004',
    invoice: 'INV004',
    status: 'مدفوع',
    method: 'بطاقة ائتمانية',
    amount: '$450.00',
  },
];

const PRODUCTS = [
  { key: 'mouse', name: 'Wireless Mouse', price: '$29.99' },
  { key: 'keyboard', name: 'Mechanical Keyboard', price: '$129.99' },
  { key: 'hub', name: 'USB-C Hub', price: '$49.99' },
] as const;

const part = (
  family: string,
  role: TablePart,
  ref: string | undefined,
  props: Record<string, unknown>,
  children: DemoChild[],
  extra: { className?: string; surfaceStyle?: DemoSurfaceStyle } = {}
): DemoNode => ({
  kind: 'proto',
  prototypeId: `${family}-table-${role}`,
  ...(ref ? { ref } : {}),
  ...(extra.className ? { className: extra.className } : {}),
  ...(extra.surfaceStyle ? { surfaceStyle: extra.surfaceStyle } : {}),
  props,
  children,
});

const headerCell = (
  family: string,
  ref: string,
  label: string,
  headerKind: 'column' | 'row',
  extra: {
    props?: Record<string, unknown>;
    className?: string;
    surfaceStyle?: DemoSurfaceStyle;
  } = {}
): DemoNode =>
  part(
    family,
    'header-cell',
    ref,
    { headerKey: ref, headerKind, ...(extra.props ?? {}) },
    [label],
    extra
  );

const valueCell = (
  family: string,
  ref: string,
  children: DemoChild[],
  headers: string[],
  extra: {
    props?: Record<string, unknown>;
    className?: string;
    surfaceStyle?: DemoSurfaceStyle;
  } = {}
): DemoNode => part(family, 'cell', ref, { headers, ...(extra.props ?? {}) }, children, extra);

function rowSectionProps(
  family: string,
  section: 'header' | 'body' | 'footer',
  lastInSection = false
): Record<string, unknown> {
  if (family === 'bootstrap-2-3-2') {
    return { section };
  }
  return { section, lastInSection };
}

function wrapTableStage(
  family: string,
  table: DemoNode,
  options: { dir?: 'ltr' | 'rtl' } = {}
): DemoNode {
  const dirAttrs = options.dir ? { attrs: { dir: options.dir } } : {};
  if (family === 'liquid-glass') {
    return {
      kind: 'box',
      className: 'w-full min-w-0 max-w-full',
      ...dirAttrs,
      children: [
        {
          kind: 'box',
          className: 'w-full min-w-0 overflow-x-auto rounded-xl bg-background p-4 shadow-xs',
          children: [table],
        },
      ],
    };
  }
  return {
    kind: 'box',
    className: 'w-full min-w-0 max-w-full overflow-x-auto p-4',
    ...dirAttrs,
    children: [table],
  };
}

function buildInvoiceTable(
  family: string,
  rows: readonly InvoiceRecord[],
  labels: {
    caption: string;
    invoice: string;
    status: string;
    method: string;
    amount: string;
    total: string;
    totalAmount: string;
  }
): DemoNode {
  const endAlign: DemoSurfaceStyle = { textAlign: 'end' };
  const leadWidth: DemoSurfaceStyle = { width: '100px' };

  return part(family, 'root', 'table', {}, [
    part(family, 'caption', 'caption', {}, [labels.caption]),
    part(family, 'row', 'header-row', rowSectionProps(family, 'header', true), [
      headerCell(family, 'invoice', labels.invoice, 'column', { surfaceStyle: leadWidth }),
      headerCell(family, 'status', labels.status, 'column'),
      headerCell(family, 'method', labels.method, 'column'),
      headerCell(family, 'amount', labels.amount, 'column', { surfaceStyle: endAlign }),
    ]),
    ...rows.map((item, index) =>
      part(
        family,
        'row',
        `${item.key}-row`,
        rowSectionProps(family, 'body', index === rows.length - 1),
        [
          headerCell(family, item.key, item.invoice, 'row', { className: 'font-medium' }),
          valueCell(family, `${item.key}-status`, [item.status], ['status', item.key]),
          valueCell(family, `${item.key}-method`, [item.method], ['method', item.key]),
          valueCell(family, `${item.key}-amount`, [item.amount], ['amount', item.key], {
            className: 'tabular-nums',
            surfaceStyle: endAlign,
          }),
        ]
      )
    ),
    part(family, 'row', 'footer-row', rowSectionProps(family, 'footer', true), [
      headerCell(family, 'total', labels.total, 'row'),
      valueCell(family, 'total-status', [''], ['status', 'total']),
      valueCell(family, 'total-method', [''], ['method', 'total']),
      valueCell(family, 'total-amount', [labels.totalAmount], ['amount', 'total'], {
        className: 'tabular-nums font-medium',
        surfaceStyle: endAlign,
      }),
    ]),
  ]);
}

/**
 * Hero 7-row invoice table matching the upstream shadcn/ui and Neobrutalism
 * Table example, keeping uniform unspanned rows so Base Table Structure stays valid.
 */
export function createTableDemo(family: TableFamily | string): DemoSpec {
  const table = buildInvoiceTable(family, INVOICES, {
    caption: 'A list of your recent invoices.',
    invoice: 'Invoice',
    status: 'Status',
    method: 'Method',
    amount: 'Amount',
    total: 'Total',
    totalAmount: '$2,500.00',
  });
  return {
    type: 'demo',
    root: wrapTableStage(family, table),
  } satisfies DemoSpec;
}

/** Compact 3-row invoice table highlighting the summary footer section. */
export function createTableFooterDemo(family: TableFamily | string): DemoSpec {
  const table = buildInvoiceTable(family, INVOICES.slice(0, 3), {
    caption: 'A list of your recent invoices.',
    invoice: 'Invoice',
    status: 'Status',
    method: 'Method',
    amount: 'Amount',
    total: 'Total',
    totalAmount: '$750.00',
  });
  return {
    type: 'demo',
    root: wrapTableStage(family, table),
  } satisfies DemoSpec;
}

function buildRowActionsMenu(family: string, productKey: string): DemoNode {
  const supportsDestructive = family === 'shadcn' || family === 'brutalist';
  return {
    kind: 'proto',
    prototypeId: `${family}-dropdown-root`,
    ref: `${productKey}-menu`,
    children: [
      {
        kind: 'proto',
        prototypeId: `${family}-dropdown-trigger`,
        ref: `${productKey}-trigger`,
        children: [
          { kind: 'proto', prototypeId: 'lucide-ellipsis-icon', props: { size: 16 } },
          {
            kind: 'box',
            tag: 'span',
            className: 'sr-only',
            children: ['Open menu'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: `${family}-dropdown-content`,
        props: { align: 'end' },
        surfaceStyle: 'w-36',
        children: [
          {
            kind: 'proto',
            prototypeId: `${family}-dropdown-item`,
            props: { value: 'edit', textValue: 'Edit' },
            children: ['Edit'],
          },
          {
            kind: 'proto',
            prototypeId: `${family}-dropdown-item`,
            props: { value: 'duplicate', textValue: 'Duplicate' },
            children: ['Duplicate'],
          },
          {
            kind: 'proto',
            prototypeId: `${family}-dropdown-separator`,
          },
          {
            kind: 'proto',
            prototypeId: `${family}-dropdown-item`,
            props: {
              value: 'delete',
              textValue: 'Delete',
              ...(supportsDestructive ? { variant: 'destructive' } : {}),
            },
            children: ['Delete'],
          },
        ],
      },
    ],
  };
}

/** Product table composing a right-aligned DropdownMenu in each row's Actions cell. */
export function createTableActionsDemo(family: TableFamily | string): DemoSpec {
  const endAlign: DemoSurfaceStyle = { textAlign: 'end' };
  const table = part(family, 'root', 'table', {}, [
    part(family, 'row', 'header-row', rowSectionProps(family, 'header', true), [
      headerCell(family, 'product', 'Product', 'column'),
      headerCell(family, 'price', 'Price', 'column'),
      headerCell(family, 'actions', 'Actions', 'column', { surfaceStyle: endAlign }),
    ]),
    ...PRODUCTS.map((product, index) =>
      part(
        family,
        'row',
        `${product.key}-row`,
        rowSectionProps(family, 'body', index === PRODUCTS.length - 1),
        [
          headerCell(family, product.key, product.name, 'row', { className: 'font-medium' }),
          valueCell(family, `${product.key}-price`, [product.price], ['price', product.key], {
            className: 'tabular-nums',
          }),
          valueCell(
            family,
            `${product.key}-actions`,
            [buildRowActionsMenu(family, product.key)],
            ['actions', product.key],
            { surfaceStyle: endAlign }
          ),
        ]
      )
    ),
  ]);
  return {
    type: 'demo',
    root: wrapTableStage(family, table),
  } satisfies DemoSpec;
}

/** Right-to-left Arabic invoice table showcasing logical text-start alignment. */
export function createTableRtlDemo(family: TableFamily | string): DemoSpec {
  const table = buildInvoiceTable(family, RTL_INVOICES, {
    caption: 'قائمة بفواتيرك الأخيرة.',
    invoice: 'الفاتورة',
    status: 'الحالة',
    method: 'الطريقة',
    amount: 'المبلغ',
    total: 'المجموع',
    totalAmount: '$1,200.00',
  });
  return {
    type: 'demo',
    root: wrapTableStage(family, table, { dir: 'rtl' }),
  } satisfies DemoSpec;
}

/** Classic Bootstrap 2.3.2 bordered, striped, hoverable, condensed & contextual row variants. */
export function createBootstrapTableVariantsDemo(): DemoSpec {
  const family = 'bootstrap-2-3-2';
  const rows: Array<{
    key: string;
    service: string;
    region: string;
    status: string;
    striped?: boolean;
    tone?: 'default' | 'info' | 'warning' | 'error';
  }> = [
    { key: 'api', service: 'Core API', region: 'us-east-1', status: 'Operational' },
    {
      key: 'billing',
      service: 'Billing',
      region: 'eu-west-1',
      status: 'Maintenance scheduled',
      tone: 'info',
    },
    {
      key: 'webhooks',
      service: 'Webhooks',
      region: 'us-west-2',
      status: 'Elevated latency',
      tone: 'warning',
    },
    {
      key: 'archive',
      service: 'Cold Archive',
      region: 'ap-east-1',
      status: 'Sync retrying',
      striped: true,
    },
    {
      key: 'smtp',
      service: 'SMTP Relay',
      region: 'eu-central-1',
      status: 'Degraded delivery',
      tone: 'error',
    },
  ];

  const table = part(family, 'root', 'table', { bordered: true }, [
    part(family, 'caption', 'caption', {}, ['Service health summary (bordered, condensed, hover)']),
    part(family, 'row', 'header-row', { section: 'header' }, [
      headerCell(family, 'service', 'Service', 'column', { props: { condensed: true } }),
      headerCell(family, 'region', 'Region', 'column', {
        props: { condensed: true, bordered: true },
      }),
      headerCell(family, 'status', 'Status', 'column', {
        props: { condensed: true, bordered: true },
      }),
    ]),
    ...rows.map((item) =>
      part(
        family,
        'row',
        `${item.key}-row`,
        {
          section: 'body',
          hoverable: true,
          striped: Boolean(item.striped),
          tone: item.tone ?? 'default',
        },
        [
          headerCell(family, item.key, item.service, 'row', { props: { condensed: true } }),
          valueCell(family, `${item.key}-region`, [item.region], ['region', item.key], {
            props: { condensed: true, bordered: true },
          }),
          valueCell(family, `${item.key}-status`, [item.status], ['status', item.key], {
            props: { condensed: true, bordered: true },
          }),
        ]
      )
    ),
  ]);

  return {
    type: 'demo',
    root: wrapTableStage(family, table),
  } satisfies DemoSpec;
}
