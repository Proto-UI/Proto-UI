import type { ImageViewA11yMode, ImageViewFit, ImageViewStatus } from '../../core/src/image-view';
import type { TableHeaderKind } from '../../modules/table-structure/src/types';
import type { ValueType } from './ir';

// These erased public aliases describe ordinary finite data, not a component
// protocol or a host capability. Exhaustive records keep their alternatives
// checked against the shared declarations without importing runtime modules.
const finite = <T extends string>(members: Readonly<Record<T, true>>): ValueType => ({
  kind: 'union',
  members: Object.keys(members).map((value) => ({ kind: 'literal', value })),
});

const PUBLIC_VALUE_TYPES = new Map<string, ReadonlyMap<string, ValueType>>([
  [
    '@proto.ui/core',
    new Map([
      ['ImageViewA11yMode', finite<ImageViewA11yMode>({ informative: true, decorative: true })],
      ['ImageViewFit', finite<ImageViewFit>({ contain: true, cover: true, fill: true })],
      [
        'ImageViewStatus',
        finite<ImageViewStatus>({ idle: true, loading: true, loaded: true, error: true }),
      ],
    ]),
  ],
  [
    '@proto.ui/module-table-structure',
    new Map([['TableHeaderKind', finite<TableHeaderKind>({ column: true, row: true })]]),
  ],
]);

/** Resolve the public export identity; a matching local spelling grants nothing. */
export function publicValueType(module: string, name: string): ValueType | undefined {
  return PUBLIC_VALUE_TYPES.get(module)?.get(name);
}
