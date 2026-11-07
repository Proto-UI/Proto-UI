import { describe, expect, it } from 'vitest';
import type {
  DemoChild,
  DemoNode,
  DemoSpec,
} from '../../../components/PrototypePreviewer/demo-types';
import imageDemoDefinition from './demo-brutalist-image.demo';

const imageDemo = imageDemoDefinition as DemoSpec;

function collectNodes(node: DemoChild, result: DemoNode[] = []): DemoNode[] {
  if (typeof node === 'string') return result;
  result.push(node);
  if (node.kind === 'text') return result;
  for (const child of node.children ?? []) collectNodes(child, result);
  return result;
}

describe('Brutalist Image demo contract', () => {
  it('uses only brutalist image roots with consumer-owned sizing and the a11y binary', () => {
    const nodes = collectNodes(imageDemo.root);
    const images = nodes.filter(
      (node) => node.kind === 'proto' && node.prototypeId === 'brutalist-image-root'
    );
    expect(images).toHaveLength(5);

    const fits = new Set<string>();
    const modes = new Set<string>();
    for (const item of images) {
      if (item.kind !== 'proto') throw new Error('Expected Image Root');
      // The family frame never owns dimensions: every instance fixes its box
      // through the authored surfaceStyle instead.
      const surface = item.surfaceStyle;
      expect(typeof surface).toBe('object');
      if (!surface || typeof surface !== 'object' || Array.isArray(surface)) {
        throw new Error('Expected a static surfaceStyle record');
      }
      expect(surface.width).toBe('100%');
      expect(surface.height).toBeTruthy();
      fits.add(item.props?.fit as string);
      modes.add(item.props?.a11yMode as string);
      if (item.props?.a11yMode === 'informative') {
        expect(item.props?.alternativeText).toBeTruthy();
      }
    }
    expect(fits).toEqual(new Set(['contain', 'cover', 'fill']));
    expect(modes).toEqual(new Set(['informative', 'decorative']));
    // The error-path instance keeps an informative name on its broken source.
    const broken = images.find((item) => item.kind === 'proto' && item.ref === 'error');
    expect(broken).toBeTruthy();
  });
});
