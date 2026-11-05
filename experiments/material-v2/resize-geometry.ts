import assert from 'node:assert/strict';
import type { Protocol } from '../../apps/www/node_modules/playwright-core/types/protocol';

export const resizeGeometryStyles = [
  'width',
  'height',
  'transform',
  'scale',
  'rotate',
  'translate',
  'zoom',
  'border-left-width',
  'border-right-width',
  'border-top-width',
  'border-bottom-width',
  'padding-left',
  'padding-right',
  'padding-top',
  'padding-bottom',
];

type Surface = {
  runtime: string;
  width: number;
  height: number;
  paintWidth: number;
  paintHeight: number;
  quality: string;
  sourceRevision: number;
  materialFrame: string;
};

/** Browser evidence only: read physical fractional boxes, never authored size variables. */
export function readResizeGeometry(
  snapshot: Protocol.DOMSnapshot.captureSnapshotReturnValue,
  expected: Surface[],
  url: string
) {
  const document = snapshot.documents[0];
  assert.ok(document, 'resize snapshot requires the page document');
  assert.equal(snapshot.strings[document.documentURL], url, 'resize snapshot document changed');
  const { attributes, parentIndex, nodeName, nodeType, backendNodeId, pseudoType } = document.nodes;
  assert.ok(attributes && parentIndex && nodeName && nodeType && backendNodeId && pseudoType);
  const { layout } = document;
  const attrs = (index: number) =>
    Object.fromEntries(
      (attributes[index] ?? []).flatMap((value, i, values) =>
        i % 2 ? [] : [[snapshot.strings[value], snapshot.strings[values[i + 1]]]]
      )
    );
  const row = (index: number) => {
    const position = layout.nodeIndex.indexOf(index);
    assert.ok(position >= 0, 'resize target has no physical layout');
    const bounds = layout.bounds[position];
    assert.ok(bounds.length === 4 && bounds.every(Number.isFinite), 'invalid resize bounds');
    return { bounds, styles: layout.styles[position].map((value) => snapshot.strings[value]) };
  };
  const hosts = nodeName.flatMap((_, index) =>
    attrs(index)['data-demo-ref'] === 'regular' ? [index] : []
  );
  assert.equal(hosts.length, expected.length, 'resize host count changed');
  const seen = new Set<string>();
  const measured = hosts.map((host) => {
    let ancestor = host;
    let runtime: string | undefined;
    while (ancestor >= 0) {
      runtime ??= attrs(ancestor)['data-runtime'];
      const position = layout.nodeIndex.indexOf(ancestor);
      if (position >= 0 && nodeType[ancestor] === 1) {
        const styles = layout.styles[position].map((value) => snapshot.strings[value]);
        assert.deepEqual(
          styles.slice(2, 6),
          ['none', 'none', 'none', 'none'],
          'transformed resize ancestry'
        );
        assert.equal(styles[6], '1', 'zoomed resize ancestry');
      }
      ancestor = parentIndex[ancestor];
    }
    assert.ok(runtime && !seen.has(runtime), 'ambiguous resize runtime');
    seen.add(runtime);
    const original = expected.find((surface) => surface.runtime === runtime);
    assert.ok(original, 'unexpected resize runtime');
    const hostAttrs = attrs(host);
    assert.equal(hostAttrs['data-material-quality'], original.quality);
    assert.equal(Number(hostAttrs['data-material-source-revision']), original.sourceRevision);
    assert.equal(hostAttrs['data-pui-material-carrier'], 'contact-v1');
    assert.ok(original.materialFrame, 'resize target has no frozen material frame');
    assert.equal(
      hostAttrs['data-material-frame'],
      original.materialFrame,
      'resize material frame changed since frozen sample'
    );
    const before = pseudoType.index.filter(
      (index, i) =>
        parentIndex[index] === host && snapshot.strings[pseudoType.value[i]] === 'before'
    );
    assert.equal(before.length, 1, 'resize host requires one direct before carrier');
    const hostBox = row(host);
    const paint = row(before[0]);
    assert.equal(
      paint.styles.length,
      resizeGeometryStyles.length,
      'incomplete resize paint styles'
    );
    assert.equal(hostBox.bounds[2], original.width, 'resize host width changed since frozen BCR');
    assert.equal(hostBox.bounds[3], original.height, 'resize host height changed since frozen BCR');
    assert.deepEqual(
      paint.styles.slice(2, 6),
      ['none', 'none', 'none', 'none'],
      'transformed resize paint'
    );
    assert.equal(paint.styles[6], '1', 'zoomed resize paint');
    assert.ok(
      paint.styles.slice(7).every((value) => parseFloat(value) === 0),
      'resize paint has border or padding'
    );
    return {
      ...original,
      paintWidth: paint.bounds[2],
      paintHeight: paint.bounds[3],
      cssomPaintWidth: original.paintWidth,
      cssomPaintHeight: original.paintHeight,
      frameId: snapshot.strings[document.frameId],
      materialFrame: hostAttrs['data-material-frame'],
      hostBackendNodeId: backendNodeId[host],
      paintBackendNodeId: backendNodeId[before[0]],
      hostBounds: hostBox.bounds,
      paintBounds: paint.bounds,
    };
  });
  return expected.map((surface) => measured.find((item) => item.runtime === surface.runtime)!);
}
