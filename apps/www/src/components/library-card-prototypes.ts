import BaseSurface from '@proto.ui/prototypes-base/surface';
import BaseText from '@proto.ui/prototypes-base/text';
import ShadcnSurface from '@proto.ui/prototypes-shadcn/surface';
import {
  ShadcnCardRoot,
  ShadcnCardHeader,
  ShadcnCardContent,
  ShadcnCardFooter,
} from '@proto.ui/prototypes-shadcn/card';
import ShadcnText from '@proto.ui/prototypes-shadcn/text';
import BrutalistSurface from '@proto.ui/prototypes-brutalist/surface';
import BrutalistText from '@proto.ui/prototypes-brutalist/text';
import {
  BrutalistCardRoot,
  BrutalistCardHeader,
  BrutalistCardContent,
  BrutalistCardFooter,
} from '@proto.ui/prototypes-brutalist/card';
import BootstrapSurface from '@proto.ui/prototypes-bootstrap-2-3-2/surface';
import BootstrapText from '@proto.ui/prototypes-bootstrap-2-3-2/text';
import LiquidSurface from '@proto.ui/prototypes-liquid-glass/surface';
import LiquidText from '@proto.ui/prototypes-liquid-glass/text';

// Exported family sources are the only owners of paint and typography. Lucide is
// an icon library; its neutral carrier explicitly belongs to Base.
export const libraryCardPrototypes = {
  'base-surface': BaseSurface,
  'base-text': BaseText,
  'shadcn-card': ShadcnCardRoot,
  'shadcn-header': ShadcnCardHeader,
  'shadcn-content': ShadcnCardContent,
  'shadcn-footer': ShadcnCardFooter,
  'shadcn-surface': ShadcnSurface,
  'shadcn-text': ShadcnText,
  'brutalist-surface': BrutalistSurface,
  'brutalist-text': BrutalistText,
  'brutalist-card': BrutalistCardRoot,
  'brutalist-header': BrutalistCardHeader,
  'brutalist-content': BrutalistCardContent,
  'brutalist-footer': BrutalistCardFooter,
  'bootstrap-2-3-2-surface': BootstrapSurface,
  'bootstrap-2-3-2-text': BootstrapText,
  'liquid-glass-surface': LiquidSurface,
  'liquid-glass-text': LiquidText,
};
export type LibraryPart = keyof typeof libraryCardPrototypes;
export type LibraryFamily = 'base' | 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass';
export const librarySurfaceProps = {
  variant: 'outline',
  radius: 'default',
  border: 'all',
  elevation: 'raised',
} as const;
export const libraryHeadingProps = {
  size: '2xl',
  weight: 'bold',
  font: 'heading',
  leading: 'tight',
} as const;
export const libraryBodyProps = { size: 'base', leading: 'relaxed' } as const;
export const libraryCaptionProps = { size: 'sm', tone: 'muted', leading: 'normal' } as const;
export const libraryActionProps = {
  variant: 'solid',
  radius: 'default',
  border: 'all',
  elevation: 'raised',
} as const;

export const bootstrapLibraryHeadingProps = { ...libraryHeadingProps, leading: 'relaxed' } as const;
export const bootstrapLibraryBodyProps = { size: 'sm', leading: 'normal' } as const;
export const bootstrapLibraryActionTextProps = {
  size: 'sm',
  weight: 'normal',
  leading: 'normal',
  tone: 'inherit',
} as const;

// Consumer recipes preserve each family's existing typography rather than
// changing Text defaults shared by unrelated consumers.
export function libraryBodyPropsForFamily(family: LibraryFamily) {
  if (family === 'shadcn') return { ...libraryBodyProps, tone: 'inherit' } as const;
  if (family === 'brutalist') return { ...libraryBodyProps, weight: 'medium' } as const;
  return family === 'bootstrap-2-3-2' ? bootstrapLibraryBodyProps : libraryBodyProps;
}
export function libraryCaptionPropsForFamily(family: LibraryFamily) {
  return family === 'brutalist'
    ? ({ ...libraryCaptionProps, weight: 'medium' } as const)
    : libraryCaptionProps;
}

// Native h2 owns heading semantics; card ink must survive the nested Text.
export const shadcnLibraryHeadingProps = { ...libraryHeadingProps, tone: 'inherit' } as const;
