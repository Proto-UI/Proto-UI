import assert from 'node:assert/strict';
import { describe, expect, it } from 'vitest';
import { readResizeGeometry, resizeGeometryStyles } from './resize-geometry';

// Synthetic protocol table; native snapshots and wrong-size browser controls are separate evidence.
function fixture() {
  const strings: string[] = [];
  const string = (value: string) => {
    strings.push(value);
    return strings.length - 1;
  };
  const attributes = (values: Record<string, string>) =>
    Object.entries(values).flatMap(([a, b]) => [string(a), string(b)]);
  const neutral = () =>
    resizeGeometryStyles.map((_, i) =>
      string(i < 2 ? (i ? '38px' : '133.609px') : i < 6 ? 'none' : i === 6 ? '1' : '0px')
    );
  const styles = [neutral(), neutral(), neutral(), neutral()];
  const payload = {
    documents: [
      {
        documentURL: string('http://local/'),
        title: 0,
        baseURL: 0,
        contentLanguage: 0,
        encodingName: 0,
        publicId: 0,
        systemId: 0,
        frameId: string('owned-page'),
        nodes: {
          nodeType: [9, 1, 1, 1],
          nodeName: [string('#document'), string('DIV'), string('BUTTON'), string('::before')],
          parentIndex: [-1, 0, 1, 2],
          backendNodeId: [1, 2, 3, 4],
          attributes: [
            [],
            attributes({ 'data-runtime': 'wc' }),
            attributes({
              'data-demo-ref': 'regular',
              'data-material-quality': 'self-optical',
              'data-material-source-revision': '17',
              'data-material-frame': '22',
              'data-pui-material-carrier': 'contact-v1',
            }),
            [],
          ],
          pseudoType: { index: [3], value: [string('before')] },
        },
        layout: {
          nodeIndex: [0, 1, 2, 3],
          styles,
          bounds: [
            [0, 0, 1000, 840],
            [0, 0, 400, 300],
            [20, 20, 133.609375, 38],
            [8, 8, 157.609375, 62],
          ],
          text: [],
          stackingContexts: { index: [] },
        },
        textBoxes: { layoutIndex: [], bounds: [], start: [], length: [] },
      },
    ],
    strings,
  };
  const expected = [
    {
      runtime: 'wc',
      width: 133.609375,
      height: 38,
      paintWidth: 157.609,
      paintHeight: 62,
      quality: 'self-optical',
      sourceRevision: 17,
      materialFrame: '22',
    },
  ];
  return { payload, expected, string };
}
function originalSizeAssertions(surface: ReturnType<typeof readResizeGeometry>[number]) {
  const outset = Math.ceil(Math.max(surface.width, surface.height) * 0.08 + 1);
  assert.equal(surface.paintWidth, surface.width + 2 * outset);
  assert.equal(surface.paintHeight, surface.height + 2 * outset);
}
describe('physical resize paint measurement', () => {
  it('keeps fractional bounds and the original rounded CSSOM observation', () => {
    const f = fixture();
    const [surface] = readResizeGeometry(f.payload, f.expected, 'http://local/');
    expect(surface.cssomPaintWidth).toBe(157.609);
    expect(surface.paintWidth).toBe(157.609375);
    expect(surface.frameId).toBe('owned-page');
    expect(() => originalSizeAssertions(surface)).not.toThrow();
  });
  it.each([2, 3])(
    'the unchanged size assertions still reject a wrong paint dimension %i',
    (axis) => {
      const f = fixture();
      f.payload.documents[0].layout.bounds[3][axis] += 1;
      expect(() =>
        originalSizeAssertions(readResizeGeometry(f.payload, f.expected, 'http://local/')[0])
      ).toThrow();
    }
  );
  it('rejects a stale source revision', () => {
    const f = fixture();
    f.expected[0].sourceRevision++;
    expect(() => readResizeGeometry(f.payload, f.expected, 'http://local/')).toThrow();
  });
  it('rejects a later corrected paint publication on the same source and host geometry', () => {
    const f = fixture();
    f.expected[0].paintWidth = 156.609;
    const attributes = f.payload.documents[0].nodes.attributes[2];
    const frame = attributes.findIndex(
      (value) => f.payload.strings[value] === 'data-material-frame'
    );
    attributes[frame + 1] = f.string('23');
    expect(() => readResizeGeometry(f.payload, f.expected, 'http://local/')).toThrow();
  });
  it('rejects an ambiguous before carrier', () => {
    const f = fixture();
    f.payload.documents[0].nodes.pseudoType.index.push(3);
    f.payload.documents[0].nodes.pseudoType.value.push(f.string('before'));
    expect(() => readResizeGeometry(f.payload, f.expected, 'http://local/')).toThrow();
  });
  it('rejects host geometry changed since the original BCR', () => {
    const f = fixture();
    f.payload.documents[0].layout.bounds[2][2] += 1;
    expect(() => readResizeGeometry(f.payload, f.expected, 'http://local/')).toThrow();
  });
  it.each([2, 4, 6, 7])('rejects incompatible ancestor/paint style %i', (style) => {
    const f = fixture();
    const index = style === 7 ? 3 : 1;
    f.payload.documents[0].layout.styles[index][style] = f.string(style === 7 ? '1px' : '2');
    expect(() => readResizeGeometry(f.payload, f.expected, 'http://local/')).toThrow();
  });
  it('rejects a different document', () => {
    const f = fixture();
    expect(() => readResizeGeometry(f.payload, f.expected, 'http://other/')).toThrow();
  });
});
