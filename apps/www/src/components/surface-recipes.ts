import type { SurfaceRootProps } from '@proto.ui/prototypes-base/surface';
import type { ProjectionFamilyId } from './PrototypePreviewer/projection-families';
export const surfacePrototypeId = (family: ProjectionFamilyId) => `${family}-surface-root`;
export const transitionPrototypeId = (family: ProjectionFamilyId) => `${family}-transition`;
/** Page composition maps a use case to generic visual facts, not to a private Prototype. */
export function panelSurfaceProps(
  appearance: 'card' | 'popup' | 'canvas',
  emphasis = 'plain'
): SurfaceRootProps {
  return {
    variant: emphasis === 'accent' ? 'accent' : 'outline',
    radius: 'default',
    border: 'all',
    elevation: appearance === 'card' ? 'raised' : 'none',
  };
}
export const panelSurfaceLayout = {
  display: 'block',
  width: '100%',
  minWidth: '0',
  padding: '1rem',
};
