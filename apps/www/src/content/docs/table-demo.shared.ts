import type { DemoSpec, DemoNode, DemoChild } from '@/components/PrototypePreviewer/demo-types';

type TablePart = 'root' | 'caption' | 'row' | 'header-cell' | 'cell';

const part = (
  family: string,
  role: TablePart,
  ref: string | undefined,
  props: Record<string, unknown>,
  children: DemoChild[]
): DemoNode => ({
  kind: 'proto',
  prototypeId: `${family}-table-${role}`,
  ...(ref ? { ref } : {}),
  props,
  children,
});

const headerCell = (
  family: string,
  ref: string,
  label: string,
  headerKind: 'column' | 'row'
): DemoNode =>
  part(family, 'header-cell', ref, { headerKey: ref, headerKind }, [label]);

const valueCell = (family: string, ref: string, label: string, headers: string[]): DemoNode =>
  part(family, 'cell', ref, { headers }, [label]);

function dataRow(
  family: string,
  key: string,
  team: string,
  first: string,
  second: string,
  sectionProps: Record<string, unknown>
): DemoNode {
  return part(family, 'row', `${key}-row`, sectionProps, [
    headerCell(family, key, team, 'row'),
    valueCell(family, `${key}-q1`, first, ['team-q1', key]),
    valueCell(family, `${key}-q2`, second, ['team-q2', key]),
  ]);
}

/**
 * Plain unspanned Table composition. Native table-row/table-cell spans are not
 * supported by Base, so every row carries the same header/cell membership and
 * the demo claims no colspan/rowspan. The wrapper box is ordinary page layout:
 * it is the external scrolling container the family roots explicitly leave to
 * the consumer; all table chrome comes from family paint, not copied Base
 * className or grid/flex compensation.
 */
export function createTableDemo(family: string): DemoSpec {
  const sectionProps = (section: 'header' | 'body' | 'footer', lastInSection = false) =>
    family === 'shadcn' ? { section, lastInSection } : {};
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'w-full min-w-0 max-w-full overflow-x-auto p-4',
      children: [
        {
          kind: 'box',
          className: 'min-w-[34rem]',
          children: [
            part(
              family,
              'root',
              'table',
              {},
              [
                part(family, 'caption', 'caption', {}, [
                  'Quarterly service overview · 季度服务概览',
                ]),
                part(family, 'row', 'header-row', sectionProps('header'), [
                  headerCell(family, 'team', 'Team · 团队', 'column'),
                  headerCell(family, 'team-q1', 'Q1', 'column'),
                  headerCell(family, 'team-q2', 'Q2', 'column'),
                ]),
                dataRow(family, 'platform', 'Platform', '99.94%', '99.97%', sectionProps('body')),
                dataRow(
                  family,
                  'support',
                  'Support',
                  '4.8 / 5',
                  '4.9 / 5',
                  sectionProps('body', true)
                ),
                part(family, 'row', 'summary-row', sectionProps('footer', true), [
                  headerCell(family, 'total', 'Combined · 合计', 'row'),
                  valueCell(family, 'total-q1', '2 services', ['team-q1', 'total']),
                  valueCell(family, 'total-q2', 'stable', ['team-q2', 'total']),
                ]),
              ]
            ),
          ],
        },
      ],
    },
  } satisfies DemoSpec;
}
