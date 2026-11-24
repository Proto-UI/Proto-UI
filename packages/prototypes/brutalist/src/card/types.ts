export interface BrutalistCardRootProps {
  /** Spacing density: default (24px) or sm (16px). */
  size?: 'default' | 'sm';
}
export type BrutalistCardRootExposes = {};

export interface BrutalistCardPartProps {}

export interface BrutalistCardHeaderProps extends BrutalistCardPartProps {
  /** Render a 2px bottom divider matching the card ink. */
  divider?: boolean;
}
export type BrutalistCardHeaderExposes = {};

export interface BrutalistCardContentProps extends BrutalistCardPartProps {}
export type BrutalistCardContentExposes = {};

export interface BrutalistCardFooterProps extends BrutalistCardPartProps {
  /** Render a 2px top divider matching the card ink. */
  divider?: boolean;
}
export type BrutalistCardFooterExposes = {};
