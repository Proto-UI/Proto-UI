import type { AnatomyFamily } from './anatomy';

/**
 * Draft C-MATERIAL-PAINT-FOOTPRINT-0001 syntax. A declaration names a logical
 * descendant, never a selector, host node, pixel budget or optical profile.
 */
export type MaterialPaintReservationDeclaration = Readonly<{
  family: AnatomyFamily;
  targetRole: string;
  /**
   * Optional explicit logical layout reference for a fill-inline target.
   * Its content width is independent of the reservation part; no pixels enter
   * authored data. The host preserves the initial target/reference inset.
   */
  inlineSizeFrom?: Readonly<{ family: AnatomyFamily; role: string }>;
  /**
   * Optional read-only logical ancestor whose ordinary border outline bounds
   * this part. A host may reserve additional block clearance from its actual
   * rounded border; this never changes the material profile's footprint.
   */
  outlineFrom?: Readonly<{ family: AnatomyFamily; role: string }>;
}>;

declare const materialPaintReservationBrand: unique symbol;
/** Setup-owned identity; only its declaring owner may place it in a template. */
export type MaterialPaintReservation = Readonly<{
  [materialPaintReservationBrand]: true;
}>;
