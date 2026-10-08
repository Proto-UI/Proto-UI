import { fragment as upstreamFragment } from './liquidgl-kernel.generated';

/** Proto UI-owned derivative, not the unmodified upstream profile. The imported
 * literal and its MIT attribution stay intact. This finite profile paints only
 * inside a bounded expanded paint box: no host transform or Apple parity.
 * Mask and refraction normals share deformPoint and the same inset geometry. */
export const contactProfile = 'liquidgl-v2-contact-canvas-1';
const specularStart = upstreamFragment.indexOf('          if (u_specular) {');
const specularEnd = upstreamFragment.indexOf('          if (u_revealType == 1)', specularStart);
if (specularStart < 0 || specularEnd < 0) throw new Error('contact-profile-upstream-drift');
const lighting = `          if (u_specular) {
            vec2 point = (p_px + b_px) / u_boxSize;
            vec2 contact = vec2(u_interaction.x, 1.0 - u_interaction.y);
            float localLight = 1.0 - smoothstep(0.0, 0.42, distance(point, contact));
            float rimLight = pow(clamp(edge, 0.0, 1.0), 2.0);
            float active = clamp(u_interactionRadius, 0.0, 1.0);
            final.rgb += vec3(0.035 + localLight * active * (0.075 + rimLight * 0.10));
          }

`;
export const contactFragment = (
  upstreamFragment.slice(0, specularStart) +
  lighting +
  upstreamFragment.slice(specularEnd)
)
  .replace('uniform float u_time;', 'uniform float u_time;\n        uniform float u_contactShape;')
  .replace(
    'vec2 b_px = 0.5 * u_boxSize;',
    // The same finite field drives the outward silhouette and its normals.
    // The host's style-owned radius scales with that field, never independently.
    `float dilation = 1.0 + 0.045 * clamp(u_contactShape, 0.0, 1.0);
          vec2 b_px = 0.5 * u_boxSize * dilation;
          float shapeRadius = min(u_radius * dilation, min(b_px.x, b_px.y));`
  )
  .replaceAll('b_px, u_radius', 'b_px, shapeRadius');

/** Includes the maximal 5.5% drag displacement plus 2.25% dilation and AA. */
export function contactPaintOutset(width: number, height: number) {
  return Math.ceil(Math.max(width, height) * 0.08 + 1);
}
