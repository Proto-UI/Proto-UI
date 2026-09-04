import {
  declareModule,
  moduleDeclaration,
  type ModuleDeclarationToken,
  type PrototypeModuleDeclaration,
} from '@proto.ui/core';

export type TextControlDeclaration = Readonly<{
  content: 'plain-text';
  lineMode: 'single' | 'multiline';
  engine: 'host';
}>;

export const TEXT_CONTROL_DECLARATION: ModuleDeclarationToken<TextControlDeclaration> =
  moduleDeclaration<TextControlDeclaration>('@proto.ui/text-control/declaration');

export function declareTextControl(
  config: TextControlDeclaration
): PrototypeModuleDeclaration<TextControlDeclaration> {
  return declareModule(TEXT_CONTROL_DECLARATION, config);
}
