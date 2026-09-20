import { describe, expect, it } from 'vitest';
import dialogMask from '../../../prototypes/shadcn/src/dialog/overlay.proto';
import dialogRoot from '../../../prototypes/shadcn/src/dialog/root.proto';
import { AdaptToWebComponent, setElementProps } from '../src';
import { renderProtoShadowSplitStyleArtifact } from '../../../cli/src/services/proto-style-css';

// D1 pilot boundary + D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001 C/K:
// the actual asDialogMask -> asTransition closure requires an I1 hidden recipe.
describe('composed Shadow prototype admission', () => {
  it('rejects an old companion for the full Dialog Mask without claiming current full Mask support', async () => {
    const Parent = AdaptToWebComponent(dialogRoot, { registerAs: 'x-split-mask-parent' });
    const parent = new Parent();
    setElementProps(parent, { open: true });
    document.body.append(parent);
    const artifact = renderProtoShadowSplitStyleArtifact([
      'fixed',
      'inset-0',
      'bg-black/50',
      'backdrop-blur-xs',
      'hidden',
      'animate-in',
      'fade-in-0',
      'animate-out',
      'fade-out-0',
    ]);
    const oldArtifact = {
      ...artifact,
      cssText: artifact.cssText.replace('--pui-split-participation-coordinate-recipe: i1;', ''),
    };
    const Mask = AdaptToWebComponent(dialogMask, {
      registerAs: 'x-split-mask-admission',
      shadow: { mode: 'open', presentation: 'split', styleArtifact: oldArtifact },
      schedule: (task) => task(),
    });
    const host = new Mask();
    try {
      expect(() => parent.append(host)).toThrow(
        /shadcn-dialog-mask.*rule token "hidden".*I1 recipe/
      );
      expect(host.hasAttribute('data-pui-split-root-style')).toBe(false);
      expect(host.shadowRoot?.childNodes.length).toBe(0);
    } finally {
      parent.remove();
      await Promise.resolve();
    }
  });
});
