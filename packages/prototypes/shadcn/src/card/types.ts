import type { ShadcnStyleProps } from '../style-scope';
/** Passive styled regions; consumers retain document and action semantics. */
export interface ShadcnCardRootProps extends ShadcnStyleProps {
  /** Rhea density; New York retains its pinned default size only. */
  size?: 'default' | 'sm';
}
export type ShadcnCardRootExposes = {};
export interface ShadcnCardPartProps extends ShadcnStyleProps {}
export interface ShadcnCardHeaderProps extends ShadcnCardPartProps {
  divider?: boolean;
}
export type ShadcnCardHeaderExposes = {};
export interface ShadcnCardContentProps extends ShadcnCardPartProps {}
export type ShadcnCardContentExposes = {};
export interface ShadcnCardFooterProps extends ShadcnCardPartProps {
  divider?: boolean;
}
export type ShadcnCardFooterExposes = {};
