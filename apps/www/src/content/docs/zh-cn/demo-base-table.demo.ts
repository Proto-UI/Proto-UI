import type { DemoNode, DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const headerCell = (prototypeId: string, ref: string, label: string): DemoNode => ({
  kind: 'proto',
  prototypeId,
  ref,
  className:
    'border-b border-slate-300 bg-slate-100 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
  props: { headerKey: ref, headerKind: 'column' },
  children: [label],
});

const rowHeader = (ref: string, label: string): DemoNode => ({
  kind: 'proto',
  prototypeId: 'base-table-header-cell',
  ref,
  className:
    'border-b border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-900 dark:border-slate-800 dark:text-slate-100',
  props: { headerKey: ref, headerKind: 'row' },
  children: [label],
});

const valueCell = (ref: string, label: string, headers: string[]): DemoNode => ({
  kind: 'proto',
  prototypeId: 'base-table-cell',
  ref,
  className:
    'border-b border-slate-200 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-300',
  props: { headers },
  children: [label],
});

function dataRow(key: string, team: string, first: string, second: string): DemoNode {
  const rowRef = `${key}-row`;
  return {
    kind: 'proto',
    prototypeId: 'base-table-row',
    ref: rowRef,
    className: 'grid grid-cols-[1.2fr_1fr_1fr] items-stretch',
    children: [
      rowHeader(key, team),
      valueCell(`${key}-q1`, first, ['team-q1', key]),
      valueCell(`${key}-q2`, second, ['team-q2', key]),
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'base-table-root',
    className:
      'grid w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950',
    children: [
      {
        kind: 'proto',
        prototypeId: 'base-table-caption',
        ref: 'caption',
        className: 'px-4 py-4 text-left text-base font-semibold text-slate-950 dark:text-slate-50',
        children: ['Quarterly service overview'],
      },
      {
        kind: 'proto',
        prototypeId: 'base-table-row',
        className: 'grid grid-cols-[1.2fr_1fr_1fr] items-stretch',
        children: [
          headerCell('base-table-header-cell', 'team', 'Team'),
          headerCell('base-table-header-cell', 'team-q1', 'Q1'),
          headerCell('base-table-header-cell', 'team-q2', 'Q2'),
        ],
      },
      dataRow('platform', 'Platform', '99.94%', '99.97%'),
      dataRow('support', 'Support', '4.8 / 5', '4.9 / 5'),
    ],
  },
} satisfies DemoSpec;
