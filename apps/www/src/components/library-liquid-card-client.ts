import { AdaptToWebComponent } from '@proto.ui/adapter-web-component';
import { libraryCardPrototypes } from './library-card-prototypes';
import { initLibraryCards } from './library-card-client';
import { withNativeContentLease } from './PrototypePreviewer/native-content-lease';
import {
  initLibraryLiquidScenes,
  createLibraryLiquidMaterialSink,
  LIQUID_CARD_CANDIDATE_TAG,
} from './library-liquid-scene';

/** Only the explicit candidate route imports this material-bearing entry. */
export function initLibraryLiquidCardCandidate(scope: ParentNode = document) {
  if (!scope.querySelector(LIQUID_CARD_CANDIDATE_TAG)) return () => {};
  const releaseScene = initLibraryLiquidScenes(scope);
  if (!customElements.get(LIQUID_CARD_CANDIDATE_TAG))
    withNativeContentLease(document.documentElement, () => {
      customElements.define(
        LIQUID_CARD_CANDIDATE_TAG,
        AdaptToWebComponent(libraryCardPrototypes['liquid-glass-surface'], {
          register: false,
          registerAs: LIQUID_CARD_CANDIDATE_TAG,
          getProps: (element) => JSON.parse(element.dataset.libraryProps ?? '{}'),
          createVisualSink: createLibraryLiquidMaterialSink,
        })
      );
    });
  const releaseCards = initLibraryCards(scope);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    releaseCards();
    releaseScene();
  };
}
