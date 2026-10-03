import * as Vue from 'vue';
import { definePrototype, type ExposeEvent } from '@proto.ui/core';
import {
  tableCaption,
  tableCell,
  tableHeaderCell,
  tableRoot,
  tableRow,
} from '@proto.ui/prototypes-base/table';

import { createVueAdapter, type ProtoVueProps } from '../src';

const adapt = createVueAdapter(Vue);
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
const direct: ProtoVueProps<typeof tableRoot> = { hostStyle: 'color: inherit' };
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
  name: 'vue-required-props-type-test',
  setup: () => undefined,
});
const required: ProtoVueProps<typeof requiredProto> = { label: 'Save', onChange: () => {} };
// @ts-expect-error Host fields do not make required portable props optional.
const missingRequired: ProtoVueProps<typeof requiredProto> = { class: 'button' };
const invalidEvent: ProtoVueProps<typeof requiredProto> = {
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
