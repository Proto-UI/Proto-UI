import {
  declareModule,
  moduleDeclaration,
  type ModuleDeclarationToken,
  type PrototypeModuleDeclaration,
} from '@proto.ui/core';

/** A host-owned navigation target; never arbitrary host attributes. */
export type NativeLinkDeclaration = Readonly<{ navigation: 'native' }>;
export const NATIVE_LINK_DECLARATION: ModuleDeclarationToken<NativeLinkDeclaration> =
  moduleDeclaration<NativeLinkDeclaration>('@proto.ui/native-link/declaration');
export function declareNativeLink(): PrototypeModuleDeclaration<NativeLinkDeclaration> {
  return declareModule(NATIVE_LINK_DECLARATION, { navigation: 'native' });
}
