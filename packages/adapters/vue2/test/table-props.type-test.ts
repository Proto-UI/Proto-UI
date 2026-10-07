import { definePrototype, type ExposeEvent } from '@proto.ui/core';
import {
  tableCaption,
  tableCell,
  tableHeaderCell,
  tableRoot,
  tableRow,
} from '@proto.ui/prototypes-base/table';

import { createVue2Adapter, type ProtoVue2Props, type Vue2Runtime } from '../src';

// This is a compile-time consumer, not a runtime substitute for Vue 2.
declare const runtime: Vue2Runtime;
const adapt = createVue2Adapter(runtime);
const Table = adapt(tableRoot);
const Caption = adapt(tableCaption);
const Row = adapt(tableRow);
const HeaderCell = adapt(tableHeaderCell);
const Cell = adapt(tableCell);

const root: InstanceType<typeof Table>['$props'] = {
  class: 'table',
  hostClass: ['host'],
  surfaceClass: { surface: true },
  hostStyle: { color: 'inherit' },
  surfaceStyle: [{ display: 'block' }],
};
const caption: InstanceType<typeof Caption>['$props'] = { class: 'caption' };
const row: InstanceType<typeof Row>['$props'] = { surfaceClass: 'row' };
const direct: ProtoVue2Props<typeof tableRoot> = { hostStyle: 'color: inherit' };
const header: InstanceType<typeof HeaderCell>['$props'] = {
  headerKind: 'column',
  headerKey: 'name',
  columnSpan: 2,
  class: 'header',
};
const cell: InstanceType<typeof Cell>['$props'] = { headers: ['name'], class: 'cell' };

// @ts-expect-error Empty portable props do not admit unknown business facts.
const unknown: InstanceType<typeof Table>['$props'] = { unknownProtoProp: true };
// @ts-expect-error Non-empty portable facts retain their original type.
const invalidHeaders: InstanceType<typeof Cell>['$props'] = { headers: 123 };
// @ts-expect-error Header kind remains its governed closed vocabulary.
const invalidKind: InstanceType<typeof HeaderCell>['$props'] = { headerKind: 'diagonal' };

const requiredProto = definePrototype<{ label: string }, { change: ExposeEvent<string> }>({
  name: 'vue2-required-props-type-test',
  setup: () => undefined,
});
const required: ProtoVue2Props<typeof requiredProto> = { label: 'Save', onChange: () => {} };
// @ts-expect-error Host fields do not make required portable props optional.
const missingRequired: ProtoVue2Props<typeof requiredProto> = { class: 'button' };
const invalidEvent: ProtoVue2Props<typeof requiredProto> = {
  label: 'Save',
  // @ts-expect-error Event payloads are not widened by empty-props normalization.
  onChange: (_: number) => {},
};

void [
  root,
  caption,
  row,
  direct,
  header,
  cell,
  unknown,
  invalidHeaders,
  invalidKind,
  required,
  missingRequired,
  invalidEvent,
];
