import { createStyleSnapshotter } from './snapshot-prototype-style';
import { libraryCardPrototypes } from './library-card-prototypes';

/** The finite card registry is passive: no command identity, event capabilities
 * or material provider. Server and browser retain the same honest fallback. */
export const snapshotLibraryPart = createStyleSnapshotter(libraryCardPrototypes);
