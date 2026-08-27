import {
  declareModule,
  moduleDeclaration,
  type ModuleDeclarationToken,
  type PrototypeModuleDeclaration,
} from '@proto.ui/core';

export type ImageViewDeclaration = Readonly<{
  source: string;
  alternativeText: string;
  a11yMode: 'informative' | 'decorative';
  fit: 'contain' | 'cover' | 'fill';
}>;

export const IMAGE_VIEW_DECLARATION: ModuleDeclarationToken<ImageViewDeclaration> =
  moduleDeclaration<ImageViewDeclaration>('@proto.ui/image-view/declaration');

export function declareImageView(
  config: ImageViewDeclaration
): PrototypeModuleDeclaration<ImageViewDeclaration> {
  return declareModule(IMAGE_VIEW_DECLARATION, config);
}
